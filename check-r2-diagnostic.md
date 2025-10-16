# R2 Bucket Data Availability Diagnostic

## Goal
Understand if historical NDJSON.gz data exists in the R2 bucket for backfill operations.

## Status
- Query Worker can read from R2: YES (code exists)
- ETL Worker writes to R2: UNKNOWN (need to verify)
- Backfill found 0 samples: PROBLEM (indicates either no data or query issue)

## Expected Path Format
`timeseries/ses_falls_city/YYYY/MM/DD.ndjson.gz`

Example:
- `timeseries/ses_falls_city/2025/10/15.ndjson.gz`
- `timeseries/ses_falls_city/2025/10/14.ndjson.gz`
- `timeseries/ses_falls_city/2025/09/30.ndjson.gz`

## What We Need to Check

### 1. Current State of R2
- Are there ANY NDJSON.gz files in the bucket?
- What date range do they cover?
- How many files exist?
- What are their sizes?

### 2. ETL Worker Status
- Is the ETL worker running?
- Is it writing to R2 or just D1?
- What's the sync schedule?
- Are there any errors in the sync logs?

### 3. Query Worker Configuration
- Are the time ranges correct?
- Is the site name matching?
- Are the point names filtering correctly?

## How to Check R2 Contents

### Option 1: Create a Test Worker
1. Create a temporary Worker that lists R2 contents
2. Deploy it temporarily
3. Call the endpoint to get a JSON report

### Option 2: Use Cloudflare Dashboard
1. Go to R2 bucket in Cloudflare dashboard
2. Browse the "timeseries/ses_falls_city/" directory
3. Check if files exist

### Option 3: Access Logs
1. Check ETL worker logs (KV storage)
2. Check query worker logs
3. Look for "R2: Listed X files" messages

## Key Files to Review

- **ETL Worker**: `/src/etl-sync-worker.js`
  - Line ~260-341: Sync logic (may not be writing to R2!)
  - Look for writeNDJSONToR2 calls

- **R2 Client**: `/src/lib/r2-client.js`
  - Line ~316: listTimeseriesFiles() function
  - Line ~440: listNDJSONFiles() function

- **Config**: `/wrangler.toml`
  - Line ~28-31: R2 bucket binding (BUCKET)

## Critical Findings

1. **ETL Worker Issue**: The ETL worker (`etl-sync-worker.js`) appears to ONLY sync to D1 database:
   - No calls to `writeNDJSONToR2()`
   - No R2 bucket binding in the worker code
   - R2 writes may not be happening at all!

2. **This explains why backfill found 0 samples**:
   - R2 bucket is empty
   - ETL is only writing to D1 hot storage
   - Query worker tries to read from R2 (finds nothing)
   - Falls back to D1 (should work, but backfill query may have issues)

## Next Steps

1. Check if R2 actually has files (via dashboard or worker)
2. If R2 is empty:
   - Enable R2 writes in ETL worker
   - Or backfill from D1 to R2 manually
3. If R2 has files:
   - Debug why query worker isn't finding them
   - Check time ranges and site name matching

## How to Deploy Diagnostic Worker

```bash
# Create check-r2-worker.js with the following content
# Then deploy:
npx wrangler publish check-r2-worker.js --name temp-r2-check

# Call the endpoint:
curl "https://temp-r2-check.<account>.workers.dev?site=ses_falls_city&prefix=timeseries"
```

