# Quick Start Guide: R2 & Queue Integration

Get up and running with R2 caching and Queue processing in 5 minutes.

## Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed: `npm install -g wrangler`
- Logged in: `wrangler login`

## 1. Automated Setup (Recommended)

### Windows
```cmd
cd scripts
setup-cloudflare-services.cmd
```

### Linux/Mac
```bash
cd scripts
chmod +x setup-cloudflare-services.sh
./setup-cloudflare-services.sh
```

The script will:
1. Create R2 buckets
2. Create D1 database
3. Initialize schema
4. Deploy worker

**Done!** Skip to step 4 (Testing).

## 2. Manual Setup (Alternative)

### Create Resources

```bash
cd Building-Vitals/workers

# Create R2 buckets
wrangler r2 bucket create building-vitals-timeseries
wrangler r2 bucket create building-vitals-timeseries-preview

# Create D1 database
wrangler d1 create building-vitals-db
# Note the database_id and update wrangler.toml

# Initialize schema
wrangler d1 execute building-vitals-db --file=../services/schema.sql
```

### Update wrangler.toml

Replace `TBD-UPDATE-AFTER-CREATION` with your database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "building-vitals-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### Deploy

```bash
wrangler deploy
```

## 3. Verify Deployment

```bash
# Check health
curl https://YOUR_WORKER_URL/api/health

# Should return:
# {"status":"healthy","timestamp":"2025-01-31T..."}
```

## 4. Test the Integration

### Small Request (Direct Fetch)

```bash
curl "https://YOUR_WORKER_URL/api/timeseries?site=test_site&points=point1&start_time=2025-01-01T00:00:00Z&end_time=2025-01-02T00:00:00Z"
```

**Expected:** Immediate response with data
- Response time: 1-5 seconds
- Status: 200 OK
- Header: `X-Route-Type: direct`

### Medium Request (Cached)

```bash
# First request (cache miss)
curl "https://YOUR_WORKER_URL/api/timeseries?site=test_site&points=point1,point2,point3&start_time=2025-01-01T00:00:00Z&end_time=2025-01-15T00:00:00Z"

# Second request (cache hit - faster!)
curl "https://YOUR_WORKER_URL/api/timeseries?site=test_site&points=point1,point2,point3&start_time=2025-01-01T00:00:00Z&end_time=2025-01-15T00:00:00Z"
```

**Expected:** Second request is much faster
- First: `X-Cache-Hit: false` (2-10 seconds)
- Second: `X-Cache-Hit: true` (0.1-1 second)

### Large Request (Queued)

```bash
# Queue a large request (50 points, full year)
curl "https://YOUR_WORKER_URL/api/timeseries?site=test_site&points=point1,point2,point3,...,point50&start_time=2025-01-01T00:00:00Z&end_time=2025-12-31T00:00:00Z"
```

**Expected:** 202 Accepted with job ID
```json
{
  "status": "queued",
  "jobId": "job_abc123",
  "statusUrl": "/api/jobs/job_abc123",
  "pollInterval": 5000
}
```

**Check job status:**
```bash
curl "https://YOUR_WORKER_URL/api/jobs/job_abc123"
```

**Expected progression:**
1. `"status": "queued"` (initially)
2. `"status": "processing"` (with progress %)
3. `"status": "completed"` (with data URL)

## 5. Monitor Your Worker

### View Logs
```bash
wrangler tail --format=pretty
```

### Check Statistics
```bash
curl "https://YOUR_WORKER_URL/api/stats"
```

**Example response:**
```json
{
  "cache": {
    "totalObjects": 15,
    "totalSizeMB": "23.45"
  },
  "jobs": {
    "total_jobs": 50,
    "completed": 48,
    "failed": 1,
    "active": 1
  },
  "requests": [
    {
      "route_type": "cached",
      "count": 1000,
      "avg_duration": 156,
      "cache_hits": 750
    }
  ]
}
```

### Query Database
```bash
# Active jobs
wrangler d1 execute building-vitals-db --command="SELECT * FROM v_active_jobs"

# Job performance
wrangler d1 execute building-vitals-db --command="SELECT * FROM v_job_performance"

# Cache stats
wrangler d1 execute building-vitals-db --command="SELECT * FROM v_cache_performance"
```

### Browse R2 Cache
```bash
# List cached objects
wrangler r2 object list building-vitals-timeseries --prefix="timeseries/"

# Get object details
wrangler r2 object info building-vitals-timeseries timeseries/site1/cache_key.json
```

## 6. Integrate with Frontend

### Direct/Cached Requests

```javascript
async function fetchTimeseries(site, points, startTime, endTime) {
  const response = await fetch(
    `/api/timeseries?site=${site}&points=${points.join(',')}&start_time=${startTime}&end_time=${endTime}`
  );

  if (response.status === 200) {
    // Direct or cached - data available
    const result = await response.json();
    console.log('Cache hit:', result._meta.cacheHit);
    return result.data;
  } else if (response.status === 202) {
    // Queued - need to poll
    const { jobId, statusUrl } = await response.json();
    return await pollJobStatus(jobId);
  } else {
    throw new Error('Request failed');
  }
}
```

### Queued Requests with Polling

```javascript
async function pollJobStatus(jobId) {
  while (true) {
    const response = await fetch(`/api/jobs/${jobId}`);
    const status = await response.json();

    if (status.status === 'completed') {
      console.log('Job completed!');
      // Fetch data from cache or use status.dataUrl
      return status;
    } else if (status.status === 'failed') {
      throw new Error(status.error);
    } else {
      // Still processing
      console.log(`Progress: ${status.progress}%`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
    }
  }
}
```

### React Hook Example

```javascript
import { useState, useEffect } from 'react';

function useTimeseries(site, points, startTime, endTime) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/timeseries?site=${site}&points=${points.join(',')}&start_time=${startTime}&end_time=${endTime}`
        );

        if (response.status === 200) {
          // Direct/cached response
          const result = await response.json();
          if (!cancelled) setData(result.data);
        } else if (response.status === 202) {
          // Queued - poll for status
          const { jobId } = await response.json();

          while (!cancelled) {
            const statusResponse = await fetch(`/api/jobs/${jobId}`);
            const status = await statusResponse.json();

            if (status.status === 'completed') {
              if (!cancelled) setData(status.data);
              break;
            } else if (status.status === 'failed') {
              throw new Error(status.error);
            } else {
              if (!cancelled) setProgress(status.progress || 0);
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [site, points, startTime, endTime]);

  return { data, loading, error, progress };
}
```

## 7. Troubleshooting

### Issue: Health check fails
**Solution:**
```bash
# Check worker is deployed
wrangler deployments list

# View logs
wrangler tail
```

### Issue: Database not found
**Solution:**
```bash
# Verify database exists
wrangler d1 list

# Check wrangler.toml has correct database_id
# Redeploy if needed
wrangler deploy
```

### Issue: Cache not working
**Solution:**
```bash
# Verify R2 bucket exists
wrangler r2 bucket list

# Check bucket binding in wrangler.toml
# Check logs for R2 errors
wrangler tail --level=error
```

### Issue: Jobs stuck in queue
**Solution:**
```bash
# Check queue consumer logs
wrangler tail --format=pretty

# Verify D1 database accessible
wrangler d1 execute building-vitals-db --command="SELECT * FROM queue_jobs WHERE status='processing'"

# Check for dead letter queue messages
wrangler queues consumer list chart-processing-dlq
```

## 8. Next Steps

### Optimize Performance

1. **Adjust routing thresholds:**
   ```javascript
   const service = new EnhancedTimeseriesService(env, {
     smallThreshold: 500,      // More caching
     largeThreshold: 50000     // Earlier queuing
   });
   ```

2. **Increase cache TTL:**
   ```javascript
   const cacheService = new R2CacheService(env.TIMESERIES_CACHE, {
     defaultTTL: 7200,         // 2 hours
     maxCacheAge: 172800       // 48 hours
   });
   ```

3. **Monitor cache hit rate:**
   ```bash
   curl "https://YOUR_WORKER_URL/api/stats" | jq '.requests[] | select(.route_type=="cached") | .cache_hits'
   ```

### Add Authentication

```javascript
// In worker fetch handler
const apiKey = request.headers.get('X-API-Key');
if (apiKey !== env.API_KEY) {
  return new Response('Unauthorized', { status: 401 });
}
```

### Set Up Alerts

Use Cloudflare Workers Analytics to create alerts for:
- High error rates
- Slow response times
- Queue backlog
- Cache hit rate drops

## 9. Documentation

- **Full Guide:** [docs/R2_QUEUE_INTEGRATION.md](../../docs/R2_QUEUE_INTEGRATION.md)
- **Deployment:** [docs/DEPLOYMENT_GUIDE_R2_QUEUE.md](../../docs/DEPLOYMENT_GUIDE_R2_QUEUE.md)
- **Services:** [README.md](./README.md)
- **Summary:** [docs/R2_QUEUE_IMPLEMENTATION_SUMMARY.md](../../docs/R2_QUEUE_IMPLEMENTATION_SUMMARY.md)

## Support

Need help? Check:
1. Worker logs: `wrangler tail`
2. Database queries: `wrangler d1 execute building-vitals-db --command="..."`
3. R2 objects: `wrangler r2 object list building-vitals-timeseries`
4. Documentation files above

## Success!

You're now running a production-ready Cloudflare Worker with:
- ✅ R2 caching with compression
- ✅ Background queue processing
- ✅ Smart routing
- ✅ Job tracking
- ✅ Analytics

**Happy caching!** 🚀
