# Production Validation Report - Wave 3 Workers

**Date:** 2025-10-14
**Validator:** Production Validation Agent
**Scope:** Query Worker, Archival Worker, Backfill Worker
**Existing Production:** ETL Sync Worker (building-vitals-etl-sync)

---

## Executive Summary

**Deployment Readiness Score: 3/10** ⚠️ **CRITICAL BLOCKERS PRESENT**

**Status:** ❌ **NOT READY FOR PRODUCTION**

**Critical Issues:** 5 blockers must be resolved before deployment
**High-Risk Issues:** 8 items requiring immediate attention
**Medium-Risk Issues:** 4 items to monitor

---

## 1. Critical Blockers (Must Fix Before Deployment)

### 🚨 BLOCKER #1: R2 Parquet Reader Not Implemented
**Worker:** Query Worker
**File:** `src/lib/r2-client.js:158-241`
**Severity:** CRITICAL

**Issue:**
```javascript
// Line 183: WAVE 2 SIMULATION: Return empty array
console.log(`[R2] SIMULATION: Returning empty array for ${filePath}`);
return [];
```

The R2 Parquet file reader is **completely stubbed out**. The query worker will return zero results for any historical data queries (>20 days old).

**Impact:**
- Users cannot query 1 year of historical data
- Chart building workflow will fail for any date range beyond 20 days
- Backfill worker writes Parquet files that cannot be read

**Resolution Required:**
1. Implement actual Parquet parsing using one of:
   - DuckDB WASM (recommended, full SQL support)
   - parquetjs library (lighter weight)
   - Apache Arrow JS (performance-focused)
2. Add Snappy decompression support
3. Implement column pruning and row filtering
4. Add comprehensive tests against real Parquet files

**Estimated Effort:** 16-24 hours

---

### 🚨 BLOCKER #2: Parquet Writer Missing Dependencies
**Worker:** Archival Worker, Backfill Worker
**Files:** `src/lib/parquet-writer.js:8`, `wrangler-archival.toml:39`
**Severity:** CRITICAL

**Issue:**
```javascript
// Line 8: import parquet from 'parquetjs';
```

The `parquetjs` npm package is imported but:
1. Not listed in `package.json` dependencies
2. Build command in `wrangler-archival.toml` is insufficient
3. No webpack/bundler config for Cloudflare Workers environment

**Impact:**
- Archival worker will fail at runtime with "module not found"
- Backfill worker will fail to create Parquet files
- Historical data cannot be archived

**Resolution Required:**
1. Add to package.json:
   ```json
   "dependencies": {
     "parquetjs": "^1.6.0"
   }
   ```
2. Verify parquetjs is compatible with Cloudflare Workers (no Node.js fs/stream APIs)
3. May need alternative: hyparquet (pure JS, no Node deps)
4. Update wrangler.toml build configuration
5. Test in actual Workers environment

**Estimated Effort:** 8-12 hours

---

### 🚨 BLOCKER #3: D1 Schema Mismatch - Points Table
**Workers:** All (Query, Archival, Backfill, ETL)
**Files:** `src/lib/d1-client.js:147-181`, `src/etl-sync-worker.js`
**Severity:** CRITICAL

**Issue:**
The ETL worker and Wave 3 workers have **different** point normalization logic:

**ETL Worker (Production):**
- Uses `site_name` directly in timeseries queries
- No point_id normalization visible in main code

**Wave 3 Workers:**
```javascript
// d1-client.js:165-169
INSERT INTO points (name, building, data_type, created_at, updated_at)
VALUES (?, ?, 'analog', unixepoch('now') * 1000, unixepoch('now') * 1000)
ON CONFLICT(name) DO UPDATE SET updated_at = unixepoch('now') * 1000
RETURNING id
```

**Query Worker:**
```javascript
// query-worker.js:423-435
SELECT
  p.name as point_name,
  ts.timestamp,
  ts.value
FROM timeseries ts
JOIN points p ON ts.point_id = p.id
WHERE p.building = ?  -- site_name
  AND p.name IN (...)
```

**Critical Questions:**
1. Does the production D1 schema have a `points` table?
2. Does `timeseries` table use `point_id` (FK) or store `point_name` directly?
3. Are ETL worker and Wave 3 workers using the same schema version?

**Impact:**
- Query worker may return zero results if schema doesn't match
- Data written by ETL might not be readable by Query worker
- Risk of data corruption if schemas conflict

**Resolution Required:**
1. Examine production D1 schema with:
   ```bash
   wrangler d1 execute ace-iot-db \
     --command "SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('timeseries', 'points')" \
     --remote
   ```
2. Verify point_id normalization is consistent across all workers
3. If schemas differ, create migration plan
4. Add schema version checking to all workers

**Estimated Effort:** 4-8 hours (could be 16+ if migration needed)

---

### 🚨 BLOCKER #4: Archival Worker Logic Errors
**Worker:** Archival Worker
**File:** `src/archival-worker.js`
**Severity:** CRITICAL

**Issue #1: Month-based archival instead of day-based**
```javascript
// Line 193-204: Archives by MONTH, not DAY
const monthStart = new Date(year, currentDate.getMonth(), 1).getTime();
const monthEnd = new Date(year, currentDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
await archiveMonthData(env, pointId, year, month, monthStart, monthEnd, runId, stats);
```

**Spec violation:** System spec defines daily partitions:
- Query worker expects: `timeseries/YYYY/MM/DD.parquet`
- Archival worker creates: `timeseries/YYYY/MM/{pointId}.parquet`

**Issue #2: Wrong R2 path structure**
```javascript
// Line 219: const r2Key = `timeseries/${year}/${month}/${pointId}.parquet`;
```

Should be:
```javascript
const r2Key = `timeseries/${siteName}/${year}/${month}/${day}.parquet`;
```

**Issue #3: Missing variable definitions**
```javascript
// Line 84-86: ARCHIVE_THRESHOLD_DAYS not imported from CONFIG
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_THRESHOLD_DAYS);
```

Should be:
```javascript
cutoffDate.setDate(cutoffDate.getDate() - CONFIG.ARCHIVE_THRESHOLD_DAYS);
```

**Issue #4: Incomplete Parquet schema**
```javascript
// Line 275-279: Schema doesn't match D1 structure
const parquetBuffer = await convertToParquet(allRecords, {
  timestamp: { type: 'INT64' },
  value: { type: 'DOUBLE' },
  quality: { type: 'INT32' },  // D1 doesn't have quality column
  point_id: { type: 'UTF8' }   // Should be point_name + site_name
});
```

**Issue #5: Function calls missing implementation**
```javascript
// Line 281, 289, 310: Functions not defined in file
await convertToParquet(...)       // No import statement
await uploadParquetFile(...)      // No import statement
await checkFileExists(...)        // No import statement
```

**Impact:**
- Query worker cannot find archived files (wrong path structure)
- Data loss risk if archival runs (wrong schema)
- Worker will fail at runtime (missing functions, undefined variables)
- System architecture violation (month vs day partitions)

**Resolution Required:**
1. Rewrite archival logic for daily partitions matching spec
2. Fix R2 path structure to include site_name and day
3. Import missing functions from `r2-client.js`
4. Fix variable references to use CONFIG object
5. Align Parquet schema with D1 timeseries table
6. Add site_name to Parquet files for multi-site support

**Estimated Effort:** 12-16 hours (requires significant rewrite)

---

### 🚨 BLOCKER #5: Backfill Worker Path Mismatch
**Worker:** Backfill Worker
**File:** `src/backfill-worker.js:545`
**Severity:** CRITICAL

**Issue:**
```javascript
// Line 545: const r2Key = `timeseries/${year}/${month}/${day}/${siteName}.parquet`;
```

**Path structure inconsistency:**
- Backfill worker: `timeseries/YYYY/MM/DD/{siteName}.parquet`
- R2 client expects: `timeseries/{siteName}/YYYY/MM/DD.parquet`
- Archival worker: `timeseries/YYYY/MM/{pointId}.parquet` (wrong)

**System spec defines:** `timeseries/{site_name}/{YYYY}/{MM}/{DD}.parquet`

**Impact:**
- Backfilled data stored in wrong location
- Query worker cannot find backfilled data
- Multiple Parquet files per day instead of single consolidated file
- Storage inefficiency (4,583 points × 365 days = 1,672,795 files instead of 365)

**Resolution Required:**
1. Fix R2 path to: `timeseries/${siteName}/${year}/${month}/${day}.parquet`
2. Ensure daily consolidation (all points in one file per day)
3. Update Parquet schema to include point_name column
4. Align with Query worker expectations

**Estimated Effort:** 4-6 hours

---

## 2. High-Risk Issues (Must Address Before Production)

### ⚠️ HIGH #1: No KV Binding in Backfill Worker
**Worker:** Backfill Worker
**File:** `workers/wrangler-backfill.toml:34`

**Issue:**
```toml
[[kv_namespaces]]
binding = "ETL_STATE"
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"
```

**Problem:** Binding name is `ETL_STATE` but code uses `env.ETL_STATE` which is correct. However, the backfill worker **does not need D1** according to spec, but the code may reference it.

**Verification needed:** Ensure backfill worker doesn't accidentally call D1 operations.

---

### ⚠️ HIGH #2: Missing Archival Worker R2 Binding in External Config
**Worker:** Archival Worker
**File:** `wrangler-archival-external.toml`

**Issue:** File exists but was not provided for analysis. Need to verify R2 bucket binding exists.

---

### ⚠️ HIGH #3: Query Worker Point Name Casing
**Worker:** Query Worker
**File:** `src/query-worker.js:417-444`

**Issue:**
```javascript
// Line 431: WHERE p.building = ?
//               AND p.name IN (...)
```

**Concern:** ACE API returns point names with specific casing (e.g., "Building1.HVAC.AHU-1.SupplyTemp"). If the D1 `points` table name column is case-sensitive and doesn't match exactly, queries will return zero results.

**Verification needed:**
1. Check D1 points table for case sensitivity
2. Verify point names inserted by ETL match query expectations
3. Add COLLATE NOCASE if needed

---

### ⚠️ HIGH #4: Archival Worker Cron Timing Risk
**Worker:** Archival Worker
**File:** `wrangler-archival.toml:10-11`

**Issue:**
```toml
[triggers]
crons = ["0 2 * * *"]  # Daily at 2 AM UTC
```

**Concern:** Archives data >30 days old (per line 31: `ARCHIVE_THRESHOLD_DAYS = "30"`), but spec says 20-day boundary. This conflicts with query worker's 20-day hot/cold split.

**Impact:**
- Data between days 20-30 will exist in D1 AND potentially in R2
- Or worse, data will be deleted from D1 before 20 days, breaking query worker
- Inconsistency between config value and code logic

**Resolution Required:**
1. Change `ARCHIVE_THRESHOLD_DAYS` to `"20"` to match spec
2. Verify archival logic uses this config value
3. Ensure archival only removes data >20 days, not >30

---

### ⚠️ HIGH #5: No Deduplication at 20-Day Boundary
**Worker:** Query Worker
**File:** `src/query-worker.js:474-501`

**Issue:**
```javascript
// Line 474-501: mergeSamples function
function mergeSamples(d1Samples, r2Samples) {
  const sampleMap = new Map();

  // Add R2 samples first (lower priority)
  for (const sample of r2Samples) {
    const key = `${sample.point_name}:${sample.timestamp}`;
    sampleMap.set(key, sample);
  }

  // Add D1 samples (higher priority - overwrites R2 if duplicate)
  for (const sample of d1Samples) {
    const key = `${sample.point_name}:${sample.timestamp}`;
    sampleMap.set(key, sample);
  }
```

**Analysis:** Deduplication logic **is implemented** and looks correct. D1 data overrides R2 data at boundary. ✅

**However:** Need to verify that archival worker doesn't delete data that query worker still considers "hot" (race condition during the exact 20-day boundary).

---

### ⚠️ HIGH #6: ETL Worker Writes Unfiltered Data
**Worker:** ETL Sync Worker (Production)
**File:** `src/etl-sync-worker.js:266-273`

**Issue:**
```javascript
// Line 266-273: Filters to configured points ONLY
const configuredPointNames = new Set(pointsList.map(p => p.name));
const filteredSamples = allTimeseriesData
  .filter(sample => configuredPointNames.has(sample.name))
  .filter(sample => sample.value != null && !isNaN(parseFloat(sample.value)));

console.log(`[ETL] Filtered from ${allTimeseriesData.length} total samples to ${filteredSamples.length} RAW samples for ${configuredPointNames.size} configured points (NULL values removed)`);
```

**Analysis:** ETL worker **does filter** to configured points. The user's statement "storing ALL raw data (no filtering)" is incorrect based on code review. ✅

**Verification needed:** Confirm this matches production behavior.

---

### ⚠️ HIGH #7: No Rate Limiting on Backfill Worker
**Worker:** Backfill Worker
**File:** `src/backfill-worker.js:637-643`

**Issue:**
```javascript
// Line 637-638: Rate limiting calculation
const throttleDelay = (60 * 1000) / CONFIG.REQUESTS_PER_MINUTE;

// Line 641-643: Applied in loop
if (pageCount > 0) {
  await sleep(throttleDelay);
}
```

**Analysis:** Rate limiting **is implemented**. ✅

**Concern:** `REQUESTS_PER_MINUTE = 50` (line 55) may still be too aggressive for 24-hour sustained operation. ACE API limit is ~60/min, but sustained load may trigger different limits.

**Recommendation:** Start conservative (30 req/min) and monitor.

---

### ⚠️ HIGH #8: Archival Worker Incomplete Function Implementations
**Worker:** Archival Worker
**File:** `src/archival-worker.js:336`

**Issue:** File ends at line 336 but references functions that aren't defined:
- `convertToParquet()` (line 275)
- `uploadParquetFile()` (line 289)
- `checkFileExists()` (line 222, 310)
- `MAX_RETRIES` (line 287)
- `BATCH_SIZE` (line 248)

**Impact:** Runtime errors guaranteed on first execution.

**Resolution:** Add imports:
```javascript
import { convertToParquet } from './lib/parquet-writer.js';
import { uploadParquetFile, checkFileExists } from './lib/r2-client.js';
```

And reference CONFIG constants:
```javascript
CONFIG.MAX_RETRIES
CONFIG.BATCH_SIZE
```

---

## 3. Medium-Risk Issues (Monitor After Deployment)

### ⚙️ MEDIUM #1: Query Worker Cache Key Collision Risk
**Worker:** Query Worker
**File:** `src/query-worker.js:510-528`

**Issue:**
```javascript
// Simple hash function (for production, consider using crypto.subtle.digest)
let hash = 0;
for (let i = 0; i < str.length; i++) {
  hash = ((hash << 5) - hash) + str.charCodeAt(i);
  hash = hash & hash; // Convert to 32bit integer
}
```

**Concern:** Simple hash has higher collision probability. Two different queries could get same cache key.

**Recommendation:** Use crypto.subtle.digest('SHA-256') for production.

---

### ⚙️ MEDIUM #2: No Metrics/Alerting Configuration
**Workers:** All

**Issue:** Workers log to console but have no structured metrics or alerting.

**Recommendation:**
1. Add Cloudflare Workers Analytics Engine calls
2. Set up Cloudflare alerts for:
   - Query worker >5s response time
   - Archival worker failures
   - Backfill worker stalls (no progress for 1 hour)
3. Add KV-based metrics for dashboard

---

### ⚙️ MEDIUM #3: No Circuit Breaker for ACE API
**Workers:** ETL, Backfill

**Issue:** Retry logic exists but no circuit breaker. If ACE API is down, workers will retry indefinitely.

**Recommendation:**
1. Add circuit breaker pattern
2. Fail fast after N consecutive failures
3. Store failure state in KV to avoid retry storms

---

### ⚙️ MEDIUM #4: Query Worker CORS Headers Too Permissive
**Worker:** Query Worker
**File:** `src/query-worker.js:74-78`

**Issue:**
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // ...
};
```

**Concern:** Allows any origin. Should restrict to Building Vitals frontend domain.

**Recommendation:**
```javascript
'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || 'https://building-vitals.com'
```

---

## 4. Configuration Validation

### ✅ Database IDs - CORRECT
```toml
# All workers use same production database
database_id = "1afc0a07-85cd-4d5f-a046-b580ffffb8dc"
```

### ✅ KV Namespace IDs - CORRECT
```toml
# All workers use same KV namespace
id = "fa5e24f3f2ed4e3489a299e28f1bffaa"
```

### ✅ R2 Bucket Names - CORRECT
```toml
# Consistent bucket name across workers
bucket_name = "ace-timeseries"
```

### ⚠️ Environment Variables - REVIEW NEEDED
```toml
# Query Worker
HOT_STORAGE_DAYS = "20"  ✅ Matches spec

# Archival Worker
ARCHIVE_THRESHOLD_DAYS = "30"  ❌ Should be "20"

# Backfill Worker
MAX_DAYS_PER_INVOCATION = "10"  ✅ Reasonable
SITE_NAME = "ses_falls_city"    ✅ Matches production ETL
```

### ❌ Secrets - NOT DOCUMENTED
```toml
# Archival Worker wrangler.toml has NO secrets section
# Backfill Worker wrangler.toml has NO secrets section
# Query Worker doesn't need ACE_API_KEY (read-only)
```

**Issue:** Archival and Backfill workers need ACE_API_KEY but it's not documented in their wrangler.toml files.

**Resolution:** Add to both:
```toml
# ============================================================================
# Secrets (set via wrangler secret put)
# ============================================================================
# wrangler secret put ACE_API_KEY --config workers/wrangler-archival.toml
```

---

## 5. Integration Validation

### Data Flow Analysis

#### Current Production (ETL Worker):
```
ACE API → ETL Worker (every 5 min)
           ↓
        D1 timeseries table
        (ALL configured points, NULL filtered)
```

#### Proposed Wave 3 Architecture:
```
ACE API → ETL Worker (every 5 min)
           ↓
        D1 timeseries table (HOT: <20 days)
           ↓
        Archival Worker (daily 2 AM UTC)
           ↓
        R2 Parquet files (COLD: >20 days)
           ↓
        Query Worker (unifies D1 + R2)
           ↑
        Frontend chart queries

        Backfill Worker (manual trigger)
           ↓
        R2 Parquet files (historical data)
```

### Integration Concerns:

#### ❌ Concern #1: ETL ↔ Query Worker
**Issue:** Different point normalization approaches may cause query mismatches.

**Test Required:**
1. ETL writes sample data to D1
2. Query worker reads same data
3. Verify point names match exactly

#### ❌ Concern #2: Archival ↔ Query Worker
**Issue:** Archival path structure doesn't match query expectations.

**Test Required:**
1. Manually create valid Parquet file at: `timeseries/ses_falls_city/2024/10/01.parquet`
2. Query worker reads this file
3. Verify data is returned correctly

#### ❌ Concern #3: Backfill ↔ Query Worker
**Issue:** Backfill uses wrong path structure.

**Test Required:**
1. Backfill processes historical day
2. Verify R2 file created at correct path
3. Query worker reads backfilled data
4. Verify no duplicates between backfill and live ETL

#### ❌ Concern #4: Archival ↔ ETL Worker
**Issue:** Archival deletes from D1 while ETL may still write to same timestamps (24-hour lookback).

**Test Required:**
1. Simulate archival at 2 AM UTC
2. ETL runs at 2:05 AM UTC
3. Verify no data loss at boundary

---

## 6. Performance Validation

### Query Worker Performance

**Target:** <500ms D1, <5s R2 (per spec)

**Analysis:**
- D1 query: Single SELECT with JOIN and WHERE IN clause - should meet <500ms ✅
- R2 query: **NOT IMPLEMENTED** - cannot validate ❌
- Parallel D1+R2: Uses `Promise.all` - good ✅
- Caching: Implemented with TTL-based expiration - good ✅

**Concern:** Without actual Parquet reader, R2 performance is unknown. Parsing large Parquet files may exceed 5s limit.

**Recommendation:** Test with real 1-day Parquet file (~3.74M samples).

---

### Archival Worker Performance

**Target:** Complete within 30s CPU limit (per wrangler config)

**Analysis:**
```javascript
// Line 48: ARCHIVE_THRESHOLD_DAYS: 20
// Line 52: BATCH_SIZE: 100000
```

**Concern:** Processing ALL points with old data (potentially thousands) in one invocation may timeout.

**Example calculation:**
- 4,583 configured points
- Assume 10% have data >20 days (458 points)
- Each point queries D1, converts to Parquet, uploads to R2
- 458 points × (100ms query + 200ms Parquet + 300ms R2 upload) = 275 seconds

**Verdict:** ❌ WILL TIMEOUT

**Resolution Required:**
1. Process limited number of points per invocation
2. Use Durable Objects for state
3. Or chunk by date ranges instead of points

---

### Backfill Worker Performance

**Target:** Process 1 day in <7 minutes (per docs)

**Analysis:**
```javascript
// Line 48: MAX_DAYS_PER_INVOCATION: 10
// Line 55: REQUESTS_PER_MINUTE: 50
```

**Calculation:**
- 1 day = ~3.74M samples (4,583 points × 1440 samples/day)
- At 1000 samples/page = 3,740 API calls
- At 50 req/min = 75 minutes per day

**Verdict:** ❌ EXCEEDS 7-MINUTE TARGET

**However:** 75 minutes for full year is ~45 days, which may be acceptable for one-time backfill.

**Recommendation:** Reduce `MAX_DAYS_PER_INVOCATION` to 1 and use multiple parallel instances.

---

## 7. Pre-Deployment Checklist

### Must Complete Before ANY Deployment:

#### ☐ 1. R2 Parquet Reader Implementation
- [ ] Choose library (DuckDB WASM recommended)
- [ ] Implement `readAndFilterParquetFile()` in r2-client.js
- [ ] Add Snappy decompression
- [ ] Test with sample Parquet file
- [ ] Measure performance (must be <5s per file)

#### ☐ 2. Verify D1 Schema Compatibility
- [ ] Run schema dump on production database
- [ ] Confirm `points` table structure
- [ ] Verify `timeseries` table uses `point_id` FK
- [ ] Test point normalization with production data
- [ ] Validate query worker against production schema

#### ☐ 3. Fix Archival Worker Critical Issues
- [ ] Rewrite for daily partitions (not monthly)
- [ ] Fix R2 path structure
- [ ] Add missing imports (convertToParquet, uploadParquetFile, etc.)
- [ ] Fix variable references (CONFIG.ARCHIVE_THRESHOLD_DAYS)
- [ ] Set ARCHIVE_THRESHOLD_DAYS = "20"
- [ ] Add site_name to Parquet schema

#### ☐ 4. Fix Backfill Worker Path Structure
- [ ] Update R2 path to: `timeseries/{siteName}/YYYY/MM/DD.parquet`
- [ ] Consolidate all points into single daily file
- [ ] Add point_name column to Parquet schema
- [ ] Test file creation and verification

#### ☐ 5. Add Missing Dependencies
- [ ] Add parquetjs (or hyparquet) to package.json
- [ ] Test bundling for Cloudflare Workers
- [ ] Verify no Node.js-specific APIs used
- [ ] Update wrangler.toml build commands

---

## 8. Deployment Order & Strategy

### Recommended Deployment Sequence:

#### Phase 1: Foundation (Week 1)
**Deploy:** None - Fix blockers first

**Actions:**
1. Fix all 5 critical blockers
2. Implement R2 Parquet reader
3. Fix archival worker implementation
4. Add missing dependencies
5. Run local/dev environment tests

**Success Criteria:**
- All workers run without errors locally
- R2 Parquet files can be written and read back
- Query worker returns data from test Parquet files

---

#### Phase 2: Query Worker Only (Week 2)
**Deploy:** Query Worker to staging

**Prerequisites:**
- Blocker #1 (R2 Parquet reader) RESOLVED
- Blocker #3 (D1 schema) VERIFIED
- HIGH #3 (point name casing) VERIFIED

**Actions:**
1. Deploy query worker to staging
2. Manually create test Parquet files in R2
3. Test queries against D1 + R2
4. Verify deduplication at 20-day boundary
5. Load test with 100 concurrent queries

**Success Criteria:**
- D1-only queries: <500ms response time
- R2-only queries: <5s response time
- Split queries: <6s response time
- No errors under load

**Rollback Plan:**
1. Delete query worker deployment
2. Frontend continues using existing ETL endpoint
3. No data loss (read-only operation)

---

#### Phase 3: Backfill Worker (Week 3)
**Deploy:** Backfill Worker to production (manual trigger only)

**Prerequisites:**
- Phase 2 successful
- Query worker validated in production
- Blocker #5 (path structure) RESOLVED

**Actions:**
1. Deploy backfill worker
2. Test with single day: `POST /backfill/start { start_date: "2024-10-01", end_date: "2024-10-01" }`
3. Verify Parquet file created at correct path
4. Query worker reads backfilled data
5. Gradually expand to 1 week, then 1 month, then full year

**Success Criteria:**
- Parquet files created at correct paths
- Query worker reads backfilled data
- No performance degradation on query worker

**Rollback Plan:**
1. Delete backfill worker deployment
2. Delete test Parquet files from R2
3. No impact on live ETL or queries

---

#### Phase 4: Archival Worker (Week 4+)
**Deploy:** Archival Worker to production (cron enabled)

**Prerequisites:**
- Phase 2 and 3 successful
- Blocker #4 (archival logic) COMPLETELY REWRITTEN
- HIGH #4 (cron timing) RESOLVED
- 30+ days of production data in D1 to test archival

**Actions:**
1. Deploy archival worker with cron DISABLED
2. Manually trigger via `wrangler tail` and HTTP endpoint
3. Monitor first archival cycle (may take hours)
4. Verify D1 data deleted ONLY after R2 upload verified
5. Query worker still returns data correctly
6. Enable cron schedule

**Success Criteria:**
- Archival completes within timeout (30s CPU)
- R2 files created correctly
- D1 data pruned only after verification
- Query worker seamlessly transitions D1→R2
- No data loss during archival

**Rollback Plan:**
1. Disable cron trigger
2. Do NOT delete D1 data
3. Delete archival worker deployment
4. Restore any accidentally deleted D1 data from backup

---

## 9. Integration Test Plan

### Test Scenario 1: End-to-End Data Flow
**Objective:** Verify complete data lifecycle

**Steps:**
1. ETL worker writes new data (timestamp = NOW)
2. Query worker reads data from D1
3. Wait 21 days (or manually set cutoff)
4. Archival worker moves data to R2
5. Query worker reads same data from R2
6. Verify data identical

**Expected Results:**
- Data matches exactly between D1 and R2
- No duplicates
- No data loss

---

### Test Scenario 2: Historical Backfill
**Objective:** Verify backfill doesn't conflict with live ETL

**Steps:**
1. Backfill 1 month of historical data
2. ETL continues running every 5 minutes
3. Query data range spanning historical + live
4. Verify seamless transition at boundary

**Expected Results:**
- No gaps in data
- No duplicates at boundary
- Query returns combined results

---

### Test Scenario 3: 20-Day Boundary Stress Test
**Objective:** Verify deduplication at hot/cold boundary

**Steps:**
1. Create data exactly at 20-day boundary
2. Store same timestamps in both D1 and R2
3. Query worker reads both
4. Verify D1 data takes priority (per mergeSamples logic)

**Expected Results:**
- No duplicate samples in result
- D1 data used when duplicate timestamps exist

---

### Test Scenario 4: Archival Race Condition
**Objective:** Ensure archival doesn't delete data ETL still writes

**Steps:**
1. Create data at 19 days, 23 hours, 59 minutes old
2. Run archival worker
3. ETL runs with 24-hour lookback
4. Verify data not prematurely deleted

**Expected Results:**
- Data remains in D1 until >20 days old
- No data loss from race condition

---

### Test Scenario 5: Concurrent Query Load
**Objective:** Verify query worker performance under load

**Steps:**
1. 100 concurrent users query different date ranges
2. Mix of D1-only, R2-only, and split queries
3. Measure response times and error rates

**Expected Results:**
- P50 latency: <1s
- P95 latency: <5s
- P99 latency: <10s
- Error rate: <0.1%

---

## 10. Monitoring Plan

### Key Metrics to Track (Per Worker):

#### Query Worker
- **Response Time:** P50, P95, P99 latency
- **Cache Hit Rate:** % queries served from KV cache
- **Storage Tier Distribution:** % D1-only, R2-only, split
- **Error Rate:** % queries that fail
- **Throughput:** Queries per minute
- **Data Volume:** Samples returned per query

**Alerts:**
- P95 latency >5s for 5 minutes
- Error rate >1% for 5 minutes
- Cache hit rate <50% (indicates cache issues)

---

#### Archival Worker
- **Execution Time:** Minutes to complete daily run
- **Records Archived:** Count per day
- **Files Created:** R2 uploads per day
- **Deletion Success:** % records successfully deleted from D1
- **Errors:** Failed archival attempts

**Alerts:**
- Archival execution time >25 minutes (timeout risk)
- Any archival failures
- D1 database size growing (indicates archival not running)

---

#### Backfill Worker
- **Progress:** Days completed / total days
- **Records Processed:** Count per day
- **API Call Rate:** Calls per minute to ACE API
- **Errors:** Failed days or API errors
- **Estimated Completion:** Time remaining

**Alerts:**
- Backfill stalled (no progress for 1 hour)
- ACE API rate limit errors
- Any failed days

---

#### ETL Worker (Existing - Monitor for Impact)
- **Baseline Metrics:** Establish before Wave 3 deployment
- **Database Growth Rate:** Should slow after archival enabled
- **Performance:** Ensure no degradation from schema changes

**Alerts:**
- Sudden change in ETL insert rate (indicates schema issue)
- ETL failures after Wave 3 deployment

---

## 11. Rollback Procedures

### Query Worker Rollback
**Trigger:** High error rate, poor performance, incorrect results

**Steps:**
1. Delete query worker deployment:
   ```bash
   wrangler delete --name building-vitals-query
   ```
2. Frontend reverts to direct ACE API queries (or existing endpoint)
3. No data loss (read-only worker)

**Recovery Time:** <5 minutes

---

### Archival Worker Rollback
**Trigger:** Data loss detected, archival failures, timeout issues

**Steps:**
1. IMMEDIATELY disable cron:
   ```bash
   wrangler deployments view building-vitals-archival
   # Remove cron trigger from wrangler.toml
   wrangler deploy --config workers/wrangler-archival.toml
   ```
2. Verify D1 database still has data >20 days
3. If data deleted: Restore from D1 backup
4. Delete archival worker deployment
5. Investigate root cause

**Recovery Time:** 15-30 minutes (longer if data restoration needed)

---

### Backfill Worker Rollback
**Trigger:** Incorrect R2 paths, corrupt Parquet files, ACE API abuse

**Steps:**
1. Cancel running backfill:
   ```bash
   curl -X POST https://building-vitals-backfill.workers.dev/backfill/cancel
   ```
2. Delete invalid R2 files:
   ```bash
   wrangler r2 object delete ace-timeseries/timeseries/YYYY/MM/DD/... (list of bad files)
   ```
3. Delete backfill worker deployment
4. Fix issues and redeploy

**Recovery Time:** 30-60 minutes

---

## 12. Risk Assessment

### CRITICAL Risks (Block Deployment)

#### 🔴 RISK #1: R2 Parquet Reader Not Implemented
**Probability:** 100% (confirmed in code)
**Impact:** CRITICAL - Core functionality missing
**Mitigation:** MUST implement before any deployment
**Status:** ❌ UNRESOLVED

#### 🔴 RISK #2: D1 Schema Incompatibility
**Probability:** 70% (schema not verified)
**Impact:** CRITICAL - Query worker returns zero results
**Mitigation:** Verify production schema, align code
**Status:** ⚠️ NEEDS VERIFICATION

#### 🔴 RISK #3: Archival Worker Data Loss
**Probability:** 90% (logic errors confirmed)
**Impact:** CRITICAL - Permanent data loss
**Mitigation:** Complete rewrite of archival logic
**Status:** ❌ UNRESOLVED

#### 🔴 RISK #4: Missing NPM Dependencies
**Probability:** 100% (package.json missing parquetjs)
**Impact:** CRITICAL - Workers fail at runtime
**Mitigation:** Add dependencies, test bundling
**Status:** ❌ UNRESOLVED

#### 🔴 RISK #5: Path Structure Mismatch
**Probability:** 100% (3 different path structures found)
**Impact:** CRITICAL - Data not findable across workers
**Mitigation:** Standardize on spec-defined paths
**Status:** ❌ UNRESOLVED

---

### HIGH Risks (Need Mitigation)

#### 🟠 RISK #6: Archival Worker Timeout
**Probability:** 80%
**Impact:** HIGH - Archival doesn't complete, D1 grows unbounded
**Mitigation:** Chunk processing, Durable Objects
**Status:** ⚠️ NEEDS DESIGN CHANGE

#### 🟠 RISK #7: ACE API Rate Limiting on Backfill
**Probability:** 60%
**Impact:** HIGH - Backfill takes weeks instead of days
**Mitigation:** Conservative rate limits, monitoring
**Status:** ⚠️ MONITOR CLOSELY

#### 🟠 RISK #8: Point Name Casing Mismatch
**Probability:** 40%
**Impact:** HIGH - Queries return zero results
**Mitigation:** Verify casing, add COLLATE NOCASE
**Status:** ⚠️ NEEDS VERIFICATION

---

### MEDIUM Risks (Accept & Monitor)

#### 🟡 RISK #9: Query Worker Cache Collisions
**Probability:** 20%
**Impact:** MEDIUM - Wrong cached data returned
**Mitigation:** Use crypto.subtle.digest
**Status:** ✅ ACCEPTABLE (low probability)

#### 🟡 RISK #10: Backfill Stalls
**Probability:** 30%
**Impact:** MEDIUM - Historical data incomplete
**Mitigation:** Resumable state, monitoring
**Status:** ✅ ACCEPTABLE (can manually resume)

---

### LOW Risks (Accept)

#### 🟢 RISK #11: CORS Too Permissive
**Probability:** 10%
**Impact:** LOW - Potential API abuse
**Mitigation:** Add origin restrictions
**Status:** ✅ ACCEPTABLE (can fix post-launch)

---

## 13. Go/No-Go Decision

### Query Worker: ❌ NO-GO
**Blockers:**
- BLOCKER #1: R2 Parquet reader not implemented
- BLOCKER #2: Missing parquetjs dependency
- BLOCKER #3: D1 schema compatibility not verified
- HIGH #3: Point name casing not verified

**Estimated Time to Go:** 24-32 hours

---

### Archival Worker: ❌ NO-GO
**Blockers:**
- BLOCKER #2: Missing parquetjs dependency
- BLOCKER #3: D1 schema compatibility not verified
- BLOCKER #4: Critical logic errors (wrong partition structure, missing imports, wrong paths)
- HIGH #4: Wrong archive threshold (30 days instead of 20)
- HIGH #8: Incomplete implementation

**Estimated Time to Go:** 20-28 hours (requires significant rewrite)

---

### Backfill Worker: ❌ NO-GO
**Blockers:**
- BLOCKER #2: Missing parquetjs dependency
- BLOCKER #5: Wrong R2 path structure

**Estimated Time to Go:** 8-12 hours

---

### Overall System: ❌ NOT READY FOR PRODUCTION

**Critical Path:**
1. Week 1: Fix all blockers (est. 60-80 hours total)
2. Week 2: Deploy query worker to staging, validate
3. Week 3: Deploy backfill worker, test with limited date range
4. Week 4+: Deploy archival worker with extreme caution

**Earliest Production-Ready Date:** 4+ weeks from now

---

## 14. Recommendations

### Immediate Actions (This Week):

1. **STOP** any plans to deploy current code
2. **PRIORITIZE** R2 Parquet reader implementation (24-hour sprint)
3. **VERIFY** D1 production schema immediately
4. **REWRITE** archival worker with correct daily partition logic
5. **ADD** missing npm dependencies and test bundling
6. **STANDARDIZE** R2 path structure across all workers

---

### Short-Term Actions (Weeks 2-3):

1. **DEPLOY** query worker to staging only
2. **TEST** extensively with real production data patterns
3. **VALIDATE** performance under load
4. **FIX** any remaining integration issues
5. **DOCUMENT** deployment procedures

---

### Long-Term Actions (Month 2+):

1. **ADD** comprehensive monitoring and alerting
2. **IMPLEMENT** circuit breakers and error handling
3. **OPTIMIZE** archival worker for large-scale processing
4. **CREATE** operational runbooks
5. **TRAIN** team on worker management

---

## 15. Conclusion

**The Wave 3 workers are NOT production-ready in their current state.** While the architecture is sound and the code quality shows attention to detail, **5 critical blockers** prevent safe deployment:

1. R2 Parquet reader is completely stubbed
2. Missing npm dependencies will cause runtime failures
3. D1 schema compatibility is unverified
4. Archival worker has fundamental logic errors
5. Inconsistent R2 path structures across workers

**However, the system is salvageable** with focused effort:
- ✅ Configuration bindings are correct
- ✅ Data flow architecture is well-designed
- ✅ Error handling patterns are solid
- ✅ Integration points are clearly defined

**Estimated timeline to production:**
- Fix blockers: 2-3 weeks
- Staging validation: 1-2 weeks
- Gradual production rollout: 2-3 weeks
- **Total: 5-8 weeks**

**Next Steps:**
1. Present this report to stakeholders
2. Prioritize blocker resolution
3. Create detailed implementation tasks
4. Assign development resources
5. Establish review checkpoints before each deployment phase

---

## Appendix A: File Reference

- ETL Worker Config: `workers/wrangler-etl.toml`
- Query Worker Config: `workers/wrangler-query.toml`
- Archival Worker Config: `wrangler-archival.toml`
- Backfill Worker Config: `workers/wrangler-backfill.toml`
- ETL Worker Code: `src/etl-sync-worker.js`
- Query Worker Code: `src/query-worker.js`
- Archival Worker Code: `src/archival-worker.js`
- Backfill Worker Code: `src/backfill-worker.js`
- R2 Client: `src/lib/r2-client.js`
- D1 Client: `src/lib/d1-client.js`
- Parquet Writer: `src/lib/parquet-writer.js`

---

**Report Generated:** 2025-10-14
**Validator:** Production Validation Agent
**Confidence Level:** HIGH (based on code review, no live testing performed)
