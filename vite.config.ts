import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.monkeycode-ai.live'],
    hmr: {
      overlay: false
    }
  },

  build: {
    sourcemap: false, // Saves memory during build
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react';
            }
            if (id.includes('dexie')) {
              return 'dexie';
            }
            return 'vendor';
          }
        },
      },
    },
  },

  optimizeDeps: {
    include: ['dexie', 'dexie-react-hooks', 'dexie-export-import'],
  },
});