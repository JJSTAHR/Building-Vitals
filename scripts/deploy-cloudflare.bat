@echo off
REM =============================================================================
REM Cloudflare Workers Deployment Script
REM Deploys the ACE proxy worker and sets secrets
REM =============================================================================

setlocal enabledelayedexpansion

echo ========================================
echo Building Vitals - Cloudflare Deployment
echo ========================================
echo.

REM Check if Wrangler is installed
where wrangler >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Wrangler CLI not found!
    echo.
    echo Installing Wrangler...
    npm install -g wrangler
    if errorlevel 1 (
        echo [ERROR] Failed to install Wrangler
        pause
        exit /b 1
    )
)

REM Check if logged in
echo [Step 1/4] Checking Cloudflare authentication...
wrangler whoami >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Not logged in to Cloudflare
    echo.
    echo Logging in...
    wrangler login
    if errorlevel 1 (
        echo [ERROR] Login failed
        pause
        exit /b 1
    )
)
echo [OK] Authenticated

REM Install dependencies
echo.
echo [Step 2/4] Installing dependencies...
if exist "package.json" (
    npm install
    if errorlevel 1 (
        echo [WARNING] Some dependencies failed to install
    )
)
echo [OK] Dependencies ready

REM Deploy worker
echo.
echo [Step 3/4] Deploying Cloudflare Worker...
echo.
echo Deploying to production environment...
wrangler deploy --env production

if errorlevel 1 (
    echo [ERROR] Deployment failed!
    echo.
    echo Common issues:
    echo - Check your wrangler.toml configuration
    echo - Verify account ID is correct
    echo - Ensure you have proper permissions
    echo.
    pause
    exit /b 1
)
echo [OK] Worker deployed

REM Set secrets
echo.
echo [Step 4/4] Setting Cloudflare Worker secrets...
echo.
echo You will need to provide the following secrets:

set /p SUPABASE_URL="SUPABASE_URL (e.g., https://xxx.supabase.co): "
set /p SUPABASE_SERVICE_ROLE_KEY="SUPABASE_SERVICE_ROLE_KEY: "
set /p ACE_API_KEY="ACE_API_KEY: "

echo.
echo Setting secrets...
echo !SUPABASE_URL! | wrangler secret put SUPABASE_URL --env production
echo !SUPABASE_SERVICE_ROLE_KEY! | wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
echo !ACE_API_KEY! | wrangler secret put ACE_API_KEY --env production

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Your worker is deployed at:
echo https://ace-iot-timeseries-prod.jstahr.workers.dev
echo.
echo Next steps:
echo 1. Test the worker endpoint:
echo    curl https://ace-iot-timeseries-prod.jstahr.workers.dev/health
echo.
echo 2. Update your .env file with the worker URL:
echo    VITE_WORKER_URL=https://ace-iot-timeseries-prod.jstahr.workers.dev
echo.
pause
