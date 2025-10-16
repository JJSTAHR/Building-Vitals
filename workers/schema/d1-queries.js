/**
 * D1 Prepared Statement Functions
 * Optimized query functions for Building Vitals
 *
 * Performance Notes:
 * - All queries use prepared statements to prevent SQL injection
 * - Indexes are designed to support these query patterns
 * - Use batch operations for bulk inserts
 */

// ============================================================================
// TIMESERIES AGGREGATION QUERIES
// ============================================================================

/**
 * Get aggregated timeseries data for a date range
 * Uses idx_timeseries_site_time index
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Aggregated data points
 */
export async function getTimeseriesData(db, { siteName, pointName, interval, startTime, endTime }) {
  const query = `
    SELECT
      timestamp,
      avg_value,
      min_value,
      max_value,
      sample_count
    FROM timeseries_agg
    WHERE site_name = ?
      AND point_name = ?
      AND interval = ?
      AND timestamp >= ?
      AND timestamp < ?
    ORDER BY timestamp ASC
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(siteName, pointName, interval, startTime, endTime).all();
  return result.results;
}

/**
 * Get multiple points in a single query (more efficient)
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Grouped results by point_name
 */
export async function getMultiPointTimeseries(db, { siteName, pointNames, interval, startTime, endTime }) {
  // Build dynamic IN clause
  const placeholders = pointNames.map(() => '?').join(',');
  const query = `
    SELECT
      point_name,
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
      AND timestamp < ?
    ORDER BY point_name, timestamp ASC
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(siteName, ...pointNames, interval, startTime, endTime).all();

  // Group by point_name for easier consumption
  const grouped = {};
  result.results.forEach(row => {
    if (!grouped[row.point_name]) {
      grouped[row.point_name] = [];
    }
    grouped[row.point_name].push(row);
  });

  return grouped;
}

/**
 * Insert aggregated timeseries data (batch operation)
 *
 * @param {D1Database} db - D1 database instance
 * @param {Array} records - Array of aggregation records
 * @returns {Promise<Object>} Insert result
 */
export async function insertTimeseriesAggregations(db, records) {
  const query = `
    INSERT OR REPLACE INTO timeseries_agg
      (site_name, point_name, interval, timestamp, avg_value, min_value, max_value, sample_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Batch inserts for better performance
  const batch = records.map(r =>
    db.prepare(query).bind(
      r.siteName,
      r.pointName,
      r.interval,
      r.timestamp,
      r.avgValue,
      r.minValue,
      r.maxValue,
      r.sampleCount
    )
  );

  return await db.batch(batch);
}

/**
 * Get hourly averages for a date range
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Hourly aggregations
 */
export async function getHourlyAverages(db, { siteName, pointName, startDate, endDate }) {
  const query = `
    SELECT
      timestamp,
      avg_value,
      sample_count
    FROM timeseries_agg
    WHERE site_name = ?
      AND point_name = ?
      AND interval = '1hr'
      AND timestamp >= ?
      AND timestamp < ?
    ORDER BY timestamp ASC
  `;

  const stmt = db.prepare(query);
  const startTime = Math.floor(new Date(startDate).getTime() / 1000);
  const endTime = Math.floor(new Date(endDate).getTime() / 1000);

  const result = await stmt.bind(siteName, pointName, startTime, endTime).all();
  return result.results;
}

/**
 * Get daily min/max for a month
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Daily extremes
 */
export async function getDailyMinMax(db, { siteName, pointName, year, month }) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const query = `
    SELECT
      timestamp,
      min_value,
      max_value,
      avg_value,
      sample_count
    FROM timeseries_agg
    WHERE site_name = ?
      AND point_name = ?
      AND interval = '1day'
      AND timestamp >= ?
      AND timestamp < ?
    ORDER BY timestamp ASC
  `;

  const stmt = db.prepare(query);
  const startTime = Math.floor(startDate.getTime() / 1000);
  const endTime = Math.floor(endDate.getTime() / 1000);

  const result = await stmt.bind(siteName, pointName, startTime, endTime).all();
  return result.results;
}

/**
 * Get recent values (last N hours)
 * Uses idx_timeseries_recent index
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Recent data points
 */
export async function getRecentValues(db, { siteName, pointName, hours = 24 }) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - (hours * 3600);

  const query = `
    SELECT
      timestamp,
      avg_value,
      min_value,
      max_value
    FROM timeseries_agg
    WHERE site_name = ?
      AND point_name = ?
      AND interval = '1min'
      AND timestamp >= ?
    ORDER BY timestamp DESC
    LIMIT 1440
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(siteName, pointName, startTime).all();
  return result.results;
}

// ============================================================================
// CHART CONFIGURATION QUERIES
// ============================================================================

/**
 * Get user's saved charts
 * Uses idx_charts_user index
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} userId - User identifier
 * @returns {Promise<Array>} User's charts
 */
export async function getUserCharts(db, userId) {
  const query = `
    SELECT
      id,
      site_name,
      chart_type,
      title,
      config_json,
      created_at,
      updated_at,
      view_count
    FROM chart_configs
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(userId).all();

  // Parse JSON configs
  return result.results.map(row => ({
    ...row,
    config: JSON.parse(row.config_json)
  }));
}

/**
 * Get popular public charts
 * Uses idx_charts_popular index
 *
 * @param {D1Database} db - D1 database instance
 * @param {number} limit - Number of charts to return
 * @returns {Promise<Array>} Popular charts
 */
export async function getPopularCharts(db, limit = 20) {
  const query = `
    SELECT
      id,
      site_name,
      chart_type,
      title,
      config_json,
      view_count,
      created_at
    FROM chart_configs
    WHERE is_public = 1
    ORDER BY view_count DESC
    LIMIT ?
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(limit).all();

  return result.results.map(row => ({
    ...row,
    config: JSON.parse(row.config_json)
  }));
}

/**
 * Save or update a chart configuration
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} chart - Chart configuration
 * @returns {Promise<Object>} Insert/update result
 */
export async function saveChartConfig(db, chart) {
  const now = Math.floor(Date.now() / 1000);

  const query = `
    INSERT OR REPLACE INTO chart_configs
      (id, user_id, site_name, chart_type, title, config_json, is_public, created_at, updated_at, view_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT view_count FROM chart_configs WHERE id = ?), 0))
  `;

  const stmt = db.prepare(query);
  return await stmt.bind(
    chart.id,
    chart.userId,
    chart.siteName,
    chart.chartType,
    chart.title,
    JSON.stringify(chart.config),
    chart.isPublic ? 1 : 0,
    chart.createdAt || now,
    now,
    chart.id  // For COALESCE to preserve view_count
  ).run();
}

/**
 * Increment chart view count
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} chartId - Chart identifier
 * @returns {Promise<Object>} Update result
 */
export async function incrementChartViews(db, chartId) {
  const now = Math.floor(Date.now() / 1000);

  const query = `
    UPDATE chart_configs
    SET view_count = view_count + 1,
        last_viewed_at = ?
    WHERE id = ?
  `;

  const stmt = db.prepare(query);
  return await stmt.bind(now, chartId).run();
}

/**
 * Get charts by site
 * Uses idx_charts_site index
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} siteName - Site identifier
 * @returns {Promise<Array>} Site charts
 */
export async function getChartsBySite(db, siteName) {
  const query = `
    SELECT
      id,
      user_id,
      chart_type,
      title,
      config_json,
      view_count,
      created_at
    FROM chart_configs
    WHERE site_name = ?
      AND is_public = 1
    ORDER BY created_at DESC
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(siteName).all();

  return result.results.map(row => ({
    ...row,
    config: JSON.parse(row.config_json)
  }));
}

// ============================================================================
// QUERY METADATA QUERIES
// ============================================================================

/**
 * Update query metadata after aggregation
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} metadata - Metadata to update
 * @returns {Promise<Object>} Update result
 */
export async function updateQueryMetadata(db, metadata) {
  const now = Math.floor(Date.now() / 1000);

  const query = `
    INSERT OR REPLACE INTO query_metadata
      (site_name, point_name, data_start, data_end, total_samples, last_aggregated)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const stmt = db.prepare(query);
  return await stmt.bind(
    metadata.siteName,
    metadata.pointName,
    metadata.dataStart,
    metadata.dataEnd,
    metadata.totalSamples,
    now
  ).run();
}

/**
 * Get data availability for a site
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} siteName - Site identifier
 * @returns {Promise<Array>} Available points and date ranges
 */
export async function getDataAvailability(db, siteName) {
  const query = `
    SELECT
      point_name,
      data_start,
      data_end,
      total_samples,
      last_aggregated
    FROM query_metadata
    WHERE site_name = ?
    ORDER BY point_name
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(siteName).all();
  return result.results;
}

// ============================================================================
// QUERY CACHE FUNCTIONS
// ============================================================================

/**
 * Get cached query result
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} cacheKey - Cache key hash
 * @returns {Promise<Object|null>} Cached result or null
 */
export async function getCachedQuery(db, cacheKey) {
  const now = Math.floor(Date.now() / 1000);

  const query = `
    UPDATE query_cache
    SET hit_count = hit_count + 1
    WHERE cache_key = ?
      AND expires_at > ?
    RETURNING result_json, query_params
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(cacheKey, now).first();

  if (result) {
    return {
      result: JSON.parse(result.result_json),
      params: JSON.parse(result.query_params)
    };
  }

  return null;
}

/**
 * Store query result in cache
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} cache - Cache entry
 * @returns {Promise<Object>} Insert result
 */
export async function setCachedQuery(db, { cacheKey, siteName, params, result, ttlSeconds = 300 }) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSeconds;

  const query = `
    INSERT OR REPLACE INTO query_cache
      (cache_key, site_name, query_params, result_json, created_at, expires_at, hit_count)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `;

  const stmt = db.prepare(query);
  return await stmt.bind(
    cacheKey,
    siteName,
    JSON.stringify(params),
    JSON.stringify(result),
    now,
    expiresAt
  ).run();
}

/**
 * Clean expired cache entries
 *
 * @param {D1Database} db - D1 database instance
 * @returns {Promise<Object>} Delete result
 */
export async function cleanExpiredCache(db) {
  const now = Math.floor(Date.now() / 1000);

  const query = `DELETE FROM query_cache WHERE expires_at <= ?`;
  const stmt = db.prepare(query);
  return await stmt.bind(now).run();
}

// ============================================================================
// DATA QUALITY QUERIES
// ============================================================================

/**
 * Get data quality metrics
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Quality metrics
 */
export async function getDataQuality(db, { siteName, startDate, endDate }) {
  const query = `
    SELECT
      point_name,
      date,
      expected_samples,
      actual_samples,
      missing_samples,
      outlier_count,
      quality_score
    FROM data_quality
    WHERE site_name = ?
      AND date >= ?
      AND date < ?
    ORDER BY date DESC, quality_score ASC
  `;

  const stmt = db.prepare(query);
  return await stmt.bind(siteName, startDate, endDate).all();
}

// ============================================================================
// QUEUE JOB MANAGEMENT QUERIES
// ============================================================================

/**
 * Create a new queue job
 *
 * @param {D1Database} db - D1 database instance
 * @param {Object} jobData - Job configuration
 * @returns {Promise<Object>} Insert result
 */
export async function createQueueJob(db, jobData) {
  const now = Math.floor(Date.now() / 1000);

  const query = `
    INSERT INTO queue_jobs (
      job_id, site_name, points_json, start_time, end_time,
      user_id, status, priority, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)
  `;

  const stmt = db.prepare(query);
  return await stmt.bind(
    jobData.jobId,
    jobData.siteName,
    JSON.stringify(jobData.points),
    jobData.startTime,
    jobData.endTime,
    jobData.userId || null,
    jobData.priority || 0,
    now
  ).run();
}

/**
 * Update job status with optional metadata
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} jobId - Job identifier
 * @param {string} status - New status
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Update result
 */
export async function updateJobStatus(db, jobId, status, metadata = {}) {
  const updates = ['status = ?'];
  const params = [status];

  if (status === 'processing') {
    updates.push('started_at = ?');
    params.push(Math.floor(Date.now() / 1000));
  } else if (status === 'completed' || status === 'failed') {
    updates.push('completed_at = ?');
    params.push(Math.floor(Date.now() / 1000));
  }

  if (metadata.error) {
    updates.push('error_message = ?');
    params.push(metadata.error);
  }

  if (metadata.resultUrl) {
    updates.push('result_url = ?');
    params.push(metadata.resultUrl);
  }

  if (metadata.samplesCount) {
    updates.push('samples_count = ?');
    params.push(metadata.samplesCount);
  }

  if (metadata.processingTime) {
    updates.push('processing_time_ms = ?');
    params.push(metadata.processingTime);
  }

  if (metadata.retryCount !== undefined) {
    updates.push('retry_count = ?');
    params.push(metadata.retryCount);
  }

  params.push(jobId);

  const query = `
    UPDATE queue_jobs
    SET ${updates.join(', ')}
    WHERE job_id = ?
  `;

  const stmt = db.prepare(query);
  return await stmt.bind(...params).run();
}

/**
 * Get job by ID
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} jobId - Job identifier
 * @returns {Promise<Object|null>} Job record or null
 */
export async function getQueueJob(db, jobId) {
  const query = `
    SELECT * FROM queue_jobs WHERE job_id = ?
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(jobId).first();

  if (result && result.points_json) {
    result.points = JSON.parse(result.points_json);
  }

  return result;
}

/**
 * Get pending jobs for processing
 * Uses idx_queue_jobs_priority index
 *
 * @param {D1Database} db - D1 database instance
 * @param {number} limit - Maximum number of jobs to return
 * @returns {Promise<Array>} Pending jobs ordered by priority
 */
export async function getPendingJobs(db, limit = 100) {
  const query = `
    SELECT * FROM queue_jobs
    WHERE status IN ('queued', 'processing')
    ORDER BY priority DESC, created_at ASC
    LIMIT ?
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(limit).all();

  return result.results.map(job => ({
    ...job,
    points: JSON.parse(job.points_json)
  }));
}

/**
 * Get user's job history
 * Uses idx_queue_jobs_user_created index
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} userId - User identifier
 * @param {number} limit - Maximum number of jobs to return
 * @returns {Promise<Array>} User's jobs
 */
export async function getUserJobs(db, userId, limit = 50) {
  const query = `
    SELECT
      job_id,
      site_name,
      points_json,
      start_time,
      end_time,
      status,
      created_at,
      completed_at,
      result_url,
      samples_count,
      processing_time_ms
    FROM queue_jobs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;

  const stmt = db.prepare(query);
  const result = await stmt.bind(userId, limit).all();

  return result.results.map(job => ({
    ...job,
    points: JSON.parse(job.points_json)
  }));
}

/**
 * Clean up old completed/failed jobs
 * Run periodically via scheduled task
 *
 * @param {D1Database} db - D1 database instance
 * @param {number} daysToKeep - Number of days to retain
 * @returns {Promise<Object>} Delete result
 */
export async function cleanupOldJobs(db, daysToKeep = 30) {
  const cutoffTime = Math.floor(Date.now() / 1000) - (daysToKeep * 86400);

  const query = `
    DELETE FROM queue_jobs
    WHERE completed_at < ?
      AND status IN ('completed', 'failed', 'cancelled')
  `;

  const stmt = db.prepare(query);
  return await stmt.bind(cutoffTime).run();
}

/**
 * Get job statistics for monitoring
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} siteName - Optional site filter
 * @returns {Promise<Object>} Job statistics
 */
export async function getJobStats(db, siteName = null) {
  const query = siteName
    ? `
      SELECT
        status,
        COUNT(*) as count,
        AVG(processing_time_ms) as avg_processing_time,
        MAX(processing_time_ms) as max_processing_time
      FROM queue_jobs
      WHERE site_name = ?
      GROUP BY status
    `
    : `
      SELECT
        status,
        COUNT(*) as count,
        AVG(processing_time_ms) as avg_processing_time,
        MAX(processing_time_ms) as max_processing_time
      FROM queue_jobs
      GROUP BY status
    `;

  const stmt = db.prepare(query);
  const result = siteName
    ? await stmt.bind(siteName).all()
    : await stmt.all();

  return result.results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate cache key from query parameters
 *
 * @param {Object} params - Query parameters
 * @returns {string} Cache key hash
 */
export function generateCacheKey(params) {
  const str = JSON.stringify(params, Object.keys(params).sort());
  return hashString(str);
}

/**
 * Simple string hash function
 *
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Batch operation helper
 *
 * @param {Array} items - Items to process
 * @param {number} batchSize - Size of each batch
 * @param {Function} processFn - Function to process each batch
 * @returns {Promise<Array>} Results from all batches
 */
export async function processBatches(items, batchSize, processFn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const result = await processFn(batch);
    results.push(result);
  }
  return results;
}
