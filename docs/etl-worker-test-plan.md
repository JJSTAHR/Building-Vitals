# ETL Worker Test Plan - Comprehensive Validation

**Version:** 1.0
**Date:** October 14, 2025
**Site:** ses_falls_city
**Author:** Testing Agent (SPARC TDD Methodology)

## Executive Summary

This test plan validates the ETL Worker refactor that transitions from point-specific queries (causing 400 BAD REQUEST errors) to site-wide bulk data collection with cursor-based pagination and worker-side filtering. The ETL Worker synchronizes data from ACE IoT API to D1 hot storage every 5 minutes.

**Testing Scope:**
- Paginated endpoint integration (page_size=100000)
- Cursor-based pagination handling
- Worker-side point filtering
- D1 batch insert operations
- Weather data collection
- Error handling and recovery
- End-to-end data flow verification

---

## 1. Test Matrix

| Scenario | Test Type | Expected Behavior | Priority | Duration |
|----------|-----------|-------------------|----------|----------|
| **1. Paginated Endpoint - Single Page** | Integration | Fetch <100k records, no cursor | HIGH | 5 min |
| **2. Paginated Endpoint - Multi-Page** | Integration | Handle cursor pagination | HIGH | 10 min |
| **3. Paginated Endpoint - Empty Response** | Edge Case | Graceful handling | MEDIUM | 2 min |
| **4. Paginated Endpoint - Auth Error** | Error | Detect 401 and fail gracefully | HIGH | 2 min |
| **5. Weather Data Collection** | Integration | Fetch and transform weather | MEDIUM | 5 min |
| **6. Worker-Side Filtering** | Unit | Filter configured points | HIGH | 3 min |
| **7. Worker-Side Filtering - Performance** | Performance | Handle 500k+ samples | MEDIUM | 10 min |
| **8. D1 Batch Insert** | Integration | Insert 1000 records/batch | HIGH | 5 min |
| **9. D1 Schema Compliance** | Validation | Verify data types | HIGH | 3 min |
| **10. D1 Timestamp Conversion** | Validation | ms to seconds conversion | HIGH | 2 min |
| **11. D1 Deduplication** | Validation | INSERT OR REPLACE logic | MEDIUM | 5 min |
| **12. End-to-End Flow** | E2E | ETL→D1→Query→Frontend | HIGH | 15 min |
| **13. Error Recovery** | Error | Handle API/DB failures | HIGH | 10 min |

**Total Test Time:** ~75 minutes

---

## 2. Pre-Test Setup

### 2.1 Environment Verification

**Check ETL Worker Configuration:**
```bash
# Navigate to workers directory
cd "C:\Users\jstahr\Desktop\Building Vitals\workers"

# Verify wrangler.toml configuration
cat wrangler-etl.toml

# Check secrets are set
wrangler secret list -c wrangler-etl.toml

# Verify D1 database exists
wrangler d1 list | grep "ace-iot-db"

# Check KV namespace exists
wrangler kv:namespace list | grep "ETL_STATE"
```

**Expected Output:**
```
✅ wrangler-etl.toml configured with:
   - name: "building-vitals-etl-sync"
   - D1 binding: "DB" → ace-iot-db
   - KV binding: "ETL_STATE"
   - Cron: "*/5 * * * *" (every 5 minutes)

✅ Secrets configured:
   - ACE_API_KEY (set)

✅ D1 database: ace-iot-db (ID: 1afc0a07-85cd-4d5f-a046-b580ffffb8dc)

✅ KV namespace: ETL_STATE (ID: fa5e24f3f2ed4e3489a299e28f1bffaa)
```

### 2.2 Database Schema Verification

**Check D1 Tables Exist:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT name, type FROM sqlite_master
WHERE type='table'
ORDER BY name;
"
```

**Expected Tables:**
- `timeseries` (or `timeseries_raw` - verify which schema is active)
- `points`
- `archive_state` (optional)

**Verify Schema Structure:**
```bash
wrangler d1 execute ace-iot-db --command="
PRAGMA table_info(timeseries);
"
```

**Expected Columns (from 001_initial_schema.sql):**
```
cid  name        type     notnull  dflt_value  pk
---  ----------  -------  -------  ----------  --
0    timestamp   INTEGER  1                    1
1    point_id    INTEGER  1                    2
2    value       REAL     1                    0
3    quality     INTEGER  1        192         0
4    flags       INTEGER  0        0           0
```

### 2.3 Get ACE API Token

**Extract from Firebase:**
1. Open https://building-vitals.firebaseapp.com
2. DevTools (F12) → Application → IndexedDB → firebaseLocalStorage
3. Copy `authToken` value

**Or set as secret:**
```bash
wrangler secret put ACE_API_KEY -c wrangler-etl.toml
# Paste token when prompted
```

### 2.4 Configure Test Points

**Get active points from D1:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT p.name, COUNT(*) as sample_count
FROM timeseries ts
INNER JOIN points p ON ts.point_id = p.id
GROUP BY p.id, p.name
ORDER BY sample_count DESC
LIMIT 10;
"
```

**Create test configuration file:**
```bash
# Create test-config.json in workers directory
cat > test-config.json << 'EOF'
{
  "siteName": "ses_falls_city",
  "testPoints": [
    "ses_falls_city.HVAC.VAV-707-DaTemp",
    "ses_falls_city.HVAC.VAV-707-DaTempSp",
    "ses_falls_city.HVAC.VAV-707-DmpPos"
  ],
  "apiBase": "https://flightdeck.aceiot.cloud/api",
  "testDuration": "24h"
}
EOF
```

---

## 3. Test Scenarios

### Test 1: Paginated Endpoint - Single Page Response

**Objective:** Verify ETL Worker handles single-page responses (<100k records)

**Test Setup:**
```bash
# Start local worker
wrangler dev -c wrangler-etl.toml --local --persist

# In separate terminal, trigger ETL
curl -X POST http://localhost:8787/trigger \
  -H "Content-Type: application/json" \
  -d '{"test_mode": true, "time_window_hours": 1}'
```

**Manual Test Steps:**

1. **Trigger ETL manually** (instead of waiting for cron):
```bash
curl -X POST http://localhost:8787/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2025-10-14T00:00:00Z",
    "end_time": "2025-10-14T01:00:00Z"
  }'
```

2. **Watch worker logs** for API request:
```
Expected log output:
--------------------------------------------------
[ETL] Starting timeseries collection
[ETL] Fetching page 1 (cursor: null)
[ETL] API Request: GET /sites/ses_falls_city/timeseries/paginated
[ETL] API Response: 200 OK
[ETL] Records fetched: 15,432
[ETL] Pagination: has_more=false (single page)
[ETL] Filtering configured points...
[ETL] Filtered: 8,245 / 15,432 records
[ETL] Batch inserting 8,245 records to D1...
[ETL] Success: 8,245 records inserted
--------------------------------------------------
```

3. **Verify data in D1:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT COUNT(*) as inserted_count,
       MIN(timestamp) as oldest_ts,
       MAX(timestamp) as newest_ts
FROM timeseries
WHERE timestamp >= unixepoch('2025-10-14T00:00:00Z') * 1000
  AND timestamp <= unixepoch('2025-10-14T01:00:00Z') * 1000;
"
```

**Expected Results:**
- ✅ HTTP 200 from ACE API
- ✅ Records fetched: ~15,000 (1 hour × ~250 points × 1 sample/min)
- ✅ `has_more: false` (single page)
- ✅ No cursor returned
- ✅ D1 insert count matches filtered records
- ✅ Timestamps within requested range

**Validation Checklist:**
- [ ] API request succeeded (200 OK)
- [ ] Page size = 100000 (optimal)
- [ ] Records received < 100000 (single page)
- [ ] No pagination cursor received
- [ ] Worker-side filtering applied
- [ ] D1 insert successful
- [ ] Log output shows clear progress

**Failure Modes:**
- ❌ 400 BAD REQUEST → Check API authentication
- ❌ Empty response → Verify site name correct
- ❌ Timeout → Reduce time window

---

### Test 2: Paginated Endpoint - Multi-Page Response

**Objective:** Verify cursor-based pagination handles >100k records

**Test Setup:**
```bash
# Request 24-hour window (should exceed 100k records)
curl -X POST http://localhost:8787/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2025-10-13T00:00:00Z",
    "end_time": "2025-10-14T00:00:00Z"
  }'
```

**Manual Test Steps:**

1. **Trigger 24-hour collection:**
```bash
curl -X POST http://localhost:8787/trigger \
  -H "Content-Type: application/json" \
  -d '{"time_window_hours": 24}'
```

2. **Watch for pagination in logs:**
```
Expected log output:
--------------------------------------------------
[ETL] Starting timeseries collection (24-hour window)
[ETL] Fetching page 1 (cursor: null)
[ETL] API Response: 200 OK (100,000 records)
[ETL] Pagination: has_more=true, cursor=eyJvZmZzZXQiOjEwMDAwMH0
[ETL] Batch insert: 100,000 → D1
[ETL] Fetching page 2 (cursor: eyJvZmZzZXQiOjEwMDAwMH0)
[ETL] API Response: 200 OK (100,000 records)
[ETL] Pagination: has_more=true, cursor=eyJvZmZzZXQiOjIwMDAwMH0
[ETL] Batch insert: 100,000 → D1
[ETL] Fetching page 3 (cursor: eyJvZmZzZXQiOjIwMDAwMH0)
[ETL] API Response: 200 OK (62,400 records)
[ETL] Pagination: has_more=false (final page)
[ETL] Batch insert: 62,400 → D1
[ETL] Total collected: 262,400 records across 3 pages
--------------------------------------------------
```

3. **Verify pagination metrics in KV:**
```bash
wrangler kv:key get --binding=ETL_STATE "checkpoint:ses_falls_city"
```

**Expected JSON:**
```json
{
  "site": "ses_falls_city",
  "last_timestamp": "2025-10-14T00:00:00Z",
  "pages_fetched": 3,
  "total_records": 262400,
  "filtered_records": 156000,
  "saved_at": "2025-10-14T12:05:32Z"
}
```

4. **Verify D1 records match:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT COUNT(*) as total_inserted
FROM timeseries
WHERE timestamp >= unixepoch('2025-10-13T00:00:00Z') * 1000
  AND timestamp <= unixepoch('2025-10-14T00:00:00Z') * 1000;
"
```

**Expected Results:**
- ✅ Multiple API requests with cursors
- ✅ Each page: 100,000 records (except last)
- ✅ Cursor passed correctly between requests
- ✅ Final page: `has_more: false`
- ✅ D1 records = sum of all filtered pages
- ✅ No duplicate timestamps in D1

**Performance Requirements:**
- Total processing time <2 minutes for 300k records
- Memory usage <50 MB (streaming, not buffering)

**Validation Checklist:**
- [ ] Page 1: cursor received
- [ ] Page 2+: cursor sent correctly
- [ ] Last page: `has_more: false`
- [ ] All pages inserted to D1
- [ ] No data loss between pages
- [ ] Checkpoint saved in KV

**Failure Modes:**
- ❌ Cursor expired → Retry from checkpoint
- ❌ Memory exceeded → Verify streaming (not buffering)
- ❌ Missing records → Check cursor logic

---

### Test 3: Paginated Endpoint - Empty Response Handling

**Objective:** Verify graceful handling when no data available

**Test Setup:**
```bash
# Request future time range (no data)
curl -X POST http://localhost:8787/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2025-12-01T00:00:00Z",
    "end_time": "2025-12-01T01:00:00Z"
  }'
```

**Expected Logs:**
```
[ETL] Starting timeseries collection
[ETL] Fetching page 1 (cursor: null)
[ETL] API Response: 200 OK
[ETL] Records fetched: 0
[ETL] Pagination: has_more=false
[ETL] No data to insert, skipping D1 write
[ETL] Collection complete: 0 records
```

**Expected Results:**
- ✅ HTTP 200 (not 404)
- ✅ Empty data array: `[]`
- ✅ No D1 insert attempted
- ✅ No errors thrown
- ✅ Checkpoint updated with 0 records

**Validation Checklist:**
- [ ] No exceptions thrown
- [ ] Log shows "0 records" message
- [ ] D1 not modified
- [ ] Worker completes successfully

---

### Test 4: Paginated Endpoint - Authentication Error

**Objective:** Verify error handling for 401 Unauthorized

**Test Setup:**
```bash
# Delete ACE_API_KEY secret temporarily
wrangler secret delete ACE_API_KEY -c wrangler-etl.toml

# Trigger ETL (should fail)
curl -X POST http://localhost:8787/trigger
```

**Expected Logs:**
```
[ETL] Starting timeseries collection
[ETL] Fetching page 1 (cursor: null)
[ETL] API ERROR: 401 Unauthorized
[ETL] Error: Authentication failed - missing or invalid API key
[ETL] Aborting collection (no retry on auth errors)
[ETL] Status: FAILED
```

**Expected Results:**
- ✅ HTTP 401 detected
- ✅ Clear error message logged
- ✅ No D1 insert attempted
- ✅ No infinite retries
- ✅ Error stored in KV for monitoring

**Restore secret:**
```bash
wrangler secret put ACE_API_KEY -c wrangler-etl.toml
```

**Validation Checklist:**
- [ ] 401 error detected
- [ ] ETL aborted gracefully
- [ ] Error logged to KV
- [ ] No partial data inserted

---

### Test 5: Weather Data Collection

**Objective:** Verify weather endpoint integration

**Test Setup:**
```bash
# Trigger weather collection
curl -X POST http://localhost:8787/weather \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2025-10-14T00:00:00Z",
    "end_time": "2025-10-14T23:59:59Z"
  }'
```

**Expected API Request:**
```
GET /sites/ses_falls_city/weather
Query params:
  start_time=2025-10-14T00:00:00Z
  end_time=2025-10-14T23:59:59Z
```

**Expected API Response:**
```json
{
  "data": [
    {
      "timestamp": "2025-10-14T00:00:00Z",
      "temperature": 68.5,
      "humidity": 45.2,
      "precipitation": 0.0,
      "wind_speed": 5.3,
      "conditions": "clear"
    }
  ]
}
```

**Verify D1 Weather Table:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT * FROM weather_raw
WHERE site_name = 'ses_falls_city'
  AND timestamp >= '2025-10-14T00:00:00Z'
ORDER BY timestamp DESC
LIMIT 5;
"
```

**Expected D1 Schema:**
```
id | site_name      | timestamp           | temperature | humidity | precipitation | wind_speed | conditions | metadata | collected_at
---|----------------|---------------------|-------------|----------|---------------|------------|------------|----------|-------------
1  | ses_falls_city | 2025-10-14T12:00:00Z| 72.3        | 42.1     | 0.0           | 6.2        | clear      | {...}    | 2025-10-14T12:05:00Z
```

**Validation Checklist:**
- [ ] Weather endpoint called successfully
- [ ] Data transformed correctly
- [ ] All fields mapped (temperature, humidity, etc.)
- [ ] Stored as timeseries points
- [ ] Timestamps in ISO 8601 format

---

### Test 6: Worker-Side Filtering

**Objective:** Verify configured points filtering logic

**Test Setup (Unit Test):**
```javascript
// Create test-filter.js
const CONFIGURED_POINTS = new Set([
  'ses_falls_city.HVAC.VAV-707-DaTemp',
  'ses_falls_city.HVAC.VAV-707-DaTempSp'
]);

const rawData = [
  { point_name: 'ses_falls_city.HVAC.VAV-707-DaTemp', value: 72.5, timestamp: '2025-10-14T12:00:00Z' },
  { point_name: 'ses_falls_city.HVAC.VAV-999-Unknown', value: 60.0, timestamp: '2025-10-14T12:00:00Z' },
  { point_name: 'ses_falls_city.HVAC.VAV-707-DaTempSp', value: 70.0, timestamp: '2025-10-14T12:00:00Z' },
  { point_name: 'ses_falls_city.Lighting.Zone1', value: 100.0, timestamp: '2025-10-14T12:00:00Z' }
];

const filtered = rawData.filter(record => CONFIGURED_POINTS.has(record.point_name));

console.assert(filtered.length === 2, 'Should filter to 2 configured points');
console.assert(filtered[0].point_name === 'ses_falls_city.HVAC.VAV-707-DaTemp', 'Point 1 match');
console.assert(filtered[1].point_name === 'ses_falls_city.HVAC.VAV-707-DaTempSp', 'Point 2 match');

console.log('✅ Worker-side filtering test passed');
```

**Run test:**
```bash
node workers/test-filter.js
```

**Expected Output:**
```
✅ Worker-side filtering test passed
Filtered: 2 / 4 records (50% retention)
```

**Validation Checklist:**
- [ ] Only configured points retained
- [ ] Unconfigured points dropped
- [ ] O(1) lookup performance (Set)
- [ ] Log shows filtering statistics

---

### Test 7: Worker-Side Filtering - Performance Test

**Objective:** Verify filtering handles 500k+ samples efficiently

**Test Setup:**
```javascript
// Create test-filter-performance.js
const CONFIGURED_POINTS = new Set(
  Array.from({length: 100}, (_, i) => `point_${i}`)
);

// Generate 500k test records
const rawData = Array.from({length: 500000}, (_, i) => ({
  point_name: `point_${i % 200}`, // Mix of configured/unconfigured
  value: Math.random() * 100,
  timestamp: new Date(Date.now() - i * 60000).toISOString()
}));

console.log('Starting filter performance test...');
const startTime = Date.now();

const filtered = rawData.filter(record => CONFIGURED_POINTS.has(record.point_name));

const duration = Date.now() - startTime;
const throughput = (rawData.length / duration * 1000).toFixed(0);

console.log(`✅ Filtered 500k records in ${duration}ms`);
console.log(`   Throughput: ${throughput} records/second`);
console.log(`   Filtered: ${filtered.length} / ${rawData.length} (${(filtered.length/rawData.length*100).toFixed(1)}%)`);

console.assert(duration < 1000, `Performance issue: ${duration}ms exceeds 1s`);
```

**Run test:**
```bash
node workers/test-filter-performance.js
```

**Expected Results:**
- ✅ Duration <1 second for 500k records
- ✅ Throughput >500k records/second
- ✅ Memory usage <100 MB

**Validation Checklist:**
- [ ] Processing time <1s
- [ ] Memory efficient (streaming)
- [ ] No memory leaks

---

### Test 8: D1 Batch Insert

**Objective:** Verify batch insert logic (1000 records/batch)

**Test Setup:**
```bash
# Create test data
cat > test-batch-insert.sql << 'EOF'
-- Test batch insert with 2500 records (should create 3 batches)
-- Batch 1: 1000 records
-- Batch 2: 1000 records
-- Batch 3: 500 records
EOF
```

**Watch logs for batch chunking:**
```
Expected log output:
--------------------------------------------------
[ETL] Batch insert: 2500 records
[ETL] Splitting into batches of 1000...
[ETL] Batch 1/3: Inserting 1000 records
[ETL] Batch 1/3: Success (125ms)
[ETL] Batch 2/3: Inserting 1000 records
[ETL] Batch 2/3: Success (132ms)
[ETL] Batch 3/3: Inserting 500 records
[ETL] Batch 3/3: Success (68ms)
[ETL] Total inserted: 2500 records in 325ms
--------------------------------------------------
```

**Verify D1 count:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT COUNT(*) as count FROM timeseries;
"
```

**Expected Results:**
- ✅ Batches of 1000 records each
- ✅ Last batch <1000 (remainder)
- ✅ All batches successful
- ✅ Total count matches input

**Validation Checklist:**
- [ ] Batch size = 1000 (optimal for D1)
- [ ] All batches inserted successfully
- [ ] No records lost
- [ ] No duplicates created

---

### Test 9: D1 Schema Compliance

**Objective:** Verify data types match schema

**Test Query:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT
  timestamp,
  point_id,
  value,
  quality,
  flags,
  typeof(timestamp) as ts_type,
  typeof(point_id) as point_type,
  typeof(value) as value_type,
  typeof(quality) as quality_type
FROM timeseries
LIMIT 1;
"
```

**Expected Output:**
```
timestamp   point_id  value  quality  flags  ts_type   point_type  value_type  quality_type
----------  --------  -----  -------  -----  --------  ----------  ----------  ------------
1729000000  1         72.5   192      0      integer   integer     real        integer
```

**Validation Checklist:**
- [ ] timestamp: INTEGER (Unix seconds)
- [ ] point_id: INTEGER (FK to points table)
- [ ] value: REAL (numeric sensor data)
- [ ] quality: INTEGER (0-255 range)
- [ ] flags: INTEGER (bitfield)

---

### Test 10: D1 Timestamp Conversion

**Objective:** Verify milliseconds → seconds conversion

**Test Setup:**
```bash
# Check if API returns ms or seconds
curl -X GET "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-14T00:00:00Z&end_time=2025-10-14T00:01:00Z&page_size=1" \
  -H "Authorization: Bearer $ACE_API_KEY" | jq '.data[0].timestamp'
```

**Expected API timestamp format:**
```json
"2025-10-14T12:00:00Z" (ISO 8601)
or
1729000000000 (milliseconds)
```

**Verify D1 stores seconds:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT
  timestamp,
  datetime(timestamp, 'unixepoch') as human_readable,
  length(CAST(timestamp AS TEXT)) as digit_count
FROM timeseries
LIMIT 1;
"
```

**Expected Output:**
```
timestamp   human_readable       digit_count
----------  -------------------  -----------
1729000000  2025-10-14 12:00:00  10 (seconds, not 13 digits for ms)
```

**Validation Checklist:**
- [ ] API timestamp converted correctly
- [ ] D1 stores Unix seconds (10 digits)
- [ ] No precision loss
- [ ] Timezone handled correctly (UTC)

---

### Test 11: D1 Deduplication (INSERT OR REPLACE)

**Objective:** Verify duplicate handling

**Test Setup:**
```bash
# Insert same timestamp twice
wrangler d1 execute ace-iot-db --command="
-- First insert
INSERT INTO timeseries (timestamp, point_id, value, quality)
VALUES (1729000000, 1, 72.5, 192);

-- Duplicate insert (should replace)
INSERT OR REPLACE INTO timeseries (timestamp, point_id, value, quality)
VALUES (1729000000, 1, 73.0, 192);

-- Verify only one record exists
SELECT COUNT(*) as count, value
FROM timeseries
WHERE timestamp = 1729000000 AND point_id = 1;
"
```

**Expected Output:**
```
count  value
-----  -----
1      73.0  (updated value, not duplicate)
```

**Validation Checklist:**
- [ ] No duplicate timestamps per point
- [ ] Latest value wins
- [ ] Primary key (point_id, timestamp) enforced

---

### Test 12: End-to-End Flow (ETL → D1 → Query → Frontend)

**Objective:** Verify complete data pipeline

**Test Steps:**

1. **Clear test data:**
```bash
wrangler d1 execute ace-iot-db --command="
DELETE FROM timeseries
WHERE timestamp >= unixepoch('2025-10-14T15:00:00Z') * 1000;
"
```

2. **Trigger ETL collection:**
```bash
curl -X POST http://localhost:8787/trigger \
  -d '{"start_time": "2025-10-14T15:00:00Z", "end_time": "2025-10-14T16:00:00Z"}'
```

3. **Verify data in D1:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT COUNT(*) as count
FROM timeseries
WHERE timestamp >= unixepoch('2025-10-14T15:00:00Z') * 1000;
"
```

4. **Query via Query Worker:**
```bash
curl -X GET "https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-14T15:00:00Z&end_time=2025-10-14T16:00:00Z&point_names=ses_falls_city.HVAC.VAV-707-DaTemp" \
  -H "X-ACE-Token: $ACE_TOKEN"
```

5. **Verify response time:**
```javascript
const startTs = performance.now();
const response = await fetch(url);
const duration = performance.now() - startTs;

console.assert(duration < 500, `Query time ${duration}ms exceeds 500ms SLA`);
```

6. **Test frontend chart rendering:**
```
Open: https://building-vitals.firebaseapp.com
Navigate to: Dashboard → ses_falls_city → HVAC Charts
Verify: Chart shows data for 2025-10-14 15:00-16:00
```

**Expected Results:**
- ✅ ETL collects data successfully
- ✅ Data visible in D1
- ✅ Query Worker returns <500ms
- ✅ Frontend charts render data
- ✅ Data accuracy: values match ACE API

**Validation Checklist:**
- [ ] ETL → D1: Data inserted
- [ ] D1 → Query: Fast retrieval
- [ ] Query → Frontend: API response valid
- [ ] Frontend: Charts display correctly
- [ ] End-to-end latency <5s

---

### Test 13: Error Handling & Recovery

**Objective:** Verify resilience to failures

#### Test 13a: API Timeout

**Setup:**
```bash
# Simulate slow API (mock or use proxy)
curl -X POST http://localhost:8787/trigger \
  --max-time 5 \
  -d '{"simulate_slow_api": true}'
```

**Expected Behavior:**
- ✅ Request timeout after 30s
- ✅ Retry with exponential backoff
- ✅ Max 3 retries
- ✅ Graceful failure if all retries fail
- ✅ Error logged to KV

#### Test 13b: D1 Write Failure

**Setup:**
```bash
# Simulate D1 error (temporarily corrupt binding)
curl -X POST http://localhost:8787/trigger \
  -d '{"simulate_db_error": true}'
```

**Expected Behavior:**
- ✅ Transaction rollback
- ✅ No partial data inserted
- ✅ Error logged with stack trace
- ✅ Checkpoint preserved (can resume)

#### Test 13c: Cursor Pagination Failure

**Setup:**
```bash
# Invalid cursor (should fail gracefully)
curl -X POST http://localhost:8787/trigger \
  -d '{"resume_from_cursor": "invalid_cursor_abc123"}'
```

**Expected Behavior:**
- ✅ Detect invalid cursor
- ✅ Restart from beginning (cursor=null)
- ✅ Log warning message
- ✅ Continue collection

**Validation Checklist:**
- [ ] Timeout handled gracefully
- [ ] Retries use exponential backoff
- [ ] Database errors rollback
- [ ] Checkpoints enable recovery
- [ ] Errors logged to KV for monitoring

---

## 4. Performance Benchmarks

### 4.1 Throughput Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Records/second** | >1000 | Monitor worker CPU time |
| **API requests** | <10/min | Monitor rate limiting |
| **D1 insert latency** | <200ms/batch | Monitor D1 execution time |
| **Memory usage** | <50 MB | Monitor worker heap size |
| **Total ETL cycle** | <5 min | Cron schedule: every 5 min |

### 4.2 Scalability Test

**Generate load test:**
```bash
# Trigger multiple concurrent ETL jobs
for i in {1..5}; do
  curl -X POST http://localhost:8787/trigger &
done
wait

# Check for race conditions
wrangler d1 execute ace-iot-db --command="
SELECT COUNT(*) as duplicates
FROM timeseries
GROUP BY point_id, timestamp
HAVING COUNT(*) > 1;
"
```

**Expected:**
- ✅ No duplicate timestamps
- ✅ No race conditions
- ✅ All 5 jobs complete successfully

---

## 5. Wrangler CLI Commands Reference

### 5.1 Development

```bash
# Start local worker with persistence
wrangler dev -c wrangler-etl.toml --local --persist

# Start with remote bindings (D1, KV)
wrangler dev -c wrangler-etl.toml --remote

# Tail live logs
wrangler tail -c wrangler-etl.toml --format=pretty

# Filter logs for errors
wrangler tail -c wrangler-etl.toml | grep ERROR
```

### 5.2 Database Operations

```bash
# View D1 data
wrangler d1 execute ace-iot-db --command="SELECT COUNT(*) FROM timeseries"

# Check recent inserts
wrangler d1 execute ace-iot-db --command="
SELECT p.name, COUNT(*) as samples
FROM timeseries ts
JOIN points p ON ts.point_id = p.id
WHERE ts.created_at > datetime('now', '-1 hour')
GROUP BY p.id, p.name
ORDER BY samples DESC
LIMIT 10;
"

# View table sizes
wrangler d1 execute ace-iot-db --command="
SELECT
  name,
  (SELECT COUNT(*) FROM timeseries) as timeseries_rows,
  (SELECT COUNT(*) FROM points) as points_rows;
"
```

### 5.3 KV Operations

```bash
# View ETL state
wrangler kv:key get --binding=ETL_STATE "checkpoint:ses_falls_city"

# List all keys
wrangler kv:key list --binding=ETL_STATE --prefix="checkpoint:"

# Clear checkpoint (force full resync)
wrangler kv:key delete --binding=ETL_STATE "checkpoint:ses_falls_city"
```

### 5.4 Deployment

```bash
# Deploy to production
wrangler deploy -c wrangler-etl.toml --env production

# Deploy to staging
wrangler deploy -c wrangler-etl.toml --env staging

# Verify deployment
wrangler deployments list -c wrangler-etl.toml

# Rollback if needed
wrangler rollback -c wrangler-etl.toml --message "Rollback to previous version"
```

### 5.5 Secrets Management

```bash
# Set ACE API key
wrangler secret put ACE_API_KEY -c wrangler-etl.toml

# List secrets (values not shown)
wrangler secret list -c wrangler-etl.toml

# Delete secret
wrangler secret delete ACE_API_KEY -c wrangler-etl.toml
```

---

## 6. Browser Console Verification

### 6.1 Frontend Data Validation

**Open browser console (F12) on Building Vitals app:**

```javascript
// Verify ETL data reached frontend
async function verifyETLData() {
  const token = localStorage.getItem('aceToken'); // or from IndexedDB
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${new Date(Date.now() - 60*60*1000).toISOString()}&` +
    `end_time=${new Date().toISOString()}&` +
    `point_names=ses_falls_city.HVAC.VAV-707-DaTemp`;

  const response = await fetch(url, {
    headers: { 'X-ACE-Token': token }
  });

  const data = await response.json();
  const samples = data.point_samples?.[0]?.samples || [];

  console.log('✅ ETL Verification:', {
    status: response.status,
    dataSource: response.headers.get('X-Data-Source'),
    sampleCount: samples.length,
    latestTimestamp: samples[samples.length - 1]?.time,
    latestValue: samples[samples.length - 1]?.val
  });

  // Check data freshness
  const latestTs = new Date(samples[samples.length - 1]?.time).getTime();
  const now = Date.now();
  const ageMinutes = (now - latestTs) / (1000 * 60);

  console.assert(ageMinutes < 10, `Data stale: ${ageMinutes.toFixed(0)} minutes old`);
  console.assert(samples.length > 0, 'No data returned');

  return { passed: ageMinutes < 10 && samples.length > 0 };
}

await verifyETLData();
```

### 6.2 Chart Rendering Test

```javascript
// Verify charts render with ETL data
function testChartRendering() {
  const charts = document.querySelectorAll('.echarts-container');

  console.log(`Found ${charts.length} charts on page`);

  charts.forEach((chart, idx) => {
    const echartsInstance = echarts.getInstanceByDom(chart);
    if (echartsInstance) {
      const option = echartsInstance.getOption();
      const seriesData = option.series?.[0]?.data || [];

      console.log(`Chart ${idx + 1}:`, {
        seriesCount: option.series?.length,
        dataPoints: seriesData.length,
        latestValue: seriesData[seriesData.length - 1]
      });

      console.assert(seriesData.length > 0, `Chart ${idx + 1} has no data`);
    }
  });
}

testChartRendering();
```

---

## 7. D1 Query Validation

### 7.1 Data Integrity Checks

```bash
# Check for duplicate timestamps (should be 0)
wrangler d1 execute ace-iot-db --command="
SELECT point_id, timestamp, COUNT(*) as duplicates
FROM timeseries
GROUP BY point_id, timestamp
HAVING COUNT(*) > 1;
"
```

**Expected:** `No rows returned` (no duplicates)

### 7.2 Data Freshness

```bash
# Check latest timestamp per point
wrangler d1 execute ace-iot-db --command="
SELECT
  p.name,
  datetime(MAX(ts.timestamp), 'unixepoch') as latest_sample,
  (unixepoch('now') - MAX(ts.timestamp)) / 60 as age_minutes
FROM timeseries ts
JOIN points p ON ts.point_id = p.id
GROUP BY p.id, p.name
ORDER BY age_minutes ASC
LIMIT 10;
"
```

**Expected:** `age_minutes < 10` (within last ETL cycle)

### 7.3 Sample Rate Validation

```bash
# Check samples per day (should be ~1440 for 1-min rate)
wrangler d1 execute ace-iot-db --command="
SELECT
  p.name,
  COUNT(*) as samples_today,
  COUNT(*) / 1440.0 as coverage_ratio
FROM timeseries ts
JOIN points p ON ts.point_id = p.id
WHERE ts.timestamp >= unixepoch('now', 'start of day')
GROUP BY p.id, p.name
ORDER BY samples_today DESC
LIMIT 5;
"
```

**Expected:** `coverage_ratio ≈ 1.0` (100% coverage)

---

## 8. Rollback Procedures

### If Tests Fail - Rollback Steps

**1. Identify failure mode:**
- API errors → Check ACE API key
- D1 errors → Check schema migration
- Performance → Rollback to previous version

**2. Stop current deployment:**
```bash
# Disable cron trigger
wrangler triggers disable -c wrangler-etl.toml

# Verify cron stopped
wrangler deployments list -c wrangler-etl.toml
```

**3. Rollback to previous version:**
```bash
# List previous deployments
wrangler deployments list -c wrangler-etl.toml

# Rollback to specific version
wrangler rollback -c wrangler-etl.toml \
  --version-id <previous-version-id> \
  --message "Rollback due to test failures"
```

**4. Verify rollback:**
```bash
# Check current version
wrangler deployments list -c wrangler-etl.toml | head -n 3

# Test rolled-back worker
curl -X GET http://localhost:8787/health
```

**5. Clean up failed data (if partial insert):**
```bash
# Identify corrupted timestamp range
wrangler d1 execute ace-iot-db --command="
SELECT MIN(timestamp) as first_bad, MAX(timestamp) as last_bad
FROM timeseries
WHERE created_at > datetime('now', '-10 minutes');
"

# Delete failed inserts
wrangler d1 execute ace-iot-db --command="
DELETE FROM timeseries
WHERE timestamp BETWEEN <first_bad> AND <last_bad>;
"
```

**6. Document incident:**
```markdown
## Rollback Incident Report

**Date:** 2025-10-14
**Time:** 12:05 UTC
**Reason:** [Test X failed - describe issue]
**Action:** Rolled back to version [version-id]
**Data Impact:** [X records deleted/retained]
**Next Steps:** [Fix and retest]
```

---

## 9. Success Criteria

### Must Pass (Blockers)

- ✅ **Test 1:** Single-page pagination works
- ✅ **Test 2:** Multi-page pagination handles cursors
- ✅ **Test 6:** Worker-side filtering retains only configured points
- ✅ **Test 8:** D1 batch insert succeeds
- ✅ **Test 9:** D1 schema compliance (data types match)
- ✅ **Test 12:** End-to-end flow (ETL → D1 → Query → Frontend)

### Should Pass (Quality)

- ✅ **Test 3:** Empty responses handled gracefully
- ✅ **Test 4:** Authentication errors detected
- ✅ **Test 5:** Weather data collected and stored
- ✅ **Test 10:** Timestamp conversion correct (ms → seconds)
- ✅ **Test 13:** Error recovery mechanisms work

### Performance Targets

- ✅ Processing throughput: >1000 records/second
- ✅ D1 insert latency: <200ms per batch
- ✅ Memory usage: <50 MB per worker invocation
- ✅ Total ETL cycle: <5 minutes (aligns with cron)

---

## 10. Test Execution Checklist

### Pre-Deployment Testing (Local)

- [ ] Configure `wrangler-etl.toml` with correct bindings
- [ ] Set `ACE_API_KEY` secret
- [ ] Run `wrangler dev --local --persist`
- [ ] Execute Tests 1-13 locally
- [ ] Verify all D1 queries return expected data
- [ ] Check worker logs for errors

### Staging Deployment

- [ ] Deploy to staging: `wrangler deploy -c wrangler-etl.toml --env staging`
- [ ] Run Tests 1-13 against staging
- [ ] Monitor for 24 hours
- [ ] Verify cron triggers execute every 5 minutes
- [ ] Check D1 data accumulation

### Production Deployment

- [ ] Deploy to production: `wrangler deploy -c wrangler-etl.toml --env production`
- [ ] Run smoke tests (Tests 1, 2, 12)
- [ ] Monitor for 48 hours
- [ ] Set up alerting (error rate >1%)
- [ ] Document operational procedures

---

## 11. Known Issues & Workarounds

### Issue 1: Schema Mismatch (timeseries vs timeseries_raw)

**Problem:** Documentation references `timeseries_raw` but schema uses `timeseries`

**Workaround:** Verify active table name before testing
```bash
wrangler d1 execute ace-iot-db --command="
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'timeseries%';
"
```

**Resolution:** Update ETL worker to use correct table name

### Issue 2: Timestamp Format Inconsistency

**Problem:** API may return ISO 8601 or Unix milliseconds

**Workaround:** ETL worker should detect and convert both formats
```javascript
function parseTimestamp(ts) {
  if (typeof ts === 'string') {
    return Math.floor(new Date(ts).getTime() / 1000); // ISO → seconds
  } else if (ts > 1e12) {
    return Math.floor(ts / 1000); // ms → seconds
  } else {
    return ts; // already seconds
  }
}
```

### Issue 3: Point ID Lookup Performance

**Problem:** Converting point names to IDs requires lookup per record

**Workaround:** Cache point name → ID mapping in memory
```javascript
const pointCache = new Map();

async function getPointId(pointName) {
  if (pointCache.has(pointName)) {
    return pointCache.get(pointName);
  }

  const result = await env.DB.prepare(
    'SELECT id FROM points WHERE name = ?'
  ).bind(pointName).first();

  if (result) {
    pointCache.set(pointName, result.id);
    return result.id;
  }

  // Create new point if not exists
  const insertResult = await env.DB.prepare(
    'INSERT INTO points (name, data_type) VALUES (?, ?)'
  ).bind(pointName, 'analog').run();

  pointCache.set(pointName, insertResult.lastRowId);
  return insertResult.lastRowId;
}
```

---

## 12. Next Steps

### Immediate Actions

1. **Configure Environment:**
   - Set `ACE_API_KEY` secret
   - Update `wrangler-etl.toml` with correct D1/KV IDs
   - Verify configured points list

2. **Run Local Tests:**
   - Execute Tests 1-13 locally
   - Fix any failures
   - Document results

3. **Deploy to Staging:**
   - `wrangler deploy -c wrangler-etl.toml --env staging`
   - Monitor for 24 hours
   - Run regression tests

### Follow-Up Testing (After Backfill)

4. **Historical Data Validation:**
   - Verify R2 backfill completes
   - Test split queries (D1 + R2)
   - Validate data continuity at 20-day boundary

5. **Production Monitoring:**
   - Set up alerting (Sentry, Datadog, etc.)
   - Monitor ETL success rate
   - Track data freshness metrics

---

## Document Control

**Version History:**
- v1.0 (2025-10-14): Initial test plan created

**Next Review:** After ETL worker implementation complete

**Owner:** Testing Agent (SPARC Methodology)

**Related Documents:**
- `etl-worker-refactor-architecture.md` (Architecture)
- `query-worker-test-plan.md` (Query Worker Testing)
- `001_initial_schema.sql` (D1 Schema)
- `wrangler-etl.toml` (Worker Configuration)

---

**END OF TEST PLAN**
