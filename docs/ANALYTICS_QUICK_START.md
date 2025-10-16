# Analytics Quick Start Guide

## 5-Minute Integration

This guide shows the absolute minimum changes needed to add analytics to your worker.

## Step 1: Update wrangler.toml (Already Done)

```toml
# Analytics Engine for comprehensive tracking
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "paginated_timeseries_metrics"
```

## Step 2: Modify Your Worker (5 Lines of Code)

```javascript
// Add import at the top
import { withAnalytics } from './analytics-middleware.js';

// Find your existing export (looks like this):
export default {
  async fetch(request, env, ctx) {
    // ... your existing code ...
  }
};

// Replace it with this:
async function handleRequest(request, env, ctx) {
  // ... your existing code (unchanged) ...
}

export default {
  fetch: withAnalytics(handleRequest)
};
```

## Step 3: Deploy

```bash
cd Building-Vitals/workers
npx wrangler deploy
```

## Step 4: Test

```bash
node test-analytics.js https://your-worker.workers.dev YOUR_ACE_TOKEN
```

## That's It!

You now have:
- ✓ Request/response tracking
- ✓ Error logging
- ✓ Performance metrics
- ✓ Cache hit/miss tracking
- ✓ Request ID headers

## View Your Analytics

1. Go to Cloudflare Dashboard
2. **Analytics & Logs** > **Analytics Engine**
3. Select dataset: **paginated_timeseries_metrics**

## Optional: Add Detailed Tracking

For more detailed tracking, use the helpers in `analytics-instrumentation.js`:

```javascript
// Track specific operations
const { analytics, perf } = env;

// Track cache operations
analytics.trackCache(true, 'my-key', 300);

// Track API calls
analytics.trackApiCall('/endpoint', 150, 200, 1024);

// Track errors with context
analytics.trackError(error, { endpoint: '/api/sites' });

// Add performance markers
perf.mark('operation_start');
// ... do work ...
perf.mark('operation_end');
```

## Example Integration

Here's a minimal example showing the worker before and after:

### Before (No Analytics)

```javascript
export default {
  async fetch(request, env, ctx) {
    try {
      const response = await fetch(`${env.ACE_API_URL}/sites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response;
    } catch (error) {
      return new Response('Error', { status: 500 });
    }
  }
};
```

### After (With Analytics)

```javascript
import { withAnalytics } from './analytics-middleware.js';

async function handleRequest(request, env, ctx) {
  try {
    const response = await fetch(`${env.ACE_API_URL}/sites`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response;
  } catch (error) {
    return new Response('Error', { status: 500 });
  }
}

export default {
  fetch: withAnalytics(handleRequest)
};
```

That's it! The middleware automatically tracks:
- Request duration
- Response status
- Error details
- Request IDs
- Performance markers

## Minimal Code Example for ai-enhanced-worker.js

Here's the exact code change for the existing worker:

```javascript
// At the very top of the file, add:
import { withAnalytics } from './analytics-middleware.js';

// Find line 519 which currently says:
// export default {
//   async fetch(request, env, ctx) {

// Change it to:
async function handleRequest(request, env, ctx) {
  // Keep ALL existing code from line 521 to the end of the fetch function
  // (approximately lines 521-1700)
}

// Then at the very end, replace the export with:
export default {
  fetch: withAnalytics(handleRequest)
};
```

## Advanced: Instrumented Cache Example

```javascript
import { withAnalytics } from './analytics-middleware.js';
import { instrumentKvCache } from './analytics-instrumentation.js';

async function handleRequest(request, env, ctx) {
  const { analytics, perf } = env; // Added by middleware

  // Wrap KV for automatic tracking
  const cache = instrumentKvCache(env.POINTS_KV, perf, analytics);

  // Use cache normally - hits/misses are tracked automatically
  const cached = await cache.get('key', { type: 'json' });
  if (!cached) {
    const data = await fetchData();
    await cache.put('key', JSON.stringify(data), { expirationTtl: 300 });
  }

  return new Response(JSON.stringify(cached));
}

export default {
  fetch: withAnalytics(handleRequest)
};
```

## Next Steps

- Read [ANALYTICS_INTEGRATION_GUIDE.md](./ANALYTICS_INTEGRATION_GUIDE.md) for detailed instrumentation
- Check worker logs: `npx wrangler tail`
- View analytics in Cloudflare Dashboard
- Set up alerts for error rates
