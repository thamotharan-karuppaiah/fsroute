// Content script for FreshRoute
// This handles CORS and other limitations of declarativeNetRequest

(function() {
  'use strict';
  
  let notificationsEnabled = true;
  let extensionEnabled = true;
  let compactNotifications = true; // Default to true for compact mode
  
  // Active notifications tracking (no queue limit)
  let activeNotifications = [];
  let notificationCounter = 0;
  let isNotificationAreaHovered = false; // Global hover state for all notifications
  
  // Compact mode tracking
  let currentNotificationIndex = 0; // Index of currently displayed notification in compact mode
  
  // Initialize settings
  loadSettings();
  
  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get(['notificationsEnabled', 'extensionEnabled', 'compactNotifications']);
      notificationsEnabled = settings.notificationsEnabled !== false;
      extensionEnabled = settings.extensionEnabled !== false;
      compactNotifications = settings.compactNotifications !== false;
    } catch (error) {
      console.log('Content script: Error loading settings');
    }
  }
  
  // Listen for settings updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateNotificationSettings') {
      notificationsEnabled = message.enabled;
    } else if (message.action === 'updateCompactNotificationSettings') {
      compactNotifications = message.enabled;
      // If switching modes, update display
      if (activeNotifications.length > 0) {
        if (compactNotifications) {
          showCompactNotifications(false); // false = no animation for mode toggle
        } else {
          showAllNotifications();
        }
      }
    } else if (message.action === 'ruleApplied') {
      if (notificationsEnabled && extensionEnabled) {
        showNotification(message);
      }
    }
  });
  
  // Show notification for rule application with queue management
  function showNotification(data) {
    // Generate unique ID for this notification
    const notificationId = `freshroute-notification-${++notificationCounter}`;
    
    // Determine notification style and content based on rule type
    let bgColor, icon, title, details;
    
    // Helper function to truncate URLs for display
    const truncateUrl = (url, maxLength = 40) => {
      if (!url || url.length <= maxLength) return url;
      const start = url.substring(0, 20);
      const end = url.substring(url.length - 17);
      return `${start}...${end}`;
    };
    
    switch (data.ruleType) {
      case 'delay_request':
        bgColor = '#FF9800';
        icon = '⏱️';
        title = 'Request Delayed';
        details = {
          summary: `${data.ruleName} • ${data.delayMs}ms`,
          expanded: `
            <div class="notification-source">${truncateUrl(data.url, 45)}</div>
            <div class="notification-rule">Rule: ${data.ruleName}</div>
            <div class="notification-detail">⏱️ Delayed by ${data.delayMs}ms (${(data.delayMs / 1000).toFixed(1)}s)</div>
          `
        };
        break;
        
      case 'modify_headers':
      case 'header_modification':
        bgColor = '#2196F3';
        icon = '📝';
        title = 'Headers Modified';
        details = {
          summary: `${data.ruleName} • Headers updated`,
          expanded: `
            <div class="notification-source">${truncateUrl(data.url, 45)}</div>
            <div class="notification-rule">Rule: ${data.ruleName}</div>
            <div class="notification-detail">📝 Headers updated for request</div>
          `
        };
        break;
        
      case 'url_rewrite':
      default:
        bgColor = '#4CAF50';
        icon = '🔗';
        title = 'URL Rewritten';
        const hasRedirect = data.redirectUrl && data.redirectUrl !== data.url;
        details = {
          summary: `${data.ruleName} • ${hasRedirect ? 'Redirected' : 'Matched'}`,
          expanded: `
            <div class="notification-source">${truncateUrl(data.url, 45)}</div>
            <div class="notification-rule">Rule: ${data.ruleName}</div>
            ${hasRedirect ? `<div class="notification-detail">🎯 ${truncateUrl(data.redirectUrl, 40)}</div>` : '<div class="notification-detail">🔗 Pattern matched</div>'}
          `
        };
        break;
    }
    
    // Create notification data object
    const notificationData = {
      id: notificationId,
      timestamp: Date.now(),
      bgColor,
      icon,
      title,
      details,
      autoRemoveTimer: null,
      remainingTime: 5000,
      isPaused: false
    };
    
    // Add to active notifications list
    activeNotifications.push(notificationData);
    
    // Show notifications based on mode
    if (compactNotifications) {
      currentNotificationIndex = activeNotifications.length - 1; // Show latest
      showCompactNotifications(true); // true = new notification, animate
    } else {
      showStandardNotification(notificationData);
    }
    
    console.log(`📱 Notification shown: ${title} (${activeNotifications.length} active, compact: ${compactNotifications}${compactNotifications ? ', no auto-removal' : ', auto-remove: 5s'})`);
  }
  
  // Calculate position based on existing notifications and their expanded states
  function calculateNotificationPosition() {
    let totalHeight = 20; // Initial top margin
    
    activeNotifications.forEach(notification => {
      const notificationDiv = notification.element.querySelector('.freshroute-notification');
      if (notificationDiv) {
        const isExpanded = notificationDiv.getAttribute('data-expanded') === 'true';
        totalHeight += isExpanded ? 75 : 42; // 75px for expanded, 42px for collapsed (includes margin)
      }
    });
    
    return totalHeight;
  }
  
  // Toggle notification expanded/collapsed state
  function toggleNotification(notificationId) {
    const notificationData = activeNotifications.find(n => n.id === notificationId);
    if (!notificationData) return;
    
    const notificationDiv = notificationData.element.querySelector('.freshroute-notification');
    const expandedContent = notificationData.element.querySelector('.expanded-content');
    const expandButton = notificationData.element.querySelector('.notification-expand');
    
    if (!notificationDiv || !expandedContent || !expandButton) return;
    
    const isExpanded = notificationDiv.getAttribute('data-expanded') === 'true';
    
    if (isExpanded) {
      // Collapse
      notificationDiv.setAttribute('data-expanded', 'false');
      notificationDiv.classList.add('collapsed');
      notificationDiv.style.height = '32px';
      expandedContent.style.opacity = '0';
      expandedContent.style.maxHeight = '0';
      expandedContent.style.paddingTop = '0';
      expandButton.textContent = '▼';
      console.log(`📱 Notification collapsed: ${notificationId}`);
    } else {
      // Expand
      notificationDiv.setAttribute('data-expanded', 'true');
      notificationDiv.classList.remove('collapsed');
      notificationDiv.style.height = '65px';
      expandedContent.style.opacity = '1';
      expandedContent.style.maxHeight = '45px';
      expandedContent.style.paddingTop = '6px';
      expandButton.textContent = '▲';
      console.log(`📱 Notification expanded: ${notificationId}`);
    }
    
    // Reposition all notifications after expand/collapse
    setTimeout(() => {
      repositionNotifications();
    }, 100);
  }
  
  // Remove specific notification by ID with smooth repositioning
  function removeNotification(notificationId) {
    const index = activeNotifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      const notification = activeNotifications[index];
      console.log(`📱 Removing notification: ${notificationId} (${activeNotifications.length - 1} will remain)`);
      
      // Clear any active timer
      if (notification.autoRemoveTimer) {
        clearTimeout(notification.autoRemoveTimer);
        notification.autoRemoveTimer = null;
      }
      
      if (compactNotifications) {
        // Handle compact mode removal
        
        // If removing current notification, adjust index
        if (currentNotificationIndex === index) {
          // If there will be notifications left
          if (activeNotifications.length > 1) {
            // If removing last notification, go to previous
            if (currentNotificationIndex >= activeNotifications.length - 1) {
              currentNotificationIndex = Math.max(0, activeNotifications.length - 2);
            }
            // Otherwise, current index will show next notification automatically
          }
        } else if (currentNotificationIndex > index) {
          // Adjust current index if a notification before it was removed
          currentNotificationIndex--;
        }
        
        // Remove from array
        activeNotifications.splice(index, 1);
        
        // Update display
        if (activeNotifications.length > 0) {
          showCompactNotifications(false); // false = no animation for navigation
        } else {
          clearCompactNotification(); // Only clear when no notifications left
          currentNotificationIndex = 0;
        }
        
      } else {
        // Handle standard mode removal
        
        // Start slide-out animation for this notification
        if (notification.element) {
          const notificationDiv = notification.element.querySelector('.freshroute-notification');
          if (notificationDiv) {
            notificationDiv.style.transform = 'translateX(100%)';
            notificationDiv.style.opacity = '0';
          }
        }
        
        // Remove from array immediately
        activeNotifications.splice(index, 1);
        
        // Reposition all remaining notifications smoothly
        repositionNotifications();
        
        // Remove from DOM after animation completes
        setTimeout(() => {
          if (notification.element && notification.element.parentNode) {
            notification.element.remove();
            console.log(`📱 Notification DOM removed: ${notificationId}`);
          }
        }, 300);
      }
      
    } else {
      console.log(`📱 Notification not found: ${notificationId}`);
    }
  }
  
  // Reposition all notifications to fill gaps
  function repositionNotifications() {
    let currentTop = 20; // Starting position
    
    activeNotifications.forEach((notification, index) => {
      const notificationDiv = notification.element.querySelector('.freshroute-notification');
      if (notificationDiv) {
        notificationDiv.style.top = `${currentTop}px`;
        
        // Calculate height for next notification based on current notification's expanded state
        const isExpanded = notificationDiv.getAttribute('data-expanded') === 'true';
        currentTop += isExpanded ? 75 : 42; // 75px for expanded, 42px for collapsed (includes margin)
      }
    });
    
    console.log(`📱 Repositioned ${activeNotifications.length} notifications with variable heights`);
  }
  
  // Clear all notifications (useful for cleanup)
  function clearAllNotifications() {
    activeNotifications.forEach(notification => {
      // Clear any active timers
      if (notification.autoRemoveTimer) {
        clearTimeout(notification.autoRemoveTimer);
        notification.autoRemoveTimer = null;
      }
      
      if (notification.element && notification.element.parentNode) {
        notification.element.remove();
      }
    });
    
    // Clear compact notification if present
    clearCompactNotification();
    
    activeNotifications = [];
    currentNotificationIndex = 0;
    console.log('📱 All notifications cleared (timers stopped)');
  }
  
  // Expose notification controls for debugging
  window.FreshRouteNotifications = {
    clear: clearAllNotifications,
    count: () => activeNotifications.length,
    list: () => activeNotifications.map(n => ({ id: n.id, timestamp: n.timestamp })),
    mode: () => compactNotifications ? 'compact' : 'standard',
    currentIndex: () => compactNotifications ? currentNotificationIndex : -1,
    clearAll: () => {
      console.log(`🗑️ Manually clearing all ${activeNotifications.length} notifications`);
      clearAllNotifications();
    },
    test: (type = 'url_rewrite') => {
      const testData = {
        'url_rewrite': {
          action: 'ruleApplied',
          ruleName: 'Development Environment Redirect',
          ruleType: 'url_rewrite',
          url: 'https://production-api.example.com/v1/users/12345/profile',
          redirectUrl: 'https://localhost:3000/api/v1/users/12345/profile'
        },
        'modify_headers': {
          action: 'ruleApplied',
          ruleName: 'API Authentication Headers',
          ruleType: 'modify_headers',
          url: 'https://api.freshservice.com/api/v2/tickets?per_page=100&filter=status:open'
        },
        'delay_request': {
          action: 'ruleApplied',
          ruleName: 'Slow Network Simulation',
          ruleType: 'delay_request',
          url: 'https://api.github.com/repos/octocat/Hello-World/issues',
          delayMs: 2500
        }
      };
      showNotification(testData[type] || testData.url_rewrite);
    },
    testMultiple: (count = 5) => {
      const types = ['url_rewrite', 'modify_headers', 'delay_request'];
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const type = types[i % types.length];
          const testData = {
            action: 'ruleApplied',
            ruleName: `Test Rule ${i + 1}`,
            ruleType: type,
            url: `https://example${i + 1}.com/api/test`,
            redirectUrl: type === 'url_rewrite' ? `https://localhost:300${i}/api/test` : undefined,
            delayMs: type === 'delay_request' ? 1000 + (i * 500) : undefined
          };
          showNotification(testData);
        }, i * 300);
      }
    },
    toggleMode: () => {
      compactNotifications = !compactNotifications;
      console.log(`📱 Switched to ${compactNotifications ? 'compact' : 'standard'} mode`);
      if (activeNotifications.length > 0) {
        if (compactNotifications) {
          showCompactNotifications(false); // false = no animation for mode toggle
        } else {
          showAllNotifications();
        }
      }
    }
  };
  
  // Clean up notifications when page unloads
  window.addEventListener('beforeunload', clearAllNotifications);
  
  // CORS Handler - Intercept fetch and XMLHttpRequest
  const originalFetch = window.fetch;
  const originalXMLHttpRequest = window.XMLHttpRequest;
  
  // Override fetch to handle CORS for specific domains
  window.fetch = async function(input, init = {}) {
    try {
      // Check if this request needs CORS handling
      const url = typeof input === 'string' ? input : input.url;
      
      if (shouldHandleCORS(url)) {
        console.log('🌐 Content Script: Handling CORS for fetch request:', url);
        
        // Create a safe copy of init to avoid mutation
        const safeInit = { ...init };
        
        // Add CORS mode and credentials safely
        safeInit.mode = safeInit.mode || 'cors';
        safeInit.credentials = safeInit.credentials || 'include';
        
        // Add custom headers if needed (safely handle different header formats)
        if (!safeInit.headers) {
          safeInit.headers = {};
        }
        
        // Handle Headers object or plain object
        const hasRequestedWith = safeInit.headers instanceof Headers 
          ? safeInit.headers.has('X-Requested-With')
          : safeInit.headers['X-Requested-With'];
          
        if (!hasRequestedWith) {
          if (safeInit.headers instanceof Headers) {
            safeInit.headers.set('X-Requested-With', 'XMLHttpRequest');
          } else {
            safeInit.headers['X-Requested-With'] = 'XMLHttpRequest';
          }
        }
        
        return await originalFetch.call(this, input, safeInit);
      }
      
      return await originalFetch.call(this, input, init);
    } catch (error) {
      // Only log CORS-related errors for domains we're handling
      const url = typeof input === 'string' ? input : input.url;
      if (shouldHandleCORS(url)) {
        console.log('🚫 Content Script: CORS error (expected for some requests):', error.message);
      }
      throw error;
    }
  };
  
  // Override XMLHttpRequest for legacy AJAX
  window.XMLHttpRequest = function() {
    const xhr = new originalXMLHttpRequest();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    
    xhr.open = function(method, url, async, username, password) {
      if (shouldHandleCORS(url)) {
        console.log('🌐 Content Script: Handling CORS for XHR request:', url);
        
        // Set withCredentials for CORS
        xhr.withCredentials = true;
      }
      
      return originalOpen.call(this, method, url, async, username, password);
    };
    
    xhr.send = function(data) {
      // Add custom headers before sending
      if (shouldHandleCORS(xhr.responseURL || '')) {
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      }
      
      return originalSend.call(this, data);
    };
    
    return xhr;
  };
  
  // Copy static properties
  Object.setPrototypeOf(window.XMLHttpRequest.prototype, originalXMLHttpRequest.prototype);
  Object.setPrototypeOf(window.XMLHttpRequest, originalXMLHttpRequest);
  
  // Determine if URL needs CORS handling
  function shouldHandleCORS(url) {
    if (!url || !extensionEnabled) return false;
    
    try {
      const urlObj = new URL(url);
      
      // Handle specific domains that need CORS help
      const corsDomainsPatterns = [
        /\.freshinfinitysquad\.com$/,
        /\.freshservice-dev\.com$/,
        /localhost/
      ];
      
      return corsDomainsPatterns.some(pattern => pattern.test(urlObj.hostname));
    } catch (e) {
      return false;
    }
  }
  
  // Inject response header information into page context
  function injectResponseHeaderDebugger() {
    // Instead of injecting inline scripts (which violate CSP), 
    // we'll expose the debug function through a custom event system
    
    // Create a debug function that can be called from console
    window.debugExtensionHeaders = function() {
      console.log('🛠️ Extension CORS Handler Active');
      console.log('📊 Current document headers:', document.location.href);
      
      // Make a test request to see headers
      fetch(document.location.href, { method: 'HEAD' })
        .then(response => {
          console.log('📦 Response headers:');
          const extensionHeaders = [];
          const allHeaders = [];
          
          for (const [key, value] of response.headers.entries()) {
            allHeaders.push(`  ${key}: ${value}`);
            if (key.toLowerCase().startsWith('x-extension') || 
                key.toLowerCase().startsWith('x-debug') ||
                key.toLowerCase() === 'cache-control') {
              extensionHeaders.push(`  ${key}: ${value}`);
            }
          }
          
          console.log('All headers:');
          allHeaders.forEach(header => console.log(header));
          
          if (extensionHeaders.length > 0) {
            console.log('🎯 Extension-modified headers:');
            extensionHeaders.forEach(header => console.log(header));
          } else {
            console.log('⚠️ No extension-modified headers found');
          }
          
          return { allHeaders, extensionHeaders };
        })
        .catch(e => {
          console.log('❌ Could not fetch headers:', e.message);
          return { error: e.message };
        });
    };
    
    // Also create a simpler test function
    window.testExtensionHeaders = async function(url) {
      const testUrl = url || document.location.href;
      console.log(`🧪 Testing headers for: ${testUrl}`);
      
      try {
        const response = await fetch(testUrl, { 
          method: 'HEAD',
          mode: 'cors',
          credentials: 'include'
        });
        
        const result = {
          url: response.url,
          status: response.status,
          extensionHeaders: {},
          allHeaders: {}
        };
        
        for (const [key, value] of response.headers.entries()) {
          result.allHeaders[key] = value;
          if (key.toLowerCase().startsWith('x-') || 
              key.toLowerCase() === 'cache-control') {
            result.extensionHeaders[key] = value;
          }
        }
        
        console.table(result.extensionHeaders);
        return result;
      } catch (error) {
        console.error('❌ Header test failed:', error);
        return { error: error.message };
      }
    };
    
    console.log('🔍 Debug functions available:');
    console.log('  - debugExtensionHeaders() - Detailed header analysis');
    console.log('  - testExtensionHeaders(url) - Test specific URL headers');
  }
  
  // Inject header debugger when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectResponseHeaderDebugger);
  } else {
    injectResponseHeaderDebugger();
  }
  
  console.log('🚀 URL Rewriter Content Script loaded');
  
  // Start auto-removal timer for a notification
  function startNotificationTimer(notificationId) {
    const notificationData = activeNotifications.find(n => n.id === notificationId);
    if (!notificationData) return;
    
    console.log(`⏱️ Starting timer for notification: ${notificationId} (${notificationData.remainingTime}ms)`);
    
    notificationData.autoRemoveTimer = setTimeout(() => {
      removeNotification(notificationId);
    }, notificationData.remainingTime);
    
    notificationData.startTime = Date.now();
    notificationData.isPaused = false;
  }
  
  // Pause auto-removal timers for ALL notifications
  function pauseAllNotifications() {
    if (isNotificationAreaHovered) return; // Already paused
    
    isNotificationAreaHovered = true;
    console.log(`⏸️ Pausing ALL notifications (${activeNotifications.length} active)`);
    
    activeNotifications.forEach(notificationData => {
      if (notificationData.isPaused) return; // Already paused
      
      // Clear the current timer
      if (notificationData.autoRemoveTimer) {
        clearTimeout(notificationData.autoRemoveTimer);
        notificationData.autoRemoveTimer = null;
      }
      
      // Calculate remaining time
      const elapsed = Date.now() - notificationData.startTime;
      notificationData.remainingTime = Math.max(0, notificationData.remainingTime - elapsed);
      notificationData.isPaused = true;
      
      // Add visual indicator that timer is paused
      const notificationDiv = notificationData.element.querySelector('.freshroute-notification');
      if (notificationDiv) {
        notificationDiv.style.boxShadow = '0 3px 12px rgba(0,0,0,0.3), 0 0 0 2px rgba(255,255,255,0.3)';
      }
    });
  }
  
  // Resume auto-removal timers for ALL notifications
  function resumeAllNotifications() {
    if (!isNotificationAreaHovered) return; // Not paused
    
    // Add a small delay to prevent flicker when moving between notifications
    setTimeout(() => {
      // Check if mouse is still over any notification
      const anyHovered = activeNotifications.some(notificationData => {
        const notificationDiv = notificationData.element.querySelector('.freshroute-notification');
        return notificationDiv && notificationDiv.matches(':hover');
      });
      
      if (anyHovered) return; // Still hovering over some notification
      
      isNotificationAreaHovered = false;
      console.log(`▶️ Resuming ALL notifications (${activeNotifications.length} active)`);
      
      activeNotifications.forEach(notificationData => {
        if (!notificationData.isPaused) return; // Not paused
        
        // Remove visual pause indicator
        const notificationDiv = notificationData.element.querySelector('.freshroute-notification');
        if (notificationDiv) {
          notificationDiv.style.boxShadow = '0 3px 12px rgba(0,0,0,0.2)';
        }
        
        // If there's still time remaining, restart the timer
        if (notificationData.remainingTime > 0) {
          notificationData.autoRemoveTimer = setTimeout(() => {
            removeNotification(notificationData.id);
          }, notificationData.remainingTime);
          
          notificationData.startTime = Date.now();
          notificationData.isPaused = false;
        } else {
          // Time already expired, remove immediately
          removeNotification(notificationData.id);
        }
      });
    }, 100); // 100ms delay to handle rapid mouse movements
  }
  
  // Show standard (multi) notifications
  function showStandardNotification(notificationData) {
    // Calculate position based on existing notifications and their expanded states
    const topPosition = calculateNotificationPosition();
    
    const notification = document.createElement('div');
    notification.id = notificationData.id;
    notification.className = 'freshroute-notification-container';
    notification.innerHTML = `
      <div class="freshroute-notification collapsed" data-expanded="false" style="
        position: fixed;
        top: ${topPosition}px;
        right: 20px;
        width: 380px;
        min-height: 32px;
        height: 32px;
        background: ${notificationData.bgColor};
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        box-shadow: 0 3px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        cursor: pointer;
        overflow: hidden;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
      ">
        <div class="notification-header" style="display: flex; justify-content: space-between; align-items: center; height: 20px;">
          <div class="notification-title" style="font-weight: 600; font-size: 11px; display: flex; align-items: center; flex: 1; min-width: 0;">
            ${notificationData.icon} <span style="margin-left: 4px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${notificationData.details.summary}</span>
          </div>
          <div class="notification-controls" style="display: flex; align-items: center; margin-left: 8px;">
            <div class="notification-expand" style="
              opacity: 0.7;
              font-size: 12px;
              cursor: pointer;
              padding: 0 4px;
              margin-right: 4px;
            ">▼</div>
            <div class="notification-close" style="
              opacity: 0.7;
              font-size: 14px;
              line-height: 1;
              cursor: pointer;
              padding: 0 3px;
            ">&times;</div>
          </div>
        </div>
        <div class="notification-content expanded-content" style="
          opacity: 0;
          max-height: 0;
          font-size: 10px;
          line-height: 1.2;
          padding-top: 0;
          overflow: hidden;
          transition: all 0.3s ease;
        ">
          ${notificationData.details.expanded}
        </div>
      </div>
    `;
    
    // Add CSS styles if not already present
    addNotificationStyles();
    
    // Store DOM element reference
    notificationData.element = notification;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Trigger slide-in animation after DOM insertion
    const notificationDiv = notification.querySelector('.freshroute-notification');
    setTimeout(() => {
      if (notificationDiv) {
        notificationDiv.style.transform = 'translateX(0)';
        notificationDiv.style.opacity = '1';
      }
    }, 10);
    
    // Add event listeners
    addStandardNotificationListeners(notification, notificationData.id);
    
    // Start auto-removal timer for current notification (only in standard mode)
    if (!compactNotifications) {
      startNotificationTimer(notificationData.id);
    }
  }
  
  // Show compact (single) notification with navigation
  function showCompactNotifications(isNewNotification = false) {
    if (activeNotifications.length === 0) return;
    
    // Ensure current index is valid
    if (currentNotificationIndex >= activeNotifications.length) {
      currentNotificationIndex = activeNotifications.length - 1;
    }
    if (currentNotificationIndex < 0) {
      currentNotificationIndex = 0;
    }
    
    const notificationData = activeNotifications[currentNotificationIndex];
    const isExpanded = notificationData.expanded || false;
    
    // Check if container already exists
    let notification = document.getElementById('freshroute-compact-notification');
    const containerExists = !!notification;
    
    if (!containerExists) {
      // Create new container only if none exists
      notification = document.createElement('div');
      notification.id = 'freshroute-compact-notification';
      notification.className = 'freshroute-notification-container compact-mode';
      
      // Add CSS styles if not already present
      addNotificationStyles();
      
      // Add to DOM
      document.body.appendChild(notification);
      
      // Add event listeners only once
      addCompactNotificationListeners(notification);
    }
    
    // Update the content (always do this whether container is new or existing)
    let notificationDiv = notification.querySelector('.freshroute-notification');
    if (notificationDiv) {
      // Update the notification content without removing the container
      notificationDiv.innerHTML = `
        <div class="notification-header" style="display: flex; justify-content: space-between; align-items: center; height: 20px;">
          <div class="notification-navigation" style="display: flex; align-items: center; gap: 4px; margin-right: 8px;">
            <button class="nav-arrow nav-prev" style="
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              width: 20px;
              height: 20px;
              border-radius: 3px;
              cursor: pointer;
              font-size: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              opacity: ${activeNotifications.length > 1 ? '0.7' : '0.3'};
              transition: all 0.3s ease;
            " ${activeNotifications.length <= 1 ? 'disabled' : ''}>←</button>
            <span class="notification-counter" style="
              font-size: 10px;
              opacity: 0.8;
              min-width: 20px;
              text-align: center;
            ">${currentNotificationIndex + 1}/${activeNotifications.length}</span>
            <button class="nav-arrow nav-next" style="
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              width: 20px;
              height: 20px;
              border-radius: 3px;
              cursor: pointer;
              font-size: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              opacity: ${activeNotifications.length > 1 ? '0.7' : '0.3'};
              transition: all 0.3s ease;
            " ${activeNotifications.length <= 1 ? 'disabled' : ''}>→</button>
          </div>
          <div class="notification-title" style="font-weight: 600; font-size: 11px; display: flex; align-items: center; flex: 1; min-width: 0;">
            ${notificationData.icon} <span style="margin-left: 4px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${notificationData.details.summary}</span>
          </div>
          <div class="notification-controls" style="display: flex; align-items: center; margin-left: 8px;">
            <div class="notification-expand" style="
              opacity: 0.7;
              font-size: 12px;
              cursor: pointer;
              padding: 0 4px;
              margin-right: 4px;
            ">${isExpanded ? '▲' : '▼'}</div>
            <div class="notification-close" style="
              opacity: 0.7;
              font-size: 14px;
              line-height: 1;
              cursor: pointer;
              padding: 0 3px;
            ">&times;</div>
          </div>
        </div>
        <div class="notification-content expanded-content" style="
          opacity: ${isExpanded ? '1' : '0'};
          max-height: ${isExpanded ? '45px' : '0'};
          font-size: 10px;
          line-height: 1.2;
          padding-top: ${isExpanded ? '6px' : '0'};
          overflow: hidden;
          transition: all 0.3s ease;
        ">
          ${notificationData.details.expanded}
        </div>
      `;
      
      // Update container styles
      notificationDiv.style.background = notificationData.bgColor;
      notificationDiv.style.height = isExpanded ? '65px' : '32px';
      notificationDiv.setAttribute('data-expanded', isExpanded);
      notificationDiv.className = `freshroute-notification ${isExpanded ? '' : 'collapsed'}`;
      
      // Re-add event listeners after content update
      addCompactNotificationListeners(notification);
    } else {
      // If no notification div exists, create the full structure (new container case)
      notification.innerHTML = `
        <div class="freshroute-notification ${isExpanded ? '' : 'collapsed'}" data-expanded="${isExpanded}" style="
          position: fixed;
          top: 20px;
          right: 20px;
          width: 380px;
          min-height: 32px;
          height: ${isExpanded ? '65px' : '32px'};
          background: ${notificationData.bgColor};
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          box-shadow: 0 3px 12px rgba(0,0,0,0.2);
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          cursor: pointer;
          overflow: hidden;
          transform: ${!containerExists && isNewNotification ? 'translateX(100%)' : 'translateX(0)'};
          opacity: ${!containerExists && isNewNotification ? '0' : '1'};
          transition: all 0.3s ease;
        ">
          <div class="notification-header" style="display: flex; justify-content: space-between; align-items: center; height: 20px;">
            <div class="notification-navigation" style="display: flex; align-items: center; gap: 4px; margin-right: 8px;">
              <button class="nav-arrow nav-prev" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: ${activeNotifications.length > 1 ? '0.7' : '0.3'};
                transition: all 0.3s ease;
              " ${activeNotifications.length <= 1 ? 'disabled' : ''}>←</button>
              <span class="notification-counter" style="
                font-size: 10px;
                opacity: 0.8;
                min-width: 20px;
                text-align: center;
              ">${currentNotificationIndex + 1}/${activeNotifications.length}</span>
              <button class="nav-arrow nav-next" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: ${activeNotifications.length > 1 ? '0.7' : '0.3'};
                transition: all 0.3s ease;
              " ${activeNotifications.length <= 1 ? 'disabled' : ''}>→</button>
            </div>
            <div class="notification-title" style="font-weight: 600; font-size: 11px; display: flex; align-items: center; flex: 1; min-width: 0;">
              ${notificationData.icon} <span style="margin-left: 4px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${notificationData.details.summary}</span>
            </div>
            <div class="notification-controls" style="display: flex; align-items: center; margin-left: 8px;">
              <div class="notification-expand" style="
                opacity: 0.7;
                font-size: 12px;
                cursor: pointer;
                padding: 0 4px;
                margin-right: 4px;
              ">${isExpanded ? '▲' : '▼'}</div>
              <div class="notification-close" style="
                opacity: 0.7;
                font-size: 14px;
                line-height: 1;
                cursor: pointer;
                padding: 0 3px;
              ">&times;</div>
            </div>
          </div>
          <div class="notification-content expanded-content" style="
            opacity: ${isExpanded ? '1' : '0'};
            max-height: ${isExpanded ? '45px' : '0'};
            font-size: 10px;
            line-height: 1.2;
            padding-top: ${isExpanded ? '6px' : '0'};
            overflow: hidden;
            transition: all 0.3s ease;
          ">
            ${notificationData.details.expanded}
          </div>
        </div>
      `;
      
      // Add event listeners for new container
      addCompactNotificationListeners(notification);
      
      // Update notificationDiv reference after creating structure
      notificationDiv = notification.querySelector('.freshroute-notification');
    }
    
    // Store DOM element reference
    notificationData.element = notification;
    
    // Only animate the container if it's a completely new container AND it's a new notification
    if (!containerExists && isNewNotification) {
      // Get the notification div (should exist now)
      if (!notificationDiv) {
        notificationDiv = notification.querySelector('.freshroute-notification');
      }
      
      setTimeout(() => {
        if (notificationDiv) {
          notificationDiv.style.transform = 'translateX(0)';
          notificationDiv.style.opacity = '1';
        }
      }, 10);
    } else {
      // For existing containers or non-animating scenarios, ensure visibility
      if (!notificationDiv) {
        notificationDiv = notification.querySelector('.freshroute-notification');
      }
      
      if (notificationDiv) {
        notificationDiv.style.transform = 'translateX(0)';
        notificationDiv.style.opacity = '1';
      }
    }
    
    // Start auto-removal timer for current notification (only in standard mode)
    if (!compactNotifications) {
      startNotificationTimer(notificationData.id);
    }
  }
  
  // Clear existing compact notification
  function clearCompactNotification() {
    const existing = document.getElementById('freshroute-compact-notification');
    if (existing) {
      existing.remove();
    }
  }
  
  // Show all notifications when switching from compact mode
  function showAllNotifications() {
    // Clear any existing notifications first
    clearAllNotifications();
    
    // Show all notifications in standard mode
    activeNotifications.forEach((notificationData, index) => {
      showStandardNotification(notificationData);
    });
  }
  
  // Add CSS styles for notifications
  function addNotificationStyles() {
    if (!document.getElementById('freshroute-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'freshroute-notification-styles';
      style.textContent = `
        .freshroute-notification-container {
          pointer-events: none;
        }
        .freshroute-notification {
          pointer-events: all;
        }
        .freshroute-notification:hover {
          transform: translateX(0) scale(1.01) !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.25) !important;
        }
        .freshroute-notification.collapsed {
          height: 32px !important;
        }
        .freshroute-notification.collapsed .notification-header {
          opacity: 1;
        }
        .notification-header:hover {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
        }
        .notification-expand:hover,
        .notification-close:hover {
          opacity: 1 !important;
          transform: scale(1.1);
        }
        .nav-arrow:hover:not(:disabled) {
          opacity: 1 !important;
          background: rgba(255,255,255,0.3) !important;
          transform: scale(1.1);
        }
        .nav-arrow:disabled {
          cursor: not-allowed !important;
        }
        .notification-source {
          color: rgba(255,255,255,0.95);
          font-weight: 500;
          margin-bottom: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 10px;
        }
        .notification-rule {
          color: rgba(255,255,255,0.85);
          margin-bottom: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 9px;
        }
        .notification-detail {
          color: rgba(255,255,255,0.8);
          font-style: italic;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 9px;
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // Add event listeners for standard notifications
  function addStandardNotificationListeners(notification, notificationId) {
    const closeButton = notification.querySelector('.notification-close');
    const expandButton = notification.querySelector('.notification-expand');
    const notificationDiv = notification.querySelector('.freshroute-notification');
    
    // Add hover event listeners for global pause/resume functionality
    notificationDiv.addEventListener('mouseenter', () => {
      pauseAllNotifications();
    });
    
    notificationDiv.addEventListener('mouseleave', () => {
      resumeAllNotifications();
    });
    
    // Click on expand button to toggle expanded state
    if (expandButton) {
      expandButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotification(notificationId);
      });
    }
    
    // Click anywhere on notification header to toggle expanded state
    const headerElement = notification.querySelector('.notification-header');
    if (headerElement) {
      headerElement.addEventListener('click', (e) => {
        if (!e.target.closest('.notification-close') && !e.target.closest('.notification-expand')) {
          toggleNotification(notificationId);
        }
      });
    }
    
    // Click close button to dismiss
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        removeNotification(notificationId);
      });
    }
  }
  
  // Add event listeners for compact notifications
  function addCompactNotificationListeners(notification) {
    const closeButton = notification.querySelector('.notification-close');
    const expandButton = notification.querySelector('.notification-expand');
    const prevButton = notification.querySelector('.nav-prev');
    const nextButton = notification.querySelector('.nav-next');
    const notificationDiv = notification.querySelector('.freshroute-notification');
    
    // Navigation buttons
    if (prevButton) {
      prevButton.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateNotification(-1);
      });
    }
    
    if (nextButton) {
      nextButton.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateNotification(1);
      });
    }
    
    // Click on expand button to toggle expanded state
    if (expandButton) {
      expandButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCompactNotification();
      });
    }
    
    // Click anywhere on notification header to toggle expanded state
    const headerElement = notification.querySelector('.notification-header');
    if (headerElement) {
      headerElement.addEventListener('click', (e) => {
        if (!e.target.closest('.notification-close') && 
            !e.target.closest('.notification-expand') && 
            !e.target.closest('.notification-navigation')) {
          toggleCompactNotification();
        }
      });
    }
    
    // Click close button to dismiss current notification
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCurrentCompactNotification();
      });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', handleCompactKeyNavigation);
  }
  
  // Navigate between notifications in compact mode
  function navigateNotification(direction) {
    if (activeNotifications.length <= 1) return;
    
    // Get current expanded state before navigating
    const currentNotification = activeNotifications[currentNotificationIndex];
    const currentExpandedState = currentNotification ? currentNotification.expanded : false;
    
    currentNotificationIndex += direction;
    
    // Wrap around
    if (currentNotificationIndex >= activeNotifications.length) {
      currentNotificationIndex = 0;
    } else if (currentNotificationIndex < 0) {
      currentNotificationIndex = activeNotifications.length - 1;
    }
    
    // Apply the expanded state to the new notification
    const newNotification = activeNotifications[currentNotificationIndex];
    if (newNotification) {
      newNotification.expanded = currentExpandedState;
    }
    
    showCompactNotifications(false); // false = no animation for navigation
  }
  
  // Toggle expanded state for compact notification
  function toggleCompactNotification() {
    if (activeNotifications.length === 0) return;
    
    const notificationData = activeNotifications[currentNotificationIndex];
    notificationData.expanded = !notificationData.expanded;
    
    showCompactNotifications(false); // false = no animation for expand/collapse
  }
  
  // Remove current notification in compact mode
  function removeCurrentCompactNotification() {
    if (activeNotifications.length === 0) return;
    
    const notificationData = activeNotifications[currentNotificationIndex];
    removeNotification(notificationData.id);
  }
  
  // Handle keyboard navigation for compact mode
  function handleCompactKeyNavigation(e) {
    if (!compactNotifications || activeNotifications.length === 0) return;
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateNotification(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateNotification(1);
    }
  }
})(); 