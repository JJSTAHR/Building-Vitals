@echo off
REM Quick Recovery Batch Script for Windows
REM Execute emergency recovery with one command

echo ========================================
echo EMERGENCY RECOVERY STARTING
echo ========================================
echo.

REM Check if node is available
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    exit /b 1
)

REM Run emergency recovery
echo [1/3] Running emergency recovery script...
node scripts\emergency-recovery.cjs
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Recovery script failed
    echo Check recovery-*.log for details
    exit /b 1
)

echo.
echo [2/3] Verifying recovery...
node scripts\verify-recovery.cjs
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Verification shows issues
    echo System may be partially recovered
)

echo.
echo [3/3] Starting continuous sync...
call scripts\START_CONTINUOUS_SYNC.bat >nul 2>&1

echo.
echo ========================================
echo RECOVERY PROCESS COMPLETE
echo ========================================
echo.
echo Next steps:
echo 1. Check dashboard at http://localhost:5173
echo 2. Review recovery-*.log for details
echo 3. Run 'npm run dev' to test locally
echo.
pause