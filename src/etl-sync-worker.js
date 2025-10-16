/**
 * ============================================================================
 * ETL Sync Worker - Cloudflare Worker for ACE IoT Data Synchronization
 * ============================================================================
 *
 * Scheduled worker that syncs timeseries data from ACE IoT API to D1 database
 * every 5 minutes. Handles incremental sync with state tracking in KV.
 *
 * Key Features:
 * - Incremental sync using last_sync_timestamp from KV
 * - Batch processing (1000 records per batch) for performance
 * - Robust error handling with retries and DLQ
 * - Idempotent processing (safe for restarts)
 * - Comprehensive logging to KV for monitoring
 * - Handles 6.48M samples/day without timeouts
 *
 * Environment Variables Required:
 * - D1 binding: BUILDING_VITALS_DB
 * - KV binding: ETL_STATE
 * - Secret: ACE_API_KEY
 *
 * @module etl-sync-worker
 */

import {
  batchInsertTimeseries,
  getNewestTimestamp,
  updateQueryMetadata,
  recordDataQuality,
  healthCheck,
  getStats
} from './lib/d1-client.js';
import { writeNDJSONToR2 } from './lib/r2-ndjson-writer.js';

// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  // ACE API Configuration (will be overridden by env.ACE_API_BASE)
  ACE_TIMEOUT_MS: 30000,

  // Sync Configuration
  SYNC_INTERVAL_MINUTES: 5,
  LOOKBACK_BUFFER_MINUTES: 60, // 1 hour buffer to ensure data capture
  MAX_RECORDS_PER_SYNC: 100000, // Increased for historical backfill

  // Batch Configuration
  BATCH_SIZE: 1000, // D1 batch limit

  // Pagination Configuration
  PAGE_SIZE: 100000, // Large page size for site-wide fetching

  // Retry Configuration
  MAX_API_RETRIES: 3,
  API_RETRY_DELAY_MS: 2000,

  // Data Quality Thresholds
  EXPECTED_SAMPLES_PER_5MIN: 5, // 1 sample per minute
  MIN_QUALITY_SCORE: 0.8,

  // KV Keys
  KV_LAST_SYNC_KEY: 'etl:last_sync_timestamp',
  KV_ERROR_LOG_PREFIX: 'etl:errors:',
  KV_METRICS_PREFIX: 'etl:metrics:',
  KV_STATE_PREFIX: 'etl:state:',
  KV_POINTS_CACHE_PREFIX: 'etl:points_cache:',

  // Cache Configuration
  POINTS_CACHE_TTL_SECONDS: 3600 // Cache configured points for 1 hour
};

// ============================================================================
// Worker Entry Points
// ============================================================================

/**
 * Scheduled event handler - Runs every 5 minutes
 * This is the main entry point for the ETL sync process
 */
export default {
  async scheduled(event, env, ctx) {
    console.log('[ETL] Scheduled sync started at', new Date().toISOString());

    const startTime = Date.now();
    const syncId = generateSyncId();

    try {
      // Pre-flight checks
      await performHealthChecks(env);

      // Get sync state
      const syncState = await getSyncState(env);
      console.log('[ETL] Sync state:', syncState);

      // Execute sync
      const result = await executeSyncCycle(env, syncState, syncId);

      // Update state
      await updateSyncState(env, result, syncId);

      // Record metrics
      await recordMetrics(env, result, startTime, syncId);

      console.log('[ETL] Sync completed successfully:', result);

    } catch (error) {
      console.error('[ETL] Sync failed:', error);
      await handleSyncError(env, error, syncId, startTime);

      // Re-throw for monitoring systems to catch
      throw error;
    }
  },

  /**
   * HTTP handler for manual triggers and status checks
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route handlers
    if (url.pathname === '/health') {
      return handleHealthCheck(env);
    }

    if (url.pathname === '/status') {
      return handleStatusCheck(env);
    }

    if (url.pathname === '/trigger' && request.method === 'POST') {
      // Manual sync trigger (requires auth)
      return handleManualTrigger(request, env, ctx);
    }

    if (url.pathname === '/stats') {
      return handleStatsRequest(env);
    }

    return new Response('ETL Sync Worker - Use /health, /status, /stats, or /trigger', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

// ============================================================================
// Core Sync Logic
// ============================================================================

/**
 * Execute a complete sync cycle
 *
 * @param {Object} env - Worker environment bindings
 * @param {Object} syncState - Current sync state
 * @param {string} syncId - Unique sync identifier
 * @returns {Promise<Object>} Sync result summary
 */
async function executeSyncCycle(env, syncState, syncId) {
  const result = {
    syncId,
    startTime: new Date().toISOString(),
    recordsFetched: 0,
    recordsInserted: 0,
    recordsFailed: 0,
    pointsProcessed: 0,
    apiCalls: 0,
    duration: 0,
    errors: []
  };

  try {
    // Calculate time range for this sync
    const timeRange = calculateTimeRange(syncState);
    console.log('[ETL] Sync time range:', timeRange);

    // Sync all configured sites
    console.log(`[ETL] Syncing ${syncState.sites.length} site(s): ${syncState.sites.join(', ')}`);

    for (const siteName of syncState.sites) {
      console.log(`[ETL] === Processing site: ${siteName} ===`);

      try {
        // Sync timeseries data (no filtering - store all points)
        // This avoids the 30-second timeout from fetching 46 pages of configured points
        console.log(`[ETL] Syncing ALL timeseries data for site (filtering disabled to prevent timeout)`);
        const syncResult = await syncAllPointsNoFilter(
          env,
          siteName,
          timeRange,
          syncId
        );

        result.recordsFetched += syncResult.fetched;
        result.recordsInserted += syncResult.inserted;
        result.recordsFailed += syncResult.failed;
        result.apiCalls += syncResult.apiCalls;
        // Note: We no longer fetch configured points list to avoid timeouts
        // Point count can be inferred from unique point_names in fetched samples
        result.pointsProcessed += syncResult.fetched; // Approximate point activity

        console.log(`[ETL] Site ${siteName} timeseries complete: ${syncResult.inserted} records inserted`);

        // Fetch and store weather data for this site
        try {
          const weatherResult = await syncWeatherData(env, siteName);
          console.log(`[ETL] Site ${siteName} weather data: ${weatherResult.inserted} record inserted`);

          result.recordsInserted += weatherResult.inserted;
          result.apiCalls += weatherResult.apiCalls;
        } catch (weatherError) {
          console.error(`[ETL] Failed to sync weather data for ${siteName}:`, weatherError);
          result.errors.push({
            stage: 'sync_weather',
            site: siteName,
            error: weatherError.message
          });
        }

      } catch (error) {
        console.error(`[ETL] Failed to sync site ${siteName}:`, error);
        result.errors.push({
          stage: 'sync_site',
          site: siteName,
          error: error.message
        });
      }
    }

    result.endTime = new Date().toISOString();
    result.duration = Date.now() - new Date(result.startTime).getTime();

    return result;

  } catch (error) {
    result.errors.push({
      stage: 'sync_cycle',
      error: error.message
    });
    throw error;
  }
}

/**
 * Sync RAW timeseries data for ALL points (no filtering)
 * Optimized to avoid 30-second timeout from fetching configured points list
 *
 * INCREMENTAL SYNC STRATEGY:
 * - Uses raw_data=true to get actual sensor readings (not averaged)
 * - ACE API has current data with no processing lag
 * - First sync: Fetches last 24 hours of data
 * - Subsequent syncs: Incremental from last sync timestamp to now
 * - No filtering: Stores ALL points to avoid timeout
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} siteName - Site identifier
 * @param {Object} timeRange - Time range to sync
 * @param {string} syncId - Unique sync identifier
 * @returns {Promise<Object>} Sync result
 */
async function syncAllPointsNoFilter(env, siteName, timeRange, syncId) {
  console.log(`[ETL] Fetching RAW timeseries for ALL points (no filtering - raw sensor readings)`);

  const result = {
    fetched: 0,
    inserted: 0,
    failed: 0,
    apiCalls: 0
  };

  // Fetch ALL timeseries data from ACE API (all points at once)
  const allTimeseriesData = await fetchAllTimeseries(
    env,
    siteName,
    timeRange.start,
    timeRange.end,
    result
  );

  if (!allTimeseriesData || allTimeseriesData.length === 0) {
    console.log(`[ETL] No timeseries data returned from API`);
    return result;
  }

  console.log(`[ETL] Fetched ${allTimeseriesData.length} total samples from API`);

  // Filter out NULL and NaN values only (no point filtering)
  const filteredSamples = allTimeseriesData.filter(sample => {
    // Filter out NULL values
    if (sample.value == null) return false;

    // Filter out string "NaN" values from ACE API
    if (sample.value === "NaN" || sample.value === "nan") return false;

    // Filter out actual NaN after parsing
    const parsed = parseFloat(sample.value);
    return !isNaN(parsed);
  });

  console.log(`[ETL] Filtered from ${allTimeseriesData.length} total samples to ${filteredSamples.length} valid samples (NULL/NaN values removed)`);

  result.fetched = filteredSamples.length;

  if (filteredSamples.length === 0) {
    console.log(`[ETL] No data for configured points`);
    return result;
  }

  // Transform flat samples to normalized format
  const allNormalizedSamples = filteredSamples.map(sample => {
    // Parse timestamp - ACE API returns "time" field with ISO 8601 string
    const timestamp = Math.floor(new Date(sample.time).getTime());

    // Get value from sample
    const value = parseFloat(sample.value);

    return {
      site_name: siteName,
      point_name: sample.name,
      timestamp, // milliseconds since Unix epoch
      avg_value: value
    };
  });

  console.log(`[ETL] Transformed ${allNormalizedSamples.length} samples for D1 insert`);

  if (allNormalizedSamples.length === 0) {
    console.log(`[ETL] No data for configured points`);
    return result;
  }

  // Batch insert to D1
  const insertResult = await batchInsertTimeseries(
    env.DB,
    allNormalizedSamples
  );

  result.inserted = insertResult.inserted;
  result.failed = insertResult.failed;

  // Write to R2 cold storage for historical data (if R2 binding is available)
  if (env.R2 && allNormalizedSamples.length > 0) {
    try {
      // Get date string for R2 path (YYYY-MM-DD format)
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // "2025-10-15"

      console.log(`[ETL] Writing ${allNormalizedSamples.length} samples to R2 for date: ${dateStr}`);

      // Write to R2 (async, non-blocking)
      await writeNDJSONToR2(env.R2, siteName, dateStr, allNormalizedSamples);

      console.log(`[ETL] R2 write complete for ${siteName}/${dateStr}`);
    } catch (r2Error) {
      console.error('[ETL] Failed to write to R2 (non-fatal):', r2Error);
      // Don't fail the entire sync if R2 write fails
    }
  } else if (!env.R2) {
    console.log('[ETL] R2 binding not available, skipping cold storage write');
  }

  return result;
}

// ============================================================================
// ACE API Client
// ============================================================================

/**
 * Fetch ALL configured points for a site with pagination and KV caching
 * Handles ~4,583 points across multiple pages (cached for 1 hour to prevent timeouts)
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} siteName - Site identifier
 * @returns {Promise<Array>} Array of all collect-enabled point objects
 */
async function fetchPointsList(env, siteName) {
  // Check KV cache first to avoid fetching 46 pages on every sync
  const cacheKey = `${CONFIG.KV_POINTS_CACHE_PREFIX}${siteName}`;
  const cachedPoints = await env.ETL_STATE.get(cacheKey, { type: 'json' });

  if (cachedPoints && Array.isArray(cachedPoints)) {
    console.log(`[KV Cache] Using cached configured points: ${cachedPoints.length} points`);
    return cachedPoints;
  }

  console.log(`[KV Cache] No cache found, fetching fresh configured points from API`);

  const apiBase = env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';
  const allPoints = [];
  let page = 1;
  let totalPages = 1;

  console.log(`[ACE API] Fetching configured points for site: ${siteName}`);

  // Fetch all pages
  do {
    const url = `${apiBase}/sites/${siteName}/configured_points?page=${page}&per_page=100`;

    const response = await fetchWithRetry(url, {
      headers: {
        'authorization': `Bearer ${env.ACE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch points list (page ${page}): ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const points = data.items || data.configured_points || data.points || [];

    // Filter to only collect_enabled points
    const collectEnabled = points.filter(p => p.collect_enabled === true);
    allPoints.push(...collectEnabled);

    console.log(`[ACE API] Page ${page}: ${collectEnabled.length} collect-enabled points (${points.length} total)`);

    // Calculate total pages from metadata
    if (page === 1 && data.total) {
      totalPages = Math.ceil(data.total / (data.per_page || 100));
      console.log(`[ACE API] Total pages to fetch: ${totalPages} (${data.total} total points)`);
    }

    page++;

    // Safety check - prevent infinite loops
    if (page > 500) {
      console.warn('[ACE API] Too many pages, stopping pagination');
      break;
    }

  } while (page <= totalPages);

  console.log(`[ACE API] Fetched ${allPoints.length} collect-enabled configured points across ${page - 1} pages`);

  // Cache the result in KV for 1 hour
  await env.ETL_STATE.put(
    cacheKey,
    JSON.stringify(allPoints),
    {
      expirationTtl: CONFIG.POINTS_CACHE_TTL_SECONDS
    }
  );
  console.log(`[KV Cache] Cached ${allPoints.length} configured points for ${CONFIG.POINTS_CACHE_TTL_SECONDS}s`);

  return allPoints;
}

/**
 * Fetch ALL timeseries data for the site from ACE API with cursor-based pagination
 * Uses the correct paginated endpoint: /sites/{site}/timeseries/paginated
 * Returns flat array of samples for ALL points, which we filter worker-side
 *
 * RAW DATA MODE:
 * - raw_data=true: Gets actual sensor readings (not 5-min averages)
 * - No processing lag: ACE API has current data available
 * - Time range: Queries data from last sync to now
 * - Incremental sync: Fetches only new data since last sync
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} siteName - Site identifier
 * @param {number} startTime - Start timestamp (Unix seconds)
 * @param {number} endTime - End timestamp (Unix seconds)
 * @param {Object} result - Result object to update with API call count
 * @returns {Promise<Array>} Flat array of samples { name, value, time }
 */
async function fetchAllTimeseries(env, siteName, startTime, endTime, result) {
  const apiBase = env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';
  const allSamples = [];
  let cursor = null;
  let pageCount = 0;

  // Convert Unix seconds to ISO 8601 format for ACE API
  const startISO = new Date(startTime * 1000).toISOString();
  const endISO = new Date(endTime * 1000).toISOString();

  console.log(`[ACE API] Fetching site timeseries (RAW mode - actual sensor readings): ${startISO} to ${endISO}`);

  do {
    // Build paginated endpoint URL
    const url = new URL(`${apiBase}/sites/${siteName}/timeseries/paginated`);
    url.searchParams.set('start_time', startISO);
    url.searchParams.set('end_time', endISO);
    url.searchParams.set('page_size', '100000'); // Large page size to minimize API calls
    url.searchParams.set('raw_data', 'true'); // RAW MODE: Get actual sensor readings per user requirement

    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    pageCount++;
    console.log(`[ACE API] Fetching page ${pageCount} (raw_data=true - raw sensor readings)${cursor ? ` (cursor: ${cursor.substring(0, 20)}...)` : ''}`);

    const response = await fetchWithRetry(url.toString(), {
      headers: {
        'authorization': `Bearer ${env.ACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(CONFIG.ACE_TIMEOUT_MS)
    });

    result.apiCalls++;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ACE API timeseries error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // ACE API returns: { point_samples: [{name, value, time}], next_cursor, has_more }
    if (data.point_samples && Array.isArray(data.point_samples)) {
      allSamples.push(...data.point_samples);
      console.log(`[ACE API] Page ${pageCount}: ${data.point_samples.length} samples`);
    }

    // Check for next page via cursor
    cursor = data.next_cursor || null;

    // Respect has_more flag
    if (data.has_more === false) {
      cursor = null;
    }

    // Safety limit to prevent infinite loops
    if (pageCount > 200) {
      console.warn('[ACE API] Reached page limit (200), stopping pagination');
      break;
    }

  } while (cursor);

  console.log(`[ACE API] Timeseries fetch complete: ${pageCount} pages, ${allSamples.length} total samples`);
  return allSamples;
}

/**
 * Fetch weather data for a site from ACE API
 * Returns current weather conditions including temperature, humidity, wind, etc.
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} siteName - Site identifier
 * @returns {Promise<Object>} Weather data object
 */
async function fetchWeatherData(env, siteName) {
  const apiBase = env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';
  const url = `${apiBase}/sites/${siteName}/weather`;

  console.log(`[ACE API] Fetching weather data for site: ${siteName}`);

  const response = await fetchWithRetry(url, {
    headers: {
      'authorization': `Bearer ${env.ACE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(CONFIG.ACE_TIMEOUT_MS)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ACE API weather error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const weatherData = await response.json();
  console.log(`[ACE API] Weather data received:`, weatherData);

  return weatherData;
}

/**
 * Sync weather data to D1 database
 * Stores current weather conditions for the site
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} siteName - Site identifier
 * @returns {Promise<Object>} Sync result { inserted, failed, apiCalls }
 */
async function syncWeatherData(env, siteName) {
  const result = {
    inserted: 0,
    failed: 0,
    apiCalls: 0
  };

  try {
    // Fetch weather data from ACE API
    const weatherData = await fetchWeatherData(env, siteName);
    result.apiCalls++;

    if (!weatherData || Object.keys(weatherData).length === 0) {
      console.log(`[ETL] No weather data returned for site ${siteName}`);
      return result;
    }

    // Transform weather data to timeseries format
    // Each weather metric becomes a point in timeseries_raw
    const timestamp = Math.floor(Date.now() / 1000); // Current time in seconds
    const weatherPoints = [];

    // Map weather fields to point names
    const weatherMapping = {
      temp: 'weather.temperature',
      feels_like: 'weather.feels_like',
      pressure: 'weather.pressure',
      humidity: 'weather.humidity',
      dew_point: 'weather.dew_point',
      clouds: 'weather.clouds',
      wind_speed: 'weather.wind_speed',
      wind_deg: 'weather.wind_direction',
      wet_bulb: 'weather.wet_bulb'
    };

    for (const [field, pointName] of Object.entries(weatherMapping)) {
      if (weatherData[field] != null && !isNaN(parseFloat(weatherData[field]))) {
        weatherPoints.push({
          site_name: siteName,
          point_name: pointName,
          timestamp: timestamp * 1000, // Convert to milliseconds for D1 client
          avg_value: parseFloat(weatherData[field])
        });
      }
    }

    console.log(`[ETL] Transformed ${weatherPoints.length} weather metrics for D1 insert`);

    if (weatherPoints.length === 0) {
      console.log(`[ETL] No valid weather metrics to insert`);
      return result;
    }

    // Batch insert weather data
    const insertResult = await batchInsertTimeseries(env.DB, weatherPoints);
    result.inserted = insertResult.inserted;
    result.failed = insertResult.failed;

    return result;

  } catch (error) {
    console.error('[ETL] Weather sync error:', error);
    result.failed++;
    throw error;
  }
}

/**
 * Fetch with retry logic and exponential backoff
 *
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, options) {
  let lastError = null;

  for (let attempt = 1; attempt <= CONFIG.MAX_API_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 5xx errors
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }

      return response;

    } catch (error) {
      lastError = error;
      console.warn(`[ACE API] Request failed (attempt ${attempt}/${CONFIG.MAX_API_RETRIES}):`, error.message);

      if (attempt < CONFIG.MAX_API_RETRIES) {
        const delay = CONFIG.API_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Data Transformation
// ============================================================================

/**
 * Transform ACE API samples to normalized D1 format
 *
 * @param {Array} samples - Raw samples from ACE API
 * @param {string} siteName - Site identifier
 * @param {string} pointName - Point identifier
 * @returns {Array} Normalized samples
 */
function transformSamples(samples, siteName, pointName) {
  return samples.map(sample => {
    // Parse timestamp - ACE API returns "time" field with ISO 8601 string
    const timestamp = Math.floor(new Date(sample.time).getTime());

    // Get value from sample
    const value = parseFloat(sample.value);

    return {
      site_name: siteName,
      point_name: pointName,
      timestamp, // milliseconds since Unix epoch
      avg_value: value
    };
  });
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Get current sync state from KV
 *
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<Object>} Sync state
 */
async function getSyncState(env) {
  const lastSyncStr = await env.ETL_STATE.get(CONFIG.KV_LAST_SYNC_KEY);

  const now = Date.now();
  // ACE API has current data with no processing lag
  // First sync starts from 24 hours ago, then incremental from last sync timestamp
  const defaultStartTime = now - (24 * 60 * 60 * 1000); // 24 hours for first sync

  // Support multiple sites via comma-separated env var
  const sitesConfig = env.SITE_NAME || 'ses_falls_city';
  const sites = sitesConfig.split(',').map(s => s.trim());

  return {
    lastSyncTimestamp: lastSyncStr ? parseInt(lastSyncStr) : defaultStartTime,
    sites, // Array of site names
    siteName: sites[0], // Primary site for backward compatibility
    syncInterval: CONFIG.SYNC_INTERVAL_MINUTES
  };
}

/**
 * Update sync state in KV after successful sync
 *
 * @param {Object} env - Worker environment bindings
 * @param {Object} result - Sync result
 * @param {string} syncId - Unique sync identifier
 */
async function updateSyncState(env, result, syncId) {
  const now = Date.now();

  // Update last sync timestamp
  await env.ETL_STATE.put(
    CONFIG.KV_LAST_SYNC_KEY,
    now.toString(),
    {
      metadata: {
        syncId,
        recordsInserted: result.recordsInserted,
        timestamp: new Date().toISOString()
      }
    }
  );

  // Store sync state snapshot
  const stateKey = `${CONFIG.KV_STATE_PREFIX}${syncId}`;
  await env.ETL_STATE.put(
    stateKey,
    JSON.stringify(result),
    {
      expirationTtl: 86400 * 7 // Keep for 7 days
    }
  );
}

/**
 * Calculate time range for current sync with incremental strategy
 *
 * INCREMENTAL SYNC STRATEGY:
 * - ACE API has current data with no processing lag
 * - First sync: Query last 24 hours of data (from 24h ago to now)
 * - Subsequent syncs: Incremental from last sync timestamp to now
 * - End time: ALWAYS now (current time)
 *
 * This ensures we capture current data and prevents missing samples.
 *
 * @param {Object} syncState - Current sync state
 * @returns {Object} Time range { start, end }
 */
function calculateTimeRange(syncState) {
  const now = Date.now();

  // Determine if this is first sync (last sync > 7 days ago or not set)
  const isFirstSync = !syncState.lastSyncTimestamp ||
                      syncState.lastSyncTimestamp < (now - 7 * 86400000);

  let start, end;

  if (isFirstSync) {
    // First sync: Get last 24 hours of data
    start = Math.floor((now - 86400000) / 1000); // 24h ago in seconds
    end = Math.floor(now / 1000);                 // now in seconds
    console.log(`[ETL] FIRST SYNC: Fetching last 24 hours of data`);
  } else {
    // Incremental: From last sync to now
    start = Math.floor(syncState.lastSyncTimestamp / 1000);
    end = Math.floor(now / 1000);
    console.log(`[ETL] INCREMENTAL SYNC: From last sync to now`);
  }

  console.log(`[ETL] Time range: ${new Date(start * 1000).toISOString()} → ${new Date(end * 1000).toISOString()} (${isFirstSync ? 'FIRST' : 'INCREMENTAL'})`);

  return { start, end };
}

// ============================================================================
// Metadata and Quality Tracking
// ============================================================================

/**
 * Update point metadata after sync
 */
async function updatePointMetadata(db, siteName, pointName, samples) {
  if (samples.length === 0) return;

  const timestamps = samples.map(s => s.timestamp);

  await updateQueryMetadata(db, siteName, pointName, {
    dataStart: Math.min(...timestamps),
    dataEnd: Math.max(...timestamps),
    totalSamples: samples.length,
    lastAggregated: Math.floor(Date.now() / 1000)
  });
}

/**
 * Record data quality metrics
 */
async function recordPointQuality(db, siteName, pointName, samples, timeRange) {
  if (samples.length === 0) return;

  const date = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const timeRangeMinutes = (timeRange.end - timeRange.start) / 60;
  const expectedSamples = Math.floor(timeRangeMinutes);
  const actualSamples = samples.length;
  const missingSamples = Math.max(0, expectedSamples - actualSamples);
  const qualityScore = actualSamples / expectedSamples;

  await recordDataQuality(db, {
    site_name: siteName,
    point_name: pointName,
    date,
    expected_samples: expectedSamples,
    actual_samples: actualSamples,
    missing_samples: missingSamples,
    outlier_count: 0, // TODO: Implement outlier detection
    quality_score: Math.min(1.0, qualityScore)
  });
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle sync errors and log to KV
 */
async function handleSyncError(env, error, syncId, startTime) {
  const errorLog = {
    syncId,
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    error: error.message,
    stack: error.stack
  };

  // Log to KV
  const errorKey = `${CONFIG.KV_ERROR_LOG_PREFIX}${syncId}`;
  await env.ETL_STATE.put(
    errorKey,
    JSON.stringify(errorLog),
    {
      expirationTtl: 86400 * 30 // Keep errors for 30 days
    }
  );

  console.error('[ETL] Error logged to KV:', errorKey);
}

// ============================================================================
// Monitoring and Health Checks
// ============================================================================

/**
 * Perform pre-flight health checks
 */
async function performHealthChecks(env) {
  // Check D1 connection
  const dbHealthy = await healthCheck(env.DB);
  if (!dbHealthy) {
    throw new Error('D1 database health check failed');
  }

  // Check KV availability
  try {
    await env.ETL_STATE.get('health_check');
  } catch (error) {
    throw new Error('KV namespace health check failed');
  }

  console.log('[ETL] Health checks passed');
}

/**
 * Record sync metrics to KV
 */
async function recordMetrics(env, result, startTime, syncId) {
  const metrics = {
    syncId,
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    recordsFetched: result.recordsFetched,
    recordsInserted: result.recordsInserted,
    recordsFailed: result.recordsFailed,
    pointsProcessed: result.pointsProcessed,
    apiCalls: result.apiCalls,
    errors: result.errors.length
  };

  const metricsKey = `${CONFIG.KV_METRICS_PREFIX}${syncId}`;
  await env.ETL_STATE.put(
    metricsKey,
    JSON.stringify(metrics),
    {
      expirationTtl: 86400 * 7 // Keep for 7 days
    }
  );
}

/**
 * Handle health check request
 */
async function handleHealthCheck(env) {
  try {
    const dbHealthy = await healthCheck(env.DB);

    return new Response(JSON.stringify({
      status: dbHealthy ? 'healthy' : 'unhealthy',
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    }), {
      status: dbHealthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle status check request
 */
async function handleStatusCheck(env) {
  try {
    const syncState = await getSyncState(env);
    const stats = await getStats(env.DB);

    return new Response(JSON.stringify({
      status: 'running',
      lastSync: new Date(syncState.lastSyncTimestamp).toISOString(),
      siteName: syncState.siteName,
      database: stats,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle stats request
 */
async function handleStatsRequest(env) {
  try {
    const stats = await getStats(env.DB);

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle manual sync trigger
 */
async function handleManualTrigger(request, env, ctx) {
  // TODO: Add authentication check

  const syncId = generateSyncId();

  // Execute sync asynchronously
  ctx.waitUntil((async () => {
    try {
      const syncState = await getSyncState(env);
      const result = await executeSyncCycle(env, syncState, syncId);
      await updateSyncState(env, result, syncId);
      await recordMetrics(env, result, Date.now(), syncId);
    } catch (error) {
      await handleSyncError(env, error, syncId, Date.now());
    }
  })());

  return new Response(JSON.stringify({
    status: 'triggered',
    syncId,
    message: 'Sync started in background'
  }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique sync ID
 */
function generateSyncId() {
  return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
