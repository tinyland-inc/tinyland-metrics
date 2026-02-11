import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tinyland-metrics',
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
  },
});
