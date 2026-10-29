import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const frontendDirectory = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: frontendDirectory,
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/auth': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080',
      '/tiendas': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080',
      '/productos': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080',
      '/usuarios': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
