-- ============================================================================
-- D1 Database Migrations for Building Vitals
-- Version-tracked schema changes and sample data
-- ============================================================================

-- ============================================================================
-- MIGRATION v1: Initial Schema
-- ============================================================================
-- Applied via d1-schema.sql
-- Tables: timeseries_agg, chart_configs, query_metadata, query_cache,
--         user_preferences, data_quality, schema_version

-- ============================================================================
-- MIGRATION v2: Add Performance Indexes (if not in v1)
-- ============================================================================

-- Check if migration is needed
INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES (2, strftime('%s', 'now'), 'Additional performance indexes');

-- Composite index for multi-point queries
CREATE INDEX IF NOT EXISTS idx_timeseries_multi_point
  ON timeseries_agg(site_name, interval, timestamp DESC, point_name);

-- Index for aggregation jobs
CREATE INDEX IF NOT EXISTS idx_timeseries_aggregate_check
  ON timeseries_agg(site_name, point_name, interval);

-- ============================================================================
-- MIGRATION v3: Add Materialized Views Support
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES (3, strftime('%s', 'now'), 'Materialized views for common queries');

-- Create table to store materialized view results
CREATE TABLE IF NOT EXISTS mv_site_summary (
  site_name TEXT PRIMARY KEY,
  point_count INTEGER,
  earliest_data INTEGER,
  latest_data INTEGER,
  total_samples INTEGER,
  last_updated INTEGER
) WITHOUT ROWID;

-- Index for freshness checks
CREATE INDEX IF NOT EXISTS idx_mv_site_updated
  ON mv_site_summary(last_updated);

-- Create materialized view refresh trigger (manual refresh)
CREATE TRIGGER IF NOT EXISTS trg_refresh_site_summary
AFTER INSERT ON query_metadata
BEGIN
  INSERT OR REPLACE INTO mv_site_summary
  SELECT
    site_name,
    COUNT(DISTINCT point_name) as point_count,
    MIN(data_start) as earliest_data,
    MAX(data_end) as latest_data,
    SUM(total_samples) as total_samples,
    strftime('%s', 'now') as last_updated
  FROM query_metadata
  WHERE site_name = NEW.site_name
  GROUP BY site_name;
END;

-- ============================================================================
-- MIGRATION v4: Add Chart Collections
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES (4, strftime('%s', 'now'), 'Chart collections and templates');

-- Chart collections for organizing related charts
CREATE TABLE IF NOT EXISTS chart_collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  chart_ids TEXT,              -- JSON array of chart IDs
  is_public INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_collections_user
  ON chart_collections(user_id, updated_at DESC);

-- Chart templates for quick chart creation
CREATE TABLE IF NOT EXISTS chart_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chart_type TEXT NOT NULL,
  description TEXT,
  template_json TEXT,          -- JSON template with placeholders
  category TEXT,               -- 'energy', 'hvac', 'water', etc.
  popularity INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_templates_category
  ON chart_templates(category, popularity DESC);

-- ============================================================================
-- MIGRATION v5: Add Alerting Support
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES (5, strftime('%s', 'now'), 'Alert rules and notifications');

-- Alert rules based on timeseries data
CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  point_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,     -- 'threshold', 'anomaly', 'missing_data'
  condition_json TEXT,         -- JSON: { operator: '>', value: 100, duration: 300 }
  is_active INTEGER DEFAULT 1,
  last_triggered INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_alerts_active
  ON alert_rules(is_active, site_name, point_name)
  WHERE is_active = 1;

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  triggered_at INTEGER NOT NULL,
  value REAL,
  severity TEXT,               -- 'info', 'warning', 'critical'
  acknowledged INTEGER DEFAULT 0,
  acknowledged_at INTEGER,
  acknowledged_by TEXT
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_alert_history_time
  ON alert_history(triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_history_unacked
  ON alert_history(acknowledged)
  WHERE acknowledged = 0;

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Sample site metadata
INSERT OR IGNORE INTO query_metadata (site_name, point_name, data_start, data_end, total_samples, last_aggregated)
VALUES
  ('building-a', 'energy.total', 1704067200, 1735603200, 525600, strftime('%s', 'now')),
  ('building-a', 'hvac.temp.zone1', 1704067200, 1735603200, 525600, strftime('%s', 'now')),
  ('building-a', 'hvac.temp.zone2', 1704067200, 1735603200, 525600, strftime('%s', 'now')),
  ('building-a', 'water.flow.main', 1704067200, 1735603200, 525600, strftime('%s', 'now'));

-- Sample chart templates
INSERT OR IGNORE INTO chart_templates (id, name, chart_type, description, template_json, category, popularity, created_at)
VALUES
  (
    'tpl_energy_daily',
    'Daily Energy Consumption',
    'line',
    'Line chart showing daily energy usage patterns',
    '{"points":["energy.total"],"interval":"1day","aggregate":"sum","chartOptions":{"yAxis":"kWh"}}',
    'energy',
    100,
    strftime('%s', 'now')
  ),
  (
    'tpl_temp_heatmap',
    'Temperature Heatmap',
    'heatmap',
    'Heatmap visualization of temperature across zones',
    '{"points":["hvac.temp.*"],"interval":"1hr","aggregate":"avg","chartOptions":{"colorScheme":"thermal"}}',
    'hvac',
    85,
    strftime('%s', 'now')
  ),
  (
    'tpl_water_flow',
    'Water Flow Analysis',
    'area',
    'Area chart for water consumption tracking',
    '{"points":["water.flow.*"],"interval":"1hr","aggregate":"sum","chartOptions":{"fill":true}}',
    'water',
    75,
    strftime('%s', 'now')
  );

-- Sample chart configurations
INSERT OR IGNORE INTO chart_configs (id, user_id, site_name, chart_type, title, config_json, is_public, created_at, updated_at, view_count)
VALUES
  (
    'chart_001',
    'user_demo',
    'building-a',
    'line',
    'Building A - Energy Overview',
    '{"points":["energy.total"],"interval":"1hr","colors":{"energy.total":"#3b82f6"},"yAxis":"kWh","showLegend":true}',
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    42
  ),
  (
    'chart_002',
    'user_demo',
    'building-a',
    'multi-line',
    'HVAC Temperature Zones',
    '{"points":["hvac.temp.zone1","hvac.temp.zone2"],"interval":"5min","colors":{"hvac.temp.zone1":"#ef4444","hvac.temp.zone2":"#10b981"},"yAxis":"°F"}',
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    38
  );

-- Sample timeseries aggregations (last 24 hours of hourly data)
-- Building realistic sample data for demonstration
INSERT OR IGNORE INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, min_value, max_value, sample_count)
WITH RECURSIVE
  hours(ts) AS (
    SELECT strftime('%s', 'now', '-24 hours')
    UNION ALL
    SELECT ts + 3600 FROM hours WHERE ts < strftime('%s', 'now')
  )
SELECT
  'building-a' as site_name,
  'energy.total' as point_name,
  '1hr' as interval,
  ts as timestamp,
  -- Simulate realistic energy pattern (higher during day, lower at night)
  CASE
    WHEN CAST(strftime('%H', ts, 'unixepoch') AS INTEGER) BETWEEN 6 AND 18
    THEN 850 + (ABS(RANDOM()) % 200)
    ELSE 450 + (ABS(RANDOM()) % 100)
  END as avg_value,
  CASE
    WHEN CAST(strftime('%H', ts, 'unixepoch') AS INTEGER) BETWEEN 6 AND 18
    THEN 800 + (ABS(RANDOM()) % 50)
    ELSE 400 + (ABS(RANDOM()) % 50)
  END as min_value,
  CASE
    WHEN CAST(strftime('%H', ts, 'unixepoch') AS INTEGER) BETWEEN 6 AND 18
    THEN 950 + (ABS(RANDOM()) % 50)
    ELSE 550 + (ABS(RANDOM()) % 50)
  END as max_value,
  60 as sample_count
FROM hours;

-- Sample temperature data
INSERT OR IGNORE INTO timeseries_agg (site_name, point_name, interval, timestamp, avg_value, min_value, max_value, sample_count)
WITH RECURSIVE
  hours(ts) AS (
    SELECT strftime('%s', 'now', '-24 hours')
    UNION ALL
    SELECT ts + 3600 FROM hours WHERE ts < strftime('%s', 'now')
  )
SELECT
  'building-a' as site_name,
  'hvac.temp.zone1' as point_name,
  '1hr' as interval,
  ts as timestamp,
  68 + (ABS(RANDOM()) % 8) as avg_value,
  66 + (ABS(RANDOM()) % 4) as min_value,
  70 + (ABS(RANDOM()) % 4) as max_value,
  60 as sample_count
FROM hours;

-- ============================================================================
-- MIGRATION v6: Add Queue Jobs Table
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES (6, strftime('%s', 'now'), 'Queue job tracking for background processing');

-- Queue jobs table for background processing
CREATE TABLE IF NOT EXISTS queue_jobs (
  job_id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  points_json TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  result_url TEXT,
  samples_count INTEGER,
  processing_time_ms INTEGER
) WITHOUT ROWID;

-- Performance indexes for queue management
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status_created
  ON queue_jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_jobs_user_created
  ON queue_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_jobs_site_created
  ON queue_jobs(site_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_jobs_priority
  ON queue_jobs(priority DESC, created_at ASC)
  WHERE status = 'queued';

-- Rollback v6 (Queue Jobs)
-- DROP TABLE IF EXISTS queue_jobs;
-- DELETE FROM schema_version WHERE version = 6;

-- ============================================================================
-- MIGRATION v7: Add Dead Letter Queue Tables
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES (7, strftime('%s', 'now'), 'Dead letter queue handling and user notifications');

-- DLQ recovery queue for manually recoverable jobs
CREATE TABLE IF NOT EXISTS dlq_recovery_queue (
  job_id TEXT PRIMARY KEY,
  original_message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'recovered', 'abandoned')),
  recovered_at INTEGER,
  notes TEXT
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_dlq_recovery_status
  ON dlq_recovery_queue(status, created_at);

-- User notifications table for failed jobs and alerts
CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'job_failed', 'job_completed', 'alert', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  job_id TEXT,
  created_at INTEGER NOT NULL,
  read_at INTEGER
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON user_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON user_notifications(user_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_job
  ON user_notifications(job_id);

-- Rollback v7 (DLQ Tables)
-- DROP TABLE IF EXISTS user_notifications;
-- DROP TABLE IF EXISTS dlq_recovery_queue;
-- DELETE FROM schema_version WHERE version = 7;

-- ============================================================================
-- MAINTENANCE PROCEDURES
-- ============================================================================

-- Procedure: Clean old aggregations (keep last 90 days of 1min data)
-- Run this periodically to manage database size
-- Note: This is a template query, execute manually or via scheduled job

-- DELETE FROM timeseries_agg
-- WHERE interval = '1min'
--   AND timestamp < strftime('%s', 'now', '-90 days');

-- Procedure: Archive to R2 (example query to identify data for archival)
-- SELECT * FROM timeseries_agg
-- WHERE interval = '1min'
--   AND timestamp < strftime('%s', 'now', '-90 days')
-- ORDER BY site_name, point_name, timestamp;

-- Procedure: Rebuild statistics
-- ANALYZE;

-- Procedure: Reclaim space
-- VACUUM;

-- ============================================================================
-- ROLLBACK PROCEDURES
-- ============================================================================

-- Rollback v5 (Alerts)
-- DROP TABLE IF EXISTS alert_history;
-- DROP TABLE IF EXISTS alert_rules;
-- DELETE FROM schema_version WHERE version = 5;

-- Rollback v4 (Collections)
-- DROP TABLE IF EXISTS chart_templates;
-- DROP TABLE IF EXISTS chart_collections;
-- DELETE FROM schema_version WHERE version = 4;

-- Rollback v3 (Materialized Views)
-- DROP TRIGGER IF EXISTS trg_refresh_site_summary;
-- DROP TABLE IF EXISTS mv_site_summary;
-- DELETE FROM schema_version WHERE version = 3;

-- Rollback v2 (Indexes)
-- DROP INDEX IF EXISTS idx_timeseries_aggregate_check;
-- DROP INDEX IF EXISTS idx_timeseries_multi_point;
-- DELETE FROM schema_version WHERE version = 2;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check schema version
-- SELECT * FROM schema_version ORDER BY version DESC;

-- Verify indexes
-- SELECT name, tbl_name, sql
-- FROM sqlite_master
-- WHERE type = 'index'
-- ORDER BY tbl_name, name;

-- Check table sizes
-- SELECT
--   name,
--   (SELECT COUNT(*) FROM timeseries_agg) as timeseries_count,
--   (SELECT COUNT(*) FROM chart_configs) as charts_count,
--   (SELECT COUNT(*) FROM query_metadata) as metadata_count
-- FROM sqlite_master
-- WHERE type = 'table' AND name = 'timeseries_agg';

-- Verify sample data
-- SELECT COUNT(*) as sample_records
-- FROM timeseries_agg
-- WHERE site_name = 'building-a';

-- ============================================================================
-- PERFORMANCE BASELINE QUERIES
-- ============================================================================

-- Test query performance (should use idx_timeseries_site_time)
-- EXPLAIN QUERY PLAN
-- SELECT timestamp, avg_value
-- FROM timeseries_agg
-- WHERE site_name = 'building-a'
--   AND point_name = 'energy.total'
--   AND interval = '1hr'
--   AND timestamp >= strftime('%s', 'now', '-7 days')
-- ORDER BY timestamp DESC;

-- Expected output: SEARCH timeseries_agg USING INDEX idx_timeseries_site_time

-- ============================================================================
