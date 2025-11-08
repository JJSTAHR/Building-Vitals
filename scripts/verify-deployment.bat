@echo off
REM =============================================================================
REM Deployment Verification Script
REM Checks that all components are properly deployed and configured
REM =============================================================================

setlocal enabledelayedexpansion

echo ========================================
echo Building Vitals - Deployment Verification
echo ========================================
echo.

REM Load environment variables
if not exist ".env" (
    echo [ERROR] .env file not found!
    echo Run setup-environment.bat first.
    pause
    exit /b 1
)

echo [Loading environment variables from .env...]

REM Parse .env file (simplified - only handles simple KEY=VALUE format)
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "line=%%a"
    set "value=%%b"

    REM Skip comments and empty lines
    if not "!line:~0,1!"=="#" (
        if not "!line!"=="" (
            set "%%a=%%b"
        )
    )
)

echo [OK] Environment loaded
echo.

REM Check 1: Supabase Connection
echo ========================================
echo [1/5] Checking Supabase Connection
echo ========================================

if "!SUPABASE_URL!"=="" (
    echo [ERROR] SUPABASE_URL not configured
    set /a ERRORS+=1
) else (
    echo Testing connection to: !SUPABASE_URL!

    curl -s -o nul -w "HTTP Status: %%{http_code}\n" "!SUPABASE_URL!/rest/v1/?apikey=!SUPABASE_ANON_KEY!" > temp_status.txt
    set /p HTTP_STATUS=<temp_status.txt
    del temp_status.txt

    if "!HTTP_STATUS!"=="200" (
        echo [OK] Supabase connection successful
    ) else (
        echo [ERROR] Supabase connection failed: !HTTP_STATUS!
        set /a ERRORS+=1
    )
)
echo.

REM Check 2: ACE API Connection
echo ========================================
echo [2/5] Checking ACE API Connection
echo ========================================

if "!ACE_API_KEY!"=="" (
    echo [ERROR] ACE_API_KEY not configured
    set /a ERRORS+=1
) else (
    echo Testing ACE API...

    curl -s -o nul -w "HTTP Status: %%{http_code}\n" ^
        "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/configured_points?page=1&per_page=1" ^
        -H "Authorization: Bearer !ACE_API_KEY!" > temp_status.txt
    set /p HTTP_STATUS=<temp_status.txt
    del temp_status.txt

    if "!HTTP_STATUS!"=="200" (
        echo [OK] ACE API connection successful
    ) else (
        echo [ERROR] ACE API connection failed: !HTTP_STATUS!
        set /a ERRORS+=1
    )
)
echo.

REM Check 3: Cloudflare Worker
echo ========================================
echo [3/5] Checking Cloudflare Worker
echo ========================================

if "!VITE_WORKER_URL!"=="" (
    echo [WARNING] VITE_WORKER_URL not configured
    set /a WARNINGS+=1
) else (
    echo Testing worker at: !VITE_WORKER_URL!

    curl -s -o nul -w "HTTP Status: %%{http_code}\n" "!VITE_WORKER_URL!/health" > temp_status.txt
    set /p HTTP_STATUS=<temp_status.txt
    del temp_status.txt

    if "!HTTP_STATUS!"=="200" (
        echo [OK] Cloudflare Worker is responding
    ) else (
        echo [WARNING] Worker health check failed: !HTTP_STATUS!
        echo Worker may not be deployed yet.
        set /a WARNINGS+=1
    )
)
echo.

REM Check 4: Database Tables
echo ========================================
echo [4/5] Checking Database Schema
echo ========================================

echo Checking if critical tables exist...

REM Test if timeseries_raw table exists
curl -s "!SUPABASE_URL!/rest/v1/timeseries_raw?select=point_name&limit=1" ^
    -H "apikey: !SUPABASE_SERVICE_ROLE_KEY!" ^
    -H "Authorization: Bearer !SUPABASE_SERVICE_ROLE_KEY!" > temp_response.txt

findstr /C:"point_name" temp_response.txt >nul 2>&1
if errorlevel 1 (
    echo [ERROR] timeseries_raw table not found or inaccessible
    echo Run: scripts\deploy-supabase.bat
    set /a ERRORS+=1
) else (
    echo [OK] timeseries_raw table exists
)

REM Test if points table exists
curl -s "!SUPABASE_URL!/rest/v1/points?select=name&limit=1" ^
    -H "apikey: !SUPABASE_SERVICE_ROLE_KEY!" ^
    -H "Authorization: Bearer !SUPABASE_SERVICE_ROLE_KEY!" >> temp_response.txt

findstr /C:"name" temp_response.txt >nul 2>&1
if errorlevel 1 (
    echo [ERROR] points table not found or inaccessible
    set /a ERRORS+=1
) else (
    echo [OK] points table exists
)

del temp_response.txt
echo.

REM Check 5: Edge Functions
echo ========================================
echo [5/5] Checking Supabase Edge Functions
echo ========================================

where supabase >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Supabase CLI not installed
    echo Cannot verify Edge Functions
    set /a WARNINGS+=1
) else (
    echo Listing deployed functions...
    supabase functions list 2>nul
    if errorlevel 1 (
        echo [WARNING] Could not list functions
        echo May not be linked to project
        set /a WARNINGS+=1
    )
)
echo.

REM Summary
echo ========================================
echo Verification Summary
echo ========================================
echo.

if "!ERRORS!"=="" set ERRORS=0
if "!WARNINGS!"=="" set WARNINGS=0

if !ERRORS! EQU 0 (
    echo [SUCCESS] All critical checks passed!
    if !WARNINGS! GTR 0 (
        echo [INFO] !WARNINGS! warnings found (non-critical^)
    )
    echo.
    echo Your deployment is ready for use.
    echo.
    echo Next steps:
    echo 1. Start the development server:
    echo    npm run dev
    echo.
    echo 2. Build for production:
    echo    npm run build
    echo.
    echo 3. Set up continuous sync:
    echo    Check docs\DEPLOYMENT_GUIDE.md
) else (
    echo [ERROR] !ERRORS! critical errors found!
    if !WARNINGS! GTR 0 (
        echo [WARNING] !WARNINGS! warnings found
    )
    echo.
    echo Please fix the errors above before proceeding.
    echo.
    echo Common fixes:
    echo - Run: setup-environment.bat
    echo - Run: scripts\deploy-supabase.bat
    echo - Run: scripts\deploy-cloudflare.bat
)
echo.

pause
