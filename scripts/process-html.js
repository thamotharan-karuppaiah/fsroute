import fs from 'fs';
import path from 'path';
import { minify } from 'html-minifier-terser';

const templatesDir = path.resolve('src/templates');
const distDir = path.resolve('dist');
const isDev = process.env.NODE_ENV === 'development';

const minifyOptions = {
  collapseWhitespace: !isDev,
  keepClosingSlash: true,
  removeComments: !isDev,
  removeRedundantAttributes: !isDev,
  removeScriptTypeAttributes: !isDev,
  removeStyleLinkTypeAttributes: !isDev,
  useShortDoctype: true,
  minifyCSS: !isDev,
  minifyJS: !isDev,
  removeEmptyAttributes: !isDev,
  removeOptionalTags: false, // Keep for Chrome extension compatibility
  caseSensitive: true
};

async function processHtmlFiles() {
  try {
    // Ensure dist directory exists
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Get all HTML files from templates directory
    const htmlFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.html'));
    
    console.log(`🔧 Processing ${htmlFiles.length} HTML files${isDev ? ' (development mode - no minification)' : ' (production mode - minified)'}...`);
    
    let totalOriginalSize = 0;
    let totalMinifiedSize = 0;
    
    for (const file of htmlFiles) {
      const inputPath = path.join(templatesDir, file);
      const outputPath = path.join(distDir, file);
      
      // Read original file
      const originalContent = fs.readFileSync(inputPath, 'utf8');
      const originalSize = Buffer.byteLength(originalContent, 'utf8');
      
      // Process HTML (minify in production, copy as-is in development)
      const processedContent = isDev ? originalContent : await minify(originalContent, minifyOptions);
      const processedSize = Buffer.byteLength(processedContent, 'utf8');
      
      // Write processed file
      fs.writeFileSync(outputPath, processedContent);
      
      // Calculate savings
      const savings = isDev ? 0 : ((originalSize - processedSize) / originalSize * 100).toFixed(1);
      
      if (isDev) {
        console.log(`  ✅ ${file}: ${(originalSize/1024).toFixed(1)}KB (copied as-is)`);
      } else {
        console.log(`  ✅ ${file}: ${(originalSize/1024).toFixed(1)}KB → ${(processedSize/1024).toFixed(1)}KB (${savings}% smaller)`);
      }
      
      totalOriginalSize += originalSize;
      totalMinifiedSize += processedSize;
    }
    
    const totalSavings = ((totalOriginalSize - totalMinifiedSize) / totalOriginalSize * 100).toFixed(1);
    
    console.log(`\n📊 HTML Processing Summary:`);
    console.log(`   Original: ${(totalOriginalSize/1024).toFixed(1)}KB`);
    console.log(`   Minified: ${(totalMinifiedSize/1024).toFixed(1)}KB`);
    console.log(`   Savings: ${totalSavings}% reduction`);
    console.log(`✅ HTML files processed successfully!`);
    
  } catch (error) {
    console.error('❌ Error processing HTML files:', error);
    process.exit(1);
  }
}

processHtmlFiles(); 