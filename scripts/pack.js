import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

const distPath = path.resolve('dist');
const outputPath = path.resolve('freshroute-extension.zip');

// Remove existing zip if it exists
if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
}

// Create zip archive
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  console.log(`✅ Extension packed successfully!`);
  console.log(`📦 File: freshroute-extension.zip`);
  console.log(`📊 Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🚀 Ready for Chrome Web Store upload!`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add all files from dist directory
archive.directory(distPath, false);

archive.finalize(); 