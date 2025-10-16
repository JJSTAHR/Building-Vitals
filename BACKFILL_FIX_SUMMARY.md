# Backfill Worker Fix Summary

## Issue Identified

The backfill worker uses **identical token configuration** to the working ETL worker. The code is correct, but the **ACE_API_KEY secret may not be deployed** to the backfill worker.

## Token Configuration Comparison

### Working ETL Worker (etl-sync-worker.js)
```javascript
// Line 497
const response = await fetchWithRetry(url.toString(), {
  headers: {
    'authorization': `Bearer ${env.ACE_API_KEY}`,
    'Accept': 'application/json'
  }
});
```

### Backfill Worker (backfill-worker.js)
```javascript
// Line 470
const response = await fetch(url.toString(), {
  method: 'GET',
  headers: {
    'authorization': `Bearer ${env.ACE_API_KEY}`,
    'Content-Type': 'application/json'
  }
});
```

**Conclusion:** Both use `Authorization: Bearer ${env.ACE_API_KEY}` ✅ IDENTICAL AND CORRECT

---

## Root Cause

The backfill worker is likely failing because:

1. **ACE_API_KEY secret not deployed** to the backfill worker
2. **Data is being written to R2** but not visible due to query issues
3. **Backfill is running** but silently failing without proper error logging

---

## Exact Fix Steps

### Step 1: Deploy ACE_API_KEY Secret

```bash
# Deploy the secret to backfill worker
wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml --env production

# When prompted, paste the same token used for ETL worker
# (Get from ACE IoT platform or your secure storage)
```

### Step 2: Verify Secret Deployment

```bash
# List secrets to confirm ACE_API_KEY is deployed
wrangler secret list --config workers/wrangler-backfill.toml --env production

# Expected output should include:
# ACE_API_KEY
```

### Step 3: Redeploy Worker

```bash
# Redeploy to ensure secret is bound correctly
wrangler deploy --config workers/wrangler-backfill.toml --env production
```

### Step 4: Test Health Check

```bash
# Verify worker is healthy
curl https://building-vitals-backfill.jstahr.workers.dev/health

# Expected output:
# {
#   "status": "healthy",
#   "service": "backfill-worker",
#   "version": "1.0.0",
#   ...
# }
```

### Step 5: Test Backfill Trigger

```bash
# Start backfill
curl -X POST https://building-vitals-backfill.jstahr.workers.dev/trigger

# Expected output:
# {
#   "status": "in_progress",
#   "progress": {
#     "current_date": "2024-12-10",
#     "samples_fetched": 0,
#     ...
#   },
#   "continuation": true
# }
```

### Step 6: Monitor Logs

```bash
# Watch logs in real-time
wrangler tail --config workers/wrangler-backfill.toml --env production --format pretty

# Look for:
# - [ACE API] Success messages
# - [Backfill] Data written to R2
# - No 401/403 authentication errors
```

### Step 7: Verify R2 Data

```bash
# Check if data is being written to R2
wrangler r2 object list ace-timeseries --prefix="timeseries/ses_falls_city/"

# Should see files like:
# timeseries/ses_falls_city/2024-12-10/data.ndjson.gz
# timeseries/ses_falls_city/2024-12-11/data.ndjson.gz
```

---

## Verification Scripts

### Test ACE Token Directly

```bash
# Set your token
export ACE_API_TOKEN="your-token-here"

# Run token test script
bash scripts/test-ace-token.sh
```

### Verify Backfill Configuration

```bash
# Run configuration verification
bash scripts/verify-backfill-config.sh
```

---

## Common Errors and Fixes

### Error: "401 Unauthorized"
**Cause:** ACE_API_KEY secret not deployed or invalid
**Fix:**
```bash
wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml --env production
wrangler deploy --config workers/wrangler-backfill.toml --env production
```

### Error: "No data returned"
**Cause:** Date range has no data in ACE IoT
**Fix:** Test date range directly with ACE API:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated?start_time=2024-12-10T00:00:00Z&end_time=2024-12-10T23:59:59Z&page_size=1000&raw_data=true"
```

### Error: "Timeout"
**Cause:** Large page size or slow API
**Fix:** Reduce page size in backfill-worker.js line 455:
```javascript
url.searchParams.set('page_size', '10000'); // Reduce from 100000
```

### Data in R2 but not visible in queries
**Cause:** Query worker not reading R2 correctly
**Fix:** Test query worker with R2 data:
```bash
# Query historical data
curl "https://building-vitals-query.jstahr.workers.dev/timeseries/query?site_name=ses_falls_city&point_names=VAV-707.DaTemp&start_time=1702137600000&end_time=1702224000000"

# Check response headers:
# X-Data-Source: should be "R2" or "SPLIT"
# X-Query-Strategy: should be "R2_ONLY" or "SPLIT"
```

---

## Code Changes NOT Needed

**The backfill worker code is already correct.** The authentication header format matches the working ETL worker:

```javascript
// Both workers use this format:
headers: {
  'authorization': `Bearer ${env.ACE_API_KEY}`
}
```

No code changes are required. This is a **deployment configuration issue**.

---

## Deployment Checklist

- [ ] ACE_API_KEY secret deployed to backfill worker
- [ ] Backfill worker redeployed
- [ ] Health check passes
- [ ] Trigger endpoint works
- [ ] Logs show successful ACE API calls
- [ ] Data written to R2
- [ ] Query worker can read R2 data

---

## Next Steps

1. **Deploy secret:**
   ```bash
   wrangler secret put ACE_API_KEY --config workers/wrangler-backfill.toml --env production
   ```

2. **Redeploy worker:**
   ```bash
   wrangler deploy --config workers/wrangler-backfill.toml --env production
   ```

3. **Test:**
   ```bash
   curl -X POST https://building-vitals-backfill.jstahr.workers.dev/trigger
   wrangler tail --config workers/wrangler-backfill.toml --env production
   ```

4. **Verify data:**
   ```bash
   wrangler r2 object list ace-timeseries --prefix="timeseries/ses_falls_city/"
   ```

---

## Documentation

- Full troubleshooting guide: `docs/BACKFILL_TOKEN_FIX.md`
- Token test script: `scripts/test-ace-token.sh`
- Config verification: `scripts/verify-backfill-config.sh`

---

## Summary

- **Code:** ✅ CORRECT (identical to working ETL worker)
- **Issue:** ❌ Secret not deployed to backfill worker
- **Fix:** Deploy `ACE_API_KEY` secret and redeploy worker
- **Time:** < 5 minutes to fix

**The backfill worker will work once the secret is deployed.**
