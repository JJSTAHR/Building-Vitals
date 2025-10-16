# Analytics Engine Integration Guide

## Overview

This guide explains how to integrate comprehensive analytics tracking into the Cloudflare Worker using the Analytics Engine middleware.

## What's Been Created

1. **wrangler.toml** - Updated with Analytics Engine binding
2. **analytics-middleware.js** - Core analytics tracking middleware
3. **analytics-instrumentation.js** - Helper utilities for specific operations
4. **test-analytics.js** - Test script to validate analytics tracking

## Analytics Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Request Flow                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Request → withAnalytics() Wrapper                       │
│                    ↓                                         │
│  2. PerformanceTracker initialized                          │
│                    ↓                                         │
│  3. Handler executes with instrumented operations           │
│                    ↓                                         │
│  4. Analytics events written to Analytics Engine            │
│                    ↓                                         │
│  5. Response with performance headers                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Event Types Tracked

| Event Type | Description | Data Captured |
|------------|-------------|---------------|
| `request` | All HTTP requests | Status, size, duration, method, path |
| `error` | Application errors | Error type, message, stack, context |
| `cache_hit` | KV cache hits | Key, TTL |
| `cache_miss` | KV cache misses | Key |
| `api_call` | ACE API calls | Endpoint, duration, status, size |
| `pagination` | Paginated fetches | Pages, data points, cache stats |
| `batch_request` | Batch operations | Request count, success/failure rates |

## Integration Steps

### Step 1: Wrap Your Main Handler

The simplest integration is to wrap your existing handler with the `withAnalytics()` middleware:

```javascript
// At the top of ai-enhanced-worker.js
import { withAnalytics } from './analytics-middleware.js';

// Your existing handler function
async function handleRequest(request, env, ctx) {
  // ... existing code ...
}

// Export the wrapped handler
export default {
  fetch: withAnalytics(handleRequest)
};
```

### Step 2: Instrument Specific Operations

For detailed tracking of specific operations, use the instrumentation helpers:

#### Paginated Timeseries Endpoint

```javascript
import { instrumentPaginatedFetch } from './analytics-instrumentation.js';

// In your paginated timeseries handler
async function fetchPaginatedTimeseries(request, env, ctx) {
  const { analytics, perf } = env; // Added by withAnalytics

  // Track pagination performance
  let pagesFetched = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  // Your pagination loop
  while (hasMorePages) {
    perf.mark(`page_${pagesFetched}_start`);

    const pageData = await fetchPage(page);
    pagesFetched++;

    perf.mark(`page_${pagesFetched}_end`);

    if (fromCache) cacheHits++;
    else cacheMisses++;
  }

  // Track final metrics
  analytics.trackPagination(
    pagesFetched,
    totalDataPoints,
    cacheHits,
    cacheMisses,
    perf.getDuration('pagination_start', 'pagination_end')
  );
}
```

#### ACE API Calls

```javascript
// Track individual ACE API calls
async function callAceApi(endpoint, env) {
  const { analytics } = env;

  const startTime = Date.now();

  try {
    const response = await fetch(`${env.ACE_API_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const duration = Date.now() - startTime;
    const responseSize = parseInt(response.headers.get('content-length') || '0', 10);

    analytics.trackApiCall(endpoint, duration, response.status, responseSize);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    analytics.trackApiCall(endpoint, duration, 0, 0);
    analytics.trackError(error, { endpoint, operation: 'ace_api_call' });
    throw error;
  }
}
```

#### KV Cache Operations

```javascript
import { instrumentKvCache } from './analytics-instrumentation.js';

// In your handler
async function handleRequest(request, env, ctx) {
  const { analytics, perf } = env;

  // Wrap KV operations with instrumentation
  const cache = instrumentKvCache(env.POINTS_KV, perf, analytics);

  // Use instrumented cache (automatically tracks hits/misses)
  const cachedData = await cache.get(cacheKey, { type: 'json' });

  if (!cachedData) {
    const freshData = await fetchFromApi();
    await cache.put(cacheKey, JSON.stringify(freshData), { expirationTtl: 300 });
  }
}
```

#### Batch Requests

```javascript
// In your batch timeseries handler
async function handleBatchRequest(request, env, ctx) {
  const { analytics } = env;

  const batchRequest = await request.json();
  const { requests } = batchRequest;

  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;

  const promises = requests.map(async (req) => {
    try {
      const result = await processRequest(req);
      if (result.status < 300) successCount++;
      else failureCount++;
      return result;
    } catch (error) {
      failureCount++;
      throw error;
    }
  });

  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;

  analytics.trackBatchRequest(
    requests.length,
    successCount,
    failureCount,
    duration
  );

  return results;
}
```

### Step 3: Add Performance Markers

Use the `PerformanceTracker` to add detailed timing markers:

```javascript
async function handleRequest(request, env, ctx) {
  const { perf } = env;

  perf.mark('request_start');

  // ACE API call
  perf.mark('ace_api_start');
  const data = await fetchFromAce();
  perf.mark('ace_api_end');

  // Cache operation
  perf.mark('cache_lookup_start');
  const cached = await checkCache();
  perf.mark('cache_lookup_end');

  // Response serialization
  perf.mark('serialize_start');
  const json = JSON.stringify(data);
  perf.mark('serialize_end');

  perf.mark('request_end');

  // All markers are automatically included in analytics
  const markers = perf.getAllMarkers();
  console.log('Performance markers:', markers);
}
```

### Step 4: Track Errors with Context

Use the error correlation helper to track errors with rich context:

```javascript
import { correlateError } from './analytics-instrumentation.js';

async function handleRequest(request, env, ctx) {
  const { analytics } = env;
  const url = new URL(request.url);

  try {
    // Your handler logic
  } catch (error) {
    // Track error with correlation data
    correlateError(error, analytics, {
      endpoint: url.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      country: request.cf?.country,
      colo: request.cf?.colo,
      requestId: analytics.requestId
    });

    throw error;
  }
}
```

## Example: Complete Integration

Here's a complete example showing how to integrate analytics into a typical endpoint:

```javascript
import { withAnalytics } from './analytics-middleware.js';
import { instrumentKvCache, correlateError } from './analytics-instrumentation.js';

async function handleRequest(request, env, ctx) {
  const { analytics, perf } = env;
  const url = new URL(request.url);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-ACE-Token'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    perf.mark('request_start');

    // Instrument KV cache
    const cache = instrumentKvCache(env.POINTS_KV, perf, analytics);

    // Handle /api/sites endpoint
    if (url.pathname === '/api/sites') {
      perf.mark('cache_check_start');
      const cached = await cache.get('sites_list', { type: 'json' });
      perf.mark('cache_check_end');

      if (cached) {
        perf.mark('request_end');
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Cache miss - fetch from ACE API
      perf.mark('ace_api_start');
      const token = request.headers.get('X-ACE-Token');
      const response = await fetch(`${env.ACE_API_URL}/sites`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      perf.mark('ace_api_end');

      const aceDuration = perf.getDuration('ace_api_start', 'ace_api_end');
      const responseSize = parseInt(response.headers.get('content-length') || '0', 10);

      analytics.trackApiCall('/sites', aceDuration, response.status, responseSize);

      if (!response.ok) {
        throw new Error(`ACE API error: ${response.status}`);
      }

      const sites = await response.json();

      // Cache for 5 minutes
      await cache.put('sites_list', JSON.stringify(sites), { expirationTtl: 300 });

      perf.mark('request_end');

      return new Response(JSON.stringify(sites), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle 404
    return new Response('Not Found', { status: 404, headers: corsHeaders });

  } catch (error) {
    // Track error with full context
    correlateError(error, analytics, {
      endpoint: url.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      country: request.cf?.country,
      colo: request.cf?.colo
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Export wrapped handler
export default {
  fetch: withAnalytics(handleRequest)
};
```

## Testing Analytics

### Local Testing

```bash
# Run the worker locally
cd Building-Vitals/workers
npx wrangler dev

# In another terminal, run the test script
node test-analytics.js http://localhost:8787 YOUR_ACE_TOKEN
```

### Production Testing

```bash
# Deploy the worker
npx wrangler deploy

# Test with production URL
node test-analytics.js https://ace-iot-ai-proxy.yourdomain.workers.dev YOUR_ACE_TOKEN
```

### Viewing Analytics Data

1. Log into Cloudflare Dashboard
2. Navigate to **Analytics & Logs** > **Analytics Engine**
3. Select dataset: **paginated_timeseries_metrics**
4. Query the data using GraphQL:

```graphql
query {
  viewer {
    accounts(filter: { accountTag: "your-account-id" }) {
      pageviewsAdaptiveGroups(
        filter: {
          date_gt: "2024-01-01"
          date_lt: "2024-12-31"
        }
        orderBy: [count_DESC]
        limit: 1000
      ) {
        count
        dimensions {
          blob1  # Event type
          blob2  # Endpoint
          blob3  # Method
          blob4  # User agent
          blob5  # Country
          blob6  # Colo
          blob7  # Event data (JSON)
        }
        sum {
          double1  # Timestamp
          double2  # Duration
        }
      }
    }
  }
}
```

## Performance Impact

The analytics middleware is designed to have minimal performance impact:

- **Event writing**: Asynchronous, non-blocking
- **Performance tracking**: In-memory JavaScript objects (~1ms overhead)
- **Cache instrumentation**: Wrapper pattern, negligible overhead
- **Total overhead**: <5ms per request

## Best Practices

1. **Use Performance Markers Strategically**: Only mark critical operations
2. **Limit Context Data**: Keep error context under 1KB to avoid truncation
3. **Batch Analytics Writes**: The middleware automatically batches events
4. **Monitor Analytics Costs**: Analytics Engine has usage-based pricing
5. **Set Appropriate Cache TTLs**: Balance freshness vs. cache hit rate

## Troubleshooting

### Analytics Not Showing Up

1. Check that `ANALYTICS` binding is configured in wrangler.toml
2. Verify the dataset name matches: `paginated_timeseries_metrics`
3. Wait 1-2 minutes for data to appear in the dashboard
4. Check worker logs for analytics errors: `npx wrangler tail`

### High Cardinality Warning

If you see "High cardinality detected" warnings:

1. Reduce the number of unique blob values
2. Aggregate similar endpoints (e.g., use `/api/sites/:id` instead of full URLs)
3. Use indexes for high-cardinality data (like request IDs)

### Performance Degradation

If the worker becomes slow:

1. Check the number of performance markers (keep under 20 per request)
2. Reduce analytics event frequency for high-traffic endpoints
3. Consider sampling (e.g., track only 10% of requests)

## Next Steps

1. **Deploy the Updated Worker**: `npx wrangler deploy`
2. **Run Tests**: Use test-analytics.js to validate tracking
3. **Create Dashboards**: Build analytics dashboards in Cloudflare
4. **Set Up Alerts**: Configure alerts for error rate thresholds
5. **Optimize Based on Data**: Use analytics to identify bottlenecks

## Additional Resources

- [Cloudflare Analytics Engine Docs](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Workers KV Performance](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Workers Performance Tips](https://developers.cloudflare.com/workers/platform/limits/)
