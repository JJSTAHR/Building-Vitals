-- Convert timeseries from PostgreSQL partitioned table to TimescaleDB hypertable
-- WARNING: This requires migrating data from existing partitioned table

-- Step 1: Create new TimescaleDB hypertable
CREATE TABLE IF NOT EXISTS public.timeseries_compressed (
  point_id bigint NOT NULL REFERENCES public.points(id),
  ts timestamptz NOT NULL,
  value double precision NOT NULL
);

-- Step 2: Convert to hypertable (7-day chunks for better compression)
SELECT create_hypertable(
  'timeseries_compressed',
  'ts',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- Step 3: Create indexes for query performance
CREATE INDEX IF NOT EXISTS timeseries_compressed_point_ts_idx ON timeseries_compressed (point_id, ts DESC);
CREATE INDEX IF NOT EXISTS timeseries_compressed_ts_idx ON timeseries_compressed (ts DESC);

-- Step 4: Enable compression on the hypertable
ALTER TABLE timeseries_compressed SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'point_id',
  timescaledb.compress_orderby = 'ts DESC'
);

-- Step 5: Add compression policy (compress chunks older than 7 days)
SELECT add_compression_policy('timeseries_compressed', INTERVAL '7 days', if_not_exists => TRUE);

-- Step 6: Add retention policy (drop chunks older than 12 months)
SELECT add_retention_policy('timeseries_compressed', INTERVAL '12 months', if_not_exists => TRUE);

-- Step 7: Create a view that reads from both old and new tables during migration
CREATE OR REPLACE VIEW public.timeseries_view AS
SELECT point_id, ts, value FROM public.timeseries_compressed
UNION ALL
SELECT point_id, ts, value FROM public.timeseries
WHERE NOT EXISTS (
  SELECT 1 FROM public.timeseries_compressed
  WHERE timeseries_compressed.point_id = timeseries.point_id
    AND timeseries_compressed.ts = timeseries.ts
);

-- Step 8: Grant permissions
GRANT SELECT ON public.timeseries_compressed TO anon, authenticated, service_role;
GRANT SELECT ON public.timeseries_view TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.timeseries_compressed TO authenticated, service_role;
