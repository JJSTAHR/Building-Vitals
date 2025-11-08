@echo off
REM ==========================================
REM Deploy Working Edge Functions for Building Vitals Dashboard
REM Handles October-November 2025 data with auth bypass
REM ==========================================

echo.
echo ==========================================
echo Building Vitals - Edge Function Deployment
echo ==========================================
echo.
echo This script deploys production-ready Edge Functions:
echo   1. timeseries-direct  - Direct ACE API proxy (auth bypass)
echo   2. continuous-sync    - Multi-site real-time sync
echo   3. weekly-backfill    - Historical data backfill
echo   4. timeseries-proxy   - Smart routing with caching
echo.
echo Target: October 1 - November 4, 2025
echo.

REM Check if Supabase CLI is installed
where supabase >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Supabase CLI not found!
    echo Please install: scoop install supabase
    exit /b 1
)

REM Check if we're in the right directory
if not exist "supabase\functions" (
    echo ERROR: Must run from project root directory
    echo Current directory: %CD%
    exit /b 1
)

REM Verify environment variables are set
echo Checking environment variables...
if not defined SUPABASE_URL (
    echo WARNING: SUPABASE_URL not set
)
if not defined ACE_API_KEY (
    echo WARNING: ACE_API_KEY not set
)
echo.

REM Function deployment order (most stable first)
echo ==========================================
echo Step 1: Deploy timeseries-direct (Direct API Proxy)
echo ==========================================
echo.
echo This function:
echo   - Bypasses Supabase for direct ACE API access
echo   - No authentication required from frontend
echo   - Handles /api/sites and /api/sites/{site}/timeseries/paginated
echo   - Best for October-November 2025 data queries
echo.

supabase functions deploy timeseries-direct --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo FAILED: timeseries-direct deployment failed
    pause
    exit /b 1
)

echo.
echo SUCCESS: timeseries-direct deployed
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo Step 2: Deploy continuous-sync (Real-time Data Sync)
echo ==========================================
echo.
echo This function:
echo   - Syncs last 10 minutes of data every 2 minutes
echo   - Auto-discovers and processes all sites
echo   - Memory-efficient streaming architecture
echo   - Scheduled via pg_cron (already configured)
echo.

supabase functions deploy continuous-sync --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo WARNING: continuous-sync deployment failed (non-critical)
) else (
    echo SUCCESS: continuous-sync deployed
)

timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo Step 3: Deploy weekly-backfill (Historical Data)
echo ==========================================
echo.
echo This function:
echo   - Backfills previous 7 days for any site
echo   - Processes data in 1-hour chunks
echo   - Supports October 2025 data retrieval
echo   - Scheduled daily at 2 AM UTC via pg_cron
echo.

supabase functions deploy weekly-backfill --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo WARNING: weekly-backfill deployment failed (non-critical)
) else (
    echo SUCCESS: weekly-backfill deployed
)

timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo Step 4: Deploy timeseries-proxy (Smart Router)
echo ==========================================
echo.
echo This function:
echo   - Routes to Supabase for recent data (hot path)
echo   - Falls back to ACE API for historical data
echo   - Caches responses for performance
echo   - Best for mixed queries
echo.

supabase functions deploy timeseries-proxy --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo WARNING: timeseries-proxy deployment failed (non-critical)
) else (
    echo SUCCESS: timeseries-proxy deployed
)

timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo Deployment Complete!
echo ==========================================
echo.
echo Primary Endpoints (Use these in dashboard):
echo.
echo   1. Direct API (Recommended for October-November 2025):
echo      https://your-project.supabase.co/functions/v1/timeseries-direct/api
echo.
echo   2. Smart Proxy (For mixed queries):
echo      https://your-project.supabase.co/functions/v1/timeseries-proxy/api
echo.
echo Background Jobs (Automated):
echo   - continuous-sync: Runs every 2 minutes via pg_cron
echo   - weekly-backfill: Runs daily at 2 AM UTC via pg_cron
echo.
echo ==========================================
echo Testing Endpoints
echo ==========================================
echo.
echo Test sites list:
echo   curl "https://your-project.supabase.co/functions/v1/timeseries-direct/api/sites"
echo.
echo Test October 2025 data:
echo   curl "https://your-project.supabase.co/functions/v1/timeseries-direct/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-10-01T00:00:00Z&end_time=2025-10-31T23:59:59Z&page_size=1000"
echo.
echo Test November 2025 data:
echo   curl "https://your-project.supabase.co/functions/v1/timeseries-direct/api/sites/ses_falls_city/timeseries/paginated?start_time=2025-11-01T00:00:00Z&end_time=2025-11-04T23:59:59Z&page_size=1000"
echo.
echo ==========================================
echo Next Steps
echo ==========================================
echo.
echo 1. Update frontend environment variables:
echo    VITE_API_BASE_URL=https://your-project.supabase.co/functions/v1/timeseries-direct/api
echo.
echo 2. Verify pg_cron schedules are active:
echo    Run: scripts\verify-cron-schedules.sql in Supabase SQL Editor
echo.
echo 3. Monitor Edge Function logs:
echo    supabase functions logs timeseries-direct
echo.
echo 4. Check data coverage:
echo    Run: scripts\check-data-coverage.sql in Supabase SQL Editor
echo.
echo Deployment script completed successfully!
echo.
pause
