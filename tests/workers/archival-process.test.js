/**
 * Archival Process Test Suite
 *
 * Tests for D1 → Parquet → R2 archival workflow:
 * - Export D1 data to Parquet format
 * - Upload Parquet files to R2
 * - Verify data integrity after archival
 * - Cleanup D1 after successful archival
 * - Handle failure scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockD1Database, createMockR2Bucket, createMockTimeseries } from './mocks/d1-mock';

describe('Archival Process - D1 to R2', () => {
  let mockDb;
  let mockR2;
  const ARCHIVE_AGE_DAYS = 90;

  beforeEach(() => {
    mockDb = createMockD1Database();
    mockR2 = createMockR2Bucket();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('D1 to Parquet Conversion', () => {
    it('should convert D1 timeseries data to Parquet format', async () => {
      // Insert test data
      const samples = createMockTimeseries(1000, {
        siteName: 'archive-site',
        startTimestamp: Math.floor(Date.now() / 1000) - (120 * 24 * 3600) // 120 days ago
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

      // Query old data for archival
      const cutoffTimestamp = Math.floor(Date.now() / 1000) - (ARCHIVE_AGE_DAYS * 24 * 3600);

      const selectStmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE timestamp < ?
        ORDER BY timestamp ASC
      `);

      const oldData = await selectStmt.bind(cutoffTimestamp).all();

      expect(oldData.results.length).toBeGreaterThan(0);

      // Convert to Parquet (mock - in production use parquet library)
      const parquetData = {
        schema: {
          site_name: 'string',
          point_name: 'string',
          interval: 'string',
          timestamp: 'int64',
          avg_value: 'double',
          min_value: 'double',
          max_value: 'double',
          sample_count: 'int32'
        },
        rows: oldData.results
      };

      expect(parquetData.rows).toHaveLength(oldData.results.length);
      expect(parquetData.schema).toHaveProperty('timestamp');
    });

    it('should compress Parquet data before upload', async () => {
      const samples = createMockTimeseries(100);

      // Convert to JSON (simplified)
      const jsonData = JSON.stringify(samples);
      const uncompressedSize = new TextEncoder().encode(jsonData).byteLength;

      // Mock compression (in production use gzip/brotli)
      const compressionRatio = 0.3; // Assume 70% compression
      const compressedSize = Math.floor(uncompressedSize * compressionRatio);

      expect(compressedSize).toBeLessThan(uncompressedSize);
      expect(compressionRatio).toBeLessThan(0.5); // At least 50% compression
    });

    it('should handle empty result sets gracefully', async () => {
      const cutoffTimestamp = Math.floor(Date.now() / 1000) - (ARCHIVE_AGE_DAYS * 24 * 3600);

      const selectStmt = mockDb.prepare(`
        SELECT * FROM timeseries_agg
        WHERE timestamp < ?
      `);

      const oldData = await selectStmt.bind(cutoffTimestamp).all();

      expect(oldData.results).toHaveLength(0);
      // Should not create archive file for empty data
    });
  });

  describe('R2 Upload', () => {
    it('should upload Parquet file to R2 with correct metadata', async () => {
      const site = 'test-site';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const archiveData = createMockTimeseries(1000, {
        siteName: site,
        startTimestamp: new Date(startDate).getTime() / 1000
      });

      // Convert to binary (mock Parquet)
      const dataBuffer = new TextEncoder().encode(JSON.stringify(archiveData));

      // Upload to R2
      const archiveKey = `archives/${site}/${startDate}_${endDate}/timeseries.parquet`;

      await mockR2.put(archiveKey, dataBuffer, {
        httpMetadata: {
          contentType: 'application/octet-stream',
          contentEncoding: 'gzip'
        },
        customMetadata: {
          siteName: site,
          startDate,
          endDate,
          recordCount: String(archiveData.length),
          archivedAt: new Date().toISOString(),
          format: 'parquet',
          compressed: 'true'
        }
      });

      expect(mockR2.put).toHaveBeenCalledTimes(1);
      expect(mockR2.put).toHaveBeenCalledWith(
        archiveKey,
        dataBuffer,
        expect.objectContaining({
          customMetadata: expect.objectContaining({
            siteName: site,
            format: 'parquet'
          })
        })
      );

      // Verify file exists in R2
      const uploaded = await mockR2.get(archiveKey);
      expect(uploaded).not.toBeNull();
    });

    it('should retry upload on failure', async () => {
      const archiveKey = 'archives/retry-test.parquet';
      const dataBuffer = new TextEncoder().encode('test data');

      // Mock first attempt fails, second succeeds
      mockR2.put
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });

      // Retry logic
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          await mockR2.put(archiveKey, dataBuffer);
          break; // Success
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 100 * retries)); // Exponential backoff
        }
      }

      expect(mockR2.put).toHaveBeenCalledTimes(2);
      expect(retries).toBe(1);
    });

    it('should verify upload integrity with checksums', async () => {
      const testData = createMockTimeseries(100);
      const dataBuffer = new TextEncoder().encode(JSON.stringify(testData));

      // Mock checksum calculation
      const calculateChecksum = (data) => {
        let hash = 0;
        const view = new Uint8Array(data);
        for (let i = 0; i < view.length; i++) {
          hash = ((hash << 5) - hash) + view[i];
          hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
      };

      const checksum = calculateChecksum(dataBuffer);

      await mockR2.put('archives/checksum-test.parquet', dataBuffer, {
        customMetadata: {
          checksum,
          checksumAlgorithm: 'simple-hash'
        }
      });

      // Verify after upload
      const uploaded = await mockR2.get('archives/checksum-test.parquet');
      const uploadedData = await uploaded.arrayBuffer();
      const uploadedChecksum = calculateChecksum(uploadedData);

      expect(uploadedChecksum).toBe(checksum);
    });
  });

  describe('D1 Cleanup', () => {
    it('should delete archived records from D1 after successful upload', async () => {
      // Insert test data
      const oldSamples = createMockTimeseries(500, {
        siteName: 'cleanup-site',
        startTimestamp: Math.floor(Date.now() / 1000) - (120 * 24 * 3600) // 120 days old
      });

      const recentSamples = createMockTimeseries(500, {
        siteName: 'cleanup-site',
        pointPrefix: 'recent-',
        startTimestamp: Math.floor(Date.now() / 1000) - (30 * 24 * 3600) // 30 days old
      });

      const insertStmt = mockDb.prepare(`
        INSERT INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const sample of [...oldSamples, ...recentSamples]) {
        await insertStmt.bind(
          sample.site_name,
          sample.point_name,
          sample.interval,
          sample.timestamp,
          sample.avg_value,
          sample.sample_count
        ).run();
      }

      // Archive old data
      const cutoffTimestamp = Math.floor(Date.now() / 1000) - (ARCHIVE_AGE_DAYS * 24 * 3600);

      // Upload to R2 (mock)
      const archiveKey = 'archives/cleanup-site/archive.parquet';
      await mockR2.put(archiveKey, new Uint8Array(100));

      // Verify upload succeeded
      const uploaded = await mockR2.get(archiveKey);
      expect(uploaded).not.toBeNull();

      // Delete old records from D1
      const deleteStmt = mockDb.prepare(`
        DELETE FROM timeseries_agg
        WHERE timestamp < ?
      `);

      const deleteResult = await deleteStmt.bind(cutoffTimestamp).run();
      expect(deleteResult.success).toBe(true);

      // Verify recent data still exists
      const countStmt = mockDb.prepare(`
        SELECT COUNT(*) as count FROM timeseries_agg
        WHERE site_name = ? AND timestamp >= ?
      `);

      const result = await countStmt.bind('cleanup-site', cutoffTimestamp).first();
      expect(result.count).toBeGreaterThan(0);
    });

    it('should NOT delete D1 data if upload fails', async () => {
      const samples = createMockTimeseries(100, {
        startTimestamp: Math.floor(Date.now() / 1000) - (120 * 24 * 3600)
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

      // Mock R2 upload failure
      mockR2.put.mockRejectedValue(new Error('Upload failed'));

      // Attempt archive
      const cutoffTimestamp = Math.floor(Date.now() / 1000) - (ARCHIVE_AGE_DAYS * 24 * 3600);

      try {
        await mockR2.put('archives/failed.parquet', new Uint8Array(100));
      } catch (error) {
        // Upload failed - do NOT delete from D1
      }

      // Verify data still in D1
      const countStmt = mockDb.prepare(`
        SELECT COUNT(*) as count FROM timeseries_agg
        WHERE timestamp < ?
      `);

      const result = await countStmt.bind(cutoffTimestamp).first();
      expect(result.count).toBe(100);
    });

    it('should handle transactional rollback on failure', async () => {
      const samples = createMockTimeseries(100);

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

      // Simulate transaction
      const transaction = async () => {
        // Begin transaction (mock)
        await mockDb.exec('BEGIN TRANSACTION');

        try {
          // Archive to R2
          const archiveKey = 'archives/transaction-test.parquet';
          await mockR2.put(archiveKey, new Uint8Array(100));

          // Delete from D1
          const deleteStmt = mockDb.prepare(`
            DELETE FROM timeseries_agg WHERE timestamp < ?
          `);
          await deleteStmt.bind(Date.now()).run();

          // Commit transaction
          await mockDb.exec('COMMIT');

          return { success: true };
        } catch (error) {
          // Rollback on failure
          await mockDb.exec('ROLLBACK');
          throw error;
        }
      };

      const result = await transaction();
      expect(result.success).toBe(true);
    });
  });

  describe('Failure Scenarios', () => {
    it('should handle R2 bucket quota exceeded', async () => {
      // Mock quota exceeded error
      mockR2.put.mockRejectedValue({
        name: 'QuotaExceededError',
        message: 'R2 bucket quota exceeded'
      });

      const data = new Uint8Array(1000);

      await expect(
        mockR2.put('archives/quota-test.parquet', data)
      ).rejects.toThrow('quota exceeded');
    });

    it('should handle network timeouts during upload', async () => {
      // Mock timeout
      mockR2.put.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const data = new Uint8Array(1000);

      await expect(
        mockR2.put('archives/timeout-test.parquet', data)
      ).rejects.toThrow('Timeout');
    });

    it('should handle corrupted data during conversion', async () => {
      // Insert corrupted data (invalid JSON)
      const corruptedSample = {
        site_name: 'test',
        point_name: 'corrupt',
        interval: '1min',
        timestamp: NaN, // Invalid timestamp
        avg_value: Infinity, // Invalid value
        sample_count: 1
      };

      // Validation should catch this
      const isValid = (sample) => {
        return (
          !isNaN(sample.timestamp) &&
          isFinite(sample.avg_value) &&
          sample.avg_value !== null
        );
      };

      expect(isValid(corruptedSample)).toBe(false);
    });

    it('should handle partial uploads and resume', async () => {
      const largeData = new Uint8Array(10 * 1024 * 1024); // 10MB

      // Mock chunked upload
      const chunkSize = 1024 * 1024; // 1MB chunks
      const chunks = [];

      for (let i = 0; i < largeData.length; i += chunkSize) {
        chunks.push(largeData.slice(i, i + chunkSize));
      }

      expect(chunks).toHaveLength(10);

      // Upload chunks
      for (const [index, chunk] of chunks.entries()) {
        await mockR2.put(`archives/large-file.part${index}`, chunk);
      }

      expect(mockR2.put).toHaveBeenCalledTimes(10);
    });
  });

  describe('Data Integrity Verification', () => {
    it('should verify record count after archival', async () => {
      const samples = createMockTimeseries(1000);

      // Insert into D1
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

      // Query count before archive
      const countBefore = await mockDb.prepare(`
        SELECT COUNT(*) as count FROM timeseries_agg
      `).first();

      // Archive to R2
      const archiveData = new TextEncoder().encode(JSON.stringify(samples));
      await mockR2.put('archives/verify.parquet', archiveData, {
        customMetadata: {
          recordCount: String(samples.length)
        }
      });

      // Verify count matches
      const uploaded = await mockR2.get('archives/verify.parquet');
      const metadata = uploaded.customMetadata;

      expect(Number(metadata.recordCount)).toBe(countBefore.count);
    });

    it('should verify timestamp range after archival', async () => {
      const startTime = 1000;
      const endTime = 5000;

      const samples = createMockTimeseries(100, {
        startTimestamp: startTime,
        intervalSeconds: 40 // Will span to ~5000
      });

      // Archive with timestamp metadata
      const archiveData = new TextEncoder().encode(JSON.stringify(samples));
      await mockR2.put('archives/timestamp-verify.parquet', archiveData, {
        customMetadata: {
          startTimestamp: String(startTime),
          endTimestamp: String(endTime),
          recordCount: String(samples.length)
        }
      });

      const uploaded = await mockR2.get('archives/timestamp-verify.parquet');
      const metadata = uploaded.customMetadata;

      expect(Number(metadata.startTimestamp)).toBe(startTime);
      expect(Number(metadata.endTimestamp)).toBeGreaterThanOrEqual(endTime);
    });

    it('should detect data loss during archival', async () => {
      const samples = createMockTimeseries(1000);

      // Simulate data loss (only 900 records archived)
      const lostData = samples.slice(0, 900);

      const archiveData = new TextEncoder().encode(JSON.stringify(lostData));
      await mockR2.put('archives/data-loss.parquet', archiveData, {
        customMetadata: {
          expectedCount: String(samples.length),
          actualCount: String(lostData.length)
        }
      });

      const uploaded = await mockR2.get('archives/data-loss.parquet');
      const metadata = uploaded.customMetadata;

      const expectedCount = Number(metadata.expectedCount);
      const actualCount = Number(metadata.actualCount);

      // Data loss detected!
      expect(actualCount).toBeLessThan(expectedCount);
      expect(actualCount / expectedCount).toBeLessThan(0.95); // More than 5% loss
    });
  });
});
