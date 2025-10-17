/**
 * Token Test Helpers
 * Utility functions for testing token services
 */

import { vi } from 'vitest';

/**
 * Mock IndexedDB for testing
 */
export class MockIndexedDB {
  private databases: Map<string, Map<string, any>> = new Map();

  open(dbName: string): Promise<IDBDatabase> {
    if (!this.databases.has(dbName)) {
      this.databases.set(dbName, new Map());
    }

    return Promise.resolve({
      name: dbName,
      version: 1,
      objectStoreNames: ['tokens'],
      transaction: (storeName: string, mode: IDBTransactionMode) => {
        return this.createMockTransaction(dbName, storeName, mode);
      },
      close: vi.fn(),
    } as unknown as IDBDatabase);
  }

  private createMockTransaction(
    dbName: string,
    storeName: string,
    mode: IDBTransactionMode
  ) {
    const store = this.databases.get(dbName) || new Map();

    return {
      objectStore: () => ({
        get: (key: string) => this.createMockRequest(store.get(key)),
        put: (value: any) => {
          store.set(value.siteId, value);
          return this.createMockRequest(value);
        },
        delete: (key: string) => {
          store.delete(key);
          return this.createMockRequest(undefined);
        },
        clear: () => {
          store.clear();
          return this.createMockRequest(undefined);
        },
        getAll: () => this.createMockRequest(Array.from(store.values())),
        openCursor: () => this.createMockCursor(store),
      }),
      oncomplete: null,
      onerror: null,
      onabort: null,
    };
  }

  private createMockRequest(result: any) {
    return {
      result,
      onsuccess: null,
      onerror: null,
      readyState: 'done',
    };
  }

  private createMockCursor(store: Map<string, any>) {
    const entries = Array.from(store.entries());
    let index = 0;

    return {
      result: index < entries.length ? {
        key: entries[index][0],
        value: entries[index][1],
        continue: () => { index++; },
      } : null,
      onsuccess: null,
      onerror: null,
    };
  }

  clear() {
    this.databases.clear();
  }
}

/**
 * Mock localStorage for testing
 */
export class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }
}

/**
 * Mock EventEmitter for testing
 */
export class MockEventEmitter {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(...args));
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}

/**
 * Mock axios for API testing
 */
export function createMockAxios() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn(),
        eject: vi.fn(),
      },
      response: {
        use: vi.fn(),
        eject: vi.fn(),
      },
    },
  };
}

/**
 * Wait for async operations to complete
 */
export function waitForAsync(ms: number = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise for testing
 */
export function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Mock encryption service
 */
export class MockEncryptionService {
  async encrypt(data: string, userId: string): Promise<string> {
    return `encrypted_${data}_${userId}`;
  }

  async decrypt(encryptedData: string, userId: string): Promise<string> {
    return encryptedData.replace(`encrypted_`, '').replace(`_${userId}`, '');
  }

  async hashToken(token: string): Promise<string> {
    return `hash_${token}`;
  }

  secureCompare(a: string, b: string): boolean {
    return a === b;
  }
}

/**
 * Setup test environment
 */
export function setupTestEnvironment() {
  const mockIndexedDB = new MockIndexedDB();
  const mockLocalStorage = new MockLocalStorage();
  const mockEncryption = new MockEncryptionService();

  // Mock global objects
  global.indexedDB = {
    open: (name: string) => mockIndexedDB.open(name),
  } as any;

  global.localStorage = mockLocalStorage as any;

  // Mock Web Crypto API - only set if not already defined
  if (typeof global.crypto === 'undefined' || !global.crypto) {
    Object.defineProperty(global, 'crypto', {
      value: {
        subtle: {
          encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
          decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
          digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
          generateKey: vi.fn(),
          deriveKey: vi.fn(),
        },
        getRandomValues: (array: any) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
          }
          return array;
        },
      },
      writable: true,
      configurable: true,
    });
  }

  // Mock navigator.storage
  global.navigator = {
    ...global.navigator,
    storage: {
      estimate: vi.fn().mockResolvedValue({
        usage: 1024 * 1024, // 1MB
        quota: 100 * 1024 * 1024, // 100MB
      }),
    },
  } as any;

  return {
    mockIndexedDB,
    mockLocalStorage,
    mockEncryption,
    cleanup: () => {
      mockIndexedDB.clear();
      mockLocalStorage.clear();
    },
  };
}

/**
 * Performance measurement helper
 */
export class PerformanceTimer {
  private startTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    return performance.now() - this.startTime;
  }

  async measure<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    this.start();
    const result = await fn();
    const duration = this.end();
    return { result, duration };
  }
}

/**
 * Create a spy that tracks call order
 */
export function createOrderedSpy() {
  const calls: Array<{ method: string; args: any[]; timestamp: number }> = [];

  return {
    record: (method: string, ...args: any[]) => {
      calls.push({ method, args, timestamp: Date.now() });
    },
    getCalls: () => calls,
    getCallOrder: () => calls.map(c => c.method),
    clear: () => calls.length = 0,
  };
}

/**
 * Assert that operations happen in order
 */
export function expectCallOrder(spy: ReturnType<typeof createOrderedSpy>, expected: string[]) {
  const actual = spy.getCallOrder();
  expect(actual).toEqual(expected);
}
