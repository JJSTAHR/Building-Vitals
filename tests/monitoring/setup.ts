/**
 * Test setup for monitoring tests
 * Configures testing environment and global mocks
 */

import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock performance.memory API if not available
if (typeof (global as any).performance === 'undefined') {
  (global as any).performance = {
    now: () => Date.now(),
    memory: {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
    },
  };
}

// Mock requestAnimationFrame
if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  };
}

if (typeof global.cancelAnimationFrame === 'undefined') {
  global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };
}

// Mock IntersectionObserver
if (typeof global.IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  } as any;
}

// Mock ResizeObserver
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  } as any;
}

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress expected error/warning messages in tests
  console.error = (...args: any[]) => {
    if (
      args[0]?.includes?.('Not implemented: HTMLFormElement.prototype.submit') ||
      args[0]?.includes?.('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  console.warn = (...args: any[]) => {
    if (args[0]?.includes?.('componentWillReceiveProps')) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Extend expect with custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});

// Type augmentation for custom matchers
declare module 'vitest' {
  interface Assertion {
    toBeWithinRange(floor: number, ceiling: number): void;
  }
}
