import fs from 'fs';
import path from 'path';

const devManifest = {
  "manifest_version": 3,
  "name": "FreshRoute (Development)",
  "version": "1.0.0-dev",
  "description": "Chrome extension to rewrite URLs and modify headers with regex support - Development Build",
  "permissions": [
    "declarativeNetRequest",
    "declarativeNetRequestWithHostAccess",
    "storage",
    "activeTab",
    "scripting",
    "webRequest",
    "tabs",
    "cookies"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "FreshRoute (Dev)"
  },
  "options_page": "options.html",
  "declarative_net_request": {
    "rule_resources": [{
      "id": "ruleset_1",
      "enabled": true,
      "path": "rules.json"
    }]
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
};

// Create development manifest
const manifestPath = path.resolve('manifest.dev.json');
fs.writeFileSync(manifestPath, JSON.stringify(devManifest, null, 2));

console.log('🔧 Development manifest created!');
console.log('📝 Use this for development to distinguish from production builds');
console.log('🚀 Run "npm run build" then load the dist/ folder in Chrome Extensions'); 