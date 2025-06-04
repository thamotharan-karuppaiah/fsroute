// Content script for FreshRoute - URL Rewriter & Header Modifier
// This handles CORS and other limitations of declarativeNetRequest

(function() {
  'use strict';

let activeToasts = new Set();
let notificationsEnabled = true;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ruleApplied' && notificationsEnabled) {
    showToastNotification(request.ruleName, request.ruleType);
  } else if (request.action === 'updateNotificationSettings') {
    notificationsEnabled = request.enabled;
  }
});

// Load notification settings on startup
chrome.storage.sync.get(['notificationsEnabled']).then(result => {
  notificationsEnabled = result.notificationsEnabled !== false;
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.notificationsEnabled) {
    notificationsEnabled = changes.notificationsEnabled.newValue;
  }
});

function showToastNotification(ruleName, ruleType) {
  // Prevent duplicate toasts for the same rule
  const toastId = `${ruleType}-${ruleName}`;
  if (activeToasts.has(toastId)) {
    return;
  }
  
  activeToasts.add(toastId);
  
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('url-rewriter-toast-container');
  if (!toastContainer) {
    toastContainer = createToastContainer();
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = createToastElement(ruleName, ruleType, toastId);
  toastContainer.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    removeToast(toast, toastId);
  }, 5000);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'url-rewriter-toast-container';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  return container;
}

function createToastElement(ruleName, ruleType, toastId) {
  const toast = document.createElement('div');
  toast.className = 'url-rewriter-toast';
  toast.dataset.toastId = toastId;
  
  const icon = ruleType === 'url_rewrite' ? '🔗' : '📝';
  const typeText = ruleType === 'url_rewrite' ? 'URL Rewrite' : 'Header Modification';
  
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-icon">${icon}</div>
      <div class="toast-text">
        <div class="toast-title">${typeText} Applied</div>
        <div class="toast-rule">${escapeHtml(ruleName)}</div>
      </div>
      <button class="toast-close">×</button>
    </div>
    <div class="toast-progress"></div>
  `;
  
  // Apply styles
  toast.style.cssText = `
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    margin-bottom: 10px;
    min-width: 300px;
    max-width: 400px;
    pointer-events: auto;
    transform: translateX(100%);
    transition: transform 0.3s ease-out, opacity 0.3s ease-out;
    opacity: 0;
    overflow: hidden;
    border-left: 4px solid #1976d2;
  `;
  
  // Add styles for inner elements
  const style = document.createElement('style');
  style.textContent = `
    .url-rewriter-toast.show {
      transform: translateX(0) !important;
      opacity: 1 !important;
    }
    
    .toast-content {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      gap: 12px;
    }
    
    .toast-icon {
      font-size: 20px;
      flex-shrink: 0;
    }
    
    .toast-text {
      flex: 1;
      min-width: 0;
    }
    
    .toast-title {
      font-weight: 600;
      font-size: 14px;
      color: #333;
      margin-bottom: 2px;
    }
    
    .toast-rule {
      font-size: 12px;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .toast-close {
      background: none;
      border: none;
      font-size: 18px;
      color: #999;
      cursor: pointer;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .toast-close:hover {
      color: #333;
    }
    
    .toast-progress {
      height: 3px;
      background: linear-gradient(90deg, #1976d2, #42a5f5);
      transform-origin: left;
      animation: toast-progress 5s linear forwards;
    }
    
    @keyframes toast-progress {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }
  `;
  
  if (!document.getElementById('url-rewriter-toast-styles')) {
    style.id = 'url-rewriter-toast-styles';
    document.head.appendChild(style);
  }
  
  // Add close functionality
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeToast(toast, toastId);
  });
  
  return toast;
}

function removeToast(toast, toastId) {
  if (!toast || !toast.parentNode) return;
  
  toast.style.transform = 'translateX(100%)';
  toast.style.opacity = '0';
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
    activeToasts.delete(toastId);
  }, 300);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
})(); 