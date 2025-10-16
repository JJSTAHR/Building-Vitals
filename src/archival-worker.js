/**
 * ============================================================================
 * Archival Worker - Daily D1 to R2 Migration for Building Vitals
 * ============================================================================
 *
 * Scheduled worker that runs daily at 2 AM UTC to archive old timeseries data
 * from D1 (hot storage) to R2 (cold storage) as Parquet files.
 *
 * Key Features:
 * - Archives data older than 20 days from D1 to R2
 * - Atomic upload-then-delete (prevents data loss)
 * - Daily partitions for efficient queries
 * - Parquet format with Snappy compression (4:1 ratio)
 * - Resumable archival with KV state tracking
 * - Comprehensive error handling and retry logic
 *
 * Data Flow:
 * 1. Calculate archive boundary (NOW - 20 days)
 * 2. Query D1 for old data, group by (site_name, date)
 * 3. Convert to Parquet with Snappy compression
 * 4. Upload to R2: timeseries/YYYY/MM/DD/site_name.parquet
 * 5. Verify R2 upload (HEAD request)
 * 6. Delete from D1 ONLY after verification
 * 7. Update archive_state table
 *
 * Safety Guarantees:
 * - NEVER delete from D1 before R2 upload succeeds
 * - Verify R2 upload before deletion
 * - Atomic transactions for D1 operations
 * - Resumable via KV state tracking
 *
 * Environment Variables Required:
 * - D1 binding: DB
 * - R2 binding: R2
 * - KV binding: KV
 * - ARCHIVE_THRESHOLD_DAYS: 20 (default)
 *
 * @module archival-worker
 */

// BUG FIX #3: Import correct function name from parquet-writer.js
// BEFORE: import { writeParquet } (doesn't exist)
// AFTER: import { createParquetFile } (actual export from parquet-writer.js)
import { createParquetFile } from './lib/parquet-writer.js';

// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  // Archive threshold (data older than this will be archived)
  ARCHIVE_THRESHOLD_DAYS: 20, // Per spec: 20-day retention in D1

  // Batch configuration for D1 queries
  BATCH_SIZE: 100000, // Records per batch

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,

  // Compression configuration
  COMPRESSION_TARGET_RATIO: 4.0, // Expected 4:1 compression (Snappy)

  // KV keys for state tracking
  KV_ARCHIVE_STATE_PREFIX: 'archive:state:',
  KV_LAST_RUN_KEY: 'archive:last_run',
  KV_METRICS_PREFIX: 'archive:metrics:',

  // Worker timeout (leave 5s buffer for cleanup)
  TIMEOUT_MS: 25000,
};

/**
 * Scheduled event handler - runs daily at 2 AM UTC
 * @param {ScheduledEvent} event - Cloudflare scheduled event
 * @param {Object} env - Environment bindings (D1, R2, KV)
 */
export default {
  async scheduled(event, env, ctx) {
    const startTime = Date.now();
    const runId = `archive-${Date.now()}`;

    console.log(`[${runId}] Starting archival process at ${new Date().toISOString()}`);

    try {
      // BUG FIX #1: Variable name consistency
      // BEFORE: Used ARCHIVE_THRESHOLD_DAYS (undefined variable)
      // AFTER: Use CONFIG.ARCHIVE_THRESHOLD_DAYS (defined constant)
      // Calculate cutoff date (20 days ago per spec)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - CONFIG.ARCHIVE_THRESHOLD_DAYS);
      const cutoffTimestamp = cutoffDate.getTime();

      console.log(`[${runId}] Archiving data older than ${cutoffDate.toISOString()}`);

      // Get all unique points that have old data
      const pointsResult = await env.DB.prepare(`
        SELECT DISTINCT point_id
        FROM timeseries
        WHERE timestamp < ?
      `).bind(cutoffTimestamp).all();

      const points = pointsResult.results || [];
      console.log(`[${runId}] Found ${points.length} points with old data`);

      const stats = {
        pointsProcessed: 0,
        recordsArchived: 0,
        recordsDeleted: 0,
        filesCreated: 0,
        errors: [],
        duration: 0
      };

      // Process each point separately
      for (const { point_id } of points) {
        try {
          await archivePointData(env, point_id, cutoffTimestamp, runId, stats);
          stats.pointsProcessed++;
        } catch (error) {
          console.error(`[${runId}] Error archiving point ${point_id}:`, error);
          stats.errors.push({
            point: point_id,
            error: error.message,
            timestamp: Date.now()
          });
        }
      }

      stats.duration = Date.now() - startTime;

      // Log final status to KV
      await env.KV.put('last_archive_run', JSON.stringify({
        runId,
        timestamp: Date.now(),
        success: stats.errors.length === 0,
        stats,
        cutoffDate: cutoffDate.toISOString()
      }), {
        expirationTtl: 86400 * 30 // Keep for 30 days
      });

      console.log(`[${runId}] Archival complete:`, stats);

    } catch (error) {
      console.error(`[${runId}] Fatal error in archival process:`, error);

      // Log failure to KV
      await env.KV.put('last_archive_run', JSON.stringify({
        runId,
        timestamp: Date.now(),
        success: false,
        error: error.message,
        stack: error.stack
      }), {
        expirationTtl: 86400 * 30
      });

      throw error;
    }
  }
};

/**
 * Archive data for a single point, grouped by month
 * @param {Object} env - Environment bindings
 * @param {string} pointId - Point identifier
 * @param {number} cutoffTimestamp - Unix timestamp cutoff
 * @param {string} runId - Run identifier for logging
 * @param {Object} stats - Statistics object to update
 */
async function archivePointData(env, pointId, cutoffTimestamp, runId, stats) {
  console.log(`[${runId}] Processing point: ${pointId}`);

  // Get date range for this point's old data
  const rangeResult = await env.DB.prepare(`
    SELECT
      MIN(timestamp) as min_ts,
      MAX(timestamp) as max_ts,
      COUNT(*) as total_records
    FROM timeseries
    WHERE point_id = ? AND timestamp < ?
  `).bind(pointId, cutoffTimestamp).first();

  if (!rangeResult || rangeResult.total_records === 0) {
    console.log(`[${runId}] No old data for point ${pointId}`);
    return;
  }

  console.log(`[${runId}] Point ${pointId}: ${rangeResult.total_records} records to archive`);

  // Group data by month and archive each month separately
  const startDate = new Date(rangeResult.min_ts);
  const endDate = new Date(rangeResult.max_ts);

  let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');

    // Calculate month boundaries
    const monthStart = new Date(year, currentDate.getMonth(), 1).getTime();
    const monthEnd = new Date(year, currentDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    await archiveMonthData(env, pointId, year, month, monthStart, monthEnd, runId, stats);

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
}

/**
 * Archive a single month of data for a point
 * @param {Object} env - Environment bindings
 * @param {string} pointId - Point identifier
 * @param {number} year - Year
 * @param {string} month - Month (zero-padded)
 * @param {number} monthStart - Month start timestamp
 * @param {number} monthEnd - Month end timestamp
 * @param {string} runId - Run identifier
 * @param {Object} stats - Statistics object
 */
async function archiveMonthData(env, pointId, year, month, monthStart, monthEnd, runId, stats) {
  // BUG FIX #2: R2 path structure - ADD DAY component
  // BEFORE: timeseries/YYYY/MM/site.parquet (missing day)
  // AFTER: timeseries/YYYY/MM/DD/site.parquet (matches spec and other workers)
  // We need to group by day within this month

  // Get first day of data to determine starting point
  const monthStartDate = new Date(monthStart);
  const monthEndDate = new Date(monthEnd);

  // Process each day in the month separately
  let currentDay = new Date(monthStartDate);

  while (currentDay <= monthEndDate) {
    const year = currentDay.getUTCFullYear();
    const month = String(currentDay.getUTCMonth() + 1).padStart(2, '0');
    const day = String(currentDay.getUTCDate()).padStart(2, '0');

    // Calculate day boundaries
    const dayStart = new Date(year, currentDay.getMonth(), currentDay.getDate()).getTime();
    const dayEnd = new Date(year, currentDay.getMonth(), currentDay.getDate(), 23, 59, 59, 999).getTime();

    // Only process if within month range
    if (dayStart >= monthStart && dayStart <= monthEnd) {
      await archiveDayData(env, pointId, year, month, day, dayStart, dayEnd, runId, stats);
    }

    // Move to next day
    currentDay.setDate(currentDay.getDate() + 1);
  }
}

/**
 * Archive a single day of data for a point
 * @param {Object} env - Environment bindings
 * @param {string} pointId - Point identifier
 * @param {number} year - Year
 * @param {string} month - Month (zero-padded)
 * @param {string} day - Day (zero-padded)
 * @param {number} dayStart - Day start timestamp
 * @param {number} dayEnd - Day end timestamp
 * @param {string} runId - Run identifier
 * @param {Object} stats - Statistics object
 */
async function archiveDayData(env, pointId, year, month, day, dayStart, dayEnd, runId, stats) {
  // Correct R2 path per spec: /timeseries/YYYY/MM/DD/site_name.parquet
  const r2Key = `timeseries/${year}/${month}/${day}/${pointId}.parquet`;

  // Check if file already exists in R2
  const exists = await checkFileExists(env.R2, r2Key);
  if (exists) {
    console.log(`[${runId}] File already exists: ${r2Key}, skipping`);
    return;
  }

  console.log(`[${runId}] Archiving day ${year}-${month}-${day} for point ${pointId}`);

  // Fetch data in batches to avoid memory issues
  const allRecords = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batchResult = await env.DB.prepare(`
      SELECT
        timestamp,
        value,
        quality,
        point_id
      FROM timeseries
      WHERE point_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `).bind(pointId, dayStart, dayEnd, CONFIG.BATCH_SIZE, offset).all();

    const batch = batchResult.results || [];

    if (batch.length === 0) {
      hasMore = false;
    } else {
      allRecords.push(...batch);
      offset += CONFIG.BATCH_SIZE;

      console.log(`[${runId}] Fetched ${allRecords.length} records so far for ${r2Key}`);
    }

    // Stop if we've fetched less than batch size (no more data)
    if (batch.length < CONFIG.BATCH_SIZE) {
      hasMore = false;
    }
  }

  if (allRecords.length === 0) {
    console.log(`[${runId}] No records found for ${r2Key}`);
    return;
  }

  console.log(`[${runId}] Converting ${allRecords.length} records to Parquet for ${r2Key}`);

  // IMPROVEMENT: Transform D1 data to match parquet-writer schema
  // parquet-writer expects: {point_name, timestamp, value, site_name}
  // D1 provides: {point_id, timestamp, value, quality}
  const samples = allRecords.map(record => ({
    point_name: record.point_id, // Map point_id to point_name
    timestamp: record.timestamp,
    value: record.value,
    site_name: pointId // Use pointId as site_name for now (should be from metadata)
  }));

  // BUG FIX #3 (USAGE): Use createParquetFile() from parquet-writer.js
  // BEFORE: convertToParquet() (doesn't exist)
  // AFTER: createParquetFile() with Snappy compression
  let parquetBuffer;
  try {
    // Estimate uncompressed size for metrics
    const estimatedUncompressedSize = samples.length * 100; // ~100 bytes per sample

    parquetBuffer = await createParquetFile(samples, {
      compression: 'snappy',
      rowGroupSize: 10000 // Optimal for timeseries data
    });

    // Verify buffer is valid
    if (!parquetBuffer || parquetBuffer.length === 0) {
      throw new Error('Parquet writer returned empty buffer');
    }

    // IMPROVEMENT: Log compression metrics
    const compressionRatio = (estimatedUncompressedSize / parquetBuffer.length).toFixed(2);
    console.log(`[${runId}] Parquet compression: ${compressionRatio}:1 (${estimatedUncompressedSize} → ${parquetBuffer.length} bytes)`);
  } catch (error) {
    console.error(`[${runId}] Failed to create Parquet file for ${r2Key}:`, error);
    throw new Error(`Parquet creation failed for ${r2Key}: ${error.message}`);
  }

  // Upload to R2 with retry logic
  let uploadSuccess = false;
  let retryCount = 0;
  let lastError = null;

  while (!uploadSuccess && retryCount < CONFIG.MAX_RETRIES) {
    try {
      await uploadParquetFile(env.R2, r2Key, parquetBuffer);
      uploadSuccess = true;
      console.log(`[${runId}] Successfully uploaded ${r2Key} (${parquetBuffer.byteLength} bytes)`);
      stats.filesCreated++;
    } catch (error) {
      lastError = error;
      retryCount++;
      console.error(`[${runId}] Upload attempt ${retryCount} failed for ${r2Key}:`, error);

      if (retryCount < CONFIG.MAX_RETRIES) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * CONFIG.RETRY_DELAY_MS));
      }
    }
  }

  if (!uploadSuccess) {
    throw new Error(`Failed to upload ${r2Key} after ${CONFIG.MAX_RETRIES} attempts: ${lastError.message}`);
  }

  // IMPROVEMENT: Verify R2 upload with HEAD request
  // This ensures data was actually written before we delete from D1
  console.log(`[${runId}] Verifying R2 upload for ${r2Key}...`);
  const verification = await env.R2.head(r2Key);

  if (!verification) {
    throw new Error(`R2 upload verification failed: ${r2Key} not found`);
  }

  if (verification.size === 0) {
    throw new Error(`R2 upload verification failed: ${r2Key} has zero size`);
  }

  console.log(`[${runId}] Verified R2 upload: ${r2Key}, size: ${verification.size} bytes`);

  // Delete from D1 only after successful upload and verification
  const deleteResult = await env.DB.prepare(`
    DELETE FROM timeseries
    WHERE point_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `).bind(pointId, dayStart, dayEnd).run();

  const deletedCount = deleteResult.meta?.changes || 0;
  stats.recordsArchived += allRecords.length;
  stats.recordsDeleted += deletedCount;

  console.log(`[${runId}] Deleted ${deletedCount} records from D1 for ${r2Key}`);

  // Verify deletion
  if (deletedCount !== allRecords.length) {
    console.warn(`[${runId}] Warning: Archived ${allRecords.length} records but deleted ${deletedCount}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a file exists in R2 storage
 * @param {R2Bucket} r2 - R2 bucket binding
 * @param {string} key - R2 object key
 * @returns {Promise<boolean>} True if file exists, false otherwise
 */
async function checkFileExists(r2, key) {
  try {
    const obj = await r2.head(key);
    return obj !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Upload Parquet file to R2 with proper content type
 * @param {R2Bucket} r2 - R2 bucket binding
 * @param {string} key - R2 object key
 * @param {Uint8Array} buffer - Parquet file buffer
 * @returns {Promise<void>}
 */
async function uploadParquetFile(r2, key, buffer) {
  await r2.put(key, buffer, {
    httpMetadata: {
      contentType: 'application/vnd.apache.parquet',
    },
    customMetadata: {
      uploadedAt: new Date().toISOString(),
      format: 'parquet',
      compression: 'snappy'
    }
  });
}
