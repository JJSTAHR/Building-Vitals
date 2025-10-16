/**
 * Vitest Configuration for Integration Tests
 *
 * Specialized configuration for integration tests with:
 * - Longer timeouts for complex operations
 * - Sequential execution for consistent results
 * - Integration-specific setup files
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Integration test patterns
    include: ['**/integration-tests/**/*.integration.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
    ],

    // Test environment
    environment: 'jsdom',
    globals: true,

    // Setup files
    setupFiles: [
      'src/integration-tests/setup.ts',
    ],

    // Longer timeouts for integration tests
    testTimeout: 30000, // 30 seconds
    hookTimeout: 30000,

    // Sequential execution for integration tests
    sequence: {
      shuffle: false, // Run in order
      concurrent: false, // One test at a time
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/integration',
      include: [
        'src/services/token/**/*.ts',
        'src/services/auth/**/*.ts',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.integration.test.ts',
        'src/integration-tests/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // Reporter configuration
    reporters: ['verbose'],

    // Isolation
    isolate: true,

    // Mock configuration
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    // Performance
    poolOptions: {
      threads: {
        singleThread: true, // Single thread for integration tests
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'axios',
      'axios-mock-adapter',
      'fake-indexeddb',
    ],
  },
});
