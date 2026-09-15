import { defineConfig } from 'vite';

// Keep the renderer library independently cacheable from the application code.
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
