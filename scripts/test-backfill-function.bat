@echo off
REM Test the weekly-backfill Edge Function manually
REM Usage: test-backfill-function.bat [days-ago]

echo ============================================================
echo Testing Weekly Backfill Edge Function
echo ============================================================
echo.

if "%1"=="" (
    set DAYS_AGO=1
    echo Testing with default: 1 day ago (yesterday)
) else (
    set DAYS_AGO=%1
    echo Testing with: %1 days ago
)

echo.
echo Invoking Edge Function...
echo.

call supabase functions invoke weekly-backfill --project-ref jywxcqcjsvlyehuvsoar --body "{\"daysAgo\": %DAYS_AGO%}"

echo.
echo ============================================================
echo Test complete!
echo ============================================================
pause
