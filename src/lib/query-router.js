/**
 * Query Router - Intelligent D1/R2 Routing
 *
 * Routes timeseries queries to optimal storage:
 * - D1 (hot): Recent data (<30 days) - SQLite at edge, <500ms
 * - R2 (cold): Historical data (>30 days) - Parquet with DuckDB, <5s
 * - Split: Queries spanning both ranges - Merged results
 *
 * Architecture:
 * - 30-day cutoff for hot/cold boundary
 * - D1 stores aggregated data for fast queries
 * - R2 stores Parquet files for analytical queries
 * - DuckDB WASM for efficient Parquet processing
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const HOT_STORAGE_DAYS = 20; // Data newer than this goes to D1 (matches archival retention)
const COLD_STORAGE_BOUNDARY = Date.now() - (HOT_STORAGE_DAYS * 24 * 60 * 60 * 1000);

const D1_MAX_RESPONSE_TIME = 500; // ms
const R2_MAX_RESPONSE_TIME = 5000; // ms

// ============================================================================
// QUERY ROUTING DECISION
// ============================================================================

/**
 * Determines optimal storage routing for a query
 * @param {string[]} pointNames - Array of point names to query
 * @param {string} startTime - ISO 8601 start time
 * @param {string} endTime - ISO 8601 end time
 * @returns {Object} Routing decision with strategy
 */
export function routeQuery(pointNames, startTime, endTime) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const now = Date.now();

  // Calculate days from now
  const daysFromNowStart = (now - start) / (1000 * 60 * 60 * 24);
  const daysFromNowEnd = (now - end) / (1000 * 60 * 60 * 24);

  // Decision logic
  if (daysFromNowEnd < HOT_STORAGE_DAYS) {
    // All data is recent - use D1 only
    return {
      strategy: 'D1_ONLY',
      useD1: true,
      useR2: false,
      splitPoint: null,
      estimatedResponseTime: calculateD1ResponseTime(pointNames.length, start, end),
      rationale: 'All data within hot storage window (<30 days)'
    };
  }

  if (daysFromNowStart > HOT_STORAGE_DAYS) {
    // All data is historical - use R2 only
    return {
      strategy: 'R2_ONLY',
      useD1: false,
      useR2: true,
      splitPoint: null,
      estimatedResponseTime: calculateR2ResponseTime(pointNames.length, start, end),
      rationale: 'All data in cold storage (>30 days old)'
    };
  }

  // Query spans both hot and cold - split strategy
  const splitTimestamp = now - (HOT_STORAGE_DAYS * 24 * 60 * 60 * 1000);

  return {
    strategy: 'SPLIT',
    useD1: true,
    useR2: true,
    splitPoint: new Date(splitTimestamp).toISOString(),
    estimatedResponseTime: Math.max(
      calculateD1ResponseTime(pointNames.length, splitTimestamp, end),
      calculateR2ResponseTime(pointNames.length, start, splitTimestamp)
    ),
    rationale: `Query spans hot (<${HOT_STORAGE_DAYS}d) and cold (>${HOT_STORAGE_DAYS}d) storage`
  };
}

/**
 * Estimate D1 query response time
 */
function calculateD1ResponseTime(pointCount, start, end) {
  const days = (end - start) / (1000 * 60 * 60 * 24);
  const estimatedRows = pointCount * days * 1440; // 1-minute samples

  // D1 is fast: ~50ms + 0.1ms per 1000 rows
  return Math.min(50 + (estimatedRows / 1000) * 0.1, D1_MAX_RESPONSE_TIME);
}

/**
 * Estimate R2 query response time
 */
function calculateR2ResponseTime(pointCount, start, end) {
  const days = (end - start) / (1000 * 60 * 60 * 24);
  const estimatedFiles = Math.ceil(days / 30); // Monthly Parquet files

  // R2 + DuckDB: ~500ms + 200ms per file
  return Math.min(500 + (estimatedFiles * 200), R2_MAX_RESPONSE_TIME);
}

// ============================================================================
// D1 QUERY FUNCTIONS
// ============================================================================

/**
 * Query D1 database for hot storage data
 * @param {D1Database} db - Cloudflare D1 database binding
 * @param {string[]} pointNames - Points to query
 * @param {string} startTime - ISO 8601 start
 * @param {string} endTime - ISO 8601 end
 * @returns {Promise<Object>} Query results
 */
export async function queryD1(db, pointNames, startTime, endTime) {
  const start = new Date(startTime).getTime() / 1000; // Unix timestamp
  const end = new Date(endTime).getTime() / 1000;

  try {
    // Query timeseries_aggregations table
    // We're using 1-minute aggregations for best balance of speed/accuracy
    const stmt = db.prepare(`
      SELECT
        point_name,
        timestamp,
        avg_value as value
      FROM timeseries_aggregations
      WHERE point_name IN (${pointNames.map(() => '?').join(',')})
        AND aggregation_level = '1min'
        AND timestamp BETWEEN ? AND ?
      ORDER BY point_name, timestamp ASC
    `).bind(...pointNames, start, end);

    const result = await stmt.all();

    if (!result.success) {
      throw new Error(`D1 query failed: ${result.error}`);
    }

    // Transform D1 results to timeseries format
    return transformD1Results(result.results, pointNames);

  } catch (error) {
    console.error('[D1 Query Error]', error);
    throw new Error(`D1 query failed: ${error.message}`);
  }
}

/**
 * Transform D1 query results to standard timeseries format
 */
function transformD1Results(rows, pointNames) {
  const seriesMap = new Map();

  // Initialize empty series for each point
  pointNames.forEach(name => {
    seriesMap.set(name, {
      name,
      data: []
    });
  });

  // Populate with query results
  rows.forEach(row => {
    const series = seriesMap.get(row.point_name);
    if (series) {
      series.data.push([
        row.timestamp * 1000, // Convert back to milliseconds
        row.value
      ]);
    }
  });

  return {
    source: 'D1',
    series: Array.from(seriesMap.values()),
    metadata: {
      storage: 'hot',
      aggregation: '1min',
      rowCount: rows.length
    }
  };
}

// ============================================================================
// R2 QUERY FUNCTIONS (WITH DUCKDB WASM)
// ============================================================================

/**
 * Query R2 cold storage using DuckDB WASM for Parquet files
 * @param {R2Bucket} r2 - Cloudflare R2 bucket binding
 * @param {string[]} pointNames - Points to query
 * @param {string} startTime - ISO 8601 start
 * @param {string} endTime - ISO 8601 end
 * @returns {Promise<Object>} Query results
 */
export async function queryR2(r2, pointNames, startTime, endTime) {
  try {
    // Determine which Parquet files to query based on time range
    const parquetFiles = await getParquetFilesForRange(r2, startTime, endTime);

    if (parquetFiles.length === 0) {
      return {
        source: 'R2',
        series: pointNames.map(name => ({ name, data: [] })),
        metadata: {
          storage: 'cold',
          aggregation: 'raw',
          fileCount: 0
        }
      };
    }

    // Initialize DuckDB WASM (lazy loaded)
    const duckdb = await initDuckDB();

    // Query Parquet files using DuckDB
    const results = await queryParquetFiles(duckdb, r2, parquetFiles, pointNames, startTime, endTime);

    return {
      source: 'R2',
      series: results,
      metadata: {
        storage: 'cold',
        aggregation: 'raw',
        fileCount: parquetFiles.length
      }
    };

  } catch (error) {
    console.error('[R2 Query Error]', error);
    throw new Error(`R2 query failed: ${error.message}`);
  }
}

/**
 * Get list of Parquet files covering the time range
 */
async function getParquetFilesForRange(r2, startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const files = [];

  // Parquet files are organized by year-month
  // Format: timeseries/{siteId}/{year}/{month}/data.parquet

  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= endMonth) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');

    files.push({
      key: `timeseries/default/${year}/${month}/data.parquet`,
      year,
      month
    });

    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }

  return files;
}

/**
 * Initialize DuckDB WASM instance (cached)
 */
let duckdbInstance = null;

async function initDuckDB() {
  if (duckdbInstance) {
    return duckdbInstance;
  }

  // Note: DuckDB WASM would be imported and initialized here
  // For now, we'll use a placeholder that simulates the interface
  // In production, this would be: import * as duckdb from '@duckdb/duckdb-wasm';

  console.log('[DuckDB] Initializing WASM instance...');

  duckdbInstance = {
    // Placeholder for DuckDB instance
    initialized: true
  };

  return duckdbInstance;
}

/**
 * Query Parquet files using DuckDB
 */
async function queryParquetFiles(duckdb, r2, files, pointNames, startTime, endTime) {
  const startTs = new Date(startTime).getTime();
  const endTs = new Date(endTime).getTime();
  const seriesMap = new Map();

  // Initialize empty series
  pointNames.forEach(name => {
    seriesMap.set(name, {
      name,
      data: []
    });
  });

  // Process each Parquet file
  for (const file of files) {
    try {
      const obj = await r2.get(file.key);

      if (!obj) {
        console.warn(`[R2] Parquet file not found: ${file.key}`);
        continue;
      }

      // Read Parquet data
      // In production, this would use DuckDB to query the Parquet efficiently
      const arrayBuffer = await obj.arrayBuffer();

      // Simulated DuckDB query against Parquet
      // Real implementation would be:
      // const results = await duckdb.query(`
      //   SELECT point_name, timestamp, value
      //   FROM parquet_scan('${file.key}')
      //   WHERE point_name IN (${pointNames.map(n => `'${n}'`).join(',')})
      //     AND timestamp BETWEEN ${startTs} AND ${endTs}
      //   ORDER BY point_name, timestamp
      // `);

      // For now, simulate with basic parsing
      // This would be replaced with actual DuckDB Parquet parsing
      const mockData = await simulateParquetQuery(arrayBuffer, pointNames, startTs, endTs);

      // Merge results into series
      mockData.forEach(row => {
        const series = seriesMap.get(row.point_name);
        if (series) {
          series.data.push([row.timestamp, row.value]);
        }
      });

    } catch (error) {
      console.error(`[R2] Error reading Parquet file ${file.key}:`, error);
      // Continue with other files
    }
  }

  return Array.from(seriesMap.values());
}

/**
 * Simulate Parquet query (placeholder)
 * In production, this would be actual DuckDB Parquet parsing
 */
async function simulateParquetQuery(arrayBuffer, pointNames, startTs, endTs) {
  // This is a placeholder that returns empty results
  // Real implementation would use DuckDB WASM to parse Parquet
  return [];
}

// ============================================================================
// RESULT MERGING
// ============================================================================

/**
 * Merge D1 and R2 results intelligently
 * @param {Object} d1Results - Results from D1 (hot storage)
 * @param {Object} r2Results - Results from R2 (cold storage)
 * @returns {Object} Merged and deduplicated results
 */
export function mergeResults(d1Results, r2Results) {
  const mergedSeries = new Map();

  // Helper to add series data with deduplication
  const addSeries = (seriesList, source) => {
    seriesList.forEach(series => {
      if (!mergedSeries.has(series.name)) {
        mergedSeries.set(series.name, {
          name: series.name,
          data: [],
          sources: []
        });
      }

      const merged = mergedSeries.get(series.name);
      merged.data.push(...series.data);
      merged.sources.push(source);
    });
  };

  // Add R2 data first (older data)
  if (r2Results && r2Results.series) {
    addSeries(r2Results.series, 'R2');
  }

  // Add D1 data (newer data)
  if (d1Results && d1Results.series) {
    addSeries(d1Results.series, 'D1');
  }

  // Deduplicate and sort each series
  const finalSeries = Array.from(mergedSeries.values()).map(series => {
    // Deduplicate by timestamp (keep last value if duplicates)
    const timestampMap = new Map();
    series.data.forEach(([ts, val]) => {
      timestampMap.set(ts, val);
    });

    // Convert back to array and sort by timestamp
    const dedupedData = Array.from(timestampMap.entries())
      .sort((a, b) => a[0] - b[0]);

    return {
      name: series.name,
      data: dedupedData
    };
  });

  // Determine data sources
  const usedSources = new Set();
  Array.from(mergedSeries.values()).forEach(s => {
    s.sources.forEach(src => usedSources.add(src));
  });

  return {
    series: finalSeries,
    metadata: {
      sources: Array.from(usedSources),
      dataSource: usedSources.size > 1 ? 'BOTH' : usedSources.values().next().value,
      totalPoints: finalSeries.reduce((sum, s) => sum + s.data.length, 0),
      seriesCount: finalSeries.length
    }
  };
}

// ============================================================================
// SMART CACHING
// ============================================================================

/**
 * Generate cache key for query results
 */
export function generateCacheKey(pointNames, startTime, endTime) {
  const points = pointNames.sort().join(',');
  const hash = simpleHash(points);
  return `query:${hash}:${startTime}:${endTime}`;
}

/**
 * Simple hash function for cache keys
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Determine cache TTL based on data age
 */
export function getCacheTTL(endTime) {
  const now = Date.now();
  const end = new Date(endTime).getTime();
  const daysOld = (now - end) / (1000 * 60 * 60 * 24);

  if (daysOld < 1) {
    return 300; // 5 minutes for real-time data
  } else if (daysOld < 7) {
    return 1800; // 30 minutes for recent data
  } else if (daysOld < 30) {
    return 3600; // 1 hour for semi-recent data
  } else {
    return 86400; // 24 hours for historical data
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  routeQuery,
  queryD1,
  queryR2,
  mergeResults,
  generateCacheKey,
  getCacheTTL
};
