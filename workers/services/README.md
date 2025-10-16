# Worker Services

Modular services for Cloudflare Worker with R2 caching and Queue processing.

## Services Overview

### 1. R2 Cache Service (`r2-cache-service.js`)

Manages caching of large timeseries datasets in Cloudflare R2 Object Storage.

**Features:**
- Brotli/Gzip compression for efficient storage
- TTL-based cache invalidation
- Metadata tracking (points, samples, compression ratio)
- Automatic cleanup utilities
- Cache statistics

**Usage:**
```javascript
import { R2CacheService } from './r2-cache-service.js';

const cacheService = new R2CacheService(env.TIMESERIES_CACHE, {
  defaultTTL: 3600,      // 1 hour
  maxCacheAge: 86400,    // 24 hours
  compression: true      // Enable compression
});

// Store data
await cacheService.put(key, data, {
  pointsCount: 50,
  samplesCount: 100000
});

// Retrieve data
const cached = await cacheService.get(key);

// Check existence
const exists = await cacheService.exists(key);

// Cleanup old entries
await cacheService.cleanup(86400);
```

### 2. Queue Service (`queue-service.js`)

Handles background processing of large timeseries requests using Cloudflare Queues.

**Features:**
- Async job queuing with priority support
- Job status tracking in D1 database
- Automatic retry with exponential backoff
- Progress tracking
- Batch processing (configurable batch size)

**Usage:**
```javascript
import { ChartQueueService } from './queue-service.js';

const queueService = new ChartQueueService(env.CHART_QUEUE, env.DB, {
  maxRetries: 3,
  batchSize: 50
});

// Queue a large request
const jobId = await queueService.queueLargeRequest(
  jobId,
  site,
  points,
  startTime,
  endTime,
  userId
);

// Check job status
const status = await queueService.getJobStatus(jobId);

// Cancel job
await queueService.cancelJob(jobId);
```

### 3. Enhanced Timeseries Service (`enhanced-timeseries.js`)

Orchestrates all services with intelligent routing based on request size.

**Features:**
- Smart routing (direct, cached, or queued)
- Automatic size estimation
- Timeout protection
- Analytics tracking
- Error handling

**Usage:**
```javascript
import { EnhancedTimeseriesService } from './enhanced-timeseries.js';

const service = new EnhancedTimeseriesService(env, {
  smallThreshold: 1000,     // Direct fetch threshold
  largeThreshold: 100000,   // Queue threshold
  directTimeout: 30000,     // 30 seconds
  cacheTimeout: 5000        // 5 seconds
});

// Fetch with smart routing
const result = await service.fetchTimeseries(
  site,
  points,
  startTime,
  endTime,
  { userId, timeout: 30000 }
);

// Handle response
if (result.jobId) {
  // Queued - poll for status
  console.log('Job queued:', result.jobId);
} else {
  // Direct or cached - data available
  console.log('Data:', result.data);
  console.log('Cache hit:', result._meta.cacheHit);
}
```

## Routing Logic

The Enhanced Timeseries Service automatically routes requests:

| Estimated Size | Route | Description |
|----------------|-------|-------------|
| < 1,000 | **Direct** | Immediate fetch, no caching |
| 1,000 - 100,000 | **Cached** | Check R2, fetch if miss |
| > 100,000 | **Queued** | Background job, poll status |

**Size Estimation:**
```
estimatedSamples = pointCount × daysDiff × 100
```

## Database Schema

The D1 database schema (`schema.sql`) includes:

**Tables:**
- `queue_jobs` - Job status and metadata
- `job_history` - Completed/failed job archive
- `cache_metadata` - R2 cache tracking
- `request_analytics` - Performance metrics

**Views:**
- `v_active_jobs` - Currently processing jobs
- `v_job_performance` - Job statistics by site
- `v_cache_performance` - Cache hit rates and compression
- `v_request_stats` - Request analytics by route type

## Example Worker

See `ai-enhanced-worker-example.js` for a complete worker implementation that demonstrates:

- Request routing
- CORS handling
- Job status endpoints
- Statistics endpoints
- Scheduled cleanup tasks
- Queue consumer implementation

## Configuration

### Environment Bindings

Required in `wrangler.toml`:

```toml
# R2 Bucket for caching
[[r2_buckets]]
binding = "TIMESERIES_CACHE"
bucket_name = "building-vitals-timeseries"

# D1 Database for job tracking
[[d1_databases]]
binding = "DB"
database_name = "building-vitals-db"
database_id = "YOUR_DATABASE_ID"

# Queue for background processing
[[queues.producers]]
binding = "CHART_QUEUE"
queue = "chart-processing-queue"

[[queues.consumers]]
queue = "chart-processing-queue"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3

# Analytics Engine
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "paginated_timeseries_metrics"
```

### Service Options

**R2 Cache Service:**
```javascript
{
  defaultTTL: 3600,        // Cache TTL in seconds
  maxCacheAge: 86400,      // Max age before cleanup
  compression: true        // Enable compression (gzip)
}
```

**Queue Service:**
```javascript
{
  maxRetries: 3,           // Max retry attempts
  retryDelay: 1000,        // Base delay in ms
  batchSize: 50            // Max points per batch
}
```

**Enhanced Timeseries Service:**
```javascript
{
  smallThreshold: 1000,    // Direct fetch threshold
  largeThreshold: 100000,  // Queue threshold
  directTimeout: 30000,    // Direct fetch timeout (ms)
  cacheTimeout: 5000       // Cache check timeout (ms)
}
```

## Testing

Run integration tests:

```bash
npm test -- tests/workers-r2-queue-integration.test.js
```

Tests cover:
- R2 cache operations
- Queue job lifecycle
- Smart routing logic
- Error handling
- Performance characteristics

## Deployment

### Quick Start

**Windows:**
```cmd
cd scripts
setup-cloudflare-services.cmd
```

**Linux/Mac:**
```bash
cd scripts
chmod +x setup-cloudflare-services.sh
./setup-cloudflare-services.sh
```

### Manual Deployment

1. Create R2 buckets:
   ```bash
   wrangler r2 bucket create building-vitals-timeseries
   ```

2. Create D1 database:
   ```bash
   wrangler d1 create building-vitals-db
   ```

3. Initialize schema:
   ```bash
   wrangler d1 execute building-vitals-db --file=./schema.sql
   ```

4. Deploy worker:
   ```bash
   wrangler deploy
   ```

## Monitoring

### Logs
```bash
wrangler tail --format=pretty
```

### Database Queries
```bash
# Active jobs
wrangler d1 execute building-vitals-db --command="SELECT * FROM v_active_jobs"

# Cache stats
wrangler d1 execute building-vitals-db --command="SELECT * FROM v_cache_performance"
```

### R2 Objects
```bash
# List cached objects
wrangler r2 object list building-vitals-timeseries --prefix="timeseries/"

# Get object info
wrangler r2 object info building-vitals-timeseries timeseries/site1/key.json
```

## Performance

### R2 Cache
- **Write**: ~50-100 MB/s
- **Read**: ~100-200 MB/s
- **Compression**: 60-80% size reduction
- **Latency**: 50-150ms (hit), +200-500ms (miss)

### Queue
- **Latency**: 1-5 seconds (first message)
- **Throughput**: 50 points/batch
- **Retry Backoff**: Exponential (1s, 2s, 4s)

### Timeseries Service
- **Direct**: 1-5 seconds
- **Cached**: 0.1-1 seconds (hit), 2-10 seconds (miss)
- **Queued**: 5-30 seconds (depends on size)

## Cost Optimization

**R2 Storage:**
- Enable compression (reduces by 60-80%)
- Clean up old entries regularly
- Use appropriate TTLs

**Queues:**
- Batch similar requests
- Monitor dead letter queue
- Archive completed jobs

**D1 Database:**
- Clean up old analytics
- Archive job history
- Use views for efficient queries

## Troubleshooting

### Cache Not Working
1. Check R2 bucket exists
2. Verify binding name matches
3. Review cache key generation
4. Check TTL settings

### Jobs Stuck
1. Check queue consumer running
2. Review worker logs
3. Verify D1 database accessible
4. Check API rate limits

### High Latency
1. Monitor cache hit rate (>70% ideal)
2. Reduce batch size
3. Implement request coalescing
4. Optimize time ranges

## Documentation

- [R2 & Queue Integration Guide](../../docs/R2_QUEUE_INTEGRATION.md)
- [Deployment Guide](../../docs/DEPLOYMENT_GUIDE_R2_QUEUE.md)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [R2 Storage](https://developers.cloudflare.com/r2/)
- [Queues](https://developers.cloudflare.com/queues/)
- [D1 Database](https://developers.cloudflare.com/d1/)
