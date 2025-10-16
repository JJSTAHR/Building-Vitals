/**
 * Consolidated ACE IoT API Proxy Worker v3.0
 * Now with intelligent D1/R2 query routing
 *
 * This worker handles ALL ACE IoT API requests with:
 * - Proper CORS for all requests
 * - Proxying /configured_points with per_page=10000
 * - Enhanced point name cleaning showing equipment AND point type
 * - INTELLIGENT QUERY ROUTING: D1 (hot <30d) or R2 (cold >30d) or BOTH
 * - Filtering /timeseries/paginated by point_names
 * - Correct authentication header transformation
 * - KV caching for enhanced points
 * - <500ms response for D1 queries, <5s for R2 queries
 */

import { routeQuery, queryD1, queryR2, mergeResults, generateCacheKey, getCacheTTL } from './lib/query-router.js';

const ACE_API_BASE_URL = 'https://flightdeck.aceiot.cloud/api';
const KV_CACHE_TTL_POINTS = 3600; // 1 hour
const KV_CACHE_TTL_TIMESERIES = 300; // 5 minutes
const MAX_PAGE_SIZE = 10000;

// ============================================================================
// EQUIPMENT PATTERNS
// ============================================================================

const EQUIPMENT_PATTERNS = [
  {
    regex: /\b(Vav|VAV)[-_\s]?(\d+)(?:[-_\s]?(\d+))?/i,
    type: 'vav',
    format: (m) => ({ type: 'vav', id: m[2], subId: m[3], display: `VAV ${m[2]}${m[3] ? `-${m[3]}` : ''}` })
  },
  {
    regex: /\b(Rtu|RTU)[-_\s]?(\d+)/i,
    type: 'rtu',
    format: (m) => ({ type: 'rtu', id: m[2], display: `RTU ${m[2]}` })
  },
  {
    regex: /\b(Ahu|AHU)[-_\s]?(\d+)?/i,
    type: 'ahu',
    format: (m) => ({ type: 'ahu', id: m[2] || '1', display: `AHU ${m[2] || '1'}` })
  },
  {
    regex: /\b(Chiller|CH)[-_\s]?(\d+)?/i,
    type: 'chiller',
    format: (m) => ({ type: 'chiller', id: m[2] || '1', display: `Chiller ${m[2] || '1'}` })
  },
  {
    regex: /\b(Boiler|BLR)[-_\s]?(\d+)?/i,
    type: 'boiler',
    format: (m) => ({ type: 'boiler', id: m[2] || '1', display: `Boiler ${m[2] || '1'}` })
  },
  {
    regex: /\b(Pump|CHWP|HWP|CWP)[-_\s]?(\d+)/i,
    type: 'pump',
    format: (m) => ({ type: 'pump', id: m[2], display: `Pump ${m[2]}` })
  },
  {
    regex: /\b(FCU|Fcu)[-_\s]?(\d+)/i,
    type: 'fcu',
    format: (m) => ({ type: 'fcu', id: m[2], display: `FCU ${m[2]}` })
  }
];

// ============================================================================
// POINT TYPE PATTERNS
// ============================================================================

const POINT_TYPES = {
  temperature: { patterns: [/Temp(?!Sp)/i, /_?Temp$/i], unit: '°F' },
  tempSetpoint: { patterns: [/TempSp/i, /Setpt/i, /(Clg|Htg)Sp/i], unit: '°F' },
  damper: { patterns: [/_?Damper/i, /Dmp/i], unit: '%' },
  valve: { patterns: [/Valve/i, /Vlv/i], unit: '%' },
  fanStatus: { patterns: [/Fan.*Status/i, /FanSts/i, /FanEnable/i], unit: 'on/off' },
  fanSpeed: { patterns: [/Fan.*Speed/i, /FanSpd/i, /FanPct/i], unit: '%' },
  flow: { patterns: [/Flow/i, /Cfm/i, /Gpm/i], unit: 'CFM' },
  pressure: { patterns: [/Press/i, /\bDp\b/i], unit: 'in.w.c.' },
  humidity: { patterns: [/Humid/i, /RH\b/i], unit: '%RH' },
  co2: { patterns: [/CO2/i], unit: 'ppm' },
  power: { patterns: [/\bKw\b/i, /Power/i], unit: 'kW' },
  capacity: { patterns: [/Capacity/i], unit: '%' },
  status: { patterns: [/Sts\b/i, /Status/i, /Enable/i, /OnOff/i], unit: 'on/off' }
};

// ============================================================================
// MAIN WORKER EXPORT
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, X-ACE-Token, Authorization',
      'Access-Control-Expose-Headers': 'X-Cache-Status, X-Processing-Time, X-Point-Count',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
      const token = request.headers.get('X-ACE-Token') || request.headers.get('Authorization');
      if (!token) {
        return createErrorResponse('Missing authentication token', 401, corsHeaders);
      }

      const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
      let response;

      if (path === '/api/sites') {
        response = await handleSites(env, cleanToken, corsHeaders);
      }
      else if (path.match(/^\/api\/sites\/[^\/]+\/configured_points$/)) {
        const siteName = path.split('/')[3];
        response = await handleConfiguredPoints(env, siteName, cleanToken, url, corsHeaders);
      }
      else if (path.match(/^\/api\/sites\/[^\/]+\/timeseries\/paginated$/)) {
        const siteName = path.split('/')[3];
        response = await handlePaginatedTimeseries(env, siteName, cleanToken, url, corsHeaders);
      }
      else if (path === '/api/health') {
        response = await handleHealthCheck(env, corsHeaders);
      }
      else {
        response = await handlePassthrough(env, path, cleanToken, url, request, corsHeaders);
      }

      const processingTime = Date.now() - startTime;
      const headers = new Headers(response.headers);
      headers.set('X-Processing-Time', `${processingTime}ms`);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });

    } catch (error) {
      console.error('[ERROR]', error);
      return createErrorResponse(`Worker error: ${error.message}`, 500, corsHeaders);
    }
  }
};

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

async function handleSites(env, token, corsHeaders) {
  const response = await fetch(`${ACE_API_BASE_URL}/sites`, {
    headers: {
      'authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    return createErrorResponse(errorText, response.status, corsHeaders);
  }

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache-Status': 'BYPASS' }
  });
}

async function handleConfiguredPoints(env, siteName, token, url, corsHeaders) {
  console.log('[POINTS] Fetching for:', siteName);

  const bypassCache = url.searchParams.get('bypass_cache') === 'true';
  const cacheKey = `site:${siteName}:configured_points:v2`;

  // Check cache
  if (!bypassCache && env.POINTS_KV) {
    const cached = await env.POINTS_KV.get(cacheKey, { type: 'json' });
    if (cached && cached.timestamp && (Date.now() - cached.timestamp < KV_CACHE_TTL_POINTS * 1000)) {
      console.log('[POINTS] Cache HIT:', cached.points.length, 'points');
      return new Response(JSON.stringify({
        items: cached.points,
        total: cached.points.length,
        fromCache: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache-Status': 'HIT' }
      });
    }
  }

  // Fetch from API
  const apiUrl = `${ACE_API_BASE_URL}/sites/${siteName}/configured_points?per_page=${MAX_PAGE_SIZE}`;
  const response = await fetch(apiUrl, {
    headers: {
      'authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    return createErrorResponse(errorText, response.status, corsHeaders);
  }

  const data = await response.json();
  const rawPoints = data.items || data.data || [];

  console.log('[POINTS] Fetched', rawPoints.length, 'raw points');

  // Enhance points with rule-based cleaner
  const enhancedPoints = rawPoints.map(point => enhancePoint(point));

  console.log('[POINTS] Enhanced', enhancedPoints.length, 'points');

  // Cache enhanced points
  if (env.POINTS_KV) {
    await env.POINTS_KV.put(cacheKey, JSON.stringify({
      points: enhancedPoints,
      timestamp: Date.now(),
      siteName,
      version: '2.0'
    }), {
      expirationTtl: KV_CACHE_TTL_POINTS
    });
  }

  return new Response(JSON.stringify({
    items: enhancedPoints,
    total: enhancedPoints.length,
    fromCache: false
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache-Status': 'MISS' }
  });
}

async function handlePaginatedTimeseries(env, siteName, token, url, corsHeaders) {
  const queryStart = Date.now();
  const startTime = url.searchParams.get('start_time');
  const endTime = url.searchParams.get('end_time');
  const pointNames = url.searchParams.get('point_names'); // Frontend's filter request
  const rawData = url.searchParams.get('raw_data') || 'true';
  const pageSize = url.searchParams.get('page_size') || '1000';
  const cursor = url.searchParams.get('cursor');
  const useOptimizedRouting = url.searchParams.get('use_routing') !== 'false'; // Default: enabled

  if (!startTime || !endTime) {
    return createErrorResponse('Missing required parameters: start_time and end_time', 400, corsHeaders);
  }

  const pointNamesArray = pointNames ? pointNames.split(',').map(p => p.trim()) : [];

  // ============================================================================
  // INTELLIGENT QUERY ROUTING
  // ============================================================================

  if (useOptimizedRouting && pointNamesArray.length > 0 && env.DB && env.R2) {
    try {
      // Step 1: Determine routing strategy
      const routing = routeQuery(pointNamesArray, startTime, endTime);

      console.log('[QUERY ROUTER]', {
        strategy: routing.strategy,
        points: pointNamesArray.length,
        timeRange: `${startTime} to ${endTime}`,
        estimatedTime: `${routing.estimatedResponseTime}ms`,
        rationale: routing.rationale
      });

      // Step 2: Check cache first
      const cacheKey = generateCacheKey(pointNamesArray, startTime, endTime);
      const cached = await env.POINTS_KV?.get(cacheKey, { type: 'json' });

      if (cached && cached.timestamp) {
        const cacheTTL = getCacheTTL(endTime) * 1000; // Convert to ms
        if (Date.now() - cached.timestamp < cacheTTL) {
          console.log('[CACHE HIT]', cacheKey, 'age:', Math.round((Date.now() - cached.timestamp) / 1000), 's');

          const responseHeaders = {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Cache-Status': 'HIT',
            'X-Data-Source': cached.dataSource || 'CACHE',
            'X-Processing-Time': `${Date.now() - queryStart}ms`,
            'X-Query-Strategy': routing.strategy
          };

          return new Response(JSON.stringify(cached.data), {
            status: 200,
            headers: responseHeaders
          });
        }
      }

      // Step 3: Execute routing strategy
      let d1Results = null;
      let r2Results = null;

      if (routing.useD1) {
        // Query D1 for hot storage (recent data)
        const d1Start = routing.splitPoint || startTime;
        const d1End = endTime;

        console.log('[D1 QUERY]', `Points: ${pointNamesArray.length}, Range: ${d1Start} to ${d1End}`);
        d1Results = await queryD1(env.DB, pointNamesArray, d1Start, d1End);
        console.log('[D1 RESULT]', `Rows: ${d1Results.metadata.rowCount}`);
      }

      if (routing.useR2) {
        // Query R2 for cold storage (historical data)
        const r2Start = startTime;
        const r2End = routing.splitPoint || endTime;

        console.log('[R2 QUERY]', `Points: ${pointNamesArray.length}, Range: ${r2Start} to ${r2End}`);
        r2Results = await queryR2(env.R2, pointNamesArray, r2Start, r2End);
        console.log('[R2 RESULT]', `Files: ${r2Results.metadata.fileCount}`);
      }

      // Step 4: Merge results if split query
      const finalResults = routing.strategy === 'SPLIT'
        ? mergeResults(d1Results, r2Results)
        : (d1Results || r2Results);

      // Step 5: Transform to ACE API format
      const aceFormatData = transformToAceFormat(finalResults, siteName);

      // Step 6: Cache the results
      if (env.POINTS_KV) {
        const cacheTTL = getCacheTTL(endTime);
        await env.POINTS_KV.put(cacheKey, JSON.stringify({
          data: aceFormatData,
          dataSource: finalResults.metadata.dataSource,
          timestamp: Date.now(),
          strategy: routing.strategy
        }), {
          expirationTtl: cacheTTL
        });

        console.log('[CACHE WRITE]', cacheKey, 'TTL:', cacheTTL, 's');
      }

      // Step 7: Return optimized results
      const processingTime = Date.now() - queryStart;
      const responseHeaders = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache-Status': 'MISS',
        'X-Data-Source': finalResults.metadata.dataSource,
        'X-Processing-Time': `${processingTime}ms`,
        'X-Query-Strategy': routing.strategy,
        'X-Total-Points': finalResults.metadata.totalPoints,
        'X-Series-Count': finalResults.metadata.seriesCount
      };

      console.log('[QUERY COMPLETE]', {
        strategy: routing.strategy,
        dataSource: finalResults.metadata.dataSource,
        processingTime: `${processingTime}ms`,
        totalPoints: finalResults.metadata.totalPoints
      });

      return new Response(JSON.stringify(aceFormatData), {
        status: 200,
        headers: responseHeaders
      });

    } catch (error) {
      console.error('[ROUTING ERROR]', error);
      console.log('[FALLBACK] Using legacy ACE API direct fetch');
      // Fall through to legacy implementation
    }
  }

  // ============================================================================
  // LEGACY IMPLEMENTATION (Fallback or if routing disabled)
  // ============================================================================

  console.log('[LEGACY MODE] Direct ACE API fetch');

  // Build ACE API URL WITHOUT point_names (ACE API doesn't support this parameter)
  const aceApiUrl = new URL(`${ACE_API_BASE_URL}/sites/${siteName}/timeseries/paginated`);
  aceApiUrl.searchParams.set('start_time', startTime);
  aceApiUrl.searchParams.set('end_time', endTime);
  aceApiUrl.searchParams.set('raw_data', rawData);
  aceApiUrl.searchParams.set('page_size', pageSize);
  if (cursor) aceApiUrl.searchParams.set('cursor', cursor);

  // Fetch from ACE API
  const response = await fetch(aceApiUrl.toString(), {
    headers: {
      'authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    return createErrorResponse(errorText, response.status, corsHeaders);
  }

  const data = await response.json();

  // Filter results by point_names if provided (worker-side filtering)
  if (pointNames) {
    const requestedPoints = pointNames.split(',').map(p => p.trim());
    const requestedSet = new Set(requestedPoints);

    if (data.point_samples && Array.isArray(data.point_samples)) {
      data.point_samples = data.point_samples.filter(sample =>
        requestedSet.has(sample.name)
      );
    }
  }

  const processingTime = Date.now() - queryStart;
  const responseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'X-Data-Source': 'ACE_API',
    'X-Processing-Time': `${processingTime}ms`,
    'X-Query-Strategy': 'LEGACY'
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: responseHeaders
  });
}

/**
 * Transform query router results to ACE API format
 */
function transformToAceFormat(results, siteName) {
  // ACE API format:
  // {
  //   "point_samples": [
  //     { "name": "VAV-707-DaTemp", "samples": [{ "value": 72.5, "time": "2025-10-12T..." }] }
  //   ]
  // }

  const pointSamples = results.series.map(series => ({
    name: series.name,
    samples: series.data.map(([timestamp, value]) => ({
      value,
      time: new Date(timestamp).toISOString()
    }))
  }));

  return {
    point_samples: pointSamples,
    metadata: {
      site_id: siteName,
      source: results.metadata.dataSource,
      total_samples: results.metadata.totalPoints
    }
  };
}

async function handleHealthCheck(env, corsHeaders) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0',
    features: {
      pointCleaner: 'rule-based',
      queryRouting: env.DB && env.R2 ? 'enabled' : 'disabled',
      intelligentCaching: 'enabled'
    },
    services: {
      kv: env.POINTS_KV ? 'connected' : 'not_configured',
      d1: env.DB ? 'connected' : 'not_configured',
      r2: env.R2 ? 'connected' : 'not_configured'
    },
    routing: {
      hotStorageDays: 30,
      d1ResponseTime: '<500ms',
      r2ResponseTime: '<5s',
      strategies: ['D1_ONLY', 'R2_ONLY', 'SPLIT']
    }
  };

  return new Response(JSON.stringify(health, null, 2), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handlePassthrough(env, path, token, url, request, corsHeaders) {
  const aceApiUrl = new URL(`${ACE_API_BASE_URL}${path.replace(/^\/api/, '')}`);
  for (const [key, value] of url.searchParams) {
    aceApiUrl.searchParams.set(key, value);
  }

  const response = await fetch(aceApiUrl.toString(), {
    method: request.method,
    headers: {
      'authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    },
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined
  });

  const data = await response.text();
  return new Response(data, {
    status: response.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// ENHANCED POINT CLEANING
// ============================================================================

function enhancePoint(rawPoint) {
  // Handle both uppercase Name (old) and lowercase name (current ACE API format)
  const pointName = rawPoint?.name || rawPoint?.Name;

  if (!rawPoint || !pointName) {
    return {
      ...rawPoint,
      display_name: 'Unknown Point',
      unit: null,
      confidence: 0,
      _enhanced: true
    };
  }

  const bacnetPath = pointName;
  const equipment = extractEquipment(bacnetPath);
  const pointInfo = extractPointType(bacnetPath);
  const displayName = formatDisplayName(equipment, pointInfo);
  const confidence = calculateConfidence(equipment, pointInfo, displayName);

  return {
    ...rawPoint,
    display_name: displayName,
    unit: pointInfo.unit,
    equipment: equipment?.type || null,
    equipmentId: equipment?.id || null,
    equipmentDisplay: equipment?.display || null,
    pointType: pointInfo.pointType,
    confidence,
    _enhanced: true,
    _enhancedVersion: '2.0'
  };
}

function extractEquipment(path) {
  if (!path) return null;

  for (const pattern of EQUIPMENT_PATTERNS) {
    const match = path.match(pattern.regex);
    if (match) {
      return pattern.format(match);
    }
  }

  return null;
}

function extractPointType(path) {
  if (!path) return { pointType: null, unit: null };

  // Extract point name from path
  const pointsMatch = path.match(/\.points\.([^.]+)$/i);
  const pointName = pointsMatch ? pointsMatch[1] : path.split(/[./]/).pop();

  // Detect point type
  for (const [typeName, config] of Object.entries(POINT_TYPES)) {
    for (const pattern of config.patterns) {
      if (pattern.test(pointName)) {
        return {
          pointType: typeName,
          pointName,
          unit: config.unit
        };
      }
    }
  }

  return { pointType: null, pointName, unit: null };
}

function formatDisplayName(equipment, point) {
  let name = '';

  // Add equipment prefix
  if (equipment?.display) {
    name = equipment.display;
  }

  // Add point description
  if (point.pointName) {
    let cleaned = point.pointName
      .replace(/_/g, ' ') // underscores to spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
      .replace(/([a-zA-Z])(\d)/g, '$1 $2') // add space before numbers
      .replace(/\b(Setpt|Sp)\b/gi, 'Setpoint') // expand abbreviations
      .replace(/\b(Sts)\b/gi, 'Status')
      .replace(/\b(Temp)\b/gi, 'Temperature')
      .replace(/\b(Press)\b/gi, 'Pressure')
      .replace(/\b(Bldg)\b/gi, 'Building')
      .replace(/\b(Sa)\b/gi, 'Supply Air')
      .replace(/\b(Ra)\b/gi, 'Return Air')
      .replace(/\b(Oa)\b/gi, 'Outside Air')
      .trim();

    // Capitalize first letter of each word
    cleaned = cleaned.replace(/\b\w/g, c => c.toUpperCase());

    if (name) {
      name += ' - ' + cleaned;
    } else {
      name = cleaned;
    }
  }

  return name || 'Unknown Point';
}

function calculateConfidence(equipment, point, displayName) {
  let score = 0;
  if (equipment) score += 40;
  if (equipment?.id) score += 10;
  if (point?.pointType) score += 30;
  if (point?.unit) score += 10;
  if (displayName && displayName.length > 10) score += 10;
  return Math.min(score, 100);
}

function createErrorResponse(message, status, corsHeaders) {
  return new Response(JSON.stringify({
    error: true,
    message,
    status,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
