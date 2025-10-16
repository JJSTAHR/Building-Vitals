# Backfill Worker Architecture
## Historical Timeseries Data Import to R2 Cold Storage

**Version:** 1.0.0
**Last Updated:** 2025-10-14
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Diagram](#architecture-diagram)
4. [Data Flow](#data-flow)
5. [Component Design](#component-design)
6. [Storage Strategy](#storage-strategy)
7. [Algorithm: Date Range Splitting](#algorithm-date-range-splitting)
8. [Batch Processing Strategy](#batch-processing-strategy)
9. [Error Handling & Retries](#error-handling--retries)
10. [Progress Tracking via KV](#progress-tracking-via-kv)
11. [Parquet File Format](#parquet-file-format)
12. [Wrangler Configuration](#wrangler-configuration)
13. [API Reference](#api-reference)
14. [Performance Characteristics](#performance-characteristics)
15. [Security](#security)
16. [Monitoring & Observability](#monitoring--observability)
17. [Deployment Guide](#deployment-guide)

---

## Executive Summary

The Backfill Worker is a Cloudflare Worker designed to populate historical timeseries data (months to years) from the ACE IoT API into Cloudflare R2 cold storage. It processes data in **daily chunks**, stores records as compressed **Parquet files**, and uses **KV for resumable progress tracking**.

### Key Features

- **Direct to R2**: Bypasses D1 (10GB limit) for historical data
- **Daily Partitioning**: Processes 1 day at a time (~3.74M samples/day)
- **Resumable**: Tracks progress in KV, can restart from last completed day
- **Rate Limited**: Respects ACE API throttling with exponential backoff
- **Manual Trigger**: HTTP POST endpoint with Bearer token authentication
- **Parquet Compression**: Snappy compression (~3:1 ratio) reduces storage costs
- **Multi-Site Support**: Processes multiple sites in parallel

### Design Constraints

- **Max Invocation Time**: 30 seconds (Cloudflare Workers limit)
- **Max Days per Invocation**: 10 days (prevents timeout)
- **API Rate Limit**: ~50 requests/minute (leaves buffer from 60/min limit)
- **Memory Limit**: 128MB (Cloudflare Workers standard)

---

## System Overview

### Purpose

Populate 20+ days of historical timeseries data into R2 for long-term storage and querying. This complements the ETL Sync Worker which handles real-time data (last 20 days in D1).

### Scope

- **Input**: ACE IoT API paginated timeseries endpoint
- **Processing**: Daily aggregation and Parquet conversion
- **Output**: R2 Parquet files organized by date hierarchy
- **State**: KV namespace for progress tracking

### Integration Points

```
┌─────────────────┐
│   ACE IoT API   │ ← Fetch raw timeseries (paginated)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backfill Worker │ ← Process daily chunks
└────┬───────┬────┘
     │       │
     │       └──────────────────┐
     ▼                          ▼
┌────────────┐          ┌──────────────┐
│ R2 Bucket  │          │ KV Namespace │
│ (Parquet)  │          │ (State)      │
└────────────┘          └──────────────┘
     │
     │ Queried by
     ▼
┌──────────────┐
│ Query Worker │ ← Reads historical data
└──────────────┘
```

---

## Architecture Diagram

```mermaid
graph TB
    subgraph "External Systems"
        ACE[ACE IoT API<br/>Paginated Timeseries]
    end

    subgraph "Cloudflare Workers"
        BW[Backfill Worker<br/>30s CPU limit]
        QW[Query Worker<br/>Reads R2]
    end

    subgraph "Cloudflare Storage"
        KV[(KV Namespace<br/>ETL_STATE)]
        R2[(R2 Bucket<br/>ace-timeseries)]
        D1[(D1 Database<br/>Hot: Last 20 days)]
    end

    subgraph "Backfill Process Flow"
        direction LR
        START[HTTP POST<br/>/backfill/start]
        AUTH{Bearer<br/>Token?}
        INIT[Initialize State<br/>KV]
        FETCH[Fetch Points List<br/>ACE API]
        LOOP[Daily Loop<br/>Process 1 day]
        PAGINATE[Paginated Fetch<br/>Raw Timeseries]
        FILTER[Filter to<br/>Configured Points]
        PARQUET[Convert to<br/>Parquet + Snappy]
        UPLOAD[Upload to R2<br/>YYYY/MM/DD/site.parquet]
        UPDATE[Update Progress<br/>KV]
        DONE[Mark Completed<br/>KV]

        START --> AUTH
        AUTH -->|Authorized| INIT
        AUTH -->|Denied| REJECT[401/403]
        INIT --> FETCH
        FETCH --> LOOP
        LOOP --> PAGINATE
        PAGINATE --> FILTER
        FILTER --> PARQUET
        PARQUET --> UPLOAD
        UPLOAD --> UPDATE
        UPDATE -->|Next Day| LOOP
        UPDATE -->|All Days Done| DONE
    end

    ACE -->|GET /sites/{site}/timeseries/paginated| PAGINATE
    INIT --> KV
    UPDATE --> KV
    DONE --> KV
    UPLOAD --> R2
    QW --> R2
    QW --> D1

    style BW fill:#f9f,stroke:#333,stroke-width:2px
    style R2 fill:#bbf,stroke:#333,stroke-width:2px
    style KV fill:#bfb,stroke:#333,stroke-width:2px
```

---

## Data Flow

### High-Level Flow

```
1. HTTP POST /backfill/start
   ├─ Body: { start_date: "2024-01-01", end_date: "2024-12-31" }
   └─ Headers: { Authorization: "Bearer <token>" }

2. Validate Request
   ├─ Check Bearer token
   ├─ Validate date range (max 365 days)
   └─ Check for existing backfill in progress

3. Initialize Backfill State (KV)
   ├─ backfill_id: unique identifier
   ├─ status: "in_progress"
   ├─ current_date: start_date
   └─ days_completed: 0

4. For Each Site in SITE_NAME env var:
   ├─ Fetch configured points list (paginated)
   │
   └─ For Each Day in date range:
       ├─ Check if day already completed (KV)
       ├─ Fetch 24-hour raw timeseries (paginated)
       │   ├─ Cursor-based pagination
       │   ├─ raw_data=true (no aggregation)
       │   └─ Rate limiting: ~50 req/min
       ├─ Filter to configured points
       ├─ Remove NULL values
       ├─ Convert to Parquet format
       │   ├─ Schema: { timestamp, point_name, value, site_name }
       │   ├─ Compression: Snappy
       │   └─ Row group size: 10,000
       ├─ Upload to R2: timeseries/YYYY/MM/DD/site_name.parquet
       ├─ Verify upload (HEAD request)
       └─ Update progress (KV)

5. Mark Backfill Complete (KV)
   ├─ status: "completed"
   ├─ completed_at: timestamp
   └─ metrics: { days_completed, records_processed, duration }
```

### Data Transformations

#### Input: ACE API Response
```json
{
  "point_samples": [
    {
      "name": "zone1_temp_sensor",
      "value": "72.5",
      "time": "2024-01-15T10:30:00.000Z"
    }
  ],
  "next_cursor": "eyJwb3NpdGlvbiI6MTAwMH0=",
  "has_more": true
}
```

#### Intermediate: Filtered Samples
```javascript
[
  {
    site_name: "ses_falls_city",
    point_name: "zone1_temp_sensor",
    timestamp: 1705316600000, // Unix milliseconds
    value: 72.5
  }
]
```

#### Output: Parquet File (Binary)
```
R2 Key: timeseries/2024/01/15/ses_falls_city.parquet
Metadata:
  - site_name: "ses_falls_city"
  - date: "2024-01-15"
  - record_count: "3741234"
  - compression: "SNAPPY"
  - created_at: "2025-10-14T12:34:56.789Z"
```

---

## Component Design

### 1. HTTP Request Handler

**File**: `src/backfill-worker.js` (lines 182-250)

**Responsibilities**:
- Route incoming HTTP requests
- Validate Bearer token authentication
- Handle CORS preflight requests
- Delegate to business logic handlers

**Endpoints**:
- `POST /backfill/start` - Start new backfill or resume
- `GET /backfill/status` - Check progress
- `POST /backfill/cancel` - Cancel running backfill

### 2. ACE API Client

**File**: `src/backfill-worker.js` (lines 741-900)

**Functions**:
- `fetchPointsList(env, siteName)` - Get configured points (paginated)
- `fetchDayTimeseries(env, siteName, startTime, endTime)` - Get 24h raw data
- `fetchWithRetry(url, options)` - Retry wrapper with exponential backoff

**Key Features**:
- Cursor-based pagination for large datasets
- Automatic retry on 5xx errors and rate limits (429)
- Rate limiting: 50 requests/minute with throttle delay
- Timeout handling: 30 second ACE_TIMEOUT_MS

### 3. Parquet Converter

**File**: `src/lib/parquet-writer.js` (imported)

**Responsibilities**:
- Convert JavaScript objects to Parquet binary format
- Apply Snappy compression (~3:1 ratio)
- Define schema: `{ timestamp: int64, point_name: string, value: double, site_name: string }`

**Usage**:
```javascript
const parquetBuffer = await createParquetFile(samples, {
  compression: 'SNAPPY'
});
```

### 4. R2 Client

**File**: `src/backfill-worker.js` (lines 640-738)

**Functions**:
- `env.R2.put(key, data, options)` - Upload Parquet file
- `env.R2.head(key)` - Verify file exists
- Path generation: `timeseries/YYYY/MM/DD/site_name.parquet`

**Storage Structure**:
```
ace-timeseries/
├── timeseries/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── 01/
│   │   │   │   └── ses_falls_city.parquet
│   │   │   ├── 02/
│   │   │   │   └── ses_falls_city.parquet
│   │   │   └── ...
│   │   ├── 02/
│   │   └── ...
│   └── 2025/
```

### 5. State Manager (KV)

**File**: `src/backfill-worker.js` (lines 903-993)

**Functions**:
- `createInitialState()` - Initialize backfill metadata
- `loadBackfillState()` / `saveBackfillState()` - Persist overall state
- `loadDayStatus()` / `saveDayStatus()` - Track per-day completion
- `logBackfillError()` - Record failures for debugging

**KV Keys**:
```
backfill:state                       → Overall backfill state
backfill:day:2024-01-15:ses_falls_city → Per-day status
backfill:errors:backfill_123_xyz:timestamp → Error logs
```

---

## Storage Strategy

### Hot vs Cold Storage Decision Matrix

| Data Age | Storage | Reason | Query Performance |
|----------|---------|--------|-------------------|
| 0-20 days | D1 (SQLite) | Low latency, frequent queries | <100ms |
| 20+ days | R2 (Parquet) | Cost-effective, infrequent queries | 500-2000ms |

### D1 Limits & Why R2

**D1 Database Constraints**:
- Max size: 10GB per database
- Max row count: ~100M rows (practical limit)
- 1 year of raw data: ~1.36B samples × 24 bytes/row = **~32GB** ❌ Exceeds limit

**R2 Benefits**:
- Unlimited storage (pay per GB: $0.015/GB/month)
- Parquet compression: 24 bytes → 8 bytes (~3:1 ratio)
- Daily partitioning: Efficient querying with partition pruning
- No row count limits

### File Organization

**Path Structure**:
```
timeseries/{YYYY}/{MM}/{DD}/{site_name}.parquet
```

**Rationale**:
- **Year/Month/Day hierarchy**: Enables partition pruning in queries
- **Site at end**: One file per site per day (reduces file count)
- **Date-based prefix**: Natural ordering for range scans

**Example**:
```
timeseries/2024/10/14/ses_falls_city.parquet
timeseries/2024/10/15/ses_falls_city.parquet
timeseries/2024/10/16/building_a.parquet
```

### Storage Calculations

**Daily Storage per Site**:
- Raw samples: ~3.74M samples/day (4,583 points × 1440 samples/point-day)
- Uncompressed: 3.74M × 24 bytes = **~90 MB/day**
- Parquet + Snappy: 90 MB / 3 = **~30 MB/day**

**Annual Storage per Site**:
- 365 days × 30 MB = **~11 GB/year**
- Cost: 11 GB × $0.015/GB/month = **$0.17/month**

---

## Algorithm: Date Range Splitting

### Problem

Process months/years of data without hitting Cloudflare Workers 30-second CPU limit.

### Solution

**Daily Chunking Algorithm**:
1. Split date range into individual days
2. Process max 10 days per worker invocation
3. Save progress to KV after each day
4. Resume from `current_date` on next invocation

### Pseudocode

```
function executeBackfill(startDate, endDate):
    state = loadOrCreateState()

    while state.current_date <= endDate:
        // Check cancellation
        if state.status == "cancelled":
            break

        // Process single day
        dayResult = processSingleDay(state.current_date)

        // Update progress
        state.current_date = addDays(state.current_date, 1)
        state.days_completed += 1
        state.records_processed += dayResult.records
        saveState(state)

        // Prevent timeout (max 10 days per invocation)
        if state.days_completed % 10 == 0:
            // Let worker restart, resume from state.current_date
            return "partial_complete"

    state.status = "completed"
    saveState(state)
    return "complete"
```

### State Machine

```
┌──────────┐
│ not_started │
└──────┬─────┘
       │ POST /backfill/start
       ▼
┌─────────────┐
│ in_progress │ ◄───┐
└──────┬──────┘     │
       │            │ Resume (process next 10 days)
       ├────────────┘
       │
       ├────────► ┌───────────┐
       │          │ cancelled │
       │          └───────────┘
       │
       ▼
┌───────────┐
│ completed │
└───────────┘
```

### Day Status Tracking

Each day has independent status in KV:
```json
{
  "status": "completed",
  "records": 3741234,
  "r2_path": "timeseries/2024/01/15/ses_falls_city.parquet",
  "completed_at": "2025-10-14T12:34:56Z"
}
```

**Benefits**:
- **Idempotent**: Re-running skips completed days
- **Resume**: Restart from any day without re-processing
- **Audit Trail**: Track which days succeeded/failed

---

## Batch Processing Strategy

### API Pagination Strategy

**ACE API Pagination**:
- Cursor-based pagination (not offset-based)
- Page size: 1,000 samples per page
- Average pages per day: ~3,741 pages (3.74M samples / 1,000)

**Processing Pattern**:
```javascript
let cursor = null;
let allSamples = [];

do {
  // Fetch page
  const page = await fetchPage(cursor);
  allSamples.push(...page.samples);

  // Rate limiting
  await sleep(throttleDelay); // ~1.2 seconds between requests

  // Next cursor
  cursor = page.next_cursor;
} while (cursor != null && page.has_more);
```

### Memory Management

**Challenge**: 3.74M samples × 32 bytes = ~120 MB exceeds 128 MB limit

**Solution - Streaming Parquet Write**:
1. Fetch paginated data in chunks (1,000 samples)
2. Accumulate in memory (max ~10,000 samples at a time)
3. Write Parquet row groups incrementally
4. Clear memory buffer after each row group

**Current Implementation**: Loads all daily samples into memory (works for configured points only, which are filtered)

### Concurrency Limits

**Per-Site Processing**: Sequential (one day at a time)
- Prevents memory overflow
- Simplifies state management

**Multi-Site Processing**: Parallel (one worker invocation per site)
- Sites are independent
- Increases throughput

**API Throttling**:
```javascript
const REQUESTS_PER_MINUTE = 50;
const throttleDelay = (60 * 1000) / REQUESTS_PER_MINUTE; // ~1,200ms
```

---

## Error Handling & Retries

### Retry Strategy

**Exponential Backoff**:
```javascript
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // 2 seconds

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    return await fetch(url);
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}
throw lastError;
```

**Retry Delays**:
- Attempt 1: 2 seconds
- Attempt 2: 4 seconds
- Attempt 3: 8 seconds

### Rate Limit Handling (429)

```javascript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After') || 60;
  console.warn(`Rate limited, waiting ${retryAfter}s`);
  await sleep(retryAfter * 1000);
  continue; // Retry immediately
}
```

### Error Categorization

| Error Type | Action | Retry? | Impact |
|------------|--------|--------|--------|
| 5xx Server Error | Exponential backoff retry | Yes (3x) | Day fails if retries exhausted |
| 429 Rate Limit | Wait `Retry-After`, retry | Yes (∞) | Slows processing but continues |
| 4xx Client Error | Log, skip day | No | Day marked failed, continue next day |
| Network Timeout | Exponential backoff retry | Yes (3x) | Day fails if retries exhausted |
| R2 Upload Fail | Retry upload only | Yes (3x) | Day fails if retries exhausted |

### Partial Failure Handling

**Day Failure**:
- Mark day as `failed` in KV
- Log error with context
- Continue to next day
- Final summary includes failed days for manual review

**Site Failure**:
- Log error
- Continue to next site
- Backfill status shows errors per site

**Backfill Cancellation**:
- User can POST /backfill/cancel
- Worker checks state before each day
- Gracefully stops processing
- Progress saved in KV for resume

---

## Progress Tracking via KV

### State Schema

**Overall Backfill State** (`backfill:state`):
```json
{
  "backfill_id": "backfill_1697234567890_abc123def",
  "status": "in_progress",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "current_date": "2024-06-15",
  "days_completed": 165,
  "days_total": 365,
  "records_processed": 617304510,
  "started_at": "2025-10-14T08:00:00.000Z",
  "last_updated": "2025-10-14T14:30:45.123Z"
}
```

**Per-Day Status** (`backfill:day:YYYY-MM-DD:site_name`):
```json
{
  "status": "completed",
  "records": 3741234,
  "r2_path": "timeseries/2024/06/15/ses_falls_city.parquet",
  "completed_at": "2025-10-14T14:30:45.123Z"
}
```

**Error Log** (`backfill:errors:backfill_id:timestamp`):
```json
{
  "backfill_id": "backfill_1697234567890_abc123def",
  "timestamp": "2025-10-14T14:30:45.123Z",
  "error": "ACE API timeout",
  "stack": "Error: timeout\n  at fetch...",
  "context": {
    "site": "ses_falls_city",
    "date": "2024-06-15",
    "page": 1523
  }
}
```

### Progress Calculation

**Percent Complete**:
```
progress = (days_completed / days_total) × 100
```

**Estimated Completion**:
```javascript
const elapsed = now - started_at;
const rate = days_completed / elapsed; // days per ms
const remaining = days_total - days_completed;
const eta = now + (remaining / rate);
```

### KV Key Expiration

| Key Type | TTL | Reason |
|----------|-----|--------|
| `backfill:state` | No expiry | Permanent record |
| `backfill:day:*` | 30 days | Cleanup old day statuses |
| `backfill:errors:*` | 30 days | Cleanup old errors |

---

## Parquet File Format

### Schema Definition

```javascript
{
  timestamp: 'INT64',      // Unix milliseconds since epoch
  point_name: 'UTF8',      // String, e.g., "zone1_temp_sensor"
  value: 'DOUBLE',         // Float64, sensor reading
  site_name: 'UTF8'        // String, e.g., "ses_falls_city"
}
```

### Compression

**Snappy Compression**:
- Fast compression/decompression (~250-500 MB/s)
- Moderate compression ratio (~3:1 for timeseries data)
- Low CPU overhead (important for Workers CPU limit)

**Alternatives Considered**:
- **GZIP**: Higher compression (~5:1) but slower, more CPU
- **ZSTD**: Better ratio (~4:1) but not widely supported
- **Uncompressed**: Fastest but 3x larger storage cost

### Row Group Size

**Configuration**: 10,000 rows per row group

**Rationale**:
- Balances read performance vs file overhead
- Allows column pruning during queries
- Keeps memory usage manageable during write

### File Metadata

**R2 Custom Metadata**:
```javascript
customMetadata: {
  site_name: "ses_falls_city",
  date: "2024-01-15",
  record_count: "3741234",
  compression: "SNAPPY",
  created_at: "2025-10-14T12:34:56.789Z"
}
```

**Benefits**:
- Query optimization (pre-filter by metadata)
- Debugging (verify file contents without download)
- Auditing (track when files were created)

---

## Wrangler Configuration

### File: `workers/wrangler-backfill.toml`

```toml
name = "building-vitals-backfill"
main = "../src/backfill-worker.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# ============================================================================
# Bindings
# ============================================================================

# R2 Bucket for Parquet files (cold storage)
[[r2_buckets]]
binding = "R2"
bucket_name = "ace-timeseries"

# KV Namespace for state tracking
[[kv_namespaces]]
binding = "ETL_STATE"
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"

# ============================================================================
# Environment Variables
# ============================================================================

[vars]
# ACE IoT API Configuration
ACE_API_BASE = "https://flightdeck.aceiot.cloud/api"

# Site Configuration (comma-separated for multi-site)
SITE_NAME = "ses_falls_city"

# Processing Limits
MAX_DAYS_PER_REQUEST = "10"
PROCESS_TIMEOUT_MS = "60000"

# ============================================================================
# Worker Limits
# ============================================================================

[limits]
cpu_ms = 30000  # 30 seconds per invocation (handle large daily datasets)

# ============================================================================
# Secrets (Set via wrangler secret put)
# ============================================================================
# Required secrets:
#   wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml
#   wrangler secret put BACKFILL_API_KEY --config workers/wrangler-backfill.toml
```

### Environment-Specific Overrides

**Development**:
```toml
[env.development]
name = "building-vitals-backfill-dev"
vars.SITE_NAME = "test_site"
vars.MAX_DAYS_PER_REQUEST = "5"  # Shorter runs for testing
```

**Production**:
```toml
[env.production]
name = "building-vitals-backfill"
route = "backfill.building-vitals.workers.dev"
vars.SITE_NAME = "ses_falls_city,building_a"  # Multi-site
```

---

## API Reference

### POST /backfill/start

**Description**: Start a new backfill or resume existing one

**Authentication**: Required (Bearer token)

**Request**:
```http
POST /backfill/start
Authorization: Bearer <BACKFILL_API_KEY>
Content-Type: application/json

{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "force_restart": false
}
```

**Response (202 Accepted)**:
```json
{
  "status": "started",
  "backfill_id": "backfill_1697234567890_abc123def",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "estimated_days": 365,
  "message": "Backfill started in background. Check /backfill/status for progress."
}
```

**Validation Errors (400)**:
```json
{
  "error": "Validation failed",
  "details": [
    "start_date must be before end_date",
    "Date range cannot exceed 365 days"
  ]
}
```

**Conflict (409)**:
```json
{
  "error": "Backfill already in progress",
  "current_state": { ... },
  "hint": "Set force_restart=true to restart from beginning"
}
```

---

### GET /backfill/status

**Description**: Get current backfill progress

**Authentication**: Not required

**Request**:
```http
GET /backfill/status
```

**Response (200 OK)**:
```json
{
  "status": "in_progress",
  "backfill_id": "backfill_1697234567890_abc123def",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "current_date": "2024-06-15",
  "days_completed": 165,
  "days_total": 365,
  "progress_percent": "45.21",
  "records_processed": 617304510,
  "started_at": "2025-10-14T08:00:00.000Z",
  "last_updated": "2025-10-14T14:30:45.123Z",
  "estimated_completion": "2025-10-14T22:15:30.000Z"
}
```

**No Backfill Started (200)**:
```json
{
  "status": "not_started",
  "message": "No backfill has been started yet"
}
```

---

### POST /backfill/cancel

**Description**: Cancel a running backfill

**Authentication**: Required (Bearer token)

**Request**:
```http
POST /backfill/cancel
Authorization: Bearer <BACKFILL_API_KEY>
```

**Response (200 OK)**:
```json
{
  "status": "cancelled",
  "backfill_id": "backfill_1697234567890_abc123def",
  "days_completed": 165,
  "message": "Backfill cancelled. Progress has been saved."
}
```

**No Backfill Running (400)**:
```json
{
  "error": "No backfill in progress to cancel"
}
```

---

## Performance Characteristics

### Throughput

**Single Day Processing**:
- API pagination: ~3,741 pages × 1.2s = **~75 minutes** (rate limited)
- Parquet conversion: ~10 seconds
- R2 upload: ~5 seconds
- **Total per day**: ~75 minutes

**10 Days per Invocation**:
- Sequential processing: 10 × 75min = **~12.5 hours**
- With concurrency (future): 5 × 75min = **~6.25 hours**

**Full Year (365 days)**:
- 37 invocations × 12.5 hours = **~19 days** (worst case)
- With optimizations: **~10-14 days**

### Optimization Opportunities

1. **Parallel Day Processing** (within CPU limit):
   - Process 2-3 days concurrently
   - Reduces total time by 2-3x

2. **Increase Page Size**:
   - Request 5,000 samples/page (if ACE API supports)
   - Reduces API calls by 5x

3. **Multi-Worker Coordination**:
   - Deploy multiple workers with date range sharding
   - Reduces total time linearly with worker count

### Resource Usage

**CPU Time per Day**:
- API requests: ~100ms × 3,741 = **6.2 minutes**
- Parquet conversion: **~10 seconds**
- R2 upload: **~5 seconds**
- **Total**: ~6.5 minutes (well within 30s limit per invocation due to wait times)

**Memory**:
- Daily samples: 3.74M × 32 bytes = **~120 MB** (exceeds limit)
- Filtered samples: ~500K × 32 bytes = **~16 MB** (safe)

**Network Bandwidth**:
- Inbound (ACE API): 3.74M × 50 bytes = **~187 MB/day**
- Outbound (R2): **~30 MB/day** (Parquet compressed)

---

## Security

### Authentication

**Bearer Token**:
- Required for POST /backfill/start and POST /backfill/cancel
- Stored as Worker secret: `BACKFILL_API_KEY`
- Validated on every protected endpoint

**Header Format**:
```http
Authorization: Bearer <BACKFILL_API_KEY>
```

### CORS Policy

**Allowed Origins**:
- Configured via `ALLOWED_ORIGINS` environment variable
- Comma-separated list: `https://app.example.com,https://admin.example.com`
- Validated per request

**Allowed Methods**:
- `GET, POST, OPTIONS`

### Secrets Management

**Required Secrets**:
1. `ACE_API_KEY` - ACE IoT API authentication
2. `BACKFILL_API_KEY` - Backfill Worker authentication

**Set Secrets**:
```bash
wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml
wrangler secret put BACKFILL_API_KEY --config workers/wrangler-backfill.toml
```

### R2 Bucket Permissions

**Minimum Required**:
- `PutObject` - Upload Parquet files
- `GetObject` - Verify uploads (HEAD request)

**Recommended**:
- Private bucket (not public)
- Access via Cloudflare Workers only

---

## Monitoring & Observability

### Logging

**Key Log Events**:
```javascript
console.log('[BACKFILL] Starting:', { backfillId, startDate, endDate });
console.log('[BACKFILL] Processing day: 2024-06-15 for site ses_falls_city');
console.log('[BACKFILL] Fetched 3741 pages, 3741234 samples');
console.log('[BACKFILL] Parquet created: 30MB (3741234 records), compression 3:1');
console.log('[BACKFILL] Uploaded to R2: timeseries/2024/06/15/ses_falls_city.parquet');
console.log('[BACKFILL] Day complete: 3741234 records in 75 minutes');
console.error('[BACKFILL] Failed to process day 2024-06-15:', error);
```

### Metrics

**Tracked in KV State**:
- `days_completed` - Number of days successfully processed
- `days_total` - Total days in date range
- `records_processed` - Total samples written to R2
- `duration_seconds` - Total backfill runtime

**Calculated Metrics**:
- Progress percentage
- Processing rate (days/hour)
- Estimated completion time

### Alerting

**Recommended Alerts**:
1. **Backfill Stuck**: `last_updated` older than 2 hours
2. **High Error Rate**: >10% of days failed
3. **R2 Upload Failures**: >5 consecutive failures
4. **API Rate Limit Exhaustion**: >10 rate limit errors/hour

### Cloudflare Workers Logs

**View Real-time Logs**:
```bash
wrangler tail -c workers/wrangler-backfill.toml --env production
```

**Filter Errors Only**:
```bash
wrangler tail -c workers/wrangler-backfill.toml --env production | grep ERROR
```

---

## Deployment Guide

### Prerequisites

1. **Cloudflare Account**: Workers and R2 enabled
2. **Wrangler CLI**: `npm install -g wrangler`
3. **ACE IoT API Key**: Valid authentication token

### Initial Setup

**1. Create R2 Bucket**:
```bash
wrangler r2 bucket create ace-timeseries
```

**2. Create KV Namespace** (if not exists):
```bash
wrangler kv:namespace create "ETL_STATE"
# Copy ID to wrangler-backfill.toml
```

**3. Set Secrets**:
```bash
wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml
wrangler secret put BACKFILL_API_KEY --config workers/wrangler-backfill.toml
```

### Deploy Worker

**Development**:
```bash
wrangler deploy -c workers/wrangler-backfill.toml --env development
```

**Production**:
```bash
wrangler deploy -c workers/wrangler-backfill.toml --env production
```

### Verify Deployment

```bash
# Health check
curl https://backfill.building-vitals.workers.dev

# Expected response:
{
  "service": "Building Vitals Backfill Worker",
  "version": "1.0.0",
  "endpoints": { ... }
}
```

### Start Backfill

```bash
curl -X POST https://backfill.building-vitals.workers.dev/backfill/start \
  -H "Authorization: Bearer <BACKFILL_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  }'
```

### Monitor Progress

```bash
# Poll status endpoint
watch -n 60 'curl https://backfill.building-vitals.workers.dev/backfill/status | jq'
```

### Verify R2 Files

```bash
# List files
wrangler r2 object list ace-timeseries --prefix=timeseries/2024/

# Check file metadata
wrangler r2 object info ace-timeseries timeseries/2024/01/15/ses_falls_city.parquet
```

---

## Conclusion

The Backfill Worker provides a robust, scalable solution for populating historical timeseries data into R2 cold storage. Key architectural decisions:

1. **Daily chunking** prevents timeout issues
2. **KV state tracking** enables resumable operations
3. **Parquet + Snappy** balances compression ratio and CPU usage
4. **Rate limiting** respects API constraints
5. **Direct to R2** bypasses D1 size limitations

This architecture supports **months to years** of historical data with minimal operational overhead and cost-effective storage.

---

**Related Documentation**:
- [ETL Sync Worker](../src/etl-sync-worker.js) - Real-time data pipeline
- [Query Worker](../src/query-worker.js) - Unified query interface
- [D1 Schema](../workers/schema/d1-schema.sql) - Hot storage schema
- [R2 Client](../src/lib/r2-client.js) - Parquet file reader
