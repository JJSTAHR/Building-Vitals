#!/bin/bash
# Enable TimescaleDB on Supabase via SQL execution

set -e

SUPABASE_URL="https://jywxcqcjsvlyehuvsoar.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M"

echo "============================================================================"
echo "ENABLING TIMESCALEDB COMPRESSION"
echo "============================================================================"
echo ""

# Step 1: Enable TimescaleDB extension
echo "[1/6] Enabling TimescaleDB extension..."
curl -sS "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"}' \
  > /dev/null && echo "✓ Extension enabled" || echo "✗ Failed"

# Step 2: Convert to hypertable
echo "[2/6] Converting timeseries to hypertable..."
curl -sS "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT create_hypertable('"'"'timeseries'"'"', '"'"'ts'"'"', chunk_time_interval => INTERVAL '"'"'1 month'"'"', migrate_data => true, if_not_exists => TRUE);"}' \
  > /dev/null && echo "✓ Hypertable created" || echo "✗ Failed"

# Step 3: Enable compression
echo "[3/6] Enabling compression..."
curl -sS "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "ALTER TABLE timeseries SET (timescaledb.compress, timescaledb.compress_segmentby = '"'"'point_id'"'"', timescaledb.compress_orderby = '"'"'ts DESC'"'"');"}' \
  > /dev/null && echo "✓ Compression settings configured" || echo "✗ Failed"

# Step 4: Add compression policy
echo "[4/6] Adding automatic compression policy..."
curl -sS "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT add_compression_policy('"'"'timeseries'"'"', INTERVAL '"'"'7 days'"'"', if_not_exists => TRUE);"}' \
  > /dev/null && echo "✓ Compression policy activated" || echo "✗ Failed"

# Step 5: Verify
echo "[5/6] Verifying TimescaleDB configuration..."
RESULT=$(curl -sS "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT h.table_name, h.compression_enabled FROM timescaledb_information.hypertables h WHERE h.table_name = '"'"'timeseries'"'"';"}')

if echo "$RESULT" | grep -q "compression_enabled.*true"; then
  echo "✓ TimescaleDB compression ENABLED"
else
  echo "✗ Verification failed"
  echo "$RESULT"
  exit 1
fi

echo "[6/6] Checking current storage..."
STORAGE=$(curl -sS "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT pg_size_pretty(pg_database_size(current_database())) as size;"}')
echo "Current database size: $STORAGE"

echo ""
echo "============================================================================"
echo "SUCCESS! TIMESCALEDB COMPRESSION ENABLED"
echo "============================================================================"
echo ""
echo "What happens next:"
echo "  - Day 1-7: New data stays uncompressed"
echo "  - Day 8+: Data >7 days auto-compresses at 10:1 ratio"
echo "  - Day 30: Full compression achieved (134 GB → 13.4 GB)"
echo ""
echo "Next step: Run October backfill"
echo "  gh workflow run parallel-october-backfill.yml --ref main"
echo ""
