# ETL Pipeline Validation Test Scenarios

## Overview
This document contains comprehensive test scenarios to validate the ETL pipeline with 48-hour data delay implementation, ensuring data integrity, deduplication, and proper incremental synchronization.

---

## 1. Time Range Calculation Tests

### Test 1.1: First Sync - Initial Data Load
**Objective:** Verify first sync retrieves existing data from exactly 48 hours ago.

**Setup:**
```javascript
// Mock state
const lastSyncTimestamp = null; // First run
const currentTime = new Date('2025-10-15T14:00:00Z');
```

**Expected Behavior:**
```javascript
// Time calculations
const endTime = new Date(currentTime - (48 * 60 * 60 * 1000));
// endTime = '2025-10-13T14:00:00Z'

const startTime = endTime; // Same as endTime for first sync
// startTime = '2025-10-13T14:00:00Z'

// This should return a snapshot of data at exactly 48h ago
```

**Validation:**
- ✓ `startTime === endTime` (first sync point-in-time)
- ✓ Both timestamps are exactly 48 hours before current time
- ✓ API call returns data at/before that timestamp
- ✓ D1 database receives initial data set

**Manual Test:**
```bash
# Set current time in test
curl -X POST http://localhost:8787/api/etl/manual-trigger \
  -H "Content-Type: application/json" \
  -d '{
    "testMode": true,
    "currentTime": "2025-10-15T14:00:00Z",
    "lastSync": null
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "mode": "first_sync",
  "timeRange": {
    "start": "2025-10-13T14:00:00.000Z",
    "end": "2025-10-13T14:00:00.000Z"
  },
  "recordsProcessed": 150,
  "newRecords": 150
}
```

---

### Test 1.2: Incremental Sync - Normal Operation
**Objective:** Verify incremental sync retrieves only new data since last sync.

**Setup:**
```javascript
// Mock state
const lastSyncTimestamp = '2025-10-13T14:00:00Z'; // Previous sync
const currentTime = new Date('2025-10-15T16:00:00Z'); // 2h later
```

**Expected Behavior:**
```javascript
// Time calculations
const endTime = new Date(currentTime - (48 * 60 * 60 * 1000));
// endTime = '2025-10-13T16:00:00Z' (48h ago from now)

const startTime = new Date(lastSyncTimestamp);
// startTime = '2025-10-13T14:00:00Z' (last sync)

// This should return data between lastSync and 48h-ago window
// Time range: 14:00 to 16:00 (2 hours of data)
```

**Validation:**
- ✓ `startTime === lastSyncTimestamp`
- ✓ `endTime === currentTime - 48h`
- ✓ `endTime > startTime` (2-hour gap)
- ✓ No duplicate timestamps in results
- ✓ D1 database count increases by new records only

**Manual Test:**
```bash
curl -X POST http://localhost:8787/api/etl/manual-trigger \
  -H "Content-Type: application/json" \
  -d '{
    "testMode": true,
    "currentTime": "2025-10-15T16:00:00Z",
    "lastSync": "2025-10-13T14:00:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "mode": "incremental_sync",
  "timeRange": {
    "start": "2025-10-13T14:00:00.000Z",
    "end": "2025-10-13T16:00:00.000Z"
  },
  "recordsProcessed": 20,
  "newRecords": 20,
  "duplicatesSkipped": 0
}
```

---

### Test 1.3: No New Data Available
**Objective:** Verify system handles case when no new data exists (sync too frequent).

**Setup:**
```javascript
const lastSyncTimestamp = '2025-10-13T16:00:00Z';
const currentTime = new Date('2025-10-15T16:05:00Z'); // Only 5 min later
```

**Expected Behavior:**
```javascript
const endTime = new Date(currentTime - (48 * 60 * 60 * 1000));
// endTime = '2025-10-13T16:05:00Z'

const startTime = new Date(lastSyncTimestamp);
// startTime = '2025-10-13T16:00:00Z'

// Time range is only 5 minutes - likely no new data
```

**Validation:**
- ✓ API call completes successfully
- ✓ Returns empty or minimal data set
- ✓ No errors thrown
- ✓ `lastSyncTimestamp` updated to new endTime
- ✓ D1 database count unchanged or minimal increase

---

### Test 1.4: Large Time Gap - Catch Up Sync
**Objective:** Verify system handles large gaps (e.g., after downtime).

**Setup:**
```javascript
const lastSyncTimestamp = '2025-10-12T10:00:00Z'; // 2 days ago
const currentTime = new Date('2025-10-15T14:00:00Z');
```

**Expected Behavior:**
```javascript
const endTime = new Date(currentTime - (48 * 60 * 60 * 1000));
// endTime = '2025-10-13T14:00:00Z'

const startTime = new Date(lastSyncTimestamp);
// startTime = '2025-10-12T10:00:00Z'

// Time range: 28 hours of data to catch up
```

**Validation:**
- ✓ Large time range handled correctly
- ✓ Pagination works for large datasets
- ✓ All data points between start/end retrieved
- ✓ No timeout errors
- ✓ D1 database receives all historical data

---

## 2. API Integration Tests

### Test 2.1: ACE API Timeseries Endpoint
**Objective:** Validate API calls with proper timestamp formatting.

**API Endpoint:**
```
GET https://ace-server.com/api/timeseries/paginated
```

**Request Parameters:**
```bash
curl -X GET "https://ace-server.com/api/timeseries/paginated" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -G \
  --data-urlencode "startTime=2025-10-13T14:00:00.000Z" \
  --data-urlencode "endTime=2025-10-13T16:00:00.000Z" \
  --data-urlencode "pointNames=BLDG01.TEMP_001,BLDG01.TEMP_002" \
  --data-urlencode "page=1" \
  --data-urlencode "pageSize=1000"
```

**Expected Response:**
```json
{
  "data": [
    {
      "siteName": "BLDG01",
      "pointName": "TEMP_001",
      "timestamp": "2025-10-13T14:00:00.000Z",
      "value": 72.5,
      "unit": "degF"
    },
    {
      "siteName": "BLDG01",
      "pointName": "TEMP_001",
      "timestamp": "2025-10-13T14:15:00.000Z",
      "value": 72.8,
      "unit": "degF"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalRecords": 2500,
    "hasMore": true
  }
}
```

**Validation:**
- ✓ ISO 8601 timestamp format accepted
- ✓ UTC timezone properly handled
- ✓ Response contains expected fields
- ✓ Timestamps are within requested range
- ✓ Pagination metadata present

---

### Test 2.2: Pagination Handling
**Objective:** Verify system processes all pages of large datasets.

**Scenario:**
```javascript
// Mock API returns 5000 records across 5 pages (1000 per page)
const totalRecords = 5000;
const pageSize = 1000;
const expectedPages = 5;
```

**Manual Test:**
```bash
# Simulate large dataset sync
curl -X POST http://localhost:8787/api/etl/manual-trigger \
  -H "Content-Type: application/json" \
  -d '{
    "testMode": true,
    "mockLargeDataset": true,
    "expectedRecords": 5000
  }'
```

**Validation:**
- ✓ All 5 pages requested
- ✓ Total 5000 records received
- ✓ No duplicate records across pages
- ✓ Correct `page` parameter increments
- ✓ Loop terminates when `hasMore === false`

---

### Test 2.3: ISO 8601 Format Conversion
**Objective:** Verify timestamp format conversions are correct.

**Test Cases:**
```javascript
// JavaScript Date to ISO 8601
const jsDate = new Date('2025-10-13T14:00:00Z');
const isoString = jsDate.toISOString();
// Expected: "2025-10-13T14:00:00.000Z"

// ACE API format to D1 storage
const aceTimestamp = "2025-10-13T14:00:00.000Z";
const d1Timestamp = new Date(aceTimestamp).getTime();
// Expected: 1728826800000 (Unix milliseconds)

// D1 storage to chart display
const chartTimestamp = new Date(d1Timestamp).toLocaleString();
// Expected: "10/13/2025, 2:00:00 PM"
```

**Validation:**
- ✓ No timezone shifts (UTC preserved)
- ✓ Millisecond precision maintained
- ✓ Parsing/formatting bidirectional
- ✓ Chart components display correct times

---

### Test 2.4: Error Handling
**Objective:** Verify graceful handling of API errors.

**Error Scenarios:**

1. **Authentication Failure:**
```bash
curl -X GET "https://ace-server.com/api/timeseries/paginated" \
  -H "Authorization: Bearer INVALID_TOKEN"
```
Expected: 401 Unauthorized, ETL retries with backoff

2. **Rate Limiting:**
```bash
# Expected: 429 Too Many Requests
```
Expected: ETL pauses and retries after delay

3. **Network Timeout:**
```bash
# Simulate 30-second timeout
```
Expected: ETL logs error, marks sync as failed, retries next scheduled run

4. **Invalid Date Range:**
```bash
curl -X GET "https://ace-server.com/api/timeseries/paginated" \
  -G \
  --data-urlencode "startTime=invalid-date"
```
Expected: 400 Bad Request, ETL logs validation error

**Validation:**
- ✓ Errors logged with context
- ✓ Partial data not committed
- ✓ System remains operational
- ✓ Next scheduled sync proceeds normally

---

## 3. D1 Storage Tests

### Test 3.1: Primary Key Deduplication
**Objective:** Verify composite PRIMARY KEY prevents duplicate records.

**Table Schema:**
```sql
CREATE TABLE IF NOT EXISTS timeseries_data (
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  PRIMARY KEY (site_name, point_name, timestamp)
);
```

**Test Case 1: Insert Duplicate Record**
```sql
-- First insert
INSERT INTO timeseries_data (site_name, point_name, timestamp, value, unit)
VALUES ('BLDG01', 'TEMP_001', 1728826800000, 72.5, 'degF');
-- Result: 1 row inserted

-- Attempt duplicate insert
INSERT INTO timeseries_data (site_name, point_name, timestamp, value, unit)
VALUES ('BLDG01', 'TEMP_001', 1728826800000, 72.5, 'degF');
-- Expected: UNIQUE constraint failed error
```

**Validation:**
- ✓ Second insert fails with constraint error
- ✓ Row count remains 1
- ✓ Original data unchanged

---

### Test 3.2: INSERT OR REPLACE Behavior
**Objective:** Verify upsert logic handles duplicates gracefully.

**Test Case: Update Existing Timestamp**
```sql
-- Initial insert
INSERT OR REPLACE INTO timeseries_data
  (site_name, point_name, timestamp, value, unit)
VALUES ('BLDG01', 'TEMP_001', 1728826800000, 72.5, 'degF');
-- Result: 1 row inserted

-- Upsert with new value (same timestamp)
INSERT OR REPLACE INTO timeseries_data
  (site_name, point_name, timestamp, value, unit)
VALUES ('BLDG01', 'TEMP_001', 1728826800000, 73.2, 'degF');
-- Result: 1 row updated (replaced)

-- Verify final state
SELECT * FROM timeseries_data
WHERE site_name = 'BLDG01'
  AND point_name = 'TEMP_001'
  AND timestamp = 1728826800000;
```

**Expected Result:**
```json
{
  "site_name": "BLDG01",
  "point_name": "TEMP_001",
  "timestamp": 1728826800000,
  "value": 73.2,
  "unit": "degF"
}
```

**Validation:**
- ✓ Row count remains 1 (not 2)
- ✓ Latest value preserved (73.2)
- ✓ No duplicate timestamps exist

---

### Test 3.3: Sample Count Monotonic Growth
**Objective:** Verify total record count increases monotonically.

**Test Sequence:**
```sql
-- Initial count
SELECT COUNT(*) as count FROM timeseries_data;
-- Result: count = 0

-- After first sync (100 records)
SELECT COUNT(*) as count FROM timeseries_data;
-- Result: count = 100

-- After incremental sync (20 new records)
SELECT COUNT(*) as count FROM timeseries_data;
-- Result: count = 120

-- After sync with duplicates (15 new, 5 duplicate)
SELECT COUNT(*) as count FROM timeseries_data;
-- Result: count = 135 (not 140)
```

**Validation:**
- ✓ Count never decreases
- ✓ Count increases only by unique records
- ✓ Duplicates don't inflate count

---

### Test 3.4: Query Performance with Indexes
**Objective:** Verify query performance remains fast as data grows.

**Create Index:**
```sql
CREATE INDEX IF NOT EXISTS idx_site_point_time
ON timeseries_data(site_name, point_name, timestamp DESC);
```

**Performance Test:**
```sql
-- Query last 24 hours of data for a point
EXPLAIN QUERY PLAN
SELECT timestamp, value
FROM timeseries_data
WHERE site_name = 'BLDG01'
  AND point_name = 'TEMP_001'
  AND timestamp >= 1728826800000
ORDER BY timestamp DESC
LIMIT 1000;
```

**Expected Query Plan:**
```
SEARCH TABLE timeseries_data USING INDEX idx_site_point_time
(site_name=? AND point_name=? AND timestamp>?)
```

**Validation:**
- ✓ Query uses index (not full table scan)
- ✓ Response time < 100ms for 10K records
- ✓ Response time < 500ms for 1M records

---

## 4. End-to-End Data Flow Tests

### Test 4.1: Complete Pipeline Flow
**Objective:** Validate data flows correctly through all system components.

**Flow Diagram:**
```
ACE API → ETL Worker → D1 Database → Query Worker → Chart Components
```

**Test Steps:**

1. **ETL Worker Execution:**
```bash
# Trigger manual ETL sync
curl -X POST http://localhost:8787/api/etl/trigger \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

2. **Verify D1 Storage:**
```bash
# Query D1 directly
curl -X POST http://localhost:8787/api/debug/d1-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT COUNT(*) as count FROM timeseries_data"
  }'
```

3. **Query Worker Retrieval:**
```bash
# Fetch data via Query Worker
curl -X GET "http://localhost:8787/api/data/timeseries" \
  -G \
  --data-urlencode "site=BLDG01" \
  --data-urlencode "point=TEMP_001" \
  --data-urlencode "hours=24"
```

4. **Chart Component Rendering:**
```javascript
// Frontend test
fetch('/api/data/timeseries?site=BLDG01&point=TEMP_001&hours=24')
  .then(res => res.json())
  .then(data => {
    // Verify data format
    console.assert(Array.isArray(data));
    console.assert(data[0].hasOwnProperty('timestamp'));
    console.assert(data[0].hasOwnProperty('value'));
  });
```

**Validation:**
- ✓ Data present in each stage
- ✓ Record count matches across stages
- ✓ Timestamp format correct at each stage
- ✓ Chart displays data points
- ✓ No data loss in transformations

---

### Test 4.2: Data Format Transformations
**Objective:** Verify data format consistency through pipeline stages.

**Stage 1: ACE API Response**
```json
{
  "siteName": "BLDG01",
  "pointName": "TEMP_001",
  "timestamp": "2025-10-13T14:00:00.000Z",
  "value": 72.5,
  "unit": "degF"
}
```

**Stage 2: D1 Storage Format**
```sql
site_name: "BLDG01"
point_name: "TEMP_001"
timestamp: 1728826800000  -- Unix milliseconds
value: 72.5
unit: "degF"
```

**Stage 3: Query Worker Response**
```json
{
  "site": "BLDG01",
  "point": "TEMP_001",
  "data": [
    {
      "t": 1728826800000,
      "v": 72.5
    }
  ],
  "unit": "degF"
}
```

**Stage 4: Chart Component Format**
```javascript
{
  label: "BLDG01 - TEMP_001",
  data: [
    { x: new Date(1728826800000), y: 72.5 }
  ],
  unit: "degF"
}
```

**Validation:**
- ✓ Site/point names consistent (camelCase vs snake_case)
- ✓ Timestamp formats handled correctly
- ✓ Value precision maintained (no rounding errors)
- ✓ Units preserved throughout pipeline

---

### Test 4.3: Chart Rendering with Accumulated Data
**Objective:** Verify charts display accumulated data correctly over time.

**Test Scenario:**
```javascript
// Day 1: Initial sync (100 records)
// Day 2: Incremental sync (+50 records, total 150)
// Day 3: Incremental sync (+30 records, total 180)
```

**Chart Data Validation:**
```bash
# Day 1 chart
curl -X GET "http://localhost:8787/api/data/timeseries?hours=24" \
  | jq '.data | length'
# Expected: 100

# Day 2 chart (same query)
curl -X GET "http://localhost:8787/api/data/timeseries?hours=48" \
  | jq '.data | length'
# Expected: 150

# Day 3 chart
curl -X GET "http://localhost:8787/api/data/timeseries?hours=72" \
  | jq '.data | length'
# Expected: 180
```

**Validation:**
- ✓ Chart shows cumulative data
- ✓ No gaps in timeline
- ✓ Data points ordered chronologically
- ✓ Chart updates reflect new data
- ✓ Historical data remains accessible

---

### Test 4.4: Real-Time Dashboard Update
**Objective:** Verify dashboard reflects latest ETL sync.

**Test Steps:**

1. **Initial Dashboard State:**
```bash
# Check current sample count
curl -X GET http://localhost:8787/api/stats/summary
```
Response:
```json
{
  "totalSamples": 1000,
  "lastSync": "2025-10-13T14:00:00Z",
  "dataPoints": 1000
}
```

2. **Trigger ETL Sync:**
```bash
curl -X POST http://localhost:8787/api/etl/trigger
```

3. **Wait for Completion (30 seconds)**

4. **Verify Updated Dashboard:**
```bash
curl -X GET http://localhost:8787/api/stats/summary
```
Response:
```json
{
  "totalSamples": 1050,
  "lastSync": "2025-10-13T16:00:00Z",
  "dataPoints": 1050
}
```

**Validation:**
- ✓ Sample count increased by 50
- ✓ `lastSync` timestamp updated
- ✓ Dashboard shows new data without refresh
- ✓ Charts display updated trends

---

## 5. Manual Validation Commands

### Database Inspection
```bash
# Connect to D1 database
wrangler d1 execute building-vitals-db --command "SELECT COUNT(*) FROM timeseries_data"

# View recent records
wrangler d1 execute building-vitals-db --command "
SELECT site_name, point_name, timestamp, value
FROM timeseries_data
ORDER BY timestamp DESC
LIMIT 10
"

# Check for duplicates
wrangler d1 execute building-vitals-db --command "
SELECT site_name, point_name, timestamp, COUNT(*) as count
FROM timeseries_data
GROUP BY site_name, point_name, timestamp
HAVING count > 1
"
```

### ETL Worker Logs
```bash
# View worker logs
wrangler tail --format pretty

# Filter ETL-specific logs
wrangler tail --format json | jq 'select(.message | contains("ETL"))'
```

### API Testing
```bash
# Test manual ETL trigger
curl -X POST http://localhost:8787/api/etl/trigger \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -v

# Test time range calculation
curl -X GET "http://localhost:8787/api/debug/time-range" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Expected response:
{
  "currentTime": "2025-10-15T14:00:00Z",
  "endTime": "2025-10-13T14:00:00Z",
  "delayHours": 48,
  "lastSync": "2025-10-13T12:00:00Z"
}
```

---

## 6. Success Criteria

### Critical Requirements
- [ ] Time range calculations produce correct 48-hour delay
- [ ] First sync retrieves snapshot at 48h-ago point
- [ ] Incremental syncs fetch only new data (no duplicates)
- [ ] D1 PRIMARY KEY prevents duplicate records
- [ ] INSERT OR REPLACE handles edge cases gracefully
- [ ] Sample count grows monotonically
- [ ] All pipeline stages preserve data integrity

### Performance Requirements
- [ ] ETL sync completes within 2 minutes (10K records)
- [ ] Database queries respond < 100ms (10K records)
- [ ] API pagination handles 100K+ records without timeout
- [ ] Charts render without lag (1K data points)

### Reliability Requirements
- [ ] System recovers from API failures
- [ ] No data loss during errors
- [ ] Duplicate detection 100% effective
- [ ] Scheduled syncs execute consistently
- [ ] Cross-timezone handling accurate

---

## 7. Test Execution Checklist

### Pre-Flight Checks
- [ ] D1 database schema deployed
- [ ] Environment variables configured (ACE_API_KEY, etc.)
- [ ] Workers deployed to staging environment
- [ ] Test data available in ACE API

### Test Execution Order
1. [ ] Unit tests (time calculations)
2. [ ] API integration tests
3. [ ] D1 storage tests
4. [ ] End-to-end pipeline tests
5. [ ] Performance tests
6. [ ] Error handling tests

### Post-Test Validation
- [ ] Review all test logs
- [ ] Verify no unexpected errors
- [ ] Confirm data integrity
- [ ] Document any issues found
- [ ] Update configuration if needed

---

## 8. Troubleshooting Guide

### Issue: Duplicate Records in Database
**Diagnosis:**
```sql
SELECT site_name, point_name, timestamp, COUNT(*)
FROM timeseries_data
GROUP BY site_name, point_name, timestamp
HAVING COUNT(*) > 1;
```
**Solution:** Verify PRIMARY KEY constraint exists, check INSERT OR REPLACE logic.

### Issue: Missing Data Gaps
**Diagnosis:**
```sql
-- Check for timestamp gaps > 15 minutes
WITH ordered_data AS (
  SELECT timestamp,
         LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp
  FROM timeseries_data
  WHERE site_name = 'BLDG01' AND point_name = 'TEMP_001'
)
SELECT * FROM ordered_data
WHERE (timestamp - prev_timestamp) > 900000; -- 15 min in ms
```
**Solution:** Check ETL logs for failures during gap period.

### Issue: Time Range Calculation Incorrect
**Diagnosis:**
```javascript
console.log({
  currentTime: new Date(),
  endTime: new Date(Date.now() - 48*60*60*1000),
  lastSync: lastSyncTimestamp
});
```
**Solution:** Verify timezone handling (UTC), check Date arithmetic.

---

## Appendix A: Sample Test Data

### Mock ACE API Response
```json
{
  "data": [
    {"siteName": "BLDG01", "pointName": "TEMP_001", "timestamp": "2025-10-13T14:00:00Z", "value": 72.5, "unit": "degF"},
    {"siteName": "BLDG01", "pointName": "TEMP_001", "timestamp": "2025-10-13T14:15:00Z", "value": 72.8, "unit": "degF"},
    {"siteName": "BLDG01", "pointName": "TEMP_002", "timestamp": "2025-10-13T14:00:00Z", "value": 68.2, "unit": "degF"},
    {"siteName": "BLDG02", "pointName": "HUM_001", "timestamp": "2025-10-13T14:00:00Z", "value": 45.0, "unit": "%RH"}
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalRecords": 4,
    "hasMore": false
  }
}
```

---

## Appendix B: SQL Test Scripts

```sql
-- Reset database for testing
DELETE FROM timeseries_data;
DELETE FROM etl_metadata;

-- Insert test data
INSERT OR REPLACE INTO timeseries_data (site_name, point_name, timestamp, value, unit)
VALUES
  ('BLDG01', 'TEMP_001', 1728826800000, 72.5, 'degF'),
  ('BLDG01', 'TEMP_001', 1728827700000, 72.8, 'degF'),
  ('BLDG01', 'TEMP_002', 1728826800000, 68.2, 'degF');

-- Verify test data
SELECT COUNT(*) as total_records FROM timeseries_data;
SELECT * FROM timeseries_data ORDER BY timestamp DESC;
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**Author:** Building Vitals ETL Team
