# FreshRoute - URL Rewriter & Header Modifier Extension Documentation

## Overview

FreshRoute is a powerful Chrome extension that allows you to:
- Redirect URLs based on regex patterns
- Modify HTTP request and response headers
- Organize rules into groups for better management
- Enable/disable rules individually or by group
- Receive notifications when rules are applied

---

## 1. Installation

### Prerequisites
- Google Chrome browser (version 88 or higher recommended)
- Developer mode enabled in Chrome Extensions

### Installation Steps

#### Option A: From Chrome Web Store
1. Open Chrome and navigate to the Chrome Web Store
2. Search for "FreshRoute" or "URL Rewriter & Header Modifier"
3. Click "Add to Chrome"
4. Confirm by clicking "Add Extension"

#### Option B: Manual Installation (Developer Mode)
1. Download the FreshRoute extension files to your computer
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" button
5. Select the folder containing the extension files
6. The extension will appear in your extensions list

### Verification
- Look for the FreshRoute extension icon in your Chrome toolbar
- Click the icon to open the popup interface
- You should see the main control panel

---

## 2. Using Preset Groups

### What are Preset Groups?
Preset groups are pre-configured collections of rules designed for common use cases. They help you quickly set up URL redirections and header modifications without manual configuration.

### Accessing Preset Groups
1. Click the extension icon in your Chrome toolbar
2. Navigate to the "Groups" section
3. Browse available preset groups

### Common Preset Groups

#### Development Environment Group
- **Purpose**: Redirect production URLs to local development servers
- **Example Rules**:
  - `https://api\.example\.com/(.*)` → `http://localhost:3000/$1`
  - `https://app\.example\.com/(.*)` → `http://localhost:8080/$1`

#### CORS Headers Group
- **Purpose**: Add CORS headers for cross-origin requests
- **Example Rules**:
  - Add `Access-Control-Allow-Origin: *` to responses
  - Add `Access-Control-Allow-Methods: GET, POST, PUT, DELETE` to responses

#### API Testing Group
- **Purpose**: Modify API requests for testing purposes
- **Example Rules**:
  - Add `X-API-Key: test-key` to requests
  - Add `X-Environment: staging` to requests

### Enabling/Disabling Preset Groups
1. In the Groups section, find your desired preset group
2. Toggle the group switch to enable/disable all rules in the group
3. Individual rules within a group can also be toggled independently

### Customizing Preset Groups
1. Select a preset group
2. Click "Edit Group"
3. Modify existing rules or add new ones
4. Save your changes

---

## 3. Manual Configuration

### Creating Custom Rules

#### URL Rewrite Rules

1. **Access Rule Creation**:
   - Click the extension icon
   - Navigate to "Rules" or "Add Rule"
   - Select "URL Rewrite" as the rule type

2. **Configure URL Rewrite Rule**:
   - **Rule Name**: Enter a descriptive name (e.g., "Redirect API to Local")
   - **Source URL Pattern**: Enter regex pattern to match URLs
     ```
     https://api\.production\.com/(.*)
     ```
   - **Target URL**: Enter the destination URL with capture groups
     ```
     http://localhost:3000/$1
     ```
   - **Options**:
     - ☑️ **Preserve Original Host**: Maintains the original hostname for sub-resources
     - ☑️ **Enabled**: Activates the rule immediately

3. **Advanced URL Pattern Examples**:
   ```
   # Redirect specific API endpoints
   https://api\.example\.com/v1/users/(.*)
   
   # Redirect with port numbers
   https://app\.example\.com:8443/(.*)
   
   # Redirect multiple subdomains
   https://(api|app)\.example\.com/(.*)
   ```

#### Header Modification Rules

1. **Access Header Rule Creation**:
   - Click "Add Rule"
   - Select "Modify Headers" as the rule type

2. **Configure Header Rule**:
   - **Rule Name**: Enter descriptive name (e.g., "Add CORS Headers")
   - **URL Pattern**: Enter regex pattern for URLs to match
     ```
     https://api\.example\.com/.*
     ```

3. **Add Headers**:
   - Click "Add Header"
   - Configure each header:
     - **Header Name**: e.g., `Access-Control-Allow-Origin`
     - **Header Value**: e.g., `*`
     - **Operation**: 
       - `Set`: Replace or add header
       - `Append`: Add to existing header value
       - `Remove`: Delete header
     - **Target**: 
       - `Request`: Modify outgoing requests
       - `Response`: Modify incoming responses

4. **Common Header Examples**:
   ```
   # CORS Headers (Response)
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE
   Access-Control-Allow-Headers: Content-Type, Authorization
   
   # API Headers (Request)
   X-API-Key: your-api-key
   X-Custom-Header: custom-value
   Authorization: Bearer token-value
   
   # Cache Control (Response)
   Cache-Control: no-cache, no-store, must-revalidate
   ```

### Creating Custom Groups

1. **Create New Group**:
   - Navigate to "Groups" section
   - Click "Create New Group"
   - Enter group name and description

2. **Add Rules to Group**:
   - Create rules as described above
   - Assign rules to your custom group during creation
   - Or drag existing rules into the group

3. **Group Management**:
   - Enable/disable entire groups
   - Reorder rules within groups
   - Export/import group configurations

---

## 4. Advanced Features

### Rule Priority and Order
- Rules are processed in order of priority
- URL rewrite rules have higher priority than header rules
- Within the same type, rules are processed by specificity:
  - Exact domain matches have higher priority
  - Specific ports have higher priority
  - Longer paths have higher priority

### Preserve Original Host Feature
When enabled for URL rewrite rules:
- Main page navigation is redirected normally
- Sub-resources (images, scripts, stylesheets) maintain the original hostname
- Useful for development environments where you want to redirect the main page but keep CDN resources

### Regex Pattern Guidelines

#### Best Practices:
```
# Good: Escape dots in domains
https://api\.example\.com/(.*)

# Good: Use specific patterns
https://app\.example\.com/api/v1/(.*)

# Good: Anchor patterns when needed
^https://api\.example\.com/users/(\d+)$
```

#### Common Mistakes:
```
# Bad: Unescaped dots (matches any character)
https://api.example.com/(.*)

# Bad: Too broad patterns
.*example.*

# Bad: Missing capture groups for replacement
https://api\.example\.com/
```

### Header Restrictions

#### Allowed Headers:
- Custom headers (X-* headers)
- Cache-Control
- Content-Type
- Authorization
- API keys and custom authentication headers

#### Restricted Headers:
- CORS headers (must be set server-side)
- Security headers (CSP, X-Frame-Options)
- Browser-controlled headers (Host, Connection)
- Cookie headers (Set-Cookie)

---

## 5. Troubleshooting

### Common Issues and Solutions

#### Rules Not Working
1. Check if the extension is enabled
2. Verify regex patterns are correct
3. Check browser console for errors
4. Ensure URLs match the pattern exactly

#### Headers Not Being Modified
1. Verify the header is not restricted
2. Check the URL pattern matches the target page
3. Some headers can only be modified server-side
4. Use browser developer tools to inspect actual headers

#### Performance Issues
1. Limit the number of active rules
2. Use specific patterns instead of broad wildcards
3. Disable unused groups
4. Consider rule priority optimization

### Debug Information
1. Right-click the extension icon
2. Select "Inspect popup" to open developer tools
3. Check console for rule processing logs
4. Use the "Debug Headers" feature in the extension

### Getting Help
- Check the extension's debug console for detailed error messages
- Test rules individually to isolate issues
- Use browser developer tools to inspect network requests
- Verify regex patterns using online regex testers

---

## 6. Privacy and Security

### Data Storage
- Rules and settings are stored locally in your browser
- No data is transmitted to external servers
- Sync settings can be enabled to synchronize across devices

### Permissions
The extension requires permissions to:
- Access and modify web requests
- Read and modify website data
- Store settings locally

### Security Considerations
- Only use trusted rule sources
- Be cautious with broad URL patterns
- Regularly review and clean up unused rules
- Test rules in a safe environment before production use

---

## 7. Export and Import

### Exporting Rules
1. Navigate to "Settings" or "Manage Rules"
2. Click "Export Rules"
3. Save the JSON file to your computer
4. Share with team members or use as backup

### Importing Rules
1. Click "Import Rules"
2. Select the JSON file containing rules
3. Choose to merge with existing rules or replace them
4. Review imported rules before enabling

### Rule Sharing
- Export specific groups for team sharing
- Use standardized naming conventions
- Document rule purposes and dependencies
- Version control rule configurations

---

## 8. Best Practices

### Organization
- Group related rules together
- Use descriptive names for rules and groups
- Comment complex regex patterns
- Maintain a rule inventory document

### Testing
- Test rules in a development environment first
- Use specific test URLs to verify functionality
- Monitor browser console for errors
- Test with different websites and scenarios

### Maintenance
- Regularly review and update rules
- Remove unused or obsolete rules
- Update regex patterns as websites change
- Keep backup copies of working configurations

### Performance
- Minimize the number of active rules
- Use efficient regex patterns
- Disable rules when not needed
- Monitor extension performance impact

---

## 9. API Reference

### Storage Structure
```json
{
  "extensionEnabled": true,
  "notificationsEnabled": true,
  "groups": [
    {
      "name": "Development",
      "enabled": true,
      "rules": [
        {
          "name": "API Redirect",
          "type": "url_rewrite",
          "enabled": true,
          "sourceUrl": "https://api\\.example\\.com/(.*)",
          "targetUrl": "http://localhost:3000/$1",
          "preserveOriginalHost": false
        }
      ]
    }
  ]
}
```

### Rule Types
- `url_rewrite`: Redirect URLs based on patterns
- `modify_headers`: Add, modify, or remove HTTP headers

### Header Operations
- `set`: Replace or add header value
- `append`: Append to existing header value  
- `remove`: Delete header entirely

---

This documentation provides comprehensive coverage of the FreshRoute extension. For additional support or feature requests, please refer to the extension's support channels or documentation updates. 