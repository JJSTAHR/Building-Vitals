@echo off
REM Execute performance optimization SQL script

SET SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M

echo ============================================================
echo PERFORMANCE OPTIMIZATION
echo ============================================================
echo.
echo This script will:
echo   1. Create composite indexes on (point_id, ts)
echo   2. Increase statement timeout to 60 seconds
echo   3. Update query planner statistics
echo.
echo This will take 5-10 minutes for 83M rows...
echo.
echo ALL 83M rows will be PRESERVED (no data deletion)
echo.
echo ============================================================
echo.

"C:\Users\jstahr\AppData\Local\Programs\Python\Python311\python.exe" "%~dp0python\run_performance_fix.py"

echo.
echo ============================================================
echo.
pause
