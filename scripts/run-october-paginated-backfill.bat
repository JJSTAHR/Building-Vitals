@echo off
REM ============================================================================
REM October 1-31 Paginated Backfill - Windows Batch Script
REM ============================================================================
REM This script runs the paginated backfill for full October 2025
REM Uses the working /timeseries/paginated endpoint
REM Accepts whatever data ACE API returns (maximum ~2,174 points)
REM ============================================================================

echo.
echo ================================================================================
echo OCTOBER 1-31 PAGINATED BACKFILL
echo ================================================================================
echo.
echo This will fetch ALL available October data from ACE API
echo Expected coverage: ~2,174 points (29.7%% of 7,327 configured)
echo.
echo Press Ctrl+C to cancel, or
pause

REM Set environment variables
set SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M
set ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg
set ACE_API_BASE=https://flightdeck.aceiot.cloud/api

echo.
echo Environment:
echo   SUPABASE_URL: %SUPABASE_URL%
echo   ACE_API_BASE: %ACE_API_BASE%
echo.

REM Run the paginated backfill
echo Starting paginated backfill...
echo.

python scripts\python\backfill_paginated_raw.py ^
  --site ses_falls_city ^
  --start 2025-10-01T00:00:00Z ^
  --end 2025-11-01T00:00:00Z ^
  --chunk-minutes 1440 ^
  --page-size 10000 ^
  --max-chunks 100 ^
  2>&1 | C:\Windows\System32\find /V ""

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo SUCCESS - Backfill completed
    echo ================================================================================
    echo.
) else (
    echo.
    echo ================================================================================
    echo ERROR - Backfill failed with error code %ERRORLEVEL%
    echo ================================================================================
    echo.
)

echo.
echo Verifying October coverage...
echo.

REM Query Supabase to check October coverage
curl -sS "%SUPABASE_URL%/rest/v1/timeseries?select=point_id&ts=gte.2025-10-01T00:00:00Z&ts=lt.2025-11-01T00:00:00Z&limit=50000" ^
  -H "apikey: %SUPABASE_SERVICE_ROLE_KEY%" ^
  -H "Authorization: Bearer %SUPABASE_SERVICE_ROLE_KEY%" > october_coverage_temp.json

REM Use Python to count unique points
python -c "import json; data = json.load(open('october_coverage_temp.json')); unique = len(set(r['point_id'] for r in data)) if isinstance(data, list) else 0; print(f'\nOctober Coverage: {unique} / 7,327 points ({unique*100/7327:.1f}%%)')"

del october_coverage_temp.json 2>nul

echo.
echo Press any key to exit...
pause >nul
