import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { compression } from 'vite-plugin-compression2';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Generate bundle visualization report
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
    // Compress assets for faster loading
    compression({
      algorithm: 'brotliCompress',
      exclude: [/\.(br)$/, /\.(gz)$/, /\.(png|jpe?g|gif|webp)$/i],
      threshold: 1024, // Only compress files larger than 1KB
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // Optimize for VS Code webview
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        passes: 2, // Multiple optimization passes
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
    // Optimize CSS - ensure it's a separate file, not inlined
    cssMinify: true,
    cssCodeSplit: false, // Keep CSS in one file
    assetsInlineLimit: 0, // Don't inline any assets
    // Disable code splitting completely for VS Code webview
    rollupOptions: {
      output: {
        // Disable code splitting by putting everything in a single file
        manualChunks: () => 'index',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        // Ensure CSS is extracted and not inlined
        assetFileNames: assetInfo => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/style.css';
          }
          return 'assets/[name].[ext]';
        },
      },
    },
    // Improve build performance
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Base path for assets when running in VS Code webview
  base: '',
});
