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
    name: 'system',
    environment: 'jsdom',
    setupFiles: [path.resolve(rootDir, 'tests/setup/setup.ts')],
    include: ['tests/system/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
