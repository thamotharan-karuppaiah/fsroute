# FreshRoute - URL Rewriter & Header Modifier

A powerful Chrome extension for redirecting URLs and modifying HTTP headers using regex patterns.

## Features

- **URL Rewriting**: Redirect URLs based on regex patterns with capture group support
- **Header Modification**: Add, modify, or remove HTTP request and response headers  
- **Rule Groups**: Organize rules into groups for better management
- **Individual Control**: Enable/disable rules and groups independently
- **Real-time Notifications**: Get notified when rules are applied
- **Import/Export**: Share rule configurations with team members
- **Developer-Friendly**: Perfect for local development, API testing, and CORS handling

## Installation

### From Chrome Web Store
1. Search for "FreshRoute" in the Chrome Web Store
2. Click "Add to Chrome"
3. Grant the necessary permissions

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" 
4. Click "Load unpacked" and select the extension folder

## Quick Start

### URL Rewriting
1. Click the FreshRoute extension icon
2. Go to "Rules" → "Add Rule" → "URL Rewrite"
3. Set source pattern: `https://api\.production\.com/(.*)`
4. Set target URL: `http://localhost:3000/$1`
5. Enable the rule

### Header Modification  
1. Add a "Modify Headers" rule
2. Set URL pattern: `https://api\.example\.com/.*`
3. Add headers like `Access-Control-Allow-Origin: *`
4. Choose request or response target

## Common Use Cases

- **Local Development**: Redirect production APIs to localhost
- **CORS Testing**: Add CORS headers for cross-origin requests  
- **API Authentication**: Inject API keys and auth headers
- **Cache Control**: Modify caching headers for testing
- **Environment Switching**: Route between different environments

## Documentation

For detailed documentation, see [FreshRoute Documentation](./URL_Rewriter_Header_Modifier_Documentation.md)

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

This project is licensed under the MIT License.

## Support

If you encounter issues or have questions:
1. Check the debug console for error messages
2. Verify your regex patterns are correct
3. Test rules individually to isolate problems
4. Review the documentation for troubleshooting tips