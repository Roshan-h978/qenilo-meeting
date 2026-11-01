import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8000', changeOrigin: true, ws: true },
    },
  },
});
