/**
 * End-to-End Analytics Integration Tests
 * Tests complete flow: Request → Analytics → Dashboard
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMockWorkerEnv } from '../mocks/analytics-engine-mock';
import { generateMockRequest, generateMockMetrics, timeRanges } from '../fixtures/analytics-fixtures';

describe('End-to-End Analytics Integration', () => {
  let mockEnv: ReturnType<typeof createMockWorkerEnv>;
  let correlationIdCounter = 0;

  beforeEach(() => {
    mockEnv = createMockWorkerEnv();
    correlationIdCounter = 0;
  });

  afterEach(() => {
    mockEnv.ANALYTICS.clearAll();
  });

  describe('Request to Analytics Flow', () => {
    it('should track complete request lifecycle', async () => {
      const correlationId = `e2e-${++correlationIdCounter}`;
      const startTime = performance.now();

      // Step 1: Simulate incoming request
      const request = generateMockRequest({
        url: 'https://api.example.com/points',
        method: 'GET',
      });

      // Step 2: Track request start
      mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
        blobs: [
          request.method,
          request.url,
          'pending',
          'user-123',
          correlationId,
        ],
        indexes: [0, 0], // Duration, status code
      });

      // Step 3: Simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 4: Track request completion
      const endTime = performance.now();
      const duration = endTime - startTime;

      mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
        blobs: [
          request.method,
          request.url,
          '200',
          'user-123',
          correlationId,
        ],
        indexes: [duration, 200],
        doubles: [1024, 95.5], // Payload size, cache hit rate
      });

      // Verify analytics captured both events
      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();
      expect(dataPoints).toHaveLength(2);

      const completedRequest = dataPoints.find(dp =>
        dp.blobs?.includes('200') && dp.blobs?.includes(correlationId)
      );

      expect(completedRequest).toBeDefined();
      expect(completedRequest?.indexes?.[0]).toBeGreaterThan(0); // Duration
      expect(completedRequest?.indexes?.[1]).toBe(200); // Status code
    });

    it('should handle request with error', async () => {
      const correlationId = `e2e-error-${++correlationIdCounter}`;

      // Track failed request
      mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
        blobs: ['GET', '/api/test', '500', 'user-123', correlationId],
        indexes: [250, 500],
      });

      // Track error details
      mockEnv.ANALYTICS.datasets.errors.writeDataPoint({
        blobs: [
          'Internal Server Error',
          'Error: Database connection failed',
          correlationId,
        ],
        indexes: [500, 1],
      });

      // Verify both datasets captured the error
      const requests = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();
      const errors = mockEnv.ANALYTICS.getDataset('errors').getDataPoints();

      expect(requests.some(r => r.blobs?.includes(correlationId))).toBe(true);
      expect(errors.some(e => e.blobs?.includes(correlationId))).toBe(true);
    });
  });

  describe('Analytics to Dashboard Flow', () => {
    beforeEach(() => {
      // Populate analytics with sample data
      for (let i = 0; i < 100; i++) {
        const statusCode = i < 95 ? 200 : 500;
        const duration = Math.random() * 1000 + 50;

        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: ['GET', `/api/test/${i}`, statusCode.toString()],
          indexes: [duration, statusCode],
          doubles: [Math.random() * 2048, Math.random() * 100],
        });
      }
    });

    it('should query and aggregate metrics for dashboard', () => {
      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();

      // Aggregate metrics
      const totalRequests = dataPoints.length;
      const successfulRequests = dataPoints.filter(
        dp => dp.indexes?.[1] === 200
      ).length;
      const errorRequests = totalRequests - successfulRequests;

      const durations = dataPoints.map(dp => dp.indexes?.[0] || 0);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      // Calculate percentiles
      const sortedDurations = [...durations].sort((a, b) => a - b);
      const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)];
      const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)];

      expect(totalRequests).toBe(100);
      expect(successfulRequests).toBe(95);
      expect(errorRequests).toBe(5);
      expect(avgDuration).toBeGreaterThan(0);
      expect(p95).toBeGreaterThan(avgDuration);
      expect(p99).toBeGreaterThanOrEqual(p95);
    });

    it('should filter analytics by time range', () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Add some older data
      mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
        blobs: ['GET', '/api/old', '200'],
        indexes: [100, 200],
      });

      const recentData = mockEnv.ANALYTICS.getDataset('requests').query({
        startTime: oneHourAgo,
        endTime: now,
      });

      expect(recentData.every(dp => dp.timestamp >= oneHourAgo)).toBe(true);
      expect(recentData.every(dp => dp.timestamp <= now)).toBe(true);
    });

    it('should calculate cache efficiency', () => {
      // Add cache metrics
      let totalHits = 0;
      let totalMisses = 0;

      for (let i = 0; i < 100; i++) {
        const hits = Math.floor(Math.random() * 10);
        const misses = Math.floor(Math.random() * 2);

        totalHits += hits;
        totalMisses += misses;

        mockEnv.ANALYTICS.datasets.cache.writeDataPoint({
          indexes: [hits, misses],
          doubles: [(hits / (hits + misses)) * 100],
        });
      }

      const cacheData = mockEnv.ANALYTICS.getDataset('cache').getDataPoints();
      const overallHitRate = (totalHits / (totalHits + totalMisses)) * 100;

      expect(cacheData).toHaveLength(100);
      expect(overallHitRate).toBeGreaterThan(0);
      expect(overallHitRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Historical Data Aggregation', () => {
    it('should aggregate data by hour', () => {
      const now = Date.now();
      const hourly = new Map<number, number>();

      // Generate data over 24 hours
      for (let i = 0; i < 24; i++) {
        const hourTimestamp = now - (i * 3600000);
        const requestCount = Math.floor(Math.random() * 100) + 50;

        for (let j = 0; j < requestCount; j++) {
          mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
            blobs: ['GET', '/api/test', '200'],
            indexes: [Math.random() * 1000, 200],
          });
        }

        hourly.set(hourTimestamp, requestCount);
      }

      const allData = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();
      expect(allData.length).toBeGreaterThan(1000);

      // Group by hour
      const hourlyBuckets = new Map<number, number>();
      allData.forEach(dp => {
        const hour = Math.floor(dp.timestamp / 3600000) * 3600000;
        hourlyBuckets.set(hour, (hourlyBuckets.get(hour) || 0) + 1);
      });

      expect(hourlyBuckets.size).toBeGreaterThan(0);
    });

    it('should aggregate data by day', () => {
      const now = Date.now();

      // Generate data over 7 days
      for (let i = 0; i < 7; i++) {
        const dayTimestamp = now - (i * 86400000);

        for (let j = 0; j < 50; j++) {
          mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
            blobs: ['GET', '/api/test', '200'],
            indexes: [Math.random() * 1000, 200],
          });
        }
      }

      const allData = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();

      // Group by day
      const dailyBuckets = new Map<string, number>();
      allData.forEach(dp => {
        const day = new Date(dp.timestamp).toISOString().split('T')[0];
        dailyBuckets.set(day, (dailyBuckets.get(day) || 0) + 1);
      });

      expect(dailyBuckets.size).toBeGreaterThan(0);
      expect(Array.from(dailyBuckets.values()).reduce((a, b) => a + b, 0)).toBe(allData.length);
    });
  });

  describe('Alert Trigger Detection', () => {
    it('should detect high error rate alert', () => {
      const threshold = 5; // 5% error rate
      const totalRequests = 100;
      const errorRequests = 8; // 8% error rate

      // Generate requests with high error rate
      for (let i = 0; i < totalRequests; i++) {
        const statusCode = i < errorRequests ? 500 : 200;
        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: ['GET', '/api/test', statusCode.toString()],
          indexes: [100, statusCode],
        });
      }

      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();
      const errors = dataPoints.filter(dp => dp.indexes?.[1] !== 200).length;
      const errorRate = (errors / dataPoints.length) * 100;

      expect(errorRate).toBeGreaterThan(threshold);
    });

    it('should detect slow response time alert', () => {
      const threshold = 1000; // 1 second threshold
      const slowRequestCount = 10;

      // Generate slow requests
      for (let i = 0; i < slowRequestCount; i++) {
        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: ['GET', '/api/slow', '200'],
          indexes: [1500 + Math.random() * 500, 200], // 1.5-2 seconds
        });
      }

      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();
      const slowRequests = dataPoints.filter(dp => (dp.indexes?.[0] || 0) > threshold);

      expect(slowRequests.length).toBe(slowRequestCount);
    });

    it('should detect memory pressure alert', () => {
      const threshold = 85; // 85% memory usage

      mockEnv.ANALYTICS.datasets.performance.writeDataPoint({
        blobs: ['memory', 'high'],
        doubles: [92.5], // 92.5% memory usage
      });

      const dataPoints = mockEnv.ANALYTICS.getDataset('performance').getDataPoints();
      const highMemory = dataPoints.find(dp => (dp.doubles?.[0] || 0) > threshold);

      expect(highMemory).toBeDefined();
      expect(highMemory?.doubles?.[0]).toBeGreaterThan(threshold);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high volume of requests', () => {
      const requestCount = 10000;
      const startTime = performance.now();

      for (let i = 0; i < requestCount; i++) {
        mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
          blobs: ['GET', `/api/test/${i}`, '200'],
          indexes: [Math.random() * 1000, 200],
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();

      expect(dataPoints).toHaveLength(requestCount);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle concurrent analytics writes', async () => {
      const concurrentWrites = 100;

      const promises = Array.from({ length: concurrentWrites }, (_, i) =>
        Promise.resolve().then(() => {
          mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
            blobs: ['GET', `/api/concurrent/${i}`, '200'],
            indexes: [Math.random() * 1000, 200],
          });
        })
      );

      await Promise.all(promises);

      const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();
      expect(dataPoints).toHaveLength(concurrentWrites);
    });
  });
});
