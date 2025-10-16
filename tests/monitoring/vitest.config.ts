import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './setup.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'fixtures/',
        'mocks/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.d.ts',
        'vitest.config.ts',
      ],
      lines: 90,
      functions: 95,
      branches: 85,
      statements: 90,
      all: true,
    },
    include: [
      'unit/**/*.test.ts',
      'unit/**/*.test.tsx',
      'integration/**/*.test.ts',
      'performance/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist', 'e2e'],
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@test-utils': path.resolve(__dirname, '../test-utils'),
      '@monitoring': path.resolve(__dirname, './'),
    },
  },
});
