import { defineConfig } from 'vitest/config';
import path from 'path';

const rootDir = path.resolve(__dirname, '../..');

export default defineConfig({
  root: rootDir,
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'frontend'),
      '@backend': path.resolve(rootDir, 'backend'),
      '@tests': path.resolve(rootDir, 'tests'),
      '@root': rootDir,
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
