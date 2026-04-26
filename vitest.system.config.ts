import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'frontend'),
      '@backend': path.resolve(__dirname, 'backend'),
      '@tests': path.resolve(__dirname, 'tests'),
      '@root': path.resolve(__dirname, '.'),
    },
  },
  test: {
    name: 'system',
    environment: 'jsdom',
    setupFiles: ['tests/setup/setup.ts'],
    include: ['tests/system/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
