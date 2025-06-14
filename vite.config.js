import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  
  return {
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'manifest.json',
            dest: '.'
          },
          
          {
            src: 'rules.json',
            dest: '.'
          }
        ]
      })
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      minify: isDev ? false : 'terser',
      sourcemap: isDev ? 'inline' : false,
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background.js'),
          'content-script': resolve(__dirname, 'src/content-script.js'),
          content: resolve(__dirname, 'src/content.js'),
          popup: resolve(__dirname, 'src/popup.js'),
          options: resolve(__dirname, 'src/options.js'),
          dashboard: resolve(__dirname, 'src/dashboard.js')
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        }
      },
      terserOptions: isDev ? undefined : {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    }
  };
}); 