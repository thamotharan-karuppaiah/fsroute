/**
 * FreshRoute - Live Rule Testing Dashboard
 * Real-time monitoring and testing of URL rewrite and header modification rules
 */

// Dashboard state
let isMonitoring = false;
let monitoringInterval = null;

// Rule data
let groups = [];
let environmentVariables = [];

// Visual Debugger Functions

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Run visual debugger analysis
async function runVisualDebugger() {
  const urlInput = document.getElementById('debugUrlInput');
  const resultsContainer = document.getElementById('debuggerResults');
  const showOnlyMatching = document.getElementById('showOnlyMatchingRules').checked;
  const testUrl = urlInput.value.trim();
  
  if (!testUrl) {
    alert('Please enter a URL to debug');
    return;
  }
  
  // Validate URL
  try {
    new URL(testUrl);
  } catch (error) {
    resultsContainer.innerHTML = `
      <div class="failure-reason">
        <strong>❌ Invalid URL Format</strong><br>
        Please enter a valid URL (e.g., https://example.com/path)
      </div>
    `;
    return;
  }
  
  // Show loading state
  resultsContainer.innerHTML = `
    <div class="debugger-placeholder">
      <div class="placeholder-icon">⏳</div>
      <h3>Analyzing Rules...</h3>
      <p>Running step-by-step pattern matching analysis</p>
    </div>
  `;
  
  // Process rules
  setTimeout(() => {
    try {
      const debugResults = analyzeUrlAgainstRules(testUrl, showOnlyMatching);
      renderDebugResults(debugResults, testUrl);
    } catch (error) {
      console.error('Debug analysis error:', error);
      resultsContainer.innerHTML = `
        <div class="failure-reason">
          <strong>❌ Analysis Error</strong><br>
          ${error.message}
        </div>
      `;
    }
  }, 500); // Small delay for loading effect
}

// Clear debugger results
function clearDebugger() {
  document.getElementById('debugUrlInput').value = '';
  document.getElementById('debuggerResults').innerHTML = `
    <div class="debugger-placeholder">
      <div class="placeholder-icon">🎯</div>
      <h3>Ready for Visual Debugging</h3>
      <p>Enter a URL above and click "Debug Rules" to see step-by-step pattern matching</p>
      <ul class="feature-list">
        <li>🔍 Step-by-step rule evaluation</li>
        <li>🎨 Visual regex pattern matching</li>
        <li>🔄 Variable substitution tracking</li>
        <li>📝 Capture group visualization</li>
        <li>❌ Match failure explanations</li>
      </ul>
    </div>
  `;
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  console.log('FreshRoute Dashboard initialized');
  await loadData();
  await loadDashboardLogs();
  setupEventListeners();
  updateMonitoringStatus();
  
  // Set up message listener immediately (not just when monitoring starts)
  chrome.runtime.onMessage.addListener(handleRuleActivity);
});

// Load groups and environment variables
async function loadData() {
  try {
    // Load from both local and sync storage to handle the current structure
    const [localData, syncData] = await Promise.all([
      chrome.storage.local.get(['groups']),
      chrome.storage.sync.get(['environmentVariables'])
    ]);
    
    groups = localData.groups || [];
    environmentVariables = syncData.environmentVariables || [];
    console.log('Dashboard loaded data:', { 
      groups: groups.length, 
      environmentVariables: environmentVariables.length 
    });
    
    // Log detailed group structure for debugging
    if (groups.length > 0) {
      let totalRules = 0;
      let enabledRules = 0;
      groups.forEach((group, i) => {
        const groupRules = (group.rules || []).length;
        const groupEnabledRules = (group.rules || []).filter(rule => rule.enabled).length;
        totalRules += groupRules;
        enabledRules += groupEnabledRules;
        console.log(`Group ${i}: "${group.name}" - ${groupRules} rules (${groupEnabledRules} enabled), group enabled: ${group.enabled !== false}`);
      });
      console.log(`Total: ${totalRules} rules, ${enabledRules} enabled across ${groups.length} groups`);
    }
    
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('startMonitoringBtn').addEventListener('click', startMonitoring);
  document.getElementById('pauseMonitoringBtn').addEventListener('click', pauseMonitoring);
  document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
  document.getElementById('testUrlBtn').addEventListener('click', testUrl);
  
  // Visual Debugger listeners
  document.getElementById('runDebuggerBtn').addEventListener('click', runVisualDebugger);
  document.getElementById('clearDebuggerBtn').addEventListener('click', clearDebugger);
  
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Enter key for URL testing
  document.getElementById('testUrlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      testUrl();
    }
  });
  
  // Enter key for visual debugger
  document.getElementById('debugUrlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      runVisualDebugger();
    }
  });
}

// Switch between tabs
function switchTab(tabId) {
  // Remove active class from all tabs and content
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Add active class to selected tab and content
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

// Start monitoring
function startMonitoring() {
  if (isMonitoring) return;
  
  isMonitoring = true;
  updateMonitoringStatus();
  
  addLogEntry('success', 'Monitoring started - Listening for rule activity...');
  
  // Enable/disable buttons
  document.getElementById('startMonitoringBtn').disabled = true;
  document.getElementById('pauseMonitoringBtn').disabled = false;
}

// Pause monitoring
function pauseMonitoring() {
  if (!isMonitoring) return;
  
  isMonitoring = false;
  updateMonitoringStatus();
  
  // Clear interval
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  addLogEntry('error', 'Monitoring paused');
  
  // Enable/disable buttons
  document.getElementById('startMonitoringBtn').disabled = false;
  document.getElementById('pauseMonitoringBtn').disabled = true;
}

// Handle rule activity from background script
function handleRuleActivity(message, sender, sendResponse) {
  if (message.type === 'ruleApplied') {
    const { rule, originalUrl, newUrl, responseTime } = message;
    
    // Add log entry  
    const logType = (rule.type === 'url' || rule.type === 'url_rewrite') ? 'redirect' : 'header';
    const logMessage = (rule.type === 'url' || rule.type === 'url_rewrite')
      ? `${originalUrl} → ${newUrl}` 
      : `Headers modified for ${originalUrl}`;
    
    addLogEntry(logType, logMessage, rule.name || 'Unnamed Rule');
  }
}

// Update monitoring status UI
function updateMonitoringStatus() {
  const statusElement = document.getElementById('monitoringStatus');
  const statusText = statusElement.querySelector('span');
  
  if (isMonitoring) {
    statusElement.className = 'monitoring-status active';
    statusText.textContent = 'Monitoring Active';
  } else {
    statusElement.className = 'monitoring-status inactive';
    statusText.textContent = 'Monitoring Stopped';
  }
}

// Test URL against rules
async function testUrl() {
  const urlInput = document.getElementById('testUrlInput');
  const testResultDiv = document.getElementById('testResult');
  const testUrl = urlInput.value.trim();
  
  if (!testUrl) {
    testResultDiv.innerHTML = '<div class="test-result no-match">Please enter a URL to test</div>';
    return;
  }
  
  // Clear previous result
  testResultDiv.innerHTML = '';
  
  try {
    const url = new URL(testUrl);
    const matchedRules = [];
    
    // Substitute environment variables
    const substitutedVars = {};
    environmentVariables.forEach(envVar => {
      substitutedVars[envVar.name] = envVar.value;
    });
    
    // Test against all enabled rules
    groups.forEach((group, groupIndex) => {
      if (group.enabled === false) return; // Skip disabled groups
      
      // Test all rules in the group
      (group.rules || []).forEach((rule, ruleIndex) => {
        if (!rule.enabled) return;
        
        // Handle URL rewrite rules
        if (rule.type === 'url_rewrite') {
          let pattern = rule.sourceUrl;
          let targetUrl = rule.targetUrl;
          
          // Substitute environment variables
          Object.keys(substitutedVars).forEach(varName => {
            const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
            pattern = pattern.replace(regex, substitutedVars[varName]);
            targetUrl = targetUrl.replace(regex, substitutedVars[varName]);
          });
          
          try {
            const regex = new RegExp(pattern);
            if (regex.test(testUrl)) {
              const newUrl = testUrl.replace(regex, targetUrl);
              matchedRules.push({
                type: 'URL Redirect',
                groupName: group.name,
                ruleName: rule.name || `URL Rule ${ruleIndex + 1}`,
                pattern: pattern,
                action: `Redirect to: ${newUrl}`,
                originalUrl: testUrl,
                newUrl: newUrl
              });
            }
          } catch (error) {
            console.error('Invalid regex pattern:', pattern, error);
          }
        }
        
        // Handle header modification rules
        else if (rule.type === 'modify_headers') {
          let pattern = rule.urlPattern;
          
          // Substitute environment variables
          Object.keys(substitutedVars).forEach(varName => {
            const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
            pattern = pattern.replace(regex, substitutedVars[varName]);
          });
          
          try {
            const regex = new RegExp(pattern);
            if (regex.test(testUrl)) {
              const headerActions = [];
              (rule.headers || []).forEach(header => {
                let value = header.value;
                Object.keys(substitutedVars).forEach(varName => {
                  const varRegex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
                  value = value.replace(varRegex, substitutedVars[varName]);
                });
                headerActions.push(`${header.name}: ${value}`);
              });
              
              matchedRules.push({
                type: 'Header Modification',
                groupName: group.name,
                ruleName: rule.name || `Header Rule ${ruleIndex + 1}`,
                pattern: pattern,
                action: `Headers: ${headerActions.join(', ')}`
              });
            }
          } catch (error) {
            console.error('Invalid regex pattern:', pattern, error);
          }
        }
      });
    });
    
    // Display results
    if (matchedRules.length > 0) {
      let resultHtml = '<div class="test-result match">';
      resultHtml += `<strong>✅ ${matchedRules.length} rule(s) matched:</strong><br><br>`;
      
      matchedRules.forEach((rule, index) => {
        resultHtml += `<strong>${index + 1}. ${rule.type}</strong><br>`;
        resultHtml += `Group: ${rule.groupName}<br>`;
        resultHtml += `Rule: ${rule.ruleName}<br>`;
        resultHtml += `Pattern: <code>${rule.pattern}</code><br>`;
        resultHtml += `Action: ${rule.action}<br>`;
        if (rule.newUrl) {
          resultHtml += `Result URL: <code>${rule.newUrl}</code><br>`;
        }
        if (index < matchedRules.length - 1) {
          resultHtml += '<br>---<br><br>';
        }
      });
      
      resultHtml += '</div>';
      testResultDiv.innerHTML = resultHtml;
      
      // Add to activity log
      addLogEntry('success', `URL test: ${matchedRules.length} rules matched for ${testUrl}`);
    } else {
      testResultDiv.innerHTML = '<div class="test-result no-match"><strong>❌ No rules matched</strong><br>The URL doesn\'t match any enabled rule patterns</div>';
      addLogEntry('error', `URL test: No rules matched for ${testUrl}`);
    }
    
  } catch (error) {
    testResultDiv.innerHTML = '<div class="test-result no-match"><strong>❌ Invalid URL</strong><br>Please enter a valid URL</div>';
    console.error('URL test error:', error);
  }
}

// Add log entry
function addLogEntry(type, message, ruleName = null) {
  const logContainer = document.getElementById('liveLogContainer');
  const timestamp = new Date().toLocaleTimeString();
  
  // Remove "no activity" message if it exists
  if (logContainer.children.length === 1 && logContainer.children[0].textContent.includes('No activity yet')) {
    logContainer.innerHTML = '';
  }
  
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  
  let logHtml = `<span class="log-timestamp">[${timestamp}]</span>`;
  logHtml += `<span class="log-url">${message}</span>`;
  if (ruleName) {
    logHtml += ` <span class="log-rule">(${ruleName})</span>`;
  }
  
  logEntry.innerHTML = logHtml;
  
  // Add to top of log container
  logContainer.insertBefore(logEntry, logContainer.firstChild);
  
  // Keep only last 100 entries
  while (logContainer.children.length > 100) {
    logContainer.removeChild(logContainer.lastChild);
  }
  
  // Save to storage for persistence
  saveDashboardLogs();
}

// Clear logs
function clearLogs() {
  const logContainer = document.getElementById('liveLogContainer');
  logContainer.innerHTML = '<div class="log-entry"><span class="log-timestamp">[Logs cleared]</span><span class="log-url">Log history cleared</span></div>';
  
  // Clear saved logs
  chrome.storage.local.set({ dashboardLogs: [] });
}

// Save dashboard logs to storage
async function saveDashboardLogs() {
  const logContainer = document.getElementById('liveLogContainer');
  const logs = Array.from(logContainer.children).slice(0, 50).map(entry => entry.innerHTML);
  await chrome.storage.local.set({ dashboardLogs: logs });
}

// Load dashboard logs from storage
async function loadDashboardLogs() {
  try {
    const { dashboardLogs } = await chrome.storage.local.get(['dashboardLogs']);
    if (dashboardLogs && dashboardLogs.length > 0) {
      const logContainer = document.getElementById('liveLogContainer');
      logContainer.innerHTML = '';
      dashboardLogs.forEach(logHtml => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = logHtml;
        logContainer.appendChild(logEntry);
      });
    }
  } catch (error) {
    console.error('Error loading dashboard logs:', error);
  }
}

// Export functions for testing
window.FreshRouteDashboard = {
  testUrl,
  startMonitoring,
  pauseMonitoring,
  clearLogs,
  addLogEntry
};

// Analyze URL against all rules with detailed debugging
function analyzeUrlAgainstRules(testUrl, showOnlyMatching = false) {
  const results = {
    url: testUrl,
    totalRules: 0,
    matchingRules: 0,
    groups: []
  };
  
  // Substitute environment variables for debugging
  const substitutedVars = {};
  environmentVariables.forEach(envVar => {
    substitutedVars[envVar.name] = envVar.value;
  });
  
  // Analyze each group
  groups.forEach((group, groupIndex) => {
    const groupResult = {
      name: group.name,
      enabled: group.enabled !== false,
      rules: []
    };
    
    if (!groupResult.enabled) {
      groupResult.disabledReason = 'Group is disabled';
    }
    
    // Analyze each rule in the group
    (group.rules || []).forEach((rule, ruleIndex) => {
      results.totalRules++;
      
      const ruleResult = analyzeRuleMatch(rule, testUrl, substitutedVars, groupResult.enabled);
      groupResult.rules.push(ruleResult);
      
      if (ruleResult.matches) {
        results.matchingRules++;
      }
    });
    
    // Only include group if it has rules and matches filter
    if (groupResult.rules.length > 0) {
      if (!showOnlyMatching || groupResult.rules.some(r => r.matches)) {
        results.groups.push(groupResult);
      }
    }
  });
  
  return results;
}

// Analyze individual rule match with detailed steps
function analyzeRuleMatch(rule, testUrl, substitutedVars, groupEnabled) {
  const result = {
    name: rule.name || 'Unnamed Rule',
    type: rule.type,
    enabled: rule.enabled,
    groupEnabled: groupEnabled,
    matches: false,
    steps: [],
    finalResult: null,
    error: null
  };
  
  // Step 1: Rule Status Check
  if (!groupEnabled) {
    result.steps.push({
      type: 'failure',
      title: '❌ Group Disabled',
      content: 'This rule\'s group is disabled, so the rule will not be evaluated.',
      details: null
    });
    return result;
  }
  
  if (!rule.enabled) {
    result.steps.push({
      type: 'failure',
      title: '❌ Rule Disabled',
      content: 'This individual rule is disabled, so it will not be evaluated.',
      details: null
    });
    return result;
  }
  
  result.steps.push({
    type: 'success',
    title: '✅ Rule Status',
    content: 'Rule is enabled and ready for evaluation.',
    details: null
  });
  
  try {
    if (rule.type === 'url_rewrite') {
      return analyzeUrlRewriteRule(rule, testUrl, substitutedVars, result);
    } else if (rule.type === 'modify_headers') {
      return analyzeHeaderRule(rule, testUrl, substitutedVars, result);
    } else {
      result.error = `Unknown rule type: ${rule.type}`;
      result.steps.push({
        type: 'failure',
        title: '❌ Unknown Rule Type',
        content: `Rule type "${rule.type}" is not recognized.`,
        details: null
      });
    }
  } catch (error) {
    result.error = error.message;
    result.steps.push({
      type: 'failure',
      title: '❌ Analysis Error',
      content: `Error analyzing rule: ${error.message}`,
      details: null
    });
  }
  
  return result;
}

// Analyze URL rewrite rule with visual matching
function analyzeUrlRewriteRule(rule, testUrl, substitutedVars, result) {
  const originalPattern = rule.sourceUrl;
  const originalTarget = rule.targetUrl;
  
  // Step 2: Variable Substitution
  let substitutedPattern = originalPattern;
  let substitutedTarget = originalTarget;
  const variableReplacements = [];
  
  Object.keys(substitutedVars).forEach(varName => {
    const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
    const patternMatches = originalPattern.match(regex);
    const targetMatches = originalTarget.match(regex);
    
    if (patternMatches || targetMatches) {
      variableReplacements.push({
        variable: varName,
        value: substitutedVars[varName],
        patternCount: patternMatches ? patternMatches.length : 0,
        targetCount: targetMatches ? targetMatches.length : 0
      });
      
      substitutedPattern = substitutedPattern.replace(regex, substitutedVars[varName]);
      substitutedTarget = substitutedTarget.replace(regex, substitutedVars[varName]);
    }
  });
  
  if (variableReplacements.length > 0) {
    result.steps.push({
      type: 'info',
      title: '🔄 Variable Substitution',
      content: 'Environment variables have been substituted in the pattern.',
      details: {
        type: 'variables',
        originalPattern,
        substitutedPattern,
        originalTarget,
        substitutedTarget,
        replacements: variableReplacements
      }
    });
  } else {
    result.steps.push({
      type: 'info',
      title: '🔄 Variable Substitution',
      content: 'No environment variables found in this rule.',
      details: null
    });
  }
  
  // Step 3: Regex Pattern Matching
  let regex;
  try {
    regex = new RegExp(substitutedPattern);
    result.steps.push({
      type: 'success',
      title: '✅ Pattern Validation',
      content: 'Regex pattern compiled successfully.',
      details: {
        type: 'pattern',
        pattern: substitutedPattern
      }
    });
  } catch (error) {
    result.steps.push({
      type: 'failure',
      title: '❌ Invalid Pattern',
      content: `Regex pattern is invalid: ${error.message}`,
      details: {
        type: 'error',
        pattern: substitutedPattern,
        error: error.message
      }
    });
    result.error = `Invalid regex: ${error.message}`;
    return result;
  }
  
  // Step 4: URL Matching
  const match = testUrl.match(regex);
  if (match) {
    result.matches = true;
    
    // Visual match breakdown
    const matchDetails = {
      type: 'match',
      fullMatch: match[0],
      captureGroups: match.slice(1),
      urlBreakdown: createUrlBreakdown(testUrl, match, substitutedPattern)
    };
    
    result.steps.push({
      type: 'success',
      title: '✅ Pattern Match',
      content: 'URL matches the regex pattern!',
      details: matchDetails
    });
    
    // Step 5: Target URL Generation
    try {
      let targetUrl = substitutedTarget;
      match.forEach((group, index) => {
        if (index > 0) { // Skip full match
          const placeholder = `$${index}`;
          targetUrl = targetUrl.replace(new RegExp('\\' + placeholder, 'g'), group || '');
        }
      });
      
      result.finalResult = {
        type: 'redirect',
        originalUrl: testUrl,
        targetUrl: targetUrl
      };
      
      result.steps.push({
        type: 'success',
        title: '🎯 Target URL Generation',
        content: `Generated target URL: ${targetUrl}`,
        details: {
          type: 'target',
          originalTarget: substitutedTarget,
          finalTarget: targetUrl,
          captureGroups: match.slice(1)
        }
      });
      
    } catch (error) {
      result.steps.push({
        type: 'failure',
        title: '❌ Target Generation Error',
        content: `Error generating target URL: ${error.message}`,
        details: null
      });
    }
    
  } else {
    result.steps.push({
      type: 'failure',
      title: '❌ No Pattern Match',
      content: 'URL does not match the regex pattern.',
      details: {
        type: 'no-match',
        pattern: substitutedPattern,
        url: testUrl,
        reason: analyzeMatchFailure(testUrl, substitutedPattern)
      }
    });
  }
  
  return result;
}

// Analyze header modification rule
function analyzeHeaderRule(rule, testUrl, substitutedVars, result) {
  const originalPattern = rule.urlPattern;
  
  // Step 2: Variable Substitution
  let substitutedPattern = originalPattern;
  const variableReplacements = [];
  
  Object.keys(substitutedVars).forEach(varName => {
    const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
    const matches = originalPattern.match(regex);
    
    if (matches) {
      variableReplacements.push({
        variable: varName,
        value: substitutedVars[varName],
        count: matches.length
      });
      
      substitutedPattern = substitutedPattern.replace(regex, substitutedVars[varName]);
    }
  });
  
  if (variableReplacements.length > 0) {
    result.steps.push({
      type: 'info',
      title: '🔄 Variable Substitution',
      content: 'Environment variables have been substituted in the URL pattern.',
      details: {
        type: 'variables',
        originalPattern,
        substitutedPattern,
        replacements: variableReplacements
      }
    });
  } else {
    result.steps.push({
      type: 'info',
      title: '🔄 Variable Substitution',
      content: 'No environment variables found in this rule.',
      details: null
    });
  }
  
  // Step 3: Regex Pattern Matching
  let regex;
  try {
    regex = new RegExp(substitutedPattern);
    result.steps.push({
      type: 'success',
      title: '✅ Pattern Validation',
      content: 'URL pattern compiled successfully.',
      details: {
        type: 'pattern',
        pattern: substitutedPattern
      }
    });
  } catch (error) {
    result.steps.push({
      type: 'failure',
      title: '❌ Invalid Pattern',
      content: `URL pattern is invalid: ${error.message}`,
      details: {
        type: 'error',
        pattern: substitutedPattern,
        error: error.message
      }
    });
    result.error = `Invalid regex: ${error.message}`;
    return result;
  }
  
  // Step 4: URL Matching
  const match = regex.test(testUrl);
  if (match) {
    result.matches = true;
    
    result.steps.push({
      type: 'success',
      title: '✅ Pattern Match',
      content: 'URL matches the pattern! Headers will be modified.',
      details: {
        type: 'match',
        pattern: substitutedPattern
      }
    });
    
    // Step 5: Header Analysis
    const processedHeaders = [];
    rule.headers.forEach(header => {
      let headerValue = header.value;
      
      // Substitute variables in header values
      Object.keys(substitutedVars).forEach(varName => {
        const varRegex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
        headerValue = headerValue.replace(varRegex, substitutedVars[varName]);
      });
      
      processedHeaders.push({
        name: header.name,
        operation: header.operation,
        target: header.target,
        originalValue: header.value,
        processedValue: headerValue
      });
    });
    
    result.finalResult = {
      type: 'headers',
      headers: processedHeaders
    };
    
    result.steps.push({
      type: 'success',
      title: '📝 Header Processing',
      content: `${processedHeaders.length} header(s) will be modified.`,
      details: {
        type: 'headers',
        headers: processedHeaders
      }
    });
    
  } else {
    result.steps.push({
      type: 'failure',
      title: '❌ No Pattern Match',
      content: 'URL does not match the pattern.',
      details: {
        type: 'no-match',
        pattern: substitutedPattern,
        url: testUrl,
        reason: analyzeMatchFailure(testUrl, substitutedPattern)
      }
    });
  }
  
  return result;
}

// Create visual URL breakdown showing matched parts
function createUrlBreakdown(url, match, pattern) {
  // This is a simplified version - in a real implementation,
  // you'd want more sophisticated pattern analysis
  const fullMatch = match[0];
  const beforeMatch = url.substring(0, url.indexOf(fullMatch));
  const afterMatch = url.substring(url.indexOf(fullMatch) + fullMatch.length);
  
  return {
    before: beforeMatch,
    matched: fullMatch,
    after: afterMatch,
    captureGroups: match.slice(1)
  };
}

// Analyze why a pattern failed to match
function analyzeMatchFailure(url, pattern) {
  const reasons = [];
  
  // Check common issues
  if (pattern.includes('https://') && url.startsWith('http://')) {
    reasons.push('Pattern expects HTTPS but URL uses HTTP');
  }
  
  if (pattern.includes('http://') && url.startsWith('https://')) {
    reasons.push('Pattern expects HTTP but URL uses HTTPS');
  }
  
  const patternDomain = pattern.match(/\/\/([^\/]+)/)?.[1];
  const urlDomain = url.match(/\/\/([^\/]+)/)?.[1];
  
  if (patternDomain && urlDomain && !patternDomain.includes('.*') && patternDomain !== urlDomain) {
    reasons.push(`Domain mismatch: pattern expects "${patternDomain}" but URL has "${urlDomain}"`);
  }
  
  // Check for anchoring issues
  if (!pattern.startsWith('^') && !pattern.endsWith('$')) {
    reasons.push('Pattern is not anchored - consider adding ^ at start and $ at end');
  }
  
  if (reasons.length === 0) {
    reasons.push('Pattern structure does not match URL format');
  }
  
  return reasons;
}

// Render debug results
function renderDebugResults(results, testUrl) {
  const container = document.getElementById('debuggerResults');
  
  if (results.groups.length === 0) {
    container.innerHTML = `
      <div class="debugger-placeholder">
        <div class="placeholder-icon">🔍</div>
        <h3>No Rules to Debug</h3>
        <p>No active rules found or all rules filtered out.</p>
        <p>Try unchecking "Show only matching rules" to see all rules.</p>
      </div>
    `;
    return;
  }
  
  let html = `
    <div class="debug-summary">
      <h3>🎯 Debug Analysis for: <code>${escapeHtml(testUrl)}</code></h3>
      <div class="debug-stats">
        <span class="stat">📊 ${results.totalRules} total rules</span>
        <span class="stat ${results.matchingRules > 0 ? 'success' : 'failure'}">
          ${results.matchingRules > 0 ? '✅' : '❌'} ${results.matchingRules} matching
        </span>
      </div>
    </div>
  `;
  
  results.groups.forEach(group => {
    const hasMatches = group.rules.some(rule => rule.matches);
    
    html += `
      <div class="rule-debug-card ${hasMatches ? 'matching' : 'non-matching'}">
        <div class="rule-debug-header" data-group="${group.name}">
          <div class="rule-debug-title">
            <span class="rule-debug-expand">▼</span>
            <div class="rule-info">
              <div class="rule-name">📁 ${escapeHtml(group.name)}</div>
              <div class="group-summary">${group.rules.length} rules in group</div>
            </div>
            <div class="match-status ${hasMatches ? 'success' : 'failure'}">
              ${hasMatches ? '✅ Has matches' : '❌ No matches'}
            </div>
          </div>
        </div>
        <div class="rule-debug-content expanded">
          ${group.rules.map(rule => renderRuleDebug(rule)).join('')}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Add expand/collapse listeners
  container.querySelectorAll('.rule-debug-header').forEach(header => {
    header.addEventListener('click', toggleRuleDebugCard);
  });
}

// Render individual rule debug details
function renderRuleDebug(rule) {
  const typeClass = rule.type.replace('_', '-');
  const statusClass = rule.matches ? 'success' : 'failure';
  
  let html = `
    <div class="rule-debug-item">
      <div class="rule-debug-summary">
        <div class="rule-info">
          <div class="rule-name">${escapeHtml(rule.name)}</div>
          <span class="rule-type-badge ${typeClass}">${rule.type.replace('_', ' ')}</span>
        </div>
        <div class="match-status ${statusClass}">
          ${rule.matches ? '✅ Match' : '❌ No match'}
        </div>
      </div>
      
      <div class="rule-steps">
        ${rule.steps.map(step => renderDebugStep(step)).join('')}
      </div>
      
      ${rule.finalResult ? renderFinalResult(rule.finalResult) : ''}
    </div>
  `;
  
  return html;
}

// Render individual debug step
function renderDebugStep(step) {
  let detailsHtml = '';
  
  if (step.details) {
    switch (step.details.type) {
      case 'variables':
        detailsHtml = renderVariableDetails(step.details);
        break;
      case 'match':
        detailsHtml = renderMatchDetails(step.details);
        break;
      case 'no-match':
        detailsHtml = renderNoMatchDetails(step.details);
        break;
      case 'target':
        detailsHtml = renderTargetDetails(step.details);
        break;
      case 'headers':
        detailsHtml = renderHeaderDetails(step.details);
        break;
      case 'pattern':
        detailsHtml = `<div class="step-content"><code>${escapeHtml(step.details.pattern)}</code></div>`;
        break;
    }
  }
  
  return `
    <div class="debug-step ${step.type}">
      <div class="step-title">${step.title}</div>
      <div class="step-content">${step.content}</div>
      ${detailsHtml}
    </div>
  `;
}

// Render variable substitution details
function renderVariableDetails(details) {
  if (!details.replacements || details.replacements.length === 0) {
    return '';
  }
  
  let html = '<div class="variable-substitutions">';
  html += '<strong>Variable Substitutions:</strong><br>';
  
  details.replacements.forEach(replacement => {
    html += `
      <div class="variable-sub">
        <span class="var-name">{{${replacement.variable}}}</span> → 
        <span class="var-value">"${escapeHtml(replacement.value)}"</span>
        ${replacement.patternCount ? `(${replacement.patternCount} in pattern)` : ''}
        ${replacement.targetCount ? `(${replacement.targetCount} in target)` : ''}
      </div>
    `;
  });
  
  html += '</div>';
  
  if (details.originalPattern !== details.substitutedPattern) {
    html += `
      <div class="pattern-comparison">
        <div class="pattern-before">
          <strong>Before:</strong><br>
          <code>${escapeHtml(details.originalPattern)}</code>
        </div>
        <div class="pattern-after">
          <strong>After:</strong><br>
          <code>${escapeHtml(details.substitutedPattern)}</code>
        </div>
      </div>
    `;
  }
  
  return html;
}

// Render match details
function renderMatchDetails(details) {
  let html = '<div class="regex-match-visual">';
  
  if (details.urlBreakdown) {
    html += '<strong>URL Breakdown:</strong><br>';
    html += '<div class="url-parts">';
    
    if (details.urlBreakdown.before) {
      html += `<span class="url-part unmatched">${escapeHtml(details.urlBreakdown.before)}</span>`;
    }
    
    html += `<span class="url-part matched">${escapeHtml(details.urlBreakdown.matched)}</span>`;
    
    if (details.urlBreakdown.after) {
      html += `<span class="url-part unmatched">${escapeHtml(details.urlBreakdown.after)}</span>`;
    }
    
    html += '</div>';
  }
  
  if (details.captureGroups && details.captureGroups.length > 0) {
    html += '<div class="capture-groups">';
    html += '<strong>Capture Groups:</strong><br>';
    details.captureGroups.forEach((group, index) => {
      html += `<span class="capture-group">$${index + 1}: ${escapeHtml(group || '(empty)')}</span>`;
    });
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

// Render no-match details
function renderNoMatchDetails(details) {
  let html = '<div class="failure-reason">';
  html += '<strong>Why it didn\'t match:</strong><br>';
  html += `<code>Pattern: ${escapeHtml(details.pattern)}</code><br>`;
  html += `<code>URL: ${escapeHtml(details.url)}</code><br><br>`;
  
  if (details.reason && details.reason.length > 0) {
    html += '<strong>Possible issues:</strong><ul>';
    details.reason.forEach(reason => {
      html += `<li>${escapeHtml(reason)}</li>`;
    });
    html += '</ul>';
  }
  
  html += '</div>';
  return html;
}

// Render target URL details
function renderTargetDetails(details) {
  let html = '<div class="target-preview">';
  html += '<strong>Target URL Generation:</strong><br>';
  html += `<code>Template: ${escapeHtml(details.originalTarget)}</code><br>`;
  html += `<code>Result: ${escapeHtml(details.finalTarget)}</code><br>`;
  
  if (details.captureGroups && details.captureGroups.length > 0) {
    html += '<br><strong>Substitutions:</strong><br>';
    details.captureGroups.forEach((group, index) => {
      html += `<code>$${index + 1} = "${escapeHtml(group || '(empty)')}"</code><br>`;
    });
  }
  
  html += '</div>';
  return html;
}

// Render header modification details
function renderHeaderDetails(details) {
  let html = '<div class="target-preview">';
  html += '<strong>Header Modifications:</strong><br>';
  
  details.headers.forEach(header => {
    html += `
      <div style="margin: 5px 0; padding: 5px; background: rgba(255,255,255,0.7); border-radius: 4px;">
        <strong>${escapeHtml(header.name)}</strong> (${header.operation} ${header.target})<br>
        ${header.originalValue !== header.processedValue ? 
          `<code>Original: ${escapeHtml(header.originalValue)}</code><br>` : ''
        }
        <code>Value: ${escapeHtml(header.processedValue)}</code>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

// Render final result summary
function renderFinalResult(result) {
  if (result.type === 'redirect') {
    return `
      <div class="target-preview">
        <strong>🎯 Final Result:</strong><br>
        <strong>Redirect:</strong> <code>${escapeHtml(result.originalUrl)}</code><br>
        <strong>To:</strong> <code>${escapeHtml(result.targetUrl)}</code>
      </div>
    `;
  } else if (result.type === 'headers') {
    return `
      <div class="target-preview">
        <strong>🎯 Final Result:</strong><br>
        <strong>Headers modified for:</strong> <code>${escapeHtml(result.url || 'matching URLs')}</code>
      </div>
    `;
  }
  
  return '';
}

// Toggle rule debug card expansion
function toggleRuleDebugCard(event) {
  const header = event.currentTarget;
  const content = header.nextElementSibling;
  const expandIcon = header.querySelector('.rule-debug-expand');
  
  if (content.classList.contains('expanded')) {
    content.classList.remove('expanded');
    expandIcon.textContent = '▶';
  } else {
    content.classList.add('expanded');
    expandIcon.textContent = '▼';
  }
} 