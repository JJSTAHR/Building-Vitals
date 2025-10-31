@echo off
REM ============================================================================
REM Deploy Continuous Sync Edge Function
REM ============================================================================
REM This script deploys the continuous-sync Edge Function to Supabase
REM and sets up the 5-minute cron schedule
REM ============================================================================

echo.
echo ================================================================================
echo DEPLOYING CONTINUOUS SYNC EDGE FUNCTION
echo ================================================================================
echo.
echo This will:
echo   1. Deploy continuous-sync Edge Function to Supabase
echo   2. Set up 5-minute cron schedule (pg_cron)
echo   3. Configure ACE_API_KEY secret
echo.
pause

REM Step 1: Deploy the Edge Function
echo.
echo [1/3] Deploying Edge Function...
echo.

npx supabase functions deploy continuous-sync ^
  --no-verify-jwt ^
  --project-ref jywxcqcjsvlyehuvsoar

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to deploy Edge Function
    pause
    exit /b 1
)

REM Step 2: Set ACE_API_KEY secret
echo.
echo [2/3] Setting ACE_API_KEY secret...
echo.

set ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg

npx supabase secrets set ACE_API_KEY=%ACE_API_KEY% ^
  --project-ref jywxcqcjsvlyehuvsoar

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to set ACE_API_KEY secret
    pause
    exit /b 1
)

REM Step 3: Apply pg_cron migration
echo.
echo [3/3] Setting up 5-minute cron schedule...
echo.

echo You need to run the migration manually via Supabase SQL Editor:
echo.
echo 1. Go to: https://supabase.com/dashboard/project/jywxcqcjsvlyehuvsoar/sql/new
echo 2. Copy and paste: supabase/migrations/20251031000000_schedule_continuous_sync.sql
echo 3. Update the service_role_key setting with your actual key
echo 4. Execute the SQL
echo.

echo.
echo ================================================================================
echo DEPLOYMENT COMPLETE
echo ================================================================================
echo.
echo Edge Function URL:
echo   https://jywxcqcjsvlyehuvsoar.supabase.co/functions/v1/continuous-sync
echo.
echo Test it manually:
echo   curl -X POST https://jywxcqcjsvlyehuvsoar.supabase.co/functions/v1/continuous-sync ^
echo     -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY"
echo.
echo The function will run automatically every 5 minutes via pg_cron.
echo.
pause
