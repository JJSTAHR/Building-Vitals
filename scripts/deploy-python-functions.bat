@echo off
REM Deploy Python Cloud Functions to Firebase
REM Usage: deploy-python-functions.bat

setlocal enabledelayedexpansion

echo ========================================
echo Deploying Python Cloud Functions
echo ========================================
echo.

REM Configuration
set PROJECT_ID=building-vitals-prod
if not "%GCP_PROJECT%"=="" set PROJECT_ID=%GCP_PROJECT%
set REGION=us-central1
set RUNTIME=python311

echo Project: %PROJECT_ID%
echo Region: %REGION%
echo Runtime: %RUNTIME%
echo.

REM Validate GCP project
echo Validating GCP project...
gcloud config set project "%PROJECT_ID%"
for /f "tokens=*" %%i in ('gcloud projects describe "%PROJECT_ID%" --format="value(projectNumber)"') do set PROJECT_NUMBER=%%i
set SERVICE_ACCOUNT=%PROJECT_NUMBER%-compute@developer.gserviceaccount.com
echo [OK] Using project: %PROJECT_ID%
echo.

REM Check if secrets exist
echo Checking secrets...
set REQUIRED_SECRETS=ACE_API_KEY SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY

for %%s in (%REQUIRED_SECRETS%) do (
    gcloud secrets describe %%s --project="%PROJECT_ID%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Secret exists: %%s
    ) else (
        echo [ERROR] Missing secret: %%s
        echo Please create the secret first:
        echo   echo YOUR_VALUE ^| gcloud secrets create %%s --data-file=-
        exit /b 1
    )
)

echo.

REM Grant Secret Manager access
echo Configuring IAM permissions...
for %%s in (%REQUIRED_SECRETS%) do (
    gcloud secrets add-iam-policy-binding %%s --member="serviceAccount:%SERVICE_ACCOUNT%" --role="roles/secretmanager.secretAccessor" --project="%PROJECT_ID%" --quiet >nul 2>&1
    echo [OK] Granted access to: %%s
)

echo.

REM Deploy continuous_sync function
echo Deploying continuous_sync function...
gcloud functions deploy continuous-sync ^
    --gen2 ^
    --runtime=%RUNTIME% ^
    --region=%REGION% ^
    --source=./functions ^
    --entry-point=continuous_sync ^
    --trigger-http ^
    --memory=512MB ^
    --timeout=300s ^
    --max-instances=10 ^
    --min-instances=0 ^
    --set-env-vars=GCP_PROJECT=%PROJECT_ID%,DEFAULT_SITE=building-vitals-hq ^
    --allow-unauthenticated ^
    --project=%PROJECT_ID%

for /f "tokens=*" %%i in ('gcloud functions describe continuous-sync --gen2 --region=%REGION% --project=%PROJECT_ID% --format="value(serviceConfig.uri)"') do set CONTINUOUS_SYNC_URL=%%i

echo [OK] continuous_sync deployed
echo    URL: %CONTINUOUS_SYNC_URL%
echo.

REM Deploy backfill_historical function
echo Deploying backfill_historical function...
gcloud functions deploy backfill-historical ^
    --gen2 ^
    --runtime=%RUNTIME% ^
    --region=%REGION% ^
    --source=./functions ^
    --entry-point=backfill_historical ^
    --trigger-http ^
    --memory=1GB ^
    --timeout=540s ^
    --max-instances=5 ^
    --min-instances=0 ^
    --set-env-vars=GCP_PROJECT=%PROJECT_ID%,DEFAULT_SITE=building-vitals-hq ^
    --allow-unauthenticated ^
    --project=%PROJECT_ID%

for /f "tokens=*" %%i in ('gcloud functions describe backfill-historical --gen2 --region=%REGION% --project=%PROJECT_ID% --format="value(serviceConfig.uri)"') do set BACKFILL_URL=%%i

echo [OK] backfill_historical deployed
echo    URL: %BACKFILL_URL%
echo.

REM Setup or update Cloud Scheduler
echo Configuring Cloud Scheduler...
gcloud scheduler jobs describe continuous-sync-job --location=%REGION% --project=%PROJECT_ID% >nul 2>&1

if !errorlevel! equ 0 (
    echo Updating existing scheduler job...
    gcloud scheduler jobs update http continuous-sync-job ^
        --location=%REGION% ^
        --schedule="*/5 * * * *" ^
        --uri="%CONTINUOUS_SYNC_URL%" ^
        --http-method=POST ^
        --headers="Content-Type=application/json" ^
        --message-body="{}" ^
        --time-zone="UTC" ^
        --attempt-deadline=300s ^
        --project=%PROJECT_ID%
    echo [OK] Scheduler job updated
) else (
    echo Creating new scheduler job...
    gcloud scheduler jobs create http continuous-sync-job ^
        --location=%REGION% ^
        --schedule="*/5 * * * *" ^
        --uri="%CONTINUOUS_SYNC_URL%" ^
        --http-method=POST ^
        --headers="Content-Type=application/json" ^
        --message-body="{}" ^
        --time-zone="UTC" ^
        --attempt-deadline=300s ^
        --project=%PROJECT_ID%
    echo [OK] Scheduler job created
)

echo.

REM Test deployment
echo Testing deployment...
echo Testing continuous_sync...

curl -s -X POST "%CONTINUOUS_SYNC_URL%" -H "Content-Type: application/json" -d "{}" > response.tmp 2>&1
findstr /C:"success" response.tmp >nul
if !errorlevel! equ 0 (
    echo [OK] continuous_sync is responding
) else (
    echo [ERROR] continuous_sync test failed
    type response.tmp
)
del response.tmp >nul 2>&1

echo.

REM Summary
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Functions deployed:
echo   1. continuous-sync
echo      URL: %CONTINUOUS_SYNC_URL%
echo      Schedule: Every 5 minutes
echo.
echo   2. backfill-historical
echo      URL: %BACKFILL_URL%
echo      Trigger: Manual HTTP POST
echo.
echo Cloud Scheduler:
echo   Job: continuous-sync-job
echo   Schedule: */5 * * * * (every 5 minutes)
echo.
echo Next steps:
echo   1. Test manual sync:
echo      curl -X POST %CONTINUOUS_SYNC_URL%
echo.
echo   2. Run backfill (example):
echo      curl -X POST %BACKFILL_URL% -H "Content-Type: application/json" -d "{\"site\":\"building-vitals-hq\",\"start_date\":\"2024-12-01T00:00:00Z\",\"end_date\":\"2024-12-01T23:59:59Z\"}"
echo.
echo   3. View logs:
echo      gcloud functions logs read continuous-sync --gen2 --region=%REGION% --limit=50
echo.
echo   4. Monitor in console:
echo      https://console.cloud.google.com/functions?project=%PROJECT_ID%
echo.

endlocal
