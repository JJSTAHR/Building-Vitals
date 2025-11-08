@echo off
REM ============================================================================
REM Setup pg_cron Schedule for Continuous Sync
REM ============================================================================
REM This script sets up the automatic 5-minute schedule for continuous-sync

echo.
echo ================================================================================
echo SETTING UP PG_CRON SCHEDULE
echo ================================================================================
echo.
echo This will:
echo   1. Enable pg_cron extension
echo   2. Schedule continuous-sync to run every 5 minutes
echo   3. Configure database settings
echo.
pause

REM SQL statements to execute
set SQL_FILE="%TEMP%\pgcron_setup.sql"

echo Creating SQL script...
(
echo -- Enable pg_cron extension
echo CREATE EXTENSION IF NOT EXISTS pg_cron;
echo.
echo -- Grant usage to postgres user
echo GRANT USAGE ON SCHEMA cron TO postgres;
echo.
echo -- Remove any existing schedule
echo DO $$ BEGIN PERFORM cron.unschedule^('continuous-sync-ace-data'^); EXCEPTION WHEN OTHERS THEN NULL; END $$;
echo.
echo -- Schedule continuous-sync every 5 minutes
echo SELECT cron.schedule^(
echo   'continuous-sync-ace-data',
echo   '*/5 * * * *',
echo   $$SELECT net.http_post^(url := current_setting^('app.settings.supabase_url'^) ^|^| '/functions/v1/continuous-sync', headers := jsonb_build_object^('Authorization', 'Bearer ' ^|^| current_setting^('app.settings.supabase_service_role_key'^), 'Content-Type', 'application/json'^), body := '{}'::jsonb, timeout_milliseconds := 120000^);$$
echo ^);
echo.
echo -- Store Supabase URL
echo ALTER DATABASE postgres SET app.settings.supabase_url TO 'https://jywxcqcjsvlyehuvsoar.supabase.co';
echo.
echo -- Store service role key
echo ALTER DATABASE postgres SET app.settings.supabase_service_role_key TO 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M';
) > %SQL_FILE%

echo.
echo SQL script created. Executing via Supabase CLI...
echo.

REM Execute the SQL file
npx supabase db execute --file "%SQL_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo SUCCESS - pg_cron schedule configured
    echo ================================================================================
    echo.
    echo Verifying schedule...
    echo.

    REM Verify the schedule was created
    echo SELECT * FROM cron.job WHERE jobname = 'continuous-sync-ace-data'; | npx supabase db execute

) else (
    echo.
    echo ================================================================================
    echo ERROR - Failed to configure pg_cron
    echo ================================================================================
    echo.
)

REM Cleanup
del %SQL_FILE% 2>nul

echo.
pause
