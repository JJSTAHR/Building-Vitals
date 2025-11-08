@echo off
REM Create performance indexes for timeseries tables

SET SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
SET SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M

cd /d "%~dp0\.."

echo ============================================================
echo CREATING PERFORMANCE INDEXES
echo ============================================================
echo.

"C:\Users\jstahr\AppData\Local\Programs\Python\Python311\python.exe" scripts\create-indexes.py

echo.
echo ============================================================
echo COMPLETE
echo ============================================================
echo.
pause
