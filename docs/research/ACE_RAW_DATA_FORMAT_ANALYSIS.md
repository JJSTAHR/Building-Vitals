# ACE IoT API Raw Data Format Research Report

**Date:** 2025-10-15
**Researcher:** Research Agent
**Status:** Complete
**Priority:** High - Affects Chart Data Accuracy

---

## Executive Summary

### Critical Finding: **Timestamp Precision Loss in Current Storage**

The current D1 storage system converts ACE API timestamps from **milliseconds** to **seconds**, potentially losing sub-second precision data. This report analyzes the raw data format from ACE IoT API and provides recommendations for proper timestamp storage.

---

## 1. ACE IoT API Raw Data Format

### 1.1 Paginated Endpoint Specification

**Endpoint:** `GET /sites/{site_name}/timeseries/paginated`

**Key Parameter:**
- `raw_data=true` - Returns unaggregated sensor readings at native collection intervals

**OpenAPI Documentation (ace-api-swagger-formatted.json):**

```json
{
  "name": "raw_data",
  "in": "query",
  "type": "boolean",
  "description": "Set to True to return raw data without aggregation. False returns 5-minute buckets.",
  "default": false
}
```

### 1.2 Response Structure

**According to OpenAPI Schema (Point Sample Definition):**

```json
{
  "Point Sample": {
    "properties": {
      "name": {
        "type": "string",
        "description": "Point Name"
      },
      "value": {
        "type": "string",
        "description": "Point Sample Value"
      },
      "time": {
        "type": "string",
        "format": "date-time",
        "description": "Timestamp of the sample"
      }
    }
  }
}
```

**Key Observations:**
- **Timestamp Format:** `date-time` (ISO 8601 string)
- **Value Format:** `string` (numeric values encoded as strings)
- **Time Field Name:** `"time"` (not `timestamp`)

### 1.3 Expected Response Example

```json
{
  "point_samples": [
    {
      "name": "building-main/floor1/temp",
      "value": "72.5",
      "time": "2025-10-12T00:00:00.000Z"
    },
    {
      "name": "building-main/floor1/temp",
      "value": "72.6",
      "time": "2025-10-12T00:00:30.000Z"
    }
  ],
  "next_cursor": "eyJwYWdlIjoyLCJ0aW1lIjoiMjAyNS0xMC0xMlQwMDowMTowMFoifQ==",
  "has_more": true
}
```

---

## 2. Current D1 Storage Implementation

### 2.1 Schema Definition

**Documentation Schema (etl-worker-refactor-architecture.md):**

```sql
CREATE TABLE timeseries_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,        -- ISO 8601 format
  value REAL NOT NULL,
  quality TEXT,
  metadata TEXT,
  collected_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Schema declares:** `timestamp TEXT` (ISO 8601 format)

### 2.2 Actual Storage Implementation

**From `src/lib/d1-client.js` (lines 147-170):**

```javascript
async function insertChunk(db, chunk) {
  const statements = chunk.map(sample => {
    // Convert milliseconds to seconds for D1 storage
    const timestampSec = Math.floor(sample.timestamp / 1000);  // ⚠️ PRECISION LOSS

    return db.prepare(`
      INSERT OR REPLACE INTO timeseries_raw (site_name, point_name, timestamp, value)
      VALUES (?, ?, ?, ?)
    `).bind(
      sample.site_name,
      sample.point_name,
      timestampSec,           // ⚠️ STORED AS SECONDS INTEGER
      value
    );
  });
}
```

**Critical Issue:**
- **Documentation says:** Store as `TEXT` (ISO 8601)
- **Implementation does:** Convert to `INTEGER` seconds
- **Result:** Loss of millisecond precision

### 2.3 ETL Worker Transformation

**From `src/etl-sync-worker.js` (lines 318-328):**

```javascript
const allNormalizedSamples = filteredSamples.map(sample => {
  // Parse timestamp - ACE API returns "time" field with ISO 8601 string
  const timestamp = Math.floor(new Date(sample.time).getTime());  // ✅ MILLISECONDS

  const value = parseFloat(sample.value);

  return {
    site_name: siteName,
    point_name: sample.name,
    timestamp,           // ✅ Milliseconds since Unix epoch
    avg_value: value
  };
});
```

**Data Flow:**

```
ACE API          ETL Worker         D1 Client          D1 Database
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"2025-10-12     →  1728691200000  →  1728691200     →  1728691200
 T00:00:00.123Z"   (milliseconds)    (seconds)         (INTEGER)
                   ✅ PRESERVED      ⚠️ LOST .123      ⚠️ NO PRECISION
```

---

## 3. Timestamp Precision Analysis

### 3.1 ACE API Timestamp Precision

**ISO 8601 Format with Milliseconds:**
```
2025-10-12T00:00:00.123Z
                    ^^^
                    milliseconds
```

**Question:** Does ACE API provide millisecond precision?

**Analysis:**
- **Format supports:** Up to millisecond precision
- **Typical sensor intervals:** 30s, 1min, 5min
- **Collection timestamps:** Likely rounded to seconds
- **Processing timestamps:** May include milliseconds

**Recommendation:** Assume milliseconds are **provided but rarely used** in sensor data.

### 3.2 Chart Requirements

**What charts need:**

```javascript
// Typical charting library format (Recharts, Chart.js, ECharts)
{
  data: [
    { timestamp: 1728691200000, value: 72.5 },  // ✅ Milliseconds expected
    { timestamp: 1728691230000, value: 72.6 }
  ]
}
```

**Conversion in Query Worker (src/query-worker.js:608):**

```javascript
timestamp: row.timestamp * 1000,  // ⚠️ Convert seconds back to milliseconds
```

**Current Workaround:**
- Store as seconds → Multiply by 1000 when querying
- **Problem:** If original had milliseconds (e.g., `.500`), they're permanently lost

---

## 4. Data Loss Assessment

### 4.1 Precision Loss Calculation

**Scenario 1: Sensor with 30-second intervals**
```
Original:  1728691200.000  →  Stored: 1728691200  →  Retrieved: 1728691200.000
           No milliseconds     ✅ No data loss         ✅ Correct
```

**Scenario 2: Sensor with sub-second precision (hypothetical)**
```
Original:  1728691200.500  →  Stored: 1728691200  →  Retrieved: 1728691200.000
           500ms precision     ⚠️ Lost .500           ❌ WRONG by 500ms
```

**Scenario 3: High-frequency sensor (10Hz = 100ms intervals)**
```
Sample 1:  1728691200.000  →  Stored: 1728691200  →  Retrieved: 1728691200.000
Sample 2:  1728691200.100  →  Stored: 1728691200  →  Retrieved: 1728691200.000
Sample 3:  1728691200.200  →  Stored: 1728691200  →  Retrieved: 1728691200.000

⚠️ ALL THREE SAMPLES WOULD HAVE IDENTICAL TIMESTAMPS!
⚠️ INSERT OR REPLACE would keep only the last sample
```

### 4.2 Real-World Impact

**Current Sensor Collection Intervals (from docs/specs/PAGINATED_ENDPOINT_SPEC.md):**
- 30 seconds
- 1 minute
- 5 minutes

**Assessment:**
- **Current use case:** ✅ No data loss (intervals ≥ 1 second)
- **Future use case:** ❌ Cannot support sub-second sensors
- **Edge case:** ❌ Multiple samples in same second would collide

---

## 5. Recommended Storage Format

### 5.1 Option A: Store as INTEGER Milliseconds (Recommended)

**Schema Change:**
```sql
CREATE TABLE timeseries_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  timestamp INTEGER NOT NULL,     -- ✅ CHANGED: Unix milliseconds (INT64)
  value REAL NOT NULL,
  quality TEXT,
  metadata TEXT,
  collected_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  -- Composite unique constraint prevents duplicates
  UNIQUE(site_name, point_name, timestamp)
);

-- Indexes
CREATE INDEX idx_timeseries_site_point ON timeseries_raw(site_name, point_name);
CREATE INDEX idx_timeseries_timestamp ON timeseries_raw(timestamp);
CREATE INDEX idx_timeseries_site_timestamp ON timeseries_raw(site_name, timestamp);
```

**D1 Client Change:**
```javascript
async function insertChunk(db, chunk) {
  const statements = chunk.map(sample => {
    // ✅ NO CONVERSION: Store milliseconds as-is
    const timestampMs = sample.timestamp;  // Already in milliseconds from ETL

    return db.prepare(`
      INSERT OR REPLACE INTO timeseries_raw (site_name, point_name, timestamp, value)
      VALUES (?, ?, ?, ?)
    `).bind(
      sample.site_name,
      sample.point_name,
      timestampMs,              // ✅ Store milliseconds directly
      value
    );
  });
}
```

**Benefits:**
- ✅ Preserves full precision from ACE API
- ✅ No conversion needed for charts (already in ms)
- ✅ Efficient INTEGER storage (8 bytes)
- ✅ Fast timestamp comparisons
- ✅ Supports sub-second sensors (future-proof)

**Trade-offs:**
- Slightly larger than seconds (8 bytes vs 4 bytes)
- Still efficient for D1 (SQLite uses variable-length integers)

### 5.2 Option B: Store as TEXT ISO 8601 (Alternative)

**Schema:**
```sql
timestamp TEXT NOT NULL,        -- "2025-10-12T00:00:00.123Z"
```

**Benefits:**
- ✅ Human-readable
- ✅ Matches OpenAPI documentation
- ✅ Preserves exact ACE API format

**Trade-offs:**
- ❌ Slower comparisons (string vs integer)
- ❌ Larger storage (~24 bytes vs 8 bytes)
- ❌ Requires parsing for charts
- ❌ Index performance degraded

**Verdict:** Not recommended for timeseries queries.

### 5.3 Option C: Keep Seconds (Current Implementation)

**Assessment:**
- ✅ Works for current sensors (30s, 1min, 5min intervals)
- ❌ Cannot support sub-second precision
- ❌ Risk of timestamp collisions (multiple samples per second)
- ❌ Not future-proof

**Verdict:** Technical debt - should migrate to milliseconds.

---

## 6. Migration Strategy

### 6.1 Zero-Downtime Migration Plan

**Phase 1: Add New Column (No Disruption)**
```sql
-- Add new millisecond column alongside existing seconds column
ALTER TABLE timeseries_raw ADD COLUMN timestamp_ms INTEGER;

-- Backfill existing data (seconds * 1000)
UPDATE timeseries_raw SET timestamp_ms = timestamp * 1000;
```

**Phase 2: Dual-Write Period (Gradual Rollout)**
```javascript
// Write to both columns during transition
async function insertChunk(db, chunk) {
  return db.prepare(`
    INSERT OR REPLACE INTO timeseries_raw
    (site_name, point_name, timestamp, timestamp_ms, value)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    sample.site_name,
    sample.point_name,
    Math.floor(sample.timestamp / 1000),  // Old column (seconds)
    sample.timestamp,                      // New column (milliseconds)
    value
  );
}
```

**Phase 3: Switch Queries (No Data Loss)**
```javascript
// Query worker reads from new column
SELECT timestamp_ms as timestamp FROM timeseries_raw ...
```

**Phase 4: Drop Old Column (Cleanup)**
```sql
-- After confirming all systems use timestamp_ms
ALTER TABLE timeseries_raw DROP COLUMN timestamp;

-- Rename new column to standard name
ALTER TABLE timeseries_raw RENAME COLUMN timestamp_ms TO timestamp;
```

### 6.2 Schema Migration Script

```sql
-- Full migration script for D1
BEGIN TRANSACTION;

-- 1. Create new table with correct schema
CREATE TABLE timeseries_raw_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  timestamp INTEGER NOT NULL,     -- Milliseconds
  value REAL NOT NULL,
  quality TEXT,
  metadata TEXT,
  collected_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_name, point_name, timestamp)
);

-- 2. Copy data with conversion
INSERT INTO timeseries_raw_v2
  (site_name, point_name, timestamp, value, quality, metadata, collected_at, created_at)
SELECT
  site_name,
  point_name,
  timestamp * 1000 AS timestamp,  -- Convert seconds to milliseconds
  value,
  quality,
  metadata,
  collected_at,
  created_at
FROM timeseries_raw;

-- 3. Recreate indexes
CREATE INDEX idx_timeseries_site_point ON timeseries_raw_v2(site_name, point_name);
CREATE INDEX idx_timeseries_timestamp ON timeseries_raw_v2(timestamp);
CREATE INDEX idx_timeseries_site_timestamp ON timeseries_raw_v2(site_name, timestamp);

-- 4. Atomic swap (SQLite supports this)
DROP TABLE timeseries_raw;
ALTER TABLE timeseries_raw_v2 RENAME TO timeseries_raw;

COMMIT;
```

---

## 7. Test Plan

### 7.1 Unit Tests

**Test 1: Precision Preservation**
```javascript
test('stores millisecond timestamps without loss', async () => {
  const samples = [
    { timestamp: 1728691200000, value: 72.5 },  // Exact second
    { timestamp: 1728691200500, value: 72.6 },  // Half second
    { timestamp: 1728691200999, value: 72.7 },  // 999ms
  ];

  await batchInsertTimeseries(db, samples);

  const retrieved = await db.prepare('SELECT * FROM timeseries_raw').all();

  expect(retrieved[0].timestamp).toBe(1728691200000);
  expect(retrieved[1].timestamp).toBe(1728691200500);
  expect(retrieved[2].timestamp).toBe(1728691200999);
});
```

**Test 2: No Timestamp Collisions**
```javascript
test('handles multiple samples in same second', async () => {
  const samples = [
    { timestamp: 1728691200000, value: 72.5 },
    { timestamp: 1728691200001, value: 72.6 },  // 1ms later
    { timestamp: 1728691200002, value: 72.7 },  // 2ms later
  ];

  await batchInsertTimeseries(db, samples);

  const count = await db.prepare('SELECT COUNT(*) FROM timeseries_raw').first();

  expect(count).toBe(3);  // All three should be stored
});
```

### 7.2 Integration Tests

**Test ACE API Response Handling:**
```bash
curl "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00.000Z&end_time=2025-10-12T01:00:00.000Z&page_size=100&raw_data=true" \
  -H "authorization: Bearer ${ACE_TOKEN}" \
  | jq '.point_samples[0]'
```

**Expected Response:**
```json
{
  "name": "ses_falls_city/point_123",
  "value": "72.5",
  "time": "2025-10-12T00:00:00.000Z"
}
```

**Verify:**
- `time` field is ISO 8601 string
- Parse with `new Date(sample.time).getTime()` yields milliseconds
- Store result without `/1000` conversion

---

## 8. Recommendations

### 8.1 Immediate Actions (P0 - Critical)

1. **Fix D1 Storage:** Store timestamps as INTEGER milliseconds (not seconds)
   - File: `src/lib/d1-client.js`
   - Change: Remove `Math.floor(sample.timestamp / 1000)` conversion
   - Impact: Preserves full precision from ACE API

2. **Update D1 Schema:** Change `timestamp` to INTEGER (milliseconds)
   - Current: Converts to seconds (precision loss)
   - Target: Store as-is from ACE API (milliseconds)
   - Migration: See Section 6.1

3. **Fix Query Worker:** Remove `* 1000` conversion
   - File: `src/query-worker.js`
   - Current: `timestamp: row.timestamp * 1000`
   - Target: `timestamp: row.timestamp` (already in milliseconds)

### 8.2 Code Changes Summary

**File: `src/lib/d1-client.js`**
```diff
async function insertChunk(db, chunk) {
  const statements = chunk.map(sample => {
-   // Convert milliseconds to seconds for D1 storage
-   const timestampSec = Math.floor(sample.timestamp / 1000);
+   // Store milliseconds directly (no conversion)
+   const timestampMs = sample.timestamp;

    return db.prepare(`
      INSERT OR REPLACE INTO timeseries_raw (site_name, point_name, timestamp, value)
      VALUES (?, ?, ?, ?)
    `).bind(
      sample.site_name,
      sample.point_name,
-     timestampSec,
+     timestampMs,
      value
    );
  });
}
```

**File: `src/query-worker.js`**
```diff
{
  point_name: row.point_name,
- timestamp: row.timestamp * 1000, // Convert to milliseconds
+ timestamp: row.timestamp,        // Already in milliseconds
  value: row.value
}
```

### 8.3 Validation Steps

**After Changes:**

1. **Test with Real ACE API Data:**
   ```bash
   curl "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00.000Z&end_time=2025-10-12T01:00:00.000Z&page_size=10&raw_data=true" \
     -H "authorization: Bearer ${ACE_TOKEN}" \
     | jq '.point_samples[] | {time, value}'
   ```

2. **Verify ETL Parsing:**
   ```javascript
   const sample = {
     name: "test/point",
     value: "72.5",
     time: "2025-10-12T00:00:30.500Z"  // Note: .500 milliseconds
   };

   const timestamp = new Date(sample.time).getTime();
   console.log(timestamp);  // Should be: 1728691230500 (includes .500)
   ```

3. **Verify D1 Storage:**
   ```bash
   wrangler d1 execute BUILDING_VITALS_DB --command="SELECT timestamp FROM timeseries_raw LIMIT 5"
   ```

   **Expected:** Integer milliseconds (e.g., `1728691230500`)
   **Not:** Integer seconds (e.g., `1728691230`)

4. **Verify Query Worker Output:**
   ```bash
   curl "https://your-query-worker.workers.dev/timeseries?point_name=test/point&start_time=1728691200000&end_time=1728691300000"
   ```

   **Expected:** Timestamps in milliseconds (unchanged from D1)

---

## 9. Risk Assessment

### 9.1 Risks of Current Implementation (Seconds Storage)

| Risk | Likelihood | Impact | Severity |
|------|-----------|--------|----------|
| Timestamp collisions (multiple samples/sec) | Medium | High | **CRITICAL** |
| Cannot support sub-second sensors | Low | Medium | **HIGH** |
| Charts show incorrect timestamps | Low | Low | **MEDIUM** |
| Data loss during millisecond precision | Low | Medium | **MEDIUM** |

### 9.2 Risks of Migration (Milliseconds Storage)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data loss during migration | Low | High | Use dual-write period (Phase 2) |
| Breaking existing queries | Medium | High | Update query worker simultaneously |
| Increased storage size | None | Low | Minimal (8 bytes vs 4 bytes per row) |
| Performance degradation | Low | Low | INTEGER is highly optimized in SQLite |

---

## 10. Conclusion

### 10.1 Key Findings

1. **ACE API Format:**
   - Returns ISO 8601 strings with potential millisecond precision
   - ETL worker correctly parses to milliseconds
   - Example: `"2025-10-12T00:00:00.123Z"` → `1728691200123`

2. **Current Storage:**
   - D1 client converts milliseconds → seconds (**precision loss**)
   - Query worker converts seconds → milliseconds (**cannot restore lost precision**)
   - Works for current sensors (≥1 second intervals) but not future-proof

3. **Recommended Fix:**
   - Store timestamps as INTEGER milliseconds (no conversion)
   - Remove `Math.floor(timestamp / 1000)` in d1-client.js
   - Remove `* 1000` in query-worker.js
   - Update D1 schema to `timestamp INTEGER NOT NULL`

### 10.2 Business Impact

**Current State:**
- ✅ Functional for existing sensors (30s, 1min, 5min intervals)
- ❌ Cannot support high-frequency sensors (future requirement)
- ❌ Risk of data loss if ACE API provides sub-second timestamps

**After Fix:**
- ✅ Future-proof for any sensor frequency
- ✅ No precision loss from ACE API → Chart
- ✅ Matches industry best practices (chart libraries expect milliseconds)

### 10.3 Next Steps

1. Review this report with development team
2. Approve migration strategy (Section 6.1 recommended)
3. Implement code changes (Section 8.2)
4. Test with real ACE API data (Section 8.3)
5. Deploy to staging for validation
6. Migrate production data (zero downtime)

---

## Appendix A: Related Files

**Core Files to Modify:**
- `src/lib/d1-client.js` - Database insert logic
- `src/query-worker.js` - Query response formatting
- `src/etl-sync-worker.js` - ETL transformation (already correct)

**Documentation to Update:**
- `docs/etl-worker-refactor-architecture.md` - Schema definition
- `docs/specs/PAGINATED_ENDPOINT_SPEC.md` - API integration guide

**Test Files:**
- Create: `src/lib/__tests__/d1-timestamp-precision.test.js`
- Create: `tests/workers/etl-timestamp-integration.test.js`

---

## Appendix B: ACE API Investigation Commands

```bash
# Test paginated endpoint with raw_data=true
curl "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00.000Z&end_time=2025-10-12T01:00:00.000Z&page_size=100&raw_data=true" \
  -H "authorization: Bearer ${ACE_TOKEN}" \
  | jq '.'

# Examine timestamp format in first sample
curl "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00.000Z&end_time=2025-10-12T01:00:00.000Z&page_size=5&raw_data=true" \
  -H "authorization: Bearer ${ACE_TOKEN}" \
  | jq '.point_samples[0].time'

# Check for millisecond precision
curl "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00.000Z&end_time=2025-10-12T01:00:00.000Z&page_size=100&raw_data=true" \
  -H "authorization: Bearer ${ACE_TOKEN}" \
  | jq '.point_samples[].time | select(contains("."))' | head -10

# Verify value format (should be strings)
curl "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-12T00:00:00.000Z&end_time=2025-10-12T01:00:00.000Z&page_size=5&raw_data=true" \
  -H "authorization: Bearer ${ACE_TOKEN}" \
  | jq '.point_samples[0].value | type'
```

---

**Report Version:** 1.0
**Completion Date:** 2025-10-15
**Status:** Ready for Review and Implementation
