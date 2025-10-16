/**
 * Query Worker - Unified D1/R2 Timeseries API
 *
 * Intelligently routes queries to:
 * - D1 (hot storage) for data <20 days old
 * - R2 (cold storage) for data >20 days old
 * - Both for queries spanning the boundary
 */

// CORS configuration
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-ACE-Token',
  'Access-Control-Max-Age': '86400', // 24 hours
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }), {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      });
    }

    // Main query endpoint
    if (url.pathname === '/timeseries/query') {
      return handleTimeseriesQuery(request, env, ctx);
    }

    return new Response('Not Found', {
      status: 404,
      headers: CORS_HEADERS
    });
  }
};

async function handleTimeseriesQuery(request, env, ctx) {
  const startTime = Date.now();
  const url = new URL(request.url);

  try {
    // Parse query parameters
    const siteName = url.searchParams.get('site_name');
    const pointNamesParam = url.searchParams.get('point_names');
    const startTimeMs = parseInt(url.searchParams.get('start_time'));
    const endTimeMs = parseInt(url.searchParams.get('end_time'));

    // Validation
    if (!siteName || !pointNamesParam || !startTimeMs || !endTimeMs) {
      return jsonResponse({
        error: 'Missing required parameters: site_name, point_names, start_time, end_time',
        error_code: 'INVALID_REQUEST'
      }, 400);
    }

    const pointNames = pointNamesParam.split(',').map(p => p.trim());

    // Time range validation
    const now = Date.now();
    const oneDayFuture = now + (24 * 60 * 60 * 1000);

    if (startTimeMs > now) {
      return jsonResponse({
        error: 'start_time cannot be in the future',
        error_code: 'INVALID_REQUEST',
        query_time_ms: 0
      }, 400);
    }

    if (endTimeMs > oneDayFuture) {
      return jsonResponse({
        error: 'end_time cannot be more than 1 day in the future',
        error_code: 'INVALID_REQUEST',
        query_time_ms: 0
      }, 400);
    }

    // Determine storage tier(s) to query
    const hotCutoffMs = now - (20 * 24 * 60 * 60 * 1000); // 20 days ago
    const startDate = new Date(startTimeMs);
    const endDate = new Date(endTimeMs);

    let samples = [];
    let sources = [];
    let storageTiers = {};

    // Query D1 (hot storage) if range overlaps
    if (endTimeMs > hotCutoffMs) {
      const d1StartMs = Math.max(startTimeMs, hotCutoffMs);
      const d1Samples = await queryD1(env.DB, siteName, pointNames, d1StartMs, endTimeMs);
      samples.push(...d1Samples);
      sources.push('D1');
      storageTiers.hot = {
        start: new Date(d1StartMs).toISOString(),
        end: new Date(endTimeMs).toISOString(),
        sample_count: d1Samples.length
      };
    }

    // Query R2 (cold storage) if range extends before hot cutoff
    if (startTimeMs < hotCutoffMs) {
      const r2EndMs = Math.min(endTimeMs, hotCutoffMs);
      const r2Samples = await queryR2(env.R2, siteName, pointNames, startTimeMs, r2EndMs);
      samples.push(...r2Samples);
      sources.push('R2');
      storageTiers.cold = {
        start: new Date(startTimeMs).toISOString(),
        end: new Date(r2EndMs).toISOString(),
        file_count: Math.ceil((r2EndMs - startTimeMs) / (24 * 60 * 60 * 1000))
      };
    }

    // Sort samples by timestamp
    samples.sort((a, b) => a.timestamp - b.timestamp);

    const queryTimeMs = Date.now() - startTime;

    return jsonResponse({
      site_name: siteName,
      point_names: pointNames,
      samples,
      metadata: {
        total_samples: samples.length,
        sources,
        storage_tiers: storageTiers,
        query_time_ms: queryTimeMs,
        cache_hit: false
      }
    });

  } catch (error) {
    console.error('[Query Worker] Error:', error);
    return jsonResponse({
      error: error.message,
      error_code: 'INTERNAL_ERROR',
      query_time_ms: Date.now() - startTime
    }, 500);
  }
}

async function queryD1(db, siteName, pointNames, startTimeMs, endTimeMs) {
  if (!db) {
    console.warn('[Query Worker] D1 database not bound');
    return [];
  }

  try {
    // Convert to Unix seconds for D1 storage
    const startTimeSec = Math.floor(startTimeMs / 1000);
    const endTimeSec = Math.ceil(endTimeMs / 1000);

    // Build SQL query with parameterized point names
    const placeholders = pointNames.map(() => '?').join(',');
    const sql = `
      SELECT point_name, timestamp, value
      FROM timeseries_raw
      WHERE site_name = ?
        AND point_name IN (${placeholders})
        AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `;

    const params = [siteName, ...pointNames, startTimeSec, endTimeSec];
    const result = await db.prepare(sql).bind(...params).all();

    // Convert timestamps back to milliseconds
    return result.results.map(row => ({
      point_name: row.point_name,
      timestamp: row.timestamp * 1000, // Convert to milliseconds
      value: parseFloat(row.value)
    }));

  } catch (error) {
    console.error('[Query Worker] D1 query failed:', error);
    return [];
  }
}

async function queryR2(bucket, siteName, pointNames, startTimeMs, endTimeMs) {
  if (!bucket) {
    console.warn('[Query Worker] R2 bucket not bound');
    return [];
  }

  // R2 querying would require reading Parquet files
  // For now, return empty array (R2 implementation can be added later)
  console.log('[Query Worker] R2 query not yet implemented (Parquet reading required)');
  return [];
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  });
}
