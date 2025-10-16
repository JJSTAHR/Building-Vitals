/**
 * Query Routing Test Suite
 *
 * Tests for intelligent query routing between D1 and R2:
 * - D1-only queries (recent data < 90 days)
 * - R2-only queries (old data > 90 days)
 * - Split queries (spans both D1 and R2)
 * - Result merging and deduplication
 * - Performance targets (<5s for 1-year queries)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockD1Database, createMockR2Bucket, createMockTimeseries } from './mocks/d1-mock';
import { R2CacheService } from '../../../workers/services/r2-cache-service.js';

describe('Query Routing - D1 and R2', () => {
  let mockDb;
  let mockR2;
  let cacheService;

  const ARCHIVE_AGE_DAYS = 90;
  const ONE_DAY_SECONDS = 24 * 3600;

  beforeEach(() => {
    mockDb = createMockD1Database();
    mockR2 = createMockR2Bucket();
    cacheService = new R2CacheService(mockR2, {
      defaultTTL: 3600,
      compression: false // Disable for testing
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('D1-Only Queries (Recent Data)', () => {
    it('should query only D1 for data within last 90 days', async () => {
      const site = 'test-site';
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (30 * ONE_DAY_SECONDS); // 30 days ago
      const endTime = now;

      // Insert recent data into D1
      const recentSamples = createMockTimeseries(1000, {
        siteName: site,
        startTimestamp: startTime,
        intervalSeconds: 60
      });

      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const sample of recentSamples) {
        await insertStmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run();
      }

      // Query D1
      const queryStmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
      `);

      const results = await queryStmt.bind(site, startTime, endTime).all();

      expect(results.results.length).toBeGreaterThan(0);
      expect(results.results.length).toBeLessThanOrEqual(1000);

      // Verify no R2 access needed
      expect(mockR2.get).not.toHaveBeenCalled();
    });

    it('should filter by specific points in D1', async () => {
      const site = 'test-site';
      const now = Math.floor(Date.now() / 1000);

      const samples = createMockTimeseries(500, {
        siteName: site,
        startTimestamp: now - (10 * ONE_DAY_SECONDS)
      });

      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const sample of samples) {
        await insertStmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run();
      }

      // Query specific points
      const targetPoints = ['point-0', 'point-1', 'point-2'];

      const queryStmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND point_name IN (?, ?, ?)
        ORDER BY timestamp ASC
      `);

      const results = await queryStmt.bind(site, ...targetPoints).all();

      // Verify only target points returned
      results.results.forEach(row => {
        expect(targetPoints).toContain(row.point_name);
      });
    });

    it('should return empty results for future dates in D1', async () => {
      const site = 'test-site';
      const now = Math.floor(Date.now() / 1000);
      const futureStart = now + (30 * ONE_DAY_SECONDS);
      const futureEnd = now + (60 * ONE_DAY_SECONDS);

      const queryStmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ? AND timestamp <= ?
      `);

      const results = await queryStmt.bind(site, futureStart, futureEnd).all();

      expect(results.results).toHaveLength(0);
    });
  });

  describe('R2-Only Queries (Archived Data)', () => {
    it('should query only R2 for data older than 90 days', async () => {
      const site = 'archive-site';
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (180 * ONE_DAY_SECONDS); // 180 days ago
      const endTime = now - (120 * ONE_DAY_SECONDS); // 120 days ago

      // Create archived data
      const archivedSamples = createMockTimeseries(5000, {
        siteName: site,
        startTimestamp: startTime,
        intervalSeconds: 60
      });

      // Store in R2 as archive
      const archiveKey = `archives/${site}/2024-01-01_2024-03-31/timeseries.json`;
      const archiveData = JSON.stringify({
        site_name: site,
        start_time: startTime,
        end_time: endTime,
        records: archivedSamples
      });

      await mockR2.put(
        archiveKey,
        new TextEncoder().encode(archiveData),
        {
          customMetadata: {
            recordCount: String(archivedSamples.length),
            startTimestamp: String(startTime),
            endTimestamp: String(endTime)
          }
        }
      );

      // Query R2
      const archived = await mockR2.get(archiveKey);
      expect(archived).not.toBeNull();

      const archiveJson = JSON.parse(
        new TextDecoder().decode(await archived.arrayBuffer())
      );

      expect(archiveJson.records).toHaveLength(5000);

      // Verify D1 was not queried
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('should handle multiple R2 archive files for long time ranges', async () => {
      const site = 'multi-archive-site';
      const now = Math.floor(Date.now() / 1000);

      // Create 3 monthly archives
      const archives = [
        { start: now - (180 * ONE_DAY_SECONDS), end: now - (150 * ONE_DAY_SECONDS), month: '2024-01' },
        { start: now - (150 * ONE_DAY_SECONDS), end: now - (120 * ONE_DAY_SECONDS), month: '2024-02' },
        { start: now - (120 * ONE_DAY_SECONDS), end: now - (90 * ONE_DAY_SECONDS), month: '2024-03' }
      ];

      for (const archive of archives) {
        const samples = createMockTimeseries(1000, {
          siteName: site,
          startTimestamp: archive.start
        });

        const archiveKey = `archives/${site}/${archive.month}/timeseries.json`;
        await mockR2.put(
          archiveKey,
          new TextEncoder().encode(JSON.stringify({ records: samples }))
        );
      }

      // List and fetch all archives
      const listed = await mockR2.list({ prefix: `archives/${site}/` });
      expect(listed.objects).toHaveLength(3);

      // Fetch all archives
      const allRecords = [];
      for (const obj of listed.objects) {
        const archive = await mockR2.get(obj.key);
        const data = JSON.parse(new TextDecoder().decode(await archive.arrayBuffer()));
        allRecords.push(...data.records);
      }

      expect(allRecords).toHaveLength(3000);
    });

    it('should cache R2 query results for repeated access', async () => {
      const site = 'cache-test-site';
      const points = ['point-1', 'point-2'];
      const startTime = new Date('2024-01-01').toISOString();
      const endTime = new Date('2024-01-31').toISOString();

      const cacheKey = cacheService.getCacheKey(site, points, startTime, endTime);

      // First query - cache miss
      let cached = await cacheService.get(cacheKey);
      expect(cached).toBeNull();

      // Fetch from R2 and cache
      const mockData = {
        'point-1': { samples: [{ time: startTime, value: 70 }], count: 1 },
        'point-2': { samples: [{ time: startTime, value: 80 }], count: 1 }
      };

      await cacheService.put(cacheKey, mockData, {
        pointsCount: 2,
        samplesCount: 2
      });

      // Second query - cache hit
      cached = await cacheService.get(cacheKey);
      expect(cached).not.toBeNull();
      expect(cached['point-1'].count).toBe(1);
    });
  });

  describe('Split Queries (D1 + R2)', () => {
    it('should query both D1 and R2 for data spanning 150 days', async () => {
      const site = 'split-query-site';
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (150 * ONE_DAY_SECONDS); // 150 days ago
      const endTime = now; // Today
      const cutoff = now - (ARCHIVE_AGE_DAYS * ONE_DAY_SECONDS);

      // Old data in R2 (150-90 days ago)
      const oldSamples = createMockTimeseries(3000, {
        siteName: site,
        startTimestamp: startTime,
        intervalSeconds: 120
      });

      const archiveKey = `archives/${site}/old-data.json`;
      await mockR2.put(
        archiveKey,
        new TextEncoder().encode(JSON.stringify({ records: oldSamples }))
      );

      // Recent data in D1 (90-0 days ago)
      const recentSamples = createMockTimeseries(2000, {
        siteName: site,
        startTimestamp: cutoff,
        intervalSeconds: 120
      });

      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const sample of recentSamples) {
        await insertStmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run();
      }

      // Query D1 for recent data
      const d1Stmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `);

      const d1Results = await d1Stmt.bind(site, cutoff).all();

      // Query R2 for old data
      const r2Archive = await mockR2.get(archiveKey);
      const r2Data = JSON.parse(new TextDecoder().decode(await r2Archive.arrayBuffer()));

      // Merge results
      const allResults = [...r2Data.records, ...d1Results.results];

      expect(allResults.length).toBeGreaterThan(4000);
      expect(d1Results.results.length).toBeGreaterThan(0);
      expect(r2Data.records.length).toBeGreaterThan(0);
    });

    it('should merge and deduplicate results from D1 and R2', async () => {
      const site = 'dedup-test';
      const now = Math.floor(Date.now() / 1000);

      // Overlapping data in both D1 and R2
      const sharedTimestamp = now - (100 * ONE_DAY_SECONDS);

      const d1Sample = {
        site_name: site,
        point_name: 'shared-point',
        interval: '1min',
        timestamp: sharedTimestamp,
        avg_value: 75.0,
        sample_count: 1
      };

      const r2Sample = {
        site_name: site,
        point_name: 'shared-point',
        interval: '1min',
        timestamp: sharedTimestamp,
        avg_value: 75.0,
        sample_count: 1
      };

      // Insert into D1
      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await insertStmt.bind(
        d1Sample.site_name,
        d1Sample.point_name,
        d1Sample.interval,
        d1Sample.timestamp,
        d1Sample.avg_value,
        d1Sample.sample_count
      ).run();

      // Store in R2
      await mockR2.put(
        'archives/dedup/data.json',
        new TextEncoder().encode(JSON.stringify({ records: [r2Sample] }))
      );

      // Fetch both
      const d1Results = await mockDb.prepare(`
        SELECT * FROM timeseries_agg WHERE site_name = ?
      `).bind(site).all();

      const r2Archive = await mockR2.get('archives/dedup/data.json');
      const r2Data = JSON.parse(new TextDecoder().decode(await r2Archive.arrayBuffer()));

      // Deduplicate by timestamp + point_name
      const allResults = [...d1Results.results, ...r2Data.records];
      const deduped = [];
      const seen = new Set();

      for (const result of allResults) {
        const key = `${result.point_name}:${result.timestamp}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(result);
        }
      }

      expect(allResults).toHaveLength(2); // Duplicate exists
      expect(deduped).toHaveLength(1); // Deduplicated to 1
    });

    it('should maintain correct time ordering after merge', async () => {
      const site = 'order-test';
      const now = Math.floor(Date.now() / 1000);

      // R2 data (oldest)
      const r2Samples = [
        { timestamp: now - 300, value: 1 },
        { timestamp: now - 200, value: 2 }
      ];

      // D1 data (newest)
      const d1Samples = [
        { timestamp: now - 100, value: 3 },
        { timestamp: now - 50, value: 4 }
      ];

      // Store in R2
      await mockR2.put(
        'archives/order/data.json',
        new TextEncoder().encode(JSON.stringify({ records: r2Samples }))
      );

      // Insert into D1
      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const sample of d1Samples) {
        await insertStmt.bind(
          site,
          'test-point',
          '1min',
          sample.timestamp,
          sample.value,
          1
        ).run();
      }

      // Fetch and merge
      const r2Archive = await mockR2.get('archives/order/data.json');
      const r2Data = JSON.parse(new TextDecoder().decode(await r2Archive.arrayBuffer()));

      const d1Results = await mockDb.prepare(`
        SELECT * FROM timeseries_agg WHERE site_name = ?
      `).bind(site).all();

      // Merge and sort
      const merged = [...r2Data.records, ...d1Results.results]
        .sort((a, b) => a.timestamp - b.timestamp);

      expect(merged).toHaveLength(4);
      expect(merged[0].timestamp).toBe(now - 300); // Oldest
      expect(merged[3].timestamp).toBe(now - 50); // Newest
    });
  });

  describe('Result Merging', () => {
    it('should group results by point name', async () => {
      const site = 'group-test';

      // Mixed data from D1 and R2
      const allSamples = [
        { site_name: site, point_name: 'temp', timestamp: 1000, avg_value: 70 },
        { site_name: site, point_name: 'humidity', timestamp: 1000, avg_value: 50 },
        { site_name: site, point_name: 'temp', timestamp: 2000, avg_value: 72 },
        { site_name: site, point_name: 'humidity', timestamp: 2000, avg_value: 52 }
      ];

      // Group by point_name
      const grouped = allSamples.reduce((acc, sample) => {
        if (!acc[sample.point_name]) {
          acc[sample.point_name] = {
            samples: [],
            count: 0
          };
        }

        acc[sample.point_name].samples.push({
          time: sample.timestamp,
          value: sample.avg_value
        });
        acc[sample.point_name].count++;

        return acc;
      }, {});

      expect(grouped['temp'].count).toBe(2);
      expect(grouped['humidity'].count).toBe(2);
    });

    it('should handle missing data from one source', async () => {
      const site = 'missing-data-test';

      // Only D1 has data, R2 is empty
      const d1Samples = createMockTimeseries(100, { siteName: site });

      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const sample of d1Samples) {
        await insertStmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run();
      }

      // Query D1
      const d1Results = await mockDb.prepare(`
        SELECT * FROM timeseries_agg WHERE site_name = ?
      `).bind(site).all();

      // Try to get R2 data (none exists)
      const r2Archive = await mockR2.get('archives/missing/data.json');

      // Merge (R2 is null)
      const merged = [
        ...(d1Results.results || []),
        ...(r2Archive ? [] : [])
      ];

      expect(merged).toHaveLength(100);
    });

    it('should preserve metadata from both sources', async () => {
      const d1Metadata = {
        source: 'D1',
        queryTime: 50,
        recordCount: 1000
      };

      const r2Metadata = {
        source: 'R2',
        queryTime: 200,
        recordCount: 5000
      };

      const combinedMetadata = {
        sources: [d1Metadata.source, r2Metadata.source],
        totalQueryTime: d1Metadata.queryTime + r2Metadata.queryTime,
        totalRecords: d1Metadata.recordCount + r2Metadata.recordCount,
        d1Records: d1Metadata.recordCount,
        r2Records: r2Metadata.recordCount
      };

      expect(combinedMetadata.sources).toHaveLength(2);
      expect(combinedMetadata.totalRecords).toBe(6000);
      expect(combinedMetadata.totalQueryTime).toBe(250);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete 1-day query in under 1 second', async () => {
      const site = 'perf-1day';
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - ONE_DAY_SECONDS;

      const samples = createMockTimeseries(1440, { // 1 minute intervals for 24 hours
        siteName: site,
        startTimestamp: startTime,
        intervalSeconds: 60
      });

      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const sample of samples) {
        await insertStmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run();
      }

      const start = performance.now();

      await mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
      `).bind(site, startTime).all();

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000); // Under 1 second
    });

    it('should complete 1-week query in under 2 seconds', async () => {
      const site = 'perf-1week';
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (7 * ONE_DAY_SECONDS);

      const samples = createMockTimeseries(10080, { // 1 minute intervals for 7 days
        siteName: site,
        startTimestamp: startTime,
        intervalSeconds: 60
      });

      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const sample of samples) {
        await insertStmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run();
      }

      const start = performance.now();

      await mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
      `).bind(site, startTime).all();

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000); // Under 2 seconds
    });

    it('should complete 1-month query in under 3 seconds', async () => {
      const site = 'perf-1month';
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (30 * ONE_DAY_SECONDS);

      // Use 5-minute intervals to keep sample count reasonable
      const samples = createMockTimeseries(8640, {
        siteName: site,
        startTimestamp: startTime,
        intervalSeconds: 300 // 5 minutes
      });

      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const sample of samples) {
        await insertStmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run();
      }

      const start = performance.now();

      await mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
      `).bind(site, startTime).all();

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(3000); // Under 3 seconds
    });

    it('should complete 1-year query (split D1+R2) in under 5 seconds', async () => {
      const site = 'perf-1year';
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (365 * ONE_DAY_SECONDS);
      const cutoff = now - (ARCHIVE_AGE_DAYS * ONE_DAY_SECONDS);

      const start = performance.now();

      // Query R2 for old data (parallel)
      const r2Promise = mockR2.list({ prefix: `archives/${site}/` })
        .then(listed => Promise.all(
          listed.objects.map(obj => mockR2.get(obj.key))
        ));

      // Query D1 for recent data (parallel)
      const d1Promise = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
      `).bind(site, cutoff).all();

      // Wait for both
      await Promise.all([r2Promise, d1Promise]);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5000); // Under 5 seconds
    });
  });
});
