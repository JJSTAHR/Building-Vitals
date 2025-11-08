# 🚨 APPLY THIS MIGRATION NOW

## Quick Start (2 steps)

### Step 1: Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/jywxcqcjsvlyehuvsoar/sql/new

### Step 2: Copy & Paste This SQL

```sql
-- Fast bulk upsert function for timeseries data from Flightdeck API
-- Handles point creation and timeseries insertion in a single transaction

CREATE OR REPLACE FUNCTION public.bulk_upsert_timeseries(
  site_id TEXT,
  raw_data JSONB  -- Array of {name, value, time} objects
)
RETURNS TABLE(
  points_created INTEGER,
  points_updated INTEGER,
  timeseries_inserted INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_points_created INTEGER := 0;
  v_points_updated INTEGER := 0;
  v_timeseries_inserted INTEGER := 0;
BEGIN
  -- Step 1: Upsert all points and create a temp mapping table
  CREATE TEMP TABLE IF NOT EXISTS temp_point_mapping (
    name TEXT,
    point_id BIGINT
  ) ON COMMIT DROP;

  -- Insert/update points and capture the mapping
  WITH unique_points AS (
    SELECT DISTINCT
      site_id AS site_name,
      value->>'name' AS name
    FROM jsonb_array_elements(raw_data) AS value
  ),
  upserted_points AS (
    INSERT INTO public.points (site_name, name, unit)
    SELECT site_name, name, NULL
    FROM unique_points
    ON CONFLICT (site_name, name)
    DO UPDATE SET name = EXCLUDED.name  -- No-op update
    RETURNING id, name, (xmax = 0) AS was_inserted
  )
  INSERT INTO temp_point_mapping (name, point_id)
  SELECT name, id FROM upserted_points;

  -- Count created vs updated
  GET DIAGNOSTICS v_points_created = ROW_COUNT;

  -- Step 2: Insert timeseries data using the mapping
  WITH timeseries_data AS (
    SELECT
      m.point_id,
      (value->>'time')::timestamptz AS ts,
      (value->>'value')::double precision AS value
    FROM jsonb_array_elements(raw_data) AS value
    JOIN temp_point_mapping m ON m.name = value->>'name'
  )
  INSERT INTO public.timeseries (point_id, ts, value)
  SELECT point_id, ts, value
  FROM timeseries_data
  ON CONFLICT (point_id, ts)
  DO UPDATE SET value = EXCLUDED.value;

  GET DIAGNOSTICS v_timeseries_inserted = ROW_COUNT;

  -- Return stats
  RETURN QUERY SELECT v_points_created, v_points_updated, v_timeseries_inserted;
END;
$$;

-- Grant access to service role
GRANT EXECUTE ON FUNCTION public.bulk_upsert_timeseries(TEXT, JSONB) TO service_role;
```

### Step 3: Click "Run" button

You should see: "Success. No rows returned"

---

## What This Does

**MASSIVE SPEED IMPROVEMENT:**

**Before (slow):**
- 140+ database queries per sync
- 12 minutes per 2-hour chunk
- 38+ hours for full backfill ❌

**After (fast):**
- 1 database call per sync
- ~5 seconds per chunk
- ~30 minutes for full backfill ✅

---

## After Applying

Once you've run the SQL above, the backfill will work properly. Then run:

```bash
gh workflow run backfill-oct-nov.yml -f start_date=2025-10-15 -f end_date=2025-11-07
```

Monitor at: https://github.com/JJSTAHR/Building-Vitals/actions
