/**
 * Test Helper Functions
 * Utility functions for monitoring tests
 */

/**
 * Wait for a specific condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  options?: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  }
): Promise<void> {
  const timeout = options?.timeout || 5000;
  const interval = options?.interval || 50;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkCondition = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime >= timeout) {
        reject(new Error(options?.errorMessage || 'Condition not met within timeout'));
      } else {
        setTimeout(checkCondition, interval);
      }
    };

    checkCondition();
  });
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  return {
    result,
    duration: endTime - startTime,
  };
}

/**
 * Generate random data within range
 */
export function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generate random integer within range
 */
export function randomIntInRange(min: number, max: number): number {
  return Math.floor(randomInRange(min, max));
}

/**
 * Calculate percentile from sorted array
 */
export function percentile(sortedArray: number[], p: number): number {
  const index = Math.ceil((sortedArray.length * p) / 100) - 1;
  return sortedArray[Math.max(0, index)];
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Create a deferred promise
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  }
): Promise<T> {
  const maxAttempts = options?.maxAttempts || 3;
  const initialDelay = options?.initialDelay || 100;
  const maxDelay = options?.maxDelay || 5000;
  const backoffMultiplier = options?.backoffMultiplier || 2;

  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= maxAttempts) {
        throw error;
      }
      await sleep(Math.min(delay, maxDelay));
      delay *= backoffMultiplier;
    }
  }

  throw new Error('Max retry attempts reached');
}

/**
 * Batch operations
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Create a mock timer that can be controlled
 */
export class MockTimer {
  private currentTime = 0;
  private callbacks: Array<{ time: number; callback: () => void }> = [];

  now(): number {
    return this.currentTime;
  }

  advance(ms: number): void {
    this.currentTime += ms;
    this.processPendingCallbacks();
  }

  setTimeout(callback: () => void, delay: number): number {
    const id = this.callbacks.length;
    this.callbacks.push({
      time: this.currentTime + delay,
      callback,
    });
    return id;
  }

  clearTimeout(id: number): void {
    delete this.callbacks[id];
  }

  private processPendingCallbacks(): void {
    const ready = this.callbacks.filter(cb => cb && cb.time <= this.currentTime);
    ready.forEach(cb => {
      if (cb) {
        cb.callback();
      }
    });

    this.callbacks = this.callbacks.filter(cb => cb && cb.time > this.currentTime);
  }
}

/**
 * Assert that a value is within a percentage of expected
 */
export function assertWithinPercentage(
  actual: number,
  expected: number,
  percentage: number,
  message?: string
): void {
  const tolerance = Math.abs(expected * (percentage / 100));
  const min = expected - tolerance;
  const max = expected + tolerance;

  if (actual < min || actual > max) {
    throw new Error(
      message ||
        `Expected ${actual} to be within ${percentage}% of ${expected} (range: ${min} - ${max})`
    );
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}
