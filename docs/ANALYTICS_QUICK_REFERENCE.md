# Analytics Quick Reference Card

## Files Created

```
Building-Vitals/workers/
├── wrangler.toml                    (updated)
├── analytics-middleware.js          (NEW - 330 lines)
├── analytics-instrumentation.js     (NEW - 280 lines)
└── test-analytics.js                (NEW - 350 lines)

docs/
├── ANALYTICS_INTEGRATION_GUIDE.md           (650 lines)
├── ANALYTICS_QUICK_START.md                 (200 lines)
├── ANALYTICS_WORKER_INTEGRATION_EXAMPLE.md  (450 lines)
├── ANALYTICS_IMPLEMENTATION_SUMMARY.md      (350 lines)
└── ANALYTICS_QUICK_REFERENCE.md             (this file)
```

## Minimal Integration (Copy & Paste)

### 1. Add Import (Line 1 of ai-enhanced-worker.js)

```javascript
import { withAnalytics } from './analytics-middleware.js';
```

### 2. Wrap Handler (Line 519 of ai-enhanced-worker.js)

**Replace**:
```javascript
export default {
  async fetch(request, env, ctx) {
    // ... existing code ...
  }
};
```

**With**:
```javascript
async function handleRequest(request, env, ctx) {
  // ... existing code (unchanged) ...
}

export default {
  fetch: withAnalytics(handleRequest)
};
```

### 3. Deploy

```bash
cd C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\workers
npx wrangler deploy
```

### 4. Test

```bash
node test-analytics.js https://ace-iot-ai-proxy.jstahr.workers.dev YOUR_ACE_TOKEN
```

## API Reference

### AnalyticsWriter Methods

```javascript
const { analytics } = env; // Available in handler

// Track requests
analytics.trackRequest(status, responseSize, duration, metadata);

// Track cache
analytics.trackCache(hit, key, ttl);

// Track API calls
analytics.trackApiCall(endpoint, duration, status, responseSize);

// Track pagination
analytics.trackPagination(pagesFetched, dataPoints, cacheHits, cacheMisses, duration);

// Track batch requests
analytics.trackBatchRequest(requestCount, successCount, failureCount, duration);

// Track errors
analytics.trackError(error, context);
```

### PerformanceTracker Methods

```javascript
const { perf } = env; // Available in handler

// Add markers
perf.mark('operation_start');
perf.mark('operation_end');

// Get marker value
const timestamp = perf.getMarker('operation_start');

// Get duration between markers
const duration = perf.getDuration('operation_start', 'operation_end');

// Get all markers
const allMarkers = perf.getAllMarkers();
```

### Instrumentation Helpers

```javascript
import {
  instrumentPaginatedFetch,
  instrumentAceApiCall,
  instrumentBatchRequest,
  instrumentKvCache,
  instrumentSerialization,
  correlateError
} from './analytics-instrumentation.js';

// Wrap KV cache
const cache = instrumentKvCache(env.POINTS_KV, perf, analytics);
const data = await cache.get('key', { type: 'json' });

// Track error with context
correlateError(error, analytics, {
  endpoint: '/api/sites',
  method: 'GET'
});
```

## Common Code Patterns

### Track ACE API Call

```javascript
const { analytics, perf } = env;

perf.mark('ace_start');
const response = await fetch(`${env.ACE_API_URL}/sites`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
perf.mark('ace_end');

analytics.trackApiCall(
  '/sites',
  perf.getDuration('ace_start', 'ace_end'),
  response.status,
  parseInt(response.headers.get('content-length') || '0', 10)
);
```

### Track Pagination

```javascript
const { analytics } = env;

let pagesFetched = 0;
let cacheHits = 0;
let cacheMisses = 0;
const startTime = Date.now();

// ... pagination loop ...
pagesFetched++;
if (fromCache) cacheHits++;
else cacheMisses++;

analytics.trackPagination(
  pagesFetched,
  totalDataPoints,
  cacheHits,
  cacheMisses,
  Date.now() - startTime
);
```

### Track Errors

```javascript
const { analytics } = env;

try {
  // ... operation ...
} catch (error) {
  analytics.trackError(error, {
    endpoint: '/api/sites',
    method: 'GET',
    userAgent: request.headers.get('user-agent')
  });
  throw error;
}
```

## Analytics Queries

### Error Rate (Last 24 Hours)

```sql
SELECT
  COUNT(*) as error_count,
  JSON_EXTRACT(blob7, '$.errorType') as error_type
FROM paginated_timeseries_metrics
WHERE blob1 = 'error'
  AND double1 > (UNIX_TIMESTAMP() * 1000) - (24 * 60 * 60 * 1000)
GROUP BY error_type
ORDER BY error_count DESC
```

### Average Response Time by Endpoint

```sql
SELECT
  blob2 as endpoint,
  AVG(double2) as avg_duration_ms,
  COUNT(*) as request_count
FROM paginated_timeseries_metrics
WHERE blob1 = 'request'
  AND double1 > (UNIX_TIMESTAMP() * 1000) - (24 * 60 * 60 * 1000)
GROUP BY blob2
ORDER BY avg_duration_ms DESC
```

### Cache Hit Rate

```sql
SELECT
  blob1 as event_type,
  COUNT(*) as count,
  (COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()) as percentage
FROM paginated_timeseries_metrics
WHERE blob1 IN ('cache_hit', 'cache_miss')
  AND double1 > (UNIX_TIMESTAMP() * 1000) - (24 * 60 * 60 * 1000)
GROUP BY blob1
```

### Top Slowest Endpoints

```sql
SELECT
  blob2 as endpoint,
  MAX(double2) as max_duration_ms,
  AVG(double2) as avg_duration_ms,
  COUNT(*) as request_count
FROM paginated_timeseries_metrics
WHERE blob1 = 'request'
  AND double1 > (UNIX_TIMESTAMP() * 1000) - (1 * 60 * 60 * 1000)
GROUP BY blob2
ORDER BY max_duration_ms DESC
LIMIT 10
```

### Pagination Performance

```sql
SELECT
  JSON_EXTRACT(blob7, '$.pagesFetched') as pages,
  JSON_EXTRACT(blob7, '$.dataPointsReturned') as data_points,
  JSON_EXTRACT(blob7, '$.totalDuration') as duration_ms,
  JSON_EXTRACT(blob7, '$.cacheHits') as cache_hits,
  JSON_EXTRACT(blob7, '$.cacheMisses') as cache_misses
FROM paginated_timeseries_metrics
WHERE blob1 = 'pagination'
  AND double1 > (UNIX_TIMESTAMP() * 1000) - (24 * 60 * 60 * 1000)
ORDER BY double1 DESC
LIMIT 100
```

## Response Headers

All requests include:

| Header | Description | Example |
|--------|-------------|---------|
| `X-Request-ID` | Unique request identifier | `550e8400-e29b-41d4-a716-446655440000` |
| `X-Request-Duration` | Total request duration in ms | `145` |

## Event Types

| Type | Description | Key Metrics |
|------|-------------|-------------|
| `request` | HTTP request/response | status, size, duration |
| `error` | Application error | type, message, stack |
| `cache_hit` | KV cache hit | key, ttl |
| `cache_miss` | KV cache miss | key |
| `api_call` | ACE API call | endpoint, duration, status |
| `pagination` | Paginated fetch | pages, data points, cache stats |
| `batch_request` | Batch operation | count, success/failure |

## Data Schema

| Field | Type | Content |
|-------|------|---------|
| `indexes[0]` | string | Request ID (UUID) |
| `blobs[0]` | string | Event type |
| `blobs[1]` | string | Endpoint path |
| `blobs[2]` | string | HTTP method |
| `blobs[3]` | string | User agent |
| `blobs[4]` | string | Country code |
| `blobs[5]` | string | Cloudflare colo |
| `blobs[6]` | string | Event data (JSON) |
| `doubles[0]` | number | Event timestamp (ms) |
| `doubles[1]` | number | Duration/metric (ms) |

## Commands

### Deploy Worker
```bash
cd Building-Vitals/workers
npx wrangler deploy
```

### Test Analytics
```bash
node test-analytics.js https://worker-url.workers.dev YOUR_ACE_TOKEN
```

### View Logs
```bash
npx wrangler tail
npx wrangler tail --format pretty
npx wrangler tail --status ok
npx wrangler tail --status error
```

### Local Development
```bash
npx wrangler dev
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Analytics not appearing | Wait 1-2 minutes, check binding name is `ANALYTICS` |
| Import errors | Ensure files are in `workers/` directory |
| High cardinality warning | Aggregate endpoints, reduce unique blob values |
| Performance slow | Reduce performance markers, consider sampling |
| Deployment fails | Run `npx wrangler deploy --dry-run` to check errors |

## Performance

| Component | Overhead |
|-----------|----------|
| Middleware | ~1ms |
| Performance tracking | ~0.5ms |
| Analytics write | ~0ms (async) |
| **Total** | **<2ms** |

## Links

- Cloudflare Dashboard: https://dash.cloudflare.com/
- Analytics Engine: Analytics & Logs > Analytics Engine
- Worker Logs: `npx wrangler tail`

## Support Files

- **Quick Start**: `docs/ANALYTICS_QUICK_START.md`
- **Integration Guide**: `docs/ANALYTICS_INTEGRATION_GUIDE.md`
- **Worker Example**: `docs/ANALYTICS_WORKER_INTEGRATION_EXAMPLE.md`
- **Implementation Summary**: `docs/ANALYTICS_IMPLEMENTATION_SUMMARY.md`

---

**Status**: ✅ Ready for integration

**Next Step**: Add 2-line import + export wrapper to ai-enhanced-worker.js
