/**
 * D1 Operations Test Suite
 *
 * Tests for D1 database operations including:
 * - Batch insert timeseries data
 * - Query timeseries by range
 * - Edge cases (empty results, invalid dates)
 * - Concurrent inserts and race conditions
 * - Schema validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockD1Database, createMockTimeseries } from './mocks/d1-mock';

describe('D1 Timeseries Operations', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockD1Database();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('batchInsertTimeseries', () => {
    it('should insert 1000 records successfully', async () => {
      const samples = createMockTimeseries(1000);

      // Mock batch insert
      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertPromises = samples.map(sample =>
        stmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run()
      );

      const results = await Promise.all(insertPromises);

      expect(results).toHaveLength(1000);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle duplicate primary key errors gracefully', async () => {
      const sample = {
        site_name: 'test-site',
        point_name: 'temperature',
        interval: '1min',
        timestamp: Date.now(),
        avg_value: 72.5,
        sample_count: 1
      };

      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // Insert once
      await stmt.bind(
        sample.site_name,
        sample.point_name,
        sample.interval,
        sample.timestamp,
        sample.avg_value,
        sample.sample_count
      ).run();

      // Try to insert duplicate - should use UPSERT
      const upsertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(site_name, point_name, interval, timestamp)
        DO UPDATE SET avg_value = excluded.avg_value, sample_count = excluded.sample_count
      `);

      const result = await upsertStmt.bind(
        sample.site_name,
        sample.point_name,
        sample.interval,
        sample.timestamp,
        75.0, // Updated value
        sample.sample_count
      ).run();

      expect(result.success).toBe(true);
    });

    it('should maintain WITHOUT ROWID table optimization', async () => {
      // Verify table structure
      const schemaStmt = mockDb.prepare(`
        SELECT sql FROM sqlite_master WHERE type='table' AND name='timeseries_agg'
      `);

      const schema = await schemaStmt.first();
      expect(schema.sql).toContain('WITHOUT ROWID');
    });

    it('should enforce composite primary key constraint', async () => {
      const sample = {
        site_name: 'test-site',
        point_name: 'humidity',
        interval: '5min',
        timestamp: Math.floor(Date.now() / 1000),
        avg_value: 45.2,
        sample_count: 5
      };

      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // First insert should succeed
      const result1 = await stmt.bind(
        sample.site_name,
        sample.point_name,
        sample.interval,
        sample.timestamp,
        sample.avg_value,
        sample.sample_count
      ).run();

      expect(result1.success).toBe(true);

      // Duplicate should fail without UPSERT
      await expect(
        stmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run()
      ).rejects.toThrow(/UNIQUE constraint failed/);
    });
  });

  describe('queryTimeseriesRange', () => {
    beforeEach(async () => {
      // Insert test data
      const samples = [
        { site_name: 'site-1', point_name: 'temp-1', interval: '1min', timestamp: 1000, avg_value: 70.0, sample_count: 1 },
        { site_name: 'site-1', point_name: 'temp-1', interval: '1min', timestamp: 1060, avg_value: 71.0, sample_count: 1 },
        { site_name: 'site-1', point_name: 'temp-1', interval: '1min', timestamp: 1120, avg_value: 72.0, sample_count: 1 },
        { site_name: 'site-1', point_name: 'temp-2', interval: '1min', timestamp: 1000, avg_value: 65.0, sample_count: 1 },
        { site_name: 'site-2', point_name: 'temp-3', interval: '1min', timestamp: 1000, avg_value: 80.0, sample_count: 1 },
      ];

      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const sample of samples) {
        await stmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run();
      }
    });

    it('should query by site and time range', async () => {
      const stmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
      `);

      const results = await stmt.bind('site-1', 1000, 1120).all();

      expect(results.results).toHaveLength(4);
      expect(results.results[0].point_name).toMatch(/temp-[12]/);
    });

    it('should filter by specific point names', async () => {
      const stmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND point_name IN (?, ?) AND timestamp >= ?
        ORDER BY timestamp ASC
      `);

      const results = await stmt.bind('site-1', 'temp-1', 'temp-2', 1000).all();

      expect(results.results).toHaveLength(4);
      results.results.forEach(row => {
        expect(['temp-1', 'temp-2']).toContain(row.point_name);
      });
    });

    it('should handle empty results gracefully', async () => {
      const stmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
      `);

      const results = await stmt.bind('non-existent-site', 9999).all();

      expect(results.results).toHaveLength(0);
    });

    it('should handle invalid date ranges', async () => {
      const stmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ? AND timestamp <= ?
      `);

      // Start time after end time
      const results = await stmt.bind('site-1', 2000, 1000).all();

      expect(results.results).toHaveLength(0);
    });

    it('should use index for time-range queries', async () => {
      // Verify index usage with EXPLAIN QUERY PLAN
      const explainStmt = mockDb.prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND interval = ? AND timestamp >= ?
      `);

      const plan = await explainStmt.bind('site-1', '1min', 1000).all();

      // Should use idx_timeseries_site_time
      const planText = JSON.stringify(plan.results);
      expect(planText).toContain('idx_timeseries_site_time');
    });

    it('should aggregate data efficiently', async () => {
      const stmt = mockDb.prepare(`
        SELECT
          point_name,
          AVG(avg_value) as overall_avg,
          MIN(min_value) as overall_min,
          MAX(max_value) as overall_max,
          SUM(sample_count) as total_samples
        FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ? AND timestamp <= ?
        GROUP BY point_name
      `);

      const results = await stmt.bind('site-1', 1000, 1120).all();

      expect(results.results).toHaveLength(2); // temp-1 and temp-2
      results.results.forEach(row => {
        expect(row.overall_avg).toBeGreaterThan(0);
        expect(row.total_samples).toBeGreaterThan(0);
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle 100 concurrent inserts without race conditions', async () => {
      const concurrentInserts = Array(100).fill(null).map((_, i) => {
        const sample = {
          site_name: 'concurrent-test',
          point_name: `point-${i}`,
          interval: '1min',
          timestamp: Math.floor(Date.now() / 1000),
          avg_value: Math.random() * 100,
          sample_count: 1
        };

        const stmt = mockDb.prepare(`
          INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        return stmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run();
      });

      const results = await Promise.all(concurrentInserts);

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify all records were inserted
      const countStmt = mockDb.prepare(`
        SELECT COUNT(*) as count FROM timeseries_agg WHERE site_name = ?
      `);

      const count = await countStmt.bind('concurrent-test').first();
      expect(count.count).toBe(100);
    });

    it('should handle concurrent reads during writes', async () => {
      const site = 'read-write-test';

      // Start concurrent writes
      const writes = Array(50).fill(null).map((_, i) => {
        const stmt = mockDb.prepare(`
          INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        return stmt.bind(
          site,
          `point-${i}`,
          '1min',
          1000 + i,
          Math.random() * 100,
          1
        ).run();
      });

      // Concurrent reads
      const reads = Array(50).fill(null).map(() => {
        const stmt = mockDb.prepare(`
          SELECT COUNT(*) as count FROM timeseries_agg WHERE site_name = ?
        `);

        return stmt.bind(site).first();
      });

      // Execute all concurrently
      const [writeResults, readResults] = await Promise.all([
        Promise.all(writes),
        Promise.all(reads)
      ]);

      expect(writeResults).toHaveLength(50);
      expect(readResults).toHaveLength(50);

      // All writes should succeed
      writeResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Reads should not fail (may show partial data due to concurrency)
      readResults.forEach(result => {
        expect(result.count).toBeGreaterThanOrEqual(0);
        expect(result.count).toBeLessThanOrEqual(50);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle NULL values in optional fields', async () => {
      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, min_value, max_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = await stmt.bind(
        'test-site',
        'test-point',
        '1min',
        1000,
        75.0,
        null, // min_value is NULL
        null, // max_value is NULL
        1
      ).run();

      expect(result.success).toBe(true);

      // Verify NULL values are stored correctly
      const selectStmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg WHERE site_name = ? AND point_name = ?
      `);

      const row = await selectStmt.bind('test-site', 'test-point').first();
      expect(row.min_value).toBeNull();
      expect(row.max_value).toBeNull();
    });

    it('should handle very large timestamps (far future)', async () => {
      const futureTimestamp = Math.floor(new Date('2099-12-31').getTime() / 1000);

      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = await stmt.bind(
        'test-site',
        'future-point',
        '1min',
        futureTimestamp,
        100.0,
        1
      ).run();

      expect(result.success).toBe(true);
    });

    it('should handle very old timestamps (past)', async () => {
      const pastTimestamp = Math.floor(new Date('1970-01-01').getTime() / 1000);

      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = await stmt.bind(
        'test-site',
        'past-point',
        '1min',
        pastTimestamp,
        50.0,
        1
      ).run();

      expect(result.success).toBe(true);
    });

    it('should handle very long point names', async () => {
      const longPointName = 'x'.repeat(500);

      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = await stmt.bind(
        'test-site',
        longPointName,
        '1min',
        1000,
        50.0,
        1
      ).run();

      expect(result.success).toBe(true);

      // Verify retrieval
      const selectStmt = mockDb.prepare(`
        SELECT point_name FROM timeseries_agg WHERE site_name = ? AND timestamp = ?
      `);

      const row = await selectStmt.bind('test-site', 1000).first();
      expect(row.point_name).toBe(longPointName);
    });

    it('should handle special characters in point names', async () => {
      const specialChars = "point-name with spaces and 'quotes' and \"double-quotes\"";

      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = await stmt.bind(
        'test-site',
        specialChars,
        '1min',
        1000,
        75.0,
        1
      ).run();

      expect(result.success).toBe(true);
    });

    it('should handle floating point precision correctly', async () => {
      const preciseValue = 123.456789012345;

      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind('test-site', 'precise-point', '1min', 1000, preciseValue, 1).run();

      const selectStmt = mockDb.prepare(`
        SELECT avg_value FROM timeseries_agg WHERE site_name = ? AND point_name = ?
      `);

      const row = await selectStmt.bind('test-site', 'precise-point').first();

      // SQLite REAL type may lose some precision
      expect(row.avg_value).toBeCloseTo(preciseValue, 6);
    });
  });

  describe('Performance', () => {
    it('should insert 1000 records in under 1 second', async () => {
      const samples = createMockTimeseries(1000);
      const start = performance.now();

      const stmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await Promise.all(
        samples.map(sample =>
          stmt.bind(
            sample.site_name,
            sample.point_name,
            sample.interval,
            sample.timestamp,
            sample.avg_value,
            sample.sample_count
          ).run()
        )
      );

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // Under 1 second
    });

    it('should query 10000 records in under 100ms', async () => {
      // Insert 10000 records
      const samples = createMockTimeseries(10000);
      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await Promise.all(
        samples.map(sample =>
          insertStmt.bind(
            sample.site_name,
            sample.point_name,
            sample.interval,
            sample.timestamp,
            sample.avg_value,
            sample.sample_count
          ).run()
        )
      );

      // Time the query
      const start = performance.now();

      const queryStmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ? AND timestamp <= ?
      `);

      await queryStmt.bind('test-site', 0, Date.now()).all();

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Under 100ms
    });
  });
});
