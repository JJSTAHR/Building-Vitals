@echo off
REM ============================================
REM Supabase Backfill Starter Script
REM Handles 7,327 points efficiently
REM ============================================

echo.
echo ========================================
echo   Supabase Data Backfill for Building Vitals
echo   Site: ses_falls_city
echo   Points: 7,327
echo ========================================
echo.

REM Set environment variables
echo Setting environment variables...
set SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M
set ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg
set ACE_API_BASE=https://flightdeck.aceiot.cloud/api

echo.
echo Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Python is not installed!
    echo.
    echo Please install Python from:
    echo   - Microsoft Store: search for "Python 3.11"
    echo   - Or download from: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo Python found!
echo.

echo Installing required packages...
pip install -q supabase requests python-dateutil tqdm
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install packages
    echo Try running: pip install supabase requests python-dateutil tqdm
    echo.
    pause
    exit /b 1
)

echo Packages installed!
echo.

cd scripts\python

echo ========================================
echo   BACKFILL OPTIONS
echo ========================================
echo.
echo   1. Quick Test (Last 24 hours)
echo   2. Last Week (Recommended Start)
echo   3. Last Month
echo   4. Last 3 Months
echo   5. Custom Date Range
echo   6. Full 2025 Backfill (Jan-Oct)
echo.

set /p choice="Select option (1-6): "

if "%choice%"=="1" (
    echo.
    echo Starting backfill for last 24 hours...
    python backfill_supabase_optimized.py --site ses_falls_city --days 1 --workers 4
) else if "%choice%"=="2" (
    echo.
    echo Starting backfill for last week...
    python backfill_supabase_optimized.py --site ses_falls_city --days 7 --workers 4
) else if "%choice%"=="3" (
    echo.
    echo Starting backfill for last month...
    python backfill_supabase_optimized.py --site ses_falls_city --days 30 --workers 4
) else if "%choice%"=="4" (
    echo.
    echo Starting backfill for last 3 months...
    python backfill_supabase_optimized.py --site ses_falls_city --days 90 --workers 4
) else if "%choice%"=="5" (
    echo.
    set /p start_date="Enter start date (YYYY-MM-DD): "
    set /p end_date="Enter end date (YYYY-MM-DD): "
    echo.
    echo Starting custom backfill from %start_date% to %end_date%...
    python backfill_supabase_optimized.py --site ses_falls_city --start %start_date% --end %end_date% --workers 4
) else if "%choice%"=="6" (
    echo.
    echo Starting FULL 2025 backfill (this will take 20-40 hours)...
    echo Press Ctrl+C to cancel or any key to continue...
    pause >nul
    echo.

    echo Processing January 2025...
    python backfill_supabase_optimized.py --site ses_falls_city --start 2025-01-01 --end 2025-02-01 --workers 8

    echo Processing February 2025...
    python backfill_supabase_optimized.py --site ses_falls_city --start 2025-02-01 --end 2025-03-01 --workers 8

    echo Processing March 2025...
    python backfill_supabase_optimized.py --site ses_falls_city --start 2025-03-01 --end 2025-04-01 --workers 8

    echo Processing April 2025...
    python backfill_supabase_optimized.py --site ses_falls_city --start 2025-04-01 --end 2025-05-01 --workers 8

    echo Processing May 2025...
    python backfill_supabase_optimized.py --site ses_falls_city --start 2025-05-01 --end 2025-06-01 --workers 8

    echo Processing June 2025...
    python backfill_supabase_optimized.py --site ses_falls_city --start 2025-06-01 --end 2025-07-01 --workers 8

    echo Processing July 2025...
    python backfill_supabase_optimized.py --site ses_falls_city --start 2025-07-01 --end 2025-08-01 --workers 8

    echo Processing August 2025...
    python backfill_supabase_optimized.py --site ses_falls_city --start 2025-08-01 --end 2025-09-01 --workers 8

    echo Processing September 2025...
    python backfill_supabase_optimized.py --site ses_falls_city --start 2025-09-01 --end 2025-10-01 --workers 8

    echo Processing October 2025...
    python backfill_supabase_optimized.py --site ses_falls_city --start 2025-10-01 --end 2025-11-01 --workers 8
) else (
    echo.
    echo Invalid option selected!
)

echo.
echo ========================================
echo   BACKFILL COMPLETE!
echo ========================================
echo.
echo Check data at: https://ace-iot-timeseries-prod.jstahr.workers.dev/api/hot-health
echo View logs at: scripts\python\backfill.log
echo.

pause