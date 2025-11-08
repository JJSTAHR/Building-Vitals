@echo off
REM ============================================================================
REM Import All October CSV Files to Supabase
REM ============================================================================

setlocal

REM Set environment variables
set SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M

echo.
echo ================================================================================
echo IMPORTING 4 OCTOBER CSV FILES TO SUPABASE
echo ================================================================================
echo.
echo This will import all 4 CSV files sequentially.
echo.
echo Press Ctrl+C to cancel, or
pause

set "FILE1=C:\Users\jstahr\Downloads\ses_falls_city-2025-11-01T18_15_26.338836-export.csv"
set "FILE2=C:\Users\jstahr\Downloads\ses_falls_city-2025-11-01T18_10_15.882696-export.csv"
set "FILE3=C:\Users\jstahr\Downloads\ses_falls_city-2025-11-01T18_11_45.577477-export.csv"
set "FILE4=C:\Users\jstahr\Downloads\ses_falls_city-2025-11-01T18_07_33.699858-export.csv"

set SUCCESS=0
set FAILED=0

REM Import File 1
echo.
echo ================================================================================
echo [1/4] Importing: %FILE1%
echo ================================================================================
python scripts\python\import_csv_to_supabase.py "%FILE1%" --batch-size 1000
if %ERRORLEVEL% EQU 0 (
    set /a SUCCESS+=1
    echo [1/4] SUCCESS
) else (
    set /a FAILED+=1
    echo [1/4] FAILED
)

REM Import File 2
echo.
echo ================================================================================
echo [2/4] Importing: %FILE2%
echo ================================================================================
python scripts\python\import_csv_to_supabase.py "%FILE2%" --batch-size 1000
if %ERRORLEVEL% EQU 0 (
    set /a SUCCESS+=1
    echo [2/4] SUCCESS
) else (
    set /a FAILED+=1
    echo [2/4] FAILED
)

REM Import File 3
echo.
echo ================================================================================
echo [3/4] Importing: %FILE3%
echo ================================================================================
python scripts\python\import_csv_to_supabase.py "%FILE3%" --batch-size 1000
if %ERRORLEVEL% EQU 0 (
    set /a SUCCESS+=1
    echo [3/4] SUCCESS
) else (
    set /a FAILED+=1
    echo [3/4] FAILED
)

REM Import File 4
echo.
echo ================================================================================
echo [4/4] Importing: %FILE4%
echo ================================================================================
python scripts\python\import_csv_to_supabase.py "%FILE4%" --batch-size 1000
if %ERRORLEVEL% EQU 0 (
    set /a SUCCESS+=1
    echo [4/4] SUCCESS
) else (
    set /a FAILED+=1
    echo [4/4] FAILED
)

echo.
echo ================================================================================
echo ALL IMPORTS COMPLETE
echo ================================================================================
echo Successful: %SUCCESS% / 4
echo Failed: %FAILED% / 4
echo ================================================================================
echo.

echo Press any key to exit...
pause >nul
