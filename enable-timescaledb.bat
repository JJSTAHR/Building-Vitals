@echo off
echo ============================================================================
echo ENABLE TIMESCALEDB COMPRESSION
echo ============================================================================
echo.
echo This will enable TimescaleDB compression on your Supabase database.
echo.
echo Expected Results:
echo   - 10K points: 134 GB -^> 13.4 GB (90%% reduction)
echo   - 20K points: 270 GB -^> 27 GB (90%% reduction)
echo   - Stays on Pro plan ($25/mo) instead of needing Team ($599/mo)
echo.
echo ============================================================================
echo OPTION 1: Use Supabase Dashboard (RECOMMENDED)
echo ============================================================================
echo.
echo 1. Go to: https://supabase.com/dashboard/project/jywxcqcjsvlyehuvsoar/sql/new
echo 2. Copy contents of: supabase\migrations\20251030_enable_timescaledb.sql
echo 3. Paste into SQL Editor
echo 4. Click "Run" button
echo 5. Wait 30-60 seconds for migration to complete
echo.
echo ============================================================================
echo OPTION 2: Use Supabase CLI (if you have Docker)
echo ============================================================================
echo.
echo Run this command:
echo   npx supabase db push
echo.
echo ============================================================================
pause
