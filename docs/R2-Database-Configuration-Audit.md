# R2 Storage & Database Configuration Audit Report

**Project:** Building Vitals - ACE IoT Timeseries Platform
**Date:** 2025-01-16
**Audit Scope:** R2 bucket configuration, D1 database schema, data lifecycle, and retention policies

---

## Executive Summary

### Critical Findings

**DATA VISIBILITY ISSUE IDENTIFIED:** Multiple misconfigurations in data retention and archival settings may be limiting data availability:

1. **Hot/Cold Storage Boundary Inconsistency** - Different values across files (20 vs 30 days)
2. **Aggressive Data Deletion** - D1 trigger deletes data older than 30 days automatically
3. **Incomplete Archival Process** - R2 archival may not be running or completing successfully
4. **Missing Data Lifecycle Management** - No R2 expiration policies or lifecycle rules configured

### Configuration Summary

| Setting | Configuration File | Current Value | Status |
|---------|-------------------|---------------|---------|
| D1 Hot Storage Retention | `migrations/001_initial_schema.sql` | **30 days** | Auto-delete via trigger |
| Query Worker Hot Boundary | `src/query-worker.js` | **20 days** | Inconsistent with D1 |
| Query Router Hot Boundary | `src/lib/query-router.js` | **30 days** | Matches D1 trigger |
| Archival Worker Threshold | `src/archival-worker.js` | **20 days** | Inconsistent with D1 |
| R2 Bucket Lifecycle | `wrangler.toml` | **Not configured** | No expiration rules |
| CRON Schedule | `wrangler.toml` | Daily at 2:00 AM UTC | May not be active |

---

## 1. R2 Bucket Configuration

### 1.1 Bucket Bindings (wrangler.toml)

**Location:** `C:\Users\jstahr\Desktop\Building Vitals\wrangler.toml`

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "ace-timeseries"
preview_bucket_name = "ace-timeseries-preview"
```

**Findings:**
- ✅ Bucket binding configured correctly
- ✅ Separate preview bucket for development
- ❌ **No lifecycle rules configured** - R2 data never expires
- ❌ **No storage quotas defined** - Could grow unbounded
- ❌ **No versioning configured** - No protection against accidental deletion

### 1.2 R2 Object Storage Structure

**Expected Path Format:** `/timeseries/YYYY/MM/DD/{point_id}.parquet`

**Analysis:**
- **Daily partitioning** - One Parquet file per point per day
- **Compression:** Snappy compression (4:1 ratio expected)
- **Format:** Apache Parquet with custom metadata
- **Metadata:** `uploadedAt`, `format`, `compression` fields

**Issues:**
- ❌ No documented retention policy for R2 objects
- ❌ No monitoring for R2 upload failures
- ❌ No verification that archival CRON job is running
- ❌ No fallback mechanism if R2 writes fail

### 1.3 R2 Access Policies

**Configuration:** Not explicitly defined in code

**Recommendations:**
- Configure R2 bucket access policies via Cloudflare dashboard
- Implement read-only access for query workers
- Implement write-only access for archival workers
- Enable R2 audit logging

---

## 2. D1 Database Schema & Retention

### 2.1 Schema Configuration

**Location:** `C:\Users\jstahr\Desktop\Building Vitals\migrations\001_initial_schema.sql`

#### Timeseries Table Schema

```sql
CREATE TABLE IF NOT EXISTS timeseries (
    timestamp INTEGER NOT NULL,
    point_id INTEGER NOT NULL,
    value REAL NOT NULL,
    quality INTEGER NOT NULL DEFAULT 192,
    flags INTEGER DEFAULT 0,
    PRIMARY KEY (point_id, timestamp),
    FOREIGN KEY (point_id) REFERENCES points(id) ON DELETE CASCADE
) WITHOUT ROWID;
```

**Capacity Planning (from schema comments):**
- 4,500 data points
- ~1 sample/minute/point = 1,440 samples/day/point
- Total: 6,480,000 samples/day
- **30-day retention: 194,400,000 samples**
- Estimated size: ~9.72 GB (within 10GB D1 limit)

### 2.2 **CRITICAL: Automatic Data Deletion Trigger**

**Location:** `migrations/001_initial_schema.sql` (lines 176-184)

```sql
CREATE TRIGGER IF NOT EXISTS tr_timeseries_retention
AFTER INSERT ON timeseries
BEGIN
    -- Calculate 30-day cutoff
    DELETE FROM timeseries
    WHERE timestamp < (NEW.timestamp - 2592000000)  -- 30 days in milliseconds
      AND ABS(RANDOM() % 1000) = 0;  -- Run cleanup 0.1% of the time
END;
```

**CRITICAL FINDING:**
- ⚠️ **Data older than 30 days is automatically deleted from D1**
- ⚠️ **Deletion happens BEFORE archival to R2 completes**
- ⚠️ **No verification that R2 archival succeeded before deletion**
- ⚠️ **Probabilistic execution (0.1% chance per insert) = unreliable timing**

**Data Loss Risk:**
If the archival worker (CRON job) is not running or fails:
1. Data reaches 30 days old
2. Trigger fires and deletes data from D1
3. **Data is permanently lost** if not yet archived to R2

### 2.3 D1 Table Schema (Building-Vitals Worker)

**Location:** `C:\Users\jstahr\Desktop\Building Vitals\workers\schema\d1-schema.sql`

```sql
CREATE TABLE IF NOT EXISTS timeseries_raw (
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  timestamp INTEGER NOT NULL,  -- Unix timestamp (SECONDS)
  value REAL NOT NULL,
  PRIMARY KEY (site_name, point_name, timestamp)
) WITHOUT ROWID;
```

**Findings:**
- ✅ Efficient WITHOUT ROWID optimization (25% space savings)
- ✅ Composite primary key prevents duplicates
- ❌ **No retention trigger in this schema** - Different retention policy?
- ❌ **Timestamp in SECONDS vs MILLISECONDS** - Inconsistent with other schemas

---

## 3. Data Lifecycle & Expiration Settings

### 3.1 Hot/Cold Storage Boundary (CRITICAL INCONSISTENCY)

**Multiple conflicting values found:**

| File | Variable | Value | Line |
|------|----------|-------|------|
| `src/archival-worker.js` | `ARCHIVE_THRESHOLD_DAYS` | **20 days** | Line 52 |
| `src/query-worker.js` | `HOT_STORAGE_DAYS` | **20 days** | Line 35 |
| `src/lib/query-router.js` | `HOT_STORAGE_DAYS` | **30 days** | Line 20 |
| `migrations/001_initial_schema.sql` | Trigger cutoff | **30 days** | Line 182 |

**Impact of Inconsistency:**

1. **Archival worker archives at 20 days** → Data moved to R2 at day 20
2. **D1 trigger deletes at 30 days** → 10-day gap where data exists in D1 but not R2
3. **Query router thinks hot boundary is 30 days** → Queries for data 20-30 days old will miss R2 data
4. **Query worker thinks hot boundary is 20 days** → Queries for data 20-30 days old will only check R2

**Data Visibility Gap:**
```
Day 0-19:  ✅ In D1, queries work correctly
Day 20-29: ⚠️ In R2, but query router thinks it's in D1 = DATA NOT VISIBLE
Day 30+:   ❌ Deleted from D1, query router checks R2 correctly
```

### 3.2 Archival Process Configuration

**Location:** `src/archival-worker.js`

#### Archival CRON Schedule

**Location:** `wrangler.toml` (lines 68-72)

```toml
[triggers]
crons = [
  "0 2 * * *"  # Daily at 2:00 AM UTC
]
```

**Critical Questions:**
- ❓ Is this CRON job actually deployed and running?
- ❓ Are there logs showing successful archival runs?
- ❓ What happens if archival fails (disk full, R2 unavailable)?
- ❓ Is there monitoring/alerting for archival failures?

#### Archival Process Safety

**Positive Findings:**
- ✅ Atomic upload-then-delete pattern (lines 362-421)
- ✅ R2 upload verification with HEAD request (line 391)
- ✅ Retry logic with exponential backoff (lines 366-382)
- ✅ KV state tracking for resumability (line 133)

**Concerns:**
- ⚠️ No alerting if archival fails after max retries
- ⚠️ No dead letter queue for failed archival jobs
- ⚠️ No mechanism to re-archive if R2 objects are accidentally deleted

### 3.3 R2 Object Expiration (NOT CONFIGURED)

**Finding:** No R2 lifecycle rules configured in `wrangler.toml`

**Recommendation:**
```toml
# Add to wrangler.toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "ace-timeseries"

# R2 Lifecycle Rules (configure via Cloudflare dashboard)
# - Delete objects older than ARCHIVE_RETENTION_DAYS (365 days per config)
# - Transition to Glacier storage after 90 days (if available)
```

Current `vars.ARCHIVE_RETENTION_DAYS = "365"` (line 116) is **not enforced** - just a comment.

---

## 4. Connection Strings & Environment Variables

### 4.1 Database Bindings

**D1 Database Binding:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "ace-iot-db"
# database_id removed for security
```

**Security:**
- ✅ Database ID not hardcoded (good security practice)
- ✅ Configuration via Cloudflare dashboard/CLI
- ❌ No connection pooling configuration
- ❌ No query timeout configuration (potential DoS risk)

### 4.2 Environment Variables

**Location:** `wrangler.toml` (lines 112-136)

```toml
[vars]
LOG_LEVEL = "info"
MAX_QUERY_RANGE_DAYS = "90"
ARCHIVE_RETENTION_DAYS = "365"  # ⚠️ Not enforced!
ENABLE_PARQUET_CACHE = "true"
BATCH_INSERT_SIZE = "100"
MAX_POINTS = "4500"
D1_QUERY_TIMEOUT_MS = "30000"
R2_DOWNLOAD_TIMEOUT_MS = "60000"
ENABLE_ARCHIVE_WORKER = "true"  # ⚠️ Is this actually enabled in production?
```

**Critical Variables:**
- `ARCHIVE_RETENTION_DAYS = "365"` - **This value is not used anywhere in the code!**
- `ENABLE_ARCHIVE_WORKER = "true"` - **Need to verify this is true in production environment**

### 4.3 Secrets Management

**Documented secrets** (not in config files - good!):
- `ACE_API_KEY` - API authentication
- `BACKFILL_API_KEY` - Backfill endpoint auth
- `SENTRY_DSN` - Error tracking
- `GRAFANA_API_KEY` - Metrics

**Recommendation:** Verify all secrets are set in production environment

---

## 5. Storage Limits & Quotas

### 5.1 Cloudflare Workers Limits

**From wrangler.toml comments** (lines 198-213):

#### Free Tier:
- 100,000 requests/day
- 10ms CPU time/request
- 128 MB memory/request
- **5 GB D1 storage** (capacity planning shows 9.72 GB needed!)
- 10 GB R2 storage

#### Paid Tier:
- Unlimited requests ($0.30/million after 10M)
- 50ms CPU time/request
- 128 MB memory/request
- 5 GB D1 storage + $0.75/GB
- 10 GB R2 storage + $0.015/GB

**CRITICAL:** Free tier D1 limit (5 GB) is **insufficient** for stated capacity (9.72 GB)

### 5.2 Query Limits

**Location:** `src/query-worker.js` (lines 37-41)

```javascript
MAX_POINTS_PER_QUERY: 100,
MAX_QUERY_RANGE_DAYS: 365,
MAX_SAMPLES_LIMIT: 1000000,  // 1 million samples max
MIN_TIMESTAMP: 946684800000  // 2000-01-01
```

**Findings:**
- ✅ Reasonable query limits to prevent abuse
- ✅ Sample count limit prevents memory exhaustion
- ❌ No rate limiting configuration
- ❌ No per-user query quotas

### 5.3 R2 Storage Quotas

**Not configured in any file**

**Recommendation:**
- Set R2 bucket quota alerts (e.g., warn at 80%, block at 95%)
- Configure monitoring for R2 storage growth rate
- Implement archival to cheaper storage tier after 90 days

---

## 6. Root Cause Analysis: Data Not Showing

### 6.1 Identified Issues

Based on this audit, **data may not be visible** due to:

1. **Hot/Cold Boundary Mismatch** (MOST LIKELY)
   - Query worker looks for data 20+ days old in R2
   - Query router thinks data <30 days old is in D1
   - **Result:** Data 20-30 days old may not be retrieved at all

2. **Archival CRON Not Running**
   - If `ENABLE_ARCHIVE_WORKER = "false"` in production
   - Or if CRON trigger was never deployed
   - **Result:** Data reaches 30 days, gets deleted by trigger, never archived

3. **R2 Upload Failures**
   - No monitoring for archival worker errors
   - Failed uploads not retried indefinitely
   - **Result:** Data deleted from D1 but not in R2

4. **Inconsistent Timestamp Units**
   - D1 schema uses SECONDS (timeseries_raw)
   - Other schemas use MILLISECONDS
   - **Result:** Timestamp queries may fail or return no data

5. **D1 Trigger Timing**
   - Probabilistic execution (0.1% chance) = unpredictable cleanup
   - May fire before archival worker runs
   - **Result:** Data deleted before archival completes

### 6.2 Data Visibility Test

**To diagnose the issue, check:**

```sql
-- Check if data exists in D1
SELECT COUNT(*), MIN(timestamp), MAX(timestamp)
FROM timeseries
WHERE point_id = <test_point_id>;

-- Check age of oldest data
SELECT
  (unixepoch('now') * 1000 - MIN(timestamp)) / (1000 * 60 * 60 * 24) as days_old
FROM timeseries;
```

```bash
# Check if R2 archival is running
wrangler tail --env production | grep "archival"

# Check last archival run
wrangler kv:key get --namespace=KV "last_archive_run"

# List R2 objects to verify archival
wrangler r2 object list ace-timeseries --prefix=timeseries/
```

---

## 7. Recommendations & Action Items

### 7.1 Immediate Actions (Critical)

1. **FIX HOT/COLD BOUNDARY INCONSISTENCY**
   - **Action:** Standardize on **20 days** across all files
   - **Files to update:**
     - `src/lib/query-router.js` line 20: Change `HOT_STORAGE_DAYS = 30` to `20`
     - `migrations/001_initial_schema.sql` line 182: Change trigger cutoff to 20 days (`1728000000` ms)
   - **Priority:** CRITICAL - This is likely causing the data visibility issue

2. **VERIFY ARCHIVAL CRON IS RUNNING**
   - Check Cloudflare dashboard for scheduled trigger status
   - Review logs for last archival run
   - Verify `ENABLE_ARCHIVE_WORKER = "true"` in production vars
   - **Priority:** CRITICAL

3. **ADD ARCHIVAL FAILURE MONITORING**
   - Configure alerting for archival worker failures
   - Add metrics to Analytics Engine
   - Set up Sentry/Grafana alerts for missing data
   - **Priority:** HIGH

4. **VERIFY D1 STORAGE CAPACITY**
   - Check current D1 usage vs 5 GB free tier limit
   - Upgrade to paid tier if needed
   - **Priority:** HIGH (may cause write failures if limit exceeded)

### 7.2 Short-Term Actions (Within 1 Week)

5. **REMOVE OR MODIFY D1 RETENTION TRIGGER**
   - Current trigger is unsafe (deletes before archival verification)
   - **Option A:** Remove trigger, rely on archival worker for cleanup
   - **Option B:** Add archival verification check before deletion
   - **Priority:** HIGH

6. **IMPLEMENT R2 LIFECYCLE POLICIES**
   - Configure automatic deletion of R2 objects older than 365 days
   - Set up lifecycle rules in Cloudflare dashboard
   - **Priority:** MEDIUM

7. **ADD QUERY MONITORING**
   - Track queries that return zero results
   - Log hot/cold routing decisions
   - Monitor cache hit rates
   - **Priority:** MEDIUM

8. **STANDARDIZE TIMESTAMP UNITS**
   - Choose milliseconds or seconds consistently
   - Update schema migrations if needed
   - **Priority:** MEDIUM

### 7.3 Long-Term Improvements

9. **IMPLEMENT DATA INTEGRITY CHECKS**
   - Daily verification that D1 data has corresponding R2 archives
   - Automated backfill if gaps detected
   - **Priority:** LOW

10. **ADD VERSIONING TO R2 BUCKETS**
    - Protect against accidental deletion
    - Enable recovery of archived data
    - **Priority:** LOW

11. **IMPLEMENT GRADUATED STORAGE TIERS**
    - Hot: D1 (0-20 days)
    - Warm: R2 Standard (20-90 days)
    - Cold: R2 Infrequent Access or Glacier (90+ days)
    - **Priority:** LOW (optimization)

12. **ADD QUERY RESULT VALIDATION**
    - Detect when expected data ranges return no results
    - Auto-fallback to alternative storage tier
    - User-facing warnings when data gaps detected
    - **Priority:** LOW

---

## 8. Configuration Checklist

### 8.1 Pre-Deployment Verification

Before deploying to production, verify:

- [ ] Hot/cold boundary consistent across all files (20 days)
- [ ] Archival CRON schedule deployed and enabled
- [ ] `ENABLE_ARCHIVE_WORKER = "true"` in production vars
- [ ] D1 database created with correct schema
- [ ] R2 bucket created and accessible
- [ ] KV namespace created for state tracking
- [ ] All secrets configured (ACE_API_KEY, etc.)
- [ ] D1 storage tier sufficient for capacity (paid tier if >5 GB)
- [ ] CORS allowed origins configured
- [ ] Monitoring/alerting configured

### 8.2 Runtime Health Checks

Monitor these indicators:

- [ ] Archival worker runs successfully daily
- [ ] R2 upload success rate > 99%
- [ ] D1 storage usage < 80% of limit
- [ ] Query cache hit rate > 50%
- [ ] Zero-result query rate < 5%
- [ ] D1 query latency < 500ms p95
- [ ] R2 query latency < 5s p95

---

## 9. Files Audited

### Configuration Files
- `C:\Users\jstahr\Desktop\Building Vitals\wrangler.toml`
- `C:\Users\jstahr\Desktop\Building Vitals\workers\wrangler.toml`
- `C:\Users\jstahr\Desktop\Building Vitals\.env.example`

### Database Schemas
- `C:\Users\jstahr\Desktop\Building Vitals\migrations\001_initial_schema.sql`
- `C:\Users\jstahr\Desktop\Building Vitals\workers\schema\d1-schema.sql`
- `C:\Users\jstahr\Desktop\Building Vitals\workers\schema\d1-migrations.sql`

### Worker Code
- `C:\Users\jstahr\Desktop\Building Vitals\src\archival-worker.js`
- `C:\Users\jstahr\Desktop\Building Vitals\src\query-worker.js`
- `C:\Users\jstahr\Desktop\Building Vitals\src\lib\query-router.js`
- `C:\Users\jstahr\Desktop\Building Vitals\src\lib\r2-client.js`
- `C:\Users\jstahr\Desktop\Building Vitals\src\lib\d1-client.js`

### Test Files
- `C:\Users\jstahr\Desktop\Building Vitals\tests\workers\archival-process.test.js`
- `C:\Users\jstahr\Desktop\Building Vitals\tests\workers\query-routing.test.js`
- `C:\Users\jstahr\Desktop\Building Vitals\tests\workers\d1-operations.test.js`

---

## 10. Glossary

- **D1**: Cloudflare's SQLite-based edge database
- **R2**: Cloudflare's S3-compatible object storage
- **KV**: Cloudflare's key-value store
- **Hot Storage**: Recent data in D1 (fast access, expensive)
- **Cold Storage**: Historical data in R2 (slower access, cheap)
- **Parquet**: Columnar storage format (efficient for analytics)
- **CRON**: Scheduled task trigger
- **TTL**: Time To Live (cache expiration)
- **WASM**: WebAssembly (for DuckDB query engine)

---

## Conclusion

The audit identified **critical inconsistencies** in hot/cold storage boundary configuration that are **very likely causing the data visibility issue**. The 10-day gap between archival threshold (20 days) and D1 retention (30 days) creates a window where data may exist in neither D1 nor R2, or where queries route to the wrong storage tier.

**Next Steps:**
1. Standardize hot/cold boundary to 20 days across all files
2. Verify archival CRON job is running in production
3. Add monitoring for data gaps and archival failures
4. Remove or fix the unsafe D1 retention trigger

**Estimated Time to Fix:** 2-4 hours (code changes + deployment + verification)

**Risk Level:** HIGH - Data loss possible if archival not running
