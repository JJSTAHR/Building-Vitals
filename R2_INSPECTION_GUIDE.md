# R2 Bucket Inspection Guide

## Quick Summary

Your query worker is ready to read from R2, but the backfill found 0 samples because:

1. **R2 bucket is likely EMPTY** - ETL worker isn't writing to R2
2. **ETL worker only syncs to D1** - No R2 bindings or write calls
3. **This is why backfill failed** - Nothing to read from cold storage

## How to Verify

### Method 1: Cloudflare Dashboard (Best)

```
1. Go to https://dash.cloudflare.com/
2. Select your account
3. Click "R2" in sidebar
4. Click "ace-timeseries" bucket
5. Navigate to: timeseries/ses_falls_city/
6. Check if any .ndjson.gz files exist
```

**Expected result**: Empty folder (or empty bucket)

### Method 2: List R2 Contents (Deploy Worker)

#### Create a temporary diagnostic worker:

File: `check-r2.js`
```javascript
export default {
  async fetch(request, env) {
    const bucket = env.BUCKET;
    if (!bucket) return new Response('No BUCKET binding', { status: 500 });
    
    const prefix = 'timeseries/ses_falls_city/';
    const listed = await bucket.list({ prefix });
    
    return new Response(JSON.stringify({
      prefix,
      files: listed.objects.map(o => ({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded
      })),
      count: listed.objects.length
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

#### Deploy and test:
```bash
# Deploy
npx wrangler publish check-r2.js --name temp-r2-check

# Test
curl https://temp-r2-check.your-account.workers.dev
```

### Method 3: Direct API Check

```bash
# Install Cloudflare CLI
npm install -g wrangler

# Set token
export CLOUDFLARE_API_TOKEN=your_token_here

# List buckets
npx wrangler r2 bucket list

# Check bucket info
npx wrangler r2 bucket info ace-timeseries
```

## Analysis Summary

### File: `/src/etl-sync-worker.js`

**Lines 260-341: Sync function**
```javascript
async function syncAllPointsNoFilter(env, siteName, timeRange, syncId) {
  // Fetches data from ACE API
  const allTimeseriesData = await fetchAllTimeseries(...);
  
  // Filters NULL/NaN values
  const filteredSamples = allTimeseriesData.filter(sample => sample.value != null);
  
  // INSERT TO D1 ONLY ❌ NO R2 WRITE!
  const insertResult = await batchInsertTimeseries(env.DB, allNormalizedSamples);
  
  // Missing: await writeNDJSONToR2(env.BUCKET, siteName, date, samples);
}
```

**Problem**: ETL worker has NO R2 bucket binding and NO writeNDJSONToR2 call

### File: `/src/lib/r2-ndjson-writer.js`

**Available functions** (but never called!):
```javascript
export async function writeNDJSONToR2(r2Bucket, siteName, date, samples, options = {})
export async function listNDJSONFiles(r2Bucket, siteName, options = {})
export async function readNDJSONFromR2(r2Bucket, siteName, date)
export async function deleteNDJSONFromR2(r2Bucket, siteName, date)
```

**Status**: Ready to use ✓

### File: `/wrangler.toml`

**Configuration** (Lines 28-31):
```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "ace-timeseries"
preview_bucket_name = "ace-timeseries-preview"
```

**Status**: Configured correctly ✓

## Root Cause Analysis

### Current Data Flow
```
ACE IoT API
    ↓
  ETL Worker (5-minute sync)
    ├─→ D1 Database (hot storage) ✓ WORKING
    └─→ R2 Cold Storage ✗ EMPTY (not implemented)
    
Query Worker tries:
    R2 first → finds nothing → falls back to D1
```

### Missing Implementation
The R2 write functionality exists in `/src/lib/r2-ndjson-writer.js` but is **never called** by the ETL worker.

To fix, add this after line 335 in `etl-sync-worker.js`:

```javascript
// Write to R2 for cold storage
const dateStr = new Date().toISOString().split('T')[0];
const r2Result = await writeNDJSONToR2(
  env.BUCKET,
  siteName,
  dateStr,
  allNormalizedSamples,
  { append: true }
);
console.log(`[ETL] R2 write result:`, r2Result);
```

## Expected File Structure (if working)

```
ace-timeseries bucket:
└── timeseries/
    └── ses_falls_city/
        └── 2025/
            ├── 10/
            │   ├── 15.ndjson.gz (today's file)
            │   ├── 14.ndjson.gz
            │   ├── 13.ndjson.gz
            │   └── ...
            └── 09/
                ├── 30.ndjson.gz
                ├── 29.ndjson.gz
                └── ...
```

**File naming**: `{YYYY}/{MM}/{DD}.ndjson.gz`
**Content**: Newline-delimited JSON, gzip compressed
**Format**: `{ point_name, timestamp, value }`

## Impact Timeline

### Current (Now)
- ETL syncs to D1 only
- R2 bucket empty or contains old data
- Backfill returns 0 samples from R2
- Charts may not have historical data

### After Fix (30 min to deploy)
- ETL syncs to BOTH D1 and R2
- New data starts flowing to R2
- Next backfill queries will find data
- Incremental (from next ETL cycle)

### After 24 hours
- 24 hours of backfill data available
- Charts can display yesterday + today

### After 30 days
- Full month of historical data in R2
- Archive worker can clean up old D1 records
- Queries become faster (R2 > D1 for old data)

## Files Affected

| File | Change | Priority |
|------|--------|----------|
| `/src/etl-sync-worker.js` | Add R2 writes | HIGH |
| `/src/lib/r2-ndjson-writer.js` | Already ready | - |
| `/src/lib/r2-client.js` | Already ready | - |
| `/wrangler.toml` | Already configured | - |

## Testing

### Before Fix
```bash
curl "https://your-backfill-worker.dev/backfill?site=ses_falls_city&days=10"
# Returns: { samples: 0 }  ← Problem
```

### After Fix
```bash
curl "https://your-backfill-worker.dev/backfill?site=ses_falls_city&days=10"
# Returns: { samples: 1000000, from_r2: 500000, from_d1: 500000 }  ← Fixed
```

## Monitoring

Add metrics to track R2 writes:

```javascript
console.log('[ETL] R2 write complete', {
  site: siteName,
  date: dateStr,
  samples: allNormalizedSamples.length,
  fileSize: r2Result.file_size,
  compressionRatio: r2Result.compression_ratio,
  duration: r2Result.duration_ms
});
```

## Questions & Answers

**Q: Why is the backfill returning 0 samples?**
A: R2 is empty because ETL worker never writes to it

**Q: Will data appear immediately after I fix it?**
A: No - only new data from the next ETL sync (5 min schedule)

**Q: How do I backfill old data?**
A: Option 1: Wait 24 hours for lookback sync
   Option 2: Run a manual backfill worker
   Option 3: Archive D1 data to R2 directly

**Q: Is the query worker correctly configured?**
A: Yes - it has queryR2Timeseries() function ready

**Q: What's the expected file format?**
A: timeseries/{site}/{YYYY}/{MM}/{DD}.ndjson.gz

**Q: How often does ETL run?**
A: Every 5 minutes (configured in etl-sync-worker.js)

**Q: Can I manually populate R2?**
A: Yes - use writeNDJSONToR2() from any script/worker

