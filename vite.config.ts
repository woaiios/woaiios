import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
  // Base public path when served in production
  base: '/woaiios/',
  
  // Public directory for static assets
  publicDir: 'public',
  
  plugins: [
    react(),
    // Gzip compression for all assets
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files larger than 10KB
      deleteOriginFile: false,
      verbose: true
    })
  ],
  
  // Development server configuration
  server: {
    port: 3000,
    open: true,
    cors: true,
    fs: {
      // Don't transform worker files
      strict: false
    }
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Generate sourcemaps for debugging
    sourcemap: false,
    // Minify output
    minify: 'terser',
    // Copy static assets manually
    copyPublicDir: true,
    // Configure rollup options
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        // Configure chunk file naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
            return `assets/images/[name]-[hash].${ext}`;
          } else if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name)) {
            return `assets/fonts/[name]-[hash].${ext}`;
          } else if (/\.css$/i.test(assetInfo.name)) {
            return `assets/css/[name]-[hash].${ext}`;
          } else if (/\.wasm$/i.test(assetInfo.name)) {
            // Handle sql.js wasm files
            return `assets/[name].[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        }
      }
    },
    // Optimize chunk size (increase limit due to large dictionary files)
    chunkSizeWarningLimit: 2000,
    // Enable CSS code splitting
    cssCodeSplit: true
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@services': resolve(__dirname, './src/services'),
      '@store': resolve(__dirname, './src/store'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types')
    }
  },
  
  // Optimization
  optimizeDeps: {
    exclude: ['sql.js'],
    entries: ['index.html']
  },
  
  // Worker configuration
  worker: {
    format: 'es'
  },
  
  // Handle wasm files for sql.js
  assetsInclude: ['**/*.wasm'],
  
  // Test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true
  }
});
