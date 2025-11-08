@echo off
REM Setup pg_cron Jobs Only
REM Use this if you deployed the Edge Function via Dashboard

echo ============================================================
echo Setting up pg_cron Jobs for Weekly Backfill
echo ============================================================
echo.

cd /d "%~dp0\.."

REM Step 1: Set the ACE API Key secret
echo [1/2] Setting ACE_API_KEY secret...
call supabase secrets set ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg --project-ref jywxcqcjsvlyehuvsoar
if errorlevel 1 (
    echo ERROR: Failed to set secret
    pause
    exit /b 1
)
echo [OK] Secret set
echo.

REM Step 2: Execute SQL to create cron jobs
echo [2/2] Setting up 7 daily MULTI-SITE pg_cron jobs...
call supabase db execute -f scripts/setup-multi-site-backfills.sql --project-ref jywxcqcjsvlyehuvsoar
if errorlevel 1 (
    echo ERROR: Failed to create cron jobs
    pause
    exit /b 1
)
echo [OK] Cron jobs created
echo.

REM Verify the setup
echo Verifying cron jobs...
call supabase db execute -c "SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'multi-site-backfill-day-%%' ORDER BY jobname;" --project-ref jywxcqcjsvlyehuvsoar
echo.

echo ============================================================
echo Setup Complete!
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
echo FUTURE-PROOF: New sites are automatically discovered and included!
echo.
echo To test manually, run:
echo   scripts\test-backfill-function.bat 1
echo.
pause
