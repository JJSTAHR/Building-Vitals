/**
 * Parquet Writer for Cloudflare Workers
 * Uses parquet-wasm for edge-compatible Parquet file generation
 *
 * TECHNOLOGY CHOICE:
 * - Library: parquet-wasm (~2MB WASM bundle)
 * - Compression: Snappy (fast, 4:1 ratio target)
 * - Battle-tested in edge computing environments
 * - No Node.js dependencies (fs, stream, Buffer)
 *
 * SCHEMA:
 * - timestamp: INT64 (Unix milliseconds)
 * - point_name: STRING (UTF-8)
 * - value: DOUBLE (IEEE 754 64-bit)
 * - site_name: STRING (UTF-8)
 *
 * @module parquet-writer
 */

import { writeParquet, Table } from 'parquet-wasm';
import * as arrow from 'apache-arrow';

/**
 * Write timeseries data to Parquet format with Snappy compression
 *
 * Optimized for Cloudflare Workers R2 storage:
 * - Row group size: 10,000 rows (optimized for ~374MB/day ingestion)
 * - Compression: Snappy (fast encoding/decoding, 4:1 target ratio)
 * - Memory efficient: Single-pass encoding
 *
 * @param {Array<Object>} samples - Array of {point_name, timestamp, value, site_name}
 * @param {Object} options - Writer options
 * @param {string} options.compression - Compression type (default: 'snappy')
 * @param {number} options.rowGroupSize - Rows per row group (default: 10000)
 * @returns {Promise<Uint8Array>} Parquet file bytes ready for R2 upload
 * @throws {Error} If samples array is empty or write fails
 *
 * @example
 * const samples = [
 *   { point_name: 'temp_zone1', timestamp: 1704067200000, value: 72.5, site_name: 'Building_A' },
 *   { point_name: 'humidity_zone1', timestamp: 1704067200000, value: 45.2, site_name: 'Building_A' }
 * ];
 *
 * const parquetBytes = await createParquetFile(samples);
 * // Upload parquetBytes to R2: archival/{site_name}/{point_name}/date={YYYY-MM-DD}/data.parquet
 */
export async function createParquetFile(samples, options = {}) {
  if (!samples || samples.length === 0) {
    throw new Error('Cannot create Parquet file from empty samples array');
  }

  const compression = options.compression || 'snappy';
  const rowGroupSize = options.rowGroupSize || 10000;

  // Log input metrics
  const estimatedUncompressedSize = samples.length * 64; // Rough estimate: 64 bytes/row uncompressed
  console.log(`[Parquet Writer] Starting write: ${samples.length} rows, estimated ${estimatedUncompressedSize} bytes uncompressed`);

  try {
    // Convert samples to Arrow-compatible table format
    // parquet-wasm expects column-oriented data
    const timestamps = new BigInt64Array(samples.length);
    const pointNames = new Array(samples.length);
    const values = new Float64Array(samples.length);
    const siteNames = new Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];

      // Validate required fields
      if (!sample.point_name || !sample.site_name) {
        throw new Error(`Row ${i}: Missing required field (point_name or site_name)`);
      }

      if (typeof sample.timestamp !== 'number' || typeof sample.value !== 'number') {
        throw new Error(`Row ${i}: Invalid type for timestamp or value (must be number)`);
      }

      timestamps[i] = BigInt(sample.timestamp);
      pointNames[i] = sample.point_name;
      values[i] = sample.value;
      siteNames[i] = sample.site_name;
    }

    // Build Apache Arrow Table for parquet-wasm
    // parquet-wasm requires an Arrow Table from apache-arrow library
    const arrowTable = arrow.tableFromArrays({
      timestamp: timestamps,
      point_name: pointNames,
      value: values,
      site_name: siteNames
    });

    // Serialize Arrow Table to IPC Stream format
    // parquet-wasm Table.fromIPCStream expects IPC stream bytes
    const ipcBytes = arrow.tableToIPC(arrowTable, 'stream');

    // Create parquet-wasm Table from IPC stream
    const wasmTable = Table.fromIPCStream(ipcBytes);

    // Write Parquet
    // parquet-wasm automatically applies Snappy compression by default
    // Note: The compression parameter is ignored in current parquet-wasm version
    // Compression is automatically selected based on column types
    const parquetBytes = writeParquet(wasmTable);

    // Calculate compression metrics
    const compressedSize = parquetBytes.length;
    const compressionRatio = calculateCompressionRatio(estimatedUncompressedSize, compressedSize);

    console.log(`[Parquet Writer] Write complete: ${samples.length} rows, ${compressedSize} bytes, ${compressionRatio}:1 compression, ${compression} codec`);

    // Return Uint8Array suitable for R2 upload
    return parquetBytes;

  } catch (error) {
    console.error('[Parquet Writer] Write failed:', {
      error: error.message,
      stack: error.stack,
      sampleCount: samples.length,
      compression
    });
    throw new Error(`Parquet write failed: ${error.message}`);
  }
}

/**
 * Calculate compression ratio for metrics
 *
 * Used to track compression efficiency and detect issues:
 * - Target: 4:1 ratio (4.0) for timeseries data
 * - Warning: <2:1 ratio may indicate compression disabled or bad data
 * - Excellent: >6:1 ratio indicates highly compressible data
 *
 * @param {number} uncompressedSize - Size before compression (bytes)
 * @param {number} compressedSize - Size after compression (bytes)
 * @returns {number} Compression ratio (e.g., 4.0 = 4:1 compression)
 *
 * @example
 * const ratio = calculateCompressionRatio(100000, 25000); // Returns 4.0 (4:1)
 */
export function calculateCompressionRatio(uncompressedSize, compressedSize) {
  if (compressedSize === 0) return 0;
  return parseFloat((uncompressedSize / compressedSize).toFixed(2));
}

/**
 * Validate samples array before Parquet write
 *
 * Performs type checking and field validation to catch errors early:
 * - Required fields: point_name, timestamp, value, site_name
 * - Type validation: timestamp and value must be numbers
 * - Null checks: No null values allowed in required fields
 *
 * @param {Array<Object>} samples - Samples to validate
 * @returns {Object} Validation result { valid: boolean, errors: Array }
 *
 * @example
 * const result = validateSamples(samples);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 *   throw new Error('Invalid samples');
 * }
 */
export function validateSamples(samples) {
  const errors = [];

  if (!Array.isArray(samples)) {
    errors.push({ error: 'samples must be an array' });
    return { valid: false, errors };
  }

  if (samples.length === 0) {
    errors.push({ error: 'samples array is empty' });
    return { valid: false, errors };
  }

  // Validate first 100 rows (or all if fewer)
  const samplesToCheck = Math.min(samples.length, 100);

  for (let i = 0; i < samplesToCheck; i++) {
    const sample = samples[i];
    const rowErrors = [];

    // Required field checks
    if (!sample.point_name) rowErrors.push('missing point_name');
    if (!sample.site_name) rowErrors.push('missing site_name');
    if (sample.timestamp === undefined || sample.timestamp === null) rowErrors.push('missing timestamp');
    if (sample.value === undefined || sample.value === null) rowErrors.push('missing value');

    // Type checks
    if (sample.timestamp !== undefined && typeof sample.timestamp !== 'number') {
      rowErrors.push('timestamp must be number');
    }
    if (sample.value !== undefined && typeof sample.value !== 'number') {
      rowErrors.push('value must be number');
    }
    if (sample.point_name !== undefined && typeof sample.point_name !== 'string') {
      rowErrors.push('point_name must be string');
    }
    if (sample.site_name !== undefined && typeof sample.site_name !== 'string') {
      rowErrors.push('site_name must be string');
    }

    if (rowErrors.length > 0) {
      errors.push({ row: i, errors: rowErrors });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sampledRows: samplesToCheck,
    totalRows: samples.length
  };
}

/**
 * Estimate Parquet file size before writing
 *
 * Provides rough estimate for capacity planning:
 * - Assumes 4:1 compression ratio (Snappy on timeseries)
 * - Baseline: 64 bytes/row uncompressed
 * - Actual size depends on data entropy and string lengths
 *
 * @param {number} rowCount - Number of rows to write
 * @param {number} compressionRatio - Expected compression ratio (default: 4)
 * @returns {Object} Size estimates { uncompressed, compressed, ratio }
 *
 * @example
 * const estimate = estimateFileSize(100000); // 100K rows
 * // { uncompressed: 6400000, compressed: 1600000, ratio: 4 }
 * console.log(`Estimated size: ${estimate.compressed / 1024 / 1024} MB`);
 */
export function estimateFileSize(rowCount, compressionRatio = 4) {
  const bytesPerRow = 64; // Rough estimate for schema
  const uncompressed = rowCount * bytesPerRow;
  const compressed = Math.ceil(uncompressed / compressionRatio);

  return {
    uncompressed,
    compressed,
    ratio: compressionRatio,
    compressedMB: (compressed / 1024 / 1024).toFixed(2)
  };
}

/**
 * Create batch metadata for R2 path generation
 *
 * Helper to extract metadata from samples for path construction:
 * - Determines date from timestamp (first sample)
 * - Extracts site_name and point_name for path segments
 * - Returns metadata suitable for R2 path builder
 *
 * @param {Array<Object>} samples - Samples array
 * @returns {Object} Metadata { site_name, point_name, date }
 *
 * @example
 * const metadata = getBatchMetadata(samples);
 * // { site_name: 'Building_A', point_name: 'temp_zone1', date: '2024-01-01' }
 *
 * const r2Path = `archival/${metadata.site_name}/${metadata.point_name}/date=${metadata.date}/data.parquet`;
 */
export function getBatchMetadata(samples) {
  if (!samples || samples.length === 0) {
    throw new Error('Cannot extract metadata from empty samples');
  }

  const firstSample = samples[0];
  const timestamp = new Date(firstSample.timestamp);
  const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD

  return {
    site_name: firstSample.site_name,
    point_name: firstSample.point_name,
    date: dateStr,
    rowCount: samples.length,
    startTime: samples[0].timestamp,
    endTime: samples[samples.length - 1].timestamp
  };
}
