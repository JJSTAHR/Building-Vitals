-- D1 Database Schema for Queue Jobs and Analytics
-- This schema tracks background processing jobs and provides analytics

-- Queue Jobs Table
-- Tracks the status and metadata of background processing jobs
CREATE TABLE IF NOT EXISTS queue_jobs (
    job_id TEXT PRIMARY KEY,
    site TEXT NOT NULL,
    points TEXT NOT NULL, -- JSON array of point names
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    user_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'retrying', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),

    -- Progress tracking
    progress INTEGER DEFAULT 0,
    processed_points INTEGER DEFAULT 0,
    total_points INTEGER,

    -- Timing
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    failed_at TEXT,
    cancelled_at TEXT,

    -- Size estimates
    estimated_size INTEGER,
    samples_count INTEGER,
    data_size INTEGER,

    -- Cache reference
    cache_key TEXT,

    -- Error tracking
    error TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Metadata
    metadata TEXT -- JSON object for additional data
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status ON queue_jobs(status);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_user_id ON queue_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_created_at ON queue_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_site ON queue_jobs(site);

-- Job History Table (for analytics)
-- Keeps a record of completed/failed jobs for analysis
CREATE TABLE IF NOT EXISTS job_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    site TEXT NOT NULL,
    points_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    duration_ms INTEGER,
    samples_count INTEGER,
    data_size INTEGER,
    error TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_history_site ON job_history(site);
CREATE INDEX IF NOT EXISTS idx_job_history_created_at ON job_history(created_at);

-- Cache Metadata Table
-- Tracks R2 cache entries for analytics and cleanup
CREATE TABLE IF NOT EXISTS cache_metadata (
    cache_key TEXT PRIMARY KEY,
    site TEXT NOT NULL,
    points_count INTEGER NOT NULL,
    samples_count INTEGER,
    original_size INTEGER,
    compressed_size INTEGER,
    compression_ratio REAL,
    hit_count INTEGER DEFAULT 0,
    last_accessed TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cache_site ON cache_metadata(site);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_metadata(expires_at);

-- Request Analytics Table
-- Tracks all timeseries requests for performance analysis
CREATE TABLE IF NOT EXISTS request_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    site TEXT NOT NULL,
    points_count INTEGER NOT NULL,
    route_type TEXT NOT NULL CHECK (route_type IN ('direct', 'cached', 'queued')),
    cache_hit BOOLEAN DEFAULT 0,
    estimated_size INTEGER,
    duration_ms INTEGER,
    success BOOLEAN NOT NULL,
    error TEXT,
    timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_site ON request_analytics(site);
CREATE INDEX IF NOT EXISTS idx_analytics_route ON request_analytics(route_type);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON request_analytics(timestamp);

-- Views for common queries

-- Active Jobs View
CREATE VIEW IF NOT EXISTS v_active_jobs AS
SELECT
    job_id,
    site,
    status,
    progress,
    created_at,
    started_at,
    estimated_size,
    retry_count
FROM queue_jobs
WHERE status IN ('queued', 'processing', 'retrying')
ORDER BY priority DESC, created_at ASC;

-- Job Performance View
CREATE VIEW IF NOT EXISTS v_job_performance AS
SELECT
    site,
    COUNT(*) as total_jobs,
    AVG(duration_ms) as avg_duration_ms,
    AVG(samples_count) as avg_samples,
    AVG(data_size) as avg_data_size,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
    ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM job_history
GROUP BY site;

-- Cache Performance View
CREATE VIEW IF NOT EXISTS v_cache_performance AS
SELECT
    site,
    COUNT(*) as total_entries,
    SUM(hit_count) as total_hits,
    AVG(compression_ratio) as avg_compression,
    SUM(original_size) as total_original_size,
    SUM(compressed_size) as total_compressed_size,
    ROUND(100.0 * SUM(compressed_size) / SUM(original_size), 2) as overall_compression_pct
FROM cache_metadata
GROUP BY site;

-- Request Analytics View
CREATE VIEW IF NOT EXISTS v_request_stats AS
SELECT
    site,
    route_type,
    COUNT(*) as request_count,
    AVG(duration_ms) as avg_duration_ms,
    SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) as cache_hits,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
    ROUND(100.0 * SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM request_analytics
GROUP BY site, route_type;

-- Cleanup Queries (run periodically)

-- Delete old completed jobs (older than 7 days)
-- DELETE FROM queue_jobs
-- WHERE status IN ('completed', 'failed', 'cancelled')
-- AND created_at < datetime('now', '-7 days');

-- Archive old jobs to history before cleanup
-- INSERT INTO job_history (job_id, site, points_count, status, duration_ms, samples_count, data_size, error, created_at, completed_at)
-- SELECT
--     job_id,
--     site,
--     json_array_length(points) as points_count,
--     status,
--     CAST((julianday(COALESCE(completed_at, failed_at)) - julianday(started_at)) * 86400000 AS INTEGER) as duration_ms,
--     samples_count,
--     data_size,
--     error,
--     created_at,
--     COALESCE(completed_at, failed_at) as completed_at
-- FROM queue_jobs
-- WHERE status IN ('completed', 'failed')
-- AND created_at < datetime('now', '-7 days');

-- Delete expired cache metadata
-- DELETE FROM cache_metadata
-- WHERE expires_at < datetime('now');

-- Trim old analytics (older than 30 days)
-- DELETE FROM request_analytics
-- WHERE timestamp < datetime('now', '-30 days');
