/**
 * Consolidated ACE IoT API Proxy Worker
 * Version: 1.0.0
 *
 * This worker handles ALL ACE IoT API requests with:
 * - Proper CORS for all requests
 * - Proxying /configured_points with per_page=10000
 * - Filtering /timeseries/paginated by point_names
 * - Correct authentication header transformation (X-ACE-Token → lowercase 'authorization')
 * - KV caching for cleaned points (serve from KV if available, fallback to proxy)
 * - Comprehensive logging for debugging
 *
 * Authentication Requirements:
 * - Frontend sends: X-ACE-Token header
 * - Worker transforms to: lowercase 'authorization: Bearer {token}'
 * - ACE API is case-sensitive and REQUIRES lowercase 'authorization'
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const ACE_API_BASE_URL = 'https://flightdeck.aceiot.cloud/api';
const KV_CACHE_TTL_POINTS = 3600; // 1 hour for points
const KV_CACHE_TTL_TIMESERIES = 300; // 5 minutes for timeseries
const MAX_PAGE_SIZE = 10000; // Maximum per_page for configured_points

// ============================================================================
// MAIN WORKER EXPORT
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers (REQUIRED for all responses)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, X-ACE-Token, Authorization',
      'Access-Control-Expose-Headers': 'X-Cache-Status, X-Processing-Time, X-Point-Count',
    };

    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const startTime = Date.now();
    let cacheStatus = 'MISS';

    try {
      // Extract and validate authentication token
      const token = request.headers.get('X-ACE-Token') || request.headers.get('Authorization');
      if (!token) {
        return createErrorResponse('Missing authentication token', 401, corsHeaders);
      }

      // Clean token (remove 'Bearer ' prefix if present)
      const cleanToken = token.replace(/^Bearer\s+/i, '').trim();

      // Log request for debugging
      console.log('[REQUEST]', {
        method: request.method,
        path,
        hasToken: !!cleanToken,
        timestamp: new Date().toISOString()
      });

      // Route to appropriate handler
      let response;

      if (path === '/api/sites') {
        // Sites endpoint - simple passthrough
        response = await handleSites(env, cleanToken, corsHeaders);
      }
      else if (path.match(/^\/api\/sites\/[^\/]+\/configured_points$/)) {
        // Configured points endpoint - enhanced with per_page and KV caching
        const siteName = path.split('/')[3];
        response = await handleConfiguredPoints(env, siteName, cleanToken, url, corsHeaders);
        cacheStatus = response.headers.get('X-Cache-Status') || 'MISS';
      }
      else if (path.match(/^\/api\/sites\/[^\/]+\/timeseries\/paginated$/)) {
        // Paginated timeseries endpoint - with point_names filtering
        const siteName = path.split('/')[3];
        response = await handlePaginatedTimeseries(env, siteName, cleanToken, url, corsHeaders);
        cacheStatus = response.headers.get('X-Cache-Status') || 'MISS';
      }
      else if (path === '/api/health') {
        // Health check endpoint
        response = await handleHealthCheck(env, corsHeaders);
      }
      else if (path.match(/^\/api\/sites\/[^\/]+\/configured_points\/hybrid$/)) {
        // Hybrid enhancement endpoint - ALPHA: Uses AI-enhanced point data
        const siteName = path.split('/')[3];
        response = await handleHybridEnhancement(env, siteName, cleanToken, url, corsHeaders, ctx);
        cacheStatus = response.headers.get('X-Cache-Status') || 'MISS';
      }
      else if (path.match(/^\/api\/enhancement\/batch$/)) {
        // Batch enhancement endpoint
        response = await handleBatchEnhancement(env, request, corsHeaders, ctx);
      }
      else if (path.match(/^\/api\/enhancement\/metrics$/)) {
        // Enhancement metrics endpoint
        response = await handleEnhancementMetrics(env, corsHeaders);
      }
      else if (path.match(/^\/api\/enhancement\/quota$/)) {
        // Quota status endpoint
        response = await handleQuotaStatus(env, corsHeaders);
      }
      else {
        // Generic passthrough for other ACE API endpoints
        response = await handlePassthrough(env, path, cleanToken, url, request, corsHeaders);
      }

      // Add processing time header
      const processingTime = Date.now() - startTime;
      const headers = new Headers(response.headers);
      headers.set('X-Processing-Time', `${processingTime}ms`);
      headers.set('X-Cache-Status', cacheStatus);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });

    } catch (error) {
      console.error('[ERROR]', {
        message: error.message,
        stack: error.stack,
        path,
        timestamp: new Date().toISOString()
      });

      return createErrorResponse(
        `Worker error: ${error.message}`,
        500,
        corsHeaders
      );
    }
  }
};

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

/**
 * Handle /api/sites endpoint
 * Simple passthrough to ACE API
 */
async function handleSites(env, token, corsHeaders) {
  console.log('[SITES] Fetching sites list');

  const response = await fetch(`${ACE_API_BASE_URL}/sites`, {
    headers: {
      'authorization': `Bearer ${token}`, // CRITICAL: lowercase 'authorization'
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    console.error('[SITES] API error:', response.status, response.statusText);
    const errorText = await response.text();
    return createErrorResponse(errorText, response.status, corsHeaders);
  }

  const data = await response.json();

  console.log('[SITES] Success:', {
    itemCount: data.items?.length || 0
  });

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Cache-Status': 'BYPASS' // Sites are not cached
    }
  });
}

/**
 * Handle /api/sites/{siteName}/configured_points endpoint
 * - Checks KV cache first
 * - If cache miss, fetches from ACE API with per_page=10000
 * - Stores cleaned/enhanced points in KV
 * - Returns enhanced points
 */
async function handleConfiguredPoints(env, siteName, token, url, corsHeaders) {
  console.log('[POINTS] Fetching configured points for:', siteName);

  // Check for cache bypass parameter
  const bypassCache = url.searchParams.get('bypass_cache') === 'true';
  const cacheKey = `site:${siteName}:configured_points`;

  // STEP 1: Check KV cache (unless bypassed)
  if (!bypassCache && env.POINTS_KV) {
    try {
      const cachedData = await env.POINTS_KV.get(cacheKey, { type: 'json' });

      if (cachedData && cachedData.points && cachedData.timestamp) {
        // Check if cache is still valid (1 hour)
        const cacheAge = Date.now() - cachedData.timestamp;
        if (cacheAge < KV_CACHE_TTL_POINTS * 1000) {
          console.log('[POINTS] Cache HIT:', {
            siteName,
            pointCount: cachedData.points.length,
            cacheAge: Math.floor(cacheAge / 1000) + 's'
          });

          return new Response(JSON.stringify({
            items: cachedData.points,
            total: cachedData.points.length,
            fromCache: true,
            cacheAge: Math.floor(cacheAge / 1000)
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'X-Cache-Status': 'HIT',
              'X-Point-Count': String(cachedData.points.length)
            }
          });
        } else {
          console.log('[POINTS] Cache EXPIRED:', {
            siteName,
            cacheAge: Math.floor(cacheAge / 1000) + 's'
          });
        }
      }
    } catch (cacheError) {
      console.error('[POINTS] Cache read error:', cacheError.message);
      // Continue to fetch from API
    }
  }

  // STEP 2: Fetch from ACE API with pagination support
  console.log('[POINTS] Cache MISS - fetching from ACE API');

  let allPoints = [];
  let currentPage = 1;
  let totalPages = 1;

  while (currentPage <= totalPages) {
    const apiUrl = `${ACE_API_BASE_URL}/sites/${siteName}/configured_points?per_page=${MAX_PAGE_SIZE}&page=${currentPage}`;

    console.log('[POINTS] Fetching page:', {
      page: currentPage,
      totalPages,
      perPage: MAX_PAGE_SIZE
    });

    const response = await fetch(apiUrl, {
      headers: {
        'authorization': `Bearer ${token}`, // CRITICAL: lowercase 'authorization'
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[POINTS] API error:', {
        status: response.status,
        statusText: response.statusText,
        siteName,
        page: currentPage
      });
      const errorText = await response.text();
      return createErrorResponse(errorText, response.status, corsHeaders);
    }

    const data = await response.json();
    const pageItems = data.items || data.data || [];

    allPoints = allPoints.concat(pageItems);

    // Update pagination info from first page
    if (currentPage === 1) {
      totalPages = data.pages || 1;
      console.log('[POINTS] Total pages:', totalPages);
    }

    currentPage++;

    // Safety limit: prevent infinite loops
    if (currentPage > 100) {
      console.warn('[POINTS] Safety limit reached: 100 pages');
      break;
    }
  }

  console.log('[POINTS] Fetched all points:', {
    siteName,
    totalPoints: allPoints.length,
    pages: currentPage - 1
  });

  // STEP 3: Clean and enhance points
  const cleanedPoints = allPoints.map(point => cleanPoint(point));

  // STEP 4: Store in KV cache
  if (env.POINTS_KV) {
    try {
      await env.POINTS_KV.put(cacheKey, JSON.stringify({
        points: cleanedPoints,
        timestamp: Date.now(),
        siteName,
        source: 'ace-api',
        version: '1.0.0'
      }), {
        expirationTtl: KV_CACHE_TTL_POINTS
      });

      console.log('[POINTS] Stored in KV cache:', {
        cacheKey,
        pointCount: cleanedPoints.length,
        ttl: KV_CACHE_TTL_POINTS
      });
    } catch (storeError) {
      console.error('[POINTS] Cache store error:', storeError.message);
      // Continue even if cache storage fails
    }
  }

  // STEP 5: Return enhanced points
  return new Response(JSON.stringify({
    items: cleanedPoints,
    total: cleanedPoints.length,
    fromCache: false
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Cache-Status': 'MISS',
      'X-Point-Count': String(cleanedPoints.length)
    }
  });
}

/**
 * Handle /api/sites/{siteName}/timeseries/paginated endpoint
 * - Filters by point_names if provided
 * - Caches responses in KV with intelligent TTL
 * - Passes through all other parameters
 */
async function handlePaginatedTimeseries(env, siteName, token, url, corsHeaders) {
  // Extract query parameters
  const startTime = url.searchParams.get('start_time');
  const endTime = url.searchParams.get('end_time');
  const pointNames = url.searchParams.get('point_names'); // Comma-separated list
  const rawData = url.searchParams.get('raw_data') || 'true';
  const pageSize = url.searchParams.get('page_size') || '1000';
  const cursor = url.searchParams.get('cursor');
  const bypassCache = url.searchParams.get('bypass_cache') === 'true';

  console.log('[TIMESERIES] Request:', {
    siteName,
    startTime,
    endTime,
    pointNames: pointNames ? pointNames.substring(0, 100) + '...' : 'all',
    rawData,
    pageSize,
    hasCursor: !!cursor,
    bypassCache
  });

  // Validate required parameters
  if (!startTime || !endTime) {
    return createErrorResponse('Missing required parameters: start_time and end_time', 400, corsHeaders);
  }

  // Generate cache key based on request parameters
  const cacheKey = `timeseries:${siteName}:${startTime}:${endTime}:${pointNames || 'all'}:${cursor || 'first'}:${rawData}:${pageSize}`;

  // Check KV cache (unless bypassed)
  if (!bypassCache && env.POINTS_KV) {
    try {
      const cachedData = await env.POINTS_KV.get(cacheKey, { type: 'json' });

      if (cachedData) {
        console.log('[TIMESERIES] Cache HIT:', {
          siteName,
          cacheKey: cacheKey.substring(0, 80) + '...',
          dataPoints: cachedData.point_samples?.length || 0
        });

        return new Response(JSON.stringify(cachedData), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Cache-Status': 'HIT'
          }
        });
      }
    } catch (cacheError) {
      console.error('[TIMESERIES] Cache read error:', cacheError.message);
    }
  }

  // Build ACE API URL
  const aceApiUrl = new URL(`${ACE_API_BASE_URL}/sites/${siteName}/timeseries/paginated`);
  aceApiUrl.searchParams.set('start_time', startTime);
  aceApiUrl.searchParams.set('end_time', endTime);
  aceApiUrl.searchParams.set('raw_data', rawData);
  aceApiUrl.searchParams.set('page_size', pageSize);

  // Add point_names filter if provided
  if (pointNames) {
    aceApiUrl.searchParams.set('point_names', pointNames);
  }

  if (cursor) {
    aceApiUrl.searchParams.set('cursor', cursor);
  }

  console.log('[TIMESERIES] Fetching from ACE API:', {
    url: aceApiUrl.toString().substring(0, 150) + '...'
  });

  // Fetch from ACE API
  const response = await fetch(aceApiUrl.toString(), {
    headers: {
      'authorization': `Bearer ${token}`, // CRITICAL: lowercase 'authorization'
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    console.error('[TIMESERIES] API error:', {
      status: response.status,
      statusText: response.statusText,
      siteName
    });
    const errorText = await response.text();
    return createErrorResponse(errorText, response.status, corsHeaders);
  }

  const data = await response.json();

  console.log('[TIMESERIES] Success:', {
    siteName,
    samplesCount: data.point_samples?.length || 0,
    hasMore: data.has_more || false,
    hasCursor: !!data.next_cursor
  });

  // Calculate intelligent TTL based on data recency
  let ttl = KV_CACHE_TTL_TIMESERIES; // Default 5 minutes
  let ttlReason = 'default';

  try {
    const endDate = new Date(endTime);
    const now = new Date();
    const isRecent = (now - endDate) < 24 * 60 * 60 * 1000; // Last 24 hours
    const isComplete = !data.has_more;

    if (isComplete && !isRecent) {
      ttl = 86400; // 1 day for complete historical data
      ttlReason = 'complete_historical';
    } else if (isRecent) {
      ttl = 120; // 2 minutes for recent data
      ttlReason = 'recent';
    } else {
      ttl = 3600; // 1 hour for partial historical data
      ttlReason = 'partial_historical';
    }
  } catch (dateError) {
    console.error('[TIMESERIES] TTL calculation error:', dateError.message);
  }

  // Store in KV cache
  if (!bypassCache && env.POINTS_KV) {
    try {
      await env.POINTS_KV.put(cacheKey, JSON.stringify(data), {
        expirationTtl: ttl
      });

      console.log('[TIMESERIES] Stored in KV cache:', {
        cacheKey: cacheKey.substring(0, 80) + '...',
        ttl,
        ttlReason,
        dataPoints: data.point_samples?.length || 0
      });
    } catch (storeError) {
      console.error('[TIMESERIES] Cache store error:', storeError.message);
    }
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Cache-Status': 'MISS',
      'X-Cache-TTL': String(ttl),
      'X-Cache-Reason': ttlReason
    }
  });
}

/**
 * Handle /api/health endpoint
 * Tests all worker bindings and returns status
 */
async function handleHealthCheck(env, corsHeaders) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {}
  };

  // Test KV binding
  try {
    if (env.POINTS_KV) {
      await env.POINTS_KV.get('health_check_test');
      health.services.kv = 'connected';
    } else {
      health.services.kv = 'not_configured';
    }
  } catch (error) {
    health.services.kv = 'error: ' + error.message;
    health.status = 'degraded';
  }

  // Test ACE API connectivity
  try {
    const testResponse = await fetch(`${ACE_API_BASE_URL}/sites`, {
      method: 'HEAD',
      headers: {
        'authorization': 'Bearer test'
      }
    });
    // We expect 401 (unauthorized) which means API is reachable
    health.services.ace_api = testResponse.status === 401 ? 'reachable' : 'unexpected_status';
  } catch (error) {
    health.services.ace_api = 'unreachable: ' + error.message;
    health.status = 'degraded';
  }

  return new Response(JSON.stringify(health, null, 2), {
    status: health.status === 'healthy' ? 200 : 503,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

/**
 * Handle generic passthrough for other ACE API endpoints
 */
async function handlePassthrough(env, path, token, url, request, corsHeaders) {
  console.log('[PASSTHROUGH]', {
    path,
    method: request.method
  });

  // Build ACE API URL
  const aceApiUrl = new URL(`${ACE_API_BASE_URL}${path.replace(/^\/api/, '')}`);

  // Copy all query parameters
  for (const [key, value] of url.searchParams) {
    aceApiUrl.searchParams.set(key, value);
  }

  const response = await fetch(aceApiUrl.toString(), {
    method: request.method,
    headers: {
      'authorization': `Bearer ${token}`, // CRITICAL: lowercase 'authorization'
      'Accept': 'application/json',
      'Content-Type': request.headers.get('Content-Type') || 'application/json'
    },
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    return createErrorResponse(errorText, response.status, corsHeaders);
  }

  const data = await response.text();

  return new Response(data, {
    status: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
      'X-Cache-Status': 'BYPASS'
    }
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clean and enhance a single point
 * Adds display_name, extracts metadata, standardizes structure
 */
function cleanPoint(point) {
  const name = point.Name || point.name || '';

  // Extract basic info
  const cleaned = {
    name,  // Keep original name for API calls
    display_name: point['Kv Tags']?.[0]?.dis || name,
    collect_enabled: point['Collect Enabled'] !== false,
    unit: point['Kv Tags']?.[0]?.unit || null,
    marker_tags: extractMarkerTags(point),
    kv_tags: point['Kv Tags'] || [],
    original_name: name,
    _cleaned: true,
    _cleanedAt: new Date().toISOString()
  };

  // Add any additional fields from original point
  Object.keys(point).forEach(key => {
    if (!cleaned[key] && !key.includes(' ')) {
      cleaned[key] = point[key];
    }
  });

  return cleaned;
}

/**
 * Extract marker tags from point data
 */
function extractMarkerTags(point) {
  const tags = ['point', 'sensor'];

  const name = (point.Name || point.name || '').toLowerCase();

  // Equipment types
  if (name.includes('ahu')) tags.push('ahu', 'equip', 'hvac');
  if (name.includes('vav')) tags.push('vav', 'equip', 'hvac');
  if (name.includes('chiller')) tags.push('chiller', 'equip', 'plant');
  if (name.includes('boiler')) tags.push('boiler', 'equip', 'plant');
  if (name.includes('pump')) tags.push('pump', 'equip');
  if (name.includes('fan')) tags.push('fan', 'equip');

  // Point types
  if (name.includes('temp')) tags.push('temp');
  if (name.includes('pressure')) tags.push('pressure');
  if (name.includes('flow')) tags.push('flow');
  if (name.includes('damper')) tags.push('damper');
  if (name.includes('valve')) tags.push('valve');
  if (name.includes('speed')) tags.push('speed');
  if (name.includes('status') || name.includes('sts')) tags.push('status');
  if (name.includes('power') || name.includes('kw')) tags.push('power', 'elec');
  if (name.includes('energy') || name.includes('kwh')) tags.push('energy', 'elec');

  // Air streams
  if (name.includes('oa')) tags.push('air', 'outside');
  if (name.includes('ra')) tags.push('air', 'return');
  if (name.includes('sa') || name.includes('da')) tags.push('air', 'supply');
  if (name.includes('ea')) tags.push('air', 'exhaust');
  if (name.includes('ma')) tags.push('air', 'mixed');

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Create standardized error response
 */
function createErrorResponse(message, status, corsHeaders) {
  return new Response(JSON.stringify({
    error: true,
    message,
    status,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// ============================================================================
// HYBRID ENHANCEMENT ENDPOINTS
// ============================================================================

/**
 * Handle hybrid point enhancement endpoint
 * Uses the new hybrid enhancement system
 */
async function handleHybridEnhancement(env, siteName, token, url, corsHeaders, ctx) {
  console.log('[HYBRID] Starting hybrid enhancement for:', siteName);

  try {
    // Import hybrid enhancer (dynamic import for Cloudflare Workers)
    const { enhancePointsBatch } = await import('./utils/hybrid-point-enhancer.js');

    // First, get raw points from ACE API
    const apiUrl = `${ACE_API_BASE_URL}/sites/${siteName}/configured_points?per_page=${MAX_PAGE_SIZE}`;
    const response = await fetch(apiUrl, {
      headers: {
        'authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`ACE API error: ${response.status}`);
    }

    const data = await response.json();
    const rawPoints = data.items || data.data || [];

    console.log('[HYBRID] Fetched raw points:', rawPoints.length);

    // Enhance points using hybrid system
    const result = await enhancePointsBatch(rawPoints, env, {
      batchSize: 100,
      maxConcurrency: 10,
      jobId: `site-${siteName}-${Date.now()}`
    });

    return new Response(JSON.stringify({
      items: result.results,
      total: result.totalPoints,
      metrics: {
        duration: result.duration,
        durationMinutes: result.durationMinutes,
        averageTimePerPoint: result.averageTimePerPoint,
        pointsPerSecond: result.pointsPerSecond
      },
      quotaStatus: result.quotaStatus,
      fromHybrid: true
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache-Status': 'HYBRID',
        'X-Point-Count': String(result.totalPoints),
        'X-Processing-Time': `${result.duration}ms`
      }
    });
  } catch (error) {
    console.error('[HYBRID] Error:', error);
    return createErrorResponse(`Hybrid enhancement failed: ${error.message}`, 500, corsHeaders);
  }
}

/**
 * Handle batch enhancement endpoint
 */
async function handleBatchEnhancement(env, request, corsHeaders, ctx) {
  try {
    const { enhancePointsBatch } = await import('./utils/hybrid-point-enhancer.js');

    // Parse request body
    const body = await request.json();
    const { points, options = {} } = body;

    if (!points || !Array.isArray(points)) {
      return createErrorResponse('Invalid request: points array required', 400, corsHeaders);
    }

    // Enhance points
    const result = await enhancePointsBatch(points, env, {
      ...options,
      jobId: options.jobId || `batch-${Date.now()}`
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[BATCH] Error:', error);
    return createErrorResponse(`Batch enhancement failed: ${error.message}`, 500, corsHeaders);
  }
}

/**
 * Handle enhancement metrics endpoint
 */
async function handleEnhancementMetrics(env, corsHeaders) {
  try {
    const { getMetricsDashboard } = await import('./utils/metrics-collector.js');

    const dashboard = await getMetricsDashboard(env);

    return new Response(JSON.stringify(dashboard), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('[METRICS] Error:', error);
    return createErrorResponse(`Metrics retrieval failed: ${error.message}`, 500, corsHeaders);
  }
}

/**
 * Handle quota status endpoint
 */
async function handleQuotaStatus(env, corsHeaders) {
  try {
    const { getQuotaStatus } = await import('./utils/quota-manager.js');

    const status = await getQuotaStatus(env);

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('[QUOTA] Error:', error);
    return createErrorResponse(`Quota status retrieval failed: ${error.message}`, 500, corsHeaders);
  }
}
