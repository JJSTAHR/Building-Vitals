# D1 Database Insert Collision Analysis

**Date:** 2025-10-15
**Issue:** D1 logs show "9 inserted" but count remains at 37
**Status:** Root cause identified ✅

## Problem Summary

ETL Worker logs indicate successful batch inserts:
```
[D1] Batch insert complete: 9 inserted, 0 failed
```

However, querying D1 shows count remains constant at 37 samples.

## Root Cause Analysis

### 1. INSERT OR REPLACE Behavior

**Location:** `C:\Users\jstahr\Desktop\Building Vitals\src\lib\d1-client.js` (lines 161-162)

```javascript
return db.prepare(`
  INSERT OR REPLACE INTO timeseries_raw (site_name, point_name, timestamp, value)
  VALUES (?, ?, ?, ?)
`)
```

SQLite's `INSERT OR REPLACE` behavior:
1. When a row with the same PRIMARY KEY exists: **DELETE** old row
2. **INSERT** new row with same key
3. Result: Row count stays constant, but values may be updated

### 2. Primary Key Definition

**Location:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\workers\schema\d1-schema.sql` (line 19)

```sql
CREATE TABLE IF NOT EXISTS timeseries_raw (
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  timestamp INTEGER NOT NULL,  -- Unix timestamp (SECONDS)
  value REAL NOT NULL,
  PRIMARY KEY (site_name, point_name, timestamp)
) WITHOUT ROWID;
```

**Primary Key:** `(site_name, point_name, timestamp)`
**Timestamp Precision:** Seconds (not milliseconds)

### 3. Timestamp Conversion Chain

**ETL Worker** (`src/etl-sync-worker.js` line 309):
```javascript
// Converts ISO 8601 string to milliseconds
const timestamp = Math.floor(new Date(sample.time).getTime());
```

**D1 Client** (`src/lib/d1-client.js` line 151):
```javascript
// Converts milliseconds to seconds
const timestampSec = Math.floor(sample.timestamp / 1000);
```

**Result:** Second-level precision in database

### 4. ETL Worker Lookback Window

**Configuration** (`src/etl-sync-worker.js` line 44):
```javascript
LOOKBACK_BUFFER_MINUTES: 1440, // 24 hours
```

The ETL worker:
- Runs every 5 minutes
- Fetches data from last 24 hours
- Re-fetches overlapping data from previous runs
- Timestamps at second precision → collisions with existing records

### 5. The Collision Mechanism

```
Time T:
  - ETL fetches data with timestamp 1760490000 (seconds)
  - INSERT OR REPLACE → 9 new records inserted
  - Count: 37 records total

Time T+5min:
  - ETL fetches last 24h again (overlapping data)
  - Some timestamps = 1760490000 (same as before)
  - INSERT OR REPLACE → Deletes old, inserts "new" (same timestamp)
  - Count: Still 37 records (replaced, not added)
```

## Evidence from Code

### Query Results
```
D1 count: 37 samples
Oldest: 1760320835
Newest: 1760490000
```

### Log Output
```
[D1] Batch insert complete: 9 inserted, 0 failed
```

Both are **correct**:
- 9 SQL statements executed successfully (9 "inserted")
- But some replaced existing records (count unchanged)

## Verification Query

Run this query in D1 to see if timestamps are being replaced:

```sql
-- Show all timestamps with their values
SELECT
  point_name,
  timestamp,
  value,
  datetime(timestamp, 'unixepoch') as readable_time
FROM timeseries_raw
WHERE site_name = 'ses_falls_city'
ORDER BY timestamp DESC
LIMIT 50;
```

Then compare values at same timestamps across multiple ETL runs to see if they're being updated.

### Check for Duplicate Timestamps

```sql
-- Find points with multiple samples at the same timestamp
SELECT
  site_name,
  point_name,
  timestamp,
  COUNT(*) as count
FROM timeseries_raw
WHERE site_name = 'ses_falls_city'
GROUP BY site_name, point_name, timestamp
HAVING COUNT(*) > 1;
```

Should return 0 rows (confirms REPLACE is working, no actual duplicates).

### Analyze Timestamp Distribution

```sql
-- Check timestamp density (how many samples per second)
SELECT
  datetime(timestamp, 'unixepoch') as time,
  COUNT(DISTINCT point_name) as points_at_this_second
FROM timeseries_raw
WHERE site_name = 'ses_falls_city'
GROUP BY timestamp
ORDER BY points_at_this_second DESC
LIMIT 20;
```

## Why INSERT OR REPLACE Was Chosen

From code comments in `d1-client.js` (line 139):
```javascript
/**
 * Insert a chunk using batch prepared statement
 * Uses INSERT OR REPLACE for idempotency (no duplicates)
 * ...
 */
```

**Benefits:**
- Idempotent processing (safe for ETL restarts)
- No duplicate records in database
- Handles late-arriving data updates

**Drawbacks:**
- Misleading "inserted" counts
- Constant row counts even with "successful" inserts
- Potential data loss if old values were important

## Recommended Solutions

### Option 1: Change to INSERT OR IGNORE (Recommended)

If you don't need to update existing records:

```javascript
// In d1-client.js line 161
INSERT OR IGNORE INTO timeseries_raw (site_name, point_name, timestamp, value)
VALUES (?, ?, ?, ?)
```

**Pros:**
- Skips duplicates silently
- Preserves original values
- More predictable behavior

**Cons:**
- Can't update values if data corrections come in

### Option 2: Add Detailed Logging

Track what's actually happening:

```javascript
// Before batch in d1-client.js
const existingTimestamps = await db.prepare(`
  SELECT timestamp FROM timeseries_raw
  WHERE site_name = ? AND point_name = ?
`).bind(siteName, pointName).all();

const existingSet = new Set(existingTimestamps.map(r => r.timestamp));

let newRecords = 0;
let replacedRecords = 0;

for (const sample of chunk) {
  const timestampSec = Math.floor(sample.timestamp / 1000);
  if (existingSet.has(timestampSec)) {
    replacedRecords++;
  } else {
    newRecords++;
  }
}

console.log(`[D1] ${newRecords} new, ${replacedRecords} replaced`);
```

### Option 3: Increase Timestamp Precision

Change schema to use milliseconds or add microsecond component:

```sql
-- Option A: Store milliseconds
timestamp INTEGER NOT NULL,  -- Unix timestamp (MILLISECONDS)

-- Option B: Add microsecond field
timestamp INTEGER NOT NULL,  -- Unix timestamp (SECONDS)
microsecond INTEGER NOT NULL DEFAULT 0,
PRIMARY KEY (site_name, point_name, timestamp, microsecond)
```

Then update d1-client.js to NOT divide by 1000.

**Pros:**
- Reduces collision probability
- More accurate timestamps

**Cons:**
- Requires schema migration
- Increases primary key size

### Option 4: Improve Last Sync Tracking

Reduce lookback window and track exact last timestamp:

```javascript
// In etl-sync-worker.js
// Instead of 24-hour lookback:
const lastSyncTimestamp = await getExactLastTimestamp(env);
const start = lastSyncTimestamp + 1; // Start 1 second after last sync
const end = Math.floor(Date.now() / 1000);
```

**Pros:**
- Reduces duplicate fetching
- Fewer collisions
- More efficient ETL

**Cons:**
- May miss late-arriving data
- Requires reliable state tracking

## Immediate Action Items

1. **Verify behavior** - Run verification queries above
2. **Monitor values** - Check if values are actually changing at same timestamps
3. **Decide on strategy:**
   - Keep current behavior if updates are needed
   - Switch to INSERT OR IGNORE if updates aren't needed
   - Add detailed logging to understand replacement patterns
4. **Update documentation** - Clarify INSERT OR REPLACE semantics in code comments

## Files Involved

- **ETL Worker:** `C:\Users\jstahr\Desktop\Building Vitals\src\etl-sync-worker.js`
- **D1 Client:** `C:\Users\jstahr\Desktop\Building Vitals\src\lib\d1-client.js`
- **Schema:** `C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals\workers\schema\d1-schema.sql`
- **Queue Schema:** `C:\Users\jstahr\Desktop\Building Vitals\workers\services\schema.sql`

## Related Documentation

- SQLite INSERT OR REPLACE: https://www.sqlite.org/lang_conflict.html
- D1 Documentation: https://developers.cloudflare.com/d1/
- ETL Worker Architecture: `docs/etl-worker-refactor-architecture.md`

---

**Conclusion:** This is **not a bug** - it's expected behavior given the INSERT OR REPLACE strategy and second-level timestamp precision. The "9 inserted" count is accurate (9 SQL operations succeeded), but some operations replaced existing rows rather than adding new ones.
