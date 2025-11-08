@echo off
REM Test Multi-Site Backfill Edge Function
REM Usage:
REM   test-multi-site-backfill.bat                    # Test default site (ses_falls_city), 1 day ago
REM   test-multi-site-backfill.bat 7                  # Test default site, 7 days ago
REM   test-multi-site-backfill.bat 1 my_site          # Test specific site, 1 day ago
REM   test-multi-site-backfill.bat 1 all              # Test ALL sites, 1 day ago

echo ============================================================
echo Testing Multi-Site Weekly Backfill Edge Function
echo ============================================================
echo.

REM Get days-ago parameter (default: 1)
if "%1"=="" (
    set DAYS_AGO=1
) else (
    set DAYS_AGO=%1
)

REM Get site parameter (default: ses_falls_city)
if "%2"=="" (
    set SITE_PARAM=ses_falls_city
    set BODY_JSON={\"daysAgo\": %DAYS_AGO%}
    echo Testing default site: ses_falls_city, %DAYS_AGO% days ago
) else if "%2"=="all" (
    set SITE_PARAM=ALL_SITES
    set BODY_JSON={\"daysAgo\": %DAYS_AGO%, \"allSites\": true}
    echo Testing ALL SITES, %DAYS_AGO% days ago
) else (
    set SITE_PARAM=%2
    set BODY_JSON={\"daysAgo\": %DAYS_AGO%, \"site\": \"%2\"}
    echo Testing specific site: %2, %DAYS_AGO% days ago
)

echo.
echo Request body: %BODY_JSON%
echo.
echo Invoking Edge Function...
echo (This may take 5-15 minutes depending on data volume)
echo.

REM Use curl to invoke the function directly via HTTP
curl -i --location --request POST "https://jywxcqcjsvlyehuvsoar.supabase.co/functions/v1/weekly-backfill" ^
  --header "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NzU0OTcsImV4cCI6MjA3NzE1MTQ5N30.SQB_pWKXi_3t2U5C2qYFPaUz-jzR6LJqZFCjqFyb_8c" ^
  --header "Content-Type: application/json" ^
  --data "%BODY_JSON%"

echo.
echo ============================================================
echo Test complete!
echo ============================================================
echo.
echo Check the response above for:
echo   - sitesProcessed: Number of sites that were processed
echo   - totalSamples: Total samples fetched
echo   - totalInserted: Total samples inserted
echo   - results: Per-site breakdown
echo.
pause
