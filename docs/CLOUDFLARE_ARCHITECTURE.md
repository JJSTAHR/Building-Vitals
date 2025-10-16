# Cloudflare Worker Architecture - Major Enhancement Design

## Executive Summary

This document defines the comprehensive architecture for integrating four major enhancements into the existing Cloudflare Worker that proxies the ACE IoT API. The design ensures backwards compatibility, zero-downtime deployment, and optimal performance within Cloudflare's free tier constraints.

**Enhancement Overview:**
1. **R2 Object Storage** - Cache large timeseries datasets (365-day queries)
2. **D1 Database** - SQLite at edge for aggregations and configurations
3. **MessagePack** - Binary data transfer (60% payload reduction)
4. **Queues** - Background processing for large requests

**Key Metrics:**
- 60-80% reduction in payload size
- 90% faster loading for cached datasets
- Handle 365-day, 50-point requests without timeout
- 100% backwards compatible
- Zero downtime deployment

---

## 1. High-Level Architecture

### 1.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                            │
│                                                                           │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐                     │
│  │  ECharts   │  │  TypeScript  │  │ MessagePack │                     │
│  │  Renderer  │  │   Frontend   │  │   Decoder   │                     │
│  └─────┬──────┘  └──────┬───────┘  └──────┬──────┘                     │
│        │                 │                  │                            │
└────────┼─────────────────┼──────────────────┼────────────────────────────┘
         │                 │                  │
         │    Accept: application/x-msgpack OR application/json
         │                 │                  │
         └─────────────────┴──────────────────┘
                           │
                  HTTPS Request
                           │
         ┌─────────────────▼──────────────────┐
         │                                     │
┌────────┴─────────────────────────────────────┴────────┐
│          CLOUDFLARE EDGE NETWORK                      │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │          CACHE API (Edge Cache)              │    │
│  │  • Stale-while-revalidate                    │    │
│  │  • TTL: 5-10 minutes                         │    │
│  │  • Popular time ranges                       │    │
│  └──────────────┬───────────────────────────────┘    │
│                 │                                     │
│  ┌──────────────▼───────────────────────────────┐    │
│  │         CLOUDFLARE WORKER                    │    │
│  │                                              │    │
│  │  ┌────────────────────────────────────┐     │    │
│  │  │  Request Router & Orchestrator     │     │    │
│  │  │  • Analyze request size            │     │    │
│  │  │  • Check content negotiation       │     │    │
│  │  │  • Route to appropriate handler    │     │    │
│  │  └────────────┬───────────────────────┘     │    │
│  │               │                              │    │
│  │  ┌────────────▼───────────────────────┐     │    │
│  │  │  Small Request Handler             │     │    │
│  │  │  (< 1K points, < 7 days)           │     │    │
│  │  │  • Direct fetch from ACE API       │     │    │
│  │  │  • Transform inline                │     │    │
│  │  │  • Return JSON/MessagePack         │     │    │
│  │  └─────────────────────────────────────┘    │    │
│  │                                              │    │
│  │  ┌────────────────────────────────────┐     │    │
│  │  │  Medium Request Handler            │     │    │
│  │  │  (1K-100K points, 7-90 days)       │     │    │
│  │  │  • Check R2 cache                  │     │    │
│  │  │  • Check D1 aggregations           │     │    │
│  │  │  • Fetch if miss                   │     │    │
│  │  │  • Store in R2                     │     │    │
│  │  │  • Return binary if requested      │     │    │
│  │  └─────────────────────────────────────┘    │    │
│  │                                              │    │
│  │  ┌────────────────────────────────────┐     │    │
│  │  │  Large Request Handler             │     │    │
│  │  │  (> 100K points, > 90 days)        │     │    │
│  │  │  • Queue background job            │     │    │
│  │  │  • Return jobId immediately        │     │    │
│  │  │  • Notify when complete            │     │    │
│  │  └─────────────────────────────────────┘    │    │
│  │                                              │    │
│  └──┬──────────┬──────────┬──────────┬─────────┘    │
│     │          │          │          │              │
└─────┼──────────┼──────────┼──────────┼──────────────┘
      │          │          │          │
┌─────▼──┐  ┌───▼────┐  ┌──▼────┐  ┌─▼────────┐
│ KV     │  │ R2     │  │ D1    │  │ Queues   │
│ Store  │  │ Bucket │  │ DB    │  │          │
└────────┘  └────────┘  └───────┘  └──┬───────┘
                                       │
                                  ┌────▼─────┐
                                  │  Queue   │
                                  │ Consumer │
                                  └────┬─────┘
                                       │
┌──────────────────────────────────────┼──────────────┐
│              ACE IoT API             │              │
│                                      │              │
│  ┌──────────────────────────────┐   │              │
│  │  /his/read Endpoint          │◄──┘              │
│  │  (Paginated Timeseries)      │                  │
│  └──────────────────────────────┘                  │
│                                                     │
│  ┌──────────────────────────────┐                  │
│  │  /configured_points          │                  │
│  │  (Point Metadata)            │                  │
│  └──────────────────────────────┘                  │
└─────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Patterns

#### Pattern 1: Small Request (< 1K points, < 7 days)
```
Client → Worker → Edge Cache Check
                → Cache Miss
                → ACE API Direct Fetch
                → Transform {name,value,time} → [ts,val]
                → Binary/JSON Response
                → Cache for 5min
```

**Response Time:** 200-500ms
**Use Case:** Real-time monitoring, recent data queries

#### Pattern 2: Medium Request (1K-100K points, 7-90 days)
```
Client → Worker → Edge Cache Check (Miss)
                → R2 Cache Check
                → D1 Aggregation Check
                ┌─ R2 Hit: Return cached data (10ms)
                │
                └─ R2 Miss:
                   → ACE API Paginated Fetch
                   → Transform & Aggregate
                   → Store in R2 (TTL: 1 hour)
                   → Update D1 aggregations
                   → Binary/JSON Response
                   → Edge Cache (5-10min)
```

**Response Time:** 10-50ms (cached), 2-5s (uncached)
**Use Case:** Historical analysis, trend charts

#### Pattern 3: Large Request (> 100K points, > 90 days)
```
Client → Worker → Queue Job Creation
                → Return jobId + 202 Accepted

Background Queue Consumer:
  → Fetch paginated data (multiple requests)
  → Transform & aggregate in chunks
  → Store complete dataset in R2
  → Update D1 with aggregations
  → Notify client (WebSocket/Polling)

Client → Worker → Job Status Check
                → R2 Fetch completed data
                → Binary/JSON Response
```

**Response Time:** Immediate (jobId), 30-120s (processing)
**Use Case:** 365-day reports, bulk exports

---

## 2. Component Design

### 2.1 R2 Object Storage

#### Bucket Structure
```
chart-data/
├── timeseries/
│   ├── {siteId}/
│   │   ├── {year}/
│   │   │   ├── {pointNames-hash}-raw.msgpack
│   │   │   ├── {pointNames-hash}-1min.msgpack
│   │   │   ├── {pointNames-hash}-5min.msgpack
│   │   │   ├── {pointNames-hash}-1hr.msgpack
│   │   │   └── {pointNames-hash}-1day.msgpack
│   │   └── metadata.json
│   └── index.json
├── exports/
│   ├── {jobId}/
│   │   ├── data.msgpack
│   │   ├── data.json
│   │   ├── data.csv
│   │   └── metadata.json
└── charts/
    └── {chartId}/
        ├── config.json
        └── thumbnail.png
```

#### Naming Conventions
```javascript
// Hash point names for consistent keys
function generateCacheKey(siteId, pointNames, startTime, endTime, aggregation = 'raw') {
  const pointsHash = hashPoints(pointNames); // SHA-256 first 8 chars
  const dateRange = `${formatDate(startTime)}_${formatDate(endTime)}`;
  return `timeseries/${siteId}/${getYear(startTime)}/${pointsHash}-${aggregation}.msgpack`;
}

// Example: timeseries/ses_falls_city/2025/a3f8d1c2-raw.msgpack
```

#### Storage Strategy
- **Raw Data:** Store for 1 hour (frequently accessed)
- **Aggregations:** Store for 24 hours (less volatile)
- **Exports:** Store for 7 days (user downloads)
- **Charts:** Store permanently (small metadata)

#### Metadata Format
```json
{
  "key": "timeseries/ses_falls_city/2025/a3f8d1c2-raw.msgpack",
  "pointNames": ["VAV-707-DaTemp", "VAV-707-Damper"],
  "siteId": "ses_falls_city",
  "startTime": "2025-01-01T00:00:00Z",
  "endTime": "2025-12-31T23:59:59Z",
  "totalPoints": 50,
  "totalSamples": 876000,
  "aggregation": "raw",
  "format": "messagepack",
  "compression": "brotli",
  "createdAt": "2025-10-12T12:00:00Z",
  "expiresAt": "2025-10-12T13:00:00Z",
  "sizeBytes": 2457600
}
```

### 2.2 D1 Database Schema

```sql
-- ============================================
-- TIMESERIES AGGREGATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS timeseries_aggregations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL,
  point_name TEXT NOT NULL,
  aggregation_level TEXT NOT NULL, -- '1min', '5min', '1hr', '1day'
  timestamp INTEGER NOT NULL, -- Unix timestamp
  avg_value REAL,
  min_value REAL,
  max_value REAL,
  sum_value REAL,
  count INTEGER,
  stddev REAL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(site_id, point_name, aggregation_level, timestamp)
) WITHOUT ROWID;

CREATE INDEX idx_agg_lookup ON timeseries_aggregations(
  site_id, point_name, aggregation_level, timestamp
);

CREATE INDEX idx_agg_time ON timeseries_aggregations(
  timestamp, aggregation_level
);

-- ============================================
-- CHART CONFIGURATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chart_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  chart_type TEXT NOT NULL, -- 'line', 'bar', 'scatter', 'heatmap'
  title TEXT,
  point_names TEXT NOT NULL, -- JSON array
  config_json TEXT NOT NULL, -- Full ECharts config
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_chart_user ON chart_configs(user_id, created_at);
CREATE INDEX idx_chart_site ON chart_configs(site_id, is_public);
CREATE INDEX idx_chart_popular ON chart_configs(view_count DESC);

-- ============================================
-- CACHE METADATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cache_metadata (
  cache_key TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  point_names TEXT NOT NULL, -- JSON array
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  aggregation TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER,
  sample_count INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_cache_expiry ON cache_metadata(expires_at);
CREATE INDEX idx_cache_site ON cache_metadata(site_id, start_time);
CREATE INDEX idx_cache_popular ON cache_metadata(hit_count DESC);

-- ============================================
-- QUEUE JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS queue_jobs (
  job_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  point_names TEXT NOT NULL, -- JSON array
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  job_type TEXT NOT NULL, -- 'large_query', 'export', 'aggregation'
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0, -- 0-100
  result_key TEXT, -- R2 key when completed
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  started_at INTEGER,
  completed_at INTEGER,
  estimated_duration INTEGER
);

CREATE INDEX idx_job_user ON queue_jobs(user_id, created_at DESC);
CREATE INDEX idx_job_status ON queue_jobs(status, created_at);

-- ============================================
-- POINT METADATA TABLE (Enhanced from KV)
-- ============================================
CREATE TABLE IF NOT EXISTS point_metadata (
  site_id TEXT NOT NULL,
  point_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  equipment TEXT,
  equipment_id TEXT,
  equipment_name TEXT,
  point_type TEXT,
  unit TEXT,
  marker_tags TEXT, -- JSON array
  quality_score INTEGER,
  ai_insights TEXT, -- JSON object
  last_updated INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (site_id, point_name)
) WITHOUT ROWID;

CREATE INDEX idx_point_equipment ON point_metadata(site_id, equipment);
CREATE INDEX idx_point_type ON point_metadata(point_type);
CREATE INDEX idx_point_quality ON point_metadata(quality_score DESC);
```

### 2.3 Queue Architecture

#### Message Format
```javascript
// Queue Message Schema
interface QueueMessage {
  jobId: string;
  userId: string;
  siteId: string;
  pointNames: string[];
  startTime: string; // ISO 8601
  endTime: string;
  aggregation?: '1min' | '5min' | '1hr' | '1day' | 'raw';
  format?: 'json' | 'msgpack' | 'csv';
  priority: 'low' | 'normal' | 'high';
  estimatedSamples: number;
  createdAt: string;
  metadata?: {
    chartType?: string;
    exportType?: string;
    notifyUrl?: string;
  };
}
```

#### Consumer Architecture
```javascript
// Queue Consumer Handler
export default {
  async queue(batch, env) {
    // Process up to 100 messages in parallel
    await Promise.allSettled(
      batch.messages.map(msg => processJob(msg, env))
    );
  }
};

async function processJob(message, env) {
  const job = message.body;

  // Update job status
  await updateJobStatus(env.DB, job.jobId, 'processing');

  try {
    // Fetch paginated data
    const data = await fetchPaginatedTimeseries(
      job.siteId,
      job.pointNames,
      job.startTime,
      job.endTime,
      (progress) => updateJobProgress(env.DB, job.jobId, progress)
    );

    // Transform and aggregate
    const transformed = transformData(data);
    const aggregated = aggregateData(transformed, job.aggregation);

    // Store in R2
    const r2Key = await storeInR2(env.R2, job, aggregated);

    // Update D1 with aggregations
    await storeAggregations(env.DB, job, aggregated);

    // Mark complete
    await updateJobStatus(env.DB, job.jobId, 'completed', r2Key);

    // Notify user (if webhook provided)
    if (job.metadata?.notifyUrl) {
      await fetch(job.metadata.notifyUrl, {
        method: 'POST',
        body: JSON.stringify({ jobId: job.jobId, status: 'completed' })
      });
    }

    message.ack();
  } catch (error) {
    await updateJobStatus(env.DB, job.jobId, 'failed', null, error.message);
    message.retry();
  }
}
```

### 2.4 MessagePack Integration

#### Encoding Strategy
```javascript
import msgpack from '@msgpack/msgpack';

// Binary format for timeseries
interface BinaryTimeseriesFormat {
  version: 1;
  metadata: {
    siteId: string;
    pointNames: string[];
    startTime: number; // Unix timestamp
    endTime: number;
    aggregation: string;
    totalSamples: number;
  };
  series: {
    [pointName: string]: Array<[number, number]>; // [timestamp, value]
  };
}

// Encode to binary
function encodeToBinary(data: TimeseriesData): Uint8Array {
  const binaryData: BinaryTimeseriesFormat = {
    version: 1,
    metadata: {
      siteId: data.siteId,
      pointNames: data.series.map(s => s.name),
      startTime: data.startTime,
      endTime: data.endTime,
      aggregation: data.aggregation || 'raw',
      totalSamples: data.series.reduce((sum, s) => sum + s.data.length, 0)
    },
    series: Object.fromEntries(
      data.series.map(s => [s.name, s.data])
    )
  };

  return msgpack.encode(binaryData);
}

// Content negotiation
function shouldUseBinary(request: Request): boolean {
  const accept = request.headers.get('Accept');
  return accept?.includes('application/x-msgpack') ||
         request.url.includes('format=binary');
}
```

---

## 3. Caching Strategy

### 3.1 Multi-Tier Cache Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  CACHE HIERARCHY                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  L1: Edge Cache (Cloudflare CDN)                           │
│  ├─ TTL: 5-10 minutes                                      │
│  ├─ Coverage: Popular queries, recent data                 │
│  ├─ Hit Rate: 60-70%                                       │
│  └─ Latency: 5-20ms                                        │
│                                                             │
│  L2: KV Storage (Point Metadata)                           │
│  ├─ TTL: 24 hours                                          │
│  ├─ Coverage: Point names, display names, metadata         │
│  ├─ Hit Rate: 95%+                                         │
│  └─ Latency: 10-50ms                                       │
│                                                             │
│  L3: D1 Database (Aggregations)                            │
│  ├─ TTL: Persistent                                        │
│  ├─ Coverage: Pre-computed aggregations (1min-1day)        │
│  ├─ Hit Rate: 80%                                          │
│  └─ Latency: 5-10ms (edge query)                          │
│                                                             │
│  L4: R2 Storage (Large Datasets)                           │
│  ├─ TTL: 1-24 hours                                        │
│  ├─ Coverage: 365-day queries, exports                     │
│  ├─ Hit Rate: 40-50%                                       │
│  └─ Latency: 20-100ms                                      │
│                                                             │
│  L5: ACE IoT API (Origin)                                  │
│  └─ Fallback for cache misses                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Cache Decision Logic

```javascript
async function getCachedOrFetch(request, env) {
  const { siteId, pointNames, startTime, endTime, aggregation } = parseRequest(request);
  const estimatedSamples = estimateSampleCount(pointNames.length, startTime, endTime);

  // L1: Edge Cache (automatic via Cache-Control headers)
  const edgeCached = await caches.default.match(request);
  if (edgeCached) return edgeCached;

  // L2: KV (Point metadata only)
  const pointMetadata = await getPointMetadata(env.KV, siteId, pointNames);

  // L3: D1 Aggregations (if requesting aggregated data)
  if (aggregation && aggregation !== 'raw') {
    const d1Cached = await getAggregatedData(env.DB, siteId, pointNames, startTime, endTime, aggregation);
    if (d1Cached) {
      return formatResponse(d1Cached, request, 'D1');
    }
  }

  // L4: R2 (Large datasets)
  if (estimatedSamples > 10000) {
    const cacheKey = generateCacheKey(siteId, pointNames, startTime, endTime, aggregation);
    const r2Cached = await env.R2.get(cacheKey);

    if (r2Cached) {
      // Update hit count in D1
      await incrementCacheHit(env.DB, cacheKey);
      return formatResponse(r2Cached, request, 'R2');
    }
  }

  // L5: Origin fetch
  return fetchFromOrigin(env, siteId, pointNames, startTime, endTime, aggregation);
}
```

### 3.3 Cache Invalidation Strategy

```javascript
// Invalidation triggers
const INVALIDATION_TRIGGERS = {
  // Real-time data: Invalidate edge cache every 5 minutes
  realtime: {
    edgeCache: 300, // 5 minutes
    r2Cache: null,  // Don't cache
    d1Cache: null
  },

  // Recent data (last 7 days): Short TTL
  recent: {
    edgeCache: 600, // 10 minutes
    r2Cache: 3600,  // 1 hour
    d1Cache: null   // Use for aggregations only
  },

  // Historical data (> 7 days): Long TTL
  historical: {
    edgeCache: 3600,  // 1 hour
    r2Cache: 86400,   // 24 hours
    d1Cache: 604800   // 7 days (for aggregations)
  },

  // Archived data (> 90 days): Very long TTL
  archived: {
    edgeCache: 86400,   // 24 hours
    r2Cache: 2592000,   // 30 days
    d1Cache: 'permanent' // Never expire aggregations
  }
};

function determineDataAge(endTime) {
  const now = Date.now();
  const daysSince = (now - new Date(endTime).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince < 1) return 'realtime';
  if (daysSince < 7) return 'recent';
  if (daysSince < 90) return 'historical';
  return 'archived';
}
```

---

## 4. Performance Optimization

### 4.1 Request Size Classification

```javascript
function classifyRequest(pointNames, startTime, endTime) {
  const points = pointNames.length;
  const days = (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60 * 24);
  const estimatedSamples = points * days * 1440; // Assume 1-minute samples

  if (estimatedSamples < 1000 || days < 1) {
    return {
      size: 'small',
      handler: 'direct',
      timeout: 5000,
      cacheStrategy: 'edge-only'
    };
  }

  if (estimatedSamples < 100000 || days < 30) {
    return {
      size: 'medium',
      handler: 'cached',
      timeout: 15000,
      cacheStrategy: 'edge-r2-d1'
    };
  }

  return {
    size: 'large',
    handler: 'queued',
    timeout: 120000,
    cacheStrategy: 'r2-d1-permanent'
  };
}
```

### 4.2 Binary vs JSON Decision

```javascript
function shouldUseBinary(request, dataSize) {
  // Check client support
  const acceptBinary = request.headers.get('Accept')?.includes('application/x-msgpack');
  if (!acceptBinary) return false;

  // Always use binary for large datasets
  if (dataSize > 100000) return true;

  // Use binary for medium datasets if client supports
  if (dataSize > 10000) return true;

  // Small datasets: JSON is fine (better debugging)
  return false;
}
```

### 4.3 Resource Limits & Fallbacks

```
┌─────────────────────────────────────────────────────────────┐
│                  RESOURCE LIMITS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Worker CPU Time:              50ms (standard tier)         │
│  └─ Fallback: Queue for > 40ms operations                  │
│                                                             │
│  Worker Memory:                128MB                        │
│  └─ Fallback: Stream data, don't load all into memory      │
│                                                             │
│  Subrequest Limit:             50 per request               │
│  └─ Fallback: Queue if pagination > 40 requests            │
│                                                             │
│  Request Timeout:              30 seconds                   │
│  └─ Fallback: Queue for 365-day queries                    │
│                                                             │
│  R2 Read Bandwidth:            Free (unlimited)             │
│  R2 Write Bandwidth:           Free (unlimited)             │
│  └─ Optimize: Batch writes, compress data                  │
│                                                             │
│  D1 Database Size:             Free tier: 500MB             │
│  └─ Strategy: Aggregations only, not raw data              │
│                                                             │
│  KV Storage Size:              Free tier: 1GB               │
│  └─ Current: Point metadata only (~10MB)                   │
│                                                             │
│  Queue Batch Size:             100 messages/batch           │
│  Queue Max Retries:            3 attempts                   │
│  └─ Fallback: Store failed jobs in D1 for manual retry     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Migration Path

### Phase 1: MessagePack Support (Week 1)
**Goal:** Enable binary data transfer with zero breaking changes

**Implementation:**
1. Add MessagePack encoding/decoding to worker
2. Implement content negotiation (Accept header)
3. Add `format=binary` query parameter fallback
4. Update frontend to request binary for large datasets
5. Add performance monitoring

**Deployment:**
- Deploy worker with binary support
- Test with small subset of users
- Monitor performance metrics
- Rollback plan: Remove binary routes, keep JSON

**Success Criteria:**
- 60% payload reduction on binary requests
- No increase in error rate
- < 5ms additional processing time

**Backwards Compatibility:**
- JSON remains default
- All existing endpoints unchanged
- Binary is opt-in via Accept header

### Phase 2: R2 + D1 Integration (Week 2-3)
**Goal:** Add caching layer for large datasets and aggregations

**Implementation:**
1. Create R2 bucket structure
2. Deploy D1 database schema
3. Implement cache lookup logic
4. Add cache write after origin fetch
5. Implement cache metadata tracking
6. Add aggregation pre-computation

**Deployment:**
- Create R2 bucket: `chart-data`
- Deploy D1 database with schema
- Update worker bindings in wrangler.toml
- Deploy worker with cache logic
- Run migration script for existing KV data → D1

**Success Criteria:**
- 80% cache hit rate for historical queries
- < 100ms response time for cached data
- Successful migration of point metadata to D1

**Backwards Compatibility:**
- Cache is transparent to clients
- Falls back to origin on cache miss
- No API changes required

### Phase 3: Queue Background Processing (Week 4)
**Goal:** Handle 365-day queries without timeout

**Implementation:**
1. Create queue: `chart-data-jobs`
2. Implement queue consumer worker
3. Add job status endpoint
4. Update frontend for async workflows
5. Add job notification system

**Deployment:**
- Create Cloudflare Queue
- Deploy queue consumer worker
- Update main worker with queue submission logic
- Add new endpoints:
  - `POST /api/jobs` - Submit job
  - `GET /api/jobs/:jobId` - Check status
  - `GET /api/jobs/:jobId/result` - Get result

**Success Criteria:**
- 365-day, 50-point queries complete in < 2 minutes
- Job status tracking works reliably
- Failed jobs retry automatically

**Backwards Compatibility:**
- Small/medium queries unchanged
- Large queries return 202 + jobId
- Frontend checks Accept header for async support
- Old clients get 413 Payload Too Large with helpful message

---

## 6. API Contracts

### 6.1 Enhanced Endpoints

#### GET /api/timeseries (Enhanced)
```typescript
// Request
GET /api/timeseries?site=ses_falls_city&points=VAV-707-DaTemp,VAV-707-Damper&start=2024-01-01&end=2025-01-01
Headers:
  X-ACE-Token: {token}
  Accept: application/x-msgpack OR application/json

// Response (Small/Medium - Sync)
Status: 200 OK
Headers:
  Content-Type: application/x-msgpack OR application/json
  X-Cache-Status: HIT | MISS
  X-Cache-Source: EDGE | R2 | D1 | ORIGIN
  X-Processing-Time: 45ms
  X-Data-Samples: 876000
  Cache-Control: public, max-age=600, stale-while-revalidate=1800

Body (JSON):
{
  "metadata": {
    "siteId": "ses_falls_city",
    "pointNames": ["VAV-707-DaTemp", "VAV-707-Damper"],
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2025-01-01T00:00:00Z",
    "aggregation": "raw",
    "totalSamples": 876000
  },
  "series": [
    {
      "name": "VAV-707-DaTemp",
      "data": [[1704067200000, 72.5], [1704067260000, 72.6], ...]
    }
  ]
}

Body (MessagePack - binary representation of above)

// Response (Large - Async)
Status: 202 Accepted
Headers:
  Content-Type: application/json
  Location: /api/jobs/{jobId}

Body:
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "estimatedDuration": 90,
  "statusUrl": "/api/jobs/550e8400-e29b-41d4-a716-446655440000",
  "message": "Large query queued for background processing"
}
```

#### GET /api/jobs/:jobId (New)
```typescript
// Request
GET /api/jobs/550e8400-e29b-41d4-a716-446655440000

// Response (Processing)
Status: 200 OK
Body:
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 67,
  "estimatedRemaining": 30,
  "createdAt": "2025-10-12T12:00:00Z",
  "startedAt": "2025-10-12T12:00:05Z"
}

// Response (Completed)
Status: 200 OK
Body:
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "resultUrl": "/api/jobs/550e8400-e29b-41d4-a716-446655440000/result",
  "resultFormat": "msgpack",
  "resultSize": 24576000,
  "createdAt": "2025-10-12T12:00:00Z",
  "completedAt": "2025-10-12T12:01:32Z",
  "duration": 92
}
```

#### GET /api/aggregations (New)
```typescript
// Request
GET /api/aggregations?site=ses_falls_city&points=VAV-707-DaTemp&start=2024-01-01&end=2025-01-01&interval=1hr
Headers:
  X-ACE-Token: {token}

// Response
Status: 200 OK
Headers:
  X-Cache-Source: D1
  X-Processing-Time: 8ms

Body:
{
  "metadata": {
    "siteId": "ses_falls_city",
    "pointName": "VAV-707-DaTemp",
    "interval": "1hr",
    "dataPoints": 8760
  },
  "aggregations": [
    {
      "timestamp": 1704067200000,
      "avg": 72.5,
      "min": 68.2,
      "max": 76.8,
      "count": 60,
      "stddev": 2.3
    },
    ...
  ]
}
```

### 6.2 Error Handling

```typescript
// Rate Limited
Status: 429 Too Many Requests
Body:
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again in 60 seconds.",
  "retryAfter": 60
}

// Request Too Large (no async support)
Status: 413 Payload Too Large
Body:
{
  "error": "request_too_large",
  "message": "Query too large for synchronous processing. Use 'Accept: application/x-msgpack' header or add '?async=true' parameter.",
  "estimatedSamples": 2500000,
  "suggestions": [
    "Use async mode: ?async=true",
    "Request binary format: Accept: application/x-msgpack",
    "Reduce time range or point count",
    "Use aggregation: ?interval=1hr"
  ]
}

// Job Failed
Status: 200 OK
Body:
{
  "jobId": "...",
  "status": "failed",
  "error": "timeout",
  "message": "ACE API timeout after 50 requests",
  "retryable": true,
  "retryAfter": 300
}
```

---

## 7. Monitoring & Observability

### 7.1 Key Metrics

```javascript
// Worker Analytics
{
  requests: {
    total: 'Counter',
    bySize: { small: 'Counter', medium: 'Counter', large: 'Counter' },
    byFormat: { json: 'Counter', binary: 'Counter' },
    byCache: { hit: 'Counter', miss: 'Counter' },
    bySource: { edge: 'Counter', r2: 'Counter', d1: 'Counter', origin: 'Counter' }
  },

  performance: {
    responseTime: 'Histogram',
    cacheLatency: { edge: 'Histogram', r2: 'Histogram', d1: 'Histogram' },
    originLatency: 'Histogram',
    queueWaitTime: 'Histogram'
  },

  storage: {
    r2Writes: 'Counter',
    r2Reads: 'Counter',
    r2Size: 'Gauge',
    d1Queries: 'Counter',
    d1Size: 'Gauge',
    kvReads: 'Counter'
  },

  queues: {
    jobsQueued: 'Counter',
    jobsCompleted: 'Counter',
    jobsFailed: 'Counter',
    jobDuration: 'Histogram',
    queueDepth: 'Gauge'
  },

  errors: {
    total: 'Counter',
    byType: { timeout: 'Counter', rateLimit: 'Counter', serverError: 'Counter' },
    retries: 'Counter'
  }
}
```

### 7.2 Logging Strategy

```javascript
// Structured logging
function logRequest(request, response, metadata) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    type: 'request',
    request: {
      method: request.method,
      url: request.url,
      siteId: metadata.siteId,
      pointCount: metadata.pointNames.length,
      estimatedSamples: metadata.estimatedSamples,
      format: metadata.format
    },
    response: {
      status: response.status,
      cacheStatus: response.headers.get('X-Cache-Status'),
      cacheSource: response.headers.get('X-Cache-Source'),
      processingTime: metadata.processingTime,
      dataSize: metadata.dataSize
    },
    classification: metadata.classification
  }));
}
```

---

## 8. Cost Analysis

### 8.1 Current Costs (Baseline)
```
Worker Requests:      10M/month × $0.50/million   = $5.00
KV Reads:             10M/month × $0.50/million   = $5.00
KV Writes:            1M/month  × $5.00/million   = $5.00
Workers AI:           FREE (< 10K requests/day)
                                          TOTAL:   $15.00/month
```

### 8.2 Enhanced System Costs (Projected)
```
Worker Requests:      15M/month × $0.50/million   = $7.50
  (Increased due to status checks and job polling)

KV Operations:        5M/month  × $0.50/million   = $2.50
  (Reduced, moved to D1)

R2 Storage:           200GB × $0.015/GB           = $3.00
R2 Class A (Write):   500K/month × $4.50/million  = $2.25
R2 Class B (Read):    2M/month × $0.36/million    = $0.72

D1 Database:          FREE (< 5GB database size)
D1 Rows Read:         10M/month × $0.001/million  = $0.01
D1 Rows Written:      2M/month × $1.00/million    = $2.00

Queues:               3M ops/month × $0.40/million = $1.20

Workers AI:           FREE (within limits)

                                          TOTAL:   $19.18/month
```

### 8.3 Cost Savings Analysis
```
Performance Gains:
  - 60% payload reduction → Save bandwidth costs for users
  - 80% cache hit rate → Reduce ACE API load (if metered)
  - 90% faster load times → Improved user experience

Value Delivered:
  - Handle 365-day queries (previously impossible)
  - Real-time collaborative features (with Durable Objects)
  - Professional exports (CSV, Excel, PDF)
  - AI-powered insights and recommendations

ROI:
  +$4.18/month operational cost
  Enables features worth $$$ in improved UX and capabilities
  Prevents timeout errors and lost productivity
```

---

## 9. Security Considerations

### 9.1 Authentication Flow
```
Client Request
  → Worker validates X-ACE-Token
  → Check D1 for token permissions
  → Forward to ACE API with token
  → ACE API validates and responds
```

### 9.2 Data Privacy
- **Point metadata**: Cached in KV/D1 (not sensitive)
- **Timeseries data**: Cached in R2 with user context
- **Cache isolation**: Separate R2 keys per user/token
- **Expiration**: Auto-delete after TTL

### 9.3 Rate Limiting
```javascript
// D1-based rate limiting
async function checkRateLimit(userId, endpoint) {
  const key = `ratelimit:${userId}:${endpoint}`;
  const window = 60; // 1 minute
  const limit = 100; // requests per window

  const count = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM request_log
    WHERE user_id = ?
      AND endpoint = ?
      AND timestamp > unixepoch() - ?
  `).bind(userId, endpoint, window).first();

  if (count >= limit) {
    throw new RateLimitError('Too many requests');
  }

  // Log request
  await env.DB.prepare(`
    INSERT INTO request_log (user_id, endpoint, timestamp)
    VALUES (?, ?, unixepoch())
  `).bind(userId, endpoint).run();
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('Request Classification', () => {
  it('classifies small requests correctly', () => {
    const result = classifyRequest(['point1'], '2025-10-12', '2025-10-13');
    expect(result.size).toBe('small');
    expect(result.handler).toBe('direct');
  });

  it('classifies large requests correctly', () => {
    const result = classifyRequest(
      Array(50).fill('point'),
      '2024-01-01',
      '2025-01-01'
    );
    expect(result.size).toBe('large');
    expect(result.handler).toBe('queued');
  });
});

describe('Binary Encoding', () => {
  it('encodes timeseries to MessagePack', () => {
    const data = { series: [{ name: 'test', data: [[1,2]] }] };
    const binary = encodeToBinary(data);
    expect(binary).toBeInstanceOf(Uint8Array);
    expect(binary.length).toBeLessThan(JSON.stringify(data).length);
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Cache Hierarchy', () => {
  it('returns from R2 cache on hit', async () => {
    // Pre-populate R2
    await env.R2.put('test-key', msgpack.encode(testData));

    const response = await worker.fetch(request, env);

    expect(response.headers.get('X-Cache-Source')).toBe('R2');
    expect(response.status).toBe(200);
  });

  it('falls back to origin on cache miss', async () => {
    const response = await worker.fetch(request, env);

    expect(response.headers.get('X-Cache-Source')).toBe('ORIGIN');
  });
});
```

### 10.3 Load Tests
```bash
# Test with Artillery
artillery quick --count 1000 --num 10 \
  https://worker.workers.dev/api/timeseries?site=test&points=1,2,3&start=2025-10-01&end=2025-10-12

# Expected Results:
# - p50 latency: < 100ms
# - p95 latency: < 500ms
# - p99 latency: < 2s
# - Error rate: < 0.1%
```

---

## 11. Rollout Plan

### Week 1: MessagePack
- [ ] Deploy worker with binary support
- [ ] A/B test: 10% traffic to binary
- [ ] Monitor payload size reduction
- [ ] Gradually increase to 100%

### Week 2: R2 + D1 Setup
- [ ] Create R2 bucket and D1 database
- [ ] Deploy schema
- [ ] Migrate KV data to D1
- [ ] Enable cache writes (no reads yet)

### Week 3: R2 + D1 Reads
- [ ] Enable R2 cache reads
- [ ] Enable D1 aggregation queries
- [ ] Monitor cache hit rates
- [ ] Tune TTLs based on metrics

### Week 4: Queue Processing
- [ ] Deploy queue consumer
- [ ] Enable async mode for large requests
- [ ] Test 365-day queries end-to-end
- [ ] Monitor job completion rates

### Week 5: Optimization
- [ ] Analyze performance metrics
- [ ] Tune cache strategies
- [ ] Optimize aggregation intervals
- [ ] Update documentation

---

## 12. Success Criteria

### Performance Metrics
- [ ] 60%+ payload reduction with MessagePack
- [ ] 80%+ cache hit rate for historical queries
- [ ] < 100ms response time for cached data
- [ ] 365-day queries complete in < 2 minutes
- [ ] < 0.1% error rate

### Business Metrics
- [ ] Zero downtime during deployment
- [ ] 100% backwards compatibility
- [ ] Within free tier cost constraints
- [ ] User-reported performance improvements

### Technical Metrics
- [ ] All unit tests passing
- [ ] Load tests meeting SLA
- [ ] Monitoring dashboards operational
- [ ] Documentation complete

---

## 13. Future Enhancements

### Short Term (3-6 months)
1. **Durable Objects** - Real-time collaborative dashboards
2. **Browser Rendering** - Server-side chart image generation
3. **Advanced Aggregations** - Custom rollups and calculations
4. **Semantic Search** - Vectorize integration for chart discovery

### Long Term (6-12 months)
1. **AI-Powered Analytics** - Anomaly detection, pattern recognition
2. **Predictive Caching** - ML-based cache pre-warming
3. **Multi-Region** - Geo-distributed R2 buckets
4. **WebSocket Streaming** - Real-time chart updates

---

## Appendix A: Configuration Files

### wrangler.toml
```toml
name = "ace-iot-proxy"
main = "src/worker.ts"
compatibility_date = "2025-10-12"

[[r2_buckets]]
binding = "CHART_DATA"
bucket_name = "chart-data"

[[d1_databases]]
binding = "DB"
database_name = "timeseries-db"
database_id = "your-db-id"

[[queues.producers]]
binding = "CHART_QUEUE"
queue = "chart-data-jobs"

[[queues.consumers]]
queue = "chart-data-jobs"
max_batch_size = 100
max_batch_timeout = 30

[[kv_namespaces]]
binding = "KV"
id = "your-kv-id"

[ai]
binding = "AI"
```

---

## Appendix B: Migration Scripts

### KV to D1 Migration
```sql
-- Script to migrate point metadata from KV to D1
INSERT INTO point_metadata (site_id, point_name, display_name, equipment, unit, marker_tags)
SELECT
  json_extract(kv_value, '$.siteId'),
  json_extract(kv_value, '$.Name'),
  json_extract(kv_value, '$.display_name'),
  json_extract(kv_value, '$.equipment'),
  json_extract(kv_value, '$.unit'),
  json_extract(kv_value, '$.marker_tags')
FROM kv_backup
WHERE kv_key LIKE 'enhanced:%';
```

---

**Document Version:** 1.0
**Author:** System Architecture Designer
**Date:** 2025-10-12
**Status:** Ready for Implementation

**Related Documents:**
- `/docs/CLOUDFLARE_WORKER_IMPROVEMENTS.md` - Current worker implementation
- `/docs/CLOUDFLARE_CHART_ENHANCEMENTS.md` - Enhancement opportunities analysis
- `/docs/POINT_SELECTION_DATA_FLOW.md` - Data flow patterns

**Next Steps:**
1. Review architecture with development team
2. Validate cost estimates with stakeholders
3. Begin Phase 1 implementation (MessagePack)
4. Set up monitoring infrastructure
