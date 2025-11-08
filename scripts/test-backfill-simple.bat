@echo off
REM Simple test script using curl to invoke Edge Function
REM Usage: test-backfill-simple.bat [days-ago] [site|all]

setlocal enabledelayedexpansion

echo ============================================================
echo Testing Multi-Site Weekly Backfill Edge Function
echo ============================================================
echo.

REM Get parameters
set DAYS_AGO=%1
if "%DAYS_AGO%"=="" set DAYS_AGO=1

set SITE_PARAM=%2

REM Build JSON body
if "%SITE_PARAM%"=="all" (
    set BODY={"daysAgo": %DAYS_AGO%, "allSites": true}
    echo Testing: ALL SITES, %DAYS_AGO% days ago
) else if "%SITE_PARAM%"=="" (
    set BODY={"daysAgo": %DAYS_AGO%}
    echo Testing: Default site (ses_falls_city), %DAYS_AGO% days ago
) else (
    set BODY={"daysAgo": %DAYS_AGO%, "site": "%SITE_PARAM%"}
    echo Testing: Site %SITE_PARAM%, %DAYS_AGO% days ago
)

echo.
echo Request body: !BODY!
echo.
echo Invoking Edge Function...
echo (This may take 5-15 minutes depending on data volume)
echo.

REM Invoke via CURL
curl -s -X POST "https://jywxcqcjsvlyehuvsoar.supabase.co/functions/v1/weekly-backfill" ^
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NzU0OTcsImV4cCI6MjA3NzE1MTQ5N30.SQB_pWKXi_3t2U5C2qYFPaUz-jzR6LJqZFCjqFyb_8c" ^
  -H "Content-Type: application/json" ^
  -d "!BODY!" ^
  --max-time 900

echo.
echo.
echo ============================================================
echo Test complete!
echo ============================================================
echo.
echo The response above shows:
echo   - success: true/false
echo   - sitesProcessed: Number of sites processed
echo   - totalSamples: Total samples fetched
echo   - totalInserted: Total samples inserted
echo   - results: Per-site breakdown with errors (if any)
echo.
pause
