/**
 * Cloudflare Worker: Point-Filtered Paginated Timeseries Proxy
 *
 * OPTIMIZATION: Filters timeseries data by point names at the edge
 * - 99%+ reduction in data transfer for small point selections
 * - Reduces 84MB → <1MB for 3 points over 24h
 * - Maintains raw_data=true for preserving collection intervals
 * - Fully transparent to frontend (drop-in replacement)
 */

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  },

  async queue(batch, env) {
    // Queue handler placeholder (required by existing worker config)
    console.log('[Queue Handler] Received batch:', batch.messages.length);
  }
};

async function handleRequest(request) {
  const url = new URL(request.url);

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-ace-token, authorization, Accept',
        'Access-Control-Max-Age': '86400', // 24 hours
      }
    });
  }

  // Only handle paginated timeseries requests
  if (!url.pathname.includes('/timeseries/paginated')) {
    return proxyToACE(request);
  }

  // Extract point_names filter from query params
  const pointNamesParam = url.searchParams.get('point_names');

  // If no filter specified, proxy normally
  if (!pointNamesParam) {
    return proxyToACE(request);
  }

  // Parse point names (comma-separated)
  const requestedPoints = new Set(
    pointNamesParam.split(',').map(name => name.trim()).filter(Boolean)
  );

  console.log('[Point Filter Worker] Filtering request:', {
    requestedPointsCount: requestedPoints.size,
    pointNames: Array.from(requestedPoints)
  });

  // Remove point_names from params before proxying to ACE API
  url.searchParams.delete('point_names');

  // Build ACE API request
  const aceUrl = url.toString().replace(
    url.origin,
    'https://flightdeck.aceiot.cloud'
  );

  // Proxy request to ACE API
  // Transform headers: convert x-ace-token to authorization header
  const aceHeaders = new Headers(request.headers);
  const aceToken = aceHeaders.get('x-ace-token');
  if (aceToken && !aceHeaders.has('authorization')) {
    aceHeaders.set('authorization', `Bearer ${aceToken}`);
  }

  const aceRequest = new Request(aceUrl, {
    method: request.method,
    headers: aceHeaders,
    body: request.body
  });

  const aceResponse = await fetch(aceRequest);

  if (!aceResponse.ok) {
    return aceResponse; // Return error as-is
  }

  // Parse response
  const data = await aceResponse.json();

  // FILTER: Keep only requested points
  if (data.point_samples && Array.isArray(data.point_samples)) {
    const originalCount = data.point_samples.length;

    data.point_samples = data.point_samples.filter(sample =>
      requestedPoints.has(sample.name)
    );

    const filteredCount = data.point_samples.length;
    const reduction = ((1 - filteredCount / originalCount) * 100).toFixed(1);

    console.log('[Point Filter Worker] Filtered:', {
      originalSamples: originalCount,
      filteredSamples: filteredCount,
      reduction: `${reduction}%`,
      dataReduction: `${((originalCount - filteredCount) / 1000).toFixed(0)}k samples removed`
    });
  }

  // Return filtered response
  return new Response(JSON.stringify(data), {
    status: aceResponse.status,
    statusText: aceResponse.statusText,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-ace-token, authorization, Accept',
      'X-Filtered-Points': requestedPoints.size.toString(),
      'X-Filter-Applied': 'true'
    }
  });
}

/**
 * Proxy request to ACE API without filtering
 */
async function proxyToACE(request) {
  const url = new URL(request.url);

  // Add per_page parameter to configured_points requests to get all points
  if (url.pathname.includes('/configured_points') && !url.searchParams.has('per_page')) {
    url.searchParams.set('per_page', '10000');
    console.log('[Proxy] Added per_page=10000 to configured_points request');
  }

  const aceUrl = url.toString().replace(
    url.origin,
    'https://flightdeck.aceiot.cloud'
  );

  // Transform headers: convert x-ace-token to authorization header
  const aceHeaders = new Headers(request.headers);
  const aceToken = aceHeaders.get('x-ace-token');
  if (aceToken && !aceHeaders.has('authorization')) {
    aceHeaders.set('authorization', `Bearer ${aceToken}`);
  }

  const aceRequest = new Request(aceUrl, {
    method: request.method,
    headers: aceHeaders,
    body: request.body
  });

  const aceResponse = await fetch(aceRequest);

  // Return with CORS headers
  const response = new Response(aceResponse.body, {
    status: aceResponse.status,
    statusText: aceResponse.statusText,
    headers: aceResponse.headers
  });

  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-ace-token, authorization, Accept');
  return response;
}
