@echo off
REM Daily Backfill Runner
REM Sets environment variables and runs the Python backfill script

SET SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
SET SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M
SET ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg
SET ACE_API_BASE=https://flightdeck.aceiot.cloud/api

cd /d "%~dp0\.."

echo ============================================================
echo Daily Backfill Runner
echo ============================================================
echo.

REM Get parameters
set DAYS_AGO=%1
set SITE_ARG=%2

if "%DAYS_AGO%"=="" set DAYS_AGO=1

if "%SITE_ARG%"=="all" (
    echo Running backfill for ALL SITES ^(%DAYS_AGO% days ago^)...
    "C:\Users\jstahr\AppData\Local\Programs\Python\Python311\python.exe" scripts\python\daily_backfill_v2.py --days-ago %DAYS_AGO% --all-sites
) else if "%SITE_ARG%"=="" (
    echo Running backfill for DEFAULT SITE ^(%DAYS_AGO% days ago^)...
    "C:\Users\jstahr\AppData\Local\Programs\Python\Python311\python.exe" scripts\python\daily_backfill_v2.py --days-ago %DAYS_AGO%
) else (
    echo Running backfill for SITE: %SITE_ARG% ^(%DAYS_AGO% days ago^)...
    "C:\Users\jstahr\AppData\Local\Programs\Python\Python311\python.exe" scripts\python\daily_backfill_v2.py --days-ago %DAYS_AGO% --site %SITE_ARG%
)

echo.
echo ============================================================
echo Backfill complete! Exit code: %ERRORLEVEL%
echo ============================================================
pause
