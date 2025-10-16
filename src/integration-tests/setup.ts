/**
 * Integration Test Setup
 *
 * Configures the test environment for integration tests including:
 * - Mock API server
 * - Test database setup
 * - Global test utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupMockAPIServer } from './mocks/apiServer';
import type { MockAdapter } from 'axios-mock-adapter';

// Global test state
let mockServer: MockAdapter;

// Setup before all tests
beforeAll(() => {
  // Setup mock API server
  mockServer = setupMockAPIServer();

  // Setup test environment variables
  process.env.VITE_DEFAULT_TOKEN_FALLS_CITY = 'test_default_token_falls_city';
  process.env.VITE_DEFAULT_TOKEN_LINCOLN = 'test_default_token_lincoln';
  process.env.VITE_DEFAULT_TOKEN_PLATTSMOUTH = 'test_default_token_plattsmouth';

  // Mock IndexedDB if not available
  if (typeof indexedDB === 'undefined') {
    global.indexedDB = require('fake-indexeddb');
    global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
  }
});

// Cleanup after all tests
afterAll(() => {
  if (mockServer) {
    mockServer.restore();
  }
});

// Reset state before each test
beforeEach(() => {
  // Clear localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }

  // Reset mock server
  if (mockServer) {
    mockServer.reset();
  }
});

// Cleanup after each test
afterEach(() => {
  // Clear any pending timers
  vi.clearAllTimers();
});

// Export global test utilities
export const testUtils = {
  getMockServer: () => mockServer,

  // Generate test tokens
  generateValidToken: (siteId: string) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: siteId,
      iat: now,
      exp: now + 3600, // 1 hour from now
    };
    return `header.${btoa(JSON.stringify(payload))}.signature`;
  },

  generateExpiredToken: (siteId: string) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: siteId,
      iat: now - 7200,
      exp: now - 3600, // Expired 1 hour ago
    };
    return `header.${btoa(JSON.stringify(payload))}.signature`;
  },

  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock Firestore operations
  mockFirestore: {
    users: new Map<string, any>(),

    async getDoc(userId: string) {
      return this.users.get(userId) || null;
    },

    async setDoc(userId: string, data: any) {
      this.users.set(userId, data);
    },

    async deleteDoc(userId: string) {
      this.users.delete(userId);
    },

    clear() {
      this.users.clear();
    },
  },
};

export default testUtils;
