-- Migration script to move data from partitioned table to TimescaleDB hypertable
-- Run this AFTER applying the migrations

-- Check current row counts
DO $$
DECLARE
  old_count bigint;
  new_count bigint;
BEGIN
  SELECT count(*) INTO old_count FROM public.timeseries;
  SELECT count(*) INTO new_count FROM public.timeseries_compressed;

  RAISE NOTICE 'Old partitioned table rows: %', old_count;
  RAISE NOTICE 'New compressed table rows: %', new_count;
  RAISE NOTICE 'Rows to migrate: %', (old_count - new_count);
END $$;

-- Migrate data in batches (to avoid long locks)
-- This copies all data from the old table to the new compressed table
INSERT INTO public.timeseries_compressed (point_id, ts, value)
SELECT point_id, ts, value
FROM public.timeseries
WHERE NOT EXISTS (
  SELECT 1 FROM public.timeseries_compressed tc
  WHERE tc.point_id = timeseries.point_id
    AND tc.ts = timeseries.ts
)
ON CONFLICT DO NOTHING;

-- Verify migration
DO $$
DECLARE
  old_count bigint;
  new_count bigint;
BEGIN
  SELECT count(*) INTO old_count FROM public.timeseries;
  SELECT count(*) INTO new_count FROM public.timeseries_compressed;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Old table rows: %', old_count;
  RAISE NOTICE 'New table rows: %', new_count;

  IF old_count = new_count THEN
    RAISE NOTICE '✓ Row counts match - migration successful!';
  ELSE
    RAISE WARNING '⚠ Row count mismatch - please investigate';
  END IF;
END $$;

-- Show compression stats
SELECT
  hypertable_name,
  before_compression_total_bytes,
  after_compression_total_bytes,
  pg_size_pretty(before_compression_total_bytes) as before_size,
  pg_size_pretty(after_compression_total_bytes) as after_size,
  round(100 - (after_compression_total_bytes::numeric / before_compression_total_bytes::numeric * 100), 2) as compression_ratio_pct
FROM timescaledb_information.compression_settings
WHERE hypertable_name = 'timeseries_compressed';

-- OPTIONAL: After verifying data migration, you can drop the old partitioned table
-- UNCOMMENT ONLY WHEN READY:
-- DROP TABLE IF EXISTS public.timeseries CASCADE;
-- ALTER TABLE public.timeseries_compressed RENAME TO timeseries;
-- DROP VIEW IF EXISTS public.timeseries_view;
