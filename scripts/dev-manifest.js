import fs from 'fs';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  // Read the original manifest
  const manifestPath = path.resolve('manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Modify for development
  const devManifest = {
    ...manifest,
    name: manifest.name + ' (Development)',
    version: manifest.version + '-dev',
    description: manifest.description + ' - Development Build (Unminified)',
    // Add content security policy for development
    content_security_policy: {
      extension_pages: "script-src 'self' 'unsafe-eval'; object-src 'self';"
    }
  };
  
  // Write development manifest to dist
  const distManifestPath = path.resolve('dist/manifest.json');
  fs.writeFileSync(distManifestPath, JSON.stringify(devManifest, null, 2));
  
  console.log('🔧 Development manifest created with:');
  console.log(`   - Name: ${devManifest.name}`);
  console.log(`   - Version: ${devManifest.version}`);
  console.log(`   - CSP: Allows eval for source maps`);
} else {
  console.log('📦 Production manifest used as-is');
} 