import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@denkkern/types': resolve(__dirname, '../types/src/index.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
  },
});
