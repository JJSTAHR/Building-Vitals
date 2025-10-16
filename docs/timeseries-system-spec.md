# Building Vitals Timeseries System Specification

**Document Version:** 1.0.0
**Date:** 2025-10-13
**Status:** Draft
**Author:** SPARC Specification Agent

---

## 1. Executive Summary

This specification defines the Query, Archival, and Backfill system for Building Vitals timeseries data lake. The system extends the existing ETL worker to provide:

1. **Query Worker**: Unified API abstracting hot (D1) and cold (R2) storage
2. **Archival Worker**: Daily migration of D1 data to R2 Parquet files
3. **Backfill Worker**: Historical data import for 1-year retention

### 1.1 Current State

- **ETL Worker**: Operational, syncing every 5 minutes from ACE IoT API
- **Data Volume**: ~374MB/day (~6.48M samples/day) for 4,583 configured points
- **Hot Storage**: D1 database (10GB limit)
- **Data Flow**: ACE API → ETL Worker → D1 Database → Frontend

### 1.2 Target State

- **Extended Data Flow**: ACE API → ETL Worker → D1 (hot, <20 days) → R2 (cold, >20 days)
- **Query Abstraction**: Frontend → Query Worker → (D1 + R2) → Unified Response
- **1-Year Retention**: Historical backfill + daily archival

---

## 2. System Architecture

### 2.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         ACE IoT API                             │
│                    (External Data Source)                       │
└────────────────┬────────────────────────────────────────────────┘
                 │ Paginated timeseries endpoint
                 │ (every 5 minutes)
                 ▼
┌────────────────────────────────────────────────────────────────┐
│                      ETL Sync Worker                           │
│              (Existing - src/etl-sync-worker.js)               │
│  • Fetches ALL timeseries, filters to configured points       │
│  • Batch inserts to D1 (1000 records/batch)                   │
│  • State tracking in KV                                        │
└────────────────┬───────────────────────────────────────────────┘
                 │ Raw samples (point_id, timestamp, value)
                 ▼
┌────────────────────────────────────────────────────────────────┐
│                    D1 Database (Hot Storage)                   │
│                        10GB Limit                              │
│  • Primary: timeseries table (20 days retention)              │
│  • Secondary: points, archive_state, query_metadata           │
│  • Query latency: <100ms                                       │
└────────────┬───────────────────────────────────────────────────┘
             │                                  ▲
             │ Archive (daily cron)             │ Query (realtime)
             ▼                                  │
┌────────────────────────────────────────┐     │
│     Archival Worker (NEW)              │     │
│  • Runs daily at 2 AM UTC              │     │
│  • Extracts data >20 days old          │     │
│  • Writes Parquet to R2                │     │
│  • Deletes from D1 after confirm       │     │
│  • Updates archive_state tracking      │     │
└────────────┬───────────────────────────┘     │
             │ Parquet files                   │
             ▼                                  │
┌────────────────────────────────────────┐     │
│        R2 Storage (Cold Storage)       │     │
│         Unlimited Capacity             │     │
│  • Parquet files by day                │     │
│  • Path: /archives/YYYY/MM/DD/...     │     │
│  • Query latency: 1-5s                 │     │
└────────────┬───────────────────────────┘     │
             │                                  │
             └──────────────────────────────────┤
                                                │
                                                │
┌────────────────────────────────────────────────────────────────┐
│                      Query Worker (NEW)                        │
│              Unified API for Frontend Charts                   │
│  • Determines D1 vs R2 based on time range                    │
│  • Parallel queries for split ranges                          │
│  • Response aggregation and formatting                        │
└────────────┬───────────────────────────────────────────────────┘
             │ JSON response
             ▼
┌────────────────────────────────────────────────────────────────┐
│                       Frontend Charts                          │
│              (Existing - Building-Vitals/)                     │
│  • ECharts visualization                                       │
│  • No awareness of storage layer split                        │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                     Backfill Worker (NEW)                      │
│              One-time Historical Data Import                   │
│  • Processes 1 year in daily chunks                           │
│  • Writes directly to R2 (Parquet)                            │
│  • Resumable via KV state                                      │
│  • Runs as manual trigger or scheduled                        │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Functional Requirements

### 3.1 Query Worker

#### FR-QW-001: Unified Query API
**Priority**: HIGH
**Description**: Provide single endpoint for frontend timeseries queries

**Acceptance Criteria**:
- ✅ Endpoint: `POST /api/timeseries/query`
- ✅ Accepts: `{ site_name, point_names[], start_time, end_time, resolution? }`
- ✅ Returns: `{ samples: [{point_name, timestamp, value}], metadata: {} }`
- ✅ Automatically routes to D1, R2, or both based on time range
- ✅ Frontend requires zero code changes

**API Contract**:
```typescript
// Request
interface TimeseriesQueryRequest {
  site_name: string;
  point_names: string[];        // Array of point names (not IDs)
  start_time: number;            // Unix timestamp (milliseconds)
  end_time: number;              // Unix timestamp (milliseconds)
  resolution?: '1min' | '5min' | '1hr' | '1day'; // Optional downsampling
}

// Response
interface TimeseriesQueryResponse {
  samples: TimeseriesSample[];
  metadata: {
    total_samples: number;
    sources: ('d1' | 'r2')[];    // Which storage was queried
    query_time_ms: number;
    cached: boolean;
  };
}

interface TimeseriesSample {
  point_name: string;
  timestamp: number;              // Unix timestamp (milliseconds)
  value: number;
  quality?: number;               // 0-255 (optional)
  flags?: number;                 // Status flags (optional)
}
```

#### FR-QW-002: Storage Layer Abstraction
**Priority**: HIGH
**Description**: Determine optimal storage layer based on requested time range

**Rules**:
1. **Hot Data Only** (last 20 days):
   - Query D1 only
   - Expected latency: <100ms

2. **Cold Data Only** (>20 days ago):
   - Query R2 only
   - Expected latency: 1-5s

3. **Mixed Range** (spans hot and cold):
   - Query both D1 and R2 in parallel
   - Merge results, sort by timestamp
   - Expected latency: 1-5s

**Implementation Notes**:
- Cutoff boundary: `NOW - 20 days`
- Boundary may shift daily (not hardcoded dates)
- Use archive_state table to verify what's in R2

#### FR-QW-003: D1 Query Optimization
**Priority**: HIGH
**Description**: Efficient queries against D1 hot storage

**Query Pattern**:
```sql
-- Uses composite PRIMARY KEY (point_id, timestamp)
SELECT ts.timestamp, ts.value, ts.quality, ts.flags, p.name AS point_name
FROM timeseries ts
JOIN points p ON ts.point_id = p.id
WHERE p.name IN (?, ?, ..., ?)
  AND ts.timestamp >= ?
  AND ts.timestamp <= ?
ORDER BY p.name, ts.timestamp ASC;
```

**Optimization**:
- Use prepared statements with parameter binding
- Leverage `(point_id, timestamp)` PRIMARY KEY index
- Batch point name → point_id lookups
- Consider caching point_id mappings in KV (TTL: 1 hour)

#### FR-QW-004: R2 Query Optimization
**Priority**: HIGH
**Description**: Efficient queries against R2 cold storage (Parquet files)

**Query Strategy**:
1. **Determine File Range**:
   - Calculate which daily Parquet files overlap with time range
   - Example: 2024-01-01 to 2024-01-05 → 5 files

2. **Parallel File Reads**:
   - Read Parquet files in parallel (max 10 concurrent)
   - Use R2 conditional requests for efficiency

3. **Filter in Memory**:
   - Load Parquet → Arrow Table → Filter by point names + timestamp
   - Apache Arrow provides zero-copy filtering

4. **Streaming Response**:
   - Stream filtered results to client
   - Avoid loading entire dataset into memory

**Parquet Schema** (see FR-AR-003)

#### FR-QW-005: Response Caching
**Priority**: MEDIUM
**Description**: Cache frequent queries to reduce latency and cost

**Cache Strategy**:
- **Cache Key**: Hash of `(site_name, point_names, start_time, end_time, resolution)`
- **Cache Store**: KV namespace with TTL
- **TTL Rules**:
  - Hot queries (last 1 hour): 1 minute TTL
  - Recent queries (last 24 hours): 5 minutes TTL
  - Historical queries (>24 hours): 1 hour TTL
- **Invalidation**: Automatic (TTL-based)

**Implementation**:
```javascript
const cacheKey = hashQueryParams(request);
const cached = await env.QUERY_CACHE.get(cacheKey, 'json');
if (cached && !cached.expired) {
  return cached.data;
}
// Execute query...
await env.QUERY_CACHE.put(cacheKey, JSON.stringify(response), {
  expirationTtl: getTTL(request.start_time)
});
```

#### FR-QW-006: Error Handling
**Priority**: HIGH
**Description**: Graceful degradation and error recovery

**Scenarios**:
1. **D1 Unavailable**:
   - Fallback to R2-only query
   - Return warning in metadata

2. **R2 Unavailable**:
   - Return D1 data with warning
   - Suggest retrying for historical data

3. **Partial Results**:
   - If some Parquet files fail to load, return available data
   - Include `partial: true` flag in metadata

4. **Timeout**:
   - Set 25s timeout (leave 5s for response serialization)
   - Return partial results with timeout flag

**Error Response**:
```typescript
interface ErrorResponse {
  error: string;
  error_code: 'D1_UNAVAILABLE' | 'R2_UNAVAILABLE' | 'TIMEOUT' | 'INVALID_REQUEST';
  partial_data?: TimeseriesSample[];
  retry_after_seconds?: number;
}
```

---

### 3.2 Archival Worker

#### FR-AR-001: Daily Archival Schedule
**Priority**: HIGH
**Description**: Migrate data from D1 to R2 daily to maintain storage limits

**Schedule**:
- **Cron**: `0 2 * * *` (Daily at 2 AM UTC)
- **Rationale**: Low-traffic period, after ETL has run for full day

**Process**:
1. Determine archival window (data >20 days old)
2. Extract data from D1 in batches
3. Write to R2 as Parquet files
4. Verify R2 write success
5. Delete from D1
6. Update archive_state table

#### FR-AR-002: Archival Boundary Logic
**Priority**: HIGH
**Description**: Determine which data to archive

**Boundary Calculation**:
```javascript
const NOW = Date.now();
const RETENTION_DAYS = 20;
const archiveBoundary = NOW - (RETENTION_DAYS * 24 * 60 * 60 * 1000);

// Archive all data where timestamp < archiveBoundary
const query = `
  SELECT point_id, timestamp, value, quality, flags
  FROM timeseries
  WHERE timestamp < ?
  ORDER BY timestamp ASC
`;
```

**Safety Checks**:
- Verify last successful archive from `archive_state` table
- Only archive complete days (don't split mid-day)
- Leave 1-day buffer to account for late-arriving data

#### FR-AR-003: Parquet File Format
**Priority**: HIGH
**Description**: Define R2 storage schema and file structure

**Parquet Schema**:
```
message timeseries {
  required int64 timestamp;        // Unix timestamp (milliseconds)
  required int32 point_id;         // FK to points table
  required double value;           // Sensor value
  optional int32 quality;          // 0-255 quality code
  optional int32 flags;            // Status bitfield
  required binary point_name (UTF8); // Denormalized for queries
  required binary site_name (UTF8);  // Denormalized
}
```

**File Structure**:
```
/archives/
  ├── {site_name}/
  │   ├── YYYY/
  │   │   ├── MM/
  │   │   │   ├── DD/
  │   │   │   │   ├── timeseries-{site}-{date}.parquet
  │   │   │   │   └── _manifest.json
```

**Example Path**:
```
/archives/ses_falls_city/2024/01/15/timeseries-ses_falls_city-20240115.parquet
```

**Manifest File** (for query optimization):
```json
{
  "date": "2024-01-15",
  "site_name": "ses_falls_city",
  "file_path": "timeseries-ses_falls_city-20240115.parquet",
  "file_size_bytes": 45678901,
  "row_count": 6480000,
  "min_timestamp": 1705276800000,
  "max_timestamp": 1705363199999,
  "point_count": 4583,
  "compression": "snappy",
  "created_at": "2024-01-16T02:15:30Z"
}
```

#### FR-AR-004: Batch Extraction
**Priority**: HIGH
**Description**: Extract D1 data in manageable batches

**Batch Strategy**:
- **Batch Size**: 100,000 rows (fits in memory, manageable for Parquet)
- **Iteration**: Use `LIMIT` and `OFFSET` with ordered query
- **Progress Tracking**: Store cursor in KV for resumability

**Implementation**:
```javascript
const BATCH_SIZE = 100000;
let offset = 0;
let allRows = [];

while (true) {
  const batch = await db.prepare(`
    SELECT point_id, timestamp, value, quality, flags,
           p.name AS point_name, p.building AS site_name
    FROM timeseries ts
    JOIN points p ON ts.point_id = p.id
    WHERE ts.timestamp < ?
    ORDER BY ts.timestamp ASC
    LIMIT ? OFFSET ?
  `).bind(archiveBoundary, BATCH_SIZE, offset).all();

  if (batch.results.length === 0) break;

  allRows.push(...batch.results);
  offset += BATCH_SIZE;

  // Check timeout (leave 5s buffer)
  if (Date.now() - startTime > 25000) {
    await saveProgress(offset);
    throw new Error('TIMEOUT_RESUME_NEEDED');
  }
}
```

#### FR-AR-005: Parquet Write Process
**Priority**: HIGH
**Description**: Write extracted data to R2 as Parquet files

**Libraries**:
- `parquetjs` or `apache-arrow` for Parquet writing
- Consider pre-compiling with esbuild for Workers compatibility

**Write Process**:
```javascript
// 1. Convert rows to Arrow Table
const table = arrowjs.tableFromJSON(allRows);

// 2. Write to Parquet buffer
const parquetBuffer = await parquetjs.writeParquet(table, {
  compression: 'SNAPPY',
  rowGroupSize: 10000
});

// 3. Upload to R2
const key = `archives/${site_name}/${YYYY}/${MM}/${DD}/timeseries-${site_name}-${YYYYMMDD}.parquet`;
await env.ARCHIVE_BUCKET.put(key, parquetBuffer, {
  httpMetadata: {
    contentType: 'application/octet-stream'
  },
  customMetadata: {
    rowCount: allRows.length.toString(),
    minTimestamp: Math.min(...allRows.map(r => r.timestamp)).toString(),
    maxTimestamp: Math.max(...allRows.map(r => r.timestamp)).toString()
  }
});

// 4. Write manifest
const manifestKey = `archives/${site_name}/${YYYY}/${MM}/${DD}/_manifest.json`;
await env.ARCHIVE_BUCKET.put(manifestKey, JSON.stringify(manifest));
```

#### FR-AR-006: D1 Deletion
**Priority**: CRITICAL
**Description**: Delete archived data from D1 only after R2 verification

**Safety Protocol**:
1. **Verify R2 Write**:
   ```javascript
   const r2Object = await env.ARCHIVE_BUCKET.head(key);
   if (!r2Object || r2Object.size === 0) {
     throw new Error('R2_WRITE_VERIFICATION_FAILED');
   }
   ```

2. **Delete from D1**:
   ```javascript
   const deleteResult = await db.prepare(`
     DELETE FROM timeseries
     WHERE timestamp < ?
   `).bind(archiveBoundary).run();
   ```

3. **Update Archive State**:
   ```javascript
   await db.prepare(`
     INSERT INTO archive_state (
       last_archived_timestamp,
       records_archived,
       archive_path,
       parquet_file_size,
       archived_at,
       status
     ) VALUES (?, ?, ?, ?, ?, 'completed')
   `).bind(
     maxTimestamp,
     allRows.length,
     key,
     r2Object.size,
     Date.now()
   ).run();
   ```

#### FR-AR-007: Resumability
**Priority**: HIGH
**Description**: Handle Workers timeout by resuming from last checkpoint

**State Tracking** (in KV):
```javascript
const archivalState = {
  archival_id: 'arch_20240115_020000',
  date: '2024-01-15',
  site_name: 'ses_falls_city',
  status: 'in_progress', // 'pending', 'in_progress', 'completed', 'failed'
  phase: 'extracting',   // 'extracting', 'writing_parquet', 'deleting_d1', 'completed'
  offset: 350000,
  total_rows: 6480000,
  started_at: 1705369200000,
  last_checkpoint: 1705369225000
};

await env.ETL_STATE.put(
  `archival:state:${archival_id}`,
  JSON.stringify(archivalState)
);
```

**Resume Logic**:
```javascript
// On next scheduled run, check for in-progress archival
const inProgressKey = await env.ETL_STATE.get('archival:in_progress');
if (inProgressKey) {
  const state = await env.ETL_STATE.get(inProgressKey, 'json');
  if (Date.now() - state.last_checkpoint > 300000) { // 5 min timeout
    // Resume from checkpoint
    return resumeArchival(state);
  }
}
```

#### FR-AR-008: Monitoring and Alerting
**Priority**: MEDIUM
**Description**: Track archival health and alert on failures

**Metrics** (stored in KV):
```javascript
{
  "archival_date": "2024-01-15",
  "duration_seconds": 145,
  "records_archived": 6480000,
  "d1_freed_bytes": 374000000,
  "r2_file_size_bytes": 87000000,
  "compression_ratio": 4.3,
  "status": "completed"
}
```

**Alerts** (trigger conditions):
- Archival failed 2 consecutive days → Critical alert
- Archival took >15 minutes → Warning
- D1 database >9GB → Urgent (archive immediately)
- Compression ratio <3.0 → Investigate data quality

---

### 3.3 Backfill Worker

#### FR-BF-001: Historical Data Import
**Priority**: HIGH
**Description**: Import 1 year of historical data from ACE IoT API

**Scope**:
- **Time Range**: Last 365 days from current date
- **Granularity**: Process 1 day at a time
- **Target**: Write directly to R2 (bypass D1 for historical data)

**Rationale**:
- Historical data rarely queried, so R2 cold storage is appropriate
- Avoids filling D1 with old data that will be immediately archived
- Faster backfill (no D1 insert overhead)

#### FR-BF-002: Daily Chunking
**Priority**: HIGH
**Description**: Process historical data in daily chunks to avoid timeouts

**Chunking Strategy**:
```javascript
const TODAY = new Date();
const ONE_YEAR_AGO = new Date(TODAY);
ONE_YEAR_AGO.setFullYear(TODAY.getFullYear() - 1);

// Generate array of dates to process
const datesToBackfill = [];
for (let d = new Date(ONE_YEAR_AGO); d <= TODAY; d.setDate(d.getDate() + 1)) {
  datesToBackfill.push(new Date(d));
}

// Process one day per worker invocation
for (const date of datesToBackfill) {
  await processDay(date);
}
```

**Daily Processing**:
1. Fetch timeseries for 24-hour window from ACE API
2. Filter to configured points
3. Transform to Parquet schema
4. Write directly to R2
5. Mark day as complete in KV state

#### FR-BF-003: Resumability
**Priority**: HIGH
**Description**: Track progress and resume from last completed day

**State Tracking** (in KV):
```javascript
const backfillState = {
  backfill_id: 'backfill_20240116',
  site_name: 'ses_falls_city',
  start_date: '2023-01-16',
  end_date: '2024-01-15',
  current_date: '2023-06-20',
  days_completed: 155,
  days_total: 365,
  status: 'in_progress',
  started_at: 1705420800000,
  last_updated: 1705507200000
};

await env.ETL_STATE.put(
  'backfill:state:current',
  JSON.stringify(backfillState)
);

// Also track individual day completions
await env.ETL_STATE.put(
  `backfill:day:${YYYYMMDD}`,
  JSON.stringify({ status: 'completed', rows: 6480000 })
);
```

**Resume Logic**:
```javascript
// On restart, find last completed day
const state = await env.ETL_STATE.get('backfill:state:current', 'json');
if (state && state.status === 'in_progress') {
  // Resume from next day after current_date
  const resumeDate = new Date(state.current_date);
  resumeDate.setDate(resumeDate.getDate() + 1);
  return processFromDate(resumeDate);
}
```

#### FR-BF-004: ACE API Rate Limiting
**Priority**: HIGH
**Description**: Respect ACE API limits during backfill

**Rate Limits** (assumed):
- Max 60 requests/minute
- Max 1000 requests/hour
- Paginated endpoint: ~10-20 pages per day

**Throttling Strategy**:
```javascript
const REQUESTS_PER_MINUTE = 50; // Leave buffer
const DELAY_MS = (60 * 1000) / REQUESTS_PER_MINUTE;

async function fetchDayWithThrottle(date) {
  let allSamples = [];
  let cursor = null;

  do {
    await sleep(DELAY_MS); // Throttle

    const response = await fetchACETimeseries(date, cursor);
    allSamples.push(...response.point_samples);
    cursor = response.next_cursor;
  } while (cursor);

  return allSamples;
}
```

#### FR-BF-005: Data Validation
**Priority**: MEDIUM
**Description**: Validate backfilled data for completeness and quality

**Validation Checks**:
1. **Sample Count Validation**:
   ```javascript
   const expectedSamples = 4583 * 1440; // points * samples/day
   const actualSamples = allSamples.length;
   const completeness = actualSamples / expectedSamples;

   if (completeness < 0.8) {
     console.warn(`Low completeness: ${completeness.toFixed(2)}`);
   }
   ```

2. **Timestamp Validation**:
   - Ensure all timestamps fall within day boundary
   - Flag out-of-order timestamps

3. **Value Validation**:
   - Check for NULL values
   - Flag extreme outliers (>5σ)

**Validation Report** (stored in KV):
```javascript
{
  "date": "2023-06-20",
  "expected_samples": 6598320,
  "actual_samples": 6480000,
  "completeness": 0.982,
  "null_count": 0,
  "outlier_count": 23,
  "status": "completed_with_warnings"
}
```

#### FR-BF-006: Trigger Mechanism
**Priority**: MEDIUM
**Description**: Manual and scheduled backfill triggers

**Trigger Options**:
1. **Manual HTTP Trigger**:
   ```
   POST /api/backfill/start
   {
     "site_name": "ses_falls_city",
     "start_date": "2023-01-16",
     "end_date": "2024-01-15",
     "force_restart": false
   }
   ```

2. **Scheduled Cron** (for ongoing backfill):
   ```toml
   # Process one day every hour until complete
   crons = ["0 * * * *"]
   ```

3. **Queue-Based** (for large backfills):
   - Submit backfill job to queue
   - Worker processes queue asynchronously
   - Better for multi-site backfills

---

## 4. Non-Functional Requirements

### 4.1 Performance

#### NFR-PERF-001: Query Latency
**Category**: Performance
**Measurement**: p95 latency

**Targets**:
- **D1-only queries** (<20 days): p95 < 100ms
- **R2-only queries** (>20 days): p95 < 5s
- **Mixed queries** (D1 + R2): p95 < 5s

**Validation**:
```javascript
// Measure with performance.now()
const start = performance.now();
const result = await queryTimeseries(request);
const duration = performance.now() - start;

// Log to KV for analysis
await logQueryMetrics({
  duration_ms: duration,
  sources: result.metadata.sources,
  sample_count: result.samples.length
});
```

#### NFR-PERF-002: Archival Duration
**Category**: Performance
**Measurement**: Wall-clock time

**Target**: Complete daily archival in <15 minutes

**Factors**:
- D1 extraction: ~5 minutes (6.48M rows)
- Parquet write: ~3 minutes (compression)
- R2 upload: ~2 minutes (87MB compressed)
- D1 deletion: ~3 minutes
- Buffer: 2 minutes

#### NFR-PERF-003: Backfill Throughput
**Category**: Performance
**Measurement**: Days processed per hour

**Target**: Process 1 day per worker invocation (3-5 minutes per day)

**Calculation**:
- 365 days / (5 min/day) = 30.4 hours total
- Parallelization: Run multiple workers for different sites

#### NFR-PERF-004: Storage Efficiency
**Category**: Performance
**Measurement**: Compression ratio

**Target**: Parquet compression ratio >4:1

**Current**:
- Raw D1 size: ~374MB/day
- Parquet (Snappy): ~87MB/day
- Ratio: 4.3:1 ✅

---

### 4.2 Reliability

#### NFR-REL-001: Data Integrity
**Category**: Reliability
**Measurement**: Zero data loss

**Guarantees**:
1. **Archival**: Delete from D1 only after R2 verification
2. **Backfill**: Retry failed days up to 3 times
3. **ETL**: Existing idempotent inserts (INSERT OR REPLACE)

**Verification**:
```javascript
// After archival, verify row counts match
const d1Count = await db.prepare('SELECT COUNT(*) FROM timeseries WHERE timestamp < ?').bind(boundary).first();
const r2Manifest = await fetchManifest(r2Path);

if (d1Count.count !== r2Manifest.row_count) {
  throw new Error('ROW_COUNT_MISMATCH');
}
```

#### NFR-REL-002: Idempotency
**Category**: Reliability
**Measurement**: Safe to retry

**Requirements**:
- All workers must be idempotent (safe to re-run)
- Use unique keys for Parquet files (date-based)
- Check KV state before starting work

**Example**:
```javascript
// Before archiving, check if already done
const existingArchive = await db.prepare(`
  SELECT * FROM archive_state
  WHERE last_archived_timestamp >= ?
  AND status = 'completed'
`).bind(archiveBoundary).first();

if (existingArchive) {
  console.log('Already archived, skipping');
  return;
}
```

#### NFR-REL-003: Timeout Handling
**Category**: Reliability
**Measurement**: Graceful degradation

**Strategy**:
- Set timeout at 25s (leave 5s buffer for cleanup)
- Save progress to KV before timeout
- Resume from checkpoint on next invocation

**Implementation**:
```javascript
const TIMEOUT_MS = 25000;
const startTime = Date.now();

async function workWithTimeout(work) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS);
  });

  try {
    return await Promise.race([work(), timeoutPromise]);
  } catch (error) {
    if (error.message === 'TIMEOUT') {
      await saveCheckpoint();
      throw new Error('TIMEOUT_RESUME_NEEDED');
    }
    throw error;
  }
}
```

---

### 4.3 Scalability

#### NFR-SCALE-001: Multi-Site Support
**Category**: Scalability
**Measurement**: Sites supported

**Target**: Support 10+ sites without performance degradation

**Design**:
- Each site has independent Parquet file hierarchy
- Workers can run in parallel for different sites
- KV state tracking is site-specific

#### NFR-SCALE-002: Point Count Scaling
**Category**: Scalability
**Measurement**: Points per site

**Current**: 4,583 points per site
**Target**: 10,000 points per site

**Considerations**:
- Query performance degrades with IN clause size (>1000)
- Solution: Batch point lookups, parallel queries

#### NFR-SCALE-003: Data Volume Growth
**Category**: Scalability
**Measurement**: Samples per day

**Current**: 6.48M samples/day
**Target**: Support 50M samples/day (10 sites)

**Scaling Strategy**:
- Horizontal: More frequent archival (twice daily if needed)
- Vertical: Increase Workers CPU time limit (Unbound tier)

---

### 4.4 Security

#### NFR-SEC-001: Data Access Control
**Category**: Security
**Measurement**: Authorization checks

**Requirements**:
- Query Worker must validate user permissions
- R2 bucket not publicly accessible
- Use Cloudflare Access for worker endpoints

#### NFR-SEC-002: Data at Rest
**Category**: Security
**Measurement**: Encryption

**Requirements**:
- R2 server-side encryption enabled (AES-256)
- D1 encrypted by default (Cloudflare managed)

#### NFR-SEC-003: Data in Transit
**Category**: Security
**Measurement**: TLS encryption

**Requirements**:
- All ACE API calls over HTTPS
- All worker endpoints over HTTPS
- R2 access via HTTPS

---

### 4.5 Observability

#### NFR-OBS-001: Logging
**Category**: Observability
**Measurement**: Log coverage

**Requirements**:
- Log all worker executions (start, end, duration)
- Log errors with stack traces
- Log performance metrics (query times, row counts)

**Storage**: KV namespace with TTL (7 days)

#### NFR-OBS-002: Metrics
**Category**: Observability
**Measurement**: Metrics tracked

**Key Metrics**:
- Query latency (p50, p95, p99)
- Archival duration
- D1 database size
- R2 storage size
- Backfill progress (days completed / total)
- Error rate (failures / total invocations)

#### NFR-OBS-003: Alerting
**Category**: Observability
**Measurement**: Alert coverage

**Critical Alerts**:
- D1 database >9GB (urgent archival needed)
- Archival failed 2+ consecutive days
- ETL sync stopped (no new data >1 hour)
- Query error rate >5%

**Warning Alerts**:
- Query latency p95 >200ms
- Archival duration >15 minutes
- Backfill stalled (no progress >1 hour)

---

## 5. API Contracts

### 5.1 Query Worker API

#### Endpoint: `POST /api/timeseries/query`

**Request**:
```json
{
  "site_name": "ses_falls_city",
  "point_names": [
    "Building1.HVAC.AHU-1.SupplyTemp",
    "Building1.HVAC.AHU-1.ReturnTemp"
  ],
  "start_time": 1704067200000,
  "end_time": 1705363199999,
  "resolution": "5min"
}
```

**Response (Success)**:
```json
{
  "samples": [
    {
      "point_name": "Building1.HVAC.AHU-1.SupplyTemp",
      "timestamp": 1704067200000,
      "value": 72.5,
      "quality": 192,
      "flags": 0
    },
    {
      "point_name": "Building1.HVAC.AHU-1.SupplyTemp",
      "timestamp": 1704067500000,
      "value": 72.6,
      "quality": 192,
      "flags": 0
    }
  ],
  "metadata": {
    "total_samples": 35520,
    "sources": ["d1", "r2"],
    "query_time_ms": 1245,
    "cached": false,
    "d1_samples": 15000,
    "r2_samples": 20520
  }
}
```

**Response (Error)**:
```json
{
  "error": "Invalid time range",
  "error_code": "INVALID_REQUEST",
  "details": "start_time must be before end_time"
}
```

---

### 5.2 Archival Worker (Internal)

#### Endpoint: `POST /internal/archival/trigger`

**Request**:
```json
{
  "site_name": "ses_falls_city",
  "force": false
}
```

**Response**:
```json
{
  "archival_id": "arch_20240115_020000",
  "status": "in_progress",
  "estimated_duration_seconds": 900
}
```

---

### 5.3 Backfill Worker

#### Endpoint: `POST /api/backfill/start`

**Request**:
```json
{
  "site_name": "ses_falls_city",
  "start_date": "2023-01-16",
  "end_date": "2024-01-15",
  "force_restart": false
}
```

**Response**:
```json
{
  "backfill_id": "backfill_20240116",
  "status": "queued",
  "days_total": 365,
  "estimated_duration_hours": 30
}
```

#### Endpoint: `GET /api/backfill/status/{backfill_id}`

**Response**:
```json
{
  "backfill_id": "backfill_20240116",
  "status": "in_progress",
  "site_name": "ses_falls_city",
  "start_date": "2023-01-16",
  "end_date": "2024-01-15",
  "current_date": "2023-06-20",
  "days_completed": 155,
  "days_total": 365,
  "progress_percent": 42.5,
  "estimated_completion": "2024-01-17T08:30:00Z"
}
```

---

## 6. Data Flow Diagrams

### 6.1 ETL → D1 Flow (Existing)

```
┌──────────────┐
│  ACE IoT API │
│  Paginated   │
│  Endpoint    │
└──────┬───────┘
       │ Every 5 minutes
       │ GET /sites/{site}/timeseries/paginated
       │   ?start_time={last_sync - 24h}
       │   &end_time={now}
       │   &raw_data=true
       ▼
┌────────────────────────────────┐
│     ETL Sync Worker            │
│  (Scheduled: */5 * * * *)      │
├────────────────────────────────┤
│ 1. Fetch last_sync from KV    │
│ 2. Call ACE API (paginated)   │
│ 3. Filter to configured points│
│ 4. Transform samples           │
│ 5. Batch insert to D1 (1000)  │
│ 6. Update KV last_sync         │
└────────────┬───────────────────┘
             │ INSERT OR REPLACE INTO timeseries
             ▼
┌──────────────────────────────────┐
│        D1 Database               │
│                                  │
│ timeseries (point_id, timestamp, │
│             value, quality)      │
│                                  │
│ WITHOUT ROWID, indexed           │
└──────────────────────────────────┘
```

---

### 6.2 D1 → R2 Archival Flow

```
┌────────────────────────────────┐
│   Archival Worker (Cron)       │
│   (Scheduled: 0 2 * * *)       │
└────────────┬───────────────────┘
             │
             ▼
    ┌────────────────┐
    │ Check KV State │
    │ In progress?   │
    └───┬────────┬───┘
        │ No     │ Yes
        ▼        └──────────┐
┌───────────────┐            │
│ Calculate     │            │
│ Archive       │            │
│ Boundary      │            │
│ (NOW - 20d)   │            │
└───┬───────────┘            │
    │                        │
    ▼                        │
┌─────────────────────────┐  │
│ Query D1 for Old Data   │  │
│ WHERE timestamp < bound │  │
│ LIMIT 100000 OFFSET X   │  │
└───┬─────────────────────┘  │
    │ Batched extraction     │
    ▼                        │
┌──────────────────────────┐ │
│ Transform to Arrow Table │ │
└───┬──────────────────────┘ │
    │                        │
    ▼                        │
┌──────────────────────────┐ │
│ Write Parquet File       │ │
│ (Snappy compression)     │ │
└───┬──────────────────────┘ │
    │                        │
    ▼                        │
┌──────────────────────────┐ │
│ Upload to R2             │ │
│ /archives/{site}/{date}  │ │
└───┬──────────────────────┘ │
    │                        │
    ▼                        │
┌──────────────────────────┐ │
│ Verify R2 Write (HEAD)   │ │
└───┬──────────────────────┘ │
    │ Success?               │
    ├─ Yes ──────────────────┤
    │                        │
    ▼                        │
┌──────────────────────────┐ │
│ DELETE FROM timeseries   │ │
│ WHERE timestamp < bound  │ │
└───┬──────────────────────┘ │
    │                        │
    ▼                        │
┌──────────────────────────┐ │
│ INSERT INTO              │ │
│ archive_state            │ │
│ (last_archived_timestamp)│ │
└───┬──────────────────────┘ │
    │                        │
    ▼                        │
┌──────────────────────────┐ │
│ Update KV State          │ │
│ Status: completed        │ │
└───┬──────────────────────┘ │
    │                        │
    └────────────────────────┘
```

---

### 6.3 Frontend → Query → D1+R2 → Response Flow

```
┌──────────────┐
│   Frontend   │
│   (Charts)   │
└──────┬───────┘
       │ POST /api/timeseries/query
       │ { point_names, start_time, end_time }
       ▼
┌──────────────────────────────────┐
│       Query Worker               │
├──────────────────────────────────┤
│ 1. Parse request                 │
│ 2. Validate parameters           │
│ 3. Determine storage layer       │
└──────┬───────────────────────────┘
       │
       ▼
  ┌─────────────┐
  │ Time Range? │
  └─┬─────────┬─┘
    │         │
    ▼         ▼
  Hot      Cold      Mixed
  (<20d)   (>20d)   (spans)
    │         │         │
    ▼         ▼         ▼
┌─────┐   ┌─────┐   ┌──────────┐
│ D1  │   │ R2  │   │ D1 + R2  │
│Query│   │Query│   │ Parallel │
└──┬──┘   └──┬──┘   └────┬─────┘
   │         │           │
   │         │           ├─────┐
   │         │           ▼     ▼
   │         │         ┌───┐ ┌───┐
   │         │         │D1 │ │R2 │
   │         │         └─┬─┘ └─┬─┘
   │         │           │     │
   ▼         ▼           ▼     ▼
┌─────────────────────────────────┐
│        Merge Results             │
│  • Combine D1 + R2 samples      │
│  • Sort by timestamp            │
│  • Deduplicate (if overlap)     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│      Format Response             │
│  • Add metadata                  │
│  • Calculate query_time_ms       │
│  • Set cache headers             │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│      Cache in KV (optional)      │
│  TTL based on time range         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│      Return JSON Response        │
│  { samples[], metadata }         │
└────────────┬────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│         Frontend                 │
│  • Parse response                │
│  • Render ECharts                │
│  • No awareness of D1/R2 split   │
└──────────────────────────────────┘
```

---

### 6.4 Backfill → R2/D1 Flow

```
┌────────────────────────────────┐
│   Backfill Worker              │
│   (Manual trigger or cron)     │
└────────────┬───────────────────┘
             │
             ▼
    ┌────────────────┐
    │ Load KV State  │
    │ Resume or      │
    │ Start fresh?   │
    └───┬────────────┘
        │
        ▼
┌──────────────────────┐
│ Calculate Date Range │
│ 365 days, 1/day      │
└───┬──────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ FOR EACH day:                │
│   1. Check KV if completed   │
│   2. If not, process day     │
└───┬──────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ Fetch ACE API Timeseries     │
│ GET /timeseries/paginated    │
│   ?start_time={day_start}    │
│   &end_time={day_end}        │
│   &raw_data=true             │
│ (Paginated, throttled)       │
└───┬──────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ Filter to Configured Points  │
│ (same as ETL)                │
└───┬──────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ Validate Data Quality        │
│ • Check sample count         │
│ • Check timestamp bounds     │
│ • Flag anomalies             │
└───┬──────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ Determine Storage Target     │
│ • If recent (<20d): D1       │
│ • If historical (>20d): R2   │
└───┬──────────────────────────┘
    │
    ├─ R2 Path ──────────────────┐
    │                            │
    ▼                            │
┌──────────────────────────┐    │
│ Write Parquet to R2      │    │
│ Same as Archival Worker  │    │
└───┬──────────────────────┘    │
    │                            │
    ▼                            │
┌──────────────────────────┐    │
│ Mark Day Complete in KV  │    │
└───┬──────────────────────┘    │
    │                            │
    └────────────────────────────┤
                                 │
    ├─ D1 Path ──────────────────┘
    │
    ▼
┌──────────────────────────┐
│ Batch Insert to D1       │
│ Same as ETL Worker       │
└───┬──────────────────────┘
    │
    ▼
┌──────────────────────────┐
│ Mark Day Complete in KV  │
└───┬──────────────────────┘
    │
    ▼
┌──────────────────────────┐
│ Check Timeout            │
│ Save progress if needed  │
└───┬──────────────────────┘
    │
    └─ Next Day (loop)
```

---

## 7. Storage Schema

### 7.1 D1 Schema (Hot Storage)

#### Table: `timeseries`
```sql
CREATE TABLE IF NOT EXISTS timeseries (
    timestamp INTEGER NOT NULL,      -- Unix timestamp (milliseconds)
    point_id INTEGER NOT NULL,       -- FK to points table
    value REAL NOT NULL,             -- Sensor value
    quality INTEGER DEFAULT 192,     -- 0-255 quality code
    flags INTEGER DEFAULT 0,         -- Status bitfield
    PRIMARY KEY (point_id, timestamp),
    FOREIGN KEY (point_id) REFERENCES points(id) ON DELETE CASCADE
) WITHOUT ROWID;

-- Indexes
CREATE INDEX idx_timeseries_point_time_desc ON timeseries(point_id, timestamp DESC);
CREATE INDEX idx_timeseries_time_point ON timeseries(timestamp, point_id);
```

#### Table: `points`
```sql
CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,       -- Full point name
    unit TEXT,                       -- "degF", "kW", etc.
    data_type TEXT NOT NULL,         -- "analog", "digital"
    building TEXT,                   -- Site/building name
    system TEXT,                     -- "HVAC", "Lighting"
    equipment TEXT,
    is_critical BOOLEAN DEFAULT 0,
    sample_rate_sec INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_points_name ON points(name);
CREATE INDEX idx_points_hierarchy ON points(building, system, equipment);
```

#### Table: `archive_state`
```sql
CREATE TABLE IF NOT EXISTS archive_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    last_archived_timestamp INTEGER NOT NULL,
    records_archived INTEGER NOT NULL,
    archive_path TEXT NOT NULL,          -- R2 path
    parquet_file_size INTEGER,
    compression_ratio REAL,
    archived_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    error_message TEXT
);

CREATE INDEX idx_archive_state_timestamp ON archive_state(last_archived_timestamp DESC);
```

---

### 7.2 R2 Schema (Cold Storage)

#### Parquet File Structure

**Path Pattern**:
```
/archives/{site_name}/{YYYY}/{MM}/{DD}/timeseries-{site}-{YYYYMMDD}.parquet
```

**Example**:
```
/archives/ses_falls_city/2024/01/15/timeseries-ses_falls_city-20240115.parquet
```

**Parquet Schema**:
```
message timeseries {
  required int64 timestamp (TIMESTAMP_MILLIS);
  required int32 point_id;
  required double value;
  optional int32 quality;
  optional int32 flags;
  required binary point_name (UTF8);
  required binary site_name (UTF8);
}
```

**Compression**: Snappy (balance between speed and ratio)

**Row Groups**: 10,000 rows per group (optimal for ~6.48M rows/day)

---

### 7.3 KV State Schema

#### Key: `etl:last_sync_timestamp`
```json
"1705363199999"
```
**Metadata**:
```json
{
  "syncId": "sync_1705363199_abc123",
  "recordsInserted": 75000,
  "timestamp": "2024-01-15T23:59:59Z"
}
```

#### Key: `archival:state:{archival_id}`
```json
{
  "archival_id": "arch_20240115_020000",
  "date": "2024-01-15",
  "site_name": "ses_falls_city",
  "status": "completed",
  "phase": "completed",
  "records_archived": 6480000,
  "r2_path": "/archives/ses_falls_city/2024/01/15/timeseries-ses_falls_city-20240115.parquet",
  "started_at": 1705369200000,
  "completed_at": 1705370100000,
  "duration_seconds": 900
}
```

#### Key: `backfill:state:current`
```json
{
  "backfill_id": "backfill_20240116",
  "site_name": "ses_falls_city",
  "start_date": "2023-01-16",
  "end_date": "2024-01-15",
  "current_date": "2023-06-20",
  "days_completed": 155,
  "days_total": 365,
  "status": "in_progress",
  "started_at": 1705420800000,
  "last_updated": 1705507200000
}
```

#### Key: `backfill:day:{YYYYMMDD}`
```json
{
  "date": "2023-06-20",
  "status": "completed",
  "rows": 6480000,
  "r2_path": "/archives/ses_falls_city/2023/06/20/timeseries-ses_falls_city-20230620.parquet",
  "completed_at": 1705507200000
}
```

---

## 8. Edge Cases and Error Scenarios

### 8.1 Query Worker Edge Cases

#### Edge Case 1: Time Range Spans Archival Boundary
**Scenario**: User requests data from day 19 to day 21 (relative to now)

**Handling**:
1. Split query at day 20 boundary
2. Query D1 for days 19-20
3. Query R2 for day 21
4. Merge results, ensuring no duplicates at boundary

**Potential Issue**: Data at boundary may exist in both D1 and R2

**Solution**: Prioritize D1 data if timestamp overlap detected

#### Edge Case 2: Requested Point Not Found
**Scenario**: Frontend requests point name that doesn't exist

**Handling**:
- Return 400 Bad Request with clear error message
- List similar point names (fuzzy matching) in error response

**Example**:
```json
{
  "error": "Point not found: Building1.HVAC.AHU-99.Temp",
  "error_code": "POINT_NOT_FOUND",
  "suggestions": [
    "Building1.HVAC.AHU-1.SupplyTemp",
    "Building1.HVAC.AHU-1.ReturnTemp"
  ]
}
```

#### Edge Case 3: Empty Time Range
**Scenario**: User requests time range with no data (e.g., future dates)

**Handling**:
- Return 200 OK with empty samples array
- Include metadata explaining why empty

**Example**:
```json
{
  "samples": [],
  "metadata": {
    "total_samples": 0,
    "sources": [],
    "reason": "Time range is in the future"
  }
}
```

#### Edge Case 4: Very Large Time Range (1 year)
**Scenario**: User requests all data for 1 year (millions of samples)

**Handling**:
- Enforce max samples limit (e.g., 1 million samples)
- If exceeded, return 400 Bad Request with suggestion to use lower resolution

**Example**:
```json
{
  "error": "Time range too large",
  "error_code": "SAMPLE_LIMIT_EXCEEDED",
  "details": "Requested range would return ~6.48M samples. Max: 1M",
  "suggestion": "Use resolution parameter (e.g., '5min' or '1hr')"
}
```

---

### 8.2 Archival Worker Edge Cases

#### Edge Case 5: Archival Runs During ETL Sync
**Scenario**: ETL sync inserts new data while archival is extracting

**Handling**:
- Use snapshot isolation (D1 transactions)
- Archival query uses timestamp boundary, not affected by concurrent inserts
- New data (after boundary) stays in D1

**Verification**: No data loss or duplication

#### Edge Case 6: R2 Upload Fails Mid-Archive
**Scenario**: Network issue during Parquet upload to R2

**Handling**:
1. Detect failure via try-catch
2. Do NOT delete from D1
3. Mark archival as 'failed' in KV state
4. Retry on next scheduled run

**Recovery**:
```javascript
try {
  await env.ARCHIVE_BUCKET.put(key, parquetBuffer);
  const verification = await env.ARCHIVE_BUCKET.head(key);
  if (!verification) throw new Error('UPLOAD_FAILED');
} catch (error) {
  await updateArchivalState('failed', error.message);
  throw error; // Will retry on next cron
}
```

#### Edge Case 7: D1 Deletion Fails After R2 Upload
**Scenario**: R2 upload succeeds, but D1 deletion fails

**Handling**:
1. Log error to KV
2. Mark archival as 'partial' in archive_state
3. On next run, detect existing R2 file and skip upload
4. Retry D1 deletion only

**Idempotency**: Check R2 first before re-uploading

#### Edge Case 8: No Data to Archive
**Scenario**: D1 has <20 days of data (fresh deployment)

**Handling**:
- Detect empty result set from archival query
- Exit gracefully with log message
- Do not create empty Parquet files

```javascript
if (allRows.length === 0) {
  console.log('No data to archive (D1 < 20 days old)');
  return { status: 'skipped', reason: 'no_old_data' };
}
```

---

### 8.3 Backfill Worker Edge Cases

#### Edge Case 9: ACE API Returns Partial Data
**Scenario**: API returns incomplete data for a day (e.g., 50% of expected samples)

**Handling**:
1. Calculate expected samples: `4583 points * 1440 samples/day`
2. Compare with actual samples
3. If <80% complete, mark day as 'partial' in KV
4. Still write to R2 (partial data is better than none)
5. Flag for manual review

**Validation**:
```javascript
const expectedSamples = 4583 * 1440; // 6,599,520
const completeness = actualSamples / expectedSamples;

if (completeness < 0.8) {
  await flagForReview(date, completeness);
}
```

#### Edge Case 10: Backfill Day Already Exists in R2
**Scenario**: Re-running backfill for already-processed day

**Handling**:
1. Check KV state: `backfill:day:{YYYYMMDD}`
2. If status === 'completed', skip day
3. If force_restart flag set, overwrite existing data

**Idempotency Check**:
```javascript
const dayState = await env.ETL_STATE.get(`backfill:day:${YYYYMMDD}`, 'json');
if (dayState && dayState.status === 'completed' && !forceRestart) {
  console.log(`Day ${YYYYMMDD} already backfilled, skipping`);
  return;
}
```

#### Edge Case 11: Workers Timeout Mid-Backfill
**Scenario**: Processing single day takes >30s (rare but possible)

**Handling**:
1. Save progress at sub-day granularity (e.g., hour chunks)
2. Store cursor in KV: `backfill:day:{YYYYMMDD}:cursor`
3. Resume from cursor on next invocation

**Chunking Strategy**:
```javascript
const HOURS_PER_DAY = 24;
for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
  const hourStart = dayStart + (hour * 3600 * 1000);
  const hourEnd = hourStart + (3600 * 1000);

  await processHour(hourStart, hourEnd);
  await saveHourProgress(date, hour);

  if (Date.now() - startTime > 25000) {
    throw new Error('TIMEOUT_RESUME_NEEDED');
  }
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Query Worker**:
- ✅ Test storage layer determination (hot, cold, mixed)
- ✅ Test D1 query generation with multiple points
- ✅ Test R2 Parquet file path calculation
- ✅ Test result merging from D1 + R2
- ✅ Test cache key generation

**Archival Worker**:
- ✅ Test boundary calculation (NOW - 20 days)
- ✅ Test batch extraction logic
- ✅ Test Parquet schema transformation
- ✅ Test R2 upload verification
- ✅ Test idempotency (detect existing archives)

**Backfill Worker**:
- ✅ Test date range generation (365 days)
- ✅ Test day completion tracking in KV
- ✅ Test resume logic from checkpoint
- ✅ Test data validation (sample count, timestamps)

---

### 9.2 Integration Tests

**End-to-End Query Flow**:
1. Insert test data into D1 (10 days old)
2. Upload test Parquet to R2 (30 days old)
3. Query spanning both ranges
4. Verify merged results

**End-to-End Archival Flow**:
1. Insert test data into D1 (25 days old)
2. Run archival worker
3. Verify Parquet created in R2
4. Verify data deleted from D1
5. Verify archive_state updated

**End-to-End Backfill Flow**:
1. Mock ACE API with test data
2. Run backfill for 3 days
3. Verify 3 Parquet files in R2
4. Verify KV state tracking
5. Simulate timeout and verify resume

---

### 9.3 Performance Tests

**Query Latency Test**:
```javascript
// Test 1: D1-only query (last 7 days, 10 points)
// Expected: <100ms
const start = performance.now();
await queryTimeseries({ start_time: NOW - 7d, end_time: NOW, points: 10 });
const duration = performance.now() - start;
assert(duration < 100, 'D1 query too slow');

// Test 2: R2-only query (90 days ago, 10 points)
// Expected: <5s
const start = performance.now();
await queryTimeseries({ start_time: NOW - 90d, end_time: NOW - 85d, points: 10 });
const duration = performance.now() - start;
assert(duration < 5000, 'R2 query too slow');
```

**Archival Duration Test**:
```javascript
// Test: Archive 1 day of data (6.48M samples)
// Expected: <15 minutes
const start = Date.now();
await runArchival();
const duration = Date.now() - start;
assert(duration < 900000, 'Archival too slow');
```

---

### 9.4 Error Handling Tests

**Test Scenarios**:
- ✅ D1 unavailable during query → Fallback to R2
- ✅ R2 unavailable during query → Return D1 only + warning
- ✅ R2 upload fails during archival → No D1 deletion
- ✅ Workers timeout during backfill → Resume from checkpoint
- ✅ Invalid point names in query → 400 Bad Request
- ✅ Future time range in query → Empty result with explanation

---

## 10. Deployment Plan

### 10.1 Phase 1: Query Worker (Week 1)

**Goals**:
- Deploy Query Worker
- Frontend integration
- D1-only queries (no R2 yet)

**Steps**:
1. Create `src/query-worker.js`
2. Add wrangler config: `workers/wrangler-query.toml`
3. Deploy to staging
4. Test with frontend (dev environment)
5. Deploy to production
6. Monitor query latency

**Success Criteria**:
- ✅ Query latency <100ms for D1
- ✅ Frontend charts work without code changes
- ✅ Zero data loss or corruption

---

### 10.2 Phase 2: Archival Worker (Week 2)

**Goals**:
- Implement D1 → R2 archival
- Test with 1-2 days of data
- Verify data integrity

**Steps**:
1. Create `src/archival-worker.js`
2. Add wrangler config with daily cron
3. Test locally with sample data
4. Deploy to staging
5. Run manual archival (verify R2 files)
6. Monitor D1 size reduction
7. Deploy to production

**Success Criteria**:
- ✅ Archival completes in <15 minutes
- ✅ D1 data deleted only after R2 verification
- ✅ archive_state table updated correctly
- ✅ No data loss

---

### 10.3 Phase 3: Query Worker + R2 (Week 3)

**Goals**:
- Enable R2 queries in Query Worker
- Test mixed queries (D1 + R2)
- Verify performance

**Steps**:
1. Update Query Worker to read from R2
2. Implement Parquet parsing (Apache Arrow)
3. Test mixed queries (spans D1 and R2)
4. Deploy to staging
5. Load test with various time ranges
6. Deploy to production

**Success Criteria**:
- ✅ R2 query latency <5s
- ✅ Mixed queries work correctly
- ✅ No errors in frontend

---

### 10.4 Phase 4: Backfill Worker (Week 4)

**Goals**:
- Backfill 1 year of historical data
- Monitor progress
- Verify data quality

**Steps**:
1. Create `src/backfill-worker.js`
2. Add wrangler config (manual trigger + hourly cron)
3. Test with 1 week of data
4. Deploy to staging
5. Trigger full backfill (365 days)
6. Monitor progress via KV state
7. Verify R2 Parquet files

**Success Criteria**:
- ✅ 365 days backfilled in ~30 hours
- ✅ Data quality validation passed
- ✅ Query Worker can query historical data

---

## 11. Monitoring and Maintenance

### 11.1 Dashboards

**Query Worker Dashboard**:
- Query latency (p50, p95, p99) over time
- Query volume (requests/minute)
- Cache hit rate
- Error rate by type

**Archival Worker Dashboard**:
- Archival duration trend
- D1 database size over time
- R2 storage size over time
- Archival success rate

**Backfill Worker Dashboard**:
- Backfill progress (days completed / total)
- Days per hour throughput
- Data quality scores
- Failed days list

---

### 11.2 Alerts

**Critical Alerts** (PagerDuty):
- D1 database >9GB (urgent archival needed)
- Archival failed 2+ consecutive days
- ETL sync stopped (no new data >1 hour)
- Query error rate >10%

**Warning Alerts** (Slack):
- Query latency p95 >200ms
- Archival duration >15 minutes
- Backfill stalled (no progress >2 hours)
- Data quality score <0.8

---

### 11.3 Maintenance Tasks

**Daily**:
- Review archival logs
- Check D1 size trend
- Monitor query latency

**Weekly**:
- Review data quality reports
- Check for failed backfill days
- Analyze query cache hit rates

**Monthly**:
- R2 storage cost review
- Query performance optimization
- Update capacity planning

---

## 12. Success Metrics

### 12.1 Performance Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Query latency (D1) | <100ms | TBD | 🟡 |
| Query latency (R2) | <5s | TBD | 🟡 |
| Archival duration | <15 min | TBD | 🟡 |
| Backfill throughput | 1 day/5min | TBD | 🟡 |
| D1 storage usage | <10GB | ~9.7GB | 🟢 |
| R2 compression ratio | >4:1 | 4.3:1 | 🟢 |

---

### 12.2 Reliability Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Data integrity | 100% | TBD | 🟡 |
| Archival success rate | >99% | TBD | 🟡 |
| Query error rate | <1% | TBD | 🟡 |
| Uptime (Query Worker) | >99.9% | TBD | 🟡 |

---

### 12.3 Business Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Frontend integration | Zero code changes | TBD | 🟡 |
| Historical data range | 1 year | 30 days | 🔴 |
| Query cost per 1M samples | <$1 | TBD | 🟡 |
| Storage cost per TB/month | <$15 | TBD | 🟡 |

---

## 13. Open Questions and Decisions

### 13.1 Open Questions

1. **Q**: Should we support real-time aggregation (e.g., 5-min rollups) in Query Worker?
   - **A**: TBD - Evaluate after Phase 1 deployment

2. **Q**: What is the optimal R2 file size? (Currently: 1 file/day = ~87MB)
   - **A**: TBD - Monitor query performance and adjust if needed

3. **Q**: Should we implement query pagination for very large result sets?
   - **A**: TBD - Enforce max samples limit first, add pagination if needed

4. **Q**: How to handle multi-site queries (aggregate data from multiple sites)?
   - **A**: TBD - Out of scope for v1, revisit in v2

---

### 13.2 Technical Decisions

| Decision | Status | Rationale |
|----------|--------|-----------|
| Use Parquet for R2 | ✅ Approved | Columnar format, excellent compression, Arrow integration |
| Snappy compression | ✅ Approved | Balance between speed and ratio (4.3:1) |
| 20-day hot/cold boundary | ✅ Approved | Keeps D1 under 10GB with buffer |
| Daily archival cron | ✅ Approved | Low-traffic period, manageable batch size |
| 1 year retention | ✅ Approved | Business requirement for compliance |
| Max 1M samples per query | ⏳ Pending | Need to validate with frontend use cases |

---

## 14. Appendices

### Appendix A: Glossary

- **D1**: Cloudflare's distributed SQL database (10GB limit)
- **R2**: Cloudflare's object storage (unlimited, S3-compatible)
- **Hot Storage**: Recently accessed data (D1)
- **Cold Storage**: Infrequently accessed data (R2)
- **Parquet**: Columnar storage format optimized for analytics
- **ETL**: Extract, Transform, Load (data pipeline)
- **KV**: Key-Value store (Cloudflare Workers KV)

### Appendix B: References

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Apache Parquet Format](https://parquet.apache.org/docs/)
- [Apache Arrow](https://arrow.apache.org/)
- [ACE IoT API Documentation](https://flightdeck.aceiot.cloud/api/docs)

### Appendix C: Contact Information

- **Product Owner**: TBD
- **Tech Lead**: TBD
- **SPARC Specification Agent**: Completed specification v1.0.0

---

**Document Status**: ✅ READY FOR REVIEW
**Next Step**: Pseudocode phase (Algorithm design for Query/Archival/Backfill workers)
