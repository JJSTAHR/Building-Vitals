@echo off
REM =============================================================================
REM Supabase Deployment Script
REM Deploys Edge Functions and applies database migrations
REM =============================================================================

setlocal enabledelayedexpansion

echo ========================================
echo Building Vitals - Supabase Deployment
echo ========================================
echo.

REM Check if Supabase CLI is installed
where supabase >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Supabase CLI not found!
    echo.
    echo Please install it first:
    echo   npm install -g supabase
    echo.
    echo Or with Scoop:
    echo   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
    echo   scoop install supabase
    echo.
    pause
    exit /b 1
)

REM Check if logged in to Supabase
echo [Step 1/5] Checking Supabase authentication...
supabase projects list >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Not logged in to Supabase
    echo.
    echo Please log in:
    supabase login
    if errorlevel 1 (
        echo [ERROR] Login failed
        pause
        exit /b 1
    )
)
echo [OK] Authenticated

REM Link to project if not already linked
echo.
echo [Step 2/5] Linking to Supabase project...

if not exist "supabase\.temp\project-ref" (
    echo Please enter your Supabase project reference ID:
    echo (Find it in: Project Settings ^> General ^> Reference ID^)
    set /p PROJECT_REF="Project Ref: "

    supabase link --project-ref !PROJECT_REF!
    if errorlevel 1 (
        echo [ERROR] Failed to link project
        pause
        exit /b 1
    )
) else (
    echo [OK] Already linked to project
)

REM Apply database migrations
echo.
echo [Step 3/5] Applying database migrations...
echo This will run all pending SQL migrations in supabase/migrations/

supabase db push
if errorlevel 1 (
    echo [ERROR] Migration failed!
    echo.
    echo Check the error above and verify:
    echo - Your database is accessible
    echo - SQL syntax is correct
    echo - No conflicting migrations exist
    echo.
    pause
    exit /b 1
)
echo [OK] Migrations applied

REM Deploy Edge Functions
echo.
echo [Step 4/5] Deploying Supabase Edge Functions...
echo.

set FUNCTIONS=continuous-sync timeseries-proxy weekly-backfill

for %%f in (%FUNCTIONS%) do (
    echo Deploying function: %%f
    supabase functions deploy %%f --no-verify-jwt
    if errorlevel 1 (
        echo [WARNING] Failed to deploy %%f
    ) else (
        echo [OK] Deployed %%f
    )
    echo.
)

REM Set Edge Function secrets
echo.
echo [Step 5/5] Setting Edge Function secrets...
echo.
echo You will need to provide the following secrets:

set /p SUPABASE_URL="SUPABASE_URL (e.g., https://xxx.supabase.co): "
set /p SUPABASE_SERVICE_ROLE_KEY="SUPABASE_SERVICE_ROLE_KEY (from Project Settings > API): "
set /p ACE_API_KEY="ACE_API_KEY (your ACE API token): "

echo Setting secrets...
echo !SUPABASE_URL! | supabase secrets set SUPABASE_URL
echo !SUPABASE_SERVICE_ROLE_KEY! | supabase secrets set SUPABASE_SERVICE_ROLE_KEY
echo !ACE_API_KEY! | supabase secrets set ACE_API_KEY

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Test your Edge Functions:
echo    scripts\test-edge-functions.bat
echo.
echo 2. Verify database migrations:
echo    scripts\verify-deployment.bat
echo.
echo 3. Configure your frontend .env file:
echo    setup-environment.bat
echo.
pause
