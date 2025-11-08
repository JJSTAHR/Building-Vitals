@echo off
echo ================================================================================
echo  INSTANT HISTORICAL BACKFILL - Running in Background
echo ================================================================================
echo.
echo This will backfill ALL historical data while real-time sync continues.
echo.
echo Strategy:
echo   - Real-time sync: Running every 1 minute (handles 2-min data)
echo   - Backfill: Fetching 30 days of historical data in 10-min chunks
echo   - Both run in parallel - NO CONFLICTS due to upsert logic
echo.
echo ================================================================================
echo.

set SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M
set ACE_API_KEY=%ACE_API_KEY%
set ACE_API_BASE=https://flightdeck.aceiot.cloud/api

echo Starting backfill from 30 days ago to now...
echo.

python scripts\python\backfill_paginated_raw.py ^
  --site ses_falls_city ^
  --start 2024-09-28T00:00:00Z ^
  --end 2025-10-28T00:00:00Z ^
  --chunk-minutes 10 ^
  --page-size 50000 ^
  --max-chunks 5000

echo.
echo ================================================================================
echo  BACKFILL COMPLETE!
echo ================================================================================
echo.
pause
