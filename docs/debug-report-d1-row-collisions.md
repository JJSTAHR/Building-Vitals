# Debug Report: D1 Showing Only 37 Samples Despite Multiple "9 Inserted" Log Entries

**Date:** 2025-10-15
**Issue:** Cloudflare Logs show "9 inserted, 0 failed" repeatedly, but D1 query shows only 37 total rows with 5 unique timestamps
**Expected:** Multiple syncs × 9 points each = many more rows than 37
**Actual:** Only 37 rows in D1, indicating INSERT OR REPLACE is replacing existing rows

---

## Root Cause Analysis

### The Smoking Gun: Time Range Calculation

The issue is in `src/etl-sync-worker.js` line 777:

```javascript
// End at 48 hours ago to ensure data has been processed by ACE API
const end = Math.floor((now - processingLagMs) / 1000);
```

**The Problem:**
- **Every sync ends at the SAME timestamp** (48 hours ago from "now")
- First sync: `start = 48h ago → end = 48h ago` (fetches 0 data!)
- Second sync: `start = last_sync_time → end = 48h ago` (same end time!)
- Third sync: `start = last_sync_time → end = 48h ago` (same end time again!)

### Why Only 5 Unique Timestamps?

The PRIMARY KEY is `(site_name, point_name, timestamp)`:

```sql
PRIMARY KEY (site_name, point_name, timestamp)
```

**INSERT OR REPLACE** means:
1. Worker fetches data ending at 48h ago
2. Returns same timestamps every sync (because end time is fixed at 48h ago)
3. D1 replaces existing rows with matching PRIMARY KEY
4. Result: **Only 5 unique timestamps × 9 points = ~45 rows max**

### Evidence from Code

**Lines 754-782 in `src/etl-sync-worker.js`:**
```javascript
function calculateTimeRange(syncState) {
  const now = Date.now();

  // Raw data has 48-hour processing lag - always query data ending 48h ago
  const processingLagMs = 48 * 60 * 60 * 1000;

  // Determine if this is first sync
  const isFirstSync = !syncState.lastSyncTimestamp ||
                      syncState.lastSyncTimestamp < (now - 7 * 86400000);

  let start;
  if (isFirstSync) {
    // First sync: Start from 48 hours ago
    start = Math.floor((now - processingLagMs) / 1000);
    console.log(`[ETL] FIRST SYNC: Starting from 48 hours ago`);
  } else {
    // Incremental: Start from last sync timestamp
    start = Math.floor(syncState.lastSyncTimestamp / 1000);
    console.log(`[ETL] INCREMENTAL SYNC: Starting from last sync timestamp`);
  }

  // 🚨 BUG: End is ALWAYS 48h ago, never moves forward!
  const end = Math.floor((now - processingLagMs) / 1000);

  console.log(`[ETL] Time range: ${new Date(start * 1000).toISOString()} → ${new Date(end * 1000).toISOString()}`);

  return { start, end };
}
```

---

## The Fix

**Line 777 should update the end time incrementally:**

```javascript
// OLD (BROKEN):
const end = Math.floor((now - processingLagMs) / 1000);

// NEW (FIXED):
let end;
if (isFirstSync) {
  // First sync: End 48 hours ago
  end = Math.floor((now - processingLagMs) / 1000);
} else {
  // Incremental: End at "now" to get NEW data since last sync
  end = Math.floor(now / 1000);
}
```

---

## Verification Steps

### 1. Check Live Worker Logs

Look for these patterns in Cloudflare logs:

```
✅ CORRECT (NEW CODE):
[ETL] FIRST SYNC: Starting from 48 hours ago
[ETL] INCREMENTAL SYNC: Starting from last sync timestamp
[ACE API] Fetching site timeseries (RAW mode - actual sensor readings)

❌ INCORRECT (OLD CODE):
[ETL] Time range: 2025-10-13T14:00:00.000Z → 2025-10-13T14:00:00.000Z
(start == end means 0 data returned!)
```

### 2. Query D1 for Timestamp Distribution

```bash
wrangler d1 execute building-vitals-db --remote --command \
  "SELECT COUNT(*) as total_rows, COUNT(DISTINCT timestamp) as unique_timestamps,
   MIN(timestamp) as earliest, MAX(timestamp) as latest FROM sensor_data"
```

**Expected (if bug is fixed):**
- `unique_timestamps` should increase with each sync
- `latest` timestamp should move forward (not stuck at 48h ago)

**Actual (bug present):**
- `unique_timestamps` = 5 (fixed, not growing)
- `latest` = same timestamp repeated (stuck at 48h ago)

### 3. Check Deployed Code

```bash
# Find which worker is deployed
wrangler deployments list

# Verify the fix is deployed
wrangler tail --format pretty | grep "Time range"
```

---

## Impact Assessment

### Why Only 37 Rows?

- **10 unique points** (from query)
- **5 unique timestamps** (from query)
- Theoretical max: `10 points × 5 timestamps = 50 rows`
- Actual: `37 rows` means some point/timestamp combinations have no data

### Why "9 Inserted" But No Growth?

Each sync:
1. Fetches 9 points (valid, non-NULL data)
2. **INSERT OR REPLACE** writes 9 rows
3. **Replaces** existing rows with same PRIMARY KEY `(site_name, point_name, timestamp)`
4. Net result: **0 new rows** (replacements only)

---

## Testing the Fix

### Before Fix:
```sql
-- D1 Query
SELECT COUNT(*) FROM sensor_data;
-- Result: 37 (static, never grows)

SELECT COUNT(DISTINCT timestamp) FROM sensor_data;
-- Result: 5 (stuck)
```

### After Fix:
```sql
-- D1 Query after multiple syncs
SELECT COUNT(*) FROM sensor_data;
-- Result: 37 → 46 → 55 → ... (grows with each sync)

SELECT COUNT(DISTINCT timestamp) FROM sensor_data;
-- Result: 5 → 10 → 15 → ... (increases)
```

---

## Deployment Checklist

- [ ] Update `src/etl-sync-worker.js` line 777 with incremental end time logic
- [ ] Deploy updated worker: `wrangler deploy --config workers/wrangler-etl.toml`
- [ ] Clear KV state to force fresh sync: `wrangler kv key delete --binding=ETL_STATE "etl:last_sync_timestamp"`
- [ ] Monitor logs for "INCREMENTAL SYNC" pattern
- [ ] Verify D1 row count grows with each sync
- [ ] Confirm unique timestamp count increases

---

## Key Learnings

1. **INSERT OR REPLACE requires truly unique timestamps**
   - If end time is fixed, timestamps repeat
   - PRIMARY KEY collisions replace rows instead of adding

2. **Incremental sync must advance the time window**
   - Start: last sync timestamp ✅ (working)
   - End: **NOW**, not fixed at 48h ago ❌ (broken)

3. **Logs can be misleading**
   - "9 inserted" technically true (9 INSERT OR REPLACE statements)
   - But replacements don't grow the table

4. **Primary key design matters**
   - `(site_name, point_name, timestamp)` is correct
   - But only if timestamps are truly unique per sync

---

## Files to Review

1. **C:\Users\jstahr\Desktop\Building Vitals\src\etl-sync-worker.js**
   - Line 754-782: `calculateTimeRange()` function
   - Line 777: **BUG - fixed end time**

2. **C:\Users\jstahr\Desktop\Building Vitals\workers\wrangler-etl.toml**
   - Worker configuration
   - Deployment name: Check which worker is actually running

3. **C:\Users\jstahr\Desktop\Building Vitals\src\lib\d1-client.js**
   - `batchInsertTimeseries()` function
   - Uses INSERT OR REPLACE (correct, not the issue)

---

## Recommended Solution

**Update `calculateTimeRange()` in `src/etl-sync-worker.js`:**

```javascript
function calculateTimeRange(syncState) {
  const now = Date.now();
  const processingLagMs = 48 * 60 * 60 * 1000;

  const isFirstSync = !syncState.lastSyncTimestamp ||
                      syncState.lastSyncTimestamp < (now - 7 * 86400000);

  let start, end;

  if (isFirstSync) {
    // First sync: Query 48h window to backfill initial data
    start = Math.floor((now - processingLagMs) / 1000);
    end = Math.floor((now - processingLagMs + 60000) / 1000); // +1 minute window
    console.log(`[ETL] FIRST SYNC: 1-minute window from 48h ago`);
  } else {
    // Incremental: Start from last sync, end at NOW
    start = Math.floor(syncState.lastSyncTimestamp / 1000);
    end = Math.floor(now / 1000); // KEY FIX: Move end forward!
    console.log(`[ETL] INCREMENTAL SYNC: From last sync to now`);
  }

  console.log(`[ETL] Time range: ${new Date(start * 1000).toISOString()} → ${new Date(end * 1000).toISOString()} (${isFirstSync ? 'FIRST' : 'INCREMENTAL'})`);

  return { start, end };
}
```

---

**End of Debug Report**
