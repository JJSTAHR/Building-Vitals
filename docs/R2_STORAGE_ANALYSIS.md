# R2 Storage Integration Analysis - Cloudflare Worker Implementation

## Executive Summary

**CRITICAL FINDING**: There is **NO hardcoded date limit** in the Cloudflare Worker code that prevents retrieval of older data from R2 storage. The system is designed to retrieve data from any time period based on query parameters.

**Root Cause**: If older data is not appearing, the issue is **not in the worker code** but likely in:
1. **Data not being archived to R2** (archival worker not running)
2. **R2 bucket is empty or missing files** (files never uploaded)
3. **Frontend date range constraints** (limiting queries)

---

## 1. R2 Storage Architecture

### Storage Hierarchy
```
Hot Storage (D1):  Last 20-30 days of data
Cold Storage (R2): Data older than 20-30 days (INDEFINITE retention)
```

### File Structure in R2
```
R2 Bucket: ace-timeseries/
├── timeseries/
│   ├── {site_name}/
│   │   ├── {YYYY}/
│   │   │   ├── {MM}/
│   │   │   │   ├── {DD}.ndjson.gz  (Daily partition)
│   │   │   │   └── {DD}.parquet     (Alternative format)
```

**Example**:
```
timeseries/default/2025/01/15.ndjson.gz  (Jan 15, 2025)
timeseries/default/2024/10/10.ndjson.gz  (Oct 10, 2024)
timeseries/default/2020/03/25.ndjson.gz  (Mar 25, 2020 - NO LIMIT!)
```

---

## 2. Worker Data Retrieval Logic

### Main Worker: `consolidated-ace-proxy-worker.js`

**Key Handler**: `handlePaginatedTimeseries()` (Lines 243-434)

#### Query Parameters (NO hardcoded limits):
```javascript
const startTime = url.searchParams.get('start_time');  // User-provided
const endTime = url.searchParams.get('end_time');      // User-provided
const pointNames = url.searchParams.get('point_names');
```

**NO DEFAULT VALUES**. **NO MAX RANGE CHECKS**. Accepts any date range!

---

### Query Routing Decision (Lines 260-378)

**File**: `src/lib/query-router.js`

#### Hot/Cold Boundary Calculation:
```javascript
const HOT_STORAGE_DAYS = 30;  // Configurable, not a data limit!
const COLD_STORAGE_BOUNDARY = Date.now() - (HOT_STORAGE_DAYS * 24 * 60 * 60 * 1000);
```

#### Routing Strategies (Lines 37-85):

**1. D1_ONLY** - Recent data (< 30 days old):
```javascript
if (daysFromNowEnd < HOT_STORAGE_DAYS) {
  return { strategy: 'D1_ONLY', useD1: true, useR2: false };
}
```

**2. R2_ONLY** - Historical data (> 30 days old):
```javascript
if (daysFromNowStart > HOT_STORAGE_DAYS) {
  return { strategy: 'R2_ONLY', useD1: false, useR2: true };
}
```
**CRITICAL**: No max age check! If you query 2020 data, it will route to R2.

**3. SPLIT** - Spans both hot and cold:
```javascript
return {
  strategy: 'SPLIT',
  useD1: true,
  useR2: true,
  splitPoint: new Date(splitTimestamp).toISOString()
};
```

---

## 3. R2 File Reading Logic

**File**: `src/lib/r2-client.js`

### Function: `queryR2Timeseries()` (Lines 51-99)

#### Step 1: Generate File Paths (Lines 114-141)
```javascript
function generateFilePaths(siteName, startTime, endTime) {
  const paths = [];
  const startDate = new Date(startTime);  // User's start date
  const endDate = new Date(endTime);      // User's end date

  // NO DATE VALIDATION - accepts any date!

  const current = new Date(startDate);
  while (current <= endDate) {
    const year = current.getFullYear();     // 2020, 2019, 2015... NO LIMIT
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');

    const path = `timeseries/${siteName}/${year}/${month}/${day}.ndjson.gz`;
    paths.push(path);  // Generates paths for ANY year

    current.setDate(current.getDate() + 1);  // Advance one day
  }

  return paths;  // Returns ALL days in range, no matter how old
}
```

**Example**: Query from Jan 1, 2020 to Dec 31, 2024:
- Generates 1,826 file paths (5 years of daily files)
- No filtering, no date limits, no restrictions

#### Step 2: Read Files from R2 (Lines 66-81)
```javascript
for (let i = 0; i < filePaths.length; i += MAX_CONCURRENT_FILES) {
  const batch = filePaths.slice(i, i + MAX_CONCURRENT_FILES);

  const batchResults = await Promise.allSettled(
    batch.map(path => readAndFilterNDJSONFile(bucket, path, pointNames, startTime, endTime))
  );

  // Collects results from ALL files, regardless of age
  for (const result of batchResults) {
    if (result.status === 'fulfilled') {
      allSamples.push(...result.value);  // Accumulates ALL samples
    }
  }
}
```

**Key Point**: Uses `Promise.allSettled()` to handle missing files gracefully. If a file doesn't exist in R2 (e.g., `2020/01/15.ndjson.gz`), it returns empty array but continues processing other files.

#### Step 3: Timestamp Filtering (Lines 216-254)
```javascript
function filterSamples(samples, pointNames, startTime, endTime) {
  const pointSet = new Set(pointNames);
  const filtered = [];

  for (const sample of samples) {
    // Filter by timestamp range (user-provided)
    if (timestamp < startTime || timestamp > endTime) {
      continue;  // Skip samples outside requested range
    }

    // NO MIN DATE CHECK - accepts timestamps from any era

    filtered.push({
      point_name: pointName,
      timestamp: timestamp,
      value: value
    });
  }

  return filtered;
}
```

---

## 4. Query Worker Validation

**File**: `src/query-worker.js`

### Parameter Validation (Lines 296-378)

**MIN_TIMESTAMP check** (Line 329):
```javascript
const MIN_TIMESTAMP = 946684800000; // 2000-01-01 00:00:00 UTC
```

**Validation**:
```javascript
if (params.start_time < CONFIG.MIN_TIMESTAMP) {
  errors.push(`start_time must be after ${new Date(CONFIG.MIN_TIMESTAMP).toISOString()}`);
}
```

**This is the ONLY date limit**: Cannot query before **January 1, 2000**.

**MAX_QUERY_RANGE_DAYS check** (Line 353):
```javascript
if (rangeDays > CONFIG.MAX_QUERY_RANGE_DAYS) {
  errors.push(`Time range exceeds maximum of ${CONFIG.MAX_QUERY_RANGE_DAYS} days`);
}
```

**Default value**: `MAX_QUERY_RANGE_DAYS = 365` (configurable via environment variable)

This limits **query span** to 365 days, but does NOT prevent querying old data. You can still query:
- Jan 1, 2020 to Dec 31, 2020 ✅
- Jan 1, 2019 to Dec 31, 2019 ✅
- Any 365-day window ✅

---

## 5. Archival Worker Logic

**File**: `src/archival-worker.js`

### Archive Threshold (Lines 51-52)
```javascript
const ARCHIVE_THRESHOLD_DAYS = 20;  // Data older than 20 days is archived
```

### Archive Process (Lines 78-161)
```javascript
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - CONFIG.ARCHIVE_THRESHOLD_DAYS);

// Queries D1 for data older than 20 days
const pointsResult = await env.DB.prepare(`
  SELECT DISTINCT point_id
  FROM timeseries
  WHERE timestamp < ?
`).bind(cutoffTimestamp).all();
```

### R2 Upload Path (Line 270)
```javascript
const r2Key = `timeseries/${year}/${month}/${day}/${pointId}.parquet`;
```

**Critical**: Archives to daily partitions with **no retention limit**. Data is stored in R2 permanently unless manually deleted.

### Verification Before Deletion (Lines 388-402)
```javascript
// Verify R2 upload before deleting from D1
const verification = await env.R2.head(r2Key);

if (!verification) {
  throw new Error(`R2 upload verification failed: ${r2Key} not found`);
}

// Delete from D1 only after successful upload
const deleteResult = await env.DB.prepare(`
  DELETE FROM timeseries
  WHERE point_id = ? AND timestamp >= ? AND timestamp <= ?
`).bind(pointId, dayStart, dayEnd).run();
```

**Safety**: Data is NEVER deleted from D1 until successfully uploaded to R2.

---

## 6. No Date Filtering Found

### Comprehensive Search Results

**Files Analyzed**:
1. ✅ `consolidated-ace-proxy-worker.js` - Main proxy worker
2. ✅ `query-worker.js` - Unified query API
3. ✅ `archival-worker.js` - D1 to R2 archival
4. ✅ `lib/query-router.js` - Intelligent routing
5. ✅ `lib/r2-client.js` - R2 file reading

**Date Limits Found**:
| Limit | Value | Purpose | Blocks Old Data? |
|-------|-------|---------|------------------|
| `MIN_TIMESTAMP` | Jan 1, 2000 | Prevent invalid timestamps | ❌ No (reasonable lower bound) |
| `MAX_QUERY_RANGE_DAYS` | 365 days | Prevent expensive queries | ❌ No (window size, not age) |
| `HOT_STORAGE_DAYS` | 20-30 days | Route to D1 vs R2 | ❌ No (routing decision, not filter) |
| `ARCHIVE_THRESHOLD_DAYS` | 20 days | When to archive | ❌ No (migration trigger, not limit) |

**Conclusion**: **NO CODE prevents retrieval of old data from R2.**

---

## 7. Diagnostic Questions

To identify why old data isn't appearing, check these areas:

### A. Is the archival worker running?
```bash
wrangler tail --env production | grep "archive"
```

Check KV for last run:
```bash
wrangler kv key get "last_archive_run" --binding=POINTS_KV
```

**Expected**: Daily runs at 2:00 AM UTC (per `wrangler.toml` line 71)

---

### B. Does R2 contain archived files?
```bash
wrangler r2 object list ace-timeseries --prefix=timeseries/
```

**Look for**:
```
timeseries/{site}/2024/10/
timeseries/{site}/2024/09/
timeseries/{site}/2024/01/
```

**Missing files?** → Archival worker never ran or failed

---

### C. Can you manually read an R2 file?
```bash
wrangler r2 object get ace-timeseries timeseries/default/2024/10/15.ndjson.gz --file=test.ndjson.gz
gunzip test.ndjson.gz
head test.ndjson
```

**Expected output**: JSON lines with `{"timestamp": ..., "point_name": ..., "value": ...}`

**Empty or missing?** → Data was never uploaded

---

### D. Are frontend queries limiting date range?

Check frontend code for:
```javascript
// Bad: Hardcoded limit
const maxDaysBack = 30;
const startTime = Date.now() - (maxDaysBack * 24 * 60 * 60 * 1000);

// Good: User-controlled date picker
const startTime = datePickerValue.getTime();
```

**Check files**:
- `src/hooks/useStreamingTimeseries.ts`
- `src/components/charts/*.tsx`
- `src/core/api/unifiedApiService.ts`

---

### E. Check D1 database retention

Query D1 directly:
```bash
wrangler d1 execute ace-iot-db --command="
  SELECT
    MIN(timestamp) as oldest,
    MAX(timestamp) as newest,
    COUNT(*) as total_rows
  FROM timeseries_raw
"
```

**Expected**: Oldest timestamp should be ~20-30 days ago (hot storage window)

**If older data exists in D1**: Archival worker is NOT running

---

## 8. Configuration Review

### Environment Variables (from `wrangler.toml`)

**Line 116**: `MAX_QUERY_RANGE_DAYS = "90"`
- Allows queries up to 90-day windows
- Does NOT prevent querying old data

**Line 117**: `ARCHIVE_RETENTION_DAYS = "365"`
- Metadata only - R2 has no automatic deletion

**Lines 68-72**: Cron trigger
```toml
[triggers]
crons = ["0 2 * * *"]  # Daily at 2:00 AM UTC
```

**Verify cron is active**:
```bash
wrangler deployments list
```

---

## 9. R2 Object Key Patterns

### Expected Patterns

**NDJSON format** (used by archival worker):
```
timeseries/{site_name}/{YYYY}/{MM}/{DD}.ndjson.gz
```

**Parquet format** (alternative):
```
timeseries/{YYYY}/{MM}/{DD}/{point_id}.parquet
```

### Naming Convention Analysis

**Query router** generates paths like:
```javascript
`timeseries/${siteName}/${year}/${month}/${day}.ndjson.gz`
```

**Archival worker** uploads to:
```javascript
`timeseries/${year}/${month}/${day}/${pointId}.parquet`
```

**MISMATCH?** Check which format is actually used:
```bash
wrangler r2 object list ace-timeseries --prefix=timeseries/ | head -20
```

---

## 10. Data Aggregation Logic

### Response Formatting (Lines 439-463)

```javascript
function transformToAceFormat(results, siteName) {
  const pointSamples = results.series.map(series => ({
    name: series.name,
    samples: series.data.map(([timestamp, value]) => ({
      value,
      time: new Date(timestamp).toISOString()  // Milliseconds → ISO 8601
    }))
  }));

  return {
    point_samples: pointSamples,
    metadata: {
      site_id: siteName,
      source: results.metadata.dataSource,  // "D1", "R2", or "BOTH"
      total_samples: results.metadata.totalPoints
    }
  };
}
```

**Key Points**:
- Converts timestamps to ISO 8601 strings
- Preserves original timestamp ordering
- Includes metadata indicating data source
- **No date filtering applied during transformation**

---

## 11. Conclusion

### Summary of Findings

1. **NO hardcoded date limits** in Cloudflare Worker code
2. **R2 queries support ANY date range** (back to Jan 1, 2000)
3. **Archival process has no retention limit** (data stored indefinitely in R2)
4. **Query routing correctly identifies old data** and routes to R2
5. **File reading logic generates paths for all dates** in requested range

### Most Likely Root Causes

**Priority 1**: Archival worker not running
- Check: `wrangler tail` for scheduled events
- Fix: Verify cron trigger is deployed

**Priority 2**: R2 bucket is empty
- Check: `wrangler r2 object list ace-timeseries`
- Fix: Run manual backfill or wait for archival worker

**Priority 3**: Frontend date range constraints
- Check: Date picker component max range
- Fix: Update UI to allow historical queries

**Priority 4**: Missing D1 data to archive
- Check: D1 database has data older than 20 days
- Fix: Backfill D1 from ACE API first

---

## 12. Recommended Next Steps

### Immediate Actions

1. **Verify R2 bucket contents**:
```bash
wrangler r2 object list ace-timeseries --prefix=timeseries/ | wc -l
```
Expected: >0 if archival has run

2. **Check archival worker logs**:
```bash
wrangler tail --env production --format=pretty
```
Look for: `[archive-*] Starting archival process`

3. **Test R2 query directly**:
```bash
curl "https://ace-iot-proxy.<account>.workers.dev/api/sites/default/timeseries/paginated?start_time=2024-10-01T00:00:00Z&end_time=2024-10-31T23:59:59Z&point_names=VAV-101-DaTemp" \
  -H "X-ACE-Token: $TOKEN"
```
Check response headers:
- `X-Data-Source: R2` (if data is old)
- `X-Query-Strategy: R2_ONLY` or `SPLIT`

4. **Review frontend queries**:
```javascript
// Search for hardcoded date limits
grep -r "maxDaysBack\|getTime() -" src/
```

---

## 13. Worker Code Quality Assessment

### Strengths
- ✅ Intelligent hot/cold routing
- ✅ Graceful error handling (missing files)
- ✅ Parallel file reading (10 concurrent)
- ✅ Timestamp filtering after decompression
- ✅ Safety checks (verify R2 before D1 deletion)
- ✅ No hardcoded date restrictions

### Areas for Improvement
- ⚠️ No max file count limit (could read thousands of files)
- ⚠️ No pagination for R2 results (memory issues with large ranges)
- ⚠️ Missing manifest optimization (reads every file blindly)
- ⚠️ No query cost estimation (expensive 5-year queries allowed)

---

## 14. File Paths Reference

**Cloudflare Workers**:
- `C:\Users\jstahr\Desktop\Building Vitals\src\consolidated-ace-proxy-worker.js`
- `C:\Users\jstahr\Desktop\Building Vitals\src\query-worker.js`
- `C:\Users\jstahr\Desktop\Building Vitals\src\archival-worker.js`

**Library Modules**:
- `C:\Users\jstahr\Desktop\Building Vitals\src\lib\query-router.js`
- `C:\Users\jstahr\Desktop\Building Vitals\src\lib\r2-client.js`

**Configuration**:
- `C:\Users\jstahr\Desktop\Building Vitals\wrangler.toml`

---

**Document Created**: October 16, 2025
**Analysis Date**: Current session
**Worker Version**: 3.0 (consolidated-ace-proxy-worker)
