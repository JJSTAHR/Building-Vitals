@echo off
REM ==========================================
REM Setup Edge Function Secrets
REM Sets required environment variables for deployed functions
REM ==========================================

echo.
echo ==========================================
echo Edge Function Secrets Setup
echo ==========================================
echo.
echo This script sets required secrets for Edge Functions:
echo   - ACE_API_KEY          (Required for ACE API access)
echo   - SUPABASE_URL         (Auto-configured by Supabase)
echo   - SUPABASE_SERVICE_ROLE_KEY (Auto-configured by Supabase)
echo.

REM Check if Supabase CLI is installed
where supabase >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Supabase CLI not found!
    echo Please install: scoop install supabase
    exit /b 1
)

echo Enter your ACE API Key (JWT token):
echo Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
echo.
set /p ACE_KEY="ACE_API_KEY: "

if "%ACE_KEY%"=="" (
    echo ERROR: ACE_API_KEY cannot be empty
    exit /b 1
)

echo.
echo Setting ACE_API_KEY secret...
supabase secrets set ACE_API_KEY="%ACE_KEY%"

if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to set ACE_API_KEY
    exit /b 1
)

echo.
echo ==========================================
echo Success!
echo ==========================================
echo.
echo ACE_API_KEY has been set for all Edge Functions.
echo.
echo Note: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
echo automatically configured by Supabase for all Edge Functions.
echo.
echo Verify secrets:
echo   supabase secrets list
echo.
echo Deploy functions:
echo   scripts\deploy-working-functions.bat
echo.
pause
