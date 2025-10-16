import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for Parquet integration tests
 *
 * Tests parquet-wasm (writer) and hyparquet (reader) integration
 * for Cloudflare Workers R2 storage pipeline.
 */
export default defineConfig({
  test: {
    // Include Parquet test files
    include: ['tests/parquet-integration.test.js'],

    // Environment
    environment: 'node', // Required for WASM and Buffer support

    // Timeouts for WASM operations
    testTimeout: 15000, // 15 seconds for large dataset tests
    hookTimeout: 10000,

    // Reporters
    reporters: ['verbose'],

    // Coverage (optional)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/parquet-writer.js', 'src/lib/r2-client.js'],
      exclude: ['tests/**', 'node_modules/**']
    },

    // Globals
    globals: true,

    // Parallel execution
    pool: 'forks', // Use forks for WASM isolation
    poolOptions: {
      forks: {
        singleFork: false
      }
    }
  }
});
