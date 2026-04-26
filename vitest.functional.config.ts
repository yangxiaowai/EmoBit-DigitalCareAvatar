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
    name: 'functional',
    environment: 'jsdom',
    setupFiles: ['tests/setup/setup.ts'],
    include: [
      'tests/functional/**/*.{test,spec}.tsx',
      'tests/real/**/*.test.ts',
    ],
    exclude: ['tests/system/**', 'node_modules/**', 'dist/**'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
