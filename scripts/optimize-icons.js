import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import imageminOptipng from 'imagemin-optipng';
import fs from 'fs';
import path from 'path';

const srcIconsDir = path.resolve('src/icons');
const distIconsDir = path.resolve('dist/icons');
const isDev = process.env.NODE_ENV === 'development';

async function optimizeIcons() {
  try {
    // Ensure dist/icons directory exists
    if (!fs.existsSync(distIconsDir)) {
      fs.mkdirSync(distIconsDir, { recursive: true });
    }

    if (isDev) {
      // In development mode, just copy icons without optimization
      console.log('🖼️  Copying icons (development mode - no optimization)...');
      
      const iconFiles = fs.readdirSync(srcIconsDir).filter(file => file.endsWith('.png'));
      let totalSize = 0;
      
      for (const file of iconFiles) {
        const srcPath = path.join(srcIconsDir, file);
        const destPath = path.join(distIconsDir, file);
        
        fs.copyFileSync(srcPath, destPath);
        const size = fs.statSync(srcPath).size;
        totalSize += size;
        
        console.log(`  ✅ ${file}: ${(size/1024).toFixed(1)}KB (copied as-is)`);
      }
      
      console.log(`\n📊 Icons Summary: ${(totalSize/1024).toFixed(1)}KB total (no optimization)`);
      
    } else {
      // In production mode, optimize icons
      console.log('🖼️  Optimizing icons (production mode)...');
      
      const iconFiles = fs.readdirSync(srcIconsDir).filter(file => file.endsWith('.png'));
      let totalOriginalSize = 0;
      let totalOptimizedSize = 0;
      
      for (const file of iconFiles) {
        const srcPath = path.join(srcIconsDir, file);
        const originalSize = fs.statSync(srcPath).size;
        totalOriginalSize += originalSize;
        
        // Optimize individual file
        const optimizedFiles = await imagemin([srcPath], {
          destination: distIconsDir,
          plugins: [
            imageminOptipng({ optimizationLevel: 7 }),
            imageminPngquant({
              quality: [0.6, 0.8],
              strip: true
            })
          ]
        });
        
        if (optimizedFiles.length > 0) {
          const optimizedSize = optimizedFiles[0].data.length;
          totalOptimizedSize += optimizedSize;
          
          const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
          console.log(`  ✅ ${file}: ${(originalSize/1024).toFixed(1)}KB → ${(optimizedSize/1024).toFixed(1)}KB (${savings}% smaller)`);
        }
      }
      
      const totalSavings = ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize * 100).toFixed(1);
      
      console.log(`\n📊 Icons Optimization Summary:`);
      console.log(`   Original: ${(totalOriginalSize/1024).toFixed(1)}KB`);
      console.log(`   Optimized: ${(totalOptimizedSize/1024).toFixed(1)}KB`);
      console.log(`   Savings: ${totalSavings}% reduction`);
    }
    
    console.log('✅ Icons processed successfully!');
    
  } catch (error) {
    console.error('❌ Error processing icons:', error);
    process.exit(1);
  }
}

optimizeIcons(); 