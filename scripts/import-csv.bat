@echo off
REM ============================================================================
REM Import FlightDeck CSV Export to Supabase
REM ============================================================================
REM Usage: import-csv.bat <path-to-csv-file>
REM Example: import-csv.bat "C:\Users\jstahr\Downloads\ses_falls_city-2025-11-01T17_54_09.470065-export.csv"
REM ============================================================================

if "%~1"=="" (
    echo Error: Please provide a CSV file path
    echo.
    echo Usage: import-csv.bat ^<path-to-csv-file^>
    echo Example: import-csv.bat "C:\Users\jstahr\Downloads\ses_falls_city-export.csv"
    echo.
    pause
    exit /b 1
)

REM Set environment variables
set SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M

echo.
echo ================================================================================
echo IMPORTING CSV TO SUPABASE
echo ================================================================================
echo.
echo CSV File: %~1
echo.
echo Press Ctrl+C to cancel, or
pause

python scripts\python\import_csv_to_supabase.py "%~1" --batch-size 1000

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo SUCCESS - CSV imported to Supabase
    echo ================================================================================
) else (
    echo.
    echo ================================================================================
    echo ERROR - Import failed with error code %ERRORLEVEL%
    echo ================================================================================
)

echo.
echo Press any key to exit...
pause >nul
