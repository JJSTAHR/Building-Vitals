# R2 Object Storage and Cloudflare Queues Integration

## Overview

This integration enhances the Cloudflare Worker with powerful caching and background processing capabilities:

- **R2 Object Storage**: Cache large timeseries datasets with compression
- **Cloudflare Queues**: Process large requests in the background
- **D1 Database**: Track job status and analytics
- **Smart Routing**: Automatically route requests based on data size

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Request                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│            Enhanced Timeseries Service                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Smart Router                                        │   │
│  │  • Small (<1K): Direct fetch                        │   │
│  │  • Medium (<100K): R2 cache                         │   │
│  │  • Large (>100K): Queue job                         │   │
│  └─────────────────────────────────────────────────────┘   │
└───────┬─────────────┬─────────────┬───────────────────────┘
        │             │             │
        ▼             ▼             ▼
   ┌────────┐   ┌────────┐   ┌────────┐
   │ Direct │   │   R2   │   │ Queue  │
   │  API   │   │ Cache  │   │  Job   │
   └────────┘   └────────┘   └────┬───┘
                                   │
                                   ▼
                              ┌────────┐
                              │   D1   │
                              │Database│
                              └────────┘
```

## Components

### 1. R2 Cache Service (`r2-cache-service.js`)

Manages caching of large datasets with compression and metadata tracking.

**Features:**
- Brotli compression (typical 60-80% size reduction)
- Automatic TTL-based expiration
- Cache key generation based on query parameters
- Metadata tracking (points count, samples, compression ratio)
- Cleanup utilities for old entries

**Key Methods:**
```javascript
// Store data in R2
await cacheService.put(key, data, {
  pointsCount: 50,
  samplesCount: 100000
});

// Retrieve from R2
const data = await cacheService.get(key);

// Check if exists
const exists = await cacheService.exists(key);

// Cleanup old entries
const deleted = await cacheService.cleanup(86400); // 24 hours
```

### 2. Queue Service (`queue-service.js`)

Handles background processing of large timeseries requests.

**Features:**
- Async job queuing with priority support
- Job status tracking in D1
- Automatic retry with exponential backoff
- Progress tracking
- Batch processing (50 points per batch)

**Key Methods:**
```javascript
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

Orchestrates all services with intelligent routing.

**Features:**
- Automatic route determination based on data size
- Timeout protection
- Analytics tracking
- Cache management
- Error handling

**Key Methods:**
```javascript
// Fetch with smart routing
const result = await service.fetchTimeseries(
  site,
  points,
  startTime,
  endTime,
  { userId, timeout: 30000 }
);

// Manual route override
const result = await service.fetchTimeseries(
  site,
  points,
  startTime,
  endTime,
  { route: 'cached' }
);
```

## Routing Logic

The service automatically routes requests based on estimated data size:

| Estimated Size | Route | Behavior |
|----------------|-------|----------|
| < 1,000 samples | **Direct** | Immediate API fetch, no caching |
| 1,000 - 100,000 | **Cached** | Check R2 cache, fetch if miss |
| > 100,000 | **Queued** | Background job, poll for status |

**Estimation Formula:**
```javascript
estimatedSamples = pointCount × daysDiff × 100
```

## Setup Instructions

### 1. Create R2 Bucket

```bash
# Create production bucket
wrangler r2 bucket create building-vitals-timeseries

# Create preview bucket
wrangler r2 bucket create building-vitals-timeseries-preview
```

### 2. Create D1 Database

```bash
# Create database
wrangler d1 create building-vitals-db

# Note the database_id and update wrangler.toml

# Initialize schema
wrangler d1 execute building-vitals-db --file=./workers/services/schema.sql
```

### 3. Create Queue

```bash
# Queue is automatically created on first deploy
# Dead letter queue is also created automatically
```

### 4. Deploy Worker

```bash
cd Building-Vitals/workers
wrangler deploy
```

## API Reference

### Fetch Timeseries Data

**Request:**
```http
GET /api/timeseries?site={site}&points={point1,point2}&start_time={iso}&end_time={iso}
```

**Response (Direct/Cached):**
```json
{
  "data": {
    "point1": {
      "samples": [[timestamp, value], ...],
      "count": 1000,
      "error": null
    }
  },
  "_meta": {
    "requestId": "req_...",
    "routeType": "cached",
    "cacheHit": true,
    "duration": 123
  }
}
```

**Response (Queued):**
```json
{
  "status": "queued",
  "jobId": "job_abc123",
  "message": "Your request has been queued...",
  "statusUrl": "/api/jobs/job_abc123",
  "pollInterval": 5000
}
```

### Check Job Status

**Request:**
```http
GET /api/jobs/{jobId}
```

**Response:**
```json
{
  "jobId": "job_abc123",
  "status": "processing",
  "progress": 75,
  "createdAt": "2025-01-31T12:00:00Z",
  "startedAt": "2025-01-31T12:00:05Z",
  "estimatedSize": 250000,
  "samplesCount": 187500
}
```

**Status Values:**
- `queued`: Job is queued, not yet started
- `processing`: Job is actively processing
- `completed`: Job finished successfully
- `failed`: Job failed after retries
- `retrying`: Job failed but will retry
- `cancelled`: Job was cancelled

### Cancel Job

**Request:**
```http
DELETE /api/jobs/{jobId}
```

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled"
}
```

### Get Statistics

**Request:**
```http
GET /api/stats
```

**Response:**
```json
{
  "cache": {
    "totalObjects": 150,
    "totalSizeMB": "245.67",
    "oldestEntry": "2025-01-30T...",
    "newestEntry": "2025-01-31T..."
  },
  "jobs": {
    "total_jobs": 500,
    "completed": 475,
    "failed": 10,
    "active": 15
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

## Performance Characteristics

### R2 Cache Service

- **Write Speed**: ~50-100 MB/s (depends on compression)
- **Read Speed**: ~100-200 MB/s
- **Compression Ratio**: 60-80% size reduction (typical)
- **Cache Hit Latency**: 50-150ms
- **Cache Miss Penalty**: +200-500ms

### Queue Service

- **Queue Latency**: 1-5 seconds (first message)
- **Processing Rate**: 50 points per batch
- **Max Retries**: 3 attempts
- **Retry Backoff**: Exponential (1s, 2s, 4s)
- **Dead Letter Queue**: Automatic after max retries

### Enhanced Timeseries Service

- **Direct Route**: 1-5 seconds (typical)
- **Cached Route**: 0.1-1 seconds (hit), 2-10 seconds (miss)
- **Queued Route**: 5-30 seconds (depends on size)

## Cost Analysis

### R2 Storage

- **Storage**: $0.015/GB/month
- **Class A Operations** (writes): $4.50 per million
- **Class B Operations** (reads): $0.36 per million
- **Egress**: FREE

**Example Cost (1TB cached data, 10M reads/month):**
- Storage: $15/month
- Reads: $3.60/month
- **Total: $18.60/month**

### Cloudflare Queues

- **Free Tier**: 1 million operations/month
- **Paid**: $0.40 per million operations

**Example Cost (500K jobs/month):**
- **Free** (under 1M operations)

### D1 Database

- **Free Tier**: 100K rows read/day, 100K rows written/day
- **Paid**: $0.50 per million rows read, $1.00 per million rows written

**Example Cost (typical usage):**
- **Free** (under limits)

## Monitoring and Debugging

### View Logs

```bash
# Real-time logs
wrangler tail

# Filter by level
wrangler tail --format=pretty --level=error
```

### Query D1 Database

```bash
# Interactive query
wrangler d1 execute building-vitals-db --command="SELECT * FROM queue_jobs WHERE status='failed'"

# Check job performance
wrangler d1 execute building-vitals-db --command="SELECT * FROM v_job_performance"

# Check cache stats
wrangler d1 execute building-vitals-db --command="SELECT * FROM v_cache_performance"
```

### Check R2 Bucket

```bash
# List objects
wrangler r2 object list building-vitals-timeseries

# Get object info
wrangler r2 object info building-vitals-timeseries timeseries/site1/cache_key

# Download object
wrangler r2 object get building-vitals-timeseries timeseries/site1/cache_key --file=./output.json
```

## Best Practices

### 1. Cache Key Design

- Include all query parameters that affect data
- Sort point names for consistent keys
- Use date-based prefixes for easier cleanup

### 2. TTL Settings

- Short TTL (1 hour) for frequently changing data
- Long TTL (24 hours) for historical data
- Invalidate cache on data updates

### 3. Queue Management

- Set appropriate batch sizes (50 points default)
- Monitor dead letter queue for failed jobs
- Archive completed jobs regularly

### 4. Error Handling

- Always handle cache misses gracefully
- Implement circuit breakers for external APIs
- Log errors with context for debugging

### 5. Cost Optimization

- Enable compression to reduce storage costs
- Clean up old cache entries regularly
- Use cache for repeated queries
- Monitor usage with Analytics Engine

## Troubleshooting

### Issue: Cache not working

**Symptoms:** All requests miss cache

**Solutions:**
1. Check R2 bucket exists and is bound correctly
2. Verify cache keys are consistent
3. Check TTL hasn't expired all entries
4. Review logs for R2 errors

### Issue: Jobs stuck in "processing"

**Symptoms:** Jobs never complete

**Solutions:**
1. Check queue consumer is running
2. Review worker logs for errors
3. Verify D1 database is accessible
4. Check API rate limits

### Issue: High latency

**Symptoms:** Slow responses

**Solutions:**
1. Check cache hit rate (should be >70%)
2. Reduce batch size for large jobs
3. Implement request coalescing
4. Use smaller time ranges

## Migration Guide

### From Existing Worker

1. **Add bindings to `wrangler.toml`** (already done)

2. **Import services:**
```javascript
import { EnhancedTimeseriesService } from './services/enhanced-timeseries.js';
```

3. **Update request handler:**
```javascript
const service = new EnhancedTimeseriesService(env);
const result = await service.fetchTimeseries(site, points, start, end);
```

4. **Handle queued responses:**
```javascript
if (result.jobId) {
  // Return 202 Accepted with status URL
  return new Response(JSON.stringify(result), { status: 202 });
}
```

5. **Deploy and test:**
```bash
wrangler deploy
curl "https://your-worker.workers.dev/api/timeseries?site=test&..."
```

## Future Enhancements

- [ ] Add MessagePack format support for smaller payloads
- [ ] Implement request coalescing for duplicate requests
- [ ] Add WebSocket support for real-time job updates
- [ ] Support partial cache hits (cache individual points)
- [ ] Implement predictive caching based on usage patterns
- [ ] Add cache warming for frequently accessed data
- [ ] Support distributed locking for concurrent requests
- [ ] Add rate limiting per user/site

## Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
