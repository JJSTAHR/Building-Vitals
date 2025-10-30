-- ============================================================================
-- Enable TimescaleDB for 10:1 Compression (134 GB → 13.4 GB)
-- ============================================================================
--
-- This migration enables TimescaleDB compression on the timeseries table.
-- After enabling, data older than 7 days will automatically compress at 10:1 ratio.
--
-- CRITICAL: Run this BEFORE backfilling October data to prevent storage overflow!
--
-- Expected Results:
-- - 10K points: 134 GB → 13.4 GB (saves ~$15/month in overage)
-- - 20K points: 270 GB → 27 GB (saves ~$30/month in overage)
-- ============================================================================

-- Step 1: Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Step 2: Convert timeseries table to hypertable
-- This enables time-series optimizations and compression
SELECT create_hypertable(
  'timeseries',           -- table name
  'ts',                   -- time column
  chunk_time_interval => INTERVAL '1 month',  -- monthly partitions
  migrate_data => true,   -- migrate existing data
  if_not_exists => TRUE   -- idempotent
);

-- Step 3: Enable compression settings
ALTER TABLE timeseries SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'point_id',  -- Segment by point for better compression
  timescaledb.compress_orderby = 'ts DESC'      -- Order by time descending for fast recent queries
);

-- Step 4: Add automatic compression policy
-- Compresses data older than 7 days automatically
SELECT add_compression_policy(
  'timeseries',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

-- Step 5: Verify compression is enabled
SELECT
  h.table_name,
  h.compression_enabled,
  c.compress_after,
  c.compress_orderby,
  c.compress_segmentby
FROM timescaledb_information.hypertables h
LEFT JOIN timescaledb_information.compression_settings c
  ON h.hypertable_name = c.hypertable_name
WHERE h.table_name = 'timeseries';

-- Step 6: Check current chunks and compression status
SELECT
  chunk_name,
  range_start,
  range_end,
  is_compressed,
  CASE
    WHEN is_compressed THEN pg_size_pretty(compressed_total_bytes)
    ELSE pg_size_pretty(uncompressed_total_bytes)
  END as size,
  CASE
    WHEN is_compressed THEN
      round(100.0 * compressed_total_bytes / NULLIF(uncompressed_total_bytes, 0), 1)
    ELSE NULL
  END as compression_ratio_percent
FROM timescaledb_information.chunks
WHERE hypertable_name = 'timeseries'
ORDER BY range_start DESC
LIMIT 10;

-- ============================================================================
-- Manual Compression (Optional)
-- ============================================================================
-- If you want to compress existing data immediately instead of waiting 7 days:
--
-- SELECT compress_chunk(i, if_not_compressed => true)
-- FROM show_chunks('timeseries', older_than => INTERVAL '7 days') i;
--
-- WARNING: This can take several minutes for large datasets.
-- It's better to let the automatic policy handle it gradually.
-- ============================================================================

-- ============================================================================
-- Expected Storage Reduction Timeline
-- ============================================================================
-- Day 0 (today): Enable compression
-- Day 1-7: New data stays uncompressed
-- Day 8: Data from Day 1 starts compressing (automatic background job)
-- Day 14: Half of data compressed (~50% storage reduction)
-- Day 30: All data >7 days compressed (~90% storage reduction)
--
-- Monitor progress:
-- SELECT
--   count(*) FILTER (WHERE is_compressed) as compressed_chunks,
--   count(*) FILTER (WHERE NOT is_compressed) as uncompressed_chunks,
--   pg_size_pretty(sum(compressed_total_bytes)) as compressed_size,
--   pg_size_pretty(sum(uncompressed_total_bytes)) as uncompressed_size,
--   round(100.0 * sum(compressed_total_bytes) / NULLIF(sum(uncompressed_total_bytes), 0), 1) as compression_ratio
-- FROM timescaledb_information.chunks
-- WHERE hypertable_name = 'timeseries';
-- ============================================================================
