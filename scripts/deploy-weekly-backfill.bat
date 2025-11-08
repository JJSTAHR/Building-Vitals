@echo off
REM Deploy Weekly Backfill System to Supabase
REM This deploys the Edge Function and sets up pg_cron jobs

echo ============================================================
echo Deploying Weekly Backfill System to Supabase
echo ============================================================
echo.

REM Check if Docker is running
echo Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo ============================================================
    echo ERROR: Docker is not running!
    echo ============================================================
    echo.
    echo Supabase Edge Functions require Docker to deploy.
    echo.
    echo Please start Docker Desktop and try again, OR
    echo Use the alternative deployment method below:
    echo.
    echo ALTERNATIVE: Deploy via Supabase Dashboard
    echo   1. Go to: https://supabase.com/dashboard/project/jywxcqcjsvlyehuvsoar/functions
    echo   2. Click "New Edge Function"
    echo   3. Name it: weekly-backfill
    echo   4. Copy code from: supabase\functions\weekly-backfill\index.ts
    echo   5. Click "Deploy Function"
    echo   6. Then run: scripts\setup-cron-only.bat
    echo.
    pause
    exit /b 1
)
echo [OK] Docker is running
echo.

REM Change to project directory
cd /d "%~dp0\.."

REM Step 1: Deploy the Edge Function
echo [1/4] Deploying weekly-backfill Edge Function...
call supabase functions deploy weekly-backfill --project-ref jywxcqcjsvlyehuvsoar --no-verify-jwt
if errorlevel 1 (
    echo ERROR: Failed to deploy Edge Function
    pause
    exit /b 1
)
echo [OK] Edge Function deployed
echo.

REM Step 2: Set the ACE API Key secret
echo [2/4] Setting ACE_API_KEY secret...
call supabase secrets set ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg --project-ref jywxcqcjsvlyehuvsoar
if errorlevel 1 (
    echo ERROR: Failed to set secret
    pause
    exit /b 1
)
echo [OK] Secret set
echo.

REM Step 3: Execute SQL to create MULTI-SITE cron jobs
echo [3/4] Setting up 7 daily MULTI-SITE pg_cron jobs...
call supabase db execute -f scripts/setup-multi-site-backfills.sql --project-ref jywxcqcjsvlyehuvsoar
if errorlevel 1 (
    echo ERROR: Failed to create cron jobs
    pause
    exit /b 1
)
echo [OK] Cron jobs created
echo.

REM Step 4: Verify the setup
echo [4/4] Verifying MULTI-SITE cron jobs...
call supabase db execute -c "SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'multi-site-backfill-day-%%' ORDER BY jobname;" --project-ref jywxcqcjsvlyehuvsoar
echo.

echo ============================================================
echo Deployment Complete!
echo ============================================================
echo.
echo The following 7 MULTI-SITE jobs are now scheduled:
echo   - multi-site-backfill-day-1: Daily at 2:00 AM UTC (ALL sites, yesterday)
echo   - multi-site-backfill-day-2: Daily at 2:30 AM UTC (ALL sites, 2 days ago)
echo   - multi-site-backfill-day-3: Daily at 3:00 AM UTC (ALL sites, 3 days ago)
echo   - multi-site-backfill-day-4: Daily at 3:30 AM UTC (ALL sites, 4 days ago)
echo   - multi-site-backfill-day-5: Daily at 4:00 AM UTC (ALL sites, 5 days ago)
echo   - multi-site-backfill-day-6: Daily at 4:30 AM UTC (ALL sites, 6 days ago)
echo   - multi-site-backfill-day-7: Daily at 5:00 AM UTC (ALL sites, 7 days ago)
echo.
echo FUTURE-PROOF: Each job automatically processes ALL sites!
echo When you add a new site, it's automatically included.
echo No manual configuration needed!
echo.
echo To test manually, run:
echo   supabase functions invoke weekly-backfill --body "{\"daysAgo\": 1}"
echo.
pause
