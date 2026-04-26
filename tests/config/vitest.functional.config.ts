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
    name: 'functional',
    environment: 'jsdom',
    setupFiles: [path.resolve(rootDir, 'tests/setup/setup.ts')],
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
