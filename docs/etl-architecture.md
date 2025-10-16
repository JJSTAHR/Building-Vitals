# ETL Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Data Flow Pipeline](#data-flow-pipeline)
3. [Worker Architecture](#worker-architecture)
4. [Database Schema](#database-schema)
5. [Chart Integration](#chart-integration)
6. [Key Design Decisions](#key-design-decisions)
7. [Sequence Diagrams](#sequence-diagrams)
8. [Error Handling & Monitoring](#error-handling--monitoring)

---

## System Overview

The Building Vitals ETL system synchronizes time series data from the ACE IoT API into a Cloudflare D1 database, providing real-time dashboard visualization through React-based charts.

### Core Components
- **ACE IoT API**: Source system with 48-hour processing lag
- **ETL Sync Worker**: Cloudflare Worker for incremental data synchronization
- **D1 Database**: SQLite-based storage for time series data
- **Query Worker**: REST API for aggregated chart data
- **React Dashboard**: Real-time visualization layer

---

## Data Flow Pipeline

```
┌─────────────────┐
│   ACE IoT API   │ (48h processing lag)
└────────┬────────┘
         │
         │ HTTP GET /readings
         ▼
┌─────────────────┐
│  ETL Worker     │ (Scheduled every 5 min)
│                 │
│ • Time range    │
│   calculation   │
│ • Deduplication │
│ • Validation    │
└────────┬────────┘
         │
         │ INSERT OR REPLACE
         ▼
┌─────────────────┐
│  D1 Database    │
│                 │
│ timeseries_raw  │
│ (indexed)       │
└────────┬────────┘
         │
         │ REST API Query
         ▼
┌─────────────────┐
│  Query Worker   │
│                 │
│ • Aggregation   │
│ • Filtering     │
│ • Formatting    │
└────────┬────────┘
         │
         │ JSON Response
         ▼
┌─────────────────┐
│ React Charts    │
│                 │
│ • Line charts   │
│ • Bar charts    │
│ • Real-time     │
└─────────────────┘
```

### Processing Lag Considerations

**48-Hour Buffer Strategy:**
- ACE IoT API has inherent 48-hour processing delay
- ETL syncs data from 72 hours ago to 48 hours ago (safe window)
- Prevents incomplete data and false alerts
- Example: On Jan 15 at 10:00, sync data from Jan 12 10:00 to Jan 13 10:00

**Incremental Sync Strategy:**
- Each sync fetches 1-hour time window
- Overlapping windows ensure no data loss
- Duplicate handling via composite primary key
- Continuous operation maintains current data within lag constraints

---

## Worker Architecture

### 1. ETL Sync Worker

**Purpose:** Scheduled data synchronization from ACE IoT API to D1

**Key Responsibilities:**
- Calculate safe time ranges (accounting for 48h lag)
- Fetch readings from ACE IoT API
- Transform and validate data
- Write to D1 with deduplication
- Track sync state and errors

**Configuration:**
```typescript
// Cron Schedule: Every 5 minutes
schedule: "*/5 * * * *"

// Environment Variables
ACE_API_BASE_URL: string
ACE_API_KEY: string
D1_DATABASE: D1Database
SYNC_WINDOW_HOURS: 1
PROCESSING_LAG_HOURS: 48
```

**Core Logic:**
```typescript
async function syncData() {
  // 1. Calculate time range
  const now = new Date();
  const endTime = subHours(now, PROCESSING_LAG_HOURS);
  const startTime = subHours(endTime, SYNC_WINDOW_HOURS);

  // 2. Fetch from API
  const readings = await fetchReadings(startTime, endTime);

  // 3. Transform data
  const records = readings.map(transformReading);

  // 4. Batch write to D1
  await batchInsert(records);

  // 5. Update sync state
  await updateSyncState(endTime);
}
```

**Error Handling:**
- Retry logic with exponential backoff
- Failed sync tracking in separate table
- Alert on consecutive failures
- Partial sync recovery

### 2. Query Worker

**Purpose:** REST API for serving aggregated chart data

**Endpoints:**

```typescript
// Get time series data with aggregation
GET /api/readings
Query Params:
  - startDate: ISO8601
  - endDate: ISO8601
  - deviceId?: string
  - metric: string (temperature, humidity, energy)
  - interval: string (5min, 1hour, 1day)
  - aggregation: sum | avg | min | max

Response:
{
  data: Array<{
    timestamp: string,
    value: number,
    deviceId?: string
  }>,
  meta: {
    count: number,
    interval: string,
    aggregation: string
  }
}

// Get device list
GET /api/devices

// Health check
GET /api/health
```

**Aggregation Logic:**
```typescript
async function getAggregatedData(params) {
  const { startDate, endDate, interval, aggregation } = params;

  // Dynamic time bucketing
  const bucketSize = getIntervalSeconds(interval);

  const query = `
    SELECT
      datetime(
        (strftime('%s', timestamp) / ${bucketSize}) * ${bucketSize},
        'unixepoch'
      ) as bucket,
      ${aggregation}(value) as value,
      device_id
    FROM timeseries_raw
    WHERE timestamp BETWEEN ? AND ?
    GROUP BY bucket, device_id
    ORDER BY bucket ASC
  `;

  return await db.prepare(query)
    .bind(startDate, endDate)
    .all();
}
```

**Caching Strategy:**
- Cache frequently requested ranges
- Invalidate on new data arrival
- Use Cloudflare KV for distributed cache
- Cache TTL: 5 minutes

### 3. Backfill Worker

**Purpose:** Historical data loading for initial setup or gap filling

**Trigger:** Manual HTTP endpoint or scheduled for specific ranges

**Logic:**
```typescript
async function backfillData(startDate: Date, endDate: Date) {
  const chunks = splitIntoHourlyChunks(startDate, endDate);

  for (const chunk of chunks) {
    await syncData(chunk.start, chunk.end);
    await sleep(1000); // Rate limiting
  }
}
```

**Rate Limiting:**
- Max 60 requests per minute to ACE API
- Exponential backoff on 429 responses
- Queue management for large backfills

---

## Database Schema

### timeseries_raw Table

```sql
CREATE TABLE IF NOT EXISTS timeseries_raw (
  -- Composite Primary Key
  device_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  timestamp DATETIME NOT NULL,

  -- Data Fields
  value REAL NOT NULL,
  unit TEXT NOT NULL,

  -- Metadata
  building_id TEXT,
  floor_id TEXT,
  zone_id TEXT,

  -- Quality Flags
  quality_score INTEGER DEFAULT 100,
  is_estimated BOOLEAN DEFAULT 0,

  -- Audit Fields
  source_system TEXT DEFAULT 'ace_iot',
  sync_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Composite Primary Key Definition
  PRIMARY KEY (device_id, metric_type, timestamp)
);
```

### Index Strategy

```sql
-- Query performance indexes
CREATE INDEX idx_timestamp
ON timeseries_raw(timestamp);

CREATE INDEX idx_device_metric
ON timeseries_raw(device_id, metric_type);

CREATE INDEX idx_building_time
ON timeseries_raw(building_id, timestamp);

-- Composite index for common queries
CREATE INDEX idx_device_metric_time
ON timeseries_raw(device_id, metric_type, timestamp);
```

### Primary Key Strategy

**Composite Key Benefits:**
- **Automatic Deduplication**: `(device_id, metric_type, timestamp)` uniqueness
- **No Duplicate Writes**: `INSERT OR REPLACE` updates existing records
- **Efficient Queries**: Primary key supports range scans
- **Data Integrity**: Enforces one value per device/metric/time combination

**Example:**
```sql
-- First sync
INSERT OR REPLACE INTO timeseries_raw
VALUES ('sensor_001', 'temperature', '2024-01-15 10:00:00', 22.5, 'C');

-- Overlapping sync (updates existing record)
INSERT OR REPLACE INTO timeseries_raw
VALUES ('sensor_001', 'temperature', '2024-01-15 10:00:00', 22.5, 'C');
-- Result: Only 1 record exists
```

### Sync State Table

```sql
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  last_sync_start DATETIME NOT NULL,
  last_sync_end DATETIME NOT NULL,
  records_synced INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Chart Integration

### Data Format Requirements

**Time Series Format:**
```typescript
interface ChartDataPoint {
  timestamp: string;        // ISO8601 format
  value: number;           // Numeric measurement
  deviceId?: string;       // Optional device identifier
  label?: string;          // Human-readable label
}

interface ChartDataset {
  data: ChartDataPoint[];
  meta: {
    metric: string;        // temperature, humidity, energy
    unit: string;          // C, %, kWh
    interval: string;      // 5min, 1hour, 1day
    aggregation: string;   // sum, avg, min, max
    count: number;         // Total data points
  }
}
```

### React Component Integration

```typescript
import { useQuery } from '@tanstack/react-query';
import { LineChart } from '@/components/charts';

function TemperatureChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['readings', 'temperature'],
    queryFn: () => fetch('/api/readings?metric=temperature&interval=1hour')
      .then(res => res.json()),
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) return <Spinner />;

  return (
    <LineChart
      data={data.data}
      xKey="timestamp"
      yKey="value"
      unit={data.meta.unit}
    />
  );
}
```

### Real-Time Update Strategy

**Polling Approach:**
- React Query with 60-second refetch interval
- Optimistic updates on successful sync
- Stale-while-revalidate pattern

**WebSocket Alternative (Future):**
```typescript
// Publish sync events via Durable Objects
worker.addEventListener('syncComplete', (event) => {
  websocket.broadcast({
    type: 'data_updated',
    metric: event.metric,
    timestamp: event.timestamp
  });
});
```

### Chart Type Mappings

| Metric | Chart Type | Aggregation | Interval |
|--------|-----------|-------------|----------|
| Temperature | Line | Avg | 5min |
| Humidity | Line | Avg | 5min |
| Energy | Bar | Sum | 1hour |
| Occupancy | Area | Max | 15min |
| Air Quality | Line | Avg | 5min |

---

## Key Design Decisions

### 1. Why 48-Hour Processing Lag Buffer?

**Problem:**
- ACE IoT devices process and validate data asynchronously
- Immediate queries return incomplete or unvalidated data
- Data can be revised up to 48 hours after collection

**Solution:**
- Always query data that is 48-72 hours old
- Ensures data completeness and accuracy
- Prevents false alarms and incorrect analytics

**Trade-offs:**
- Dashboard shows slightly delayed data
- Acceptable for building management use case
- Real-time alerts handled by ACE system directly

### 2. Incremental Sync vs Full Reload

**Decision: Incremental Sync**

**Rationale:**
- Reduces API load (fetch only new data)
- Faster sync times (1-hour windows)
- Lower data transfer costs
- Easier error recovery

**Implementation:**
```typescript
// Track last successful sync
const lastSync = await getLastSyncTime();
const nextSync = addHours(lastSync, 1);

// Fetch incremental window
const readings = await api.getReadings(lastSync, nextSync);
```

**Alternative Considered:**
- Full reload: Simpler but wasteful
- Delta sync with checksum: More complex, minimal benefit

### 3. INSERT OR REPLACE vs INSERT IGNORE

**Decision: INSERT OR REPLACE**

**Comparison:**

| Approach | Behavior | Use Case |
|----------|----------|----------|
| INSERT OR REPLACE | Updates existing records | Data corrections, late-arriving updates |
| INSERT IGNORE | Skips duplicates | Write-once data, strict ordering |

**Why OR REPLACE:**
- ACE API may correct data retroactively
- Reprocessing jobs can update values
- Idempotent operations (safe to retry)
- Maintains data accuracy over time

**Example:**
```sql
-- Initial insert
INSERT OR REPLACE INTO timeseries_raw
VALUES ('s1', 'temp', '2024-01-15 10:00:00', 22.0, 'C');

-- Corrected value from ACE
INSERT OR REPLACE INTO timeseries_raw
VALUES ('s1', 'temp', '2024-01-15 10:00:00', 22.5, 'C');
-- Result: Value updated to 22.5
```

### 4. Cron Schedule (5-Minute Intervals)

**Decision: */5 * * * * (Every 5 minutes)**

**Factors:**
- ACE API rate limits: 60 req/min
- Data freshness requirement: Within 1 hour
- Worker execution time: ~30 seconds
- D1 write capacity: 50 MB/day free tier

**Calculation:**
```
Syncs per day: 288 (24 * 60 / 5)
Records per sync: ~100 (assuming 100 sensors)
Total records/day: 28,800
Storage per day: ~2.88 MB (100 bytes/record)
```

**Alternatives Considered:**
- 1-minute: Excessive for 48h lag buffer
- 15-minute: Too slow for dashboard responsiveness
- Event-driven: ACE API doesn't support webhooks

---

## Sequence Diagrams

### 1. First Sync Flow

```
┌──────┐       ┌────────┐       ┌─────────┐       ┌────┐
│ Cron │       │  ETL   │       │ ACE API │       │ D1 │
└──┬───┘       └───┬────┘       └────┬────┘       └─┬──┘
   │               │                 │               │
   │ Trigger       │                 │               │
   ├──────────────>│                 │               │
   │               │                 │               │
   │               │ Check sync_state│               │
   │               ├────────────────────────────────>│
   │               │                 │               │
   │               │ Empty (first run)               │
   │               │<────────────────────────────────┤
   │               │                 │               │
   │               │ Calculate range │               │
   │               │ (now - 72h to now - 48h)        │
   │               │                 │               │
   │               │ GET /readings?start=...&end=... │
   │               ├────────────────>│               │
   │               │                 │               │
   │               │ 200 OK + readings               │
   │               │<────────────────┤               │
   │               │                 │               │
   │               │ Transform data  │               │
   │               │                 │               │
   │               │ INSERT OR REPLACE (batch)       │
   │               ├────────────────────────────────>│
   │               │                 │               │
   │               │ Success                         │
   │               │<────────────────────────────────┤
   │               │                 │               │
   │               │ UPDATE sync_state               │
   │               ├────────────────────────────────>│
   │               │                 │               │
   │ Complete      │                 │               │
   │<──────────────┤                 │               │
```

### 2. Incremental Sync Flow

```
┌──────┐       ┌────────┐       ┌─────────┐       ┌────┐
│ Cron │       │  ETL   │       │ ACE API │       │ D1 │
└──┬───┘       └───┬────┘       └────┬────┘       └─┬──┘
   │               │                 │               │
   │ Trigger (5min)│                 │               │
   ├──────────────>│                 │               │
   │               │                 │               │
   │               │ GET last_sync_end               │
   │               ├────────────────────────────────>│
   │               │                 │               │
   │               │ 2024-01-15 10:00:00             │
   │               │<────────────────────────────────┤
   │               │                 │               │
   │               │ Calculate next window           │
   │               │ (10:00 to 11:00)                │
   │               │                 │               │
   │               │ GET /readings?start=10:00&end=11:00
   │               ├────────────────>│               │
   │               │                 │               │
   │               │ 200 OK (50 readings)            │
   │               │<────────────────┤               │
   │               │                 │               │
   │               │ Dedupe + Transform              │
   │               │                 │               │
   │               │ INSERT OR REPLACE (50 records)  │
   │               ├────────────────────────────────>│
   │               │                 │               │
   │               │ 30 new, 20 updated              │
   │               │<────────────────────────────────┤
   │               │                 │               │
   │               │ INSERT INTO sync_state          │
   │               │ (records_synced=50, status=success)
   │               ├────────────────────────────────>│
   │               │                 │               │
   │ Complete      │                 │               │
   │<──────────────┤                 │               │
```

### 3. Chart Data Request Flow

```
┌────────┐     ┌───────┐     ┌─────┐     ┌────┐
│ React  │     │ Query │     │ KV  │     │ D1 │
│  App   │     │Worker │     │Cache│     │    │
└───┬────┘     └───┬───┘     └──┬──┘     └─┬──┘
    │              │             │           │
    │ GET /api/readings          │           │
    │ ?metric=temp&interval=1h   │           │
    ├─────────────>│             │           │
    │              │             │           │
    │              │ Check cache │           │
    │              ├────────────>│           │
    │              │             │           │
    │              │ MISS        │           │
    │              │<────────────┤           │
    │              │             │           │
    │              │ SELECT with aggregation │
    │              ├────────────────────────>│
    │              │             │           │
    │              │ 1000 records            │
    │              │<────────────────────────┤
    │              │             │           │
    │              │ Format for charts       │
    │              │             │           │
    │              │ Store in cache (5min TTL)
    │              ├────────────>│           │
    │              │             │           │
    │ 200 OK       │             │           │
    │ {data: [...]}              │           │
    │<─────────────┤             │           │
    │              │             │           │
    │ Render chart │             │           │
    │              │             │           │
    │ Refetch (60s)│             │           │
    ├─────────────>│             │           │
    │              │             │           │
    │              │ Check cache │           │
    │              ├────────────>│           │
    │              │             │           │
    │              │ HIT         │           │
    │              │<────────────┤           │
    │              │             │           │
    │ 200 OK (cached)            │           │
    │<─────────────┤             │           │
```

---

## Error Handling & Monitoring

### Error Categories

**1. Transient Errors:**
- Network timeouts
- API rate limiting
- Temporary database locks

**Strategy:** Retry with exponential backoff

```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

**2. Persistent Errors:**
- Invalid API credentials
- Schema mismatches
- Data validation failures

**Strategy:** Alert and manual intervention

```typescript
if (consecutiveFailures > 3) {
  await sendAlert({
    severity: 'critical',
    message: 'ETL sync failing for 15+ minutes',
    details: lastError
  });
}
```

**3. Data Quality Issues:**
- Out-of-range values
- Missing required fields
- Timestamp anomalies

**Strategy:** Flag and quarantine

```sql
CREATE TABLE quarantine_data (
  id INTEGER PRIMARY KEY,
  raw_data TEXT,
  error_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Monitoring Metrics

**Key Metrics:**
```typescript
interface ETLMetrics {
  syncSuccess: number;        // Successful syncs (last hour)
  syncFailures: number;       // Failed syncs (last hour)
  recordsProcessed: number;   // Total records synced
  avgSyncDuration: number;    // Average sync time (ms)
  dateFreshness: Date;        // Latest synced timestamp
  apiResponseTime: number;    // ACE API latency (ms)
  dbWriteTime: number;        // D1 write latency (ms)
  errorRate: number;          // Errors per 100 syncs
}
```

**Alerting Thresholds:**
- Sync failure rate > 10%
- No successful sync in 30 minutes
- Data freshness gap > 6 hours
- API response time > 5 seconds
- Database write errors > 5%

### Logging Strategy

```typescript
// Structured logging
logger.info('sync_started', {
  syncId: uuid(),
  startTime: startDate,
  endTime: endDate,
  expectedRecords: estimatedCount
});

logger.info('sync_completed', {
  syncId: uuid(),
  duration: elapsed,
  recordsInserted: newRecords,
  recordsUpdated: updatedRecords,
  recordsSkipped: skippedRecords
});

logger.error('sync_failed', {
  syncId: uuid(),
  error: error.message,
  stack: error.stack,
  retryAttempt: attemptNumber
});
```

---

## Performance Considerations

### Query Optimization

**1. Time Range Queries:**
```sql
-- Optimized with timestamp index
SELECT * FROM timeseries_raw
WHERE timestamp BETWEEN ? AND ?
  AND device_id = ?
ORDER BY timestamp ASC;
-- Uses: idx_device_metric_time
```

**2. Aggregation Queries:**
```sql
-- Pre-aggregated materialized view
CREATE VIEW hourly_aggregates AS
SELECT
  datetime(timestamp, 'start of hour') as hour,
  device_id,
  metric_type,
  AVG(value) as avg_value,
  MIN(value) as min_value,
  MAX(value) as max_value,
  COUNT(*) as sample_count
FROM timeseries_raw
GROUP BY hour, device_id, metric_type;
```

### Batch Operations

**Optimal Batch Size:**
```typescript
const BATCH_SIZE = 100; // Records per insert

async function batchInsert(records: Reading[]) {
  const batches = chunk(records, BATCH_SIZE);

  for (const batch of batches) {
    const placeholders = batch.map(() => '(?,?,?,?)').join(',');
    const values = batch.flatMap(r => [r.deviceId, r.metric, r.timestamp, r.value]);

    await db.prepare(`
      INSERT OR REPLACE INTO timeseries_raw
      (device_id, metric_type, timestamp, value)
      VALUES ${placeholders}
    `).bind(...values).run();
  }
}
```

### Scaling Considerations

**Current Limits:**
- D1 Database: 10 GB free tier
- Worker invocations: 100,000/day free
- API requests: 60/minute rate limit

**Growth Projections:**
| Timeline | Devices | Records/Day | Storage | Queries/Day |
|----------|---------|-------------|---------|-------------|
| Month 1  | 100     | 28,800      | 2.88 MB | 1,000       |
| Year 1   | 500     | 144,000     | 14.4 MB | 10,000      |
| Year 3   | 2,000   | 576,000     | 57.6 MB | 50,000      |

**Scaling Strategy:**
- Partition tables by month after 1 GB
- Implement data retention policy (2 years)
- Add read replicas for query workers
- Consider time-series database (InfluxDB) if > 1M records/day

---

## Deployment Checklist

- [ ] Configure ACE API credentials in Wrangler secrets
- [ ] Create D1 database: `wrangler d1 create building-vitals`
- [ ] Run schema migrations: `wrangler d1 execute --file schema.sql`
- [ ] Deploy ETL worker: `wrangler deploy workers/etl`
- [ ] Deploy Query worker: `wrangler deploy workers/query`
- [ ] Set up cron trigger in `wrangler.toml`
- [ ] Configure monitoring alerts
- [ ] Test backfill for initial data load
- [ ] Verify chart integration in React app
- [ ] Document runbook for operations team

---

## References

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Database Guide](https://developers.cloudflare.com/d1/)
- [ACE IoT API Documentation](internal-docs/ace-api.md)
- [React Query Best Practices](https://tanstack.com/query/latest)

---

**Last Updated:** 2024-01-15
**Version:** 1.0
**Author:** System Architect
**Review Cycle:** Quarterly
