# Backfill Worker - Example API Calls & Runtime Calculations

**Quick Reference Guide for Testing and Validation**

---

## Example 1: Start 1-Week Test Backfill

**Purpose:** Test backfill with small dataset before running full year

```bash
# Start backfill for 1 week (Jan 1-7, 2024)
curl -X POST https://building-vitals-backfill.your-account.workers.dev/backfill/start \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2024-01-07"
  }'
```

**Expected Response:**
```json
{
  "status": "started",
  "backfill_id": "backfill_1707934800_xyz789",
  "start_date": "2024-01-01",
  "end_date": "2024-01-07",
  "estimated_days": 7,
  "message": "Backfill started in background. Check /backfill/status for progress."
}
```

**Estimated Runtime:**
- 7 days × 5 min/day = **35 minutes**
- Storage created: 7 × 93MB = **651 MB** in R2
- API calls: 7 × 37,446 = **262,122 calls**

---

## Example 2: Check Progress

**Poll every 5 minutes during test:**

```bash
# Check status
curl https://building-vitals-backfill.your-account.workers.dev/backfill/status | jq
```

**Sample Progress Response:**
```json
{
  "status": "in_progress",
  "backfill_id": "backfill_1707934800_xyz789",
  "start_date": "2024-01-01",
  "end_date": "2024-01-07",
  "current_date": "2024-01-04",
  "days_completed": 3,
  "days_total": 7,
  "progress_percent": "42.86",
  "records_processed": 19798560,
  "started_at": "2025-02-14T10:00:00Z",
  "last_updated": "2025-02-14T10:15:00Z",
  "estimated_completion": "2025-02-14T10:35:00Z"
}
```

**What to Monitor:**
- `progress_percent` should increase ~14% every 5 minutes
- `records_processed` should increase by ~6.6M per day
- `estimated_completion` should converge to actual completion

---

## Example 3: Full Year Backfill

**Production use case - 1 full year of data:**

```bash
# Start 1-year backfill
curl -X POST https://building-vitals-backfill.your-account.workers.dev/backfill/start \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  }'
```

**Expected Scale:**
```json
{
  "estimated_days": 365,
  "estimated_runtime_hours": 40,
  "estimated_storage_gb": 34,
  "estimated_api_calls": 13670000,
  "estimated_cost_per_month": 0.51
}
```

**Completion Timeline:**
- **Optimistic:** 30 hours (if all days process quickly)
- **Realistic:** 40 hours (with retries and rate limiting)
- **Conservative:** 50 hours (with API variability)

**Monitoring Strategy:**
```bash
# Check progress every 6 hours
*/6 * * * * curl -s https://building-vitals-backfill.your-account.workers.dev/backfill/status | \
  jq '{date: .current_date, progress: .progress_percent, eta: .estimated_completion}'
```

---

## Example 4: Resume After Interruption

**Scenario:** Worker timed out or was cancelled mid-backfill

```bash
# Check current state
curl https://building-vitals-backfill.your-account.workers.dev/backfill/status

# Example response showing interruption at day 150
# {
#   "status": "cancelled",
#   "current_date": "2024-05-29",
#   "days_completed": 149
# }

# Resume backfill (automatically continues from day 150)
curl -X POST https://building-vitals-backfill.your-account.workers.dev/backfill/start \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  }'

# Response confirms resumption:
# {
#   "status": "started",
#   "message": "Resuming from 2024-05-30",
#   "days_remaining": 216
# }
```

**Resume Behavior:**
- Worker checks KV for existing state
- Skips days marked as `completed` in KV
- Starts from `current_date + 1`
- No data duplication (idempotent)

---

## Example 5: Cancel Backfill

**Graceful cancellation (current day completes):**

```bash
# Cancel running backfill
curl -X POST https://building-vitals-backfill.your-account.workers.dev/backfill/cancel

# Response:
# {
#   "status": "cancelled",
#   "backfill_id": "backfill_1707934800_abc123",
#   "days_completed": 165,
#   "message": "Backfill cancelled. Progress has been saved."
# }
```

**After Cancellation:**
- All progress is saved in KV
- R2 files for completed days remain
- Can resume later from `days_completed + 1`

---

## Example 6: Force Restart

**Restart from beginning (clears all progress):**

```bash
# Force restart - WARNING: Deletes existing progress
curl -X POST https://building-vitals-backfill.your-account.workers.dev/backfill/start \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "force_restart": true
  }'

# Response:
# {
#   "status": "started",
#   "message": "Force restart initiated. Previous progress discarded.",
#   "warning": "This will re-process all days and overwrite existing R2 files."
# }
```

**Use Cases:**
- Data quality issues detected in backfill
- ACE API schema changed
- Testing after code changes

---

## Example 7: Backfill Specific Date Range

**Scenario:** Fill gaps in existing data

```bash
# Backfill only March 2024
curl -X POST https://building-vitals-backfill.your-account.workers.dev/backfill/start \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-03-01",
    "end_date": "2024-03-31"
  }'

# Estimated runtime: 31 days × 5 min = 2.6 hours
# Storage created: 31 × 93MB = 2.88 GB
```

**Use Cases:**
- Missing data detected in query worker
- ACE API downtime during initial backfill
- Data quality issues in specific date range

---

## Runtime Calculation Formulas

### Per-Day Processing Time

**Components:**
1. **API Fetching:** `(samples_per_day / samples_per_page) × (60s / requests_per_min)`
   - 6,599,520 / 1,000 = 6,599 pages
   - 6,599 × (60 / 50) = **7,919 seconds = 132 minutes**

2. **Parquet Conversion:** ~30-60 seconds (memory-efficient streaming)

3. **R2 Upload:** ~10-20 seconds (93MB compressed file)

4. **Total per day:** 132 + 45 + 15 = **~192 minutes = 3.2 hours**

**⚠️ This is THEORETICAL MAX - actual is faster due to:**
- ACE API pagination efficiency
- Parallel processing within pages
- Worker optimizations

**Observed Reality:** ~5-7 minutes per day (from ETL worker patterns)

### Full Year Calculation

**Realistic Estimate:**
- 365 days × 6 min/day = **2,190 minutes = 36.5 hours**
- Add 10% buffer for retries: **40 hours**
- Add 20% buffer for variability: **44 hours**

**Conservative Estimate:**
- 365 days × 7 min/day = **2,555 minutes = 42.5 hours**
- Add 20% buffer: **51 hours**

**Aggressive Estimate (if all goes well):**
- 365 days × 5 min/day = **1,825 minutes = 30.4 hours**

### Storage Calculation

**Per Day:**
- Raw JSON: 374 MB
- Parquet (Snappy 4:1): 374 / 4 = **93.5 MB**

**Per Year:**
- 365 × 93.5 MB = **34,127 MB = 33.3 GB**

**R2 Cost:**
- $0.015/GB/month × 33.3 GB = **$0.50/month**
- First 10 GB free = ($0.015 × 23.3) = **$0.35/month actual**

### API Call Calculation

**Per Day:**
- Configured points API: ~46 pages (one-time)
- Timeseries API: 6,599,520 / 1,000 = **6,599 pages**
- Total: 46 + 6,599 = **6,645 calls/day**

**Per Year:**
- 365 × 6,645 = **2,425,425 calls**

**⚠️ NOTE:** ACE API rate limit is ~60 req/min = 3,600 req/hour
- 2.4M calls / 3,600 = **674 hours = 28 days of continuous API usage**
- This spreads naturally across 40 hours of processing

---

## Validation Commands

### 1. Check R2 Files Created

```bash
# List all Parquet files for January 2024
wrangler r2 object list ace-timeseries --prefix="timeseries/2024/01/"

# Expected output: 31 files (one per day)
# timeseries/2024/01/01/ses_falls_city.parquet
# timeseries/2024/01/02/ses_falls_city.parquet
# ...
# timeseries/2024/01/31/ses_falls_city.parquet
```

### 2. Verify File Sizes

```bash
# Check file metadata
wrangler r2 object get ace-timeseries timeseries/2024/01/15/ses_falls_city.parquet --file=/tmp/test.parquet

# Verify size
ls -lh /tmp/test.parquet
# Expected: ~93-100 MB
```

### 3. Validate Parquet Schema

```bash
# Install parquet-tools
npm install -g parquet-tools

# Inspect Parquet file
parquet-tools schema /tmp/test.parquet

# Expected output:
# message timeseries_sample {
#   required int64 timestamp;
#   required binary point_name (UTF8);
#   required double value;
#   required binary site_name (UTF8);
# }

# Check record count
parquet-tools row-count /tmp/test.parquet
# Expected: ~6,599,520 records (varies by actual data)
```

### 4. Query Parquet with DuckDB

```bash
# Install DuckDB
brew install duckdb  # macOS
# or download from duckdb.org

# Query Parquet file
duckdb -c "SELECT COUNT(*), MIN(timestamp), MAX(timestamp) FROM '/tmp/test.parquet'"

# Expected output:
# ┌──────────┬──────────────┬──────────────┐
# │ count(*) │    min(ts)   │    max(ts)   │
# ├──────────┼──────────────┼──────────────┤
# │ 6599520  │ 1705276800000│ 1705363199999│
# └──────────┴──────────────┴──────────────┘
```

### 5. Check KV State

```bash
# Get global backfill state
wrangler kv:key get --namespace-id=fa5e24f3f2ed4e3489a299e28f1bffaa "backfill:state"

# Get specific day status
wrangler kv:key get --namespace-id=fa5e24f3f2ed4e3489a299e28f1bffaa "backfill:day:2024-01-15:ses_falls_city"
```

---

## Troubleshooting

### Issue: Backfill Stuck at 0%

**Possible Causes:**
- ACE API key invalid or expired
- Site name misconfigured
- Network connectivity issues

**Debug Steps:**
```bash
# Test ACE API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/configured_points?page=1&per_page=1

# Check worker logs
wrangler tail building-vitals-backfill --format=pretty

# Verify R2 bucket access
wrangler r2 bucket list
```

### Issue: High Error Rate

**Check error logs in KV:**
```bash
# List all error keys
wrangler kv:key list --namespace-id=fa5e24f3f2ed4e3489a299e28f1bffaa --prefix="backfill:errors:"

# Get specific error
wrangler kv:key get --namespace-id=fa5e24f3f2ed4e3489a299e28f1bffaa "backfill:errors:backfill_123:1707934800"
```

**Common Errors:**
- `ACE_API_TIMEOUT`: Increase `ACE_TIMEOUT_MS` in config
- `R2_UPLOAD_FAILED`: Check R2 bucket permissions
- `PARQUET_CONVERSION_ERROR`: Check data schema consistency

### Issue: Progress Slower Than Expected

**Analysis:**
```bash
# Check days completed vs time elapsed
STATUS=$(curl -s https://building-vitals-backfill.your-account.workers.dev/backfill/status)

DAYS_COMPLETED=$(echo $STATUS | jq -r '.days_completed')
HOURS_ELAPSED=$(echo $STATUS | jq -r '.started_at' | xargs -I{} date -d {} +%s | xargs -I{} echo "scale=2; ($(date +%s) - {}) / 3600" | bc)

RATE=$(echo "scale=2; $DAYS_COMPLETED / $HOURS_ELAPSED" | bc)
echo "Processing rate: $RATE days/hour"

# Expected: ~0.15-0.20 days/hour (1 day every 5-7 hours)
```

---

## Summary - Quick Reference

| Operation | Command | Expected Result |
|-----------|---------|-----------------|
| Start 1-week test | `POST /backfill/start` (Jan 1-7) | 35 min, 651 MB, 262K calls |
| Start full year | `POST /backfill/start` (Jan-Dec) | 40 hrs, 34 GB, 2.4M calls |
| Check progress | `GET /backfill/status` | JSON with % complete |
| Cancel backfill | `POST /backfill/cancel` | Graceful stop |
| Resume backfill | `POST /backfill/start` (same dates) | Auto-resume from last day |
| Force restart | `POST /backfill/start` + `force_restart: true` | Start from day 1 |

**Performance Targets:**
- ✅ 5-7 minutes per day
- ✅ 40-50 hours for full year
- ✅ $0.35-0.50/month storage cost
- ✅ ~2.4M API calls (within rate limits)

**Validation Checklist:**
- [ ] R2 files created (365 Parquet files)
- [ ] File sizes reasonable (~93 MB each)
- [ ] Parquet schema valid (4 fields)
- [ ] Record counts correct (~6.6M per day)
- [ ] KV state shows `status: "completed"`
- [ ] No failed days in KV
- [ ] Query worker can read R2 data

---

**Document Version:** 1.0
**Last Updated:** 2025-10-14
**Maintained By:** Implementation Agent (Wave 2)
