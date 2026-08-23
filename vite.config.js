import { defineConfig } from 'vite';
import { resolve } from 'path';
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // Base public path
  // Use /woaiios/ for both dev and build to ensure consistent paths
  base: '/woaiios/',

  // Build timestamp injected into the bundle (footer display)
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },

  // Public directory for static assets
  publicDir: 'public',
  
  plugins: [
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
    // Proxy LM Studio local API to avoid browser CORS restrictions.
    // The app falls back to /lm-studio/v1/chat/completions when direct
    // access to http://localhost:1234 is blocked by CORS.
    proxy: {
      '/lm-studio': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lm-studio/, '')
      }
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
    // es2015 for old-WebKit devices (e.g. iOS 12 Safari on iPhone 6):
    // transpiles optional chaining / nullish coalescing etc.
    target: 'es2015',
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
      '@': resolve(__dirname, './'),
      '@components': resolve(__dirname, './components'),
      '@js': resolve(__dirname, './js'),
      '@css': resolve(__dirname, './css')
    }
  },
  
  // Optimization
  optimizeDeps: {
    exclude: ['sql.js']
  },
  
  // Handle wasm files for sql.js
  assetsInclude: ['**/*.wasm']
}));
