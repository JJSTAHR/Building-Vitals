/**
 * Performance Benchmark Test Suite
 *
 * Benchmarks for D1 + R2 time-series system:
 * - D1 query speed
 * - R2 query speed
 * - Split queries (D1 + R2)
 * - Various time ranges (1 day, 1 week, 1 month, 1 year)
 * - Output performance metrics
 */

import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import { createMockD1Database, createMockR2Bucket, createMockTimeseries } from './mocks/d1-mock';

describe('Performance Benchmarks', () => {
  let mockDb;
  let mockR2;

  const ONE_DAY = 24 * 3600;
  const benchmarkResults = [];

  beforeAll(() => {
    console.log('\n📊 Starting Performance Benchmarks...\n');
  });

  beforeEach(() => {
    mockDb = createMockD1Database();
    mockR2 = createMockR2Bucket();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('D1 Query Performance', () => {
    it('should benchmark 1-day query (1440 samples)', async () => {
      const site = 'bench-d1-1day';
      const now = Math.floor(Date.now() / 1000);
      const samples = createMockTimeseries(1440, {
        siteName: site,
        startTimestamp: now - ONE_DAY,
        intervalSeconds: 60
      });

      // Insert data
      const insertStart = performance.now();
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
      const insertDuration = performance.now() - insertStart;

      // Query data
      const queryStart = performance.now();
      const queryStmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `);

      const results = await queryStmt.bind(site, now - ONE_DAY).all();
      const queryDuration = performance.now() - queryStart;

      const benchmark = {
        test: 'D1 1-day query',
        samples: 1440,
        insertDuration: Math.round(insertDuration),
        queryDuration: Math.round(queryDuration),
        samplesPerSecond: Math.round(results.results.length / (queryDuration / 1000)),
        target: '<100ms',
        passed: queryDuration < 100
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(queryDuration).toBeLessThan(100); // Target: <100ms
    });

    it('should benchmark 1-week query (10080 samples)', async () => {
      const site = 'bench-d1-1week';
      const now = Math.floor(Date.now() / 1000);
      const samples = createMockTimeseries(10080, {
        siteName: site,
        startTimestamp: now - (7 * ONE_DAY),
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

      const queryStart = performance.now();
      const queryStmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `);

      const results = await queryStmt.bind(site, now - (7 * ONE_DAY)).all();
      const queryDuration = performance.now() - queryStart;

      const benchmark = {
        test: 'D1 1-week query',
        samples: 10080,
        queryDuration: Math.round(queryDuration),
        samplesPerSecond: Math.round(results.results.length / (queryDuration / 1000)),
        target: '<500ms',
        passed: queryDuration < 500
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(queryDuration).toBeLessThan(500); // Target: <500ms
    });

    it('should benchmark 1-month query (43200 samples)', async () => {
      const site = 'bench-d1-1month';
      const now = Math.floor(Date.now() / 1000);
      const samples = createMockTimeseries(43200, {
        siteName: site,
        startTimestamp: now - (30 * ONE_DAY),
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

      const queryStart = performance.now();
      const queryStmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `);

      const results = await queryStmt.bind(site, now - (30 * ONE_DAY)).all();
      const queryDuration = performance.now() - queryStart;

      const benchmark = {
        test: 'D1 1-month query',
        samples: 43200,
        queryDuration: Math.round(queryDuration),
        samplesPerSecond: Math.round(results.results.length / (queryDuration / 1000)),
        target: '<1000ms',
        passed: queryDuration < 1000
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(queryDuration).toBeLessThan(1000); // Target: <1s
    });

    it('should benchmark aggregation query (1 month with GROUP BY)', async () => {
      const site = 'bench-d1-agg';
      const now = Math.floor(Date.now() / 1000);
      const samples = createMockTimeseries(43200, {
        siteName: site,
        startTimestamp: now - (30 * ONE_DAY),
        intervalSeconds: 60
      });

      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, min_value, max_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const sample of samples) {
        await insertStmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.min_value,
          sample.max_value,
          sample.sample_count
        ).run();
      }

      const queryStart = performance.now();
      const queryStmt = mockDb.prepare(`
        SELECT
          point_name,
          AVG(avg_value) as overall_avg,
          MIN(min_value) as overall_min,
          MAX(max_value) as overall_max,
          SUM(sample_count) as total_samples
        FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
        GROUP BY point_name
      `);

      const results = await queryStmt.bind(site, now - (30 * ONE_DAY)).all();
      const queryDuration = performance.now() - queryStart;

      const benchmark = {
        test: 'D1 1-month aggregation',
        samples: 43200,
        queryDuration: Math.round(queryDuration),
        groups: results.results.length,
        target: '<1500ms',
        passed: queryDuration < 1500
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(queryDuration).toBeLessThan(1500); // Target: <1.5s
    });
  });

  describe('R2 Query Performance', () => {
    it('should benchmark R2 cache retrieval (10000 samples)', async () => {
      const site = 'bench-r2-10k';
      const samples = createMockTimeseries(10000, { siteName: site });

      // Store in R2
      const archiveKey = `archives/${site}/benchmark.json`;
      const archiveData = new TextEncoder().encode(JSON.stringify({ records: samples }));

      const uploadStart = performance.now();
      await mockR2.put(archiveKey, archiveData);
      const uploadDuration = performance.now() - uploadStart;

      // Retrieve from R2
      const downloadStart = performance.now();
      const retrieved = await mockR2.get(archiveKey);
      const data = JSON.parse(new TextDecoder().decode(await retrieved.arrayBuffer()));
      const downloadDuration = performance.now() - downloadStart;

      const benchmark = {
        test: 'R2 retrieval (10k)',
        samples: 10000,
        uploadDuration: Math.round(uploadDuration),
        downloadDuration: Math.round(downloadDuration),
        throughputMBps: ((archiveData.byteLength / (1024 * 1024)) / (downloadDuration / 1000)).toFixed(2),
        target: '<200ms',
        passed: downloadDuration < 200
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(downloadDuration).toBeLessThan(200); // Target: <200ms
      expect(data.records).toHaveLength(10000);
    });

    it('should benchmark R2 list operation (100 archives)', async () => {
      const site = 'bench-r2-list';

      // Create 100 mock archives
      const uploadStart = performance.now();
      for (let i = 0; i < 100; i++) {
        const key = `archives/${site}/archive-${i}.json`;
        await mockR2.put(key, new Uint8Array(1000));
      }
      const uploadDuration = performance.now() - uploadStart;

      // List archives
      const listStart = performance.now();
      const listed = await mockR2.list({ prefix: `archives/${site}/` });
      const listDuration = performance.now() - listStart;

      const benchmark = {
        test: 'R2 list (100 archives)',
        archiveCount: 100,
        uploadDuration: Math.round(uploadDuration),
        listDuration: Math.round(listDuration),
        target: '<100ms',
        passed: listDuration < 100
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(listDuration).toBeLessThan(100); // Target: <100ms
      expect(listed.objects).toHaveLength(100);
    });

    it('should benchmark R2 parallel fetch (10 archives)', async () => {
      const site = 'bench-r2-parallel';

      // Create 10 archives
      for (let i = 0; i < 10; i++) {
        const samples = createMockTimeseries(1000, { siteName: site });
        const key = `archives/${site}/archive-${i}.json`;
        const data = new TextEncoder().encode(JSON.stringify({ records: samples }));
        await mockR2.put(key, data);
      }

      // Fetch all archives in parallel
      const fetchStart = performance.now();
      const listed = await mockR2.list({ prefix: `archives/${site}/` });

      const fetchPromises = listed.objects.map(obj => mockR2.get(obj.key));
      const archives = await Promise.all(fetchPromises);

      const parsePromises = archives.map(archive =>
        archive.arrayBuffer().then(buf =>
          JSON.parse(new TextDecoder().decode(buf))
        )
      );
      const allData = await Promise.all(parsePromises);
      const fetchDuration = performance.now() - fetchStart;

      const totalRecords = allData.reduce((sum, d) => sum + d.records.length, 0);

      const benchmark = {
        test: 'R2 parallel fetch (10x1000)',
        archives: 10,
        totalRecords,
        fetchDuration: Math.round(fetchDuration),
        avgPerArchive: Math.round(fetchDuration / 10),
        target: '<500ms',
        passed: fetchDuration < 500
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(fetchDuration).toBeLessThan(500); // Target: <500ms
      expect(totalRecords).toBe(10000);
    });
  });

  describe('Split Query Performance (D1 + R2)', () => {
    it('should benchmark 1-year split query', async () => {
      const site = 'bench-split-1year';
      const now = Math.floor(Date.now() / 1000);
      const cutoff = now - (90 * ONE_DAY);

      // D1 recent data (90 days)
      const d1Samples = createMockTimeseries(12960, { // 90 days * 144 samples/day
        siteName: site,
        startTimestamp: cutoff,
        intervalSeconds: 600 // 10 min intervals
      });

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

      // R2 archived data (275 days)
      const r2Samples = createMockTimeseries(39600, { // 275 days * 144 samples/day
        siteName: site,
        startTimestamp: now - (365 * ONE_DAY),
        intervalSeconds: 600
      });

      const archiveKey = `archives/${site}/old-year.json`;
      await mockR2.put(
        archiveKey,
        new TextEncoder().encode(JSON.stringify({ records: r2Samples }))
      );

      // Execute split query
      const queryStart = performance.now();

      // Parallel fetch from both sources
      const [d1Results, r2Archive] = await Promise.all([
        mockDb.prepare(`
          SELECT * FROM timeseries_agg
          WHERE site_name = ? AND timestamp >= ?
        `).bind(site, cutoff).all(),

        mockR2.get(archiveKey).then(archive =>
          archive.arrayBuffer().then(buf =>
            JSON.parse(new TextDecoder().decode(buf))
          )
        )
      ]);

      // Merge results
      const merged = [...r2Archive.records, ...d1Results.results]
        .sort((a, b) => a.timestamp - b.timestamp);

      const queryDuration = performance.now() - queryStart;

      const benchmark = {
        test: 'Split query (1 year)',
        d1Samples: d1Results.results.length,
        r2Samples: r2Archive.records.length,
        totalSamples: merged.length,
        queryDuration: Math.round(queryDuration),
        samplesPerSecond: Math.round(merged.length / (queryDuration / 1000)),
        target: '<5000ms',
        passed: queryDuration < 5000
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(queryDuration).toBeLessThan(5000); // Target: <5s
      expect(merged.length).toBeGreaterThan(50000);
    });

    it('should benchmark 6-month split query with filtering', async () => {
      const site = 'bench-split-6month';
      const now = Math.floor(Date.now() / 1000);
      const cutoff = now - (90 * ONE_DAY);
      const targetPoints = ['point-0', 'point-1', 'point-2'];

      // D1 data
      const d1Samples = createMockTimeseries(6480, {
        siteName: site,
        startTimestamp: cutoff,
        intervalSeconds: 600
      });

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

      // R2 data
      const r2Samples = createMockTimeseries(10800, {
        siteName: site,
        startTimestamp: now - (180 * ONE_DAY),
        intervalSeconds: 600
      });

      const archiveKey = `archives/${site}/6months.json`;
      await mockR2.put(
        archiveKey,
        new TextEncoder().encode(JSON.stringify({ records: r2Samples }))
      );

      // Query with point filtering
      const queryStart = performance.now();

      const [d1Results, r2Archive] = await Promise.all([
        mockDb.prepare(`
          SELECT * FROM timeseries_agg
          WHERE site_name = ? AND point_name IN (?, ?, ?) AND timestamp >= ?
        `).bind(site, ...targetPoints, cutoff).all(),

        mockR2.get(archiveKey).then(archive =>
          archive.arrayBuffer().then(buf => {
            const data = JSON.parse(new TextDecoder().decode(buf));
            // Filter points from R2
            return data.records.filter(r => targetPoints.includes(r.point_name));
          })
        )
      ]);

      const merged = [...r2Archive, ...d1Results.results];
      const queryDuration = performance.now() - queryStart;

      const benchmark = {
        test: 'Split query (6 months, filtered)',
        points: targetPoints.length,
        totalSamples: merged.length,
        queryDuration: Math.round(queryDuration),
        target: '<3000ms',
        passed: queryDuration < 3000
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(queryDuration).toBeLessThan(3000); // Target: <3s
    });
  });

  describe('Bulk Operations', () => {
    it('should benchmark bulk insert (10000 records)', async () => {
      const samples = createMockTimeseries(10000);

      const insertStart = performance.now();
      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertPromises = samples.map(sample =>
        insertStmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run()
      );

      await Promise.all(insertPromises);
      const insertDuration = performance.now() - insertStart;

      const benchmark = {
        test: 'Bulk insert (10k)',
        samples: 10000,
        insertDuration: Math.round(insertDuration),
        insertsPerSecond: Math.round(10000 / (insertDuration / 1000)),
        target: '<2000ms',
        passed: insertDuration < 2000
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(insertDuration).toBeLessThan(2000); // Target: <2s
    });

    it('should benchmark bulk delete (10000 records)', async () => {
      const samples = createMockTimeseries(10000, {
        startTimestamp: Math.floor(Date.now() / 1000) - (200 * ONE_DAY)
      });

      // Insert data
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

      // Delete old data
      const cutoff = Math.floor(Date.now() / 1000) - (90 * ONE_DAY);

      const deleteStart = performance.now();
      const deleteStmt = mockDb.prepare(`
        DELETE FROM timeseries_agg WHERE timestamp < ?
      `);

      await deleteStmt.bind(cutoff).run();
      const deleteDuration = performance.now() - deleteStart;

      const benchmark = {
        test: 'Bulk delete (10k)',
        samples: 10000,
        deleteDuration: Math.round(deleteDuration),
        deletesPerSecond: Math.round(10000 / (deleteDuration / 1000)),
        target: '<1000ms',
        passed: deleteDuration < 1000
      };

      benchmarkResults.push(benchmark);
      printBenchmark(benchmark);

      expect(deleteDuration).toBeLessThan(1000); // Target: <1s
    });
  });
});

/**
 * Helper function to print benchmark results
 */
function printBenchmark(benchmark) {
  console.log(`✓ ${benchmark.test}`);
  console.log(`  Duration: ${benchmark.queryDuration || benchmark.insertDuration || benchmark.uploadDuration}ms`);
  console.log(`  Target: ${benchmark.target}`);
  console.log(`  Status: ${benchmark.passed ? '✅ PASS' : '❌ FAIL'}\n`);
}
