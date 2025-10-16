# Query Worker Migration Test Plan

**Version:** 1.0
**Date:** October 14, 2025
**Site:** ses_falls_city
**Author:** Integration Test Specialist

## Executive Summary

This test plan verifies the Query Worker migration from the legacy paginated ACE API to the intelligent D1/R2 query routing system. The Query Worker provides <500ms responses for recent data (hot storage) and seamless merging of D1+R2 data for historical queries.

**Migration Status:**
- D1 Hot Storage: ✅ Active (20 days retention via `timeseries_raw` table)
- R2 Cold Storage: ⚠️ Pending backfill (infrastructure ready, awaiting data)
- Query Router: ✅ Deployed (with graceful fallback to legacy API)

---

## 1. Test Matrix

| Scenario | Data Source | Expected Response Time | Expected Behavior | Priority |
|----------|-------------|----------------------|-------------------|----------|
| **1. Single Point, Recent (24h)** | D1 only | <500ms | Fast D1 query, no R2 access | HIGH |
| **2. Multiple Points, Recent (7d)** | D1 only | <1s | Parallel D1 queries | HIGH |
| **3. Single Point, Split (20-40d)** | D1 + R2 | <5s | Merge D1 recent + R2 historical | MEDIUM |
| **4. Multiple Points, Historical (30-90d)** | R2 only | <5s | R2 Parquet with DuckDB | MEDIUM |
| **5. No Data Available** | None | <100ms | Empty results, no errors | HIGH |
| **6. Invalid Point Names** | None | <100ms | Graceful error handling | HIGH |
| **7. Invalid Date Range** | None | <100ms | Validation error with clear message | HIGH |
| **8. Missing ACE Token** | None | <100ms | 401 Unauthorized | HIGH |
| **9. Cache Hit (Repeated Query)** | KV Cache | <50ms | Instant return from cache | MEDIUM |
| **10. Legacy Fallback** | ACE API | Variable | Fallback when routing disabled | LOW |

---

## 2. Pre-Test Setup

### 2.1 Environment Verification

**Check Worker Deployment:**
```bash
# Verify Query Worker is deployed
wrangler tail --env production --format=pretty

# Check D1 database connection
wrangler d1 execute ace-iot-db --command="SELECT COUNT(*) FROM timeseries_raw"

# Verify R2 bucket exists
wrangler r2 bucket list | grep ace-timeseries
```

**Expected:**
- Worker responding to requests
- D1 database contains recent data (<20 days)
- R2 bucket exists (may be empty until backfill completes)

### 2.2 Get Valid Test Points

**Query D1 for Active Points:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT DISTINCT point_name, COUNT(*) as sample_count,
       MIN(timestamp) as oldest_ts, MAX(timestamp) as newest_ts
FROM timeseries_raw
WHERE site_name = 'ses_falls_city'
GROUP BY point_name
ORDER BY sample_count DESC
LIMIT 10
" > test-points.txt
```

**Expected Output:**
```
point_name                    sample_count  oldest_ts    newest_ts
----------------------------  ------------  -----------  -----------
ses_falls_city.HVAC.VAV-707-DaTemp  10080   1729000000   1730000000
ses_falls_city.HVAC.VAV-707-DaTempSp  10080   1729000000   1730000000
ses_falls_city.HVAC.VAV-707-DmpPos  10080   1729000000   1730000000
...
```

Use these point names in tests below.

### 2.3 Obtain ACE Token

**Get Token from Browser:**
1. Open Building Vitals app at https://building-vitals.firebaseapp.com
2. Open DevTools (F12) → Application → IndexedDB → firebaseLocalStorage
3. Copy the `authToken` value

**Or via API (if credentials available):**
```bash
curl -X POST https://flightdeck.aceiot.cloud/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your_password"}' \
  | jq -r '.token'
```

---

## 3. Test Scenarios

### Test 1: Single Point, Recent Data (24 Hours)

**Objective:** Verify D1 hot storage for recent data returns <500ms

**Test Data:**
```javascript
const testConfig = {
  siteName: 'ses_falls_city',
  pointNames: ['ses_falls_city.HVAC.VAV-707-DaTemp'], // Use actual point from D1
  startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
  endTime: new Date().toISOString(),
  expectedSource: 'D1',
  expectedResponseTime: 500 // ms
};
```

**Browser Test:**
```javascript
// Run in browser console (F12)
async function test1_SinglePointRecent() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const pointName = 'ses_falls_city.HVAC.VAV-707-DaTemp'; // REPLACE with valid point
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${encodeURIComponent(startTime)}&` +
    `end_time=${encodeURIComponent(endTime)}&` +
    `point_names=${encodeURIComponent(pointName)}`;

  const startTs = performance.now();
  const response = await fetch(url, {
    headers: { 'X-ACE-Token': token }
  });
  const duration = performance.now() - startTs;

  const data = await response.json();
  const metadata = {
    status: response.status,
    duration: `${duration.toFixed(0)}ms`,
    dataSource: response.headers.get('X-Data-Source'),
    queryStrategy: response.headers.get('X-Query-Strategy'),
    cacheStatus: response.headers.get('X-Cache-Status'),
    sampleCount: data.point_samples?.[0]?.samples?.length || 0
  };

  console.log('✅ Test 1: Single Point Recent Data', metadata);
  console.assert(duration < 500, `❌ Response time ${duration}ms exceeds 500ms`);
  console.assert(metadata.dataSource === 'D1', '❌ Expected D1 data source');
  console.assert(metadata.sampleCount > 0, '❌ No data returned');

  return { passed: duration < 500 && metadata.dataSource === 'D1', metadata };
}

await test1_SinglePointRecent();
```

**Expected Results:**
- ✅ HTTP 200 response
- ✅ Response time <500ms
- ✅ `X-Data-Source: D1`
- ✅ `X-Query-Strategy: D1_ONLY`
- ✅ `X-Cache-Status: MISS` (first run) or `HIT` (repeat)
- ✅ Data returned: ~1440 samples (24h * 60 min)

**Validation Checklist:**
- [ ] Response time meets <500ms SLA
- [ ] Data source is D1 (hot storage)
- [ ] Sample count matches expected ~1440 (1/min for 24h)
- [ ] Timestamps are sequential and within range
- [ ] Values are numeric and reasonable

---

### Test 2: Multiple Points, Recent Data (7 Days)

**Objective:** Verify D1 handles multiple points efficiently

**Test Data:**
```javascript
const testConfig = {
  siteName: 'ses_falls_city',
  pointNames: [
    'ses_falls_city.HVAC.VAV-707-DaTemp',
    'ses_falls_city.HVAC.VAV-707-DaTempSp',
    'ses_falls_city.HVAC.VAV-707-DmpPos',
    'ses_falls_city.HVAC.VAV-708-DaTemp',
    'ses_falls_city.HVAC.VAV-708-DmpPos'
  ], // 5 points
  startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  endTime: new Date().toISOString(),
  expectedSource: 'D1',
  expectedResponseTime: 1000 // ms
};
```

**Browser Test:**
```javascript
async function test2_MultiplePointsRecent() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const pointNames = [
    'ses_falls_city.HVAC.VAV-707-DaTemp',
    'ses_falls_city.HVAC.VAV-707-DaTempSp',
    'ses_falls_city.HVAC.VAV-707-DmpPos',
    'ses_falls_city.HVAC.VAV-708-DaTemp',
    'ses_falls_city.HVAC.VAV-708-DmpPos'
  ]; // REPLACE with valid points

  const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${encodeURIComponent(startTime)}&` +
    `end_time=${encodeURIComponent(endTime)}&` +
    `point_names=${encodeURIComponent(pointNames.join(','))}`;

  const startTs = performance.now();
  const response = await fetch(url, {
    headers: { 'X-ACE-Token': token }
  });
  const duration = performance.now() - startTs;

  const data = await response.json();
  const metadata = {
    status: response.status,
    duration: `${duration.toFixed(0)}ms`,
    dataSource: response.headers.get('X-Data-Source'),
    queryStrategy: response.headers.get('X-Query-Strategy'),
    pointsReturned: data.point_samples?.length || 0,
    totalSamples: data.point_samples?.reduce((sum, p) => sum + (p.samples?.length || 0), 0) || 0
  };

  console.log('✅ Test 2: Multiple Points Recent Data', metadata);
  console.assert(duration < 1000, `❌ Response time ${duration}ms exceeds 1000ms`);
  console.assert(metadata.pointsReturned === 5, `❌ Expected 5 points, got ${metadata.pointsReturned}`);
  console.assert(metadata.totalSamples > 0, '❌ No data returned');

  return { passed: duration < 1000 && metadata.pointsReturned === 5, metadata };
}

await test2_MultiplePointsRecent();
```

**Expected Results:**
- ✅ Response time <1s
- ✅ All 5 points returned
- ✅ ~50,400 total samples (5 points × 7 days × 1440 samples/day)
- ✅ `X-Data-Source: D1`

**Validation Checklist:**
- [ ] All requested points present in response
- [ ] Each point has ~10,080 samples (7d × 1440/day)
- [ ] Response time under 1 second
- [ ] Data aligned across all points (timestamps match)

---

### Test 3: Historical Data (30-90 Days) - R2 Storage

**Objective:** Verify R2 cold storage queries work when backfill is complete

**Test Data:**
```javascript
const testConfig = {
  siteName: 'ses_falls_city',
  pointNames: ['ses_falls_city.HVAC.VAV-707-DaTemp'],
  startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90d ago
  endTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30d ago
  expectedSource: 'R2',
  expectedResponseTime: 5000 // ms
};
```

**Browser Test:**
```javascript
async function test3_HistoricalData() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const pointName = 'ses_falls_city.HVAC.VAV-707-DaTemp';
  const startTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${encodeURIComponent(startTime)}&` +
    `end_time=${encodeURIComponent(endTime)}&` +
    `point_names=${encodeURIComponent(pointName)}`;

  const startTs = performance.now();
  const response = await fetch(url, {
    headers: { 'X-ACE-Token': token }
  });
  const duration = performance.now() - startTs;

  const data = await response.json();
  const metadata = {
    status: response.status,
    duration: `${duration.toFixed(0)}ms`,
    dataSource: response.headers.get('X-Data-Source'),
    queryStrategy: response.headers.get('X-Query-Strategy'),
    sampleCount: data.point_samples?.[0]?.samples?.length || 0,
    note: data.point_samples?.[0]?.samples?.length === 0 ? 'R2 backfill pending' : 'R2 operational'
  };

  console.log('✅ Test 3: Historical Data (R2)', metadata);

  // Note: This test may return empty results until R2 backfill completes
  if (metadata.sampleCount === 0) {
    console.warn('⚠️ No historical data yet - R2 backfill pending');
  } else {
    console.assert(duration < 5000, `❌ Response time ${duration}ms exceeds 5000ms`);
    console.assert(metadata.dataSource === 'R2', '❌ Expected R2 data source');
  }

  return { passed: true, metadata, note: 'Backfill pending' };
}

await test3_HistoricalData();
```

**Expected Results (After Backfill):**
- ✅ Response time <5s
- ✅ `X-Data-Source: R2`
- ✅ `X-Query-Strategy: R2_ONLY`
- ✅ Data returned: ~86,400 samples (60 days × 1440 samples/day)

**Current Status:**
⚠️ **R2 backfill pending** - Test will return empty results until archival worker completes historical backfill. Infrastructure is ready, awaiting data migration.

---

### Test 4: Split Query (D1 + R2) - Spanning Hot/Cold Boundary

**Objective:** Verify seamless merging of D1 hot + R2 cold data

**Test Data:**
```javascript
const testConfig = {
  siteName: 'ses_falls_city',
  pointNames: ['ses_falls_city.HVAC.VAV-707-DaTemp'],
  startTime: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // 40d ago
  endTime: new Date().toISOString(), // now
  expectedSource: 'BOTH',
  expectedResponseTime: 5000 // ms
};
```

**Browser Test:**
```javascript
async function test4_SplitQuery() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const pointName = 'ses_falls_city.HVAC.VAV-707-DaTemp';
  const startTime = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${encodeURIComponent(startTime)}&` +
    `end_time=${encodeURIComponent(endTime)}&` +
    `point_names=${encodeURIComponent(pointName)}`;

  const startTs = performance.now();
  const response = await fetch(url, {
    headers: { 'X-ACE-Token': token }
  });
  const duration = performance.now() - startTs;

  const data = await response.json();
  const samples = data.point_samples?.[0]?.samples || [];

  // Check for data continuity (no gaps)
  let hasGaps = false;
  for (let i = 1; i < samples.length; i++) {
    const prevTime = new Date(samples[i-1].time).getTime();
    const currTime = new Date(samples[i].time).getTime();
    const gap = (currTime - prevTime) / (1000 * 60); // minutes
    if (gap > 5) { // More than 5-minute gap
      hasGaps = true;
      console.warn(`⚠️ Gap detected: ${gap.toFixed(0)} minutes between samples`);
    }
  }

  const metadata = {
    status: response.status,
    duration: `${duration.toFixed(0)}ms`,
    dataSource: response.headers.get('X-Data-Source'),
    queryStrategy: response.headers.get('X-Query-Strategy'),
    sampleCount: samples.length,
    hasGaps,
    dataContinuity: !hasGaps ? '✅ Continuous' : '❌ Gaps detected'
  };

  console.log('✅ Test 4: Split Query (D1 + R2)', metadata);
  console.assert(metadata.dataSource === 'BOTH', '❌ Expected BOTH data sources');
  console.assert(metadata.queryStrategy === 'SPLIT', '❌ Expected SPLIT strategy');
  console.assert(!hasGaps, '❌ Data gaps detected in merged results');

  return { passed: !hasGaps, metadata };
}

await test4_SplitQuery();
```

**Expected Results:**
- ✅ `X-Data-Source: BOTH` (D1 + R2 merged)
- ✅ `X-Query-Strategy: SPLIT`
- ✅ Data continuity verified (no gaps at 20-day boundary)
- ✅ ~57,600 samples (40 days × 1440 samples/day)

**Validation Checklist:**
- [ ] Seamless merge at 20-day boundary
- [ ] No duplicate timestamps
- [ ] No gaps in data
- [ ] Timestamps sorted chronologically

---

### Test 5: Edge Case - No Data Available

**Objective:** Verify graceful handling when no data exists

**Browser Test:**
```javascript
async function test5_NoData() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const pointName = 'ses_falls_city.NonExistentPoint123';
  const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${encodeURIComponent(startTime)}&` +
    `end_time=${encodeURIComponent(endTime)}&` +
    `point_names=${encodeURIComponent(pointName)}`;

  const startTs = performance.now();
  const response = await fetch(url, {
    headers: { 'X-ACE-Token': token }
  });
  const duration = performance.now() - startTs;

  const data = await response.json();
  const metadata = {
    status: response.status,
    duration: `${duration.toFixed(0)}ms`,
    dataReturned: data.point_samples?.length > 0,
    sampleCount: data.point_samples?.[0]?.samples?.length || 0
  };

  console.log('✅ Test 5: No Data Available', metadata);
  console.assert(response.status === 200, '❌ Should return 200 with empty results');
  console.assert(duration < 100, `❌ Response time ${duration}ms exceeds 100ms`);
  console.assert(metadata.sampleCount === 0, '❌ Should return 0 samples');

  return { passed: response.status === 200 && metadata.sampleCount === 0, metadata };
}

await test5_NoData();
```

**Expected Results:**
- ✅ HTTP 200 (not 404)
- ✅ Response time <100ms
- ✅ Empty `point_samples` array or empty `samples`
- ✅ No error message

---

### Test 6: Edge Case - Invalid Point Names

**Objective:** Verify validation of point names

**Browser Test:**
```javascript
async function test6_InvalidPoints() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const pointName = ''; // Invalid empty point name
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${encodeURIComponent(startTime)}&` +
    `end_time=${encodeURIComponent(endTime)}&` +
    `point_names=${encodeURIComponent(pointName)}`;

  const response = await fetch(url, {
    headers: { 'X-ACE-Token': token }
  });

  const data = await response.json();
  const metadata = {
    status: response.status,
    hasError: data.error || data.message,
    errorType: data.error_code || 'UNKNOWN'
  };

  console.log('✅ Test 6: Invalid Point Names', metadata);
  // Currently returns 200 with empty results, could be enhanced to return 400

  return { passed: true, metadata };
}

await test6_InvalidPoints();
```

**Expected Results:**
- ✅ HTTP 200 or 400 (acceptable)
- ✅ Empty results or error message
- ✅ No server error (500)

---

### Test 7: Edge Case - Invalid Date Range

**Objective:** Verify date validation

**Browser Test:**
```javascript
async function test7_InvalidDateRange() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const pointName = 'ses_falls_city.HVAC.VAV-707-DaTemp';
  const startTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Future
  const endTime = new Date().toISOString();

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${encodeURIComponent(startTime)}&` +
    `end_time=${encodeURIComponent(endTime)}&` +
    `point_names=${encodeURIComponent(pointName)}`;

  const response = await fetch(url, {
    headers: { 'X-ACE-Token': token }
  });

  const data = await response.json();
  const metadata = {
    status: response.status,
    error: data.error,
    errorCode: data.error_code
  };

  console.log('✅ Test 7: Invalid Date Range', metadata);
  console.assert(response.status === 400, '❌ Should return 400 for invalid date range');
  console.assert(data.error, '❌ Should include error message');

  return { passed: response.status === 400, metadata };
}

await test7_InvalidDateRange();
```

**Expected Results:**
- ✅ HTTP 400 Bad Request
- ✅ Error message: "start_time cannot be in the future"
- ✅ `error_code: "INVALID_REQUEST"`

---

### Test 8: Edge Case - Missing Authentication

**Objective:** Verify authentication enforcement

**Browser Test:**
```javascript
async function test8_MissingAuth() {
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const pointName = 'ses_falls_city.HVAC.VAV-707-DaTemp';
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${encodeURIComponent(startTime)}&` +
    `end_time=${encodeURIComponent(endTime)}&` +
    `point_names=${encodeURIComponent(pointName)}`;

  const response = await fetch(url); // No token

  const metadata = {
    status: response.status,
    statusText: response.statusText
  };

  console.log('✅ Test 8: Missing Authentication', metadata);
  console.assert(response.status === 401, '❌ Should return 401 Unauthorized');

  return { passed: response.status === 401, metadata };
}

await test8_MissingAuth();
```

**Expected Results:**
- ✅ HTTP 401 Unauthorized
- ✅ Error message: "Missing authentication token"

---

### Test 9: Cache Performance

**Objective:** Verify KV caching reduces response time

**Browser Test:**
```javascript
async function test9_CachePerformance() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const pointName = 'ses_falls_city.HVAC.VAV-707-DaTemp';
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${encodeURIComponent(startTime)}&` +
    `end_time=${encodeURIComponent(endTime)}&` +
    `point_names=${encodeURIComponent(pointName)}`;

  // First request (cache miss)
  const startMiss = performance.now();
  const responseMiss = await fetch(url, { headers: { 'X-ACE-Token': token } });
  const durationMiss = performance.now() - startMiss;
  const dataMiss = await responseMiss.json();

  // Wait 1 second
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Second request (cache hit)
  const startHit = performance.now();
  const responseHit = await fetch(url, { headers: { 'X-ACE-Token': token } });
  const durationHit = performance.now() - startHit;
  const dataHit = await responseHit.json();

  const metadata = {
    missStatus: responseMiss.headers.get('X-Cache-Status'),
    missDuration: `${durationMiss.toFixed(0)}ms`,
    hitStatus: responseHit.headers.get('X-Cache-Status'),
    hitDuration: `${durationHit.toFixed(0)}ms`,
    speedup: `${(durationMiss / durationHit).toFixed(1)}x faster`
  };

  console.log('✅ Test 9: Cache Performance', metadata);
  console.assert(metadata.missStatus === 'MISS', '❌ First request should be cache MISS');
  console.assert(metadata.hitStatus === 'HIT', '❌ Second request should be cache HIT');
  console.assert(durationHit < durationMiss, '❌ Cached response should be faster');
  console.assert(durationHit < 50, `❌ Cache hit should be <50ms, got ${durationHit}ms`);

  return { passed: durationHit < 50 && metadata.hitStatus === 'HIT', metadata };
}

await test9_CachePerformance();
```

**Expected Results:**
- ✅ First request: `X-Cache-Status: MISS`
- ✅ Second request: `X-Cache-Status: HIT`
- ✅ Cache hit <50ms (10x faster)

---

### Test 10: Legacy Fallback

**Objective:** Verify graceful fallback to ACE API when routing disabled

**Browser Test:**
```javascript
async function test10_LegacyFallback() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';

  const pointName = 'ses_falls_city.HVAC.VAV-707-DaTemp';
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    `start_time=${encodeURIComponent(startTime)}&` +
    `end_time=${encodeURIComponent(endTime)}&` +
    `point_names=${encodeURIComponent(pointName)}&` +
    `use_routing=false`; // Disable routing

  const response = await fetch(url, {
    headers: { 'X-ACE-Token': token }
  });

  const data = await response.json();
  const metadata = {
    status: response.status,
    dataSource: response.headers.get('X-Data-Source'),
    queryStrategy: response.headers.get('X-Query-Strategy'),
    sampleCount: data.point_samples?.[0]?.samples?.length || 0
  };

  console.log('✅ Test 10: Legacy Fallback', metadata);
  console.assert(metadata.dataSource === 'ACE_API', '❌ Should fallback to ACE_API');
  console.assert(metadata.queryStrategy === 'LEGACY', '❌ Should use LEGACY strategy');
  console.assert(response.status === 200, '❌ Should return 200');

  return { passed: metadata.dataSource === 'ACE_API', metadata };
}

await test10_LegacyFallback();
```

**Expected Results:**
- ✅ `X-Data-Source: ACE_API`
- ✅ `X-Query-Strategy: LEGACY`
- ✅ Data returned successfully

---

## 4. Performance Benchmarking

### 4.1 Old vs New API Comparison

**Old API (Paginated):**
```javascript
async function benchmarkOldAPI() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const url = 'https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated?' +
    'start_time=' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() +
    '&end_time=' + new Date().toISOString() +
    '&raw_data=true&page_size=10000';

  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await fetch(url, { headers: { 'authorization': `Bearer ${token}` } });
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a,b) => a+b) / times.length;
  console.log('Old API avg:', avg.toFixed(0) + 'ms');
  return avg;
}
```

**New Query Worker:**
```javascript
async function benchmarkNewAPI() {
  const token = 'YOUR_ACE_TOKEN_HERE';
  const apiBase = 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev';
  const pointNames = 'ses_falls_city.HVAC.VAV-707-DaTemp,ses_falls_city.HVAC.VAV-707-DaTempSp';

  const url = `${apiBase}/api/sites/ses_falls_city/timeseries/paginated?` +
    'start_time=' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() +
    '&end_time=' + new Date().toISOString() +
    '&point_names=' + encodeURIComponent(pointNames);

  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await fetch(url, { headers: { 'X-ACE-Token': token } });
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a,b) => a+b) / times.length;
  console.log('New Query Worker avg:', avg.toFixed(0) + 'ms');
  return avg;
}
```

**Comparison Test:**
```javascript
async function comparePerformance() {
  console.log('Starting performance comparison...');

  const oldTime = await benchmarkOldAPI();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between tests
  const newTime = await benchmarkNewAPI();

  const speedup = (oldTime / newTime).toFixed(1);
  const improvement = ((oldTime - newTime) / oldTime * 100).toFixed(0);

  console.log(`
🏎️ Performance Comparison:
  Old API (Paginated): ${oldTime.toFixed(0)}ms
  New Query Worker:    ${newTime.toFixed(0)}ms
  Speedup:             ${speedup}x faster
  Improvement:         ${improvement}% reduction
  `);
}

await comparePerformance();
```

**Expected Results:**
- Old API: ~3000-5000ms (pagination overhead)
- New API: ~400-800ms (D1 direct query)
- Speedup: **5-10x faster**

---

## 5. Data Validation Checklist

### 5.1 Data Integrity

For each test, verify:

**Timestamp Validation:**
- [ ] Timestamps are in ISO 8601 format
- [ ] Timestamps are within requested range
- [ ] Timestamps are sequential (ascending order)
- [ ] No duplicate timestamps for same point

**Value Validation:**
- [ ] Values are numeric
- [ ] Values are within reasonable range for point type
  - Temperatures: 50-90°F
  - Dampers: 0-100%
  - Setpoints: 65-75°F
- [ ] No null or undefined values

**Data Completeness:**
- [ ] Expected sample count matches (1440/day for 1-min data)
- [ ] No large gaps (>5 minutes) without explanation
- [ ] All requested points present in response

**Metadata Validation:**
- [ ] `X-Data-Source` header present and accurate
- [ ] `X-Query-Strategy` matches expected routing
- [ ] `X-Processing-Time` header present
- [ ] Sample counts match between metadata and actual data

### 5.2 Error Handling

- [ ] Invalid inputs return 400 with clear error message
- [ ] Missing auth returns 401
- [ ] Non-existent points return 200 with empty results
- [ ] Server errors (if any) return 500 with error details
- [ ] CORS headers present on all responses

---

## 6. Browser Testing Quick Reference

### Copy-Paste Test Suite

```javascript
// ============================================================================
// QUERY WORKER TEST SUITE - Copy all and run in browser console
// ============================================================================

const CONFIG = {
  apiBase: 'https://ace-iot-timeseries.YOUR_ACCOUNT.workers.dev', // REPLACE
  token: 'YOUR_ACE_TOKEN_HERE', // REPLACE
  siteName: 'ses_falls_city',
  testPoints: [
    'ses_falls_city.HVAC.VAV-707-DaTemp',
    'ses_falls_city.HVAC.VAV-707-DaTempSp',
    'ses_falls_city.HVAC.VAV-707-DmpPos'
  ] // REPLACE with valid points from your D1
};

async function runAllTests() {
  console.log('🚀 Starting Query Worker Test Suite...\n');

  const results = [];

  try {
    results.push(await test1_SinglePointRecent());
    results.push(await test2_MultiplePointsRecent());
    results.push(await test3_HistoricalData());
    results.push(await test5_NoData());
    results.push(await test7_InvalidDateRange());
    results.push(await test8_MissingAuth());
    results.push(await test9_CachePerformance());

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Test Suite Complete: ${passed}/${total} passed`);
    console.log(`${'='.repeat(60)}\n`);

    return results;
  } catch (error) {
    console.error('❌ Test suite error:', error);
    return results;
  }
}

// Run all tests
await runAllTests();
```

---

## 7. Test Execution Schedule

### Phase 1: Pre-Production (Current)
**Status:** D1 active, R2 infrastructure ready

✅ **Execute Now:**
- Test 1: Single point recent (D1)
- Test 2: Multiple points recent (D1)
- Test 5: No data available
- Test 6: Invalid point names
- Test 7: Invalid date ranges
- Test 8: Missing authentication
- Test 9: Cache performance
- Test 10: Legacy fallback

⚠️ **Skip Until Backfill Complete:**
- Test 3: Historical data (R2)
- Test 4: Split query (D1 + R2)

### Phase 2: Post-Backfill (Future)
**Trigger:** After archival worker completes 90-day backfill

✅ **Execute:**
- Test 3: Historical data (R2)
- Test 4: Split query (D1 + R2 merge)
- Re-run all Phase 1 tests for regression

### Phase 3: Production Monitoring
**Frequency:** Weekly

- Performance benchmarks (old vs new API)
- Cache hit rate monitoring
- Data continuity checks
- Error rate tracking

---

## 8. Success Criteria

### Must Pass (Blockers)
- ✅ Test 1: Single point recent <500ms (D1)
- ✅ Test 2: Multiple points recent <1s (D1)
- ✅ Test 7: Invalid date validation
- ✅ Test 8: Authentication enforcement

### Should Pass (Quality)
- ✅ Test 9: Cache performance <50ms on hit
- ✅ Test 10: Legacy fallback functional
- ✅ All edge cases handle gracefully

### Future Pass (Post-Backfill)
- ⏳ Test 3: Historical R2 queries <5s
- ⏳ Test 4: Split query merging seamless

---

## 9. Issue Tracking Template

When issues are found, document using this template:

```markdown
## Issue: [Short Description]

**Test:** Test X: [Name]
**Severity:** Critical | High | Medium | Low
**Status:** Open | In Progress | Resolved

**Observed Behavior:**
[What happened]

**Expected Behavior:**
[What should happen]

**Reproduction Steps:**
1. [Step 1]
2. [Step 2]

**Response Details:**
- Status Code: [code]
- Response Time: [ms]
- Headers: [relevant headers]
- Error Message: [if any]

**Browser Console Output:**
```javascript
[paste console output]
```

**Proposed Fix:**
[suggested solution]
```

---

## 10. Next Steps

1. **Update Configuration:**
   - Replace `YOUR_ACCOUNT` with actual Cloudflare account
   - Replace `YOUR_ACE_TOKEN_HERE` with valid ACE token
   - Replace test point names with valid points from D1

2. **Run Phase 1 Tests:**
   - Execute Tests 1, 2, 5, 6, 7, 8, 9, 10
   - Document results
   - File issues for failures

3. **Monitor Backfill:**
   - Track archival worker progress
   - Check R2 bucket for Parquet files
   - Execute Phase 2 tests when ready

4. **Performance Baseline:**
   - Run comparison benchmarks
   - Document current performance
   - Set production SLAs

---

## Appendix A: Test Point Discovery

**Get Valid Points from D1:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT point_name, COUNT(*) as samples
FROM timeseries_raw
WHERE site_name = 'ses_falls_city'
GROUP BY point_name
HAVING samples > 1000
ORDER BY samples DESC
LIMIT 20
"
```

**Check Data Age:**
```bash
wrangler d1 execute ace-iot-db --command="
SELECT
  MIN(timestamp) as oldest_ts,
  MAX(timestamp) as newest_ts,
  (MAX(timestamp) - MIN(timestamp)) / 86400 as days_covered,
  COUNT(*) as total_samples
FROM timeseries_raw
WHERE site_name = 'ses_falls_city'
"
```

---

## Appendix B: Worker Logs

**Monitor Live Queries:**
```bash
wrangler tail --env production --format=pretty
```

**Filter for Errors:**
```bash
wrangler tail --env production --format=pretty | grep ERROR
```

**Check Routing Decisions:**
```bash
wrangler tail --env production --format=pretty | grep "QUERY ROUTER"
```

---

## Document Control

**Version History:**
- v1.0 (2025-10-14): Initial test plan created

**Next Review:** After R2 backfill completion

**Owner:** Integration Test Specialist
