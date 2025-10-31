# Supabase Compute & Disk Capacity Recommendations

## Current Symptoms

**Statement Timeouts Observed:**
- ✗ Count queries timing out (`upstream request timeout`)
- ✗ Continuous sync failing with statement timeout errors
- ✗ Auto-discovery operations (7,327 point upserts) causing timeouts

**Root Cause:** Likely running on a **small compute tier** (Nano/Micro/Small) that cannot sustain the workload.

## Supabase Compute Tiers (Source: Supabase Docs)

### Free/Small Tiers (NOT Recommended for Our Use Case)
- **Nano**: Shared CPU, 0.5 GB RAM, 500 MB max DB ❌
- **Micro**: Shared ARM, 1 GB RAM, 8 GB max DB ❌
- **Small**: Shared ARM, 2 GB RAM, 16 GB max DB ⚠️

**Problem:** "Smaller compute instances have baseline performance levels that can occasionally be exceeded for short periods" but **cannot sustain high throughput**.

### Recommended Tiers for Time-Series Data
- **Medium**: Shared ARM, 4 GB RAM, 100 GB max DB ✓ (Minimum for our workload)
- **Large**: 2 dedicated cores, 8 GB RAM, 200 GB max DB ✓✓ (Recommended)
- **XL+**: 4+ dedicated cores, 16+ GB RAM ✓✓✓ (Best for sustained performance)

## Our Workload Analysis

### Current Scale
- **7,327 configured points** (points table)
- **~400,000 October samples** to backfill
- **Estimated database size**: Unknown (count query times out)
- **Real-time ingestion**: Every 5 minutes, ~2,174 active points

### Performance Requirements
1. **Backfill Operations**: Large batch inserts (50-1000 rows at a time)
2. **Real-Time Sync**: 5-minute continuous ingestion
3. **Query Performance**: Dashboard queries, point counts, aggregations
4. **Concurrent Operations**: Auto-discovery + data sync + user queries

### Critical Quote from Docs
> "If workloads exceed provisioned IOPS/throughput, **throttling will occur**"

This explains our statement timeouts!

## Recommendations

### Immediate Action (Before Running October Backfill)

**Option 1: Upgrade to Medium Tier** (Conservative)
- ✓ 4 GB RAM
- ✓ Shared ARM cores (can burst)
- ✓ 100 GB max database
- ✓ Better sustained performance
- Cost: Moderate increase

**Option 2: Upgrade to Large Tier** (Recommended)
- ✓✓ 2 dedicated cores (no sharing!)
- ✓✓ 8 GB RAM
- ✓✓ 200 GB max database
- ✓✓ Designed for sustained high performance
- Cost: Higher but worth it for production workload

### How to Check Current Tier

1. Go to: https://supabase.com/dashboard/project/jywxcqcjsvlyehuvsoar/settings/addons
2. Look for "Compute" section
3. Check current tier and upgrade options

### Monitoring During Backfill

Once upgraded, monitor these metrics in Supabase Dashboard:
1. **CPU Utilization** - Should stay below 80%
2. **Disk IO % consumed** - If >1%, consider larger tier
3. **Memory usage** - Watch for OOM issues
4. **Statement timeouts** - Should disappear after upgrade

## Key Constraints to Know

### Auto-Scaling
⚠️ **Supabase does NOT auto-scale compute**. Manual upgrades required.
- Downtime: "Less than 2 minutes" during upgrade
- Cannot be automated

### Disk Space
✓ Can increase disk size anytime
✗ Cannot decrease once increased
⚠️ 6-hour cooldown between disk changes

### Our October Backfill Impact

**Estimated Data to Insert:**
- 400,000 rows × ~24 bytes/row = ~9.6 MB raw data
- With indexes + overhead: ~50-100 MB total
- **Verdict**: Storage is NOT the issue, compute/IOPS is!

## Optimizations Already Implemented

Our script is already optimized:
- ✓ Batch inserts (50-1000 rows)
- ✓ In-memory deduplication before insert
- ✓ Two-tier strategy (INSERT → UPSERT fallback)
- ✓ Point cache to avoid repeated lookups
- ✓ Empty page detection
- ✓ Efficient pagination

**Despite all optimizations, small compute tiers will still timeout.**

## October Backfill Strategy

### If You Can Upgrade (Recommended):
1. Upgrade to **Large tier** (2 dedicated cores)
2. Wait 2 minutes for database restart
3. Run: `scripts\run-october-quick.bat`
4. Monitor Disk IO in dashboard
5. Backfill should complete in ~5-10 minutes

### If You Cannot Upgrade (Workaround):
1. Split October into smaller windows (1 day at a time)
2. Run during off-peak hours (less concurrent load)
3. Reduce batch sizes in script (change `50` to `20` on line 395)
4. Accept longer total runtime (might take hours)
5. Still may experience timeouts with very small tiers

## Cost-Benefit Analysis

**Medium Tier (~$25/month)**
- Handles current workload ✓
- Some margin for growth ✓
- May still see occasional slowdowns ⚠️

**Large Tier (~$100/month)**
- Handles current workload easily ✓✓
- Room for 3-5x growth ✓✓
- Dedicated cores = consistent performance ✓✓
- Best choice for production system ✓✓✓

**Cost of NOT Upgrading:**
- Statement timeouts blocking operations ✗
- Failed backfills and data gaps ✗
- Developer time debugging issues ✗
- Poor user experience ✗

## Next Steps

1. **Check your current tier** in Supabase dashboard
2. **Upgrade to Large tier** before running October backfill
3. **Run the backfill**: `scripts\run-october-quick.bat`
4. **Monitor dashboard** during execution
5. **Keep Large tier** for production workload

---

**Date**: 2025-10-31
**Status**: CRITICAL - Upgrade recommended before large backfills
**Impact**: Current tier cannot sustain our time-series workload
