# ETL Sync Worker Fix - Removal of 48-Hour Processing Lag

## Date: October 15, 2025

## Problem Summary

The ETL sync worker was incorrectly configured with a **48-hour processing lag assumption** that was causing:
- **Zero results on initial syncs** - First sync queried 48h ago to 48h ago (zero-length window)
- **Missing recent data** - Incremental syncs queried tiny 4-5 minute windows that missed hourly samples
- **False assumptions** - ACE API actually HAS current data with no processing lag

## API Testing Findings

Testing confirmed:
- **ACE API HAS current data** - Query `Oct 15 14:00-15:45` returned 100+ samples
- **NO 48-hour processing lag exists** - Data is available immediately
- **Data is sampled at specific intervals** - Appears at timestamps like `:00:36`
- **Worker was querying too narrow windows** - 4-minute windows (15:31:39 to 15:35:27) missed hourly samples

## Changes Made to `src/etl-sync-worker.js`

### 1. Removed 48-Hour Processing Lag Assumption

**Line 44 - Configuration:**
```javascript
// BEFORE:
LOOKBACK_BUFFER_MINUTES: 1440, // 24 hours - aggregated data has NO lag

// AFTER:
LOOKBACK_BUFFER_MINUTES: 60, // 1 hour buffer to ensure data capture
```

### 2. Updated getSyncState() Function

**Lines 686-704:**
```javascript
// BEFORE:
const processingLagMs = 48 * 60 * 60 * 1000; // 48 hours processing lag
const defaultStartTime = now - processingLagMs;

// AFTER:
// ACE API has current data with no processing lag
// First sync starts from 24 hours ago
const defaultStartTime = now - (24 * 60 * 60 * 1000); // 24 hours for first sync
```

### 3. Completely Rewrote calculateTimeRange() Function

**Lines 754-778 - The Critical Fix:**

**BEFORE (INCORRECT):**
- First sync: 48h ago to 48h ago (zero-length window!)
- Incremental: last_sync to 48h ago (tiny 4-5 min windows)
- Always ended 48 hours in the past

**AFTER (CORRECT):**
```javascript
function calculateTimeRange(syncState) {
  const now = Date.now();

  // Determine if first sync (last sync > 7 days ago or not set)
  const isFirstSync = !syncState.lastSyncTimestamp ||
                      syncState.lastSyncTimestamp < (now - 7 * 86400000);

  let start, end;

  if (isFirstSync) {
    // First sync: Get last 24 hours of data
    start = Math.floor((now - 86400000) / 1000); // 24h ago in seconds
    end = Math.floor(now / 1000);                 // now in seconds
    console.log(`[ETL] FIRST SYNC: Fetching last 24 hours of data`);
  } else {
    // Incremental: From last sync to now
    start = Math.floor(syncState.lastSyncTimestamp / 1000);
    end = Math.floor(now / 1000);
    console.log(`[ETL] INCREMENTAL SYNC: From last sync to now`);
  }

  console.log(`[ETL] Time range: ${new Date(start * 1000).toISOString()} → ${new Date(end * 1000).toISOString()} (${isFirstSync ? 'FIRST' : 'INCREMENTAL'})`);

  return { start, end };
}
```

### 4. Updated Documentation Comments

**Lines 249-254, 421-425:**
- Removed all "48-hour processing lag" references
- Updated to reflect "ACE API has current data with no processing lag"
- Changed sync strategy description:
  - First sync: "Fetches last 24 hours of data"
  - Incremental: "From last sync timestamp to now"

## Expected Behavior After Fix

### First Sync
- **Time Range**: Now - 24h → Now
- **Example**: If run at 15:00, queries 14:00 yesterday to 15:00 today
- **Data Captured**: Full 24 hours of recent data

### Incremental Syncs (5-minute interval)
- **Time Range**: Last sync timestamp → Now
- **Example**: If last sync was 14:55, queries 14:55 to 15:00
- **Window Size**: 5-minute windows (matches cron schedule)
- **Data Captured**: All samples in window (hourly, minute-level, etc.)

### Longer Intervals (if worker delayed)
- **Time Range**: Last sync timestamp → Now
- **Example**: If last sync was 14:00, queries 14:00 to 15:00
- **Window Size**: 1-hour window (sufficient to capture hourly samples)

## Verification Steps

1. **Check logs for first sync:**
   ```
   [ETL] FIRST SYNC: Fetching last 24 hours of data
   [ETL] Time range: 2025-10-14T15:00:00.000Z → 2025-10-15T15:00:00.000Z (FIRST)
   ```

2. **Check logs for incremental syncs:**
   ```
   [ETL] INCREMENTAL SYNC: From last sync to now
   [ETL] Time range: 2025-10-15T14:55:00.000Z → 2025-10-15T15:00:00.000Z (INCREMENTAL)
   ```

3. **Verify data is being captured:**
   - Check `[ACE API] Page X: Y samples` logs
   - Confirm Y > 0 samples returned
   - Check `[ETL] Site X timeseries complete: Y records inserted`

4. **Query D1 database:**
   ```sql
   SELECT COUNT(*),
          MIN(timestamp) as oldest,
          MAX(timestamp) as newest
   FROM timeseries_raw;
   ```

## Files Modified

- `C:\Users\jstahr\Desktop\Building Vitals\src\etl-sync-worker.js`

## All 48-Hour References Removed

Confirmed with grep search - zero matches for:
- `processingLag`
- `48 hours`
- `48h`
- `48-hour`

## Summary

The fix ensures:
- **First syncs get 24 hours of data** (not zero-length window)
- **Incremental syncs query from last sync to now** (not ending 48h ago)
- **Time windows are adequate** (5-min to hours, not 4-minute slivers)
- **All 48-hour lag assumptions removed** (code matches API reality)

This should resolve the "0 samples" issue and ensure continuous data capture going forward.
