import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/dist/**', '**/node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@solar-code/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      '@solar-code/engine': new URL('./packages/engine/src/index.ts', import.meta.url).pathname,
      '@solar-code/agents': new URL('./packages/agents/src/index.ts', import.meta.url).pathname,
      '@solar-code/skills': new URL('./packages/skills/src/index.ts', import.meta.url).pathname,
    },
  },
});
