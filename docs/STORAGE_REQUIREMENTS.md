# Storage Requirements Analysis - Building Vitals

## Collection Parameters
- **Points per Site**: 10,000 - 20,000 points
- **Collection Interval**: Every 2 minutes
- **Retention Period**: 12 months
- **Samples per Point per Year**: 262,800

## Storage Calculations

### Raw Data Storage
Each timeseries sample requires:
- `point_id` (bigint): 8 bytes
- `ts` (timestamptz): 8 bytes
- `value` (double precision): 8 bytes
- Row overhead: ~8 bytes
- **Total per sample**: 32 bytes

### 12-Month Storage Requirements

#### 10,000 Points
- **Total Samples**: 2.63 billion samples
- **Raw Data**: 84 GB
- **With Indexes (1.6x)**: 134 GB
- **Points Table**: 2 MB
- **📊 TOTAL NEEDED**: **134 GB**

#### 20,000 Points
- **Total Samples**: 5.26 billion samples
- **Raw Data**: 168 GB
- **With Indexes (1.6x)**: 270 GB
- **Points Table**: 4 MB
- **📊 TOTAL NEEDED**: **270 GB**

## Supabase Plan Comparison

| Plan | Storage | Monthly Cost | Fits 10K? | Fits 20K? |
|------|---------|--------------|-----------|-----------|
| **Pro** | 8 GB | $25 | ❌ No | ❌ No |
| **Team** | 100 GB | $599 | ❌ No | ❌ No |
| **Enterprise** | Custom | Custom | ✅ Yes | ✅ Yes |

**Issue**: Even Team plan (100 GB) is insufficient for full 12-month retention.

## Cost Analysis (Without Optimization)

### Naive Approach: Supabase Enterprise
- **Monthly Cost**: ~$2,000+ (custom pricing)
- **vs Cloudflare**: Still saves money, but expensive

## 🚀 Optimization Strategies

### Option 1: TimescaleDB Compression (RECOMMENDED)
**What**: Automatic time-series compression (built into PostgreSQL)
**Compression Ratio**: 10:1 typical for time-series data
**Cost**: FREE (available on Team+ plans)

**Storage After Compression**:
- **10K points**: 134 GB → **13.4 GB** ✅ Fits Pro ($25/mo)
- **20K points**: 270 GB → **27 GB** ✅ Fits Pro ($25/mo) with headroom

**Implementation**:
```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert timeseries table to hypertable
SELECT create_hypertable('timeseries', 'ts',
  chunk_time_interval => INTERVAL '1 month',
  if_not_exists => TRUE
);

-- Enable compression
ALTER TABLE timeseries SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'point_id',
  timescaledb.compress_orderby = 'ts DESC'
);

-- Add compression policy (compress data older than 7 days)
SELECT add_compression_policy('timeseries', INTERVAL '7 days');
```

**Result**: Stay on Pro plan ($25/mo) even with 20,000 points!

---

### Option 2: Hybrid Hot/Cold Storage
**What**: Keep recent data in Supabase, archive old data to R2/S3
**Hot Storage**: Last 30 days in Supabase (fast queries)
**Cold Storage**: 11 months in Cloudflare R2 (cheap archival)

**Storage Breakdown**:
- **Hot (Supabase Pro)**:
  - 10K points: 11 GB (fits Pro)
  - 20K points: 23 GB (fits Pro)
- **Cold (Cloudflare R2)**:
  - 10K points: 123 GB × $0.015/GB = $1.85/month
  - 20K points: 247 GB × $0.015/GB = $3.70/month

**Total Monthly Cost**:
- **10K points**: $25 + $1.85 = **$26.85/month**
- **20K points**: $25 + $3.70 = **$28.70/month**

**Implementation**:
1. Weekly job archives data >30 days to R2 (Parquet format)
2. Edge Function queries Supabase first, falls back to R2 for old data
3. R2 queries use DuckDB-WASM for Parquet querying

---

### Option 3: Reduce Retention to 6 Months
**What**: Keep only 6 months of data instead of 12
**Storage Needed**:
- **10K points**: 67 GB (needs Team plan - $599/mo)
- **20K points**: 135 GB (needs Enterprise plan)

**Not Recommended**: Still expensive, loses historical data value

---

### Option 4: PostgreSQL TOAST Compression (Partial Solution)
**What**: Enable column-level compression (built-in PostgreSQL)
**Compression Ratio**: 30-50% reduction
**Cost**: FREE

**Storage After Compression**:
- **10K points**: 134 GB → 80 GB (still needs Team plan)
- **20K points**: 270 GB → 162 GB (still needs Enterprise)

**Implementation**:
```sql
-- Enable TOAST compression on value column
ALTER TABLE timeseries ALTER COLUMN value SET STORAGE EXTENDED;
```

**Result**: Helps but not enough for Pro plan

---

## Recommended Solution: TimescaleDB + Compression

### Architecture
```
Frontend Charts
  ↓
Supabase Edge Function
  ↓
TimescaleDB (with compression)
  ↓ (automatic compression after 7 days)
Compressed chunks (10:1 ratio)
```

### Cost Breakdown
- **Supabase Pro**: $25/month
- **TimescaleDB**: FREE (built into PostgreSQL)
- **GitHub Actions Sync**: $0/month (within free tier)
- **Total**: **$25/month**

### Storage Usage
- **10K points**: 13.4 GB / 8 GB included = needs small overage
- **Overage cost**: 5.4 GB × $0.125/GB = $0.68/month
- **Total with overage**: $25.68/month

- **20K points**: 27 GB / 8 GB included = needs overage
- **Overage cost**: 19 GB × $0.125/GB = $2.38/month
- **Total with overage**: $27.38/month

**Still 96% cheaper than Cloudflare!**

---

## Alternative: Team Plan for Peace of Mind

If you want to avoid overage costs and have headroom for growth:

### Supabase Team Plan
- **Storage**: 100 GB included
- **Monthly Cost**: $599
- **Fits**: 20K points with TimescaleDB compression (27 GB)
- **Headroom**: 73 GB remaining for growth

**vs Cloudflare**: $599 vs $900 = saves $301/month = $3,612/year

**When to Choose Team**:
- Multiple sites (5+ sites)
- Need read replicas for performance
- Want dedicated support
- Anticipate growing beyond 30K points

---

## Comparison Table

| Solution | 10K Points | 20K Points | vs Cloudflare Savings |
|----------|------------|------------|----------------------|
| **Pro + TimescaleDB** | $25.68/mo | $27.38/mo | **$10,300/year** ✅ |
| **Pro + Hot/Cold** | $26.85/mo | $28.70/mo | **$10,250/year** ✅ |
| **Team (no compression)** | N/A | N/A | Too large |
| **Team + TimescaleDB** | $599/mo | $599/mo | **$3,612/year** ✅ |
| **Cloudflare Workers** | $900/mo | $900/mo | $0 baseline |

---

## Implementation Timeline

### Week 1: Enable TimescaleDB Compression
1. **Enable TimescaleDB extension** in Supabase dashboard
2. **Convert timeseries table** to hypertable
3. **Enable compression policy** (7 days)
4. **Monitor storage reduction** over next week

### Week 2: Verify Compression
1. **Check storage usage** in Supabase dashboard
2. **Should see 50%+ reduction** as data compresses
3. **After 7 days**: All data older than 7 days compressed
4. **After 30 days**: Full 10:1 compression ratio achieved

### Week 3: Optimize Queries
1. **Update Edge Function** to work with compressed data
2. **Test query performance** (should be similar or faster)
3. **Monitor memory usage**

### Week 4: Backfill October
1. **Run parallel backfill** for October
2. **Compression applies automatically** to old data
3. **Final storage should be ~15-30 GB**

---

## Expected Final Storage (With TimescaleDB)

### After Full Implementation
- **Current (1 month partial)**: 7.6 GB
- **12 months uncompressed**: 134 GB (10K) / 270 GB (20K)
- **12 months compressed**: 13.4 GB (10K) / 27 GB (20K)
- **Compression ratio**: **10:1**

### Pro Plan Capacity
- **Included**: 8 GB
- **10K points**: Needs 5.4 GB overage ($0.68/mo)
- **20K points**: Needs 19 GB overage ($2.38/mo)
- **Total cost**: $25-28/month

**Still 96-97% cheaper than Cloudflare!** 🎉

---

## Recommendation

### Start with Pro + TimescaleDB
1. **Cost**: $25-28/month (including small overage)
2. **Storage**: Handles 20K points easily
3. **Performance**: Better than uncompressed (fewer disk reads)
4. **Scalability**: Can grow to 30K+ points before considering Team plan

### Upgrade to Team if:
- You add 5+ sites
- You exceed 30K points per site
- You need read replicas for performance
- You want dedicated support

### Never Need Enterprise unless:
- 100+ sites
- 100K+ points per site
- Custom SLA requirements
- On-premises deployment needed
