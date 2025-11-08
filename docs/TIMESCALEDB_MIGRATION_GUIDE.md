# TimescaleDB Migration Guide

## Overview
This guide walks through migrating from PostgreSQL native partitioning to TimescaleDB hypertables with compression, reducing storage by 90-95%.

## Prerequisites

1. **Supabase Pro Tier** (TimescaleDB extension available)
2. **Database backup** (recommended)
3. **Maintenance window** (migration takes ~5-30 minutes depending on data size)

## Migration Steps

### Step 1: Enable TimescaleDB Extension

Run via Supabase SQL Editor:

```sql
-- Check if TimescaleDB is available
SELECT * FROM pg_available_extensions WHERE name = 'timescaledb';

-- Enable the extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Verify installation
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
```

**Expected output**: Version 2.x.x

### Step 2: Apply Migrations

```bash
# Apply migrations in order
supabase db push
```

Or manually via SQL Editor:

1. `supabase/migrations/20251101000000_enable_timescaledb.sql`
2. `supabase/migrations/20251101000001_convert_to_hypertable.sql`

### Step 3: Migrate Data

```bash
# Connect to database via psql or SQL Editor
psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

# Run migration script
\i scripts/migrate_to_timescaledb.sql
```

**Or** copy/paste `scripts/migrate_to_timescaledb.sql` into Supabase SQL Editor

### Step 4: Update Application Code

Update your workers to use the new table:

**Option A**: Use the view (no code changes needed)
```javascript
// timeseries_view automatically unions old and new tables
const { data } = await supabase
  .from('timeseries_view')
  .select('*')
```

**Option B**: Update direct table references
```javascript
// Change from 'timeseries' to 'timeseries_compressed'
const { data } = await supabase
  .from('timeseries_compressed')
  .select('*')
```

### Step 5: Monitor Compression

Check compression status:

```sql
-- View compression settings
SELECT * FROM timescaledb_information.compression_settings;

-- View chunk compression status
SELECT
  chunk_schema || '.' || chunk_name as chunk,
  pg_size_pretty(before_compression_total_bytes) as before,
  pg_size_pretty(after_compression_total_bytes) as after,
  round(100 - (after_compression_total_bytes::numeric / before_compression_total_bytes::numeric * 100), 2) as saved_pct
FROM timescaledb_information.compressed_chunk_stats
ORDER BY chunk_name DESC
LIMIT 10;

-- Manually compress a specific chunk (for testing)
SELECT compress_chunk(show_chunks('timeseries_compressed', older_than => INTERVAL '7 days') LIMIT 1);
```

### Step 6: Verify & Cutover

Once data is migrated and verified:

```sql
-- Check row counts match
SELECT
  (SELECT count(*) FROM timeseries) as old_count,
  (SELECT count(*) FROM timeseries_compressed) as new_count,
  (SELECT count(*) FROM timeseries) = (SELECT count(*) FROM timeseries_compressed) as counts_match;

-- Verify recent data is queryable
SELECT point_id, ts, value
FROM timeseries_compressed
ORDER BY ts DESC
LIMIT 100;
```

### Step 7: Final Cutover (Optional)

**WARNING**: Only do this after thorough testing!

```sql
-- Rename tables (makes timeseries_compressed the new timeseries)
BEGIN;
  DROP TABLE IF EXISTS public.timeseries CASCADE;
  ALTER TABLE public.timeseries_compressed RENAME TO timeseries;
  DROP VIEW IF EXISTS public.timeseries_view;
COMMIT;
```

## Compression Policies

Automatic compression is configured to:

- **Compress chunks** older than 7 days
- **Retain data** for 12 months
- **Run daily** via TimescaleDB background jobs

View active policies:

```sql
SELECT * FROM timescaledb_information.jobs;
```

## Expected Results

### Storage Reduction
- **Before**: ~18 GB (uncompressed partitioned table)
- **After**: ~1-2 GB (90-95% compression)
- **Savings**: ~16 GB (~$2/month on Pro tier)

### Query Performance
- **Recent data** (last 7 days): Same or better (uncompressed chunks)
- **Historical data**: Slightly slower on first query (decompression), cached thereafter
- **Range queries**: Much faster due to smaller data size

## Troubleshooting

### Extension not available
```
ERROR: extension "timescaledb" is not available
```

**Solution**: Contact Supabase support to enable TimescaleDB on your instance.

### Compression not running
```sql
-- Check job status
SELECT * FROM timescaledb_information.job_stats
WHERE job_id IN (SELECT job_id FROM timescaledb_information.jobs WHERE proc_name = 'policy_compression');

-- Manually run compression
CALL run_job((SELECT job_id FROM timescaledb_information.jobs WHERE proc_name = 'policy_compression' LIMIT 1));
```

### Migration taking too long
```sql
-- Monitor progress
SELECT
  n_tup_ins as rows_inserted,
  n_tup_upd as rows_updated
FROM pg_stat_user_tables
WHERE relname = 'timeseries_compressed';
```

## Rollback Plan

If issues occur:

```sql
-- Switch back to old table
DROP TABLE IF EXISTS public.timeseries_compressed;
-- Original timeseries table remains untouched until final cutover
```

## Next Steps

After successful migration:

1. Update continuous sync to write to `timeseries_compressed`
2. Monitor disk usage in Supabase dashboard
3. Schedule regular VACUUM ANALYZE
4. Consider aggregation tables for dashboard queries

## References

- [TimescaleDB Compression Docs](https://docs.timescale.com/use-timescale/latest/compression/)
- [Supabase Extensions](https://supabase.com/docs/guides/database/extensions)
- [TimescaleDB Best Practices](https://docs.timescale.com/timescaledb/latest/how-to-guides/compression/)
