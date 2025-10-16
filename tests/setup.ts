/**
 * Test Setup
 * Global setup for all tests
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Setup before all tests
beforeAll(() => {
  // Set up any global test configuration
  console.log('Setting up test environment...');
});

// Cleanup after all tests
afterAll(() => {
  // Clean up any global resources
  console.log('Cleaning up test environment...');
});

// Reset before each test
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();

  // Mock fetch globally
  global.fetch = vi.fn();

  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Cleanup after each test
afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();
});

// Mock performance API if not available
if (typeof performance === 'undefined') {
  (global as any).performance = {
    now: () => Date.now()
  };
}

// Extend matchers if needed
expect.extend({
  toBeValidPoint(received: any) {
    const pass = received &&
      typeof received.Name === 'string' &&
      received.Name.length > 0;

    return {
      pass,
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to be a valid point`
          : `expected ${JSON.stringify(received)} to be a valid point with a Name`
    };
  },

  toHaveEnhancement(received: any) {
    const pass = received &&
      typeof received.display_name === 'string' &&
      received.display_name !== received.Name;

    return {
      pass,
      message: () =>
        pass
          ? `expected point not to have enhancement`
          : `expected point to have display_name different from Name`
    };
  },

  toPreserveOriginalName(received: any, originalName: string) {
    const pass = received && received.Name === originalName;

    return {
      pass,
      message: () =>
        pass
          ? `expected point not to preserve original name ${originalName}`
          : `expected point to preserve original name ${originalName}, got ${received?.Name}`
    };
  }
});

// Add TypeScript declarations for custom matchers
declare module 'vitest' {
  interface Assertion {
    toBeValidPoint(): void;
    toHaveEnhancement(): void;
    toPreserveOriginalName(originalName: string): void;
  }
}
