import fs from 'fs';
import path from 'path';

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

function formatSize(bytes) {
  return (bytes / 1024).toFixed(1) + 'KB';
}

function calculateSavings(original, minified) {
  if (original === 0) return '0.0';
  return ((original - minified) / original * 100).toFixed(1);
}

console.log('\n🚀 FreshRoute Extension - Build Summary\n');

// JavaScript files comparison
const jsFiles = [
  'background.js',
  'content-script.js', 
  'content.js',
  'popup.js',
  'options.js',
  'dashboard.js'
];

console.log('📄 JavaScript Files:');
let totalJsOriginal = 0;
let totalJsMinified = 0;

jsFiles.forEach(file => {
  const originalSize = getFileSize(path.join('src', file));
  const minifiedSize = getFileSize(path.join('dist', file));
  
  if (originalSize > 0 && minifiedSize > 0) {
    const savings = calculateSavings(originalSize, minifiedSize);
    console.log(`  ${file.padEnd(20)} ${formatSize(originalSize).padStart(8)} → ${formatSize(minifiedSize).padStart(8)} (${savings}% smaller)`);
    
    totalJsOriginal += originalSize;
    totalJsMinified += minifiedSize;
  }
});

// HTML files comparison
const htmlFiles = [
  'popup.html',
  'options.html',
  'dashboard.html',
  'debug.html',
  'test_cookies.html'
];

console.log('\n🌐 HTML Files:');
let totalHtmlOriginal = 0;
let totalHtmlMinified = 0;

htmlFiles.forEach(file => {
  const originalSize = getFileSize(path.join('src/templates', file));
  const minifiedSize = getFileSize(path.join('dist', file));
  
  if (originalSize > 0 && minifiedSize > 0) {
    const savings = calculateSavings(originalSize, minifiedSize);
    console.log(`  ${file.padEnd(20)} ${formatSize(originalSize).padStart(8)} → ${formatSize(minifiedSize).padStart(8)} (${savings}% smaller)`);
    
    totalHtmlOriginal += originalSize;
    totalHtmlMinified += minifiedSize;
  }
});

// Icon files comparison
const iconFiles = [
  'icon16.png',
  'icon48.png',
  'icon128.png',
  'freshdesk.png',
  'freshmarketer.png',
  'freshsales.png',
  'freshservice.png'
];

console.log('\n🖼️  Icon Files:');
let totalIconsOriginal = 0;
let totalIconsOptimized = 0;

iconFiles.forEach(file => {
  const originalSize = getFileSize(path.join('src/icons', file));
  const optimizedSize = getFileSize(path.join('dist/icons', file));
  
  if (originalSize > 0 && optimizedSize > 0) {
    const savings = calculateSavings(originalSize, optimizedSize);
    console.log(`  ${file.padEnd(20)} ${formatSize(originalSize).padStart(8)} → ${formatSize(optimizedSize).padStart(8)} (${savings}% smaller)`);
    
    totalIconsOriginal += originalSize;
    totalIconsOptimized += optimizedSize;
  }
});

// Overall summary
const totalOriginal = totalJsOriginal + totalHtmlOriginal + totalIconsOriginal;
const totalMinified = totalJsMinified + totalHtmlMinified + totalIconsOptimized;
const totalSavings = calculateSavings(totalOriginal, totalMinified);

console.log('\n📊 Overall Summary:');
console.log(`  JavaScript:          ${formatSize(totalJsOriginal).padStart(8)} → ${formatSize(totalJsMinified).padStart(8)} (${calculateSavings(totalJsOriginal, totalJsMinified)}% reduction)`);
console.log(`  HTML:                ${formatSize(totalHtmlOriginal).padStart(8)} → ${formatSize(totalHtmlMinified).padStart(8)} (${calculateSavings(totalHtmlOriginal, totalHtmlMinified)}% reduction)`);
console.log(`  Icons:               ${formatSize(totalIconsOriginal).padStart(8)} → ${formatSize(totalIconsOptimized).padStart(8)} (${calculateSavings(totalIconsOriginal, totalIconsOptimized)}% reduction)`);
console.log(`  ${'─'.repeat(50)}`);
console.log(`  Total:               ${formatSize(totalOriginal).padStart(8)} → ${formatSize(totalMinified).padStart(8)} (${totalSavings}% reduction)`);

// Extension package info
const zipSize = getFileSize('freshroute-extension.zip');
if (zipSize > 0) {
  console.log(`\n📦 Final Package:`);
  console.log(`  freshroute-extension.zip: ${formatSize(zipSize)}`);
  console.log(`  Compression ratio: ${((totalMinified / zipSize) * 100).toFixed(1)}% (${formatSize(totalMinified)} → ${formatSize(zipSize)})`);
}

console.log('\n✅ Build optimization complete!\n'); 