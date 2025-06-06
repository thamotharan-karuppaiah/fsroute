/**
 * FreshRoute - Session Capture Content Script
 * Captures user interactions on web pages for session recording
 */

// Check if extension context is valid before proceeding
if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
  console.warn('⚠️ FreshRoute extension context not available, session capture disabled');
} else {
  // Capture state
  let isCapturing = false;
  let lastMousePosition = { x: 0, y: 0 };
  let mouseMoveThrottle = null;
  let captureStartTime = Date.now();

  // Event tracking settings
  const MOUSE_MOVE_THROTTLE = 50; // ms
  const MAX_EVENTS_PER_SESSION = 10000; // Prevent memory overflow

  // Initialize capture
  function initializeCapture() {
    console.log('FreshRoute session capture initialized on:', window.location.href);
    
    isCapturing = true;
    captureStartTime = Date.now();
    
    // Capture initial page state
    captureEvent({
      type: 'page_load',
      url: window.location.href,
      title: document.title,
      timestamp: 0
    });
    
    setupEventListeners();
    
    // Start periodic context validation
    startContextValidation();
  }

  // Setup event listeners for user interactions
  function setupEventListeners() {
    // Mouse events
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mousedown', handleMouseDown, { passive: true });
    document.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.addEventListener('click', handleClick, { passive: true });
    document.addEventListener('dblclick', handleDoubleClick, { passive: true });
    document.addEventListener('contextmenu', handleRightClick, { passive: true });
    
    // Scroll events
    document.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    
    // Keyboard events
    document.addEventListener('keydown', handleKeyDown, { passive: true });
    document.addEventListener('keyup', handleKeyUp, { passive: true });
    
    // Form events
    document.addEventListener('input', handleInput, { passive: true });
    document.addEventListener('change', handleChange, { passive: true });
    document.addEventListener('submit', handleSubmit, { passive: true });
    
    // Focus events
    document.addEventListener('focus', handleFocus, { capture: true, passive: true });
    document.addEventListener('blur', handleBlur, { capture: true, passive: true });
    
    // Page navigation events
    window.addEventListener('beforeunload', handleBeforeUnload, { passive: true });
    window.addEventListener('popstate', handlePopState, { passive: true });
    
    // Resize events
    window.addEventListener('resize', handleResize, { passive: true });
    
    console.log('Event listeners set up for session capture');
  }

  // Mouse movement handler (throttled)
  function handleMouseMove(event) {
    if (!isCapturing) return;
    
    // Throttle mouse move events to prevent spam
    if (mouseMoveThrottle) return;
    
    mouseMoveThrottle = setTimeout(() => {
      mouseMoveThrottle = null;
    }, MOUSE_MOVE_THROTTLE);
    
    const currentPos = { x: event.clientX, y: event.clientY };
    
    // Only capture if mouse moved significantly
    const distance = Math.sqrt(
      Math.pow(currentPos.x - lastMousePosition.x, 2) + 
      Math.pow(currentPos.y - lastMousePosition.y, 2)
    );
    
    if (distance > 5) { // 5px threshold
      lastMousePosition = currentPos;
      
      captureEvent({
        type: 'mousemove',
        x: event.clientX,
        y: event.clientY,
        target: getElementSelector(event.target),
        pageX: event.pageX,
        pageY: event.pageY
      });
    }
  }

  // Mouse down handler
  function handleMouseDown(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'mousedown',
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      target: getElementSelector(event.target),
      targetText: getElementText(event.target)
    });
  }

  // Mouse up handler
  function handleMouseUp(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'mouseup',
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      target: getElementSelector(event.target)
    });
  }

  // Click handler
  function handleClick(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'click',
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      target: getElementSelector(event.target),
      targetText: getElementText(event.target),
      targetType: event.target.tagName.toLowerCase(),
      targetId: event.target.id || null,
      targetClass: event.target.className || null
    });
  }

  // Double click handler
  function handleDoubleClick(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'dblclick',
      x: event.clientX,
      y: event.clientY,
      target: getElementSelector(event.target),
      targetText: getElementText(event.target)
    });
  }

  // Right click handler
  function handleRightClick(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'contextmenu',
      x: event.clientX,
      y: event.clientY,
      target: getElementSelector(event.target)
    });
  }

  // Scroll handler
  function handleScroll(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'scroll',
      scrollTop: event.target.scrollTop || document.documentElement.scrollTop,
      scrollLeft: event.target.scrollLeft || document.documentElement.scrollLeft,
      target: getElementSelector(event.target),
      maxScrollTop: event.target.scrollHeight - event.target.clientHeight
    });
  }

  // Window scroll handler
  function handleWindowScroll(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'window_scroll',
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      maxScrollX: document.documentElement.scrollWidth - window.innerWidth,
      maxScrollY: document.documentElement.scrollHeight - window.innerHeight
    });
  }

  // Key down handler
  function handleKeyDown(event) {
    if (!isCapturing) return;
    
    // Don't capture sensitive keys or personal data
    const sensitiveKeys = ['Tab', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
    
    captureEvent({
      type: 'keydown',
      key: sensitiveKeys.includes(event.key) ? event.key : '[KEY]', // Protect privacy
      keyCode: event.keyCode,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      target: getElementSelector(event.target)
    });
  }

  // Key up handler
  function handleKeyUp(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'keyup',
      key: ['Tab', 'Escape', 'Enter', 'Backspace', 'Delete'].includes(event.key) ? event.key : '[KEY]',
      target: getElementSelector(event.target)
    });
  }

  // Input handler
  function handleInput(event) {
    if (!isCapturing) return;
    
    const target = event.target;
    
    // Don't capture actual input values for privacy
    captureEvent({
      type: 'input',
      target: getElementSelector(target),
      inputType: target.type || 'text',
      tagName: target.tagName.toLowerCase(),
      valueLength: target.value ? target.value.length : 0,
      placeholder: target.placeholder || null
    });
  }

  // Change handler
  function handleChange(event) {
    if (!isCapturing) return;
    
    const target = event.target;
    
    captureEvent({
      type: 'change',
      target: getElementSelector(target),
      tagName: target.tagName.toLowerCase(),
      inputType: target.type || null,
      selectedOption: target.tagName === 'SELECT' ? target.selectedIndex : null
    });
  }

  // Submit handler
  function handleSubmit(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'submit',
      target: getElementSelector(event.target),
      action: event.target.action || null,
      method: event.target.method || 'GET'
    });
  }

  // Focus handler
  function handleFocus(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'focus',
      target: getElementSelector(event.target),
      tagName: event.target.tagName.toLowerCase()
    });
  }

  // Blur handler
  function handleBlur(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'blur',
      target: getElementSelector(event.target),
      tagName: event.target.tagName.toLowerCase()
    });
  }

  // Before unload handler
  function handleBeforeUnload(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'beforeunload',
      url: window.location.href
    });
  }

  // Pop state handler (back/forward navigation)
  function handlePopState(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'popstate',
      url: window.location.href,
      title: document.title
    });
  }

  // Resize handler
  function handleResize(event) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'resize',
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight
    });
  }

  // Capture custom events from page
  function captureCustomEvent(eventData) {
    if (!isCapturing) return;
    
    captureEvent({
      type: 'custom',
      ...eventData
    });
  }

  // Main event capture function
  function captureEvent(eventData) {
    if (!isCapturing) return;
    
    const event = {
      ...eventData,
      timestamp: Date.now() - captureStartTime,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
    
    // Send to background script with better error handling
    try {
      chrome.runtime.sendMessage({
        type: 'sessionEvent',
        event: event
      }, (response) => {
        // Handle response if needed
        if (chrome.runtime.lastError) {
          // Check if it's a context invalidation error
          if (chrome.runtime.lastError.message.includes('Extension context invalidated') ||
              chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
            console.warn('⚠️ Extension context invalidated, stopping session capture');
            isCapturing = false; // Stop capturing to prevent further errors
            return;
          }
          console.error('Failed to send session event:', chrome.runtime.lastError.message || chrome.runtime.lastError);
        }
      });
    } catch (error) {
      // Handle synchronous errors
      if (error.message.includes('Extension context invalidated') ||
          error.message.includes('Cannot access') ||
          !chrome.runtime) {
        console.warn('⚠️ Extension context invalidated during event capture, stopping capture');
        isCapturing = false; // Stop capturing to prevent further errors
      } else {
        console.error('Failed to send session event:', error.message || error);
      }
    }
  }

  // Get element selector for targeting
  function getElementSelector(element) {
    if (!element) return 'unknown';
    
    try {
      // Build a simple selector
      let selector = element.tagName.toLowerCase();
      
      if (element.id) {
        selector += `#${element.id}`;
      } else if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c.length > 0);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }
      
      // Add parent context if needed
      if (element.parentElement && !element.id) {
        const parent = element.parentElement;
        if (parent.id) {
          selector = `#${parent.id} ${selector}`;
        }
      }
      
      return selector;
    } catch (error) {
      return 'unknown';
    }
  }

  // Get element text content (safely)
  function getElementText(element) {
    if (!element) return '';
    
    try {
      // Get text content but limit length for privacy/storage
      const text = element.textContent || element.innerText || '';
      return text.substring(0, 100); // Max 100 characters
    } catch (error) {
      return '';
    }
  }

  // Stop capturing
  function stopCapture() {
    console.log('Session capture stopped');
    isCapturing = false;
    
    // Send final event
    captureEvent({
      type: 'capture_stopped',
      url: window.location.href
    });
  }

  // Monitor for page changes (SPA support)
  function setupSPAMonitoring() {
    let currentUrl = window.location.href;
    
    // Override pushState and replaceState for SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      handleURLChange();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      handleURLChange();
    };
    
    function handleURLChange() {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        currentUrl = newUrl;
        captureEvent({
          type: 'navigation',
          url: newUrl,
          title: document.title,
          method: 'spa'
        });
      }
    }
  }

  // Periodic check to ensure extension context is still valid
  function startContextValidation() {
    const validateContext = () => {
      if (!isCapturing) return; // Stop checking if we're not capturing
      
      try {
        // Test if chrome.runtime is still available
        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
          console.warn('⚠️ Extension context lost during capture, stopping session recording');
          isCapturing = false;
          return;
        }
        
        // Test with a simple ping (with timeout handling)
        const timeoutId = setTimeout(() => {
          console.warn('⚠️ Extension communication timeout, stopping session recording');
          isCapturing = false;
        }, 1000);
        
        chrome.runtime.sendMessage({ type: 'ping' }, (response) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message.includes('Extension context invalidated') ||
                chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
              console.warn('⚠️ Extension context invalidated, stopping session capture');
              isCapturing = false;
              return;
            }
          }
          
          // Continue checking if still capturing
          if (isCapturing) {
            setTimeout(validateContext, 5000); // Check every 5 seconds
          }
        });
        
      } catch (error) {
        console.warn('⚠️ Extension context validation failed:', error.message);
        isCapturing = false;
      }
    };
    
    // Start validation after 5 seconds
    setTimeout(validateContext, 5000);
  }

  // Initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeCapture();
      setupSPAMonitoring();
    });
  } else {
    initializeCapture();
    setupSPAMonitoring();
  }

  // Export for potential external use
  window.FreshRouteSessionCapture = {
    captureCustomEvent,
    stopCapture,
    isCapturing: () => isCapturing
  };
} 