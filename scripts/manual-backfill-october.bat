@echo off
REM ==========================================
REM Manual Backfill for October 2025
REM Calls weekly-backfill Edge Function for each day
REM ==========================================

setlocal enabledelayedexpansion

set SUPABASE_PROJECT_URL=https://your-project.supabase.co

echo.
echo ==========================================
echo Manual Backfill - October 2025
echo ==========================================
echo.
echo This will backfill ALL days in October 2025
echo for site: ses_falls_city
echo.
echo Project: %SUPABASE_PROJECT_URL%
echo.
echo Press Ctrl+C to cancel or
pause

REM Backfill each day of October (days 1-31)
for /L %%d in (1,1,31) do (
    echo.
    echo ==========================================
    echo Backfilling October %%d, 2025
    echo ==========================================

    REM Calculate how many days ago (from Nov 4)
    set /a DAYS_AGO=31-%%d+4

    echo Days ago: !DAYS_AGO!
    echo Calling weekly-backfill Edge Function...

    curl -X POST "%SUPABASE_PROJECT_URL%/functions/v1/weekly-backfill" ^
        -H "Content-Type: application/json" ^
        -d "{\"daysAgo\": !DAYS_AGO!, \"site\": \"ses_falls_city\"}"

    echo.
    echo Completed October %%d
    echo Waiting 5 seconds before next day...
    timeout /t 5 /nobreak >nul
)

echo.
echo ==========================================
echo Backfill Complete!
echo ==========================================
echo.
echo All 31 days of October 2025 have been backfilled.
echo.
echo Verify data coverage:
echo   Run: scripts\check-data-coverage.sql in Supabase SQL Editor
echo.
echo Check logs:
echo   supabase functions logs weekly-backfill
echo.
pause
