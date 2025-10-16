/**
 * ============================================================================
 * Query Worker - Unified Timeseries Query API
 * ============================================================================
 *
 * Abstracts D1 (hot storage) and R2 (cold storage) for transparent querying.
 * Automatically routes queries based on 20-day hot/cold boundary.
 *
 * Key Features:
 * - Intelligent routing: D1-only, R2-only, or split queries
 * - Result merging from multiple storage tiers
 * - Parquet file reading from R2 with filtering
 * - Performance optimization with KV caching
 * - Graceful error handling and fallback
 *
 * API Endpoint: GET /timeseries/query
 * Query Parameters:
 * - site_name: Site identifier (required)
 * - point_names: Comma-separated point names (required)
 * - start_time: Unix timestamp in milliseconds (required)
 * - end_time: Unix timestamp in milliseconds (required)
 * - interval: Aggregation level (optional: 1min, 5min, 1hr, 1day)
 *
 * @module query-worker
 */

import { queryR2Timeseries } from './lib/r2-client.js';

// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  // Storage tier boundary
  HOT_STORAGE_DAYS: 20,

  // Query limits
  MAX_POINTS_PER_QUERY: 100,
  MAX_QUERY_RANGE_DAYS: 365,
  MAX_SAMPLES_LIMIT: 1000000, // 1 million samples max
  MIN_TIMESTAMP: 946684800000, // 2000-01-01 (reasonable lower bound)

  // Performance
  D1_QUERY_TIMEOUT_MS: 10000, // 10 seconds
  R2_QUERY_TIMEOUT_MS: 25000, // 25 seconds

  // Cache TTL (seconds)
  CACHE_TTL_HOT: 60,        // 1 minute for recent data
  CACHE_TTL_WARM: 300,      // 5 minutes for 1-7 days old
  CACHE_TTL_COLD: 3600,     // 1 hour for 7-30 days old
  CACHE_TTL_HISTORICAL: 86400, // 24 hours for >30 days old

  // Error codes
  ERROR_CODES: {
    INVALID_REQUEST: 'INVALID_REQUEST',
    POINT_NOT_FOUND: 'POINT_NOT_FOUND',
    TIME_RANGE_TOO_LARGE: 'TIME_RANGE_TOO_LARGE',
    SAMPLE_LIMIT_EXCEEDED: 'SAMPLE_LIMIT_EXCEEDED',
    D1_UNAVAILABLE: 'D1_UNAVAILABLE',
    R2_UNAVAILABLE: 'R2_UNAVAILABLE',
    TIMEOUT: 'TIMEOUT',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
  }
};

// ============================================================================
// Security Functions
// ============================================================================

/**
 * Validate origin against whitelist
 * @param {string} origin - Request origin
 * @param {Object} env - Worker environment
 * @returns {boolean} True if origin is allowed
 */
function validateOrigin(origin, env) {
  if (!origin) return false;

  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
  return allowedOrigins.includes(origin);
}

/**
 * Generate CORS headers with origin validation
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment
 * @returns {Object} CORS headers object
 */
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');

  if (validateOrigin(origin, env)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ACE-Token',
      'Access-Control-Max-Age': '86400'
    };
  }

  // No CORS headers for unauthorized origins
  return {};
}

/**
 * Sanitize error response for production
 * @param {Error} error - Error object
 * @param {boolean} isDevelopment - Development mode flag
 * @param {Object} corsHeaders - CORS headers to include
 * @returns {Response} Safe error response
 */
function safeErrorResponse(error, isDevelopment = false, corsHeaders = {}) {
  console.error('[Query Worker Error]', error);

  const requestId = crypto.randomUUID();

  if (isDevelopment) {
    // Show details in dev environment
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
      request_id: requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Production: generic message
  return new Response(JSON.stringify({
    error: 'Internal server error',
    message: 'An unexpected error occurred. Please contact support with this request ID.',
    request_id: requestId
  }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// Worker Entry Point
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    // Route handlers
    if (url.pathname === '/timeseries/query' && request.method === 'GET') {
      return handleQueryRequest(request, env, ctx, cors);
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'healthy' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Query Worker - Use /timeseries/query endpoint', {
      status: 200,
      headers: { ...cors, 'Content-Type': 'text/plain' }
    });
  }
};

// ============================================================================
// Query Request Handler
// ============================================================================

/**
 * Handle timeseries query request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} ctx - Execution context
 * @param {Object} cors - CORS headers
 * @returns {Promise<Response>} Query response
 */
async function handleQueryRequest(request, env, ctx, cors) {
  const startTime = Date.now();
  const queryId = generateQueryId();
  const isDev = env.ENVIRONMENT === 'development';

  try {
    // Parse and validate query parameters
    const queryParams = parseQueryParams(request);
    validateQueryParams(queryParams);

    console.log(`[Query ${queryId}] Request:`, queryParams);

    // Check cache first
    const cacheKey = generateCacheKey(queryParams);
    const cached = await checkCache(env, cacheKey);

    if (cached) {
      console.log(`[Query ${queryId}] Cache hit: ${cacheKey}`);
      return createResponse(cached, true, Date.now() - startTime, cors);
    }

    // Determine storage tier routing
    const routingStrategy = determineRoutingStrategy(queryParams);
    console.log(`[Query ${queryId}] Routing strategy:`, routingStrategy);

    // Execute query based on strategy
    let result;

    if (routingStrategy.type === 'D1_ONLY') {
      result = await queryD1Only(env, queryParams, routingStrategy);
    } else if (routingStrategy.type === 'R2_ONLY') {
      result = await queryR2Only(env, queryParams, routingStrategy);
    } else if (routingStrategy.type === 'SPLIT') {
      result = await querySplit(env, queryParams, routingStrategy);
    } else {
      throw new Error('Unknown routing strategy');
    }

    // Cache result
    const ttl = calculateCacheTTL(queryParams);
    await cacheResult(env, cacheKey, result, ttl);

    console.log(`[Query ${queryId}] Complete: ${result.samples.length} samples from ${result.metadata.sources.join(', ')}`);

    return createResponse(result, false, Date.now() - startTime, cors);

  } catch (error) {
    console.error(`[Query ${queryId}] Error:`, error);

    // Use safe error handling for non-validation errors
    if (error instanceof ValidationError) {
      return createErrorResponse(error, Date.now() - startTime, cors);
    } else {
      return safeErrorResponse(error, isDev, cors);
    }
  }
}

// ============================================================================
// Query Parameter Parsing & Validation
// ============================================================================

/**
 * Parse query parameters from request URL
 */
function parseQueryParams(request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  return {
    site_name: params.get('site_name'),
    point_names: params.get('point_names')?.split(',').map(p => p.trim()) || [],
    start_time: parseTimestamp(params.get('start_time')),
    end_time: parseTimestamp(params.get('end_time')),
    interval: params.get('interval') || '1min'
  };
}

/**
 * Parse timestamp from query parameter
 * Supports both Unix timestamps (milliseconds) and ISO 8601 strings
 *
 * @param {string} timeParam - Timestamp parameter value
 * @returns {number} Unix timestamp in milliseconds
 */
function parseTimestamp(timeParam) {
  if (!timeParam) {
    return NaN;
  }

  // Try parsing as integer first (Unix timestamp in milliseconds)
  const intValue = parseInt(timeParam);
  if (!isNaN(intValue) && intValue.toString() === timeParam) {
    return intValue;
  }

  // Try parsing as ISO 8601 date string
  const dateValue = Date.parse(timeParam);
  if (!isNaN(dateValue)) {
    return dateValue;
  }

  // Invalid timestamp format
  return NaN;
}

/**
 * Validate query parameters
 */
function validateQueryParams(params) {
  const errors = [];

  // Required fields validation
  if (!params.site_name || typeof params.site_name !== 'string') {
    errors.push('site_name is required and must be a string');
  } else if (params.site_name.length > 100) {
    errors.push('site_name must be less than 100 characters');
  } else if (!/^[a-zA-Z0-9_\-\.]+$/.test(params.site_name)) {
    errors.push('site_name contains invalid characters (allowed: alphanumeric, _, -, .)');
  }

  if (!params.point_names || params.point_names.length === 0) {
    errors.push('point_names is required (comma-separated)');
  } else if (!Array.isArray(params.point_names)) {
    errors.push('point_names must be an array');
  } else {
    // Validate each point name
    for (const pointName of params.point_names) {
      if (typeof pointName !== 'string') {
        errors.push('All point_names must be strings');
        break;
      }
      if (pointName.length > 200) {
        errors.push('Each point name must be less than 200 characters');
        break;
      }
    }
  }

  if (!params.start_time || isNaN(params.start_time)) {
    errors.push('start_time must be a valid Unix timestamp (milliseconds)');
  } else if (params.start_time < CONFIG.MIN_TIMESTAMP) {
    errors.push(`start_time must be after ${new Date(CONFIG.MIN_TIMESTAMP).toISOString()}`);
  } else if (params.start_time > Date.now()) {
    errors.push('start_time cannot be in the future');
  }

  if (!params.end_time || isNaN(params.end_time)) {
    errors.push('end_time must be a valid Unix timestamp (milliseconds)');
  } else if (params.end_time < CONFIG.MIN_TIMESTAMP) {
    errors.push(`end_time must be after ${new Date(CONFIG.MIN_TIMESTAMP).toISOString()}`);
  } else if (params.end_time > Date.now() + 86400000) {
    // Allow 1 day in future for timezone issues
    errors.push('end_time cannot be more than 1 day in the future');
  }

  // Time range validation (only if timestamps are valid)
  if (errors.length === 0) {
    if (params.start_time >= params.end_time) {
      errors.push('start_time must be before end_time');
    }

    const rangeMs = params.end_time - params.start_time;
    const rangeDays = rangeMs / (1000 * 60 * 60 * 24);

    if (rangeDays > CONFIG.MAX_QUERY_RANGE_DAYS) {
      errors.push(`Time range exceeds maximum of ${CONFIG.MAX_QUERY_RANGE_DAYS} days`);
    }

    if (rangeMs < 60000) {
      // Minimum 1 minute range
      errors.push('Time range must be at least 1 minute');
    }
  }

  // Point count validation
  if (params.point_names && params.point_names.length > CONFIG.MAX_POINTS_PER_QUERY) {
    errors.push(`Maximum ${CONFIG.MAX_POINTS_PER_QUERY} points per query`);
  }

  // Interval validation
  const validIntervals = ['1min', '5min', '1hr', '1day'];
  if (params.interval && !validIntervals.includes(params.interval)) {
    errors.push(`Invalid interval. Must be one of: ${validIntervals.join(', ')}`);
  }

  // If there are validation errors, throw with all details
  if (errors.length > 0) {
    throw new ValidationError(errors.join('; '));
  }
}

// ============================================================================
// Routing Strategy Determination
// ============================================================================

/**
 * Determine optimal storage tier routing strategy
 *
 * Rules:
 * 1. If end_time < 20 days ago: R2_ONLY (all data is cold)
 * 2. If start_time >= 20 days ago: D1_ONLY (all data is hot)
 * 3. Otherwise: SPLIT (query both, merge results)
 *
 * @param {Object} queryParams - Query parameters
 * @returns {Object} Routing strategy
 */
function determineRoutingStrategy(queryParams) {
  const now = Date.now();
  const hotBoundary = now - (CONFIG.HOT_STORAGE_DAYS * 24 * 60 * 60 * 1000);

  const { start_time, end_time } = queryParams;

  // Entire range is cold (older than 20 days)
  if (end_time < hotBoundary) {
    return {
      type: 'R2_ONLY',
      r2_range: { start: start_time, end: end_time }
    };
  }

  // Entire range is hot (within last 20 days)
  if (start_time >= hotBoundary) {
    return {
      type: 'D1_ONLY',
      d1_range: { start: start_time, end: end_time }
    };
  }

  // Range spans both hot and cold
  return {
    type: 'SPLIT',
    d1_range: { start: hotBoundary, end: end_time },
    r2_range: { start: start_time, end: hotBoundary }
  };
}

// ============================================================================
// Query Execution Functions
// ============================================================================

/**
 * Query D1 only (hot storage)
 */
async function queryD1Only(env, queryParams, strategy) {
  console.log('[Query] Executing D1-only query');

  const samples = await queryD1(
    env.DB,
    queryParams.site_name,
    queryParams.point_names,
    strategy.d1_range.start,
    strategy.d1_range.end
  );

  return {
    site_name: queryParams.site_name,
    point_names: queryParams.point_names,
    samples,
    metadata: {
      total_samples: samples.length,
      sources: ['D1'],
      storage_tiers: {
        hot: {
          start: new Date(strategy.d1_range.start).toISOString(),
          end: new Date(strategy.d1_range.end).toISOString(),
          sample_count: samples.length
        }
      },
      query_time_ms: 0, // Will be set by caller
      cache_hit: false
    }
  };
}

/**
 * Query R2 only (cold storage)
 */
async function queryR2Only(env, queryParams, strategy) {
  console.log('[Query] Executing R2-only query');

  const samples = await queryR2Timeseries(
    env.R2,
    queryParams.site_name,
    queryParams.point_names,
    strategy.r2_range.start,
    strategy.r2_range.end
  );

  return {
    site_name: queryParams.site_name,
    point_names: queryParams.point_names,
    samples,
    metadata: {
      total_samples: samples.length,
      sources: ['R2'],
      storage_tiers: {
        cold: {
          start: new Date(strategy.r2_range.start).toISOString(),
          end: new Date(strategy.r2_range.end).toISOString(),
          file_count: calculateFileCount(strategy.r2_range.start, strategy.r2_range.end)
        }
      },
      query_time_ms: 0,
      cache_hit: false
    }
  };
}

/**
 * Query both D1 and R2, then merge results
 */
async function querySplit(env, queryParams, strategy) {
  console.log('[Query] Executing split query (D1 + R2)');

  // Execute queries in parallel
  const [d1Samples, r2Samples] = await Promise.all([
    queryD1(
      env.DB,
      queryParams.site_name,
      queryParams.point_names,
      strategy.d1_range.start,
      strategy.d1_range.end
    ).catch(error => {
      console.error('[Query] D1 query failed, continuing with R2 only:', error);
      return [];
    }),

    queryR2Timeseries(
      env.R2,
      queryParams.site_name,
      queryParams.point_names,
      strategy.r2_range.start,
      strategy.r2_range.end
    ).catch(error => {
      console.error('[Query] R2 query failed, continuing with D1 only:', error);
      return [];
    })
  ]);

  // Merge and deduplicate results
  const mergedSamples = mergeSamples(d1Samples, r2Samples);

  return {
    site_name: queryParams.site_name,
    point_names: queryParams.point_names,
    samples: mergedSamples,
    metadata: {
      total_samples: mergedSamples.length,
      sources: ['D1', 'R2'],
      storage_tiers: {
        hot: {
          start: new Date(strategy.d1_range.start).toISOString(),
          end: new Date(strategy.d1_range.end).toISOString(),
          sample_count: d1Samples.length
        },
        cold: {
          start: new Date(strategy.r2_range.start).toISOString(),
          end: new Date(strategy.r2_range.end).toISOString(),
          file_count: calculateFileCount(strategy.r2_range.start, strategy.r2_range.end)
        }
      },
      query_time_ms: 0,
      cache_hit: false
    }
  };
}

// ============================================================================
// D1 Query Implementation
// ============================================================================

/**
 * Query timeseries data from D1 hot storage
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} siteName - Site identifier
 * @param {Array<string>} pointNames - Point names to query
 * @param {number} startTime - Start timestamp (milliseconds)
 * @param {number} endTime - End timestamp (milliseconds)
 * @returns {Promise<Array>} Array of samples
 */
async function queryD1(db, siteName, pointNames, startTime, endTime) {
  console.log(`[D1] Querying ${pointNames.length} points from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

  try {
    // Convert milliseconds to seconds for D1 storage
    const startTimeSec = Math.floor(startTime / 1000);
    const endTimeSec = Math.ceil(endTime / 1000);

    // Build parameterized query with placeholders
    const placeholders = pointNames.map(() => '?').join(',');

    const query = `
      SELECT
        point_name,
        timestamp,
        value
      FROM timeseries_raw
      WHERE site_name = ?
        AND point_name IN (${placeholders})
        AND timestamp BETWEEN ? AND ?
      ORDER BY point_name, timestamp ASC
    `;

    // Bind parameters: siteName, ...pointNames, startTimeSec, endTimeSec
    const stmt = db.prepare(query).bind(
      siteName,
      ...pointNames,
      startTimeSec,
      endTimeSec
    );

    const result = await stmt.all();

    console.log(`[D1] Query returned ${result.results?.length || 0} samples`);

    // Transform to standard format (convert seconds back to milliseconds)
    return (result.results || []).map(row => ({
      point_name: row.point_name,
      timestamp: row.timestamp * 1000, // Convert to milliseconds
      value: row.value
    }));

  } catch (error) {
    console.error('[D1] Query failed:', error);
    throw new QueryError('D1 query failed: ' + error.message, CONFIG.ERROR_CODES.D1_UNAVAILABLE);
  }
}

// ============================================================================
// Result Merging & Deduplication
// ============================================================================

/**
 * Merge samples from D1 and R2, deduplicate by timestamp
 * Priority: D1 data overrides R2 data at boundary (D1 is more authoritative)
 *
 * @param {Array} d1Samples - Samples from D1
 * @param {Array} r2Samples - Samples from R2
 * @returns {Array} Merged and sorted samples
 */
function mergeSamples(d1Samples, r2Samples) {
  // Create a map for deduplication: key = "point_name:timestamp"
  const sampleMap = new Map();

  // Add R2 samples first (lower priority)
  for (const sample of r2Samples) {
    const key = `${sample.point_name}:${sample.timestamp}`;
    sampleMap.set(key, sample);
  }

  // Add D1 samples (higher priority - overwrites R2 if duplicate)
  for (const sample of d1Samples) {
    const key = `${sample.point_name}:${sample.timestamp}`;
    sampleMap.set(key, sample);
  }

  // Convert back to array and sort by point_name, then timestamp
  const merged = Array.from(sampleMap.values());

  merged.sort((a, b) => {
    if (a.point_name !== b.point_name) {
      return a.point_name.localeCompare(b.point_name);
    }
    return a.timestamp - b.timestamp;
  });

  return merged;
}

// ============================================================================
// Caching Functions
// ============================================================================

/**
 * Generate cache key from query parameters
 */
function generateCacheKey(queryParams) {
  const parts = [
    queryParams.site_name,
    queryParams.point_names.sort().join(','),
    queryParams.start_time,
    queryParams.end_time,
    queryParams.interval
  ];

  // Simple hash function (for production, consider using crypto.subtle.digest)
  const str = parts.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  return `query:${Math.abs(hash)}`;
}

/**
 * Check cache for existing result
 */
async function checkCache(env, cacheKey) {
  try {
    const cached = await env.KV.get(cacheKey, { type: 'json' });
    return cached;
  } catch (error) {
    console.warn('[Cache] Failed to check cache:', error);
    return null;
  }
}

/**
 * Cache query result with TTL
 */
async function cacheResult(env, cacheKey, result, ttl) {
  try {
    await env.KV.put(cacheKey, JSON.stringify(result), {
      expirationTtl: ttl
    });
    console.log(`[Cache] Cached result with TTL ${ttl}s: ${cacheKey}`);
  } catch (error) {
    console.warn('[Cache] Failed to cache result:', error);
  }
}

/**
 * Calculate cache TTL based on data recency
 */
function calculateCacheTTL(queryParams) {
  const now = Date.now();
  const dataAge = now - queryParams.end_time;
  const ageHours = dataAge / (1000 * 60 * 60);

  if (ageHours < 1) {
    return CONFIG.CACHE_TTL_HOT; // 1 minute
  } else if (ageHours < 24 * 7) {
    return CONFIG.CACHE_TTL_WARM; // 5 minutes
  } else if (ageHours < 24 * 30) {
    return CONFIG.CACHE_TTL_COLD; // 1 hour
  } else {
    return CONFIG.CACHE_TTL_HISTORICAL; // 24 hours
  }
}

// ============================================================================
// Response Formatting
// ============================================================================

/**
 * Create successful response
 */
function createResponse(result, cacheHit, queryTime, corsHeaders) {
  result.metadata.query_time_ms = queryTime;
  result.metadata.cache_hit = cacheHit;

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Query-Time-Ms': queryTime.toString(),
      'X-Cache-Hit': cacheHit.toString()
    }
  });
}

/**
 * Create error response
 */
function createErrorResponse(error, queryTime, corsHeaders) {
  let status = 500;
  let errorCode = CONFIG.ERROR_CODES.INTERNAL_ERROR;
  let message = error.message;

  if (error instanceof ValidationError) {
    status = 400;
    errorCode = CONFIG.ERROR_CODES.INVALID_REQUEST;
  } else if (error instanceof QueryError) {
    status = 503;
    errorCode = error.code;
  }

  const errorResponse = {
    error: message,
    error_code: errorCode,
    query_time_ms: queryTime
  };

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique query ID for logging
 */
function generateQueryId() {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Calculate number of daily Parquet files in date range
 */
function calculateFileCount(startTime, endTime) {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// ============================================================================
// Custom Error Classes
// ============================================================================

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

class QueryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'QueryError';
    this.code = code;
  }
}
