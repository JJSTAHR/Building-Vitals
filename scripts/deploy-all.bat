@echo off
REM =============================================================================
REM Complete Deployment Script
REM One-click deployment of all Building Vitals components
REM =============================================================================

setlocal enabledelayedexpansion

echo ========================================
echo Building Vitals - Complete Deployment
echo ========================================
echo.
echo This script will deploy:
echo 1. Configure environment (.env)
echo 2. Deploy Supabase database and Edge Functions
echo 3. Deploy Cloudflare Worker
echo 4. Verify deployment
echo.
echo Estimated time: 5-10 minutes
echo.
set /p CONFIRM="Continue with full deployment? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo Deployment cancelled.
    pause
    exit /b 0
)

REM Track deployment steps
set STEP=0
set TOTAL_STEPS=5

REM ============================================================================
REM Step 1: Environment Setup
REM ============================================================================
set /a STEP+=1
echo.
echo ========================================
echo Step %STEP%/%TOTAL_STEPS%: Environment Configuration
echo ========================================
echo.

if exist ".env" (
    echo [INFO] .env file already exists
    set /p RECONFIG="Reconfigure environment? (y/N): "
    if /i "!RECONFIG!"=="y" (
        call scripts\setup-environment.bat
        if errorlevel 1 (
            echo [ERROR] Environment setup failed
            pause
            exit /b 1
        )
    ) else (
        echo [INFO] Using existing .env configuration
    )
) else (
    echo [INFO] Creating .env configuration...
    call scripts\setup-environment.bat
    if errorlevel 1 (
        echo [ERROR] Environment setup failed
        pause
        exit /b 1
    )
)

echo [OK] Environment configured

REM ============================================================================
REM Step 2: Install Dependencies
REM ============================================================================
set /a STEP+=1
echo.
echo ========================================
echo Step %STEP%/%TOTAL_STEPS%: Installing Dependencies
echo ========================================
echo.

if exist "package.json" (
    echo Installing Node.js dependencies...
    npm install
    if errorlevel 1 (
        echo [WARNING] Some dependencies failed to install
        echo Continuing with deployment...
    ) else (
        echo [OK] Dependencies installed
    )
) else (
    echo [WARNING] package.json not found, skipping npm install
)

REM ============================================================================
REM Step 3: Deploy Supabase
REM ============================================================================
set /a STEP+=1
echo.
echo ========================================
echo Step %STEP%/%TOTAL_STEPS%: Deploying Supabase
echo ========================================
echo.

set /p DEPLOY_SUPABASE="Deploy Supabase database and Edge Functions? (Y/N): "
if /i "%DEPLOY_SUPABASE%"=="Y" (
    call scripts\deploy-supabase.bat
    if errorlevel 1 (
        echo [ERROR] Supabase deployment failed
        echo.
        echo You can retry later with: scripts\deploy-supabase.bat
        echo.
        set /p CONTINUE="Continue with remaining steps? (Y/N): "
        if /i not "!CONTINUE!"=="Y" (
            pause
            exit /b 1
        )
    ) else (
        echo [OK] Supabase deployed successfully
    )
) else (
    echo [INFO] Skipping Supabase deployment
)

REM ============================================================================
REM Step 4: Deploy Cloudflare Worker
REM ============================================================================
set /a STEP+=1
echo.
echo ========================================
echo Step %STEP%/%TOTAL_STEPS%: Deploying Cloudflare Worker
echo ========================================
echo.

set /p DEPLOY_WORKER="Deploy Cloudflare Worker? (Y/N): "
if /i "%DEPLOY_WORKER%"=="Y" (
    call scripts\deploy-cloudflare.bat
    if errorlevel 1 (
        echo [ERROR] Cloudflare Worker deployment failed
        echo.
        echo You can retry later with: scripts\deploy-cloudflare.bat
        echo.
        set /p CONTINUE="Continue with verification? (Y/N): "
        if /i not "!CONTINUE!"=="Y" (
            pause
            exit /b 1
        )
    ) else (
        echo [OK] Cloudflare Worker deployed successfully
    )
) else (
    echo [INFO] Skipping Cloudflare Worker deployment
)

REM ============================================================================
REM Step 5: Verify Deployment
REM ============================================================================
set /a STEP+=1
echo.
echo ========================================
echo Step %STEP%/%TOTAL_STEPS%: Verifying Deployment
echo ========================================
echo.

call scripts\verify-deployment.bat
set VERIFY_EXIT=%errorlevel%

REM ============================================================================
REM Deployment Complete
REM ============================================================================
echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.

if %VERIFY_EXIT% EQU 0 (
    echo [SUCCESS] All systems operational!
    echo.
    echo Your Building Vitals system is ready to use.
    echo.
    echo Next steps:
    echo.
    echo 1. Start development server:
    echo    npm run dev
    echo.
    echo 2. Access the application:
    echo    http://localhost:3000
    echo.
    echo 3. Build for production:
    echo    npm run build
    echo.
    echo 4. Review deployment guide:
    echo    docs\DEPLOYMENT_GUIDE.md
    echo.
) else (
    echo [WARNING] Deployment completed with warnings
    echo.
    echo Review the verification results above.
    echo Some components may need manual intervention.
    echo.
    echo For troubleshooting, see: docs\DEPLOYMENT_GUIDE.md
    echo.
)

echo ========================================
echo Deployment Summary
echo ========================================
echo.
echo Environment:  Configured
if /i "%DEPLOY_SUPABASE%"=="Y" (
    echo Supabase:     Deployed
) else (
    echo Supabase:     Skipped
)
if /i "%DEPLOY_WORKER%"=="Y" (
    echo Worker:       Deployed
) else (
    echo Worker:       Skipped
)
echo Verification: Complete
echo.

pause
