/**
 * Integration Tests for R2 Cache and Queue Services
 *
 * Tests cover:
 * - R2 cache operations (put, get, exists, cleanup)
 * - Queue job processing
 * - Enhanced timeseries routing
 * - Error handling
 * - Performance characteristics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment
const createMockEnv = () => ({
  ACE_API_URL: 'https://flightdeck.aceiot.cloud/api',
  TIMESERIES_CACHE: createMockR2Bucket(),
  CHART_QUEUE: createMockQueue(),
  DB: createMockD1(),
  ANALYTICS: createMockAnalytics(),
});

// Mock R2 Bucket
function createMockR2Bucket() {
  const storage = new Map();

  return {
    async put(key, data, options) {
      storage.set(key, {
        data,
        ...options,
        size: data.byteLength || data.length,
        uploaded: new Date(),
      });
    },

    async get(key) {
      const item = storage.get(key);
      if (!item) return null;

      return {
        ...item,
        arrayBuffer: async () => item.data,
        httpMetadata: item.httpMetadata || {},
        customMetadata: item.customMetadata || {},
      };
    },

    async head(key) {
      const item = storage.get(key);
      if (!item) return null;

      return {
        customMetadata: item.customMetadata || {},
      };
    },

    async delete(key) {
      storage.delete(key);
    },

    async list({ prefix, cursor }) {
      const objects = Array.from(storage.entries())
        .filter(([k]) => k.startsWith(prefix || ''))
        .map(([key, value]) => ({
          key,
          size: value.size,
          customMetadata: value.customMetadata || {},
        }));

      return {
        objects,
        cursor: null,
      };
    },

    // Test helper
    _clear() {
      storage.clear();
    },
  };
}

// Mock Queue
function createMockQueue() {
  const messages = [];

  return {
    async send(body, options = {}) {
      messages.push({
        body,
        options,
        id: `msg_${Date.now()}_${Math.random()}`,
        timestamp: new Date(),
      });
    },

    // Test helpers
    _getMessages() {
      return messages;
    },
    _clear() {
      messages.length = 0;
    },
  };
}

// Mock D1 Database
function createMockD1() {
  const tables = {
    queue_jobs: [],
    job_history: [],
    cache_metadata: [],
    request_analytics: [],
  };

  return {
    prepare(sql) {
      return {
        async bind(...values) {
          // Simple mock - stores the SQL and values
          this._sql = sql;
          this._values = values;
          return this;
        },

        async run() {
          // Execute based on SQL type
          if (this._sql.includes('INSERT INTO queue_jobs')) {
            tables.queue_jobs.push({
              job_id: this._values[0],
              site: this._values[1],
              points: this._values[2],
              start_time: this._values[3],
              end_time: this._values[4],
              user_id: this._values[5],
              status: this._values[6],
              priority: this._values[7],
              estimated_size: this._values[8],
              created_at: this._values[9],
            });
          } else if (this._sql.includes('UPDATE queue_jobs')) {
            const jobId = this._values[this._values.length - 1];
            const job = tables.queue_jobs.find((j) => j.job_id === jobId);
            if (job) {
              // Update status (simplified)
              job.status = this._values[0];
            }
          }
          return { success: true };
        },

        async first() {
          if (this._sql.includes('SELECT * FROM queue_jobs')) {
            const jobId = this._values[0];
            return tables.queue_jobs.find((j) => j.job_id === jobId) || null;
          }
          return null;
        },

        async all() {
          return { results: [] };
        },
      };
    },

    // Test helpers
    _getTables() {
      return tables;
    },
    _clear() {
      Object.keys(tables).forEach((key) => {
        tables[key].length = 0;
      });
    },
  };
}

// Mock Analytics Engine
function createMockAnalytics() {
  const dataPoints = [];

  return {
    async writeDataPoint(data) {
      dataPoints.push({
        ...data,
        timestamp: new Date(),
      });
    },

    // Test helper
    _getDataPoints() {
      return dataPoints;
    },
  };
}

describe('R2CacheService', () => {
  let cacheService;
  let mockEnv;

  beforeEach(async () => {
    mockEnv = createMockEnv();
    mockEnv.TIMESERIES_CACHE._clear();

    const { R2CacheService } = await import('../workers/services/r2-cache-service.js');
    cacheService = new R2CacheService(mockEnv.TIMESERIES_CACHE, {
      compression: false, // Disable for testing
    });
  });

  it('should generate consistent cache keys', () => {
    const key1 = cacheService.getCacheKey(
      'site1',
      ['point1', 'point2'],
      '2025-01-01T00:00:00Z',
      '2025-01-31T23:59:59Z'
    );

    const key2 = cacheService.getCacheKey(
      'site1',
      ['point2', 'point1'], // Different order
      '2025-01-01T00:00:00Z',
      '2025-01-31T23:59:59Z'
    );

    // Should be the same (points are sorted)
    expect(key1).toBe(key2);
    expect(key1).toContain('site1');
    expect(key1).toContain('2025-01-01_2025-01-31');
  });

  it('should store and retrieve data', async () => {
    const key = 'test/cache/key.json';
    const data = {
      point1: { samples: [[1, 100], [2, 200]], count: 2 },
    };

    // Store
    await cacheService.put(key, data, {
      pointsCount: 1,
      samplesCount: 2,
    });

    // Retrieve
    const retrieved = await cacheService.get(key);

    expect(retrieved).toEqual(data);
  });

  it('should check if cache exists', async () => {
    const key = 'test/exists.json';

    // Should not exist initially
    expect(await cacheService.exists(key)).toBe(false);

    // Store
    await cacheService.put(key, { data: 'test' });

    // Should exist now
    expect(await cacheService.exists(key)).toBe(true);
  });

  it('should delete cache entries', async () => {
    const key = 'test/delete.json';

    await cacheService.put(key, { data: 'test' });
    expect(await cacheService.exists(key)).toBe(true);

    await cacheService.delete(key);
    expect(await cacheService.exists(key)).toBe(false);
  });

  it('should return null for missing cache entries', async () => {
    const data = await cacheService.get('nonexistent/key.json');
    expect(data).toBeNull();
  });

  it('should get cache statistics', async () => {
    // Add some entries
    await cacheService.put('timeseries/site1/key1.json', { data: 'test1' }, {
      pointsCount: 5,
      samplesCount: 100,
    });

    await cacheService.put('timeseries/site1/key2.json', { data: 'test2' }, {
      pointsCount: 10,
      samplesCount: 200,
    });

    const stats = await cacheService.getStats();

    expect(stats.totalObjects).toBe(2);
    expect(stats.totalSize).toBeGreaterThan(0);
  });
});

describe('ChartQueueService', () => {
  let queueService;
  let mockEnv;

  beforeEach(async () => {
    mockEnv = createMockEnv();
    mockEnv.CHART_QUEUE._clear();
    mockEnv.DB._clear();

    const { ChartQueueService } = await import('../workers/services/queue-service.js');
    queueService = new ChartQueueService(mockEnv.CHART_QUEUE, mockEnv.DB);
  });

  it('should queue a large request', async () => {
    const jobId = 'test_job_123';
    const site = 'site1';
    const points = ['point1', 'point2'];
    const startTime = '2025-01-01T00:00:00Z';
    const endTime = '2025-01-31T23:59:59Z';

    await queueService.queueLargeRequest(jobId, site, points, startTime, endTime);

    // Check queue message
    const messages = mockEnv.CHART_QUEUE._getMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].body.jobId).toBe(jobId);
    expect(messages[0].body.site).toBe(site);

    // Check job record in DB
    const job = await queueService.getJobStatus(jobId);
    expect(job).toBeTruthy();
    expect(job.status).toBe('queued');
  });

  it('should get job status', async () => {
    const jobId = 'test_job_456';

    await queueService.queueLargeRequest(
      jobId,
      'site1',
      ['point1'],
      '2025-01-01T00:00:00Z',
      '2025-01-31T23:59:59Z'
    );

    const status = await queueService.getJobStatus(jobId);

    expect(status.jobId).toBe(jobId);
    expect(status.status).toBe('queued');
    expect(status.estimatedSize).toBeGreaterThan(0);
  });

  it('should return null for nonexistent job', async () => {
    const status = await queueService.getJobStatus('nonexistent_job');
    expect(status).toBeNull();
  });

  it('should estimate data size correctly', () => {
    const size = queueService._estimateDataSize(
      10, // points
      '2025-01-01T00:00:00Z',
      '2025-01-31T00:00:00Z' // 30 days
    );

    // 10 points × 30 days × 100 samples/day = 30,000
    expect(size).toBeCloseTo(30000, -2); // Allow some rounding
  });
});

describe('EnhancedTimeseriesService', () => {
  let service;
  let mockEnv;

  beforeEach(async () => {
    mockEnv = createMockEnv();
    mockEnv.TIMESERIES_CACHE._clear();
    mockEnv.CHART_QUEUE._clear();
    mockEnv.DB._clear();

    // Mock fetch API
    global.fetch = vi.fn((url) => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [
            { name: 'point1', value: 100, time: '2025-01-01T00:00:00Z' },
            { name: 'point1', value: 101, time: '2025-01-01T00:01:00Z' },
          ],
        }),
      });
    });

    const { EnhancedTimeseriesService } = await import(
      '../workers/services/enhanced-timeseries.js'
    );
    service = new EnhancedTimeseriesService(mockEnv, {
      smallThreshold: 1000,
      largeThreshold: 100000,
    });
  });

  it('should route small requests to direct fetch', async () => {
    const result = await service.fetchTimeseries(
      'site1',
      ['point1'], // Small request
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    expect(result._meta.routeType).toBe('direct');
    expect(result.data).toBeDefined();
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should route medium requests to cached fetch', async () => {
    const result = await service.fetchTimeseries(
      'site1',
      ['point1', 'point2', 'point3'], // Medium request
      '2025-01-01T00:00:00Z',
      '2025-01-15T00:00:00Z'
    );

    expect(result._meta.routeType).toBe('cached');
    expect(result._meta.cacheHit).toBeDefined();
  });

  it('should route large requests to queue', async () => {
    const result = await service.fetchTimeseries(
      'site1',
      Array.from({ length: 50 }, (_, i) => `point${i}`), // Large request
      '2025-01-01T00:00:00Z',
      '2025-12-31T00:00:00Z' // Full year
    );

    expect(result.jobId).toBeDefined();
    expect(result.status).toBe('queued');
    expect(result.statusUrl).toBeDefined();
  });

  it('should respect manual route override', async () => {
    const result = await service.fetchTimeseries(
      'site1',
      ['point1'], // Would normally be direct
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z',
      { route: 'cached' } // Force cached route
    );

    expect(result._meta.routeType).toBe('cached');
  });

  it('should track analytics', async () => {
    await service.fetchTimeseries(
      'site1',
      ['point1'],
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z'
    );

    const dataPoints = mockEnv.ANALYTICS._getDataPoints();
    expect(dataPoints.length).toBeGreaterThan(0);
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch = vi.fn(() => {
      return Promise.reject(new Error('Network error'));
    });

    await expect(
      service.fetchTimeseries(
        'site1',
        ['point1'],
        '2025-01-01T00:00:00Z',
        '2025-01-02T00:00:00Z'
      )
    ).rejects.toThrow();
  });
});

describe('Integration: Full Workflow', () => {
  let service;
  let mockEnv;

  beforeEach(async () => {
    mockEnv = createMockEnv();

    // Mock fetch
    global.fetch = vi.fn((url) => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: Array.from({ length: 100 }, (_, i) => ({
            name: 'point1',
            value: 100 + i,
            time: new Date(Date.now() + i * 60000).toISOString(),
          })),
        }),
      });
    });

    const { EnhancedTimeseriesService } = await import(
      '../workers/services/enhanced-timeseries.js'
    );
    service = new EnhancedTimeseriesService(mockEnv);
  });

  it('should complete a full cached workflow', async () => {
    // First request - cache miss
    const result1 = await service.fetchTimeseries(
      'site1',
      ['point1', 'point2'],
      '2025-01-01T00:00:00Z',
      '2025-01-15T00:00:00Z'
    );

    expect(result1._meta.routeType).toBe('cached');
    expect(result1._meta.cacheHit).toBe(false);

    // Second request - should hit cache
    const result2 = await service.fetchTimeseries(
      'site1',
      ['point1', 'point2'],
      '2025-01-01T00:00:00Z',
      '2025-01-15T00:00:00Z'
    );

    expect(result2._meta.routeType).toBe('cached');
    expect(result2._meta.cacheHit).toBe(true);
  });

  it('should complete a full queued workflow', async () => {
    // Queue a large request
    const result = await service.fetchTimeseries(
      'site1',
      Array.from({ length: 50 }, (_, i) => `point${i}`),
      '2025-01-01T00:00:00Z',
      '2025-12-31T00:00:00Z'
    );

    expect(result.jobId).toBeDefined();
    expect(result.status).toBe('queued');

    // Check job status
    const status = await service.getJobStatus(result.jobId);
    expect(status).toBeTruthy();
    expect(status.status).toBe('queued');
  });
});
