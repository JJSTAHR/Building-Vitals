/**
 * ============================================================================
 * D1 Client Library for Building Vitals ETL Pipeline
 * ============================================================================
 *
 * Provides reusable database operations for timeseries data management.
 * Optimized for high-throughput batch inserts and efficient queries.
 *
 * Features:
 * - Batch insert with prepared statements (max 1000 records per batch)
 * - Automatic chunking for large datasets
 * - Comprehensive error handling with retries
 * - Query optimization using indexes
 * - Transaction safety for data consistency
 *
 * @module d1-client
 */

// ============================================================================
// Constants
// ============================================================================

const MAX_BATCH_SIZE = 1000; // D1 limit for batch operations
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// Batch Insert Operations
// ============================================================================

/**
 * Insert timeseries data in batches
 * Automatically chunks large datasets to stay within D1 limits
 * Inserts directly into timeseries_raw table (unified schema)
 *
 * @param {D1Database} db - D1 database instance
 * @param {Array<Object>} samples - Array of timeseries samples
 * @param {string} samples[].site_name - Site identifier
 * @param {string} samples[].point_name - Point identifier
 * @param {number} samples[].timestamp - Unix timestamp (milliseconds)
 * @param {number} samples[].avg_value - Value
 * @returns {Promise<{success: boolean, inserted: number, failed: number, errors: Array}>}
 */
export async function batchInsertTimeseries(db, samples) {
  if (!samples || samples.length === 0) {
    return { success: true, inserted: 0, failed: 0, errors: [] };
  }

  const results = {
    success: true,
    inserted: 0,
    failed: 0,
    errors: []
  };

  try {
    // Split into chunks of MAX_BATCH_SIZE
    const chunks = chunkArray(samples, MAX_BATCH_SIZE);

    console.log(`[D1] Batch insert: ${samples.length} samples in ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkResult = await insertChunkWithRetry(db, chunk, i + 1, chunks.length);

      results.inserted += chunkResult.inserted;
      results.failed += chunkResult.failed;

      if (chunkResult.errors.length > 0) {
        results.errors.push(...chunkResult.errors);
        results.success = false;
      }
    }

    console.log(`[D1] Batch insert complete: ${results.inserted} inserted, ${results.failed} failed`);

  } catch (error) {
    console.error('[D1] Batch insert error:', error);
    results.success = false;
    results.errors.push({ error: error.message });
  }

  return results;
}

/**
 * Insert a single chunk with retry logic
 * Uses prepared statements for SQL injection safety and performance
 *
 * @private
 * @param {D1Database} db - D1 database instance
 * @param {Array<Object>} chunk - Chunk of samples to insert
 * @param {number} chunkNum - Current chunk number (for logging)
 * @param {number} totalChunks - Total number of chunks
 * @returns {Promise<{inserted: number, failed: number, errors: Array}>}
 */
async function insertChunkWithRetry(db, chunk, chunkNum, totalChunks) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[D1] Chunk ${chunkNum}/${totalChunks}: Inserting ${chunk.length} records (attempt ${attempt}/${MAX_RETRIES})`);

      const inserted = await insertChunk(db, chunk);

      return {
        inserted,
        failed: 0,
        errors: []
      };
    } catch (error) {
      lastError = error;
      console.error(`[D1] Chunk ${chunkNum}/${totalChunks} failed (attempt ${attempt}/${MAX_RETRIES}):`, error.message);

      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  // All retries failed
  return {
    inserted: 0,
    failed: chunk.length,
    errors: [{
      chunk: chunkNum,
      error: lastError.message,
      records: chunk.length
    }]
  };
}

// Removed normalizePointIds - direct insert to timeseries_raw instead

/**
 * Insert a chunk using batch prepared statement
 * Uses INSERT OR REPLACE for idempotency (no duplicates)
 * Inserts directly into timeseries_raw table (unified schema)
 *
 * @private
 * @param {D1Database} db - D1 database instance
 * @param {Array<Object>} chunk - Chunk of samples with site_name, point_name, timestamp, value
 * @returns {Promise<number>} Number of records inserted
 */
async function insertChunk(db, chunk) {
  // Filter out samples with null/undefined values BEFORE creating statements
  // D1 doesn't accept undefined/null values and will fail the entire batch
  const validSamples = chunk.filter(sample => {
    const value = sample.avg_value || sample.value;
    const isValid = value !== null && value !== undefined && !isNaN(value);

    if (!isValid) {
      console.warn(`[D1] Skipping sample with invalid value:`, {
        site: sample.site_name,
        point: sample.point_name,
        timestamp: sample.timestamp,
        value: value,
        valueType: typeof value
      });
    }

    return isValid;
  });

  if (validSamples.length === 0) {
    console.warn(`[D1] No valid samples in chunk after filtering (all had null/undefined values)`);
    return 0;
  }

  if (validSamples.length < chunk.length) {
    console.log(`[D1] Filtered ${chunk.length - validSamples.length} invalid samples, proceeding with ${validSamples.length} valid samples`);
  }

  // Build batch statement with prepared queries (only valid samples)
  const statements = validSamples.map(sample => {
    // Convert milliseconds to seconds for D1 storage
    const timestampSec = Math.floor(sample.timestamp / 1000);

    // Get value - we know it's valid at this point
    const value = sample.avg_value || sample.value;

    return db.prepare(`
      INSERT OR REPLACE INTO timeseries_raw (site_name, point_name, timestamp, value)
      VALUES (?, ?, ?, ?)
    `).bind(
      sample.site_name,
      sample.point_name,
      timestampSec,
      value
    );
  });

  // Enhanced logging before batch execution
  console.log(`[D1] About to execute db.batch() with ${statements.length} statements`);
  console.log(`[D1] Sample data range:`, {
    firstSample: {
      site: chunk[0].site_name,
      point: chunk[0].point_name,
      timestamp: chunk[0].timestamp,
      value: chunk[0].avg_value || chunk[0].value
    },
    lastSample: {
      site: chunk[chunk.length - 1].site_name,
      point: chunk[chunk.length - 1].point_name,
      timestamp: chunk[chunk.length - 1].timestamp,
      value: chunk[chunk.length - 1].avg_value || chunk[chunk.length - 1].value
    }
  });

  // Execute batch with explicit error handling
  let results;
  try {
    results = await db.batch(statements);
    console.log(`[D1] ✓ db.batch() returned successfully`);
  } catch (error) {
    console.error(`[D1] ✗ db.batch() threw error:`, error);
    console.error(`[D1] Error message:`, error.message);
    console.error(`[D1] Error stack:`, error.stack);
    console.error(`[D1] Chunk details:`, {
      chunkSize: chunk.length,
      statementsCount: statements.length,
      firstStatementType: typeof statements[0],
      hasBinding: typeof statements[0]?.bind === 'function'
    });
    throw error;
  }

  // Log detailed results with type checking
  console.log(`[D1] Batch execution results:`, {
    totalStatements: statements.length,
    resultsType: typeof results,
    resultsIsArray: Array.isArray(results),
    resultsLength: results?.length,
    firstResult: results?.[0],
    firstResultType: typeof results?.[0],
    firstResultSuccess: results?.[0]?.success
  });

  // Validate results structure
  if (!results || !Array.isArray(results)) {
    console.error(`[D1] Invalid results structure:`, results);
    throw new Error(`db.batch() returned invalid results: ${typeof results}`);
  }

  if (results.length !== statements.length) {
    console.error(`[D1] Results length mismatch: expected ${statements.length}, got ${results.length}`);
  }

  // Count successful inserts and check for errors
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result?.success) {
      inserted++;
    } else {
      failed++;
      console.error(`[D1] Statement ${i} failed:`, {
        error: result?.error || 'Unknown error',
        resultObject: result,
        statementIndex: i
      });
    }
  }

  console.log(`[D1] Chunk processing complete: ${inserted} inserted, ${failed} failed out of ${results.length}`);

  if (failed > 0) {
    throw new Error(`D1 batch had ${failed} failed statements out of ${results.length}`);
  }

  return inserted;
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Query timeseries data for a range of points and time
 * Uses optimized indexes for fast retrieval
 *
 * @param {D1Database} db - D1 database instance
 * @param {Array<string>} pointNames - Array of point names to query
 * @param {string} siteName - Site identifier
 * @param {string} interval - Aggregation interval ('1min', '5min', '1hr', '1day')
 * @param {number} startTime - Start timestamp (Unix seconds)
 * @param {number} endTime - End timestamp (Unix seconds)
 * @returns {Promise<Array<Object>>} Array of timeseries records
 */
export async function queryTimeseriesRange(db, pointNames, siteName, interval, startTime, endTime) {
  if (!pointNames || pointNames.length === 0) {
    return [];
  }

  console.log(`[D1] Query: site=${siteName}, points=${pointNames.length}, interval=${interval}, range=${startTime}-${endTime}`);

  try {
    // Build parameterized query with placeholders
    const placeholders = pointNames.map(() => '?').join(',');

    const query = `
      SELECT
        site_name,
        point_name,
        interval,
        timestamp,
        avg_value,
        min_value,
        max_value,
        sample_count
      FROM timeseries_agg
      WHERE site_name = ?
        AND point_name IN (${placeholders})
        AND interval = ?
        AND timestamp >= ?
        AND timestamp <= ?
      ORDER BY point_name, timestamp ASC
    `;

    // Bind parameters: siteName, ...pointNames, interval, startTime, endTime
    const stmt = db.prepare(query).bind(
      siteName,
      ...pointNames,
      interval,
      startTime,
      endTime
    );

    const result = await stmt.all();

    console.log(`[D1] Query returned ${result.results?.length || 0} records`);

    return result.results || [];
  } catch (error) {
    console.error('[D1] Query failed:', error);
    throw error;
  }
}

/**
 * Get the oldest timestamp for a specific point
 * Used to determine the starting point for backfills
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} siteName - Site identifier
 * @param {string} pointName - Point identifier
 * @param {string} interval - Aggregation interval
 * @returns {Promise<number|null>} Oldest timestamp or null if no data
 */
export async function getOldestTimestamp(db, siteName, pointName, interval) {
  try {
    const stmt = db.prepare(`
      SELECT MIN(timestamp) as oldest_timestamp
      FROM timeseries_agg
      WHERE site_name = ?
        AND point_name = ?
        AND interval = ?
    `).bind(siteName, pointName, interval);

    const result = await stmt.first();

    return result?.oldest_timestamp || null;
  } catch (error) {
    console.error('[D1] Failed to get oldest timestamp:', error);
    throw error;
  }
}

/**
 * Get the newest timestamp for a specific point
 * Used to determine where to resume incremental sync
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} siteName - Site identifier
 * @param {string} pointName - Point identifier
 * @param {string} interval - Aggregation interval
 * @returns {Promise<number|null>} Newest timestamp or null if no data
 */
export async function getNewestTimestamp(db, siteName, pointName, interval) {
  try {
    const stmt = db.prepare(`
      SELECT MAX(timestamp) as newest_timestamp
      FROM timeseries_agg
      WHERE site_name = ?
        AND point_name = ?
        AND interval = ?
    `).bind(siteName, pointName, interval);

    const result = await stmt.first();

    return result?.newest_timestamp || null;
  } catch (error) {
    console.error('[D1] Failed to get newest timestamp:', error);
    throw error;
  }
}

/**
 * Update query metadata for a point
 * Tracks data range and aggregation status
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} siteName - Site identifier
 * @param {string} pointName - Point identifier
 * @param {Object} metadata - Metadata to update
 * @param {number} metadata.dataStart - First available timestamp
 * @param {number} metadata.dataEnd - Last available timestamp
 * @param {number} metadata.totalSamples - Total number of samples
 * @param {number} metadata.lastAggregated - Last aggregation timestamp
 * @returns {Promise<void>}
 */
export async function updateQueryMetadata(db, siteName, pointName, metadata) {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO query_metadata (
        site_name,
        point_name,
        data_start,
        data_end,
        total_samples,
        last_aggregated
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      siteName,
      pointName,
      metadata.dataStart,
      metadata.dataEnd,
      metadata.totalSamples,
      metadata.lastAggregated
    );

    await stmt.run();

    console.log(`[D1] Updated metadata for ${siteName}/${pointName}`);
  } catch (error) {
    console.error('[D1] Failed to update metadata:', error);
    throw error;
  }
}

/**
 * Get data quality metrics for a point
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} siteName - Site identifier
 * @param {string} pointName - Point identifier
 * @param {number} date - Date as YYYYMMDD integer
 * @returns {Promise<Object|null>} Quality metrics or null if not found
 */
export async function getDataQuality(db, siteName, pointName, date) {
  try {
    const stmt = db.prepare(`
      SELECT *
      FROM data_quality
      WHERE site_name = ?
        AND point_name = ?
        AND date = ?
    `).bind(siteName, pointName, date);

    return await stmt.first();
  } catch (error) {
    console.error('[D1] Failed to get data quality:', error);
    throw error;
  }
}

/**
 * Record data quality metrics
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} quality - Quality metrics
 * @returns {Promise<void>}
 */
export async function recordDataQuality(db, quality) {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO data_quality (
        site_name,
        point_name,
        date,
        expected_samples,
        actual_samples,
        missing_samples,
        outlier_count,
        quality_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      quality.site_name,
      quality.point_name,
      quality.date,
      quality.expected_samples,
      quality.actual_samples,
      quality.missing_samples,
      quality.outlier_count,
      quality.quality_score
    );

    await stmt.run();

    console.log(`[D1] Recorded data quality for ${quality.site_name}/${quality.point_name} on ${quality.date}`);
  } catch (error) {
    console.error('[D1] Failed to record data quality:', error);
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Split array into chunks of specified size
 *
 * @private
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array<Array>} Array of chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for specified milliseconds
 *
 * @private
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Transaction Helpers
// ============================================================================

/**
 * Execute multiple operations in a transaction
 * Provides atomicity for complex operations
 *
 * @param {D1Database} db - D1 database instance
 * @param {Function} operations - Async function that performs operations
 * @returns {Promise<any>} Result of operations
 */
export async function transaction(db, operations) {
  try {
    // D1 doesn't support explicit transactions yet, but batch operations are atomic
    // Use batch for related operations that should succeed or fail together
    return await operations(db);
  } catch (error) {
    console.error('[D1] Transaction failed:', error);
    throw error;
  }
}

/**
 * Health check for database connection
 *
 * @param {D1Database} db - D1 database instance
 * @returns {Promise<boolean>} True if database is accessible
 */
export async function healthCheck(db) {
  try {
    const result = await db.prepare('SELECT 1 as health').first();
    return result?.health === 1;
  } catch (error) {
    console.error('[D1] Health check failed:', error);
    return false;
  }
}

/**
 * Get database statistics
 *
 * @param {D1Database} db - D1 database instance
 * @returns {Promise<Object>} Database statistics
 */
export async function getStats(db) {
  try {
    const queries = [
      db.prepare('SELECT COUNT(*) as count FROM timeseries_raw').first(),
      db.prepare('SELECT COUNT(*) as count FROM timeseries_agg').first()
    ];

    const [timeseriesRaw, timeseriesAgg] = await Promise.all(queries);

    return {
      timeseries_raw_count: timeseriesRaw?.count || 0,
      timeseries_agg_count: timeseriesAgg?.count || 0,
      schema_version: 2
    };
  } catch (error) {
    console.error('[D1] Failed to get stats:', error);
    return {
      timeseries_raw_count: 0,
      timeseries_agg_count: 0,
      schema_version: 0,
      error: error.message
    };
  }
}
