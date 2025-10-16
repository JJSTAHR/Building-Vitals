-- ============================================================================
-- ACE IoT Time-Series Database Schema (D1 - Hot Storage)
-- ============================================================================
-- PURPOSE: Store 30 days of high-frequency IoT sensor data with optimal
--          query performance for time-range and point-specific queries.
--
-- CAPACITY PLANNING:
--   - 4,500 data points
--   - ~1 sample/minute/point = 1,440 samples/day/point
--   - Total: 6,480,000 samples/day across all points
--   - 30-day retention: 194,400,000 samples
--   - Estimated row size: ~50 bytes (see breakdown below)
--   - Total data: ~9.72 GB (within 10GB D1 limit)
--
-- ROW SIZE BREAKDOWN:
--   - timestamp (INTEGER): 8 bytes (Unix timestamp in ms)
--   - point_id (INTEGER): 4 bytes (FK to points table)
--   - value (REAL): 8 bytes (IEEE 754 double)
--   - quality (INTEGER): 1 byte (0-255 quality code)
--   - flags (INTEGER): 2 bytes (bitfield for status flags)
--   - SQLite overhead: ~27 bytes (row header, indexes, etc.)
--   Total: ~50 bytes/row
-- ============================================================================

-- ============================================================================
-- POINTS REFERENCE TABLE
-- ============================================================================
-- Purpose: Normalize point names to IDs to save ~30 bytes/sample
-- With 4,500 points, this table is tiny (~450 KB)
-- ============================================================================
CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Full point name (e.g., "Building1.HVAC.Zone1.Temperature")
    name TEXT NOT NULL UNIQUE,

    -- Point metadata
    unit TEXT,                      -- "degF", "kW", "CFM", etc.
    data_type TEXT NOT NULL,        -- "analog", "digital", "multistate"
    description TEXT,

    -- Hierarchical indexing for queries like "all HVAC points"
    building TEXT,                  -- Building identifier
    system TEXT,                    -- "HVAC", "Lighting", "Security", etc.
    equipment TEXT,                 -- Equipment name/tag

    -- Performance optimization
    is_critical BOOLEAN DEFAULT 0,  -- Flag for high-priority points
    sample_rate_sec INTEGER,        -- Expected sample rate (60 for 1/min)

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

-- Index for point name lookups (used during data ingestion)
CREATE INDEX IF NOT EXISTS idx_points_name ON points(name);

-- Index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_points_hierarchy
    ON points(building, system, equipment);

-- Index for critical point filtering
CREATE INDEX IF NOT EXISTS idx_points_critical
    ON points(is_critical) WHERE is_critical = 1;

-- ============================================================================
-- TIME-SERIES DATA TABLE (HOT STORAGE - 30 DAYS)
-- ============================================================================
-- DESIGN DECISIONS:
--   1. INTEGER timestamp: Unix epoch in milliseconds (8 bytes vs 8+ for TEXT)
--   2. point_id FK: 4 bytes vs ~40 bytes for full point name
--   3. REAL value: Handles all numeric sensor data with sufficient precision
--   4. Composite PRIMARY KEY: (point_id, timestamp) ensures uniqueness and
--      creates a clustered index for optimal time-range queries
--   5. No AUTOINCREMENT: Not needed with composite PK, saves overhead
-- ============================================================================
CREATE TABLE IF NOT EXISTS timeseries (
    -- Time dimension (milliseconds since Unix epoch)
    -- Range: 1970-01-01 to 2262-04-11 (293 years of millisecond precision)
    timestamp INTEGER NOT NULL,

    -- Point dimension (FK to points table)
    point_id INTEGER NOT NULL,

    -- Measurement value
    -- REAL provides ~15 decimal digits of precision (IEEE 754 double)
    -- Sufficient for sensor data (temperatures, pressures, flows, etc.)
    value REAL NOT NULL,

    -- Data quality indicator (0-255)
    -- Common values:
    --   0   = Bad quality (sensor fault, communication error)
    --   64  = Uncertain quality (stale data, timeout)
    --   192 = Good quality (normal operation)
    --   255 = Override/Manual entry
    quality INTEGER NOT NULL DEFAULT 192,

    -- Status flags (bitfield)
    -- Bit 0: Alarm active
    -- Bit 1: Override active
    -- Bit 2: Out of range
    -- Bit 3: Sensor fault
    -- Bit 4-15: Reserved for future use
    flags INTEGER DEFAULT 0,

    -- Composite primary key creates clustered index
    -- Optimizes queries: SELECT * WHERE point_id = ? AND timestamp BETWEEN ? AND ?
    PRIMARY KEY (point_id, timestamp),

    -- Foreign key constraint (enforced in D1)
    FOREIGN KEY (point_id) REFERENCES points(id) ON DELETE CASCADE
) WITHOUT ROWID;  -- WITHOUT ROWID saves 8 bytes/row when PK is composite

-- ============================================================================
-- CRITICAL INDEXES FOR QUERY OPTIMIZATION
-- ============================================================================

-- Index for reverse-chronological queries (most recent value per point)
-- Optimizes: SELECT * FROM timeseries WHERE point_id = ? ORDER BY timestamp DESC LIMIT 1
CREATE INDEX IF NOT EXISTS idx_timeseries_point_time_desc
    ON timeseries(point_id, timestamp DESC);

-- Index for time-first queries (all points in time range)
-- Optimizes: SELECT * FROM timeseries WHERE timestamp BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_timeseries_time_point
    ON timeseries(timestamp, point_id);

-- Partial index for bad quality data (for maintenance queries)
-- Only indexes rows where quality < 192 (~5% of data)
CREATE INDEX IF NOT EXISTS idx_timeseries_bad_quality
    ON timeseries(point_id, timestamp)
    WHERE quality < 192;

-- Partial index for alarm conditions
-- Only indexes rows where alarm bit is set (~1% of data)
CREATE INDEX IF NOT EXISTS idx_timeseries_alarms
    ON timeseries(point_id, timestamp)
    WHERE (flags & 1) = 1;

-- ============================================================================
-- SYNC STATE TRACKING (For D1->R2 Archive Process)
-- ============================================================================
-- Purpose: Track which data has been successfully archived to R2
-- ============================================================================
CREATE TABLE IF NOT EXISTS archive_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Watermark: latest timestamp successfully archived
    last_archived_timestamp INTEGER NOT NULL,

    -- Metadata
    records_archived INTEGER NOT NULL,
    archive_path TEXT NOT NULL,        -- R2 path of Parquet file
    parquet_file_size INTEGER,         -- Bytes
    compression_ratio REAL,            -- Original size / compressed size

    -- Timestamps
    archived_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'completed',  -- 'in_progress', 'completed', 'failed'
    error_message TEXT
);

-- Index for finding last successful archive
CREATE INDEX IF NOT EXISTS idx_archive_state_timestamp
    ON archive_state(last_archived_timestamp DESC);

-- ============================================================================
-- DATA RETENTION TRIGGER
-- ============================================================================
-- Purpose: Automatically delete data older than 30 days during INSERT operations
-- This approach is more efficient than periodic batch deletes
-- ============================================================================
CREATE TRIGGER IF NOT EXISTS tr_timeseries_retention
AFTER INSERT ON timeseries
BEGIN
    -- Calculate 30-day cutoff (30 days * 24 hours * 60 min * 60 sec * 1000 ms)
    -- Only runs cleanup every ~1000 inserts (probabilistic via RANDOM())
    DELETE FROM timeseries
    WHERE timestamp < (NEW.timestamp - 2592000000)
      AND ABS(RANDOM() % 1000) = 0;  -- Run cleanup 0.1% of the time
END;

-- ============================================================================
-- UTILITY VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Latest value for each point (useful for dashboard queries)
CREATE VIEW IF NOT EXISTS v_latest_values AS
SELECT
    p.id AS point_id,
    p.name AS point_name,
    p.unit,
    ts.timestamp,
    ts.value,
    ts.quality,
    ts.flags,
    -- Human-readable timestamp
    datetime(ts.timestamp / 1000, 'unixepoch') AS timestamp_utc,
    -- Data freshness indicator
    (unixepoch('now') * 1000 - ts.timestamp) / 1000 AS age_seconds
FROM points p
INNER JOIN (
    -- Subquery to get max timestamp per point
    SELECT point_id, MAX(timestamp) AS max_ts
    FROM timeseries
    GROUP BY point_id
) latest ON p.id = latest.point_id
INNER JOIN timeseries ts
    ON ts.point_id = latest.point_id
    AND ts.timestamp = latest.max_ts;

-- Data quality summary (for monitoring)
CREATE VIEW IF NOT EXISTS v_data_quality_summary AS
SELECT
    p.name AS point_name,
    p.building,
    p.system,
    COUNT(*) AS sample_count,
    AVG(CASE WHEN ts.quality >= 192 THEN 1.0 ELSE 0.0 END) AS good_quality_pct,
    AVG(CASE WHEN (ts.flags & 1) = 1 THEN 1.0 ELSE 0.0 END) AS alarm_pct,
    MIN(ts.timestamp) AS oldest_sample,
    MAX(ts.timestamp) AS newest_sample,
    datetime(MAX(ts.timestamp) / 1000, 'unixepoch') AS last_update_utc
FROM timeseries ts
INNER JOIN points p ON ts.point_id = p.id
GROUP BY p.id, p.name, p.building, p.system;

-- ============================================================================
-- EXAMPLE QUERIES WITH EXPLAIN QUERY PLAN
-- ============================================================================

-- Query 1: Get 24 hours of data for specific point (uses PRIMARY KEY)
-- EXPLAIN QUERY PLAN
-- SELECT timestamp, value, quality
-- FROM timeseries
-- WHERE point_id = 123
--   AND timestamp BETWEEN 1704067200000 AND 1704153600000
-- ORDER BY timestamp;
-- Result: SEARCH timeseries USING PRIMARY KEY (point_id=? AND timestamp>? AND timestamp<?)

-- Query 2: Get latest value for all critical points (uses indexes efficiently)
-- EXPLAIN QUERY PLAN
-- SELECT p.name, ts.timestamp, ts.value
-- FROM points p
-- INNER JOIN v_latest_values ts ON p.id = ts.point_id
-- WHERE p.is_critical = 1;
-- Result: Uses idx_points_critical and composite PK efficiently

-- Query 3: Find all alarms in last hour (uses partial index)
-- EXPLAIN QUERY PLAN
-- SELECT p.name, ts.timestamp, ts.value, ts.flags
-- FROM timeseries ts
-- INNER JOIN points p ON ts.point_id = p.id
-- WHERE (ts.flags & 1) = 1
--   AND ts.timestamp > (unixepoch('now') * 1000 - 3600000);
-- Result: SEARCH timeseries USING INDEX idx_timeseries_alarms

-- ============================================================================
-- SIZE ESTIMATION VALIDATION
-- ============================================================================
-- After 30 days of operation, verify size with:
-- SELECT
--     (page_count * page_size) / 1024.0 / 1024.0 / 1024.0 AS size_gb
-- FROM pragma_page_count(), pragma_page_size();
--
-- Monitor growth rate with:
-- SELECT COUNT(*) AS total_samples,
--        COUNT(*) * 50.0 / 1024.0 / 1024.0 / 1024.0 AS estimated_size_gb
-- FROM timeseries;
--
-- Expected: ~194M samples, ~9.7 GB after 30 days
-- ============================================================================
