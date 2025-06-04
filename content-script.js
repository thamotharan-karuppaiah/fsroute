// Content script for FreshRoute - URL Rewriter & Header Modifier
// Handles notifications and UI interactions for rule application

// Check if we're in the top frame (not an iframe)
if (window === window.top) {
  let notificationSettings = {
    enabled: true
  };
  
  let notificationsEnabled = true;
  let extensionEnabled = true;
  
  // Initialize settings
  loadSettings();
  
  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get(['notificationsEnabled', 'extensionEnabled']);
      notificationsEnabled = settings.notificationsEnabled !== false;
      extensionEnabled = settings.extensionEnabled !== false;
    } catch (error) {
      console.log('Content script: Error loading settings');
    }
  }
  
  // Listen for settings updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateNotificationSettings') {
      notificationsEnabled = message.enabled;
    } else if (message.action === 'ruleApplied') {
      if (notificationsEnabled && extensionEnabled) {
        showNotification(message);
      }
    }
  });
  
  // Show notification for rule application
  function showNotification(data) {
    const notification = document.createElement('div');
    notification.id = 'url-rewriter-notification';
    notification.innerHTML = `
      <div class="notification-header">
        <span class="notification-icon">🔗</span>
        <span class="notification-title">FreshRoute Active</span>
        <button class="notification-close">&times;</button>
      </div>
      <div class="notification-body">
        <strong>${data.ruleName}</strong><br>
        <span class="notification-url">${data.url}</span>
      </div>
    `;
    
    // Add CSS animation
    if (!document.getElementById('url-rewriter-styles')) {
      const style = document.createElement('style');
      style.id = 'url-rewriter-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Remove existing notification
    const existing = document.getElementById('url-rewriter-notification');
    if (existing) {
      existing.remove();
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 3000);
  }
  
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
  
  console.log('🚀 FreshRoute Content Script loaded');
} 