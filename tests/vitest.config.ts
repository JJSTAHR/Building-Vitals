/**
 * Vitest Configuration
 * Configuration for running the test suite
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global test setup
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/fixtures/',
        'tests/test-utils.ts',
        '**/*.config.ts',
        '**/*.d.ts'
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      }
    },

    // Test file patterns
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/', 'dist/'],

    // Test timeout
    testTimeout: 10000,

    // Reporters
    reporters: ['verbose'],

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // Mock configuration
    mockReset: true,
    restoreMocks: true,

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  }
});
