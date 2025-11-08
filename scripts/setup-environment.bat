@echo off
REM =============================================================================
REM Environment Setup Script
REM Guides user through configuring environment variables
REM =============================================================================

setlocal enabledelayedexpansion

echo ========================================
echo Building Vitals - Environment Setup
echo ========================================
echo.

REM Check if .env already exists
if exist ".env" (
    echo [WARNING] .env file already exists!
    echo.
    set /p OVERWRITE="Do you want to overwrite it? (y/N): "
    if /i not "!OVERWRITE!"=="y" (
        echo.
        echo Keeping existing .env file.
        echo To edit manually, open: .env
        echo.
        pause
        exit /b 0
    )
)

REM Copy template
echo [Step 1/6] Creating .env file from template...
if not exist ".env.example" (
    echo [ERROR] .env.example not found!
    echo Please ensure you're in the project root directory.
    pause
    exit /b 1
)

copy ".env.example" ".env" >nul
echo [OK] Created .env

REM Generate encryption secret
echo.
echo [Step 2/6] Generating encryption secret...
echo.
echo Generating secure random encryption secret...

REM Use PowerShell to generate a secure random base64 string
for /f "delims=" %%i in ('powershell -command "[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))"') do set ENCRYPTION_SECRET=%%i

echo Generated: !ENCRYPTION_SECRET!
echo.

REM Update .env file with encryption secret
powershell -command "(Get-Content .env) -replace 'your_32_character_encryption_secret_here', '%ENCRYPTION_SECRET%' | Set-Content .env"

echo [OK] Encryption secret set

REM Configure Supabase
echo.
echo [Step 3/6] Configuring Supabase connection...
echo.
echo Please provide your Supabase credentials:
echo (Find these in: Supabase Dashboard ^> Project Settings ^> API^)
echo.

set /p SUPABASE_URL="Supabase URL (e.g., https://xxx.supabase.co): "
set /p SUPABASE_SERVICE_ROLE="Supabase Service Role Key: "
set /p SUPABASE_ANON="Supabase Anon Key: "

REM Update .env file
powershell -command "(Get-Content .env) -replace 'SUPABASE_URL=', 'SUPABASE_URL=%SUPABASE_URL%' | Set-Content .env"
powershell -command "(Get-Content .env) -replace 'SUPABASE_SERVICE_ROLE_KEY=', 'SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_SERVICE_ROLE%' | Set-Content .env"
powershell -command "(Get-Content .env) -replace 'SUPABASE_ANON_KEY=', 'SUPABASE_ANON_KEY=%SUPABASE_ANON%' | Set-Content .env"

echo.
echo Testing Supabase connection...
curl -s -o nul -w "HTTP Status: %%{http_code}" "%SUPABASE_URL%/rest/v1/?apikey=%SUPABASE_ANON%"
echo.
echo.

REM Configure ACE API
echo.
echo [Step 4/6] Configuring ACE API connection...
echo.
set /p ACE_API_KEY="ACE API Key (JWT token): "

powershell -command "(Get-Content .env) -replace 'ACE_API_KEY=', 'ACE_API_KEY=%ACE_API_KEY%' | Set-Content .env"

echo.
echo Testing ACE API connection...
curl -s -o nul -w "HTTP Status: %%{http_code}" "https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/configured_points?page=1&per_page=1" -H "Authorization: Bearer %ACE_API_KEY%"
echo.
echo.

REM Configure Cloudflare Worker
echo.
echo [Step 5/6] Configuring Cloudflare Worker URL...
echo.
set /p WORKER_URL="Worker URL (default: https://ace-iot-timeseries-prod.jstahr.workers.dev): "
if "!WORKER_URL!"=="" set WORKER_URL=https://ace-iot-timeseries-prod.jstahr.workers.dev

powershell -command "(Get-Content .env) -replace 'VITE_WORKER_URL=.*', 'VITE_WORKER_URL=%WORKER_URL%' | Set-Content .env"

echo [OK] Worker URL set

REM Configure default site
echo.
echo [Step 6/6] Configuring default site...
echo.
set /p DEFAULT_SITE="Default Site ID (default: ses_falls_city): "
if "!DEFAULT_SITE!"=="" set DEFAULT_SITE=ses_falls_city

powershell -command "(Get-Content .env) -replace 'VITE_DEFAULT_SITE_ID=.*', 'VITE_DEFAULT_SITE_ID=%DEFAULT_SITE%' | Set-Content .env"

REM Set default token if provided
echo.
set /p DEFAULT_TOKEN="Default token for %DEFAULT_SITE% (optional, press Enter to skip): "
if not "!DEFAULT_TOKEN!"=="" (
    powershell -command "(Get-Content .env) -replace 'VITE_DEFAULT_TOKEN_FALLS_CITY=.*', 'VITE_DEFAULT_TOKEN_FALLS_CITY=%DEFAULT_TOKEN%' | Set-Content .env"
)

echo.
echo ========================================
echo Environment Setup Complete!
echo ========================================
echo.
echo Configuration saved to: .env
echo.
echo IMPORTANT SECURITY NOTES:
echo - NEVER commit .env to version control
echo - Keep your secrets secure
echo - Rotate credentials regularly
echo.
echo Next steps:
echo 1. Verify deployment:
echo    scripts\verify-deployment.bat
echo.
echo 2. Deploy Supabase functions:
echo    scripts\deploy-supabase.bat
echo.
echo 3. Deploy Cloudflare worker:
echo    scripts\deploy-cloudflare.bat
echo.
pause
