# Exact Integration Steps for ai-enhanced-worker.js

## Current Status

The analytics infrastructure is ready:
- ✅ wrangler.toml updated with Analytics Engine binding
- ✅ analytics-middleware.js created
- ✅ analytics-instrumentation.js created
- ✅ test-analytics.js created

## Integration Code Changes

### Change 1: Add Import at Top of File

**Location**: Line 1 of `ai-enhanced-worker.js`

Add this import statement:

```javascript
import { withAnalytics } from './analytics-middleware.js';
import { instrumentKvCache, correlateError } from './analytics-instrumentation.js';
```

### Change 2: Wrap the Main Export

**Location**: Line 519 of `ai-enhanced-worker.js`

**Current Code**:
```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // ... rest of the handler code ...
  }
};
```

**New Code**:
```javascript
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  // Access analytics and performance tracker (added by middleware)
  const { analytics, perf } = env;

  // ... rest of the existing handler code (unchanged) ...
}

// Export wrapped with analytics
export default {
  fetch: withAnalytics(handleRequest)
};
```

### Change 3: Add Performance Markers to Key Operations

#### For /api/sites Endpoint (Line ~554)

**Current Code**:
```javascript
if (path === '/api/sites') {
  const token = request.headers.get('X-ACE-Token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'No ACE token provided' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const response = await fetch(`${env.ACE_API_URL}/sites`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
```

**Enhanced Code**:
```javascript
if (path === '/api/sites') {
  const token = request.headers.get('X-ACE-Token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'No ACE token provided' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  perf.mark('ace_api_sites_start');
  const response = await fetch(`${env.ACE_API_URL}/sites`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  perf.mark('ace_api_sites_end');

  const duration = perf.getDuration('ace_api_sites_start', 'ace_api_sites_end');
  analytics.trackApiCall('/sites', duration, response.status,
    parseInt(response.headers.get('content-length') || '0', 10));
```

#### For Batch Timeseries Endpoint (Line ~585)

**Add at the end of the batch handler** (around line 690):

```javascript
// After: const results = await Promise.all(promises);

const successCount = results.filter(r => r.status === 200).length;
const failureCount = results.length - successCount;

analytics.trackBatchRequest(
  requests.length,
  successCount,
  failureCount,
  Date.now() - startTime
);
```

#### For Configured Points Endpoint (Line ~1179)

**Current Code**:
```javascript
console.log(`[CACHE MISS] No valid cache for ${siteName}, fetching from ACE API`);

// Fetch all pages from ACE API
const allPoints = [];
let currentPage = 1;
let hasMore = true;

while (hasMore) {
  const response = await fetch(`${env.ACE_API_URL}/sites/${siteName}/configured_points?per_page=5000&page=${currentPage}`, {
```

**Enhanced Code**:
```javascript
console.log(`[CACHE MISS] No valid cache for ${siteName}, fetching from ACE API`);

// Fetch all pages from ACE API
const allPoints = [];
let currentPage = 1;
let hasMore = true;
let cacheHits = 0;
let cacheMisses = 1; // First page is always a miss

perf.mark('configured_points_fetch_start');

while (hasMore) {
  perf.mark(`page_${currentPage}_start`);

  const response = await fetch(`${env.ACE_API_URL}/sites/${siteName}/configured_points?per_page=5000&page=${currentPage}`, {
```

**After the while loop** (around line 1240):

```javascript
perf.mark('configured_points_fetch_end');

const duration = perf.getDuration('configured_points_fetch_start', 'configured_points_fetch_end');
analytics.trackPagination(
  currentPage,
  allPoints.length,
  cacheHits,
  cacheMisses,
  duration
);
```

### Change 4: Add Error Tracking to Catch Blocks

**Find the main try-catch block** (around line 549 and the end of the handler):

**Current Code**:
```javascript
try {
  // Route handling
  const path = url.pathname;
  // ... handler code ...
} catch (error) {
  console.error('[Worker Error]', error);
  return new Response(JSON.stringify({
    error: 'Internal server error',
    message: error.message
  }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

**Enhanced Code**:
```javascript
try {
  // Route handling
  const path = url.pathname;
  // ... handler code ...
} catch (error) {
  console.error('[Worker Error]', error);

  // Track error with correlation data
  correlateError(error, analytics, {
    endpoint: url.pathname,
    method: request.method,
    userAgent: request.headers.get('user-agent'),
    country: request.cf?.country,
    colo: request.cf?.colo
  });

  return new Response(JSON.stringify({
    error: 'Internal server error',
    message: error.message
  }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

### Change 5: Instrument KV Cache (Optional but Recommended)

**Find KV cache operations** (search for `env.POINTS_KV`):

**Current Code**:
```javascript
const cached = await env.POINTS_KV.get(cacheKey, { type: 'json' });
```

**Enhanced Code**:
```javascript
// At the start of the handler (after getting analytics and perf)
const cache = instrumentKvCache(env.POINTS_KV, perf, analytics);

// Then use 'cache' instead of 'env.POINTS_KV'
const cached = await cache.get(cacheKey, { type: 'json' });
```

## Complete Minimal Integration

If you want the absolute minimum changes:

### 1. Add imports (top of file):

```javascript
import { withAnalytics } from './analytics-middleware.js';
```

### 2. Wrap export (line 519):

```javascript
async function handleRequest(request, env, ctx) {
  // ALL existing code from the fetch function
  const url = new URL(request.url);
  const corsHeaders = { /* ... */ };
  // ... everything else unchanged ...
}

export default {
  fetch: withAnalytics(handleRequest)
};
```

**That's it!** These two changes give you:
- ✅ Request/response metrics
- ✅ Automatic error tracking
- ✅ Performance timing
- ✅ Request IDs in headers

## Testing After Integration

### 1. Deploy the worker:

```bash
cd C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\workers
npx wrangler deploy
```

### 2. Run the test script:

```bash
node test-analytics.js https://ace-iot-ai-proxy.jstahr.workers.dev YOUR_ACE_TOKEN
```

### 3. Check worker logs:

```bash
npx wrangler tail
```

### 4. View analytics:

1. Go to Cloudflare Dashboard
2. Navigate to **Analytics & Logs** > **Analytics Engine**
3. Select dataset: **paginated_timeseries_metrics**
4. You should see data appearing within 1-2 minutes

## Example Analytics Queries

Once data is flowing, you can query it:

### Request Count by Endpoint

```sql
SELECT
  blob2 as endpoint,
  COUNT(*) as request_count
FROM paginated_timeseries_metrics
WHERE blob1 = 'request'
GROUP BY blob2
ORDER BY request_count DESC
```

### Average Response Time by Endpoint

```sql
SELECT
  blob2 as endpoint,
  AVG(double2) as avg_duration_ms
FROM paginated_timeseries_metrics
WHERE blob1 = 'request'
GROUP BY blob2
ORDER BY avg_duration_ms DESC
```

### Error Rate

```sql
SELECT
  COUNT(*) as error_count,
  blob7 as error_details
FROM paginated_timeseries_metrics
WHERE blob1 = 'error'
GROUP BY blob7
ORDER BY error_count DESC
```

### Cache Hit Rate

```sql
SELECT
  blob1 as event_type,
  COUNT(*) as count
FROM paginated_timeseries_metrics
WHERE blob1 IN ('cache_hit', 'cache_miss')
GROUP BY blob1
```

## Troubleshooting

### Worker Not Deploying

```bash
# Check for syntax errors
npx wrangler deploy --dry-run

# View detailed logs
npx wrangler tail --format pretty
```

### Analytics Not Showing

1. Wait 1-2 minutes after deployment
2. Check binding name matches exactly: `ANALYTICS`
3. Verify dataset name: `paginated_timeseries_metrics`
4. Check worker logs for errors: `npx wrangler tail`

### Import Errors

If you see "Module not found" errors:

1. Ensure files are in the same directory: `Building-Vitals/workers/`
2. Check import paths use `./` prefix
3. Verify file names match exactly (case-sensitive)

## Performance Impact

Expected overhead per request:
- Middleware wrapper: ~1ms
- Performance tracking: ~0.5ms
- Analytics write: ~0ms (asynchronous)
- **Total: <2ms per request**

## Next Steps

1. Deploy and test the basic integration
2. Add detailed instrumentation for specific endpoints
3. Create Cloudflare Dashboard visualizations
4. Set up alerts for error rates > 5%
5. Monitor performance and optimize as needed

## Files Modified

After integration, you will have modified:
- ✅ `wrangler.toml` - Analytics binding added
- ✅ `ai-enhanced-worker.js` - Analytics integrated

And created:
- ✅ `analytics-middleware.js` - Core middleware
- ✅ `analytics-instrumentation.js` - Helper utilities
- ✅ `test-analytics.js` - Test script
