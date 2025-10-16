# Backfill Worker Token Configuration Fix

## Problem Statement
The backfill worker is not accessing the ACE IoT API correctly, potentially due to missing authentication or incorrect data handling.

## Root Cause Analysis

### Token Configuration (VERIFIED CORRECT ✓)
Both the ETL and backfill workers use **identical authentication**:

```javascript
// backfill-worker.js line 470
const response = await fetch(url.toString(), {
  method: 'GET',
  headers: {
    'authorization': `Bearer ${env.ACE_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// etl-sync-worker.js line 497
const response = await fetchWithRetry(url.toString(), {
  headers: {
    'authorization': `Bearer ${env.ACE_API_KEY}`,
    'Accept': 'application/json'
  }
});
```

**Conclusion:** Code is correct. The issue is likely **deployment configuration**.

---

## Fix #1: Verify Secret Deployment

### Check if ACE_API_KEY is deployed
```bash
# List secrets for backfill worker
wrangler secret list --config workers/wrangler-backfill.toml --env production
```

### Deploy the secret if missing
```bash
# Set the ACE API key secret
wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml --env production

# When prompted, paste the same token used for ETL worker:
# (Get from ETL worker or original source)
```

### Verify secret is set
```bash
# The secret should appear in the list (value is hidden for security)
wrangler secret list --config workers/wrangler-backfill.toml --env production
```

---

## Fix #2: Test Backfill Worker Manually

### Test health endpoint
```bash
curl https://building-vitals-backfill.jstahr.workers.dev/health
```

**Expected Output:**
```json
{
  "status": "healthy",
  "service": "backfill-worker",
  "version": "1.0.0",
  "config": {
    "pages_per_invocation": 5,
    "date_range": {
      "start": "2024-12-10",
      "end": "2025-10-12",
      "total_days": 307
    }
  },
  "timestamp": "2025-10-16T..."
}
```

### Test status endpoint
```bash
curl https://building-vitals-backfill.jstahr.workers.dev/status
```

### Trigger backfill with detailed logging
```bash
# Start backfill
curl -X POST https://building-vitals-backfill.jstahr.workers.dev/trigger

# Monitor logs in real-time
wrangler tail --config workers/wrangler-backfill.toml --env production --format pretty
```

---

## Fix #3: Check R2 Data Storage

### Verify data is being written to R2
```bash
# List R2 objects for a specific date
wrangler r2 object list ace-timeseries --prefix="timeseries/ses_falls_city/2024-12-10"

# Download and inspect a file
wrangler r2 object get ace-timeseries/timeseries/ses_falls_city/2024-12-10/data.ndjson.gz --file=test.ndjson.gz

# Decompress and view
gunzip test.ndjson.gz
head -20 test.ndjson
```

**Expected NDJSON format:**
```json
{"site_name":"ses_falls_city","point_name":"VAV-707.DaTemp","timestamp":1702137600000,"avg_value":72.5}
{"site_name":"ses_falls_city","point_name":"VAV-707.ClgVlvPos","timestamp":1702137600000,"avg_value":45.2}
```

---

## Fix #4: Data Query Verification

### Check if query worker can read R2 data
```bash
# Query historical data from backfill period
curl "https://building-vitals-query.jstahr.workers.dev/timeseries/query?site_name=ses_falls_city&point_names=VAV-707.DaTemp&start_time=1702137600000&end_time=1702224000000"
```

**Expected headers:**
- `X-Data-Source: R2` (for dates in backfill range)
- `X-Query-Strategy: R2_ONLY` (if entire range is cold storage)

---

## Fix #5: Redeploy with Correct Configuration

If the secret is missing or configuration is wrong, redeploy:

```bash
# Step 1: Ensure secret is set
wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml --env production

# Step 2: Redeploy worker
wrangler deploy --config workers/wrangler-backfill.toml --env production

# Step 3: Verify deployment
curl https://building-vitals-backfill.jstahr.workers.dev/health

# Step 4: Test trigger
curl -X POST https://building-vitals-backfill.jstahr.workers.dev/trigger

# Step 5: Monitor logs
wrangler tail --config workers/wrangler-backfill.toml --env production
```

---

## Fix #6: Validate API Token Permissions

### Test ACE API directly with the token
```bash
# Get your token
TOKEN="your-ace-api-token"

# Test configured points endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/configured_points?per_page=100"

# Test paginated timeseries endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated?start_time=2024-12-10T00:00:00Z&end_time=2024-12-10T23:59:59Z&page_size=100000&raw_data=true"
```

**If these fail:** The token itself is invalid or lacks permissions.

---

## Common Error Patterns

### Error: "Missing authentication token"
**Cause:** `ACE_API_KEY` secret not deployed
**Fix:** Run `wrangler secret put ACE_API_KEY`

### Error: "401 Unauthorized"
**Cause:** Token is expired or invalid
**Fix:** Get a fresh token from ACE IoT platform and redeploy secret

### Error: "No data returned"
**Cause:** Date range has no data, OR filtering is removing all samples
**Fix:** Check ACE API directly for the date range

### Error: "Timeout"
**Cause:** Large page size or slow ACE API
**Fix:** Reduce `page_size` from 100000 to 10000

---

## Complete Deployment Checklist

- [ ] **1. Secret Deployed**
  ```bash
  wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml --env production
  ```

- [ ] **2. Worker Deployed**
  ```bash
  wrangler deploy --config workers/wrangler-backfill.toml --env production
  ```

- [ ] **3. Health Check Passes**
  ```bash
  curl https://building-vitals-backfill.jstahr.workers.dev/health
  ```

- [ ] **4. R2 Bucket Exists**
  ```bash
  wrangler r2 bucket list | grep ace-timeseries
  ```

- [ ] **5. KV Namespace Exists**
  ```bash
  wrangler kv namespace list | grep BACKFILL_STATE
  ```

- [ ] **6. Test Trigger Works**
  ```bash
  curl -X POST https://building-vitals-backfill.jstahr.workers.dev/trigger
  ```

- [ ] **7. Data Written to R2**
  ```bash
  wrangler r2 object list ace-timeseries --prefix="timeseries/ses_falls_city/"
  ```

- [ ] **8. Query Worker Can Read R2**
  ```bash
  curl "https://building-vitals-query.jstahr.workers.dev/timeseries/query?..."
  ```

---

## Automation Script Update

If the backfill is failing silently, update the automation script to show errors:

```javascript
// scripts/run-backfill.js - Enhanced error reporting
async function triggerBackfill() {
  try {
    const response = await fetch(`${WORKER_URL}/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const result = await response.json();

    // Log full response for debugging
    if (!response.ok || result.status === 'error') {
      console.error('❌ Backfill error:', JSON.stringify(result, null, 2));
    }

    return result;
  } catch (error) {
    console.error(`❌ Error triggering backfill: ${error.message}`);
    throw error;
  }
}
```

---

## Verification Steps

After deploying fixes:

1. **Check worker logs:**
   ```bash
   wrangler tail --config workers/wrangler-backfill.toml --env production
   ```

2. **Monitor R2 writes:**
   ```bash
   # Before backfill
   wrangler r2 object list ace-timeseries --prefix="timeseries/ses_falls_city/" | wc -l

   # After backfill runs
   wrangler r2 object list ace-timeseries --prefix="timeseries/ses_falls_city/" | wc -l
   ```

3. **Query historical data:**
   ```bash
   # Query a date from backfill range
   curl "https://building-vitals-query.jstahr.workers.dev/timeseries/query?site_name=ses_falls_city&point_names=VAV-707.DaTemp&start_time=1702137600000&end_time=1702224000000" | jq .
   ```

---

## Summary

The backfill worker code is **correct**. The issue is **deployment configuration**:

1. ✅ Token usage in code is identical to ETL worker
2. ❓ Token may not be deployed as secret
3. ❓ Data may be written to R2 but not queried correctly

**Immediate action:**
```bash
# Deploy secret if missing
wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml --env production

# Redeploy worker
wrangler deploy --config workers/wrangler-backfill.toml --env production

# Test
curl -X POST https://building-vitals-backfill.jstahr.workers.dev/trigger
wrangler tail --config workers/wrangler-backfill.toml --env production
```
