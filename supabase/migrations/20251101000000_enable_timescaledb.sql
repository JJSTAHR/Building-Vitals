-- Enable TimescaleDB extension for time-series compression
-- This provides 90-95% compression on time-series data

-- Enable the extension (requires Pro tier or higher)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Verify TimescaleDB version
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
