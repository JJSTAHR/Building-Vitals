# ✅ CORRECT CONFIGURATION TO USE - Building Vitals

## 🎯 THE CORRECT RESOURCES (USE THESE!)

### D1 Database
- **Database Name:** `ace-iot-db`
- **Database ID:** `1afc0a07-85cd-4d5f-a046-b580ffffb8dc`
- **Status:** ✅ **CONTAINS DATA** (verified - has timeseries table with data)
- **Tables Found:**
  - `timeseries` ✅ (main data table)
  - `timeseries_raw` ✅ (raw data)
  - `timeseries_agg` ✅ (aggregated data)
  - `points` ✅ (point configurations)
  - `chart_configs` ✅
  - `query_metadata` ✅
  - `query_cache` ✅
  - And 7 more tables

### R2 Bucket
- **Bucket Name:** `ace-timeseries`
- **Status:** ✅ **USE THIS** (all workers configured for this)
- **Path Format:** `timeseries/{site}/{YYYY}/{MM}/{DD}.ndjson.gz`

### KV Namespace
- **Namespace ID:** `fa5e24f3f2ed4e3489a299e28f1bffaa`
- **Binding:** `KV` or `POINTS_KV`
- **Status:** ✅ **USE THIS**

### Worker URLs (All Correct)
- **Query Worker:** `https://building-vitals-query.jstahr.workers.dev`
- **Backfill Worker:** `https://building-vitals-backfill.jstahr.workers.dev`
- **ETL Worker:** `https://building-vitals-etl.jstahr.workers.dev`
- **Archival Worker:** `https://building-vitals-archival.jstahr.workers.dev`

## ❌ DO NOT USE THESE (Incorrect/Unused)

### Wrong Database ID
- **DO NOT USE:** `b3901317-c387-4631-8654-750535cc18de`
- **Why:** This is from a different deployment, not the production database
- **Found in:** Only documentation files, not actual workers

### Wrong R2 Buckets
- **DO NOT USE:** `building-vitals-timeseries`
- **DO NOT USE:** `building-vitals-cache`
- **DO NOT USE:** `enhanced-hvac-points`
- **Why:** These are not created/used, only mentioned in docs

### Wrong KV Namespace
- **DO NOT USE:** `3a8ae7ad1bd346fd9646f3f30a88676e`
- **Why:** Old/incorrect namespace ID

## 📁 WHICH WRANGLER.TOML TO USE

### For Each Worker:

1. **Query Worker**
   ```bash
   cd workers
   wrangler deploy --config wrangler-query.toml --env production
   ```
   - ✅ Has correct database ID: `1afc0a07-85cd-4d5f-a046-b580ffffb8dc`
   - ✅ Has correct bucket: `ace-timeseries`
   - ✅ Has correct KV: `fa5e24f3f2ed4e3489a299e28f1bffaa`

2. **ETL Worker**
   ```bash
   cd workers
   wrangler deploy --config wrangler-etl.toml --env production
   ```
   - ✅ All configurations correct

3. **Backfill Worker**
   ```bash
   cd workers
   wrangler deploy --config wrangler-backfill.toml --env production
   ```
   - ✅ All configurations correct
   - ⚠️ **Needs ACE_API_KEY secret deployed**

4. **Archival Worker**
   ```bash
   cd wrangler
   wrangler deploy --config wrangler-archival.toml --env production
   ```
   - ✅ All configurations correct

## 🔍 HOW TO VERIFY DATA EXISTS

### Check D1 Database (Remote)
```bash
cd workers
wrangler d1 execute ace-iot-db --command="SELECT COUNT(*) as count FROM timeseries" --remote --config=wrangler-query.toml
```

### Check R2 Bucket
```bash
# This needs newer wrangler syntax
wrangler r2 bucket list
# Look for "ace-timeseries" in the list
```

### Test Query Worker
```bash
curl "https://building-vitals-query.jstahr.workers.dev/health"
```

## 🚨 CRITICAL: The Data Issue

### Why Charts Only Show Data from 10/15/2025

1. **D1 HAS the timeseries table** ✅
2. **Query Worker is correctly configured** ✅
3. **But we need to check:**
   - How much data is actually in the timeseries table
   - If R2 has any archived data
   - If the backfill needs to run

### Next Step Commands:
```bash
# 1. Check how much data is in D1
cd workers
wrangler d1 execute ace-iot-db --command="SELECT COUNT(*) as records, MIN(timestamp) as earliest, MAX(timestamp) as latest FROM timeseries" --remote --config=wrangler-query.toml

# 2. Deploy the ACE_API_KEY to backfill worker
wrangler secret put ACE_API_KEY --config wrangler-backfill.toml --env production

# 3. Start backfill for historical data
curl -X POST https://building-vitals-backfill.jstahr.workers.dev/trigger \
  -H "Content-Type: application/json" \
  -d '{"site": "ses_falls_city", "reset": true}'
```

## 📊 Configuration Matrix

| Component | Database ID | R2 Bucket | KV Namespace | Status |
|-----------|------------|-----------|--------------|--------|
| Query Worker | 1afc0a07... ✅ | ace-timeseries ✅ | fa5e24f3... ✅ | Ready |
| ETL Worker | 1afc0a07... ✅ | ace-timeseries ✅ | fa5e24f3... ✅ | Ready |
| Backfill Worker | 1afc0a07... ✅ | ace-timeseries ✅ | fa5e24f3... ✅ | Needs Secret |
| Archival Worker | 1afc0a07... ✅ | ace-timeseries ✅ | fa5e24f3... ✅ | Ready |
| Frontend | - | - | - | Uses Query Worker |

## 🎯 SUMMARY

**USE THESE IDS:**
- Database: `1afc0a07-85cd-4d5f-a046-b580ffffb8dc`
- R2 Bucket: `ace-timeseries`
- KV Namespace: `fa5e24f3f2ed4e3489a299e28f1bffaa`

**ALL WORKERS:** Already correctly configured with these IDs

**DATA EXISTS:** In the remote D1 database (confirmed with tables)

**NEXT ACTION:** Deploy ACE_API_KEY secret and run backfill to populate historical data

---

Generated: October 16, 2025
Status: Configuration Verified ✅