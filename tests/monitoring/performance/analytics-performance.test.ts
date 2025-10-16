/**
 * Analytics Performance Benchmarks
 * Measures analytics overhead and performance characteristics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockWorkerEnv } from '../mocks/analytics-engine-mock';
import { generateMockAnalyticsEvents } from '../fixtures/analytics-fixtures';

describe('Analytics Performance Benchmarks', () => {
  let mockEnv: ReturnType<typeof createMockWorkerEnv>;

  beforeEach(() => {
    mockEnv = createMockWorkerEnv();
  });

  afterEach(() => {
    mockEnv.ANALYTICS.clearAll();
  });

  describe('Write Performance', () => {
    it('should write 1000 data points under 100ms', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: ['GET', `/api/test/${i}`, '200'],
          indexes: [Math.random() * 1000, 200],
          doubles: [Math.random() * 2048, Math.random() * 100],
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
      expect(mockEnv.ANALYTICS.getDataset('requests').getDataPoints()).toHaveLength(iterations);

      console.log(`✓ Wrote ${iterations} data points in ${duration.toFixed(2)}ms`);
      console.log(`  Average: ${(duration / iterations).toFixed(4)}ms per write`);
    });

    it('should write 10000 data points under 500ms', () => {
      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: ['GET', `/api/test/${i}`, '200'],
          indexes: [Math.random() * 1000, 200],
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);

      console.log(`✓ Wrote ${iterations} data points in ${duration.toFixed(2)}ms`);
      console.log(`  Throughput: ${(iterations / duration * 1000).toFixed(0)} writes/sec`);
    });

    it('should handle batch writes efficiently', () => {
      const batchSize = 100;
      const batches = 10;
      const events = generateMockAnalyticsEvents(batchSize);

      const startTime = performance.now();

      for (let b = 0; b < batches; b++) {
        events.forEach(event => {
          mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
            blobs: event.blobs,
            indexes: event.indexes,
            doubles: event.doubles,
          });
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const totalWrites = batchSize * batches;

      expect(duration).toBeLessThan(200);
      expect(mockEnv.ANALYTICS.getDataset('requests').getDataPoints()).toHaveLength(totalWrites);

      console.log(`✓ Wrote ${batches} batches (${totalWrites} total) in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Query Performance', () => {
    beforeEach(() => {
      // Populate with test data
      const events = generateMockAnalyticsEvents(10000);
      events.forEach(event => {
        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: event.blobs,
          indexes: event.indexes,
          doubles: event.doubles,
        });
      });
    });

    it('should query all data points under 50ms', () => {
      const startTime = performance.now();

      const results = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
      expect(results).toHaveLength(10000);

      console.log(`✓ Queried ${results.length} data points in ${duration.toFixed(2)}ms`);
    });

    it('should query with time filter under 100ms', () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      const startTime = performance.now();

      const results = mockEnv.ANALYTICS.getDataset('requests').query({
        startTime: oneHourAgo,
        endTime: now,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);

      console.log(`✓ Filtered query returned ${results.length} points in ${duration.toFixed(2)}ms`);
    });

    it('should query with limit under 10ms', () => {
      const limit = 100;

      const startTime = performance.now();

      const results = mockEnv.ANALYTICS.getDataset('requests').query({ limit });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
      expect(results).toHaveLength(limit);

      console.log(`✓ Limited query (${limit}) completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Aggregation Performance', () => {
    beforeEach(() => {
      // Populate with test data
      for (let i = 0; i < 10000; i++) {
        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: ['GET', `/api/test/${i % 100}`, i % 10 === 0 ? '500' : '200'],
          indexes: [Math.random() * 1000 + 50, i % 10 === 0 ? 500 : 200],
          doubles: [Math.random() * 2048, Math.random() * 100],
        });
      }
    });

    it('should calculate basic statistics under 50ms', () => {
      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();

      const startTime = performance.now();

      const totalRequests = dataPoints.length;
      const errorCount = dataPoints.filter(dp => dp.indexes?.[1] !== 200).length;
      const durations = dataPoints.map(dp => dp.indexes?.[0] || 0);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
      expect(totalRequests).toBe(10000);
      expect(errorCount).toBeGreaterThan(0);

      console.log(`✓ Calculated statistics for ${totalRequests} points in ${duration.toFixed(2)}ms`);
      console.log(`  Error rate: ${(errorCount / totalRequests * 100).toFixed(2)}%`);
      console.log(`  Avg duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Min/Max: ${minDuration.toFixed(2)}ms / ${maxDuration.toFixed(2)}ms`);
    });

    it('should calculate percentiles under 100ms', () => {
      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();
      const durations = dataPoints.map(dp => dp.indexes?.[0] || 0);

      const startTime = performance.now();

      const sorted = [...durations].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p75 = sorted[Math.floor(sorted.length * 0.75)];
      const p90 = sorted[Math.floor(sorted.length * 0.9)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);

      console.log(`✓ Calculated percentiles in ${duration.toFixed(2)}ms`);
      console.log(`  P50: ${p50.toFixed(2)}ms`);
      console.log(`  P75: ${p75.toFixed(2)}ms`);
      console.log(`  P90: ${p90.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);
      console.log(`  P99: ${p99.toFixed(2)}ms`);
    });

    it('should group by time window under 100ms', () => {
      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();

      const startTime = performance.now();

      const windowSize = 300000; // 5 minutes
      const windows = new Map<number, number>();

      dataPoints.forEach(dp => {
        const window = Math.floor(dp.timestamp / windowSize) * windowSize;
        windows.set(window, (windows.get(window) || 0) + 1);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);

      console.log(`✓ Grouped ${dataPoints.length} points into ${windows.size} windows in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Overhead', () => {
    it('should track memory usage for large datasets', () => {
      if (typeof performance.memory === 'undefined') {
        console.log('⚠ Memory API not available in this environment');
        return;
      }

      const initialMemory = (performance as any).memory.usedJSHeapSize;

      // Add 50000 data points
      for (let i = 0; i < 50000; i++) {
        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: ['GET', `/api/test/${i}`, '200'],
          indexes: [Math.random() * 1000, 200],
          doubles: [Math.random() * 2048, Math.random() * 100],
        });
      }

      const finalMemory = (performance as any).memory.usedJSHeapSize;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`✓ Memory increase for 50k data points: ${memoryIncrease.toFixed(2)}MB`);
      console.log(`  Avg per data point: ${(memoryIncrease / 50).toFixed(4)}MB`);

      // Should use less than 50MB for 50k points
      expect(memoryIncrease).toBeLessThan(50);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent writes efficiently', async () => {
      const concurrentWrites = 1000;

      const startTime = performance.now();

      const promises = Array.from({ length: concurrentWrites }, (_, i) =>
        Promise.resolve().then(() => {
          mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
            blobs: ['GET', `/api/concurrent/${i}`, '200'],
            indexes: [Math.random() * 1000, 200],
          });
        })
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();

      expect(dataPoints).toHaveLength(concurrentWrites);
      expect(duration).toBeLessThan(200);

      console.log(`✓ ${concurrentWrites} concurrent writes completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle mixed read/write operations', async () => {
      // Pre-populate
      for (let i = 0; i < 1000; i++) {
        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: ['GET', `/api/test/${i}`, '200'],
          indexes: [Math.random() * 1000, 200],
        });
      }

      const operations = 1000;
      const startTime = performance.now();

      const promises = Array.from({ length: operations }, (_, i) => {
        if (i % 2 === 0) {
          // Write
          return Promise.resolve().then(() => {
            mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
              blobs: ['POST', `/api/test/${i}`, '201'],
              indexes: [Math.random() * 1000, 201],
            });
          });
        } else {
          // Read
          return Promise.resolve().then(() => {
            mockEnv.ANALYTICS.getDataset('requests').query({ limit: 10 });
          });
        }
      });

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(300);

      console.log(`✓ ${operations} mixed operations completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Dashboard Render Performance', () => {
    it('should measure query time for dashboard metrics', () => {
      // Populate with realistic data
      for (let i = 0; i < 10000; i++) {
        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: ['GET', `/api/test/${i % 100}`, i % 20 === 0 ? '500' : '200'],
          indexes: [Math.random() * 2000 + 50, i % 20 === 0 ? 500 : 200],
          doubles: [Math.random() * 4096, Math.random() * 100],
        });
      }

      const startTime = performance.now();

      // Simulate dashboard metrics calculation
      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();
      const totalRequests = dataPoints.length;
      const errors = dataPoints.filter(dp => dp.indexes?.[1] !== 200);
      const errorRate = (errors.length / totalRequests) * 100;

      const durations = dataPoints.map(dp => dp.indexes?.[0] || 0);
      const sorted = [...durations].sort((a, b) => a - b);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const p95Duration = sorted[Math.floor(sorted.length * 0.95)];

      const payloads = dataPoints.map(dp => dp.doubles?.[0] || 0);
      const totalPayload = payloads.reduce((a, b) => a + b, 0);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Dashboard should render metrics in under 200ms
      expect(duration).toBeLessThan(200);

      console.log(`✓ Dashboard metrics calculated in ${duration.toFixed(2)}ms`);
      console.log(`  Total Requests: ${totalRequests}`);
      console.log(`  Error Rate: ${errorRate.toFixed(2)}%`);
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`  P95 Duration: ${p95Duration.toFixed(2)}ms`);
      console.log(`  Total Payload: ${(totalPayload / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Real-world Load Simulation', () => {
    it('should handle typical production load', async () => {
      // Simulate 1 hour of traffic (1000 req/min = 60k requests)
      const requestsPerMinute = 1000;
      const minutes = 60;
      const totalRequests = requestsPerMinute * minutes;

      console.log(`Simulating ${minutes} minutes at ${requestsPerMinute} req/min...`);

      const startTime = performance.now();

      for (let i = 0; i < totalRequests; i++) {
        const statusCode = Math.random() < 0.98 ? 200 : 500; // 98% success rate

        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: [
            'GET',
            `/api/endpoint/${i % 20}`,
            statusCode.toString(),
            `user-${i % 1000}`,
            `corr-${i}`,
          ],
          indexes: [
            Math.random() * 500 + 50, // 50-550ms response time
            statusCode,
          ],
          doubles: [
            Math.random() * 2048, // 0-2KB payload
            Math.random() * 100, // Cache hit rate
          ],
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle in under 10 seconds
      expect(duration).toBeLessThan(10000);

      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();
      expect(dataPoints).toHaveLength(totalRequests);

      console.log(`✓ Processed ${totalRequests} requests in ${duration.toFixed(2)}ms`);
      console.log(`  Throughput: ${(totalRequests / duration * 1000).toFixed(0)} req/sec`);
      console.log(`  Average latency: ${(duration / totalRequests).toFixed(4)}ms per request`);
    });
  });
});
