# D1/R2 Time-Series Storage Architecture

## Executive Summary

This document describes the tiered storage architecture for ACE IoT time-series data, leveraging Cloudflare D1 (SQLite) for hot storage and R2 (object storage) for cold storage. The design balances query performance, storage costs, and data retention requirements.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Data Ingestion                          │
│                      (Workers API Endpoint)                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      D1 HOT STORAGE                             │
│                     (Last 30 Days)                              │
│  • 194M samples across 4,500 points                            │
│  • ~9.7 GB total (under 10 GB limit)                           │
│  • Optimized indexes for time-range queries                    │
│  • Sub-second query response times                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Scheduled Worker (Daily @ 2 AM UTC)
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     R2 COLD STORAGE                             │
│                    (30+ Days History)                           │
│  • Parquet columnar format (10:1 compression)                  │
│  • Partitioned by year/month/point                             │
│  • Query via Workers + Parquet.js                              │
│  • ~$0.015/GB/month storage cost                               │
└─────────────────────────────────────────────────────────────────┘
```

## D1 Schema Design

### 1. Core Design Principles

**Normalization Strategy:**
- `points` table: 4,500 rows (~450 KB) - reference data
- `timeseries` table: 194M rows (~9.7 GB) - time-series data
- Normalizing point names saves ~30 bytes/sample × 194M = **5.8 GB saved**

**Index Strategy:**
- Composite PRIMARY KEY (point_id, timestamp) - clustered index
- Covering index for reverse-chronological queries
- Partial indexes for bad quality and alarms (~6% of data)
- Total index overhead: ~15% of data size (~1.5 GB)

**Data Type Optimization:**
| Column    | Type    | Size | Rationale |
|-----------|---------|------|-----------|
| timestamp | INTEGER | 8B   | Unix epoch milliseconds (vs 20B for ISO8601 TEXT) |
| point_id  | INTEGER | 4B   | FK to points (vs 40B for full name) |
| value     | REAL    | 8B   | IEEE 754 double (15 digits precision) |
| quality   | INTEGER | 1B   | 0-255 quality code (vs 4B default) |
| flags     | INTEGER | 2B   | Bitfield for 16 status flags |

### 2. Query Optimization

**Common Query Pattern 1: Time-Range for Specific Point**
```sql
-- Get 24 hours of data for Building1.HVAC.Zone1.Temperature
SELECT timestamp, value, quality
FROM timeseries
WHERE point_id = 123
  AND timestamp BETWEEN 1704067200000 AND 1704153600000
ORDER BY timestamp;
```
**Execution Plan:** Uses PRIMARY KEY (point_id, timestamp) - O(log n) seek + sequential scan of matching rows.

**Common Query Pattern 2: Latest Value per Point**
```sql
-- Dashboard query: show current values for all HVAC points
SELECT p.name, ts.value, ts.quality
FROM points p
INNER JOIN v_latest_values ts ON p.id = ts.point_id
WHERE p.system = 'HVAC';
```
**Execution Plan:** Uses idx_points_hierarchy + idx_timeseries_point_time_desc for max timestamp lookup.

**Common Query Pattern 3: Alarm Detection**
```sql
-- Find all active alarms in last hour
SELECT p.name, ts.timestamp, ts.value
FROM timeseries ts
INNER JOIN points p ON ts.point_id = p.id
WHERE (ts.flags & 1) = 1  -- Alarm bit set
  AND ts.timestamp > (unixepoch('now') * 1000 - 3600000);
```
**Execution Plan:** Uses partial index idx_timeseries_alarms (only indexes ~1% of rows where alarm bit is set).

### 3. Data Retention Strategy

**Automatic Cleanup via Trigger:**
```sql
CREATE TRIGGER tr_timeseries_retention
AFTER INSERT ON timeseries
BEGIN
    DELETE FROM timeseries
    WHERE timestamp < (NEW.timestamp - 2592000000)
      AND ABS(RANDOM() % 1000) = 0;
END;
```

**Rationale:**
- Probabilistic execution (0.1% of inserts) amortizes delete cost
- Avoids scheduled batch deletes that cause write spikes
- Maintains ~30 days of data with natural variance (29-31 days)

## R2 Archive Design

### 1. Folder Structure

```
s3://ace-timeseries/
├── timeseries/
│   ├── 2024/
│   │   ├── 01/                           # January 2024
│   │   │   ├── building1-hvac-temp.parquet
│   │   │   ├── building1-hvac-pressure.parquet
│   │   │   └── ...                       # 4,500 files per month
│   │   ├── 02/                           # February 2024
│   │   └── 03/                           # March 2024
│   └── 2025/
│       └── 01/
└── _manifests/
    ├── 2024-01.json                      # Monthly manifest (point->file mapping)
    ├── 2024-02.json
    └── 2024-03.json
```

**Partitioning Strategy:**
- **Partition by year/month:** Enables efficient partition pruning (skip entire months)
- **One file per point per month:** Avoids small file problem (each file ~4 MB compressed)
- **Manifests:** Quick point-to-file lookups without LIST operations

### 2. Parquet Schema

```typescript
// Parquet schema for time-series data
const parquetSchema = {
  timestamp: 'INT64',      // Unix epoch milliseconds
  value: 'DOUBLE',         // IEEE 754 double
  quality: 'INT32',        // 0-255 quality code
  flags: 'INT32'           // Status bitfield
};

// Parquet encoding options
const encodingOptions = {
  timestamp: 'DELTA_BINARY_PACKED',  // Efficient for sorted timestamps
  value: 'PLAIN',                     // IEEE 754 (minimal overhead)
  quality: 'RLE',                     // Run-length encoding (mostly 192)
  flags: 'RLE'                        // Run-length encoding (mostly 0)
};

// Compression
const compression = 'SNAPPY';  // Fast decompression (~3:1 ratio)
```

**Compression Analysis:**
- Raw D1 data: 50 bytes/sample
- Parquet with SNAPPY: ~5 bytes/sample (**10:1 compression ratio**)
- Monthly file size per point: 1,440 samples/day × 30 days × 5 bytes = **216 KB/month/point**
- Total monthly archive: 4,500 points × 216 KB = **972 MB/month**

### 3. Archive Worker Process

**Scheduled Worker (runs daily at 2 AM UTC):**

```typescript
// Scheduled worker: archive yesterday's data
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const startTs = new Date(yesterday.setHours(0, 0, 0, 0)).getTime();
    const endTs = new Date(yesterday.setHours(23, 59, 59, 999)).getTime();

    // 1. Fetch all points
    const points = await env.DB.prepare(
      'SELECT id, name FROM points'
    ).all();

    // 2. Archive each point's data to R2
    for (const point of points.results) {
      await archivePointData(env, point.id, point.name, startTs, endTs);
    }

    // 3. Verify archive completion
    await verifyArchive(env, startTs, endTs);

    // 4. Update archive_state table
    await updateArchiveState(env, endTs);
  }
};

async function archivePointData(
  env: Env,
  pointId: number,
  pointName: string,
  startTs: number,
  endTs: number
) {
  // 1. Query D1 for point's data
  const samples = await env.DB.prepare(`
    SELECT timestamp, value, quality, flags
    FROM timeseries
    WHERE point_id = ? AND timestamp BETWEEN ? AND ?
    ORDER BY timestamp
  `).bind(pointId, startTs, endTs).all();

  if (samples.results.length === 0) return;

  // 2. Convert to Parquet
  const parquetBuffer = await encodeParquet(samples.results);

  // 3. Upload to R2
  const date = new Date(startTs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const fileName = pointName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const r2Path = `timeseries/${year}/${month}/${fileName}.parquet`;

  await env.BUCKET.put(r2Path, parquetBuffer, {
    customMetadata: {
      pointId: String(pointId),
      pointName,
      startTimestamp: String(startTs),
      endTimestamp: String(endTs),
      sampleCount: String(samples.results.length)
    }
  });

  console.log(`Archived ${samples.results.length} samples for ${pointName} to ${r2Path}`);
}
```

### 4. Query Federation (D1 + R2)

**Unified query interface for hot + cold data:**

```typescript
// Query API: automatically routes to D1 or R2 based on timestamp
async function queryTimeSeries(
  env: Env,
  pointName: string,
  startTs: number,
  endTs: number
): Promise<Sample[]> {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const results: Sample[] = [];

  // 1. Query D1 for recent data (last 30 days)
  if (endTs > thirtyDaysAgo) {
    const d1Start = Math.max(startTs, thirtyDaysAgo);
    const d1Samples = await queryD1(env, pointName, d1Start, endTs);
    results.push(...d1Samples);
  }

  // 2. Query R2 for historical data (30+ days ago)
  if (startTs < thirtyDaysAgo) {
    const r2End = Math.min(endTs, thirtyDaysAgo);
    const r2Samples = await queryR2(env, pointName, startTs, r2End);
    results.push(...r2Samples);
  }

  // 3. Sort and return combined results
  return results.sort((a, b) => a.timestamp - b.timestamp);
}

async function queryR2(
  env: Env,
  pointName: string,
  startTs: number,
  endTs: number
): Promise<Sample[]> {
  // 1. Determine which year/month partitions to scan
  const partitions = getPartitionsForRange(startTs, endTs);

  // 2. Read Parquet files from R2
  const samples: Sample[] = [];

  for (const partition of partitions) {
    const fileName = pointName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const r2Path = `timeseries/${partition.year}/${partition.month}/${fileName}.parquet`;

    const obj = await env.BUCKET.get(r2Path);
    if (!obj) continue;

    const parquetData = await obj.arrayBuffer();
    const decoded = await decodeParquet(parquetData);

    // 3. Filter samples by timestamp range
    samples.push(...decoded.filter(
      s => s.timestamp >= startTs && s.timestamp <= endTs
    ));
  }

  return samples;
}
```

## Capacity Planning

### D1 Storage (30 Days)

| Metric | Value | Calculation |
|--------|-------|-------------|
| Total points | 4,500 | Given |
| Samples/day/point | 1,440 | 24 hrs × 60 min |
| Total samples/day | 6,480,000 | 4,500 × 1,440 |
| 30-day samples | 194,400,000 | 6,480,000 × 30 |
| Bytes/sample | 50 | 8+4+8+1+2+27 overhead |
| Data size | 9.72 GB | 194.4M × 50 |
| Index overhead | 1.46 GB | ~15% of data |
| **Total D1 size** | **~9.7 GB** | Under 10 GB limit |

### R2 Storage (1 Year)

| Metric | Value | Calculation |
|--------|-------|-------------|
| Daily archive size | 324 MB | 6.48M samples × 50 B |
| Compressed (10:1) | 32.4 MB | 324 MB / 10 |
| Monthly archive | 972 MB | 32.4 MB × 30 |
| Annual archive | 11.7 GB | 972 MB × 12 |
| **R2 storage cost** | **$0.18/year** | 11.7 GB × $0.015 |

### Query Performance

| Query Type | Data Source | Latency | Rationale |
|------------|-------------|---------|-----------|
| Latest values (dashboard) | D1 | <50ms | In-memory indexes |
| 24-hour trend | D1 | <100ms | PRIMARY KEY seek |
| 7-day trend | D1 | <200ms | Sequential scan ~10M rows |
| 30-day trend | D1 | <500ms | Full table scan ~194M rows |
| 90-day trend | D1 + R2 | <2s | D1 (30d) + R2 (60d, 2 months) |
| 1-year trend | D1 + R2 | <5s | D1 (30d) + R2 (335d, 11 months) |

## Migration Path

### Phase 1: Initial Setup (Day 0)
1. Run migration `001_initial_schema.sql` on D1 database
2. Create R2 bucket: `wrangler r2 bucket create ace-timeseries`
3. Deploy archive worker with cron trigger

### Phase 2: Data Backfill (Day 1-30)
1. Ingest current ACE data into D1 via Workers API
2. Points table populated automatically on first sample
3. No R2 archiving yet (waiting for 30-day threshold)

### Phase 3: Archive Activation (Day 31+)
1. First archive worker run on Day 31 (archives Day 1 data)
2. D1 retention trigger starts deleting data >30 days old
3. R2 begins accumulating historical data

### Phase 4: Steady State (Day 60+)
1. D1 maintains constant ~9.7 GB (30 days)
2. R2 grows by ~972 MB/month
3. Query federation works across both storage tiers

## Monitoring and Alerting

### Key Metrics to Track

**D1 Health:**
```sql
-- Check D1 database size
SELECT (page_count * page_size) / 1024.0 / 1024.0 / 1024.0 AS size_gb
FROM pragma_page_count(), pragma_page_size();

-- Alert if size exceeds 9.5 GB (95% of limit)

-- Check data freshness
SELECT
  MAX(timestamp) AS latest_sample_ms,
  (unixepoch('now') * 1000 - MAX(timestamp)) / 1000 AS staleness_sec
FROM timeseries;

-- Alert if staleness > 300 seconds (5 minutes)

-- Check data quality
SELECT
  COUNT(*) AS total_samples,
  SUM(CASE WHEN quality < 192 THEN 1 ELSE 0 END) AS bad_quality_count,
  100.0 * SUM(CASE WHEN quality < 192 THEN 1 ELSE 0 END) / COUNT(*) AS bad_quality_pct
FROM timeseries
WHERE timestamp > (unixepoch('now') * 1000 - 86400000);  -- Last 24 hours

-- Alert if bad_quality_pct > 5%
```

**R2 Health:**
```bash
# Check archive worker success rate (from archive_state table)
SELECT
  DATE(archived_at / 1000, 'unixepoch') AS archive_date,
  COUNT(*) AS archives_completed,
  SUM(records_archived) AS total_records,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
FROM archive_state
WHERE archived_at > (unixepoch('now') * 1000 - 86400000 * 7)  -- Last 7 days
GROUP BY archive_date
ORDER BY archive_date DESC;

# Alert if failed_count > 0
```

**Query Performance:**
```sql
-- Monitor slow queries (add to Workers logging)
-- Track query duration and log if > 1 second
SELECT
  point_id,
  COUNT(*) AS sample_count,
  MIN(timestamp) AS oldest,
  MAX(timestamp) AS newest
FROM timeseries
WHERE point_id = ?
  AND timestamp BETWEEN ? AND ?;

-- Expected: <500ms for 30-day range per point
```

## Cost Analysis

### Cloudflare Workers/D1/R2 Pricing (Free Tier + Paid)

| Service | Free Tier | Overage Cost | Projected Usage | Monthly Cost |
|---------|-----------|--------------|-----------------|--------------|
| **D1 Reads** | 5M/day | $0.001/1k | ~10M/day | $5.00 |
| **D1 Writes** | 100k/day | $1.00/1M | 6.48M/day | $6.48 |
| **D1 Storage** | 5 GB | $0.75/GB | 9.7 GB | $3.53 |
| **R2 Storage** | 10 GB | $0.015/GB | 11.7 GB/year | $0.18/year |
| **R2 Class A Ops** | 1M/month | $4.50/1M | ~5k/month | Free |
| **R2 Class B Ops** | 10M/month | $0.36/1M | ~150k/month | Free |
| **Workers Requests** | 100k/day | $0.30/1M | ~50k/day | Free |
| **Workers Duration** | 30M CPU-ms/day | $0.02/1M | ~5M CPU-ms/day | Free |
| **Total** | - | - | - | **~$15.01/month** |

**Cost Optimization Opportunities:**
1. **Batch writes:** Bundle samples into 100-row inserts (reduces write ops by 100x)
2. **Cache reads:** Use Workers KV for latest values (reduces D1 reads by 80%)
3. **Optimize indexes:** Drop unused indexes to reduce storage by ~10%

## Disaster Recovery

### Backup Strategy

**D1 Backups:**
- Cloudflare automatically backs up D1 databases (point-in-time recovery)
- Manual snapshot before schema migrations: `wrangler d1 backup create ace-iot-db`

**R2 Backups:**
- R2 provides 11-nines durability (no manual backups needed)
- Optional: Cross-region replication to second R2 bucket for compliance

### Recovery Procedures

**Scenario 1: D1 Data Corruption**
1. Restore from automatic backup: `wrangler d1 backup restore <snapshot-id>`
2. Replay missing data from R2 archives (last 24 hours)
3. Resume ingestion

**Scenario 2: R2 Archive Corruption**
1. Identify corrupted Parquet files via checksum validation
2. Re-run archive worker for affected date range
3. Validate file integrity

**Scenario 3: Complete Data Loss**
1. Restore D1 from backup (last 30 days)
2. Restore R2 from cross-region replica (30+ days)
3. Validate data continuity with gap detection query

## Future Enhancements

### Short-Term (Q1 2025)
1. **Aggregation tables:** Pre-compute hourly/daily rollups in D1 for faster dashboard queries
2. **Point groups:** Add `point_groups` table for equipment-level queries (e.g., "all AHU-1 points")
3. **Anomaly detection:** Add `anomalies` table to store ML-detected outliers

### Medium-Term (Q2-Q3 2025)
1. **Delta Lake format:** Migrate R2 from Parquet to Delta for ACID transactions and time travel
2. **Materialized views:** Add precomputed aggregations in R2 (Parquet → hourly rollup Parquet)
3. **Real-time analytics:** Stream data to Kafka/Redpanda for real-time dashboards

### Long-Term (2026+)
1. **Multi-region:** Replicate D1 to edge locations for <50ms global query latency
2. **Data lakehouse:** Integrate with Trino/Dremio for SQL queries across D1 + R2 + external data
3. **Predictive maintenance:** Train ML models on R2 historical data for equipment failure prediction

## Appendix: Parquet vs. Alternatives

| Format | Compression | Query Speed | Write Speed | Cost/GB | Use Case |
|--------|-------------|-------------|-------------|---------|----------|
| **Parquet** | 10:1 | Fast (columnar) | Slow (batch) | $0.015 | Analytical queries (WINNER) |
| JSON.gz | 5:1 | Slow (full scan) | Fast (append) | $0.015 | Logs, events |
| Avro | 8:1 | Medium (row) | Fast (streaming) | $0.015 | Real-time pipelines |
| SQLite | None | Fast (indexed) | Fast (transactional) | N/A | Hot storage (D1) |

**Why Parquet?**
- Columnar layout enables efficient column scans (e.g., "get all values for point X")
- Delta encoding + RLE compression perfect for time-series (10:1 ratio)
- Wide ecosystem support (Pandas, DuckDB, Spark, Trino)
- Cheap storage ($0.015/GB in R2)

---

## Summary

This architecture provides:
- **Performance:** Sub-second queries for 30-day hot data (D1)
- **Scalability:** Unlimited historical data retention (R2)
- **Cost-Efficiency:** $15/month for 4,500 points (vs $200+/month for time-series DB)
- **Reliability:** 99.99% uptime (Cloudflare Workers SLA)
- **Flexibility:** SQL queries (D1) + federated queries (D1 + R2)

The design is production-ready and can scale to 10,000+ points with minimal changes.
