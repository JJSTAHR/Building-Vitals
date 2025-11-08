@echo off
REM Backfill Oct 1, 2025 to Nov 3, 2025 (34 days total)
REM Today is Nov 3, 2025

SET SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
SET SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M
SET ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg
SET ACE_API_BASE=https://flightdeck.aceiot.cloud/api

cd /d "%~dp0\.."

echo ============================================================
echo BACKFILL: October 1, 2025 to November 3, 2025
echo ============================================================
echo.
echo This will backfill 34 days of data for ses_falls_city
echo Estimated time: 8-12 hours
echo.
echo Starting at: %DATE% %TIME%
echo.
echo ============================================================
echo.

REM Create log file
set LOGFILE=backfill-oct-nov-%DATE:~-4%-%DATE:~4,2%-%DATE:~7,2%.log
echo Backfill started at %DATE% %TIME% > "%LOGFILE%"

REM Counter for progress
set /a TOTAL_DAYS=34
set /a COMPLETED=0

REM Loop from 33 days ago (Oct 1) to 0 days ago (Nov 3)
for /L %%D in (33,-1,0) do (
    set /a COMPLETED+=1
    echo.
    echo ============================================================
    echo Day !COMPLETED! of %TOTAL_DAYS%: Backfilling %%D days ago
    echo ============================================================
    echo.

    REM Run backfill for this day
    "C:\Users\jstahr\AppData\Local\Programs\Python\Python311\python.exe" scripts\python\daily_backfill_v2.py --days-ago %%D --site ses_falls_city

    REM Check if successful
    if errorlevel 1 (
        echo ERROR: Backfill failed for %%D days ago >> "%LOGFILE%"
        echo.
        echo *** ERROR: Backfill failed for %%D days ago ***
        echo Press any key to continue or Ctrl+C to abort...
        pause >nul
    ) else (
        echo SUCCESS: Backfill completed for %%D days ago >> "%LOGFILE%"
    )

    echo Progress: !COMPLETED! / %TOTAL_DAYS% days complete
)

echo.
echo ============================================================
echo BACKFILL COMPLETE!
echo ============================================================
echo Completed at: %DATE% %TIME%
echo.
echo See log file: %LOGFILE%
echo.
pause
