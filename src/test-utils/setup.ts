/**
 * Vitest Setup File
 * Global test configuration and mocks
 */

import { vi, beforeAll, afterEach } from 'vitest';

// Suppress console warnings during tests
beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// Mock Web Crypto API (if not already available)
if (typeof global.crypto === 'undefined' || !global.crypto) {
  Object.defineProperty(global, 'crypto', {
    value: {
      subtle: {
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        generateKey: vi.fn(),
        deriveKey: vi.fn(),
        importKey: vi.fn(),
        exportKey: vi.fn(),
        sign: vi.fn(),
        verify: vi.fn(),
        deriveBits: vi.fn(),
        wrapKey: vi.fn(),
        unwrapKey: vi.fn(),
      },
      getRandomValues: (array: any) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substring(7),
    },
    writable: true,
    configurable: true,
  });
}

// Mock navigator.storage
if (typeof global.navigator === 'undefined') {
  global.navigator = {} as any;
}

Object.defineProperty(global.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  writable: true,
  configurable: true,
});

Object.defineProperty(global.navigator, 'storage', {
  value: {
    estimate: vi.fn().mockResolvedValue({
      usage: 1024 * 1024, // 1MB
      quota: 100 * 1024 * 1024, // 100MB
    }),
    persist: vi.fn().mockResolvedValue(true),
    persisted: vi.fn().mockResolvedValue(false),
  },
  writable: true,
  configurable: true,
});

// Mock performance API
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  } as any;
}

// Mock TextEncoder/TextDecoder
global.TextEncoder = class TextEncoder {
  encode(str: string): Uint8Array {
    return new Uint8Array([...str].map(c => c.charCodeAt(0)));
  }
} as any;

global.TextDecoder = class TextDecoder {
  decode(arr: Uint8Array): string {
    return String.fromCharCode(...arr);
  }
} as any;
