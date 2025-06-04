# Response Headers in Chrome Extensions (Manifest V3)

## 🚨 **Important: Response Header Limitations**

Chrome's Manifest V3 has **strict limitations** on which response headers can be modified via the `declarativeNetRequest` API for security reasons.

## ✅ **Response Headers That CAN Be Modified**

### Custom Headers (Recommended)
- `X-Extension-Modified`
- `X-Debug-Info`
- `X-API-Version`
- `X-Rate-Limit`
- `X-Custom-Header`
- Any header starting with `X-` (custom headers)

### Standard Headers (Limited Set)
- `Cache-Control`
- `Content-Type` (limited contexts)
- `Content-Disposition`
- `Content-Encoding`
- `Expires`
- `Last-Modified`
- `ETag`
- `Vary`
- `Server`
- `X-Powered-By`

## ❌ **Response Headers That CANNOT Be Modified**

### CORS Headers (Security Restricted)
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`
- `Access-Control-Allow-Credentials`
- `Access-Control-Expose-Headers`
- `Access-Control-Max-Age`

### Security Headers (Browser Protected)
- `Content-Security-Policy`
- `X-Frame-Options`
- `Strict-Transport-Security`
- `Upgrade-Insecure-Requests`
- `Set-Cookie`
- `Set-Cookie2`

### Browser-Controlled Headers
- `Host`
- `Connection`
- `Upgrade`
- `Transfer-Encoding`
- `Proxy-*` headers

## 🛠️ **Current Extension Implementation**

### Updated Freshservice Preset
The preset now includes:

**Request Headers (Working):**
- `Cookie` - For authentication
- `X-CSRF-TOKEN` - For CSRF protection

**Response Headers (Working):**
- `X-Extension-Modified: true` - Debug marker
- `X-Debug-Info: Freshservice-Extension-Active` - Status indicator
- `Cache-Control: no-cache, no-store, must-revalidate` - Cache control

## 🔧 **Testing Your Response Headers**

### Method 1: Use Debug Tool
1. Open `debug.html` in your browser
2. Click "Test Response Headers"
3. Check the results for extension-modified headers

### Method 2: Browser DevTools
1. Open DevTools → Network tab
2. Make a request to your target domain
3. Look for these headers in the response:
   - `X-Extension-Modified`
   - `X-Debug-Info`
   - Modified `Cache-Control`

### Method 3: Console Commands
In the browser console, run:
```javascript
// Test if content script is active
debugExtensionHeaders();

// Manual header check
fetch('https://your-domain.com/api/test', { method: 'HEAD' })
  .then(response => {
    for (const [key, value] of response.headers.entries()) {
      if (key.startsWith('x-')) {
        console.log(`Extension header: ${key}: ${value}`);
      }
    }
  });
```

## 🌐 **CORS Solutions (Alternative Approaches)**

Since CORS headers cannot be modified by extensions, here are alternatives:

### 1. Content Script Interception (Implemented)
The extension now includes a content script that:
- Intercepts `fetch()` and `XMLHttpRequest`
- Adds proper CORS mode and credentials
- Handles specific domains automatically

### 2. Server-Side Configuration (Recommended)
Configure your server to send proper CORS headers:
```javascript
// Express.js example
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});
```

### 3. Proxy Server
Use a local proxy that adds CORS headers:
```bash
# Using cors-anywhere
npx cors-anywhere
```

### 4. Browser Development Mode
Launch Chrome with disabled security (development only):
```bash
chrome --disable-web-security --user-data-dir="/tmp/chrome_dev"
```

## 🔍 **Debugging Response Headers**

### Check Extension Rules
```javascript
// In background script console
chrome.declarativeNetRequest.getDynamicRules().then(rules => {
  console.log('Active rules:', rules);
  rules.forEach(rule => {
    if (rule.action.type === 'modifyHeaders' && rule.action.responseHeaders) {
      console.log('Response header rule:', rule);
    }
  });
});
```

### Verify Header Validation
The extension now includes validation that tells you exactly which headers are allowed/blocked:
- Check the background script console for warning messages
- Use the debug tool to see header validation results

## 📋 **Troubleshooting Checklist**

1. **Extension Enabled?** - Check popup/options page
2. **Rules Active?** - Use debug tool to check current rules
3. **URL Pattern Match?** - Verify your URL patterns match target domains
4. **Header Restrictions?** - Check console for blocked header warnings
5. **Content Script Loaded?** - Look for "🚀 URL Rewriter Content Script loaded" in console
6. **Network Requests?** - Check DevTools Network tab for actual headers

## 📊 **What Works vs What Doesn't**

| Header Type | declarativeNetRequest | Content Script | Server-Side |
|-------------|----------------------|----------------|-------------|
| Custom Headers (X-*) | ✅ YES | ✅ YES | ✅ YES |
| Cache-Control | ✅ YES | ✅ YES | ✅ YES |
| CORS Headers | ❌ NO | ⚠️ LIMITED | ✅ YES |
| Cookie Headers | ❌ NO | ⚠️ LIMITED | ✅ YES |
| Security Headers | ❌ NO | ❌ NO | ✅ YES |

## 🎯 **Recommended Approach**

1. **Use declarativeNetRequest for:**
   - Request headers (Cookie, X-CSRF-TOKEN)
   - Custom response headers (X-*)
   - Cache control

2. **Use content script for:**
   - CORS request handling
   - JavaScript interception
   - Debug information

3. **Configure server-side for:**
   - CORS headers
   - Security headers
   - Authentication cookies

This multi-layered approach provides the most comprehensive solution within Chrome's security constraints. 