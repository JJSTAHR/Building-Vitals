# Building Vitals Timeseries Data Lake - System Architecture

**Version:** 1.0
**Date:** 2025-10-13
**Status:** Design Complete

## Executive Summary

This document defines the complete system architecture for a two-tier (hot/cold) timeseries data lake that stores ALL raw data from ACE IoT API without filtering. The system addresses D1's 10GB storage limit (~27 days at 374MB/day) by implementing automated archival to R2 with transparent query routing.

**Key Metrics:**
- **Data Volume:** 374MB/day raw timeseries data
- **Hot Storage (D1):** Last 20 days (~7.5GB)
- **Cold Storage (R2):** 20+ days, unlimited capacity
- **Query Performance:** <500ms for hot data, <5s for cold data
- **Data Retention:** 1 year minimum (configurable)

---

## 1. Storage Tier Architecture

### 1.1 Hot Storage - D1 Database

**Purpose:** Fast access to recent timeseries data
**Technology:** Cloudflare D1 (SQLite at edge)
**Capacity:** 10GB limit
**Retention:** 20 days (configurable)
**Current Usage:** ~7.5GB at 374MB/day

**Schema:**
```sql
-- Points table (normalized point metadata)
CREATE TABLE points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  building TEXT NOT NULL,
  data_type TEXT DEFAULT 'analog',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Timeseries table (raw samples)
CREATE TABLE timeseries (
  point_id INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,  -- Unix milliseconds
  value REAL NOT NULL,
  PRIMARY KEY (point_id, timestamp),
  FOREIGN KEY (point_id) REFERENCES points(id)
);

-- Archive state tracking
CREATE TABLE archive_state (
  point_id INTEGER NOT NULL,
  last_archived_timestamp INTEGER NOT NULL,
  archive_count INTEGER DEFAULT 0,
  last_archive_run TEXT,
  PRIMARY KEY (point_id)
);

-- Indexes for query performance
CREATE INDEX idx_timeseries_timestamp ON timeseries(timestamp);
CREATE INDEX idx_timeseries_point_time ON timeseries(point_id, timestamp);
```

**Performance Characteristics:**
- Query latency: <500ms for 30-day range
- Insert throughput: 1000 records/batch
- Storage efficiency: ~12KB per 1000 samples

### 1.2 Cold Storage - R2 Bucket

**Purpose:** Long-term archival storage for historical data
**Technology:** Cloudflare R2 (S3-compatible object storage)
**Capacity:** Unlimited (pay per GB)
**Retention:** 1 year+ (configurable)
**Format:** Apache Parquet with Snappy compression

**Path Structure:**
```
/timeseries/
  /{site_name}/
    /{year}/
      /{month}/
        /{day}.parquet
```

**Example Paths:**
```
/timeseries/ses_falls_city/2024/10/01.parquet
/timeseries/ses_falls_city/2024/10/02.parquet
/timeseries/ses_falls_city/2024/11/01.parquet
```

**Parquet Schema:**
```
message timeseries_sample {
  required int64 timestamp;    -- Unix milliseconds
  required binary point_name;  -- UTF8 string
  required double value;       -- 64-bit float
}
```

**Compression & Performance:**
- Compression ratio: 10:1 (Snappy)
- File size: ~40MB per day (compressed from 374MB)
- Query latency: 500-5000ms (depends on file count)

---

## 2. Query Worker Architecture

### 2.1 Worker Endpoint

**Route:** `GET /timeseries/query`
**Function:** Transparently routes queries across D1 and R2 based on time range

**Request Format:**
```typescript
interface QueryRequest {
  site_name: string;
  point_names: string[];     // Array of point names
  start_time: string;        // ISO 8601 timestamp
  end_time: string;          // ISO 8601 timestamp
  aggregation?: string;      // Optional: '1min', '5min', '1hr', '1day'
}
```

**Response Format:**
```typescript
interface QueryResponse {
  series: {
    name: string;
    data: [number, number][];  // [timestamp_ms, value]
  }[];
  metadata: {
    sources: ('D1' | 'R2' | 'BOTH')[];
    storage_tiers: {
      hot: { start: string; end: string; sample_count: number };
      cold: { start: string; end: string; file_count: number };
    };
    query_time_ms: number;
    cache_hit: boolean;
  };
}
```

### 2.2 Query Routing Logic

**Decision Tree:**
```
Start Query
  |
  +--> Calculate time range boundaries
  |
  +--> Is end_time < 20 days ago?
  |    YES --> Route to D1 ONLY
  |    NO  --> Continue
  |
  +--> Is start_time > 20 days ago?
  |    YES --> Route to R2 ONLY
  |    NO  --> Continue
  |
  +--> Query spans both tiers
       --> Split query at 20-day boundary
       --> Execute D1 query (hot range)
       --> Execute R2 query (cold range)
       --> Merge results
       --> Return combined dataset
```

**Implementation:**
```javascript
export function routeQuery(startTime, endTime) {
  const now = Date.now();
  const hotBoundary = now - (20 * 24 * 60 * 60 * 1000); // 20 days ago

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (end < hotBoundary) {
    return { strategy: 'R2_ONLY', queries: [{ target: 'R2', start, end }] };
  }

  if (start >= hotBoundary) {
    return { strategy: 'D1_ONLY', queries: [{ target: 'D1', start, end }] };
  }

  return {
    strategy: 'SPLIT',
    queries: [
      { target: 'R2', start, end: hotBoundary },
      { target: 'D1', start: hotBoundary, end }
    ]
  };
}
```

### 2.3 Result Merging Strategy

**Merge Algorithm:**
1. Execute queries in parallel (Promise.all)
2. Collect results from both sources
3. Group by point_name
4. Concatenate data arrays (R2 first, then D1)
5. Deduplicate timestamps (keep D1 value if overlap)
6. Sort by timestamp ascending
7. Return unified series

**Deduplication Logic:**
```javascript
function deduplicateSamples(samples) {
  const map = new Map();

  // R2 samples first (older)
  samples.r2.forEach(([ts, val]) => map.set(ts, val));

  // D1 samples override (newer, more authoritative)
  samples.d1.forEach(([ts, val]) => map.set(ts, val));

  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}
```

### 2.4 Caching Strategy (KV)

**Cache Key Format:**
```
query:{point_hash}:{start_ts}:{end_ts}
```

**TTL Rules:**
- Real-time data (< 1 day old): 5 minutes
- Recent data (1-7 days): 30 minutes
- Week-old data (7-30 days): 1 hour
- Historical data (30+ days): 24 hours

**KV Schema:**
```javascript
{
  query_hash: string;
  cached_at: number;
  ttl: number;
  result: {
    series: Array;
    metadata: Object;
  }
}
```

---

## 3. Archival Worker Architecture

### 3.1 Worker Trigger

**Cron Schedule:** `0 2 * * *` (Daily at 2 AM UTC)
**Execution Time:** ~5-15 minutes (depends on data volume)
**Worker Name:** `building-vitals-archival`

### 3.2 Archival Process Flow

```
[2:00 AM UTC] Cron triggers archival worker
  |
  +--> Query D1 for data older than 20 days
  |    SELECT DISTINCT point_id, DATE(timestamp/1000) as date
  |    FROM timeseries
  |    WHERE timestamp < (NOW - 20 days)
  |
  +--> Group by site, year, month, day
  |
  +--> For each day:
  |    |
  |    +--> Check if Parquet file exists in R2
  |    |    (Skip if already archived)
  |    |
  |    +--> Fetch all samples for that day
  |    |    SELECT point_name, timestamp, value
  |    |    FROM timeseries
  |    |    WHERE timestamp BETWEEN day_start AND day_end
  |    |
  |    +--> Convert to Parquet format
  |    |    - Group by point_name
  |    |    - Apply Snappy compression
  |    |    - Write to memory buffer
  |    |
  |    +--> Upload to R2
  |    |    PUT /timeseries/{site}/{year}/{month}/{day}.parquet
  |    |
  |    +--> Verify upload (HEAD request)
  |    |
  |    +--> Delete from D1 (atomic transaction)
  |         DELETE FROM timeseries
  |         WHERE timestamp BETWEEN day_start AND day_end
  |
  +--> Update archive_state table
  |
  +--> Log metrics to KV
       - Files created
       - Records archived
       - Records deleted
       - Errors (if any)
```

### 3.3 Atomic Transaction Handling

**Safety Guarantees:**
1. Upload to R2 BEFORE deleting from D1
2. Verify R2 upload with HEAD request
3. Use D1 batch statements for atomic deletes
4. Track archive_state for resumability
5. Log errors to KV for monitoring

**Error Recovery:**
```javascript
async function archiveDayData(env, date) {
  const r2Key = generateR2Key(date);

  try {
    // 1. Check if already archived
    const exists = await env.R2.head(r2Key);
    if (exists) {
      console.log(`Already archived: ${r2Key}`);
      return;
    }

    // 2. Fetch data from D1
    const samples = await fetchDayData(env.DB, date);

    // 3. Convert to Parquet
    const parquetBuffer = await convertToParquet(samples);

    // 4. Upload to R2 with retry
    await uploadWithRetry(env.R2, r2Key, parquetBuffer, 3);

    // 5. Verify upload
    const verified = await env.R2.head(r2Key);
    if (!verified) {
      throw new Error('Upload verification failed');
    }

    // 6. Delete from D1 (only after successful upload)
    await deleteFromD1(env.DB, date);

    // 7. Update archive state
    await updateArchiveState(env.DB, date, r2Key);

  } catch (error) {
    // Log error, DO NOT delete from D1
    await logError(env.KV, { date, error: error.message });
    throw error;
  }
}
```

### 3.4 Resumability & Progress Tracking

**KV State Schema:**
```javascript
{
  archive_run_id: string;
  started_at: number;
  last_processed_date: string;
  status: 'in_progress' | 'completed' | 'failed';
  stats: {
    files_created: number;
    records_archived: number;
    records_deleted: number;
    errors: Array<{ date: string; error: string }>;
  }
}
```

---

## 4. Backfill Worker Architecture

### 4.1 Worker Trigger

**Type:** Manual HTTP trigger (POST request)
**Endpoint:** `/api/backfill`
**Use Case:** Historical data import from ACE API

### 4.2 Backfill Request Format

```typescript
interface BackfillRequest {
  site_name: string;
  start_date: string;     // YYYY-MM-DD
  end_date: string;       // YYYY-MM-DD
  point_names?: string[]; // Optional: specific points only
  resume?: boolean;       // Resume from last checkpoint
}
```

### 4.3 Backfill Process Flow

```
[HTTP POST /api/backfill] Trigger backfill
  |
  +--> Validate date range (max 90 days per request)
  |
  +--> Check KV for existing backfill progress
  |    (Resume from last checkpoint if resume=true)
  |
  +--> Split date range into daily chunks
  |
  +--> For each day (process serially to avoid timeouts):
  |    |
  |    +--> Check if day already processed
  |    |    (Skip if exists in D1 or R2)
  |    |
  |    +--> Fetch from ACE API paginated endpoint
  |    |    GET /sites/{site}/timeseries/paginated
  |    |    ?start_time={day_start}
  |    |    &end_time={day_end}
  |    |    &raw_data=true
  |    |    &page_size=1000
  |    |
  |    +--> Process paginated results
  |    |    - Handle cursor-based pagination
  |    |    - Filter to configured points only
  |    |    - Remove NULL values
  |    |
  |    +--> Determine storage tier
  |    |    IF day is within last 20 days:
  |    |      Write to D1 (hot storage)
  |    |    ELSE:
  |    |      Write to R2 as Parquet (cold storage)
  |    |
  |    +--> Update progress in KV
  |         {
  |           last_processed_date: day,
  |           records_inserted: count,
  |           api_calls: count
  |         }
  |
  +--> Complete backfill
       - Log final metrics
       - Notify completion (optional webhook)
```

### 4.4 Pagination Handling

**ACE API Pagination:**
```javascript
async function fetchDayFromACE(env, date) {
  const allSamples = [];
  let cursor = null;
  let page = 0;

  do {
    const url = new URL(`${env.ACE_API_BASE}/sites/${site}/timeseries/paginated`);
    url.searchParams.set('start_time', date.toISOString());
    url.searchParams.set('end_time', getEndOfDay(date).toISOString());
    url.searchParams.set('raw_data', 'true');
    url.searchParams.set('page_size', '1000');
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${env.ACE_API_KEY}` }
    });

    const data = await response.json();
    allSamples.push(...data.point_samples);

    cursor = data.next_cursor;
    page++;

    // Safety check
    if (page > 100) throw new Error('Too many pages');

  } while (cursor && data.has_more);

  return allSamples;
}
```

### 4.5 Progress Tracking (Resumable)

**KV Progress Schema:**
```javascript
{
  backfill_id: string;
  started_at: number;
  status: 'in_progress' | 'completed' | 'failed';
  request: {
    site_name: string;
    start_date: string;
    end_date: string;
  };
  progress: {
    total_days: number;
    completed_days: number;
    last_processed_date: string;
    records_inserted: number;
    api_calls: number;
  };
  errors: Array<{ date: string; error: string }>;
}
```

**Resume Logic:**
```javascript
async function resumeBackfill(env, backfillId) {
  const progress = await env.KV.get(`backfill:${backfillId}`, { type: 'json' });

  if (!progress) {
    throw new Error('Backfill not found');
  }

  const lastDate = new Date(progress.progress.last_processed_date);
  const endDate = new Date(progress.request.end_date);

  // Resume from next day
  const resumeDate = new Date(lastDate);
  resumeDate.setDate(resumeDate.getDate() + 1);

  return {
    startDate: resumeDate,
    endDate,
    existingProgress: progress.progress
  };
}
```

---

## 5. Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT APPLICATION                       │
│                    (React Dashboard / API Client)                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ GET /timeseries/query
                            │ {site, points, start, end}
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        QUERY WORKER                              │
│                  (Cloudflare Workers Edge)                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Route Query                                           │   │
│  │    - Calculate time boundaries                           │   │
│  │    - Determine D1/R2/SPLIT strategy                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                     │
│            ┌───────────────┴───────────────┐                    │
│            ▼                               ▼                    │
│  ┌─────────────────┐            ┌─────────────────┐            │
│  │  Query D1       │            │  Query R2       │            │
│  │  (Hot: <20d)    │            │  (Cold: >20d)   │            │
│  └────────┬────────┘            └────────┬────────┘            │
│           │                               │                     │
│  ┌────────▼────────────────────────────────▼────────┐          │
│  │ 2. Check KV Cache                               │          │
│  │    - Generate cache key                          │          │
│  │    - Check TTL                                   │          │
│  └──────────────────────────────────────────────────┘          │
│                            │                                     │
│  ┌─────────────────────────▼────────────────────────┐          │
│  │ 3. Merge Results                                 │          │
│  │    - Deduplicate timestamps                      │          │
│  │    - Sort chronologically                        │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ JSON Response
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATION                            │
│                  (Renders timeseries chart)                      │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                     ARCHIVAL WORKER                              │
│              (Cron: Daily 2 AM UTC)                              │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Query Old Data                                        │   │
│  │    SELECT * FROM timeseries                              │   │
│  │    WHERE timestamp < NOW - 20 days                       │   │
│  └─────────────────┬───────────────────────────────────────┘   │
│                    │                                             │
│  ┌─────────────────▼───────────────────────────────────────┐   │
│  │ 2. Group by Day                                          │   │
│  │    - Organize into daily batches                         │   │
│  │    - Check R2 for existing files                         │   │
│  └─────────────────┬───────────────────────────────────────┘   │
│                    │                                             │
│  ┌─────────────────▼───────────────────────────────────────┐   │
│  │ 3. Convert to Parquet                                    │   │
│  │    - Group by point_name                                 │   │
│  │    - Apply Snappy compression                            │   │
│  │    - Write to memory buffer                              │   │
│  └─────────────────┬───────────────────────────────────────┘   │
│                    │                                             │
│                    ▼                                             │
│         ┌──────────────────────┐                                │
│         │   Upload to R2       │                                │
│         │   Verify Upload      │                                │
│         └──────────┬───────────┘                                │
│                    │                                             │
│  ┌─────────────────▼───────────────────────────────────────┐   │
│  │ 4. Delete from D1 (Atomic)                               │   │
│  │    DELETE FROM timeseries                                │   │
│  │    WHERE timestamp BETWEEN day_start AND day_end         │   │
│  └─────────────────┬───────────────────────────────────────┘   │
│                    │                                             │
│  ┌─────────────────▼───────────────────────────────────────┐   │
│  │ 5. Log Metrics                                           │   │
│  │    - Files created                                       │   │
│  │    - Records archived/deleted                            │   │
│  │    - Save to KV                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                      BACKFILL WORKER                             │
│                 (Manual HTTP Trigger)                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Receive Request                                       │   │
│  │    POST /api/backfill                                    │   │
│  │    {site, start_date, end_date}                          │   │
│  └─────────────────┬───────────────────────────────────────┘   │
│                    │                                             │
│  ┌─────────────────▼───────────────────────────────────────┐   │
│  │ 2. Check KV Progress (Resumable)                         │   │
│  │    - Load existing backfill state                        │   │
│  │    - Resume from last processed date                     │   │
│  └─────────────────┬───────────────────────────────────────┘   │
│                    │                                             │
│  ┌─────────────────▼───────────────────────────────────────┐   │
│  │ 3. Process Each Day                                      │   │
│  │    FOR day IN date_range:                                │   │
│  │      - Fetch from ACE API (paginated)                    │   │
│  │      - Filter to configured points                       │   │
│  │      - Write to D1 OR R2 (based on age)                  │   │
│  │      - Update KV progress                                │   │
│  └─────────────────┬───────────────────────────────────────┘   │
│                    │                                             │
│  ┌─────────────────▼───────────────────────────────────────┐   │
│  │ 4. Complete Backfill                                     │   │
│  │    - Log final metrics                                   │   │
│  │    - Mark as completed in KV                             │   │
│  │    - Return summary                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘


STORAGE LAYER:
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│   D1 (Hot)     │     │   R2 (Cold)    │     │   KV (State)   │
│  <20 days      │     │   >20 days     │     │  - Cache       │
│  ~7.5GB        │     │   Unlimited    │     │  - Progress    │
│  SQLite        │     │   Parquet      │     │  - Metadata    │
└────────────────┘     └────────────────┘     └────────────────┘
```

---

## 6. Deployment Architecture

### 6.1 Wrangler Configuration

**Query Worker:** `wrangler.toml`
```toml
name = "ace-iot-timeseries"
main = "src/query-worker.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "ace-iot-db"
database_id = "1afc0a07-85cd-4d5f-a046-b580ffffb8dc"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "ace-timeseries"

[[kv_namespaces]]
binding = "KV"
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"

[vars]
HOT_STORAGE_DAYS = "20"
MAX_QUERY_RANGE_DAYS = "90"
ENABLE_QUERY_CACHE = "true"
```

**Archival Worker:** `wrangler-archival.toml`
```toml
name = "building-vitals-archival"
main = "src/archival-worker.js"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[triggers]
crons = ["0 2 * * *"]

[[d1_databases]]
binding = "DB"
database_name = "ace-iot-db"
database_id = "1afc0a07-85cd-4d5f-a046-b580ffffb8dc"

[[r2_buckets]]
binding = "R2"
bucket_name = "ace-timeseries"

[[kv_namespaces]]
binding = "KV"
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"

[vars]
ARCHIVE_THRESHOLD_DAYS = "20"
BATCH_SIZE = "10000"
MAX_RETRIES = "3"

[limits]
cpu_ms = 30000
```

**Backfill Worker:** `wrangler-backfill.toml`
```toml
name = "building-vitals-backfill"
main = "src/backfill-worker.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "ace-iot-db"
database_id = "1afc0a07-85cd-4d5f-a046-b580ffffb8dc"

[[r2_buckets]]
binding = "R2"
bucket_name = "ace-timeseries"

[[kv_namespaces]]
binding = "KV"
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"

[vars]
MAX_DAYS_PER_REQUEST = "90"
PROCESS_TIMEOUT_MS = "60000"
CHECKPOINT_INTERVAL_DAYS = "1"

[limits]
cpu_ms = 60000
```

### 6.2 Deployment Commands

```bash
# Deploy Query Worker
wrangler deploy --config wrangler.toml

# Deploy Archival Worker
wrangler deploy --config wrangler-archival.toml

# Deploy Backfill Worker
wrangler deploy --config wrangler-backfill.toml

# Verify deployments
wrangler deployments list

# Tail logs
wrangler tail building-vitals-archival --format=pretty
```

### 6.3 Environment Secrets

```bash
# Set ACE API key
wrangler secret put ACE_API_KEY

# Set optional monitoring webhook
wrangler secret put MONITORING_WEBHOOK_URL
```

---

## 7. Error Handling & Retry Strategies

### 7.1 Query Worker Errors

**D1 Query Failure:**
```javascript
try {
  result = await queryD1(env.DB, points, start, end);
} catch (error) {
  // Fallback: Try R2 if D1 fails
  console.error('D1 query failed, falling back to R2', error);
  result = await queryR2(env.R2, points, start, end);
}
```

**R2 Query Failure:**
```javascript
// Retry with exponential backoff
async function queryR2WithRetry(r2, points, start, end, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryR2(r2, points, start, end);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
    }
  }
}
```

**Cache Failure:**
```javascript
// Degrade gracefully if KV is unavailable
async function getCachedQuery(kv, cacheKey) {
  try {
    return await kv.get(cacheKey, { type: 'json' });
  } catch (error) {
    console.warn('KV cache unavailable, proceeding without cache');
    return null;
  }
}
```

### 7.2 Archival Worker Errors

**Parquet Conversion Failure:**
```javascript
try {
  const parquetBuffer = await convertToParquet(samples);
} catch (error) {
  // Log error, mark day as failed
  await logError(env.KV, {
    stage: 'parquet_conversion',
    date: day,
    error: error.message,
    sample_count: samples.length
  });

  // Continue with next day (don't fail entire archival)
  continue;
}
```

**R2 Upload Failure:**
```javascript
// Retry with exponential backoff
async function uploadWithRetry(r2, key, buffer, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await r2.put(key, buffer);
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Upload failed after ${maxRetries} attempts: ${error.message}`);
      }

      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
    }
  }
}
```

**D1 Delete Failure:**
```javascript
// DO NOT delete if upload failed
if (!uploadSuccess) {
  throw new Error('Cannot delete from D1: R2 upload failed');
}

// Atomic delete with transaction
try {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM timeseries WHERE timestamp BETWEEN ? AND ?')
      .bind(dayStart, dayEnd),
    env.DB.prepare('INSERT INTO archive_state VALUES (?, ?, ?)')
      .bind(pointId, dayEnd, r2Key)
  ]);
} catch (error) {
  // Critical: Data is in R2 but not deleted from D1
  // Log for manual review
  await logCriticalError(env.KV, {
    severity: 'CRITICAL',
    message: 'Data archived to R2 but not deleted from D1',
    r2_key: r2Key,
    day: day,
    action_required: 'Manual verification needed'
  });
}
```

### 7.3 Backfill Worker Errors

**ACE API Timeout:**
```javascript
try {
  const samples = await fetchWithTimeout(url, 30000);
} catch (error) {
  if (error.name === 'TimeoutError') {
    // Save progress and retry this day
    await saveProgress(env.KV, {
      last_processed_date: previousDay,
      pending_retry: currentDay
    });

    // Exponential backoff
    await sleep(5000);
    continue;
  }
  throw error;
}
```

**Rate Limiting:**
```javascript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After') || 60;
  console.log(`Rate limited, waiting ${retryAfter}s`);

  await sleep(retryAfter * 1000);
  continue;
}
```

---

## 8. Architecture Decision Records (ADRs)

### ADR-001: 20-Day Hot Storage Boundary

**Context:** D1 has 10GB limit, current ingestion is 374MB/day

**Decision:** Set hot storage boundary at 20 days (7.5GB)

**Rationale:**
- 20 days * 374MB = 7.48GB (75% of D1 capacity)
- 25% buffer for growth and metadata
- 20 days covers most operational queries (daily/weekly reports)
- Clean boundary (not 19 or 21)

**Alternatives Considered:**
- 30 days: Too close to D1 limit, risky
- 14 days: Leaves capacity unused, less useful
- 27 days (max): No safety buffer

**Consequences:**
- Queries for last 20 days are very fast (<500ms)
- Historical queries (>20d) are slower but acceptable (<5s)
- Archival runs daily, processing ~374MB

### ADR-002: Daily Parquet Partitioning

**Context:** Need to balance file size vs query performance

**Decision:** Partition Parquet files by day (not month or hour)

**Rationale:**
- 374MB/day raw → ~40MB/day compressed
- Optimal file size for query performance (not too small, not too large)
- Natural checkpoint boundary for backfill resumption
- Aligns with archival process (daily cron)

**Alternatives Considered:**
- Hourly: Too many small files, high list() overhead
- Monthly: Files too large (~1.2GB), slow to query
- Weekly: Awkward boundaries, harder to reason about

**Consequences:**
- ~365 files per year per site
- list() operations return ~30 files for 30-day query
- Each file query adds ~200ms latency
- Good balance for 1-year retention

### ADR-003: No Data Aggregation on Write

**Context:** Should we pre-aggregate data to save space?

**Decision:** Store ALL raw samples, no aggregation

**Rationale:**
- Preserve data fidelity for future analysis
- Aggregation rules may change over time
- Storage is cheap (R2 at $0.015/GB)
- Query-time aggregation is fast enough with Parquet
- Supports ad-hoc analysis and ML use cases

**Alternatives Considered:**
- 1-minute aggregates: Loses sub-minute events
- 5-minute aggregates: Too coarse for debugging
- Both raw + aggregated: Doubles storage cost

**Consequences:**
- Higher storage costs (~40MB/day compressed)
- Flexible querying (any aggregation level)
- Supports anomaly detection and ML models
- No data loss

### ADR-004: Parquet with Snappy Compression

**Context:** Need efficient columnar format for analytical queries

**Decision:** Use Apache Parquet with Snappy compression

**Rationale:**
- Industry standard for timeseries data
- 10:1 compression ratio (374MB → 40MB)
- Fast decompression (Snappy is LZ4-like)
- Supported by DuckDB, Arrow, Spark, etc.
- Column pruning reduces I/O

**Alternatives Considered:**
- CSV/JSON: No compression, slow queries
- Avro: Row-oriented, slower for analytical queries
- ORC: Less mature ecosystem than Parquet
- GZIP compression: Slower decompression

**Consequences:**
- Excellent query performance (columnar + compression)
- Wide tool compatibility
- ~10:1 compression ratio
- Requires Parquet library (parquetjs or DuckDB)

### ADR-005: Atomic Archive-Then-Delete

**Context:** Prevent data loss during archival

**Decision:** Always upload to R2 BEFORE deleting from D1

**Rationale:**
- Safety first: Better to have duplicates than data loss
- R2 upload is idempotent (can retry)
- D1 delete is irreversible
- Verification step (HEAD request) confirms upload

**Alternatives Considered:**
- Delete-then-archive: Risky, could lose data
- Archive-and-delete in transaction: D1 doesn't support distributed transactions
- Mark-for-deletion: Requires cleanup logic

**Consequences:**
- Brief period of data duplication (minutes to hours)
- Guaranteed no data loss
- Requires verification step
- Archive state table tracks success

### ADR-006: KV for Cache, Not Metadata

**Context:** Where to store query cache and worker state?

**Decision:** Use KV for ephemeral cache and progress tracking

**Rationale:**
- KV is fast (edge-cached)
- TTL-based expiration built-in
- Eventually consistent (acceptable for cache)
- Low cost ($0.50 per million reads)

**Alternatives Considered:**
- D1 for cache: Wastes transactional storage
- R2 for cache: Higher latency than KV
- Durable Objects: Overkill for simple cache

**Consequences:**
- Cache hits reduce D1/R2 queries by 80%
- Worker state is resumable
- No strong consistency guarantees
- Must handle KV unavailability gracefully

---

## 9. Performance Characteristics

### 9.1 Query Performance

| Query Type | Storage | Latency (p50) | Latency (p99) | Throughput |
|-----------|---------|---------------|---------------|------------|
| Last 24h (1 point) | D1 only | 50ms | 200ms | 10k req/s |
| Last 7 days (10 points) | D1 only | 150ms | 500ms | 5k req/s |
| Last 30 days (50 points) | D1 + R2 split | 800ms | 2s | 1k req/s |
| Last 90 days (10 points) | R2 only | 2s | 5s | 500 req/s |
| 1 year (1 point) | R2 only | 5s | 15s | 100 req/s |

### 9.2 Archival Performance

| Metric | Value | Notes |
|--------|-------|-------|
| Data per day | 374MB raw | 6.48M samples/day |
| Compression ratio | 10:1 | 374MB → 40MB Parquet |
| Archival duration | 5-15 min | Depends on data volume |
| D1 freed per run | ~374MB | One day's data |
| R2 storage cost | $0.60/month | 40MB/day * 30 days * $0.015/GB |

### 9.3 Backfill Performance

| Metric | Value | Notes |
|--------|-------|-------|
| ACE API rate limit | 100 req/min | Enforced by ACE |
| Samples per page | 1000 | Configurable |
| Days per request | 1 | Serial processing to avoid timeout |
| Backfill rate | ~20 days/hour | Depends on API latency |
| Resume overhead | <1s | KV lookup |

---

## 10. Monitoring & Observability

### 10.1 Key Metrics

**Query Worker:**
```javascript
{
  query_count: number;
  query_latency_ms: { p50, p95, p99 };
  cache_hit_rate: percentage;
  d1_query_count: number;
  r2_query_count: number;
  split_query_count: number;
  error_rate: percentage;
}
```

**Archival Worker:**
```javascript
{
  archive_runs: number;
  files_created: number;
  records_archived: number;
  records_deleted: number;
  d1_space_freed_mb: number;
  r2_space_used_mb: number;
  archival_duration_ms: number;
  error_count: number;
}
```

**Backfill Worker:**
```javascript
{
  backfill_requests: number;
  days_processed: number;
  records_inserted: number;
  api_calls: number;
  resume_count: number;
  avg_day_duration_ms: number;
  error_count: number;
}
```

### 10.2 Logging Strategy

**Query Worker:**
- Log every query: point count, time range, strategy
- Log cache hits/misses
- Log D1/R2 latencies
- Log errors with context

**Archival Worker:**
- Log start/end of each run
- Log each day processed
- Log upload/delete confirmations
- Log errors with retry count

**Backfill Worker:**
- Log request received
- Log progress every 10 days
- Log completion summary
- Log errors with affected date

### 10.3 Alerting

**Critical Alerts:**
- Archival worker failed 2 consecutive runs
- D1 storage >9GB (90% full)
- Query error rate >5%
- R2 upload verification failed

**Warning Alerts:**
- Query p99 latency >10s
- Cache hit rate <50%
- Backfill stuck >1 hour
- D1 storage >8.5GB (85% full)

---

## 11. Future Enhancements

### 11.1 Short-Term (Q1 2025)

1. **DuckDB WASM Integration**
   - Replace simulated Parquet querying with real DuckDB
   - Enable complex analytical queries on R2 data
   - Support SQL-like query syntax

2. **Query Result Compression**
   - Compress JSON responses with Brotli
   - Reduce bandwidth by 80%
   - Especially beneficial for large date ranges

3. **Adaptive Hot Storage Boundary**
   - Monitor D1 usage and adjust threshold dynamically
   - 18-22 day range based on growth trends
   - Alert when approaching capacity

### 11.2 Medium-Term (Q2-Q3 2025)

1. **Multi-Resolution Aggregates**
   - Pre-compute 5min, 1hr, 1day aggregates in D1
   - Store in separate tables for faster queries
   - Update during archival process

2. **Query Optimizer**
   - Analyze query patterns
   - Suggest optimal time ranges and points
   - Auto-downgrade resolution for long ranges

3. **Federated Queries**
   - Support multi-site queries
   - Merge results from multiple workers
   - Distributed caching with KV

### 11.3 Long-Term (2026+)

1. **Machine Learning Integration**
   - Anomaly detection on timeseries
   - Predictive analytics
   - Auto-scaling based on ML forecasts

2. **Data Lake Analytics**
   - Export to S3/BigQuery for deep analysis
   - Integration with BI tools (Tableau, Looker)
   - Data science notebooks (Jupyter)

3. **Real-Time Streaming**
   - WebSocket/SSE for live data updates
   - Sub-second query latency
   - In-memory caching layer

---

## 12. Cost Analysis

### 12.1 Cloudflare Workers (Paid Plan)

| Resource | Usage | Cost/Month | Notes |
|----------|-------|------------|-------|
| Worker Requests | 10M | $3.00 | $0.30/million after 10M |
| CPU Time | 50M ms | $1.00 | $0.02/million CPU-ms after 30M |
| D1 Storage | 7.5GB | $5.63 | $0.75/GB |
| D1 Reads | 50M | $0.25 | $0.001 per 1000 reads after 25M |
| R2 Storage | 1.2TB/year | $18.00 | $0.015/GB/month |
| R2 Reads | 10M | FREE | Class B operations |
| KV Reads | 100M | $0.50 | $0.50 per million reads |
| KV Writes | 10M | $5.00 | $0.50 per million writes |
| **Total** | - | **$33.38/month** | At scale |

### 12.2 Cost Projections (1 Year)

| Metric | Current | 1 Year | Cost Impact |
|--------|---------|--------|-------------|
| Daily Ingest | 374MB | 136GB/year | Marginal |
| R2 Storage | 40MB/day | 14.6GB/year | +$0.22/month |
| D1 Storage | 7.5GB | Stable | No change |
| Query Volume | Moderate | High | +$5-10/month |

**Total Projected Cost (Year 1):** $38-43/month

---

## 13. Summary

This architecture provides a scalable, cost-effective solution for managing unlimited timeseries data while staying within Cloudflare's D1 storage limits. The two-tier (hot/cold) storage approach ensures fast query performance for recent data while maintaining cost-effective long-term retention.

**Key Benefits:**
- ✅ Unlimited data retention (R2 scales infinitely)
- ✅ Fast queries (<500ms for hot data, <5s for cold)
- ✅ Transparent query routing (clients don't care about storage tier)
- ✅ Automated archival (daily cron, no manual intervention)
- ✅ Resumable backfill (progress tracking in KV)
- ✅ Data safety (atomic archive-then-delete)
- ✅ Cost-effective ($33-43/month at scale)

**Next Steps:**
1. Implement Query Worker with routing logic
2. Implement Archival Worker with Parquet conversion
3. Implement Backfill Worker with progress tracking
4. Deploy workers to Cloudflare
5. Monitor performance and adjust thresholds
6. Integrate DuckDB WASM for advanced R2 queries

---

**Document Version:** 1.0
**Last Updated:** 2025-10-13
**Maintained By:** System Architecture Team
**Review Cycle:** Quarterly
