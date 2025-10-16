# Deployment Commands - Wave 4 Workers

## ⚠️ CRITICAL: IMPLEMENTATION REQUIRED FIRST

**This deployment guide CANNOT be executed because the Wave 4 workers do not exist.**

Before following any deployment steps, you must first:
1. Implement Query Worker (`src/query-worker.js`)
2. Implement Archival Worker (`src/archival-worker.js`)
3. Implement Backfill Worker (`src/backfill-worker.js`)
4. Implement shared libraries (`src/lib/r2-client.js`, `src/lib/parquet-writer.js`)
5. Add Parquet dependencies to package.json
6. Create integration tests

**See deployment-readiness-report.md for full gap analysis.**

---

## When Implementation is Complete - Follow These Steps

### Phase 1: Dependency Installation

```bash
cd "C:\Users\jstahr\Desktop\Building Vitals\workers"

# Add Parquet dependencies (NOT YET IN package.json)
npm install --save hyparquet@^1.4.0
npm install --save parquet-wasm@^0.6.0

# Verify installation
npm list hyparquet parquet-wasm
```

**Expected Output:**
```
building-vitals-workers@1.0.0
├── hyparquet@1.4.0
└── parquet-wasm@0.6.0
```

---

### Phase 2: Cloudflare Resource Setup

#### Step 2.1: Create R2 Bucket

```bash
# Create R2 bucket for Parquet storage
wrangler r2 bucket create timeseries-archive

# Verify creation
wrangler r2 bucket list
```

**Expected Output:**
```
timeseries-archive
```

#### Step 2.2: Create KV Namespaces

```bash
# Create KV namespace for Query Worker cache
wrangler kv:namespace create QUERY_CACHE

# Create KV namespace for Archival Worker state
wrangler kv:namespace create ARCHIVE_STATE

# Create KV namespace for Backfill Worker progress
wrangler kv:namespace create BACKFILL_STATE

# List all namespaces
wrangler kv:namespace list
```

**Expected Output:**
```
[
  { "id": "abc123...", "title": "QUERY_CACHE" },
  { "id": "def456...", "title": "ARCHIVE_STATE" },
  { "id": "ghi789...", "title": "BACKFILL_STATE" }
]
```

**⚠️ IMPORTANT:** Copy the namespace IDs and manually configure them in Cloudflare Dashboard:
- Workers & Pages > [worker name] > Settings > Variables
- Add KV namespace bindings (do NOT hardcode IDs in wrangler.toml)

#### Step 2.3: Set Environment Variables

```bash
# ALLOWED_ORIGINS for CORS (Query Worker, Backfill Worker)
wrangler secret put ALLOWED_ORIGINS -c wrangler-query.toml
# Enter: https://building-vitals.web.app,https://building-vitals-staging.web.app

# ACE_API_KEY for ACE IoT API access (Backfill Worker)
wrangler secret put ACE_API_KEY -c wrangler-backfill.toml
# Enter: [your ACE API key]

# BACKFILL_API_KEY for backfill authentication (Backfill Worker)
wrangler secret put BACKFILL_API_KEY -c wrangler-backfill.toml
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Expected Output:**
```
✅ Secret ALLOWED_ORIGINS uploaded successfully
✅ Secret ACE_API_KEY uploaded successfully
✅ Secret BACKFILL_API_KEY uploaded successfully
```

---

### Phase 3: Database Binding (Manual Dashboard Configuration)

**⚠️ REQUIRED:** D1 database bindings MUST be configured via Cloudflare Dashboard (not wrangler.toml)

1. Navigate to: Cloudflare Dashboard > Workers & Pages > [worker name] > Settings > Variables
2. Add D1 Database Binding:
   - **Variable name:** `DB`
   - **D1 database:** `building-vitals-db`
3. Repeat for all three workers (query, archival, backfill)

**Why Manual?** Security best practice - no hardcoded database IDs in git-tracked files.

---

### Phase 4: Integration Testing (Local)

```bash
# Test Query Worker locally
wrangler dev -c wrangler-query.toml

# In another terminal, test endpoints
curl http://localhost:8787/health
# Expected: {"status":"healthy","timestamp":"2025-10-14T..."}

curl "http://localhost:8787/timeseries/query?site=ses_falls_city&points=point1,point2&start_time=1728864000000&end_time=1728950400000"
# Expected: {"point_samples":[...],"metadata":{...}}

# Stop with Ctrl+C
```

```bash
# Test Archival Worker locally (simulate cron)
wrangler dev -c wrangler-archival.toml

# In another terminal, trigger manually
curl -X POST http://localhost:8787/archive/trigger
# Expected: {"status":"started","archival_id":"..."}

# Check progress
curl http://localhost:8787/archive/status
# Expected: {"status":"in_progress","progress":{...}}
```

```bash
# Test Backfill Worker locally
wrangler dev -c wrangler-backfill.toml

# In another terminal, authenticate and start backfill
BACKFILL_TOKEN="your-backfill-api-key-here"

curl -X POST http://localhost:8787/backfill/start \
  -H "Authorization: Bearer $BACKFILL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_name": "ses_falls_city",
    "start_date": "2024-10-01",
    "end_date": "2024-10-07",
    "points": ["point1", "point2"]
  }'
# Expected: {"backfill_id":"...","status":"started"}

# Check backfill progress
curl http://localhost:8787/backfill/status?backfill_id=...
# Expected: {"status":"in_progress","days_processed":3,...}
```

---

### Phase 5: Deployment to Staging

#### Step 5.1: Deploy Query Worker

```bash
# Deploy to staging
wrangler deploy -c wrangler-query.toml --env staging

# Verify deployment
curl https://building-vitals-query-staging.jstahr.workers.dev/health
# Expected: {"status":"healthy",...}

# Test actual query
curl "https://building-vitals-query-staging.jstahr.workers.dev/timeseries/query?site=ses_falls_city&points=point1&start_time=1728864000000&end_time=1728950400000"
# Expected: {"point_samples":[...],...}
```

#### Step 5.2: Deploy Archival Worker

```bash
# Deploy to staging
wrangler deploy -c wrangler-archival.toml --env staging

# Verify cron is scheduled
wrangler deployments list -c wrangler-archival.toml
# Expected: Shows worker with cron "0 2 * * *"

# Manually trigger archival (don't wait for 2 AM)
curl -X POST https://building-vitals-archival-staging.jstahr.workers.dev/archive/trigger
# Expected: {"status":"started",...}

# Monitor progress
wrangler tail -c wrangler-archival.toml --env staging
# Watch for: "Archival started", "Parquet file uploaded", "D1 cleanup complete"
```

#### Step 5.3: Deploy Backfill Worker

```bash
# Deploy to staging
wrangler deploy -c wrangler-backfill.toml --env staging

# Test authentication (should fail without token)
curl -X POST https://building-vitals-backfill-staging.jstahr.workers.dev/backfill/start \
  -H "Content-Type: application/json" \
  -d '{"site_name":"test"}'
# Expected: {"error":"Unauthorized","status":401}

# Test with valid token
BACKFILL_TOKEN="your-backfill-api-key"
curl -X POST https://building-vitals-backfill-staging.jstahr.workers.dev/backfill/start \
  -H "Authorization: Bearer $BACKFILL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_name": "ses_falls_city",
    "start_date": "2024-10-01",
    "end_date": "2024-10-07",
    "points": ["point1", "point2"]
  }'
# Expected: {"backfill_id":"...","status":"started"}
```

---

### Phase 6: Staging Validation

#### Step 6.1: Validate R2 Files Created

```bash
# List R2 bucket contents
wrangler r2 object list timeseries-archive --prefix timeseries/2024/

# Expected output (example):
# timeseries/2024/10/01/ses_falls_city.parquet (42.3 MB)
# timeseries/2024/10/02/ses_falls_city.parquet (41.8 MB)
# timeseries/2024/10/03/ses_falls_city.parquet (43.1 MB)
```

#### Step 6.2: Validate Parquet File Integrity

```bash
# Download a sample file
wrangler r2 object get timeseries-archive/timeseries/2024/10/01/ses_falls_city.parquet --file test.parquet

# Install parquet-tools (if not already installed)
npm install -g parquet-tools

# Inspect Parquet schema
parquet-tools schema test.parquet
# Expected:
# message timeseries {
#   required int64 timestamp;
#   required binary point_name (STRING);
#   required double value;
#   required binary site_name (STRING);
# }

# Check row count
parquet-tools rowcount test.parquet
# Expected: ~288,000 rows (50k points * 288 samples/day / some filtering)

# Sample data
parquet-tools head test.parquet -n 5
# Expected: Valid timestamp, point_name, value, site_name rows
```

#### Step 6.3: Validate Cross-Worker Consistency

```bash
# Query data from D1 (recent)
curl "https://building-vitals-query-staging.jstahr.workers.dev/timeseries/query?site=ses_falls_city&points=point1&start_time=$(date -d '5 days ago' +%s)000&end_time=$(date +%s)000"
# Expected: Data from D1, fast response (<500ms)

# Query data from R2 (historical)
curl "https://building-vitals-query-staging.jstahr.workers.dev/timeseries/query?site=ses_falls_city&points=point1&start_time=$(date -d '30 days ago' +%s)000&end_time=$(date -d '25 days ago' +%s)000"
# Expected: Data from R2, slower response (<5s)

# Query data spanning D1/R2 boundary
curl "https://building-vitals-query-staging.jstahr.workers.dev/timeseries/query?site=ses_falls_city&points=point1&start_time=$(date -d '25 days ago' +%s)000&end_time=$(date +%s)000"
# Expected: Merged data from both sources, no gaps at 20-day boundary
```

---

### Phase 7: Production Deployment

**⚠️ IMPORTANT:** Only proceed if all staging validations pass.

#### Step 7.1: Deploy Query Worker (Production)

```bash
# Deploy Query Worker
wrangler deploy -c wrangler-query.toml --env production

# Verify health
curl https://building-vitals-query.jstahr.workers.dev/health
# Expected: {"status":"healthy",...}

# Test with production data
curl "https://building-vitals-query.jstahr.workers.dev/timeseries/query?site=ses_falls_city&points=ses%2Fses_falls_city%2F1000%3A1-1001%2FanalogInput%2F0&start_time=$(date -d '7 days ago' +%s)000&end_time=$(date +%s)000"
# Expected: Valid timeseries data
```

#### Step 7.2: Deploy Archival Worker (Production)

```bash
# Deploy Archival Worker
wrangler deploy -c wrangler-archival.toml --env production

# Verify cron schedule
wrangler deployments list -c wrangler-archival.toml
# Expected: Cron "0 2 * * *" (daily at 2 AM UTC)

# DO NOT manually trigger in production - wait for scheduled run at 2 AM
```

**Monitor First Production Run:**
```bash
# Set alarm for 2 AM UTC, then watch logs
wrangler tail -c wrangler-archival.toml --env production

# Expected log sequence:
# [2:00 AM] Archival started for date: 2025-09-XX
# [2:01 AM] Fetched 1.2M records from D1
# [2:03 AM] Created Parquet file: 42.1 MB (uncompressed) -> 38.4 MB (compressed)
# [2:05 AM] Uploaded to R2: timeseries/2025/09/XX/ses_falls_city.parquet
# [2:06 AM] Verified R2 upload successful
# [2:08 AM] Deleted 1.2M records from D1
# [2:08 AM] Archival complete: processed 1.2M records in 8.2 minutes
```

#### Step 7.3: Deploy Backfill Worker (Production)

```bash
# Deploy Backfill Worker
wrangler deploy -c wrangler-backfill.toml --env production

# Test authentication
curl -X POST https://building-vitals-backfill.jstahr.workers.dev/backfill/start \
  -d '{"site_name":"test"}'
# Expected: {"error":"Unauthorized","status":401}
```

**Run Production Backfill (1 Year):**
```bash
BACKFILL_TOKEN="your-production-backfill-api-key"

# Start 1-year backfill
curl -X POST https://building-vitals-backfill.jstahr.workers.dev/backfill/start \
  -H "Authorization: Bearer $BACKFILL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_name": "ses_falls_city",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "points": []
  }'
# Expected: {"backfill_id":"bf-20251014-..."","status":"started","estimated_duration_hours":45}

# Monitor progress (check every few hours)
curl "https://building-vitals-backfill.jstahr.workers.dev/backfill/status?backfill_id=bf-20251014-..."
# Expected: {"status":"in_progress","days_completed":42,"days_remaining":323,...}

# Check logs for errors
wrangler tail -c wrangler-backfill.toml --env production | grep ERROR
```

---

### Phase 8: Post-Deployment Monitoring

#### Step 8.1: Query Worker Monitoring

```bash
# Monitor query latency
wrangler tail -c wrangler-query.toml --env production | grep "query_duration"
# Expected: D1 queries <500ms, R2 queries <5s

# Check cache hit rate
curl https://building-vitals-query.jstahr.workers.dev/metrics
# Expected: {"cache_hit_rate": 0.75, "avg_query_duration_ms": 234, ...}
```

#### Step 8.2: Archival Worker Monitoring

```bash
# Check archival success rate
curl https://building-vitals-archival.jstahr.workers.dev/archive/stats
# Expected: {"successful_archivals": 14, "failed_archivals": 0, ...}

# Verify D1 size is stable
wrangler d1 execute building-vitals-db --command "SELECT COUNT(*) FROM timeseries"
# Expected: ~5-6M rows (20 days * 288 samples/day * 50k points / filtering)

# Monitor R2 bucket growth
wrangler r2 object list timeseries-archive --prefix timeseries/ | wc -l
# Expected: Increases by 1 file per day
```

#### Step 8.3: Backfill Worker Monitoring

```bash
# Check backfill progress (while running)
watch -n 300 "curl -s 'https://building-vitals-backfill.jstahr.workers.dev/backfill/status?backfill_id=bf-...' | jq '.days_completed'"
# Run every 5 minutes until complete

# When complete, verify data
curl https://building-vitals-backfill.jstahr.workers.dev/backfill/status?backfill_id=bf-...
# Expected: {"status":"completed","total_days":365,"total_records":1.8B,"duration_hours":47.2}
```

---

### Phase 9: Frontend Integration

#### Step 9.1: Update Frontend API Endpoint

**File:** `Building-Vitals/src/config/api.config.ts`

```typescript
// Change from:
export const API_BASE_URL = 'https://building-vitals-unified.jstahr.workers.dev';

// To:
export const API_BASE_URL = 'https://building-vitals-query.jstahr.workers.dev';
```

#### Step 9.2: Update API Client

**File:** `Building-Vitals/src/services/api/cloudflareWorkerClient.ts`

```typescript
// Change endpoint from:
const response = await axios.get('/timeseries/unified', { params });

// To:
const response = await axios.get('/timeseries/query', { params });
```

#### Step 9.3: Deploy Frontend Changes

```bash
cd "C:\Users\jstahr\Desktop\Building Vitals\Building-Vitals"

# Build production bundle
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

#### Step 9.4: Validate Frontend

1. Open: https://building-vitals.web.app
2. Navigate to chart builder
3. Select a point from ses_falls_city
4. Query recent data (last 7 days)
   - Expected: Fast load (<1s), data from D1
5. Query historical data (30-60 days ago)
   - Expected: Slower load (<5s), data from R2
6. Query data spanning 20-day boundary
   - Expected: Merged results, no visible gaps

---

### Phase 10: Performance Validation

#### Run Load Tests

```bash
# Install load testing tool
npm install -g artillery

# Create load test config
cat > load-test.yml <<EOF
config:
  target: "https://building-vitals-query.jstahr.workers.dev"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Query recent data"
    flow:
      - get:
          url: "/timeseries/query?site=ses_falls_city&points=point1&start_time={{$timestamp(-604800000)}}&end_time={{$timestamp()}}"
EOF

# Run load test
artillery run load-test.yml

# Expected results:
# - Requests: 600
# - Success rate: >99%
# - Median latency: <300ms
# - p95 latency: <800ms
# - p99 latency: <2000ms
```

---

## Rollback Procedures

### If Query Worker Fails

```bash
# Revert frontend to old endpoint
# Update Building-Vitals/src/config/api.config.ts back to:
export const API_BASE_URL = 'https://building-vitals-unified.jstahr.workers.dev';

# Redeploy frontend
firebase deploy --only hosting

# Delete failing worker deployment
wrangler delete -c wrangler-query.toml --env production
```

### If Archival Worker Fails

```bash
# Disable cron trigger
wrangler deployments list -c wrangler-archival.toml
# Note deployment ID
wrangler deployments rollback <deployment-id> -c wrangler-archival.toml

# Clean up partial R2 files
wrangler r2 object delete timeseries-archive/timeseries/YYYY/MM/DD/site.parquet
```

### If Backfill Worker Fails

```bash
# Cancel running backfill
BACKFILL_TOKEN="your-token"
curl -X POST https://building-vitals-backfill.jstahr.workers.dev/backfill/cancel \
  -H "Authorization: Bearer $BACKFILL_TOKEN" \
  -d '{"backfill_id":"bf-..."}'

# Clean up partial data (if needed)
# Check KV for last successful checkpoint
wrangler kv:key get "backfill:bf-...:state" --binding BACKFILL_STATE
```

---

## Troubleshooting

### Query Worker Returns Empty Results

**Symptom:** Query returns `{"point_samples":[]}`

**Diagnosis:**
```bash
# Check if data exists in D1
wrangler d1 execute building-vitals-db --command "SELECT COUNT(*) FROM timeseries WHERE point_name = 'your-point'"

# Check if data exists in R2
wrangler r2 object list timeseries-archive --prefix timeseries/2024/10/
```

**Common Causes:**
- Point name encoding issue (URL encode slashes and colons)
- Timestamp range outside available data
- R2 path mismatch (check path generation)

### Archival Worker Not Running

**Symptom:** No new R2 files after 2 AM UTC

**Diagnosis:**
```bash
# Check cron logs
wrangler tail -c wrangler-archival.toml --env production

# Check archival state
curl https://building-vitals-archival.jstahr.workers.dev/archive/status
```

**Common Causes:**
- Cron trigger not configured
- D1 binding missing
- R2 binding missing
- Parquet-wasm initialization error

### Backfill Worker Timeout

**Symptom:** Backfill status shows "stalled" or "timeout"

**Diagnosis:**
```bash
# Check KV state
wrangler kv:key get "backfill:bf-...:state" --binding BACKFILL_STATE

# Check logs for timeout
wrangler tail -c wrangler-backfill.toml | grep "timeout\|exceeded"
```

**Fix:**
```bash
# Resume from last checkpoint
curl -X POST https://building-vitals-backfill.jstahr.workers.dev/backfill/resume \
  -H "Authorization: Bearer $BACKFILL_TOKEN" \
  -d '{"backfill_id":"bf-..."}'
```

---

## Success Criteria

### ✅ Deployment Successful If:

1. **Query Worker:**
   - /health returns 200 OK
   - D1 queries return data in <500ms
   - R2 queries return data in <5s
   - Split queries merge correctly
   - Cache hit rate >70%

2. **Archival Worker:**
   - Cron runs daily at 2 AM UTC
   - Parquet files created in R2
   - D1 size remains stable (<7.5GB)
   - No data loss during archival
   - Compression ratio >4:1

3. **Backfill Worker:**
   - Authentication works
   - 365-day backfill completes in <50 hours
   - Resumable after timeout
   - All dates have Parquet files
   - No duplicate data

4. **Frontend:**
   - Charts load historical data
   - No errors in console
   - Query latency acceptable
   - Data continuous across D1/R2 boundary

---

**Document Version:** 1.0
**Last Updated:** 2025-10-14
**Status:** ⚠️ BLOCKED - Awaiting Implementation
