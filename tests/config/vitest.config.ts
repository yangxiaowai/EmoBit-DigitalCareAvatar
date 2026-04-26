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
    environment: 'jsdom',
    setupFiles: [path.resolve(rootDir, 'tests/setup/setup.ts')],
    include: ['**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
