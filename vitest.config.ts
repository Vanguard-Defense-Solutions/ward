import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['packages/**/*.test.ts'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@ward/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
});
