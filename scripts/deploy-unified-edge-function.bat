@echo off
REM Deploy Unified Timeseries Edge Function
REM This script deploys the production-ready unified function

echo ========================================
echo Deploying Unified Timeseries Edge Function
echo ========================================
echo.

REM Check if Supabase CLI is installed
where supabase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Supabase CLI not found. Install with: npm install -g supabase
    exit /b 1
)

REM Check if logged in
supabase projects list >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Please log in to Supabase first:
    echo   supabase login
    echo.
    exit /b 1
)

echo Deploying timeseries-unified function...
echo.

REM Deploy the function
supabase functions deploy timeseries-unified ^
    --project-ref jnjzbqnwyutbfwagxfru ^
    --no-verify-jwt

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Deployment Successful!
    echo ========================================
    echo.
    echo Function URL:
    echo https://jnjzbqnwyutbfwagxfru.supabase.co/functions/v1/timeseries-unified
    echo.
    echo Test endpoints:
    echo   Health:  /api/health
    echo   Sites:   /api/sites
    echo   Points:  /api/sites/YOUR_SITE/points
    echo   Data:    /api/sites/YOUR_SITE/timeseries/paginated
    echo.
    echo Authentication methods supported:
    echo   - Authorization: Bearer YOUR_JWT_TOKEN
    echo   - apikey: YOUR_ANON_KEY
    echo   - ace_token query parameter
    echo.
) else (
    echo.
    echo ========================================
    echo Deployment Failed!
    echo ========================================
    echo.
    echo Check the error messages above for details.
    echo.
    exit /b 1
)

pause
