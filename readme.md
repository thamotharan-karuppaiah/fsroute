# URL Rewriter & Header Modifier

A powerful Chrome extension for URL rewriting and header modification, similar to Requestly. This extension allows you to:

1. **URL Rewrite Rules**: Redirect URLs using regex patterns with capture groups
2. **Header Modification Rules**: Add, modify, or remove HTTP headers for requests and responses

## Features

### URL Rewriting
- Define source URL patterns using regex
- Map to target URLs with capture group substitution
- Support for complex regex patterns like `http://localhost.freshservice-dev.com:8080/(.*)` → `https://share-freshgladiators-m4008.freshgladiators.com/$1`

### Header Modification
- Add, override, append, or remove headers
- Separate control for request and response headers
- Regex-based URL pattern matching
- Support for CORS headers, authentication tokens, and custom headers

### Rule Management
- Individual rule enable/disable toggles
- Global extension enable/disable
- User-friendly interface with tabbed organization
- Real-time rule validation

## Installation

### Method 1: Load as Unpacked Extension (Development)

1. Clone or download this repository to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension should now appear in your extensions list

### Method 2: Manual Installation

1. Download the extension files
2. Open Chrome Extensions page (`chrome://extensions/`)
3. Enable Developer mode
4. Click "Load unpacked" and select the folder containing the extension files

## Usage

### Quick Start

1. **Enable the Extension**: Click the extension icon in the toolbar and toggle it on
2. **Access Settings**: Click "Manage Rules" in the popup or right-click the extension icon and select "Options"
3. **Create URL Rewrite Rule**:
   - Click "Add URL Rule" in the URL Rewrite Rules tab
   - Enter a rule name (e.g., "Local to Production")
   - Set source pattern: `http://localhost.freshservice-dev.com:8080/(.*)`
   - Set target URL: `https://share-freshgladiators-m4008.freshgladiators.com/$1`
   - Save the rule

4. **Create Header Rule**:
   - Switch to "Header Modification Rules" tab
   - Click "Add Header Rule"
   - Enter rule name and URL pattern
   - Add headers to modify (name, operation, target, value)
   - Save the rule

### URL Rewrite Examples

#### Basic Redirect
- **Source**: `http://localhost:3000/(.*)`
- **Target**: `https://myapp.com/$1`

#### Environment Switching
- **Source**: `https://staging\.example\.com/(.*)`
- **Target**: `https://production.example.com/$1`

#### API Endpoint Rewriting
- **Source**: `http://local-api\.dev:8080/api/v1/(.*)`
- **Target**: `https://api.production.com/v2/$1`

### Header Modification Examples

#### Add CORS Headers
- **URL Pattern**: `https://api\.example\.com/.*`
- **Headers**:
  - Name: `Access-Control-Allow-Origin`, Operation: Set, Target: Response, Value: `*`
  - Name: `Access-Control-Allow-Methods`, Operation: Set, Target: Response, Value: `GET, POST, PUT, DELETE`

#### Remove Security Headers
- **URL Pattern**: `https://internal\.company\.com/.*`
- **Headers**:
  - Name: `X-Frame-Options`, Operation: Remove, Target: Response

#### Add Authentication
- **URL Pattern**: `https://secure\.api\.com/.*`
- **Headers**:
  - Name: `Authorization`, Operation: Set, Target: Request, Value: `Bearer your-token-here`

## Advanced Features

### Regex Patterns
The extension supports full JavaScript regex patterns:
- Use parentheses `()` for capture groups
- Reference capture groups with `$1`, `$2`, etc.
- Use `.*` for wildcard matching
- Escape special characters with backslashes

### Pattern Examples
- `https://([^.]+)\.example\.com/(.*)` → `https://newdomain.com/$1/$2`
- `http://localhost:(\d+)/(.*)` → `https://remote-server.com:$1/$2`

### Header Operations
- **Set/Override**: Replaces existing header or adds if not present
- **Append**: Adds to existing header value (comma-separated)
- **Remove**: Completely removes the header

## Extension Structure

```
url-rewriter-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for rule management
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── options.html          # Settings page
├── options.js            # Settings page functionality
├── rules.json            # Static rules file
├── icons/                # Extension icons
└── README.md             # Documentation
```

## Permissions

The extension requires the following permissions:
- `declarativeNetRequest`: For URL rewriting and header modification
- `declarativeNetRequestWithHostAccess`: For accessing all websites
- `storage`: For saving user rules and settings
- `activeTab`: For current tab information
- `<all_urls>`: Host permission for all websites

## Troubleshooting

### Rules Not Working
1. Check if the extension is enabled (toggle in popup)
2. Verify that individual rules are enabled
3. Test regex patterns in a regex tester
4. Check browser console for errors

### Performance Issues
- Limit the number of active rules
- Use specific URL patterns instead of wildcards when possible
- Disable unused rules

### Debugging
1. Open Chrome DevTools
2. Go to the Network tab
3. Check if requests are being modified as expected
4. Look at the Console tab for any error messages

## Browser Compatibility

- Chrome 88+
- Microsoft Edge 88+
- Other Chromium-based browsers with Manifest V3 support

## Contributing

This extension is built using:
- Manifest V3
- Declarative Net Request API
- Chrome Storage API
- Vanilla JavaScript (no frameworks)

To contribute:
1. Fork the repository
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## Privacy

This extension:
- Works entirely locally (no data sent to external servers)
- Stores rules and settings in Chrome's sync storage
- Only modifies network requests as configured by the user
- Does not track or collect any personal information

## Version History

- **v1.0.0**: Initial release with URL rewriting and header modification

## License

This project is open source. Feel free to use, modify, and distribute as needed.

## Support

For issues, feature requests, or questions:
1. Check the troubleshooting section above
2. Review existing issues in the repository
3. Create a new issue with detailed information about your problem

---

**Note**: This extension modifies network requests and responses. Use responsibly and in accordance with your organization's policies and applicable laws.