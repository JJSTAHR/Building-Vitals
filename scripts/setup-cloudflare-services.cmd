@echo off
REM Setup Script for Cloudflare R2, Queue, and D1 Services (Windows)
REM This script automates the setup of all required Cloudflare services

echo.
echo 🚀 Setting up Cloudflare services for Building Vitals...
echo.

REM Check if wrangler is installed
where wrangler >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Wrangler CLI not found. Please install it first:
    echo    npm install -g wrangler
    exit /b 1
)

REM Check if logged in
echo Checking Cloudflare authentication...
wrangler whoami >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Not logged in to Cloudflare. Running login...
    wrangler login
)

echo ✅ Authenticated
echo.

REM Navigate to worker directory
cd /d "%~dp0..\Building-Vitals\workers"

REM 1. Create R2 Buckets
echo 📦 Creating R2 buckets...
echo.

REM Production bucket
wrangler r2 bucket list | find "building-vitals-timeseries" >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Production bucket already exists: building-vitals-timeseries
) else (
    echo Creating production bucket: building-vitals-timeseries
    wrangler r2 bucket create building-vitals-timeseries
    echo ✅ Production bucket created
)

REM Preview bucket
wrangler r2 bucket list | find "building-vitals-timeseries-preview" >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Preview bucket already exists: building-vitals-timeseries-preview
) else (
    echo Creating preview bucket: building-vitals-timeseries-preview
    wrangler r2 bucket create building-vitals-timeseries-preview
    echo ✅ Preview bucket created
)

echo.

REM 2. Create D1 Database
echo 🗄️ Creating D1 database...
echo.

wrangler d1 list | find "building-vitals-db" >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Database already exists: building-vitals-db
) else (
    echo Creating database: building-vitals-db
    wrangler d1 create building-vitals-db
    echo.
    echo ⚠️  Please note the database_id from above and update wrangler.toml
    echo.
    pause
)

echo.

REM 3. Initialize database schema
echo 📋 Initializing database schema...
echo.

if exist "..\services\schema.sql" (
    wrangler d1 execute building-vitals-db --file=..\services\schema.sql
    echo ✅ Schema initialized
) else (
    echo ❌ Schema file not found: ..\services\schema.sql
    echo Please run this script from the scripts directory
    exit /b 1
)

echo.

REM 4. Queue info
echo 📬 Queue setup...
echo.
echo ✅ Queues will be automatically created on first deploy:
echo    - chart-processing-queue (main queue^)
echo    - chart-processing-dlq (dead letter queue^)

echo.

REM 5. Analytics info
echo 📊 Analytics Engine...
echo.
echo ✅ Analytics Engine binding configured in wrangler.toml

echo.

REM 6. Deploy worker
echo 🚀 Ready to deploy worker...
echo.

set /p deploy="Deploy worker now? (y/n): "
if /i "%deploy%"=="y" (
    wrangler deploy
    echo ✅ Worker deployed successfully
) else (
    echo ⏭️  Skipping deployment. You can deploy later with: wrangler deploy
)

echo.

REM 7. Summary
echo ✨ Setup complete!
echo.
echo 📝 Summary:
echo    ✅ R2 Buckets: building-vitals-timeseries, building-vitals-timeseries-preview
echo    ✅ D1 Database: building-vitals-db
echo    ✅ Schema: Initialized with tables and views
echo    ✅ Queues: Will be created on first deploy
echo    ✅ Analytics: Configured
echo.
echo 🎯 Next steps:
echo    1. Test the worker: wrangler dev
echo    2. View logs: wrangler tail
echo    3. Query database: wrangler d1 execute building-vitals-db --command="SELECT * FROM queue_jobs"
echo    4. List R2 objects: wrangler r2 object list building-vitals-timeseries
echo.
echo 📚 Documentation: docs\R2_QUEUE_INTEGRATION.md
echo.

pause
