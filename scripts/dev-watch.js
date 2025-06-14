import { spawn } from 'child_process';
import { watch } from 'fs';
import path from 'path';

console.log('🔧 Starting FreshRoute development watch mode...\n');

let buildProcess = null;
let buildTimeout = null;

function runBuild() {
  if (buildProcess) {
    buildProcess.kill();
  }
  
  const isDev = process.env.NODE_ENV === 'development';
  const buildCommand = isDev ? 'build:dev' : 'build';
  
  console.log(`🔄 Building extension${isDev ? ' (development mode - no minification)' : ' (production mode)'}...`);
  buildProcess = spawn('npm', ['run', buildCommand], { 
    stdio: 'inherit',
    shell: true 
  });
  
  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build completed successfully!\n');
      console.log('💡 Load the dist/ folder in Chrome Extensions (Developer Mode)\n');
    } else {
      console.log('❌ Build failed!\n');
    }
    buildProcess = null;
  });
}

function debouncedBuild() {
  if (buildTimeout) {
    clearTimeout(buildTimeout);
  }
  buildTimeout = setTimeout(runBuild, 500); // 500ms debounce
}

// Watch source files
const srcDir = path.resolve('src');
const templatesDir = path.resolve('src/templates');

console.log('👀 Watching for changes in:');
console.log('   - src/ (JavaScript files)');
console.log('   - src/templates/ (HTML files)');
console.log('   - manifest.json');
console.log('   - rules.json\n');

// Watch JavaScript files
watch(srcDir, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.js')) {
    console.log(`📝 Changed: src/${filename}`);
    debouncedBuild();
  }
});

// Watch HTML templates
watch(templatesDir, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.html')) {
    console.log(`🌐 Changed: src/templates/${filename}`);
    debouncedBuild();
  }
});

// Watch manifest and rules
watch('manifest.json', (eventType) => {
  console.log('📋 Changed: manifest.json');
  debouncedBuild();
});

watch('rules.json', (eventType) => {
  console.log('⚙️  Changed: rules.json');
  debouncedBuild();
});

// Initial build
runBuild();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping development watch...');
  if (buildProcess) {
    buildProcess.kill();
  }
  process.exit(0);
}); 