@echo off
REM Fast backfill Oct 1 - Nov 3, 2025 (skips pauses)

SETLOCAL ENABLEDELAYEDEXPANSION

SET SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
SET SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M
SET ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg
SET ACE_API_BASE=https://flightdeck.aceiot.cloud/api

cd /d "%~dp0\.."

echo ============================================================
echo FAST BACKFILL: October 1 - November 3, 2025
echo ============================================================
echo Total: 34 days
echo Site: ses_falls_city
echo.
echo Started: %DATE% %TIME%
echo.
echo ============================================================
echo.

set /a COMPLETED=0
set /a FAILED=0

REM Loop from Oct 1 (33 days ago) to Nov 3 (0 days ago)
for /L %%D in (33,-1,0) do (
    set /a COMPLETED+=1

    echo [!COMPLETED!/34] Backfilling %%D days ago...

    "C:\Users\jstahr\AppData\Local\Programs\Python\Python311\python.exe" scripts\python\daily_backfill_v2.py --days-ago %%D --site ses_falls_city

    if errorlevel 1 (
        set /a FAILED+=1
        echo   ^> FAILED
    ) else (
        echo   ^> SUCCESS
    )

    echo.
)

echo ============================================================
echo BACKFILL COMPLETE
echo ============================================================
echo Completed: %DATE% %TIME%
echo Total days: 34
echo Successful: %COMPLETED% - %FAILED% = !RESULT! days
echo Failed: %FAILED% days
echo ============================================================
echo.

if %FAILED% GTR 0 (
    echo WARNING: %FAILED% days failed. Check logs above.
)

pause
