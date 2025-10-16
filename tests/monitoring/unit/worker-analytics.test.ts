/**
 * Worker Analytics Tests
 * Tests analytics middleware, metrics collection, and error tracking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMockAnalyticsEngine, createMockWorkerEnv } from '../mocks/analytics-engine-mock';
import {
  generateMockAnalyticsEvents,
  generateMockRequest,
  errorScenarios,
  performanceMarkers,
  cacheScenarios,
} from '../fixtures/analytics-fixtures';

describe('Worker Analytics Middleware', () => {
  let mockEnv: ReturnType<typeof createMockWorkerEnv>;
  let mockAnalytics: ReturnType<typeof createMockAnalyticsEngine>;

  beforeEach(() => {
    mockEnv = createMockWorkerEnv();
    mockAnalytics = mockEnv.ANALYTICS;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    mockAnalytics.clearAll();
  });

  describe('Request Tracking', () => {
    it('should write analytics data point for successful request', () => {
      const request = generateMockRequest();
      const startTime = Date.now();

      // Simulate middleware execution
      mockAnalytics.datasets.requests.writeDataPoint({
        blobs: [
          request.method,
          request.url,
          '200',
          'test-user-id',
          'correlation-123',
        ],
        indexes: [
          100, // Response time
          200, // Status code
        ],
        doubles: [
          95.5, // Cache hit rate
          1024, // Payload size
        ],
      });

      const dataPoints = mockAnalytics.getDataset('requests').getDataPoints();

      expect(dataPoints).toHaveLength(1);
      expect(dataPoints[0]).toMatchObject({
        blobs: expect.arrayContaining([request.method, request.url, '200']),
        indexes: expect.arrayContaining([100, 200]),
        doubles: expect.arrayContaining([95.5, 1024]),
      });
      expect(dataPoints[0].timestamp).toBeGreaterThanOrEqual(startTime);
    });

    it('should track multiple concurrent requests', () => {
      const requestCount = 10;

      for (let i = 0; i < requestCount; i++) {
        mockAnalytics.datasets.requests.writeDataPoint({
          blobs: [`GET`, `/api/test/${i}`, '200'],
          indexes: [Math.random() * 1000, 200],
        });
      }

      const dataPoints = mockAnalytics.getDataset('requests').getDataPoints();
      expect(dataPoints).toHaveLength(requestCount);
    });

    it('should measure response time accurately', () => {
      const expectedDuration = 250;
      const startTime = performance.now();

      vi.advanceTimersByTime(expectedDuration);

      const endTime = performance.now();
      const actualDuration = endTime - startTime;

      mockAnalytics.datasets.requests.writeDataPoint({
        blobs: ['GET', '/api/test', '200'],
        indexes: [actualDuration, 200],
      });

      const dataPoints = mockAnalytics.getDataset('requests').getDataPoints();
      expect(dataPoints[0].indexes?.[0]).toBe(expectedDuration);
    });
  });

  describe('Error Tracking', () => {
    Object.entries(errorScenarios).forEach(([key, scenario]) => {
      it(`should track ${scenario.name} errors`, () => {
        mockAnalytics.datasets.errors.writeDataPoint({
          blobs: [
            scenario.error.message,
            scenario.error.stack || '',
            scenario.expectedMetrics.errorType,
          ],
          indexes: [
            scenario.expectedMetrics.statusCode,
            scenario.expectedMetrics.errorCount,
          ],
        });

        const dataPoints = mockAnalytics.getDataset('errors').getDataPoints();

        expect(dataPoints).toHaveLength(1);
        expect(dataPoints[0].blobs).toContain(scenario.error.message);
        expect(dataPoints[0].indexes).toContain(scenario.expectedMetrics.statusCode);
      });
    });

    it('should correlate errors with request IDs', () => {
      const correlationId = 'corr-12345';

      mockAnalytics.datasets.errors.writeDataPoint({
        blobs: [
          'Connection failed',
          'Error: Connection failed at line 123',
          correlationId,
        ],
        indexes: [500, 1],
      });

      const dataPoints = mockAnalytics.getDataset('errors').getDataPoints();
      expect(dataPoints[0].blobs).toContain(correlationId);
    });

    it('should track error frequency over time', () => {
      const errorCount = 5;
      const timeInterval = 1000;

      for (let i = 0; i < errorCount; i++) {
        vi.advanceTimersByTime(timeInterval);
        mockAnalytics.datasets.errors.writeDataPoint({
          blobs: ['Test error', 'stack trace', 'error_type'],
          indexes: [500, 1],
        });
      }

      const dataPoints = mockAnalytics.getDataset('errors').getDataPoints();
      expect(dataPoints).toHaveLength(errorCount);

      // Verify timestamps are spaced correctly
      for (let i = 1; i < dataPoints.length; i++) {
        const timeDiff = dataPoints[i].timestamp - dataPoints[i - 1].timestamp;
        expect(timeDiff).toBeGreaterThanOrEqual(timeInterval - 10); // Allow 10ms tolerance
      }
    });
  });

  describe('Performance Markers', () => {
    Object.entries(performanceMarkers).forEach(([key, marker]) => {
      it(`should categorize ${marker.name} correctly`, () => {
        mockAnalytics.datasets.performance.writeDataPoint({
          blobs: ['GET', '/api/test', marker.expectedCategory],
          doubles: [marker.duration],
        });

        const dataPoints = mockAnalytics.getDataset('performance').getDataPoints();
        expect(dataPoints[0].blobs).toContain(marker.expectedCategory);
        expect(dataPoints[0].doubles).toContain(marker.duration);
      });
    });

    it('should track performance percentiles', () => {
      const durations = [50, 100, 150, 200, 500, 1000, 1500, 2000, 2500, 3000];

      durations.forEach(duration => {
        mockAnalytics.datasets.performance.writeDataPoint({
          doubles: [duration],
        });
      });

      const dataPoints = mockAnalytics.getDataset('performance').getDataPoints();
      const recordedDurations = dataPoints.map(dp => dp.doubles?.[0] || 0);

      // Calculate percentiles
      const sorted = [...recordedDurations].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      expect(p50).toBe(500);
      expect(p95).toBe(3000);
      expect(p99).toBe(3000);
    });
  });

  describe('Cache Metrics', () => {
    Object.entries(cacheScenarios).forEach(([key, scenario]) => {
      it(`should track ${scenario.name} correctly`, () => {
        mockAnalytics.datasets.cache.writeDataPoint({
          blobs: [scenario.cacheKey],
          indexes: [
            scenario.expectedMetrics.cacheHits,
            scenario.expectedMetrics.cacheMisses,
          ],
        });

        const dataPoints = mockAnalytics.getDataset('cache').getDataPoints();
        expect(dataPoints[0].indexes).toEqual([
          scenario.expectedMetrics.cacheHits,
          scenario.expectedMetrics.cacheMisses,
        ]);
      });
    });

    it('should calculate cache hit rate', () => {
      const hits = 80;
      const misses = 20;
      const total = hits + misses;
      const expectedRate = (hits / total) * 100;

      mockAnalytics.datasets.cache.writeDataPoint({
        indexes: [hits, misses],
        doubles: [expectedRate],
      });

      const dataPoints = mockAnalytics.getDataset('cache').getDataPoints();
      expect(dataPoints[0].doubles?.[0]).toBe(expectedRate);
    });

    it('should track cache size and memory usage', () => {
      const cacheSize = 1024 * 1024; // 1MB
      const itemCount = 100;

      mockAnalytics.datasets.cache.writeDataPoint({
        indexes: [itemCount],
        doubles: [cacheSize],
      });

      const dataPoints = mockAnalytics.getDataset('cache').getDataPoints();
      expect(dataPoints[0].indexes).toContain(itemCount);
      expect(dataPoints[0].doubles).toContain(cacheSize);
    });
  });

  describe('Query and Aggregation', () => {
    beforeEach(() => {
      // Populate with test data
      const events = generateMockAnalyticsEvents(100);
      events.forEach(event => {
        mockAnalytics.datasets.requests.writeDataPoint({
          blobs: event.blobs,
          indexes: event.indexes,
          doubles: event.doubles,
        });
      });
    });

    it('should query data points by time range', () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      const results = mockAnalytics.getDataset('requests').query({
        startTime: oneHourAgo,
        endTime: now,
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.timestamp).toBeGreaterThanOrEqual(oneHourAgo);
        expect(result.timestamp).toBeLessThanOrEqual(now);
      });
    });

    it('should limit query results', () => {
      const limit = 10;
      const results = mockAnalytics.getDataset('requests').query({ limit });

      expect(results).toHaveLength(limit);
    });

    it('should aggregate metrics over time windows', () => {
      const dataPoints = mockAnalytics.getDataset('requests').getDataPoints();

      // Group by 5-minute windows
      const windowSize = 300000;
      const windows = new Map<number, number>();

      dataPoints.forEach(dp => {
        const window = Math.floor(dp.timestamp / windowSize) * windowSize;
        windows.set(window, (windows.get(window) || 0) + 1);
      });

      expect(windows.size).toBeGreaterThan(0);
      const totalCount = Array.from(windows.values()).reduce((a, b) => a + b, 0);
      expect(totalCount).toBe(dataPoints.length);
    });
  });

  describe('Analytics Overhead', () => {
    it('should write data points efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        mockAnalytics.datasets.requests.writeDataPoint({
          blobs: ['GET', `/api/test/${i}`, '200'],
          indexes: [Math.random() * 1000, 200],
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in under 100ms for 1000 writes
      expect(duration).toBeLessThan(100);
    });

    it('should handle batch writes', () => {
      const batchSize = 100;
      const events = generateMockAnalyticsEvents(batchSize);

      const startTime = performance.now();

      events.forEach(event => {
        mockAnalytics.datasets.requests.writeDataPoint({
          blobs: event.blobs,
          indexes: event.indexes,
          doubles: event.doubles,
        });
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50); // Should be very fast
      expect(mockAnalytics.getDataset('requests').getDataPoints()).toHaveLength(batchSize);
    });
  });
});
