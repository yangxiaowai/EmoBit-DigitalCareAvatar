import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        // Avoid 3000: Cursor often binds localhost:3000 for preview/tunnel (Express),
        // which returns {"error":"Not Found"} and never reaches Vite.
        port: 5173,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'frontend'),
          '@backend': path.resolve(__dirname, 'backend'),
          '@tests': path.resolve(__dirname, 'tests'),
          '@root': path.resolve(__dirname, '.'),
        }
      }
    };
});
