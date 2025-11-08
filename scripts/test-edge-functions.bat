@echo off
REM ==========================================
REM Test Edge Functions for October-November 2025 Data
REM ==========================================

setlocal enabledelayedexpansion

REM Set your Supabase project URL here
set SUPABASE_PROJECT_URL=https://your-project.supabase.co

echo.
echo ==========================================
echo Testing Edge Functions
echo ==========================================
echo.
echo Project URL: %SUPABASE_PROJECT_URL%
echo.

REM Check if curl is available
where curl >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: curl not found. Please install curl to run tests.
    exit /b 1
)

echo ==========================================
echo Test 1: Health Check
echo ==========================================
echo.
curl -s "%SUPABASE_PROJECT_URL%/functions/v1/timeseries-direct/api/health" | jq .
echo.
timeout /t 2 /nobreak >nul

echo ==========================================
echo Test 2: List Sites
echo ==========================================
echo.
curl -s "%SUPABASE_PROJECT_URL%/functions/v1/timeseries-direct/api/sites" | jq ".sites[] | {site_id, site_name, configured_points}"
echo.
timeout /t 2 /nobreak >nul

echo ==========================================
echo Test 3: October 2025 Data (First Day)
echo ==========================================
echo.
echo Fetching October 1, 2025 00:00 - 01:00
curl -s "%SUPABASE_PROJECT_URL%/functions/v1/timeseries-direct/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-01T00:00:00Z&end_time=2025-10-01T01:00:00Z&page_size=100" | jq ".point_samples | length"
echo samples retrieved
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo Test 4: November 2025 Data (Latest)
echo ==========================================
echo.
echo Fetching November 4, 2025 (today)
curl -s "%SUPABASE_PROJECT_URL%/functions/v1/timeseries-direct/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-11-04T00:00:00Z&end_time=2025-11-04T23:59:59Z&page_size=100" | jq ".point_samples | length"
echo samples retrieved
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo Test 5: Configured Points
echo ==========================================
echo.
curl -s "%SUPABASE_PROJECT_URL%/functions/v1/timeseries-direct/api/sites/ses_falls_city/configured_points" | jq ".items | length"
echo configured points found
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo Test 6: Check Response Headers
echo ==========================================
echo.
echo Testing caching and query method...
curl -I -s "%SUPABASE_PROJECT_URL%/functions/v1/timeseries-direct/api/health" | findstr "X-Query-Method X-Cache-Status"
echo.

echo.
echo ==========================================
echo Test 7: Large Query Performance
echo ==========================================
echo.
echo Fetching 24 hours of October data (performance test)
set START_TIME=!TIME!
curl -s "%SUPABASE_PROJECT_URL%/functions/v1/timeseries-direct/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-15T00:00:00Z&end_time=2025-10-16T00:00:00Z&page_size=10000" > nul
set END_TIME=!TIME!
echo Query completed
echo.

echo ==========================================
echo Test Summary
echo ==========================================
echo.
echo All tests completed!
echo.
echo If tests fail with authentication errors:
echo   1. Verify ACE_API_KEY is set in Supabase Edge Function secrets
echo   2. Run: supabase secrets set ACE_API_KEY=your_key_here
echo.
echo If tests return no data:
echo   1. Verify continuous-sync is running: supabase functions logs continuous-sync
echo   2. Check data coverage: scripts\check-data-coverage.sql
echo   3. Run manual backfill: scripts\manual-backfill-october.bat
echo.
pause
