# Deployment Guide: R2 and Queue Integration

This guide walks through deploying the enhanced Cloudflare Worker with R2 caching and Queue processing capabilities.

## Prerequisites

1. **Cloudflare Account** with Workers enabled
2. **Wrangler CLI** installed globally:
   ```bash
   npm install -g wrangler
   ```
3. **Authenticated** with Cloudflare:
   ```bash
   wrangler login
   ```

## Quick Start (Automated)

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

The automated script will:
- ✅ Create R2 buckets (production and preview)
- ✅ Create D1 database
- ✅ Initialize database schema
- ✅ Configure queues
- ✅ Deploy worker

## Manual Setup (Step by Step)

### Step 1: Create R2 Buckets

R2 buckets store cached timeseries datasets with compression.

```bash
# Navigate to worker directory
cd Building-Vitals/workers

# Create production bucket
wrangler r2 bucket create building-vitals-timeseries

# Create preview bucket (for development)
wrangler r2 bucket create building-vitals-timeseries-preview

# Verify buckets
wrangler r2 bucket list
```

**Expected output:**
```
building-vitals-timeseries
building-vitals-timeseries-preview
```

### Step 2: Create D1 Database

D1 database tracks job status, cache metadata, and analytics.

```bash
# Create database
wrangler d1 create building-vitals-db
```

**Expected output:**
```
✅ Successfully created DB 'building-vitals-db'!

[[d1_databases]]
binding = "DB"
database_name = "building-vitals-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**⚠️ Important:** Copy the `database_id` and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "building-vitals-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Paste the ID here
```

### Step 3: Initialize Database Schema

Load the database schema with tables and views.

```bash
# From workers directory
wrangler d1 execute building-vitals-db --file=../services/schema.sql
```

**Expected output:**
```
🌀 Executing on building-vitals-db (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx):
🚣 Executed 15 statements in 0.23 seconds.
```

**Verify tables:**
```bash
wrangler d1 execute building-vitals-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

You should see:
- `queue_jobs`
- `job_history`
- `cache_metadata`
- `request_analytics`

### Step 4: Configure Queues

Queues are automatically created on first deploy. No manual setup needed!

The configuration in `wrangler.toml` defines:
- **Producer**: `CHART_QUEUE` binding
- **Consumer**: Processes messages in batches
- **Dead Letter Queue**: `chart-processing-dlq` for failed messages

### Step 5: Deploy Worker

Deploy the worker with all services configured.

```bash
# From workers directory
wrangler deploy
```

**Expected output:**
```
⛅️ wrangler 3.x.x
------------------
Your worker has been deployed!
  https://ace-iot-proxy.YOUR_ACCOUNT.workers.dev
```

**Verify deployment:**
```bash
curl https://YOUR_WORKER_URL/api/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-31T12:00:00Z"
}
```

## Testing the Deployment

### 1. Test Direct Fetch (Small Request)

```bash
curl "https://YOUR_WORKER_URL/api/timeseries?site=test_site&points=point1&start_time=2025-01-01T00:00:00Z&end_time=2025-01-02T00:00:00Z"
```

**Expected:** Immediate response with data

### 2. Test Cached Fetch (Medium Request)

```bash
# First request (cache miss)
curl "https://YOUR_WORKER_URL/api/timeseries?site=test_site&points=point1,point2,point3&start_time=2025-01-01T00:00:00Z&end_time=2025-01-15T00:00:00Z"

# Second request (cache hit - should be faster)
curl "https://YOUR_WORKER_URL/api/timeseries?site=test_site&points=point1,point2,point3&start_time=2025-01-01T00:00:00Z&end_time=2025-01-15T00:00:00Z"
```

**Check response headers:**
- `X-Cache-Hit: true` (second request)
- `X-Route-Type: cached`
- `X-Request-Duration: <ms>`

### 3. Test Queued Fetch (Large Request)

```bash
# Queue a large request
curl "https://YOUR_WORKER_URL/api/timeseries?site=test_site&points=$(seq -s, 1 50 | sed 's/,/,point/g' | sed 's/^/point/')&start_time=2025-01-01T00:00:00Z&end_time=2025-12-31T00:00:00Z"
```

**Expected response (202 Accepted):**
```json
{
  "status": "queued",
  "jobId": "job_abc123",
  "message": "Your request has been queued...",
  "statusUrl": "/api/jobs/job_abc123",
  "pollInterval": 5000
}
```

**Check job status:**
```bash
curl "https://YOUR_WORKER_URL/api/jobs/job_abc123"
```

### 4. Test Statistics

```bash
curl "https://YOUR_WORKER_URL/api/stats"
```

**Expected response:**
```json
{
  "cache": {
    "totalObjects": 5,
    "totalSizeMB": "12.34"
  },
  "jobs": {
    "total_jobs": 10,
    "completed": 8,
    "failed": 1,
    "active": 1
  },
  "requests": [...]
}
```

## Monitoring

### Real-time Logs

```bash
# View all logs
wrangler tail

# Pretty format with colors
wrangler tail --format=pretty

# Filter by log level
wrangler tail --format=pretty --level=error
```

### Query D1 Database

```bash
# Active jobs
wrangler d1 execute building-vitals-db --command="SELECT * FROM v_active_jobs"

# Job performance by site
wrangler d1 execute building-vitals-db --command="SELECT * FROM v_job_performance"

# Cache performance
wrangler d1 execute building-vitals-db --command="SELECT * FROM v_cache_performance"

# Recent requests
wrangler d1 execute building-vitals-db --command="SELECT * FROM request_analytics ORDER BY timestamp DESC LIMIT 10"
```

### R2 Bucket Management

```bash
# List cached objects
wrangler r2 object list building-vitals-timeseries --prefix="timeseries/"

# Get object metadata
wrangler r2 object info building-vitals-timeseries timeseries/site1/cache_key.json

# Download cached object
wrangler r2 object get building-vitals-timeseries timeseries/site1/cache_key.json --file=./output.json
```

### Queue Monitoring

```bash
# View queue configuration
wrangler queues list

# Check dead letter queue
wrangler queues consumer list chart-processing-dlq
```

## Scheduled Cleanup (Optional)

Add a scheduled trigger to clean up old data automatically.

**Add to `wrangler.toml`:**
```toml
[triggers]
crons = ["0 2 * * *"]  # Run at 2 AM daily
```

**The worker's `scheduled` handler will:**
- Delete old cache entries (>24 hours)
- Archive completed jobs (>7 days)
- Clean up analytics (>30 days)

## Rollback Procedure

If issues occur, quickly rollback:

```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback [VERSION_ID]
```

## Troubleshooting

### Issue: Database ID not found

**Symptoms:** Error: `Unknown database: building-vitals-db`

**Solution:**
1. Check `wrangler.toml` has correct `database_id`
2. Verify database exists: `wrangler d1 list`
3. Update `database_id` in `wrangler.toml`
4. Redeploy: `wrangler deploy`

### Issue: R2 bucket not accessible

**Symptoms:** Error: `R2 bucket not found`

**Solution:**
1. Verify bucket exists: `wrangler r2 bucket list`
2. Check binding name in `wrangler.toml` matches code
3. Ensure account has R2 enabled

### Issue: Queue not processing

**Symptoms:** Jobs stuck in "queued" status

**Solution:**
1. Check worker logs: `wrangler tail`
2. Verify queue consumer is configured in `wrangler.toml`
3. Check for errors in D1 database
4. Manually retry: Update job status to "pending"

### Issue: High costs

**Symptoms:** Unexpected R2/Queue charges

**Solution:**
1. Check cache hit rate: `curl /api/stats`
2. Reduce TTL to clean up faster
3. Implement request rate limiting
4. Monitor with Analytics Engine

## Performance Tuning

### Optimize Cache Hit Rate

```javascript
// Increase TTL for historical data
const service = new EnhancedTimeseriesService(env, {
  cache: {
    defaultTTL: 3600,     // 1 hour
    maxCacheAge: 86400    // 24 hours
  }
});
```

### Adjust Routing Thresholds

```javascript
// Route more requests to cache
const service = new EnhancedTimeseriesService(env, {
  smallThreshold: 500,      // Lower = more cached
  largeThreshold: 50000     // Lower = more queued
});
```

### Increase Queue Batch Size

```toml
[[queues.consumers]]
queue = "chart-processing-queue"
max_batch_size = 20        # Process more messages together
max_batch_timeout = 60     # Wait longer for full batch
```

## Security Considerations

1. **Add Authentication:**
   ```javascript
   // Check API key
   const apiKey = request.headers.get('X-API-Key');
   if (apiKey !== env.API_KEY) {
     return new Response('Unauthorized', { status: 401 });
   }
   ```

2. **Rate Limiting:**
   ```javascript
   // Use Durable Objects or KV for rate limiting
   const rateLimiter = new RateLimiter(env.RATE_LIMITER);
   if (await rateLimiter.isLimited(userId)) {
     return new Response('Too Many Requests', { status: 429 });
   }
   ```

3. **Input Validation:**
   ```javascript
   // Validate date ranges
   if (new Date(endTime) < new Date(startTime)) {
     return new Response('Invalid date range', { status: 400 });
   }
   ```

## Next Steps

1. **Frontend Integration:** Update frontend to handle queued responses
2. **WebSocket Notifications:** Add real-time job updates
3. **Cache Warming:** Pre-cache popular queries
4. **Advanced Analytics:** Implement usage tracking dashboard

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Queues Documentation](https://developers.cloudflare.com/queues/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Project Documentation](./R2_QUEUE_INTEGRATION.md)
