@echo off
REM ============================================
REM Continuous Data Sync Service for Building Vitals
REM Keeps data fresh by syncing every 60 seconds
REM ============================================

echo.
echo ========================================
echo   CONTINUOUS DATA SYNC SERVICE
echo   Site: ses_falls_city
echo   Sync Interval: 60 seconds
echo   Data Window: Last 10 minutes
echo ========================================
echo.

REM Set environment variables
echo Setting environment variables...
set SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M
set ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg

echo.
echo Starting continuous sync service...
echo This will sync data every 60 seconds.
echo Press Ctrl+C to stop the service.
echo.

cd /d "%~dp0"
node continuous-data-sync.cjs

pause