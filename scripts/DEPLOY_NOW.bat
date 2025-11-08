@echo off
REM ==========================================
REM QUICK DEPLOY - Production Ready Edge Functions
REM Run this single script to deploy everything needed
REM ==========================================

echo.
echo ==========================================
echo  BUILDING VITALS - QUICK DEPLOY
echo  Dashboard Ready in 5 Minutes
echo ==========================================
echo.

REM Step 1: Setup secrets (if needed)
echo Step 1/3: Checking secrets...
echo.
supabase secrets list 2>nul | findstr /C:"ACE_API_KEY" >nul
if %ERRORLEVEL% neq 0 (
    echo WARNING: ACE_API_KEY not set!
    echo.
    echo Running secrets setup...
    call scripts\setup-edge-function-secrets.bat
    if %ERRORLEVEL% neq 0 exit /b 1
) else (
    echo ACE_API_KEY already configured
)

echo.
echo Step 2/3: Deploying Edge Functions...
echo.

REM Deploy primary function (critical for dashboard)
echo [1/4] Deploying timeseries-direct (CRITICAL)...
supabase functions deploy timeseries-direct --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: timeseries-direct deployment FAILED!
    echo This is the primary function for dashboard queries.
    echo.
    pause
    exit /b 1
)
echo SUCCESS: timeseries-direct deployed

REM Deploy background sync (non-critical)
echo.
echo [2/4] Deploying continuous-sync (automated)...
supabase functions deploy continuous-sync --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo WARNING: continuous-sync failed (non-critical, will retry)
) else (
    echo SUCCESS: continuous-sync deployed
)

REM Deploy backfill function (non-critical)
echo.
echo [3/4] Deploying weekly-backfill (for historical data)...
supabase functions deploy weekly-backfill --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo WARNING: weekly-backfill failed (non-critical, can deploy later)
) else (
    echo SUCCESS: weekly-backfill deployed
)

REM Deploy smart proxy (non-critical)
echo.
echo [4/4] Deploying timeseries-proxy (alternative endpoint)...
supabase functions deploy timeseries-proxy --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo WARNING: timeseries-proxy failed (non-critical)
) else (
    echo SUCCESS: timeseries-proxy deployed
)

echo.
echo Step 3/3: Running quick tests...
echo.

REM Get project URL from Supabase config
for /f "tokens=*" %%i in ('supabase status 2^>nul ^| findstr /C:"API URL"') do set API_URL_LINE=%%i
for /f "tokens=2 delims=: " %%a in ("%API_URL_LINE%") do set PROJECT_URL=%%a

if "%PROJECT_URL%"=="" (
    echo WARNING: Could not detect project URL
    echo Please set manually in .env:
    echo   VITE_API_BASE_URL=https://your-project.supabase.co/functions/v1/timeseries-direct/api
    goto :skip_test
)

echo Testing health endpoint...
curl -s "%PROJECT_URL%/functions/v1/timeseries-direct/api/health" | findstr "healthy" >nul
if %ERRORLEVEL%==0 (
    echo SUCCESS: Edge Function is responding!
) else (
    echo WARNING: Health check failed (may need a moment to initialize)
)

:skip_test

echo.
echo ==========================================
echo  DEPLOYMENT COMPLETE!
echo ==========================================
echo.
echo PRIMARY ENDPOINT (Use this in dashboard):
echo   %PROJECT_URL%/functions/v1/timeseries-direct/api
echo.
echo NEXT STEPS:
echo.
echo 1. Update .env file:
echo    VITE_API_BASE_URL=%PROJECT_URL%/functions/v1/timeseries-direct/api
echo.
echo 2. Rebuild frontend:
echo    npm run build
echo.
echo 3. Test in browser:
echo    - Navigate to your dashboard
echo    - Select October 2025 date range
echo    - Charts should load data from Edge Functions
echo.
echo 4. Backfill October data (if needed):
echo    scripts\manual-backfill-october.bat
echo.
echo 5. Monitor logs:
echo    supabase functions logs timeseries-direct
echo.
echo TROUBLESHOOTING:
echo   - No data? Run: scripts\manual-backfill-october.bat
echo   - Auth errors? Check: supabase secrets list
echo   - Slow queries? Reduce page_size parameter to 1000-5000
echo.
echo Full documentation: docs\EDGE_FUNCTION_DEPLOYMENT_GUIDE.md
echo.
pause
