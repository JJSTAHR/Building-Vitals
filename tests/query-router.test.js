/**
 * Query Router Unit Tests
 *
 * Tests for intelligent D1/R2 query routing logic
 */

import { describe, test, expect } from 'vitest';
import {
  routeQuery,
  mergeResults,
  generateCacheKey,
  getCacheTTL
} from '../src/lib/query-router.js';

describe('Query Routing Decision', () => {
  const now = new Date('2025-10-13T00:00:00Z');

  test('routes recent queries (<30 days) to D1_ONLY', () => {
    const pointNames = ['VAV-707-DaTemp'];
    const startTime = '2025-10-01T00:00:00Z'; // 12 days ago
    const endTime = '2025-10-13T00:00:00Z'; // now

    const result = routeQuery(pointNames, startTime, endTime);

    expect(result.strategy).toBe('D1_ONLY');
    expect(result.useD1).toBe(true);
    expect(result.useR2).toBe(false);
    expect(result.splitPoint).toBeNull();
    expect(result.estimatedResponseTime).toBeLessThan(500);
  });

  test('routes historical queries (>30 days) to R2_ONLY', () => {
    const pointNames = ['VAV-707-DaTemp'];
    const startTime = '2024-01-01T00:00:00Z'; // ~287 days ago
    const endTime = '2024-12-31T00:00:00Z'; // ~287 days ago

    const result = routeQuery(pointNames, startTime, endTime);

    expect(result.strategy).toBe('R2_ONLY');
    expect(result.useD1).toBe(false);
    expect(result.useR2).toBe(true);
    expect(result.splitPoint).toBeNull();
    expect(result.estimatedResponseTime).toBeLessThan(5000);
  });

  test('splits queries spanning hot/cold boundary', () => {
    const pointNames = ['VAV-707-DaTemp'];
    const startTime = '2025-09-01T00:00:00Z'; // 42 days ago
    const endTime = '2025-10-13T00:00:00Z'; // now

    const result = routeQuery(pointNames, startTime, endTime);

    expect(result.strategy).toBe('SPLIT');
    expect(result.useD1).toBe(true);
    expect(result.useR2).toBe(true);
    expect(result.splitPoint).toBeDefined();
    expect(result.splitPoint).toBeTruthy();

    // Split point should be approximately 30 days ago
    const splitDate = new Date(result.splitPoint);
    const daysFromNow = (now.getTime() - splitDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysFromNow).toBeCloseTo(30, 1);
  });

  test('estimates D1 response time correctly', () => {
    const pointNames = Array(10).fill('point'); // 10 points
    const startTime = '2025-10-12T00:00:00Z'; // 1 day
    const endTime = '2025-10-13T00:00:00Z';

    const result = routeQuery(pointNames, startTime, endTime);

    // 10 points * 1 day * 1440 minutes = 14,400 samples
    // 50ms + (14.4 * 0.1) = ~51.44ms
    expect(result.estimatedResponseTime).toBeGreaterThan(50);
    expect(result.estimatedResponseTime).toBeLessThan(100);
  });

  test('estimates R2 response time correctly', () => {
    const pointNames = ['VAV-707-DaTemp'];
    const startTime = '2024-01-01T00:00:00Z'; // 12 months
    const endTime = '2024-12-31T00:00:00Z';

    const result = routeQuery(pointNames, startTime, endTime);

    // 12 monthly files: 500ms + (12 * 200ms) = 2900ms
    expect(result.estimatedResponseTime).toBeGreaterThan(2000);
    expect(result.estimatedResponseTime).toBeLessThan(5000);
  });

  test('includes helpful rationale', () => {
    const result1 = routeQuery(['p1'], '2025-10-12T00:00:00Z', '2025-10-13T00:00:00Z');
    expect(result1.rationale).toContain('hot storage');

    const result2 = routeQuery(['p1'], '2024-01-01T00:00:00Z', '2024-12-31T00:00:00Z');
    expect(result2.rationale).toContain('cold storage');

    const result3 = routeQuery(['p1'], '2025-09-01T00:00:00Z', '2025-10-13T00:00:00Z');
    expect(result3.rationale).toContain('spans');
  });
});

describe('Result Merging', () => {
  test('merges D1 and R2 results correctly', () => {
    const d1Results = {
      source: 'D1',
      series: [
        {
          name: 'VAV-707-DaTemp',
          data: [
            [1697500000000, 72.5],
            [1697510000000, 73.0]
          ]
        }
      ],
      metadata: { storage: 'hot' }
    };

    const r2Results = {
      source: 'R2',
      series: [
        {
          name: 'VAV-707-DaTemp',
          data: [
            [1697400000000, 71.0],
            [1697450000000, 71.5]
          ]
        }
      ],
      metadata: { storage: 'cold' }
    };

    const merged = mergeResults(d1Results, r2Results);

    expect(merged.series).toHaveLength(1);
    expect(merged.series[0].name).toBe('VAV-707-DaTemp');
    expect(merged.series[0].data).toHaveLength(4);

    // Should be sorted by timestamp
    expect(merged.series[0].data[0][0]).toBeLessThan(merged.series[0].data[1][0]);
    expect(merged.series[0].data[1][0]).toBeLessThan(merged.series[0].data[2][0]);
    expect(merged.series[0].data[2][0]).toBeLessThan(merged.series[0].data[3][0]);

    // Metadata should indicate both sources
    expect(merged.metadata.dataSource).toBe('BOTH');
    expect(merged.metadata.sources).toContain('D1');
    expect(merged.metadata.sources).toContain('R2');
    expect(merged.metadata.totalPoints).toBe(4);
  });

  test('deduplicates timestamps correctly', () => {
    const d1Results = {
      source: 'D1',
      series: [
        {
          name: 'point1',
          data: [
            [1000, 2.0], // Newer value
            [2000, 3.0]
          ]
        }
      ]
    };

    const r2Results = {
      source: 'R2',
      series: [
        {
          name: 'point1',
          data: [
            [1000, 1.0], // Older value (will be overwritten)
            [500, 0.5]
          ]
        }
      ]
    };

    const merged = mergeResults(d1Results, r2Results);

    // Should have 3 unique timestamps: 500, 1000, 2000
    expect(merged.series[0].data).toHaveLength(3);

    // Timestamp 1000 should have newer value (2.0, not 1.0)
    const ts1000 = merged.series[0].data.find(([ts]) => ts === 1000);
    expect(ts1000[1]).toBe(2.0);
  });

  test('handles multiple series', () => {
    const d1Results = {
      source: 'D1',
      series: [
        { name: 'point1', data: [[1000, 1]] },
        { name: 'point2', data: [[1000, 2]] }
      ]
    };

    const r2Results = {
      source: 'R2',
      series: [
        { name: 'point1', data: [[500, 0.5]] },
        { name: 'point2', data: [[500, 1.5]] }
      ]
    };

    const merged = mergeResults(d1Results, r2Results);

    expect(merged.series).toHaveLength(2);
    expect(merged.series[0].data).toHaveLength(2); // point1: 2 timestamps
    expect(merged.series[1].data).toHaveLength(2); // point2: 2 timestamps
  });

  test('handles D1 only (no R2 results)', () => {
    const d1Results = {
      source: 'D1',
      series: [{ name: 'point1', data: [[1000, 1]] }]
    };

    const merged = mergeResults(d1Results, null);

    expect(merged.series).toHaveLength(1);
    expect(merged.metadata.dataSource).toBe('D1');
    expect(merged.metadata.sources).toEqual(['D1']);
  });

  test('handles R2 only (no D1 results)', () => {
    const r2Results = {
      source: 'R2',
      series: [{ name: 'point1', data: [[1000, 1]] }]
    };

    const merged = mergeResults(null, r2Results);

    expect(merged.series).toHaveLength(1);
    expect(merged.metadata.dataSource).toBe('R2');
    expect(merged.metadata.sources).toEqual(['R2']);
  });

  test('calculates total points correctly', () => {
    const d1Results = {
      source: 'D1',
      series: [
        { name: 'point1', data: [[1000, 1], [2000, 2]] },
        { name: 'point2', data: [[1000, 1]] }
      ]
    };

    const r2Results = {
      source: 'R2',
      series: [
        { name: 'point1', data: [[500, 0.5]] }
      ]
    };

    const merged = mergeResults(d1Results, r2Results);

    // point1: 3 unique timestamps (500, 1000, 2000)
    // point2: 1 timestamp (1000)
    // Total: 4 points
    expect(merged.metadata.totalPoints).toBe(4);
  });
});

describe('Cache Key Generation', () => {
  test('generates consistent cache keys', () => {
    const points1 = ['VAV-707-DaTemp', 'VAV-707-Damper'];
    const start = '2025-10-01T00:00:00Z';
    const end = '2025-10-13T00:00:00Z';

    const key1 = generateCacheKey(points1, start, end);
    const key2 = generateCacheKey(points1, start, end);

    expect(key1).toBe(key2);
  });

  test('generates different keys for different parameters', () => {
    const points = ['VAV-707-DaTemp'];
    const start1 = '2025-10-01T00:00:00Z';
    const start2 = '2025-09-01T00:00:00Z';
    const end = '2025-10-13T00:00:00Z';

    const key1 = generateCacheKey(points, start1, end);
    const key2 = generateCacheKey(points, start2, end);

    expect(key1).not.toBe(key2);
  });

  test('generates same key regardless of point order', () => {
    const points1 = ['VAV-707-DaTemp', 'VAV-707-Damper'];
    const points2 = ['VAV-707-Damper', 'VAV-707-DaTemp']; // Different order
    const start = '2025-10-01T00:00:00Z';
    const end = '2025-10-13T00:00:00Z';

    const key1 = generateCacheKey(points1, start, end);
    const key2 = generateCacheKey(points2, start, end);

    expect(key1).toBe(key2);
  });

  test('cache key format is correct', () => {
    const points = ['point1'];
    const start = '2025-10-01T00:00:00Z';
    const end = '2025-10-13T00:00:00Z';

    const key = generateCacheKey(points, start, end);

    expect(key).toMatch(/^query:[a-z0-9]+:2025-10-01T00:00:00Z:2025-10-13T00:00:00Z$/);
  });
});

describe('Cache TTL Calculation', () => {
  test('real-time data (<1 day) gets 5 minute TTL', () => {
    const now = new Date('2025-10-13T12:00:00Z');
    const endTime = new Date('2025-10-13T11:00:00Z').toISOString(); // 1 hour ago

    const ttl = getCacheTTL(endTime);

    expect(ttl).toBe(300); // 5 minutes
  });

  test('recent data (1-7 days) gets 30 minute TTL', () => {
    const endTime = new Date('2025-10-06T00:00:00Z').toISOString(); // 7 days ago

    const ttl = getCacheTTL(endTime);

    expect(ttl).toBe(1800); // 30 minutes
  });

  test('semi-recent data (7-30 days) gets 1 hour TTL', () => {
    const endTime = new Date('2025-09-20T00:00:00Z').toISOString(); // 23 days ago

    const ttl = getCacheTTL(endTime);

    expect(ttl).toBe(3600); // 1 hour
  });

  test('historical data (>30 days) gets 24 hour TTL', () => {
    const endTime = new Date('2024-01-01T00:00:00Z').toISOString(); // ~287 days ago

    const ttl = getCacheTTL(endTime);

    expect(ttl).toBe(86400); // 24 hours
  });
});

describe('Edge Cases', () => {
  test('handles empty point names array', () => {
    const result = routeQuery([], '2025-10-01T00:00:00Z', '2025-10-13T00:00:00Z');

    expect(result.strategy).toBeDefined();
  });

  test('handles single point', () => {
    const result = routeQuery(['point1'], '2025-10-01T00:00:00Z', '2025-10-13T00:00:00Z');

    expect(result.strategy).toBe('D1_ONLY');
  });

  test('handles many points', () => {
    const manyPoints = Array(100).fill('point').map((p, i) => `${p}${i}`);
    const result = routeQuery(manyPoints, '2025-10-01T00:00:00Z', '2025-10-13T00:00:00Z');

    expect(result.strategy).toBe('D1_ONLY');
  });

  test('handles exact 30-day boundary', () => {
    const now = new Date('2025-10-13T00:00:00Z');
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = routeQuery(
      ['point1'],
      thirtyDaysAgo.toISOString(),
      now.toISOString()
    );

    // Should use SPLIT strategy at exact boundary
    expect(['D1_ONLY', 'SPLIT']).toContain(result.strategy);
  });

  test('merging handles empty series', () => {
    const d1Results = {
      source: 'D1',
      series: []
    };

    const r2Results = {
      source: 'R2',
      series: [{ name: 'point1', data: [[1000, 1]] }]
    };

    const merged = mergeResults(d1Results, r2Results);

    expect(merged.series).toHaveLength(1);
  });
});
