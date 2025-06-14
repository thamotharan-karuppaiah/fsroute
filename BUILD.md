# FreshRoute Extension - Build Guide

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Installation
```bash
npm install
```

## Build Commands

### Development Build (No Minification)
```bash
npm run build:dev
```
Creates development build with:
- ✅ **No minification** (readable code for debugging)
- ✅ **Inline source maps** (for debugging in Chrome DevTools)
- ✅ **Console.log preserved** (all debug statements kept)
- ✅ **Development manifest** (distinguishable from production)

### Production Build (Optimized)
```bash
npm run build:prod
```
Creates optimized production build with:
- ✅ **Full minification** (52% JS reduction, 34.5% HTML reduction)
- ✅ **Console removal** (all debug statements stripped)
- ✅ **No source maps** (smaller bundle size)
- ✅ **Production manifest** (ready for Chrome Web Store)

### Legacy Build (Default Production)
```bash
npm run build
```
Alias for production build (maintains backward compatibility)

### Development Watch Mode
```bash
npm run watch:dev
```
Watches for changes and rebuilds in development mode (no minification)

### Production Watch Mode
```bash
npm run watch
```
Watches for changes and rebuilds in production mode (minified)

### Pack for Distribution
```bash
npm run pack          # Production build + zip
npm run pack:dev      # Development build + zip (for testing)
```

### Clean Build
```bash
npm run clean
```
Removes the `dist/` directory

## Directory Structure

```
├── src/                    # Source files
│   ├── templates/          # HTML template files
│   │   ├── popup.html      # Popup page template
│   │   ├── options.html    # Options page template
│   │   ├── dashboard.html  # Dashboard page template
│   │   ├── debug.html      # Debug page template
│   │   └── test_cookies.html # Test page template
│   ├── icons/              # Extension icons (PNG files)
│   │   ├── icon16.png      # 16x16 extension icon
│   │   ├── icon48.png      # 48x48 extension icon
│   │   ├── icon128.png     # 128x128 extension icon
│   │   └── *.png           # Additional brand icons
│   ├── background.js       # Service worker
│   ├── content-script.js   # Content script (injected)
│   ├── content.js          # Content script (notifications)
│   ├── popup.js           # Popup functionality
│   ├── options.js         # Options page
│   └── dashboard.js       # Dashboard functionality
├── manifest.json         # Extension manifest
├── rules.json           # Default rules
├── dist/                # Built extension (git-ignored)
└── scripts/             # Build scripts
    ├── pack.js           # Packaging script
    ├── process-html.js   # HTML minification
    ├── optimize-icons.js # Icon optimization
    ├── dev-setup.js      # Development setup
    ├── dev-manifest.js   # Development manifest
    ├── dev-watch.js      # Development watch mode
    └── build-summary.js  # Build statistics
```

## Build Features

- **JavaScript Minification**: Files minified using Terser (52% size reduction)
- **HTML Minification**: HTML files minified with whitespace removal, comment removal, and CSS/JS optimization (34.5% size reduction)
- **Icon Optimization**: PNG icons optimized with pngquant and optipng (88.8% size reduction)
- **Tree Shaking**: Unused code is automatically removed
- **Source Maps**: Generated for debugging (dev mode only)
- **Console Removal**: `console.log` and `debugger` statements removed in production
- **Asset Optimization**: All assets processed and optimized
- **Build Statistics**: Detailed size comparison and optimization reports
- **Zip Creation**: Automatic zip creation for Chrome Web Store

## Chrome Extension Loading

### Development
1. Run `npm run build`
2. Open Chrome → Extensions → Enable Developer Mode
3. Click "Load unpacked" → Select the `dist/` folder

### Production
1. Run `npm run pack`
2. Upload `freshroute-extension.zip` to Chrome Web Store

## File Organization

- **Source files**: All JavaScript moved to `src/` directory
- **Build output**: Generated in `dist/` directory
- **Static assets**: HTML, manifest, icons, rules copied as-is
- **Dependencies**: Managed via npm/package.json

## Benefits of This Setup

1. **Significant Size Reduction**: 47.2% overall reduction (339.7KB → 179.4KB)
2. **Optimized Performance**: Faster loading with minified assets
3. **Professional Workflow**: Industry-standard tooling and processes
4. **Automated Builds**: Single command to build, optimize, and pack
5. **Comprehensive Optimization**: Both JavaScript and HTML files optimized
6. **Build Analytics**: Detailed statistics showing optimization results
7. **Version Control Friendly**: Only source code tracked, not built artifacts
8. **Chrome Store Ready**: Automated packaging for immediate upload

## Build Mode Comparison

| Feature | Development Mode | Production Mode |
|---------|------------------|-----------------|
| **JavaScript Size** | 712.9KB (readable) | 118.3KB (minified) |
| **HTML Size** | 93.4KB (formatted) | 61.1KB (minified) |
| **Icons Size** | 257.1KB (original) | 28.9KB (optimized) |
| **Source Maps** | ✅ Inline (debugging) | ❌ None (smaller) |
| **Console.log** | ✅ Preserved | ❌ Removed |
| **Comments** | ✅ Preserved | ❌ Removed |
| **Whitespace** | ✅ Formatted | ❌ Compressed |
| **Icon Optimization** | ❌ Copied as-is | ✅ PNG optimization |
| **Manifest** | Dev version | Production version |
| **Use Case** | Debugging & Development | Chrome Web Store |

## Optimization Results (Production Mode)

### File Size Reductions:
- **JavaScript**: 246.4KB → 118.3KB (52.0% reduction)
- **HTML**: 93.4KB → 61.1KB (34.5% reduction)
- **Icons**: 257.1KB → 28.9KB (88.8% reduction)
- **Total**: 596.8KB → 208.3KB (65.1% reduction)
- **Final Package**: 76.2KB (ready for Chrome Web Store)

### Development vs Production:
- **Development Bundle**: ~1,063KB (readable, debuggable)
- **Production Bundle**: ~208KB (optimized, minified)
- **Size Difference**: 80% smaller in production
- **Final Zip**: 76.2KB (73% compression ratio) 