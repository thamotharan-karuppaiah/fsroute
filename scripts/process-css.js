import fs from 'fs';
import path from 'path';
import CleanCSS from 'clean-css';

const templatesDir = path.resolve('src/templates');
const distDir = path.resolve('dist');
const isDev = process.env.NODE_ENV === 'development';

const cleanCSSOptions = {
  level: isDev ? 0 : 2, // No optimization in dev, aggressive optimization in prod
  returnPromise: false,
  sourceMap: isDev,
  format: isDev ? 'beautify' : false
};

async function processCssFiles() {
  try {
    // Ensure dist directory exists
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Get all CSS files from templates directory
    const cssFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.css'));
    
    if (cssFiles.length === 0) {
      console.log('📄 No CSS files found to process');
      return;
    }
    
    console.log(`🎨 Processing ${cssFiles.length} CSS files${isDev ? ' (development mode - no minification)' : ' (production mode - minified)'}...`);
    
    let totalOriginalSize = 0;
    let totalMinifiedSize = 0;
    
    const cleanCSS = new CleanCSS(cleanCSSOptions);
    
    for (const file of cssFiles) {
      const inputPath = path.join(templatesDir, file);
      const outputPath = path.join(distDir, file);
      
      // Read original file
      const originalContent = fs.readFileSync(inputPath, 'utf8');
      const originalSize = Buffer.byteLength(originalContent, 'utf8');
      
      let processedContent;
      let processedSize;
      
      if (isDev) {
        // Development: copy as-is
        processedContent = originalContent;
        processedSize = originalSize;
      } else {
        // Production: minify CSS
        const result = cleanCSS.minify(originalContent);
        
        if (result.errors && result.errors.length > 0) {
          console.error(`❌ CSS minification errors in ${file}:`, result.errors);
          throw new Error(`CSS minification failed for ${file}`);
        }
        
        if (result.warnings && result.warnings.length > 0) {
          console.warn(`⚠️  CSS minification warnings in ${file}:`, result.warnings);
        }
        
        processedContent = result.styles;
        processedSize = Buffer.byteLength(processedContent, 'utf8');
      }
      
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
    
    console.log(`\n📊 CSS Processing Summary:`);
    console.log(`   Original: ${(totalOriginalSize/1024).toFixed(1)}KB`);
    console.log(`   Minified: ${(totalMinifiedSize/1024).toFixed(1)}KB`);
    console.log(`   Savings: ${totalSavings}% reduction`);
    console.log(`✅ CSS files processed successfully!`);
    
  } catch (error) {
    console.error('❌ Error processing CSS files:', error);
    process.exit(1);
  }
}

processCssFiles(); 