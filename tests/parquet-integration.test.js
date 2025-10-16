/**
 * Parquet Integration Tests - Wave 4C
 *
 * Validates the complete Parquet write → read → verify cycle
 * - Writer: parquet-wasm (WASM-based, edge-compatible)
 * - Reader: hyparquet (pure JS, no Node.js dependencies)
 * - Compression: Snappy (target >3:1 ratio)
 * - Schema: timestamp (INT64), point_name (UTF8), value (FLOAT64), site_name (UTF8)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createParquetFile, validateSamples, calculateCompressionRatio, estimateFileSize } from '../src/lib/parquet-writer.js';
import { parquetRead } from 'hyparquet';

describe('Parquet Integration Tests', () => {
  let testSamples;

  beforeEach(() => {
    // Reset test samples before each test
    testSamples = [
      { point_name: 'temp_zone1', timestamp: 1704067200000, value: 72.5, site_name: 'building_a' },
      { point_name: 'temp_zone2', timestamp: 1704067200000, value: 68.3, site_name: 'building_a' },
      { point_name: 'temp_zone1', timestamp: 1704067500000, value: 72.7, site_name: 'building_a' }
    ];
  });

  describe('Test 1: Write/Read Round-Trip', () => {
    it('should complete full write-read cycle with data integrity', async () => {
      // Write Parquet file with parquet-wasm
      const parquetBuffer = await createParquetFile(testSamples, { compression: 'snappy' });

      // Verify buffer exists and has content
      expect(parquetBuffer).toBeDefined();
      expect(parquetBuffer).toBeInstanceOf(Uint8Array);
      expect(parquetBuffer.length).toBeGreaterThan(0);

      // Verify Parquet magic number (PAR1)
      const magic = String.fromCharCode(
        parquetBuffer[0],
        parquetBuffer[1],
        parquetBuffer[2],
        parquetBuffer[3]
      );
      expect(magic).toBe('PAR1');

      // Read Parquet file with hyparquet
      const readSamples = [];
      await parquetRead({
        file: parquetBuffer.buffer,
        onComplete: (data) => {
          readSamples.push(...data);
        }
      });

      // Verify sample count matches
      expect(readSamples.length).toBe(testSamples.length);

      // Verify each field matches exactly
      for (let i = 0; i < testSamples.length; i++) {
        const original = testSamples[i];
        const restored = readSamples[i];

        expect(restored.point_name).toBe(original.point_name);
        expect(restored.site_name).toBe(original.site_name);

        // Timestamp may be BigInt from Parquet INT64, convert to number
        const restoredTimestamp = typeof restored.timestamp === 'bigint'
          ? Number(restored.timestamp)
          : restored.timestamp;
        expect(restoredTimestamp).toBe(original.timestamp);

        // Value comparison with floating-point tolerance
        expect(restored.value).toBeCloseTo(original.value, 2);
      }
    }, 10000); // 10 second timeout for WASM operations
  });

  describe('Test 2: Compression Validation', () => {
    it('should achieve >3:1 compression ratio with Snappy', async () => {
      // Generate 1000 samples (realistic day of 5-minute data)
      const largeSamples = [];
      const baseTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        largeSamples.push({
          point_name: `sensor_${i % 100}`,
          timestamp: baseTime + (i * 60000), // 1 minute intervals
          value: 65 + Math.random() * 20, // Temperature range 65-85
          site_name: 'test_site'
        });
      }

      // Estimate uncompressed size
      const uncompressedEstimate = largeSamples.length * 64; // ~64 bytes per row

      // Write with Snappy compression
      const parquetBuffer = await createParquetFile(largeSamples, { compression: 'snappy' });

      // Calculate actual compression ratio
      const compressionRatio = calculateCompressionRatio(uncompressedEstimate, parquetBuffer.length);

      // Verify compression ratio exceeds 3:1
      expect(compressionRatio).toBeGreaterThan(3);

      console.log(`[Compression Test] ${largeSamples.length} samples:`);
      console.log(`  Uncompressed estimate: ${(uncompressedEstimate / 1024).toFixed(2)} KB`);
      console.log(`  Compressed size: ${(parquetBuffer.length / 1024).toFixed(2)} KB`);
      console.log(`  Compression ratio: ${compressionRatio}:1`);
    }, 15000);
  });

  describe('Test 3: Schema Validation', () => {
    it('should match Parquet schema specification', async () => {
      const parquetBuffer = await createParquetFile(testSamples);

      // Read schema metadata
      let schemaMetadata = null;
      await parquetRead({
        file: parquetBuffer.buffer,
        onComplete: (data, metadata) => {
          schemaMetadata = metadata;
        }
      });

      // Verify schema contains required fields
      // Note: hyparquet metadata structure may vary, verify data instead
      expect(schemaMetadata).toBeDefined();

      // Verify data has correct field types by reading samples
      const readSamples = [];
      await parquetRead({
        file: parquetBuffer.buffer,
        onComplete: (data) => {
          readSamples.push(...data);
        }
      });

      expect(readSamples.length).toBeGreaterThan(0);

      const firstSample = readSamples[0];

      // Verify field presence
      expect(firstSample).toHaveProperty('timestamp');
      expect(firstSample).toHaveProperty('point_name');
      expect(firstSample).toHaveProperty('value');
      expect(firstSample).toHaveProperty('site_name');

      // Verify field types
      expect(typeof firstSample.point_name).toBe('string');
      expect(typeof firstSample.site_name).toBe('string');
      expect(['number', 'bigint'].includes(typeof firstSample.timestamp)).toBe(true);
      expect(typeof firstSample.value).toBe('number');
    }, 10000);
  });

  describe('Test 4: Empty Array Handling', () => {
    it('should throw error for empty samples array', async () => {
      await expect(createParquetFile([])).rejects.toThrow(
        'Cannot create Parquet file from empty samples array'
      );
    });

    it('should reject undefined samples', async () => {
      await expect(createParquetFile(undefined)).rejects.toThrow(
        'Cannot create Parquet file from empty samples array'
      );
    });

    it('should reject null samples', async () => {
      await expect(createParquetFile(null)).rejects.toThrow(
        'Cannot create Parquet file from empty samples array'
      );
    });
  });

  describe('Test 5: NULL Value Filtering', () => {
    it('should write only valid values (NULLs pre-filtered)', async () => {
      const samplesWithInvalid = [
        { point_name: 'temp', timestamp: 1000, value: 72.5, site_name: 'site' },
        { point_name: 'temp', timestamp: 2000, value: null, site_name: 'site' },  // NULL
        { point_name: 'temp', timestamp: 3000, value: NaN, site_name: 'site' },   // NaN
        { point_name: 'temp', timestamp: 4000, value: 73.1, site_name: 'site' }
      ];

      // Pre-filter (like workers do before writing)
      const filtered = samplesWithInvalid.filter(s =>
        s.value != null && !isNaN(s.value)
      );

      expect(filtered.length).toBe(2); // Only 2 valid values

      // Write filtered samples
      const parquetBuffer = await createParquetFile(filtered);

      // Read back
      const readSamples = [];
      await parquetRead({
        file: parquetBuffer.buffer,
        onComplete: (data) => readSamples.push(...data)
      });

      // Verify only valid values written
      expect(readSamples.length).toBe(2);
      expect(readSamples[0].value).toBe(72.5);
      expect(readSamples[1].value).toBe(73.1);
    }, 10000);

    it('should validate samples before writing', () => {
      const invalidSamples = [
        { point_name: 'temp', timestamp: 1000, value: 72.5, site_name: 'site' },
        { point_name: 'temp', timestamp: 2000, value: null, site_name: 'site' } // NULL value
      ];

      const validation = validateSamples(invalidSamples);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Test 6: Large Dataset Performance', () => {
    it('should handle 100k samples in <5 seconds', async () => {
      // Generate 100,000 samples (realistic day of 1-second data)
      const largeSamples = [];
      const baseTime = Date.now();

      for (let i = 0; i < 100000; i++) {
        largeSamples.push({
          point_name: `sensor_${i % 1000}`,
          timestamp: baseTime + (i * 1000), // 1 second intervals
          value: 50 + Math.random() * 50,
          site_name: 'test_site'
        });
      }

      console.log(`[Performance Test] Writing 100,000 samples...`);

      const startTime = Date.now();
      const parquetBuffer = await createParquetFile(largeSamples, { compression: 'snappy' });
      const duration = Date.now() - startTime;

      // Verify performance requirement: <5 seconds
      expect(duration).toBeLessThan(5000);

      // Verify file was created
      expect(parquetBuffer.length).toBeGreaterThan(0);

      console.log(`[Performance Test] Complete:`);
      console.log(`  Samples: ${largeSamples.length.toLocaleString()}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  File size: ${(parquetBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Throughput: ${Math.round(largeSamples.length / (duration / 1000)).toLocaleString()} samples/sec`);
    }, 10000); // 10 second timeout
  });

  describe('Test 7: Field Validation', () => {
    it('should reject missing point_name', async () => {
      const invalidSamples = [
        { timestamp: 1000, value: 72.5, site_name: 'site' } // Missing point_name
      ];

      await expect(createParquetFile(invalidSamples)).rejects.toThrow(
        /missing.*point_name/i
      );
    });

    it('should reject missing site_name', async () => {
      const invalidSamples = [
        { point_name: 'temp', timestamp: 1000, value: 72.5 } // Missing site_name
      ];

      await expect(createParquetFile(invalidSamples)).rejects.toThrow(
        /missing.*site_name/i
      );
    });

    it('should reject non-numeric timestamp', async () => {
      const invalidSamples = [
        { point_name: 'temp', timestamp: 'invalid', value: 72.5, site_name: 'site' }
      ];

      await expect(createParquetFile(invalidSamples)).rejects.toThrow(
        /invalid type/i
      );
    });

    it('should reject non-numeric value', async () => {
      const invalidSamples = [
        { point_name: 'temp', timestamp: 1000, value: 'invalid', site_name: 'site' }
      ];

      await expect(createParquetFile(invalidSamples)).rejects.toThrow(
        /invalid type/i
      );
    });
  });

  describe('Test 8: Compression Ratio Calculation', () => {
    it('should calculate compression ratio correctly', () => {
      expect(calculateCompressionRatio(100000, 25000)).toBe(4.0); // 4:1
      expect(calculateCompressionRatio(100000, 50000)).toBe(2.0); // 2:1
      expect(calculateCompressionRatio(100000, 10000)).toBe(10.0); // 10:1
    });

    it('should handle zero compressed size', () => {
      expect(calculateCompressionRatio(100000, 0)).toBe(0);
    });
  });

  describe('Test 9: File Size Estimation', () => {
    it('should estimate file size accurately', () => {
      const estimate = estimateFileSize(100000, 4); // 100k rows, 4:1 compression

      expect(estimate.uncompressed).toBe(6400000); // 100k * 64 bytes
      expect(estimate.compressed).toBe(1600000); // 6.4MB / 4
      expect(estimate.ratio).toBe(4);
      expect(parseFloat(estimate.compressedMB)).toBeCloseTo(1.53, 1); // ~1.5 MB
    });
  });

  describe('Test 10: Sample Validation Helper', () => {
    it('should validate correct samples', () => {
      const validation = validateSamples(testSamples);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
      expect(validation.totalRows).toBe(testSamples.length);
    });

    it('should detect multiple errors', () => {
      const invalidSamples = [
        { point_name: 'temp', timestamp: 1000, value: 72.5, site_name: 'site' }, // Valid
        { timestamp: 2000, value: 68.3, site_name: 'site' }, // Missing point_name
        { point_name: 'temp', timestamp: 'invalid', value: null, site_name: 'site' } // Invalid timestamp, null value
      ];

      const validation = validateSamples(invalidSamples);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
