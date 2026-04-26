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
    name: 'unit',
    environment: 'node',
    include: [
      'tests/unit/**/*.{test,spec}.{ts,js}',
    ],
    exclude: [
      '**/*.{test,spec}.tsx',
      'node_modules/**',
      'dist/**',
    ],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
