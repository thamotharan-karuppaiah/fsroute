# Installation Guide

## Quick Installation Steps

1. **Download the Extension**
   - Download or clone all the files from this directory
   - Ensure you have all files: `manifest.json`, `background.js`, `popup.html`, `popup.js`, `options.html`, `options.js`, `rules.json`, and the `icons/` folder

2. **Load in Chrome**
   - Open Chrome browser
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the folder containing all the extension files
   - The extension should now appear in your extensions list

3. **Verify Installation**
   - Look for the extension icon in Chrome's toolbar
   - Click the icon to open the popup
   - The extension should show as "Extension Enabled" by default

## First Usage

1. **Open Settings**
   - Click the extension icon
   - Click "Manage Rules" button
   - This opens the full configuration page

2. **Create Your First URL Rewrite Rule**
   - Go to "URL Rewrite Rules" tab
   - Click "Add URL Rule"
   - Example:
     - Name: "Local to Production"
     - Source URL Pattern: `http://localhost.freshservice-dev.com:8080/(.*)`
     - Target URL: `https://share-freshgladiators-m4008.freshgladiators.com/$1`
   - Click "Save Rule"

3. **Create Your First Header Rule**
   - Go to "Header Modification Rules" tab
   - Click "Add Header Rule"
   - Example:
     - Name: "Add CORS Headers"
     - URL Pattern: `https://api\.example\.com/.*`
     - Add Header: Name: `Access-Control-Allow-Origin`, Operation: Set, Target: Response, Value: `*`
   - Click "Save Rule"

## Testing

1. **Test URL Rewrite**
   - Navigate to a URL that matches your source pattern
   - The page should redirect to your target URL
   - Check the browser's address bar to confirm

2. **Test Header Modification**
   - Open Developer Tools (F12)
   - Go to Network tab
   - Make a request that matches your header rule pattern
   - Check the request/response headers to see your modifications

## Troubleshooting

- **Extension not working**: Make sure it's enabled in the popup
- **Rules not applying**: Check that individual rules are enabled
- **Regex not matching**: Test your patterns at regex101.com
- **Permissions denied**: The extension needs broad permissions to work with all websites

## Notes

- The extension uses Chrome's Manifest V3 and Declarative Net Request API
- All rules are stored locally in Chrome's sync storage
- No data is sent to external servers
- Changes take effect immediately when rules are saved 