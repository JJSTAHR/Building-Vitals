# Root Cause Analysis: R2 Storage Data Visibility Issue

## Executive Summary

The application charts are only showing data from 10/15/2025 5:20PM onward because **the backfill process failed to collect any actual data from the ACE IoT API**, resulting in an empty R2 storage. Additionally, configuration mismatches between the archival worker and query router are preventing access to any data that might exist in the 20-30 day window.

## Primary Root Cause: Zero Data Collection

### Evidence
- **Backfill Status**: `samples_fetched: 0` (despite 307 dates marked complete)
- **API Errors**: Authentication failure (401) on first attempt
- **Silent Failures**: Empty responses treated as success
- **Bug**: Progress calculation shows `NaN%` due to array/number type mismatch

## Secondary Issues Identified

### 1. Configuration Mismatch (Critical)
**Problem**: Hot/Cold storage boundary inconsistency
- **Archival Worker**: Archives data at 20 days
- **Query Router**: Looks for data in D1 up to 30 days
- **Impact**: Data aged 20-30 days is invisible (exists in R2, query looks in D1)

### 2. Authentication Failure
**Problem**: ACE API returning 401 Unauthorized
- **Impact**: Cannot fetch any data from source API
- **Likely Cause**: Invalid, expired, or misconfigured API key

### 3. Data Validation Gap
**Problem**: Backfill marks dates as "complete" even with 0 samples
- **Code Location**: `src/backfill-worker.js:400`
- **Impact**: False positive completion status masks data collection failures

### 4. Frontend is Not the Problem
**Verified**: Frontend correctly:
- ✅ Calculates 365-day time ranges
- ✅ Has no hardcoded date restrictions
- ✅ Passes full date ranges to backend
- ✅ Handles custom date selections

## Immediate Fix Implementation Plan

### Step 1: Fix Authentication (Priority 1)
```bash
# Verify current API key
wrangler secret list

# Update API key
wrangler secret put ACE_API_KEY
# Enter valid API key when prompted
```

### Step 2: Fix Configuration Mismatch (Priority 1)
```javascript
// File: src/lib/query-router.js
// Line: ~30
// BEFORE:
const HOT_DATA_THRESHOLD_DAYS = 30;

// AFTER:
const HOT_DATA_THRESHOLD_DAYS = 20; // Match archival retention
```

### Step 3: Fix Progress Calculation Bug
```javascript
// File: src/backfill-worker.js
// Line: 400
// BEFORE:
const percentComplete = ((state.completed_dates / totalDays) * 100).toFixed(1);

// AFTER:
const percentComplete = ((state.completed_dates.length / totalDays) * 100).toFixed(1);
```

### Step 4: Add Data Validation
```javascript
// File: src/backfill-worker.js
// After line 180, add:
if (!samples || samples.length === 0) {
  throw new Error(`No data returned from ACE API for ${currentDate}`);
}
```

### Step 5: Reset and Restart Backfill
```bash
# Clear existing state
wrangler kv:key delete --binding=BACKFILL_KV backfill_state

# Deploy fixes
wrangler deploy

# Trigger fresh backfill
curl -X POST https://building-vitals-backfill.jstahr.workers.dev/backfill/start \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2025-10-16",
    "site_name": "ses_falls_city"
  }'
```

## Monitoring Commands

### Check Backfill Progress
```bash
# View real-time logs
wrangler tail --env production

# Check backfill status
curl https://building-vitals-backfill.jstahr.workers.dev/backfill/status
```

### Verify R2 Data Population
```bash
# List files in R2
wrangler r2 object list ace-timeseries --prefix=timeseries/

# Check specific date
wrangler r2 object get ace-timeseries/timeseries/ses_falls_city/2024/10/15.ndjson.gz
```

### Test Query Worker
```bash
# Test historical query
curl "https://building-vitals-query.jstahr.workers.dev/api/sites/ses_falls_city/timeseries/paginated?start_time=2024-01-01T00:00:00Z&end_time=2024-12-31T23:59:59Z" \
  -H "X-ACE-Token: YOUR_TOKEN"
```

## Expected Timeline

1. **Immediate (5 minutes)**: Deploy configuration fixes
2. **1-2 hours**: Complete authentication fix and restart backfill
3. **24-48 hours**: Full historical data backfill complete (depending on data volume)
4. **Verification**: Charts should show full year of data

## Success Criteria

- [ ] ACE API authentication successful (no 401 errors)
- [ ] Backfill progress shows actual percentage (not NaN)
- [ ] `samples_fetched` counter incrementing (not zero)
- [ ] R2 bucket contains .ndjson.gz files for historical dates
- [ ] Charts display data for full selected time range
- [ ] Query worker metadata shows `source: "r2"` for historical queries

## Long-term Recommendations

1. **Add Monitoring**
   - Set up alerts for backfill failures
   - Monitor R2 storage usage
   - Track query performance metrics

2. **Implement Data Quality Checks**
   - Validate minimum sample count per day
   - Alert on empty API responses
   - Add checksum validation for archived data

3. **Optimize Query Performance**
   - Implement query result caching
   - Add pagination for large datasets
   - Consider data aggregation for long time ranges

4. **Documentation**
   - Document ACE API authentication setup
   - Create runbook for backfill operations
   - Add architecture diagrams for data flow

## Summary

The root cause is a combination of authentication failure and configuration issues that prevented any historical data from being collected and stored in R2. The frontend is working correctly. Once the authentication and configuration fixes are deployed, and the backfill process is restarted with proper validation, the charts should display the full historical data range as expected.