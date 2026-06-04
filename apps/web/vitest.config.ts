import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@denkkern/types':       resolve(__dirname, '../../packages/types/src/index.ts'),
      '@denkkern/engine':      resolve(__dirname, '../../packages/engine/src/index.ts'),
      '@denkkern/intelligence': resolve(__dirname, '../../packages/intelligence/src/index.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    // Include only lib tests — exclude Next.js app routes (they require Next.js mocks)
    include: ['src/lib/**/*.test.ts'],
  },
});
