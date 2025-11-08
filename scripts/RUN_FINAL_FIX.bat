@echo off
REM ============================================================================
REM FINAL COMPLETE FIX - Windows Batch Launcher
REM ============================================================================
REM
REM This script runs the comprehensive fix script that resolves all issues:
REM   1. Checks partition data integrity
REM   2. Recovers/backfills missing data
REM   3. Fixes JWT authentication
REM   4. Deploys unified Edge Functions
REM   5. Updates dashboard configuration
REM   6. Verifies everything works
REM
REM Usage: Double-click this file or run from command prompt
REM
REM ============================================================================

echo.
echo ================================================================================
echo                         FINAL COMPLETE FIX SCRIPT
echo ================================================================================
echo.
echo This will diagnose and fix ALL known issues in your Building Vitals system.
echo.
echo Prerequisites:
echo   - .env file with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ACE_API_KEY
echo   - Node.js 18+ installed
echo   - Supabase CLI installed (for deployment steps)
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo [1/1] Running comprehensive fix script...
echo.

cd /d "%~dp0.."
node scripts\FINAL_COMPLETE_FIX.cjs

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ================================================================================
    echo ERROR: Script execution failed!
    echo ================================================================================
    echo.
    echo Check the error messages above for details.
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================================================
echo                              SUCCESS!
echo ================================================================================
echo.
echo The fix script has completed. Review the output above for any warnings.
echo.
echo NEXT STEPS:
echo   1. Deploy Edge Functions: supabase functions deploy
echo   2. Verify pg_cron jobs are running
echo   3. Check dashboard at http://localhost:3000
echo.
pause
