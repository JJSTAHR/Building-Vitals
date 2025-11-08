@echo off
REM Remove TimescaleDB migration files

echo Removing TimescaleDB migration files...
echo.

if exist "supabase\migrations\20251101000000_enable_timescaledb.sql" (
    del "supabase\migrations\20251101000000_enable_timescaledb.sql"
    echo Removed: 20251101000000_enable_timescaledb.sql
)

if exist "supabase\migrations\20251101000001_convert_to_hypertable.sql" (
    del "supabase\migrations\20251101000001_convert_to_hypertable.sql"
    echo Removed: 20251101000001_convert_to_hypertable.sql
)

if exist "docs\TIMESCALEDB_MIGRATION_GUIDE.md" (
    del "docs\TIMESCALEDB_MIGRATION_GUIDE.md"
    echo Removed: TIMESCALEDB_MIGRATION_GUIDE.md
)

if exist "scripts\migrate_to_timescaledb.sql" (
    del "scripts\migrate_to_timescaledb.sql"
    echo Removed: migrate_to_timescaledb.sql
)

if exist "COMPLETE_TIMESCALEDB_MIGRATION.sql" (
    del "COMPLETE_TIMESCALEDB_MIGRATION.sql"
    echo Removed: COMPLETE_TIMESCALEDB_MIGRATION.sql
)

echo.
echo Done! TimescaleDB migration files removed.
echo Now run: scripts\cleanup-timescaledb.sql in Supabase SQL Editor
pause
