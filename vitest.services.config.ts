# Vitest configuration for microservices tests

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'services/**/*.test.ts',
      'services/**/*.spec.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: 'coverage/services',
      include: [
        'services/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/node_modules/**',
        '**/dist/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
