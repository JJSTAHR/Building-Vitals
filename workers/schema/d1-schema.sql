-- ============================================================================
-- D1 SQLite Schema for Building Vitals
-- Optimized for timeseries aggregations and chart configurations
-- ============================================================================

-- ============================================================================
-- 1. TIMESERIES RAW DATA TABLE (HOT STORAGE)
-- ============================================================================
-- Stores raw timeseries data for last 20 days (<20 days old)
-- Used by ETL Worker to sync data from ACE IoT API
-- Used by Query Worker to serve recent data queries
-- WITHOUT ROWID optimization saves ~25% storage and improves query speed

CREATE TABLE IF NOT EXISTS timeseries_raw (
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  timestamp INTEGER NOT NULL,  -- Unix timestamp (SECONDS)
  value REAL NOT NULL,
  PRIMARY KEY (site_name, point_name, timestamp)
) WITHOUT ROWID;

-- Performance indexes for common query patterns
-- Index for time-range queries within a site
CREATE INDEX IF NOT EXISTS idx_timeseries_site_time
  ON timeseries_raw(site_name, timestamp DESC);

-- Index for point-specific queries
CREATE INDEX IF NOT EXISTS idx_timeseries_point
  ON timeseries_raw(point_name, timestamp DESC);

-- Index for recent data queries (last 24 hours, etc.)
CREATE INDEX IF NOT EXISTS idx_timeseries_recent
  ON timeseries_raw(timestamp DESC);

-- ============================================================================
-- 2. TIMESERIES AGGREGATIONS TABLE (COLD STORAGE METADATA)
-- ============================================================================
-- Stores metadata about aggregated data in R2 (>20 days old)
-- Used by Archival Worker to track what's been archived
-- Used by Query Worker to know where to find historical data

CREATE TABLE IF NOT EXISTS timeseries_agg (
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  interval TEXT NOT NULL,      -- '1min', '5min', '1hr', '1day'
  timestamp INTEGER NOT NULL,  -- Unix timestamp (seconds)
  avg_value REAL,
  min_value REAL,
  max_value REAL,
  sample_count INTEGER,
  PRIMARY KEY (site_name, point_name, interval, timestamp)
) WITHOUT ROWID;

-- Performance indexes for aggregation queries
CREATE INDEX IF NOT EXISTS idx_timeseries_agg_site
  ON timeseries_agg(site_name, interval, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_timeseries_agg_point
  ON timeseries_agg(point_name, interval, timestamp DESC);

-- ============================================================================
-- 2. CHART CONFIGURATIONS TABLE
-- ============================================================================
-- Stores user-created chart configurations with JSON flexibility

CREATE TABLE IF NOT EXISTS chart_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  site_name TEXT NOT NULL,
  chart_type TEXT NOT NULL,    -- 'line', 'bar', 'heatmap', 'scatter', etc.
  title TEXT,
  config_json TEXT,             -- JSON blob: { points: [], colors: {}, options: {} }
  is_public INTEGER DEFAULT 0,  -- 0 = private, 1 = public
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  view_count INTEGER DEFAULT 0,
  last_viewed_at INTEGER
) WITHOUT ROWID;

-- Performance indexes for chart queries
-- User's charts lookup
CREATE INDEX IF NOT EXISTS idx_charts_user
  ON chart_configs(user_id, updated_at DESC);

-- Site-specific charts
CREATE INDEX IF NOT EXISTS idx_charts_site
  ON chart_configs(site_name, created_at DESC);

-- Popular public charts
CREATE INDEX IF NOT EXISTS idx_charts_popular
  ON chart_configs(is_public, view_count DESC)
  WHERE is_public = 1;

-- Chart type filtering
CREATE INDEX IF NOT EXISTS idx_charts_type
  ON chart_configs(chart_type, view_count DESC);

-- ============================================================================
-- 3. QUERY METADATA TABLE
-- ============================================================================
-- Track query performance and optimization hints

CREATE TABLE IF NOT EXISTS query_metadata (
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  data_start INTEGER,           -- First available timestamp
  data_end INTEGER,             -- Last available timestamp
  total_samples INTEGER,
  last_aggregated INTEGER,      -- Last time aggregations were computed
  PRIMARY KEY (site_name, point_name)
) WITHOUT ROWID;

-- ============================================================================
-- 4. POPULAR QUERIES CACHE
-- ============================================================================
-- Cache frequently requested query results

CREATE TABLE IF NOT EXISTS query_cache (
  cache_key TEXT PRIMARY KEY,   -- Hash of query parameters
  site_name TEXT NOT NULL,
  query_params TEXT,            -- JSON: { points: [], interval: '', range: {} }
  result_json TEXT,             -- Cached query result
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  hit_count INTEGER DEFAULT 0
) WITHOUT ROWID;

-- Index for cache expiration cleanup
CREATE INDEX IF NOT EXISTS idx_cache_expiry
  ON query_cache(expires_at);

-- Index for cache hit tracking
CREATE INDEX IF NOT EXISTS idx_cache_hits
  ON query_cache(site_name, hit_count DESC);

-- ============================================================================
-- 5. USER PREFERENCES TABLE
-- ============================================================================
-- Store user-specific settings and favorites

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  default_site TEXT,
  favorite_points TEXT,         -- JSON array of point names
  theme TEXT DEFAULT 'light',   -- 'light', 'dark', 'auto'
  timezone TEXT DEFAULT 'UTC',
  preferences_json TEXT,        -- Additional settings
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

-- ============================================================================
-- 6. DATA QUALITY METRICS
-- ============================================================================
-- Track data quality for each point

CREATE TABLE IF NOT EXISTS data_quality (
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  date INTEGER NOT NULL,        -- Date as YYYYMMDD
  expected_samples INTEGER,
  actual_samples INTEGER,
  missing_samples INTEGER,
  outlier_count INTEGER,
  quality_score REAL,           -- 0.0 to 1.0
  PRIMARY KEY (site_name, point_name, date)
) WITHOUT ROWID;

-- Index for quality monitoring
CREATE INDEX IF NOT EXISTS idx_quality_score
  ON data_quality(site_name, date DESC, quality_score);

-- ============================================================================
-- 7. QUEUE JOBS TABLE
-- ============================================================================
-- Tracks background processing jobs for large data requests

CREATE TABLE IF NOT EXISTS queue_jobs (
  job_id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  points_json TEXT NOT NULL,    -- JSON array of point names
  start_time TEXT NOT NULL,     -- ISO 8601 format
  end_time TEXT NOT NULL,       -- ISO 8601 format
  user_id TEXT,                 -- Optional user tracking
  status TEXT NOT NULL CHECK(status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 0,   -- Higher = more important
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  result_url TEXT,              -- R2 URL to result
  samples_count INTEGER,        -- Number of samples processed
  processing_time_ms INTEGER    -- Performance tracking
) WITHOUT ROWID;

-- Performance indexes for queue management
-- Index for status-based queries (get pending jobs)
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status_created
  ON queue_jobs(status, created_at DESC);

-- Index for user job history
CREATE INDEX IF NOT EXISTS idx_queue_jobs_user_created
  ON queue_jobs(user_id, created_at DESC);

-- Index for site-specific job tracking
CREATE INDEX IF NOT EXISTS idx_queue_jobs_site_created
  ON queue_jobs(site_name, created_at DESC);

-- Index for job priority queue (only for queued jobs)
CREATE INDEX IF NOT EXISTS idx_queue_jobs_priority
  ON queue_jobs(priority DESC, created_at ASC)
  WHERE status = 'queued';

-- ============================================================================
-- 8. SCHEMA VERSION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT
);

-- Insert initial schema version
INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES (1, strftime('%s', 'now'), 'Initial schema with timeseries and chart tables');

-- ============================================================================
-- 8. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Latest aggregations per point
CREATE VIEW IF NOT EXISTS v_latest_values AS
SELECT
  site_name,
  point_name,
  interval,
  MAX(timestamp) as last_update,
  avg_value,
  min_value,
  max_value
FROM timeseries_agg
GROUP BY site_name, point_name, interval;

-- View: Chart statistics
CREATE VIEW IF NOT EXISTS v_chart_stats AS
SELECT
  chart_type,
  COUNT(*) as total_charts,
  SUM(view_count) as total_views,
  AVG(view_count) as avg_views,
  MAX(view_count) as max_views
FROM chart_configs
GROUP BY chart_type;

-- View: Data coverage summary
CREATE VIEW IF NOT EXISTS v_data_coverage AS
SELECT
  site_name,
  COUNT(DISTINCT point_name) as point_count,
  MIN(data_start) as earliest_data,
  MAX(data_end) as latest_data,
  SUM(total_samples) as total_samples
FROM query_metadata
GROUP BY site_name;

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
--
-- 1. WITHOUT ROWID Tables:
--    - Saves ~25% storage space
--    - Improves query performance for PRIMARY KEY lookups
--    - Used on all tables with composite or TEXT primary keys
--
-- 2. Index Strategy:
--    - Covering indexes for common query patterns
--    - DESC ordering for recent-data queries
--    - Partial indexes for filtered queries (WHERE is_public = 1)
--
-- 3. Query Optimization:
--    - Use EXPLAIN QUERY PLAN to verify index usage
--    - Composite indexes ordered by selectivity
--    - Time-range queries use timestamp indexes
--
-- 4. Storage Estimates (10GB database):
--    - timeseries_agg: ~8GB (main data)
--    - chart_configs: ~1GB (user data)
--    - query_cache: ~500MB (hot queries)
--    - Other tables: ~500MB (metadata)
--
-- 5. Maintenance:
--    - VACUUM periodically to reclaim space
--    - ANALYZE to update query planner statistics
--    - Clean expired cache entries daily
--    - Archive old aggregations to R2 for cold storage
--
-- ============================================================================
