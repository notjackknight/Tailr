import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Default to 5173 (Vite's standard); fall through to next free port
      // if it's taken. Override with `vite --port XXXX` if needed.
      port: 5173,
      strictPort: false,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: ['**/output/**', '**/data/**'],
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
