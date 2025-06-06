// Background script for FreshRoute
let isExtensionEnabled = true;
let appliedRules = new Set(); // Track applied rules to prevent duplicate notifications
let isUpdatingRules = false; // Prevent concurrent rule updates
let environmentVariables = []; // Cache environment variables

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  // Set default settings in sync storage (small data)
  await chrome.storage.sync.set({
    extensionEnabled: true,
    notificationsEnabled: true
  });
  
  // Initialize empty rules and groups in local storage (large data)
  const existing = await chrome.storage.local.get(['rules', 'groups']);
  if (!existing.rules && !existing.groups) {
    await chrome.storage.local.set({
      rules: [],
      groups: []
    });
  }
  
  // Load environment variables
  await loadEnvironmentVariables();
  
  console.log('FreshRoute installed');
});

// Also load environment variables on startup
chrome.runtime.onStartup.addListener(async () => {
  await loadEnvironmentVariables();
  console.log('FreshRoute started');
});

// Listen for storage changes to update rules
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.extensionEnabled) {
      isExtensionEnabled = changes.extensionEnabled.newValue;
      await updateDeclarativeRules();
    }
    
    if (changes.notificationsEnabled) {
      // Notify all content scripts about notification setting change
      notifyAllTabs('updateNotificationSettings', {
        enabled: changes.notificationsEnabled.newValue
      });
    }
    
    if (changes.environmentVariables) {
      // Reload environment variables and update rules
      console.log('🔄 Environment variables changed, reloading and updating rules...');
      await loadEnvironmentVariables();
      await updateDeclarativeRules();
      console.log('✅ Rules updated after environment variable change');
    }
  }
  
  if (namespace === 'local') {
    if (changes.rules || changes.groups) {
      await updateDeclarativeRules();
      // Clear applied rules cache when rules change
      appliedRules.clear();
    }
  }
});

// Monitor redirects to show accurate notifications
chrome.webRequest.onBeforeRedirect.addListener(async (details) => {
  if (details.tabId === -1) return; // Skip background requests
  
  // Get settings from sync storage and rules from local storage
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(['extensionEnabled', 'notificationsEnabled']),
    chrome.storage.local.get(['rules', 'groups'])
  ]);
  
  const { extensionEnabled, notificationsEnabled } = syncData;
  const { rules, groups } = localData;
  
  if (!extensionEnabled || !notificationsEnabled) return;
  
  // Check if this redirect was caused by one of our rules
  let allRules = [];
  
  // Use new grouped format if available, otherwise fall back to old format
  if (groups && groups.length > 0) {
    groups.forEach(group => {
      if (group.enabled !== false) { // Group is enabled
        group.rules.forEach(rule => {
          if (rule.enabled && rule.type === 'url_rewrite') { // Only URL rewrite rules cause redirects
            allRules.push(rule);
          }
        });
      }
    });
  } else if (rules && rules.length > 0) {
    allRules = rules.filter(rule => rule.enabled && rule.type === 'url_rewrite');
  }
  
  // Check if this redirect matches one of our rules
  for (const rule of allRules) {
    try {
      // Substitute variables in the source URL pattern for matching
      const sourceUrlWithVariables = substituteVariables(rule.sourceUrl);
      const regex = new RegExp(sourceUrlWithVariables);
      if (regex.test(details.url)) {
        const ruleKey = `${rule.type}-${rule.name}-${details.url}`;
        
        if (!appliedRules.has(ruleKey)) {
          appliedRules.add(ruleKey);
          
          // Clear the rule from cache after 10 seconds
          setTimeout(() => {
            appliedRules.delete(ruleKey);
          }, 10000);
          
          console.log(`✅ URL redirect detected: ${details.url} -> ${details.redirectUrl} (Rule: ${rule.name})`);
          
          // Send notification to the tab
          try {
            chrome.tabs.sendMessage(details.tabId, {
              action: 'ruleApplied',
              ruleName: rule.name,
              ruleType: rule.type,
              url: details.url,
              redirectUrl: details.redirectUrl
            }).catch(() => {
              // Ignore errors if content script is not loaded
            });
          } catch (error) {
            console.log('Could not send notification:', error);
          }
          
          // Send rule activity to dashboard
          await sendRuleActivityToDashboard({
            rule: { ...rule, type: 'url' },
            originalUrl: details.url,
            newUrl: details.redirectUrl,
            responseTime: details.responseTime || 0,
            timestamp: Date.now()
          });
          
          break; // Only notify for the first matching rule
        }
      }
    } catch (e) {
      // Invalid regex, skip
    }
  }
}, { urls: ["<all_urls>"] });

// Monitor header modifications
chrome.webRequest.onSendHeaders.addListener(async (details) => {
  if (details.tabId === -1) return; // Skip background requests
  
  // Get settings from sync storage and rules from local storage
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(['extensionEnabled', 'notificationsEnabled']),
    chrome.storage.local.get(['rules', 'groups'])
  ]);
  
  const { extensionEnabled, notificationsEnabled } = syncData;
  const { rules, groups } = localData;
  
  if (!extensionEnabled) return;
  
  // Check if this request matches any header modification rules
  let headerRules = [];
  
  // Use new grouped format if available
  if (groups && groups.length > 0) {
    groups.forEach(group => {
      if (group.enabled !== false) { // Group is enabled
        (group.rules || []).forEach(rule => {
          if (rule.enabled && rule.type === 'modify_headers') { 
            headerRules.push(rule);
          }
        });
      }
    });
  }
  
  // Check if this request matches any header rules
  for (const rule of headerRules) {
    try {
      const sourceUrlWithVariables = substituteVariables(rule.urlPattern);
      const regex = new RegExp(sourceUrlWithVariables);
      if (regex.test(details.url)) {
        const ruleKey = `header-${rule.name}-${details.url}`;
        
        if (!appliedRules.has(ruleKey)) {
          appliedRules.add(ruleKey);
          
          // Clear the rule from cache after 10 seconds
          setTimeout(() => {
            appliedRules.delete(ruleKey);
          }, 10000);
          
          console.log(`✅ Header modification applied: ${details.url} (Rule: ${rule.name || 'Unnamed'})`);
          
          // Send notification to the tab if enabled
          if (notificationsEnabled) {
            try {
              chrome.tabs.sendMessage(details.tabId, {
                action: 'ruleApplied',
                ruleName: rule.name || 'Header Rule',
                ruleType: 'header_modification',
                url: details.url
              }).catch(() => {
                // Ignore errors if content script is not loaded
              });
            } catch (error) {
              console.log('Could not send notification:', error);
            }
          }
          
          // Send rule activity to dashboard
          await sendRuleActivityToDashboard({
            rule: { ...rule, type: 'header' },
            originalUrl: details.url,
            newUrl: details.url, // Headers don't change URL
            responseTime: 0,
            timestamp: Date.now()
          });
          
          break; // Only notify for the first matching rule
        }
      }
    } catch (e) {
      // Invalid regex, skip
    }
  }
}, { urls: ["<all_urls>"] }, ["requestHeaders"]);

// Update declarative net request rules
async function updateDeclarativeRules() {
  // Prevent concurrent updates
  if (isUpdatingRules) {
    console.log('Rule update already in progress, skipping...');
    return;
  }
  
  isUpdatingRules = true;
  console.log('Starting rule update...');
  
  try {
    // Clear ALL existing dynamic rules first
    let existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    console.log(`Found ${existingRules.length} existing dynamic rules`);
    
    if (existingRules.length > 0) {
      const ruleIds = existingRules.map(rule => rule.id);
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
      
      // Verify rules were actually cleared
      await new Promise(resolve => setTimeout(resolve, 200));
      existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      if (existingRules.length > 0) {
        console.warn(`Warning: ${existingRules.length} rules still exist after clearing`);
        // Force clear again
        const remainingIds = existingRules.map(rule => rule.id);
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: remainingIds
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Get current settings
    const [syncData, localData] = await Promise.all([
      chrome.storage.sync.get(['extensionEnabled']),
      chrome.storage.local.get(['rules', 'groups'])
    ]);
    
    const { extensionEnabled } = syncData;
    const { rules, groups } = localData;
    
    if (!extensionEnabled) {
      console.log('Extension disabled, no rules to add');
      return;
    }

    let allRules = [];
    
    // Process groups and substitute variables at runtime
    if (groups && groups.length > 0) {
      // Extract rules from enabled groups and substitute variables
      groups.forEach((group, groupIndex) => {
        if (group.enabled !== false) { // Group is enabled
          if (group.rules) {
            group.rules.forEach((rule, ruleIndex) => {
              if (rule.enabled) { // Individual rule is enabled
                // Create a copy of the rule and substitute variables
                const processedRule = { ...rule, _groupIndex: groupIndex, _ruleIndex: ruleIndex };
                
                if (rule.type === 'url_rewrite') {
                  processedRule.sourceUrl = substituteVariables(rule.sourceUrl);
                  processedRule.targetUrl = substituteVariables(rule.targetUrl);
                } else if (rule.type === 'modify_headers') {
                  processedRule.urlPattern = substituteVariables(rule.urlPattern);
                  processedRule.headers = rule.headers.map(header => ({
                    ...header,
                    name: substituteVariables(header.name),
                    value: substituteVariables(header.value)
                  }));
                }
                
                allRules.push(processedRule);
              }
            });
          }
        }
      });
    } else if (rules && rules.length > 0) {
      // Fall back to old flat format and substitute variables
      allRules = rules.filter(rule => rule.enabled).map(rule => {
        const processedRule = { ...rule };
        
        if (rule.type === 'url_rewrite') {
          processedRule.sourceUrl = substituteVariables(rule.sourceUrl);
          processedRule.targetUrl = substituteVariables(rule.targetUrl);
        } else if (rule.type === 'modify_headers') {
          processedRule.urlPattern = substituteVariables(rule.urlPattern);
          processedRule.headers = rule.headers.map(header => ({
            ...header,
            name: substituteVariables(header.name),
            value: substituteVariables(header.value)
          }));
        }
        
        return processedRule;
      });
    }

    if (allRules.length === 0) {
      console.log('No enabled rules to add');
      return;
    }

    // Convert custom rules to declarative net request rules
    const declarativeRules = [];
    const usedIds = new Set(); // Track used IDs
    let ruleId = 1;

    // Separate URL rewrite rules and header rules
    const urlRewriteRules = allRules.filter(rule => rule.type === 'url_rewrite');
    const headerRules = allRules.filter(rule => rule.type === 'modify_headers');
    
    // Process URL rewrite rules
    if (urlRewriteRules.length > 0) {
      // Process URL rewrite rules
      for (let i = 0; i < urlRewriteRules.length; i++) {
        const rule = urlRewriteRules[i];
        
        // Generate safe integer ID
        while (usedIds.has(ruleId)) {
          ruleId++;
        }
        const uniqueId = ruleId++;
        usedIds.add(uniqueId);
        
        // Normalize and validate the regex pattern
        const normalizedPattern = normalizeRegexPattern(rule.sourceUrl);
        
        // Validate the regex before creating the rule
        try {
          new RegExp(normalizedPattern);
        } catch (e) {
          console.error(`❌ Invalid source regex for rule "${rule.name}": ${normalizedPattern}`, e);
          continue;
        }
        
        // Calculate priority based on specificity
        const specificity = calculateRuleSpecificity(normalizedPattern);
        const priority = Math.min(3000, 1000 + specificity);
        
        // Handle preserveOriginalHost option
        if (rule.preserveOriginalHost) {
          // Create separate rules for different resource types
          
          // Main frame rule (normal redirect)
          const mainFrameRule = {
            id: uniqueId,
            priority: priority + 100, // Higher priority for main frame
            action: {
              type: 'redirect',
              redirect: {
                regexSubstitution: rule.targetUrl.replace(/\$(\d+)/g, '\\$1')
              }
            },
            condition: {
              regexFilter: normalizedPattern,
              resourceTypes: ['main_frame']
            }
          };
          
          declarativeRules.push(mainFrameRule);
          
          // Non-main frame rule (preserve localhost) - create a second rule
          while (usedIds.has(ruleId)) {
            ruleId++;
          }
          const nonMainFrameId = ruleId++;
          usedIds.add(nonMainFrameId);
          
          // For non-main frame requests, we'll handle them differently
          // We need to use a script to inject custom fetch/XHR handlers
          // This is a limitation of declarativeNetRequest - we'll add this to content script
          
        } else {
          // Normal redirect rule
          const regexSubstitution = rule.targetUrl.replace(/\$(\d+)/g, '\\$1');
          
          const dnrRule = {
            id: uniqueId,
            priority: priority,
            action: {
              type: 'redirect',
              redirect: {
                regexSubstitution: regexSubstitution
              }
            },
            condition: {
              regexFilter: normalizedPattern,
              resourceTypes: [
                'main_frame',     // Navigation requests
                'sub_frame',      // iframe requests  
                'xmlhttprequest', // AJAX requests
                'other'           // Other resource types
              ]
            }
          };
          
          declarativeRules.push(dnrRule);
        }
      }
    }

    // Process header modification rules with improved validation
    if (headerRules.length > 0) {
      for (let i = 0; i < headerRules.length; i++) {
        const rule = headerRules[i];
        
        const requestHeaders = [];
        const responseHeaders = [];

        rule.headers.forEach(header => {
          // Validate and filter headers
          const headerValidation = validateHeaderForDeclarativeNetRequest(header);
          if (!headerValidation.allowed) {
            console.warn(`⚠️ Header "${header.name}" cannot be modified via declarativeNetRequest: ${headerValidation.reason}`);
            return; // Skip this header
          }

          const headerAction = {
            header: header.name,
            operation: header.operation, // 'set', 'append', 'remove'
            value: header.operation !== 'remove' ? header.value : undefined
          };

          if (header.target === 'request') {
            requestHeaders.push(headerAction);
          } else if (header.target === 'response') {
            responseHeaders.push(headerAction);
          }
        });

        if (requestHeaders.length > 0) {
          // Generate safe integer ID for request headers rule
          while (usedIds.has(ruleId)) {
            ruleId++;
          }
          const uniqueId = ruleId++;
          usedIds.add(uniqueId);
          
          try {
            // Validate URL pattern for declarativeNetRequest
            const normalizedUrlPattern = normalizeRegexPattern(rule.urlPattern);
            new RegExp(normalizedUrlPattern); // Test regex validity
            
            const requestRule = {
              id: uniqueId,
              priority: 100, // Lower priority than URL rewrites
              action: {
                type: 'modifyHeaders',
                requestHeaders: requestHeaders
              },
              condition: {
                regexFilter: normalizedUrlPattern,
                resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'other']
              }
            };
            
            declarativeRules.push(requestRule);
            console.log(`✅ Added request header rule "${rule.name}" with ${requestHeaders.length} headers`);
          } catch (e) {
            console.error(`❌ Invalid URL pattern for header rule "${rule.name}": ${rule.urlPattern}`, e);
          }
        }

        if (responseHeaders.length > 0) {
          // Generate safe integer ID for response headers rule
          while (usedIds.has(ruleId)) {
            ruleId++;
          }
          const uniqueId = ruleId++;
          usedIds.add(uniqueId);
          
          try {
            // Validate URL pattern for declarativeNetRequest
            const normalizedUrlPattern = normalizeRegexPattern(rule.urlPattern);
            new RegExp(normalizedUrlPattern); // Test regex validity
            
            const responseRule = {
              id: uniqueId,
              priority: 100, // Lower priority than URL rewrites
              action: {
                type: 'modifyHeaders',
                responseHeaders: responseHeaders
              },
              condition: {
                regexFilter: normalizedUrlPattern,
                resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'other']
              }
            };
            
            declarativeRules.push(responseRule);
            console.log(`✅ Added response header rule "${rule.name}" with ${responseHeaders.length} headers`);
          } catch (e) {
            console.error(`❌ Invalid URL pattern for header rule "${rule.name}": ${rule.urlPattern}`, e);
          }
        }

        // If no headers were valid, log a warning
        if (requestHeaders.length === 0 && responseHeaders.length === 0) {
          console.warn(`⚠️ No valid headers found for rule "${rule.name}" - all headers may be restricted`);
        }
      }
    }

    // Verify all rule IDs are unique before adding
    const allIds = declarativeRules.map(rule => rule.id);
    const uniqueIds = new Set(allIds);
    if (allIds.length !== uniqueIds.size) {
      console.error('Duplicate rule IDs detected in final rules array:', allIds);
      throw new Error('Duplicate rule IDs generated');
    }

    // Add the new rules
    if (declarativeRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: declarativeRules
      });
      
      console.log(`✅ Successfully updated ${declarativeRules.length} declarative rules`);
    }

  } catch (error) {
    console.error('❌ Error updating declarative rules:', error);
    
    // If there's an error, try to clear all rules to prevent inconsistent state
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);
      if (ruleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
      }
    } catch (clearError) {
      console.error('❌ Failed to clear rules after error:', clearError);
    }
  } finally {
    isUpdatingRules = false;
  }
}

// Validate if a header can be modified via declarativeNetRequest
function validateHeaderForDeclarativeNetRequest(header) {
  const headerName = header.name.toLowerCase();
  
  // Headers that cannot be modified for security reasons (both request and response)
  const universallyRestrictedHeaders = [
    // Browser-controlled headers
    'host',
    'connection',
    'upgrade',
    'expect',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding'
  ];
  
  if (universallyRestrictedHeaders.includes(headerName)) {
    return {
      allowed: false,
      reason: `Header "${header.name}" is browser-controlled and cannot be modified`
    };
  }
  
  // Request headers have fewer restrictions
  if (header.target === 'request') {
    return { allowed: true };
  }
  
  // Response headers have more restrictions
  if (header.target === 'response') {
    // CORS headers cannot be modified (security restriction)
    const corsHeaders = [
      'access-control-allow-origin',
      'access-control-allow-methods', 
      'access-control-allow-headers',
      'access-control-allow-credentials',
      'access-control-expose-headers',
      'access-control-max-age'
    ];
    
    if (corsHeaders.includes(headerName)) {
      return {
        allowed: false,
        reason: `CORS header "${header.name}" cannot be modified via extensions for security reasons. Must be set server-side.`
      };
    }
    
    // Security headers that cannot be modified
    const securityHeaders = [
      'content-security-policy',
      'x-frame-options',
      'strict-transport-security',
      'upgrade-insecure-requests',
      'set-cookie',
      'set-cookie2'
    ];
    
    if (securityHeaders.includes(headerName)) {
      return {
        allowed: false,
        reason: `Security header "${header.name}" cannot be modified via declarativeNetRequest`
      };
    }
    
    // These response headers CAN be modified
    const allowedResponseHeaders = [
      'cache-control',
      'content-type',
      'content-disposition',
      'content-encoding',
      'expires',
      'last-modified',
      'etag',
      'vary',
      'server',
      'x-powered-by',
      'x-custom-header',
      'x-api-version',
      'x-rate-limit',
      'x-debug-info'
    ];
    
    // Allow custom headers (x-* headers) and explicitly allowed headers
    if (headerName.startsWith('x-') || allowedResponseHeaders.includes(headerName)) {
      return { allowed: true };
    }
    
    // Warn about potentially restricted response header
    console.warn(`⚠️ Response header "${header.name}" may not be modifiable. Only custom (x-*) and specific headers are typically allowed.`);
    return { 
      allowed: true, // Try anyway, but warn
      warning: `Header "${header.name}" may not work - response headers are heavily restricted`
    };
  }
  
  return { allowed: true };
}

// Notify all tabs about settings changes
async function notifyAllTabs(action, data) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
        chrome.tabs.sendMessage(tab.id, { action, ...data }).catch(() => {
          // Ignore errors for tabs that don't have content script
        });
      }
    }
  } catch (error) {
    console.log('Error notifying tabs:', error);
  }
}

// Handle messages from popup/options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateRules') {
    // Reload environment variables first, then update rules
    loadEnvironmentVariables().then(() => {
      return updateDeclarativeRules();
    }).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('❌ Error updating rules:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Will respond asynchronously
  } else if (request.action === 'getCurrentRules') {
    // Get current active rules for debugging
    chrome.declarativeNetRequest.getDynamicRules().then(rules => {
      sendResponse({ rules });
    });
    return true;
  } else if (request.action === 'debugHeaders') {
    // Debug header rules
    debugHeaderRules().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

// Debug function to check header rules
async function debugHeaderRules() {
  try {
    const [syncData, localData] = await Promise.all([
      chrome.storage.sync.get(['extensionEnabled']),
      chrome.storage.local.get(['rules', 'groups'])
    ]);
    
    const { extensionEnabled } = syncData;
    const { rules, groups } = localData;
    
    const result = {
      extensionEnabled,
      totalGroups: groups ? groups.length : 0,
      totalRules: 0,
      headerRules: [],
      currentDynamicRules: []
    };
    
    // Analyze current rules
    let allRules = [];
    if (groups && groups.length > 0) {
      groups.forEach((group, groupIndex) => {
        if (group.enabled !== false) {
          if (group.rules) {
            group.rules.forEach((rule, ruleIndex) => {
              if (rule.enabled) {
                allRules.push({...rule, _groupIndex: groupIndex, _ruleIndex: ruleIndex});
              }
            });
          }
        }
      });
    } else if (rules && rules.length > 0) {
      allRules = rules.filter(rule => rule.enabled);
    }
    
    result.totalRules = allRules.length;
    
    // Get header rules specifically
    const headerRules = allRules.filter(rule => rule.type === 'modify_headers');
    result.headerRules = headerRules.map(rule => {
      const validHeaders = [];
      const invalidHeaders = [];
      
      rule.headers.forEach(header => {
        const validation = validateHeaderForDeclarativeNetRequest(header);
        if (validation.allowed) {
          validHeaders.push(header);
        } else {
          invalidHeaders.push({ header, reason: validation.reason });
        }
      });
      
      return {
        name: rule.name,
        urlPattern: rule.urlPattern,
        totalHeaders: rule.headers.length,
        validHeaders: validHeaders.length,
        invalidHeaders: invalidHeaders.length,
        invalidHeaderDetails: invalidHeaders,
        enabled: rule.enabled
      };
    });
    
    // Get current dynamic rules
    const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
    result.currentDynamicRules = dynamicRules.map(rule => ({
      id: rule.id,
      priority: rule.priority,
      action: rule.action,
      condition: rule.condition
    }));
    
    console.log('🔍 Header Rules Debug Info:', result);
    return { success: true, data: result };
    
  } catch (error) {
    console.error('❌ Error debugging header rules:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to calculate rule specificity (higher = more specific)
function calculateRuleSpecificity(sourcePattern) {
  let specificity = 0;
  
  // Base specificity
  specificity += 10;
  
  // Protocol specificity
  if (sourcePattern.includes('https://')) specificity += 5;
  if (sourcePattern.includes('http://')) specificity += 3;
  
  // Port specificity (higher specificity for specific ports)
  const portMatch = sourcePattern.match(/:(\d+)/);
  if (portMatch) {
    const port = parseInt(portMatch[1]);
    
    // Give much higher priority differentiation for ports
    specificity += 1000; // Base port bonus
    specificity += port * 10; // Port number * 10 for better separation
    
    // Additional bonus for non-standard ports
    if (port !== 80 && port !== 443) specificity += 500;
  }
  
  // Domain specificity
  const domainParts = sourcePattern.split('/')[2] || '';
  if (domainParts) {
    // Remove port from domain for analysis
    const cleanDomain = domainParts.split(':')[0];
    
    // Count subdomain levels
    const subdomains = cleanDomain.split('.').length - 2;
    specificity += subdomains * 5;
    
    // Exact domain vs wildcard
    if (!cleanDomain.includes('*') && !cleanDomain.includes('(') && !cleanDomain.includes('[')) {
      specificity += 15;
    }
    
    // Bonus for longer domain names (more specific)
    specificity += cleanDomain.length * 0.1;
  }
  
  // Path specificity
  const pathPart = sourcePattern.split('/').slice(3).join('/');
  if (pathPart) {
    // Longer paths are more specific
    specificity += pathPart.length * 0.1;
    
    // Specific path vs catch-all
    if (!pathPart.includes('.*') && !pathPart.includes('(.*)')) {
      specificity += 10;
    }
    
    // Count path segments
    const segments = pathPart.split('/').filter(s => s.length > 0);
    specificity += segments.length * 3;
  }
  
  // Escape character penalties (more escapes = more complex pattern)
  const escapeCount = (sourcePattern.match(/\\/g) || []).length;
  specificity += escapeCount * 2;
  
  // Character class penalties
  const characterClassCount = (sourcePattern.match(/\[.*?\]/g) || []).length;
  specificity += characterClassCount * 3;
  
  return Math.floor(specificity);
}

// Helper function to normalize and validate regex patterns
function normalizeRegexPattern(sourcePattern) {
  // Ensure the pattern is properly anchored and escaped
  let normalized = sourcePattern;
  
  // If not already anchored, add anchors for exact matching
  if (!normalized.startsWith('^')) {
    normalized = '^' + normalized;
  }
  if (!normalized.endsWith('$')) {
    normalized = normalized + '$';
  }
  
  // Ensure dots in domain are escaped (literal dots, not wildcards)
  const parts = normalized.split('://');
  if (parts.length === 2) {
    const protocol = parts[0];
    const rest = parts[1];
    
    // Split by / to separate domain from path
    const urlParts = rest.split('/');
    if (urlParts.length > 0) {
      // Handle the domain part (everything before first /)
      let domainPart = urlParts[0];
      
      // Only escape dots that aren't already escaped
      domainPart = domainPart.replace(/([^\\])\./g, '$1\\.');
      // Handle dot at the beginning of the string
      if (domainPart.startsWith('.')) {
        domainPart = '\\' + domainPart;
      }
      
      urlParts[0] = domainPart;
      normalized = protocol + '://' + urlParts.join('/');
    }
  }
  
  // Test the normalized regex
  try {
    new RegExp(normalized);
    return normalized;
  } catch (e) {
    console.warn(`⚠️ Normalized regex failed, using original: ${e.message}`);
    return sourcePattern;
  }
}

// Load environment variables from storage
async function loadEnvironmentVariables() {
  try {
    const result = await chrome.storage.sync.get(['environmentVariables']);
    const oldCount = environmentVariables.length;
    environmentVariables = result.environmentVariables || [];
    console.log(`📋 Loaded ${environmentVariables.length} environment variables (was ${oldCount})`);
    
    // Log the variables for debugging
    if (environmentVariables.length > 0) {
      console.log('📝 Environment variables:', environmentVariables.map(v => `${v.name}="${v.value}"`));
    }
  } catch (error) {
    console.error('❌ Error loading environment variables:', error);
    environmentVariables = [];
  }
}

// Substitute environment variables in text
function substituteVariables(text) {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  let substitutionsMade = 0;
  
  environmentVariables.forEach(variable => {
    const pattern = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
    const matches = text.match(pattern);
    if (matches) {
      result = result.replace(pattern, variable.value);
      substitutionsMade += matches.length;
      console.log(`🔄 Substituted {{${variable.name}}} with "${variable.value}" (${matches.length} times)`);
    }
  });
  
  if (substitutionsMade > 0) {
    console.log(`📝 Variable substitution: "${text}" → "${result}"`);
  }
  
  return result;
}

// Send rule activity to dashboard
async function sendRuleActivityToDashboard(ruleData) {
  try {
    // Find all dashboard tabs
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('dashboard.html') });
    
    // Send message to all dashboard tabs
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'ruleApplied',
          rule: ruleData.rule,
          originalUrl: ruleData.originalUrl,
          newUrl: ruleData.newUrl,
          responseTime: ruleData.responseTime || 0,
          timestamp: Date.now()
        });
      } catch (error) {
        // Tab might be closed or not ready, ignore error
        console.log('Could not send to dashboard tab:', error.message);
      }
    }
  } catch (error) {
    console.error('Error sending rule activity to dashboard:', error);
  }
}