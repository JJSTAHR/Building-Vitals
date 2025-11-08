@echo off
REM ============================================
REM Set up Permanent Data Sync as Windows Scheduled Task
REM Uses native schtasks command (no PowerShell)
REM ============================================

echo.
echo ========================================
echo   Setting up Permanent Auto-Sync
echo   Task Name: BuildingVitals-DataSync
echo ========================================
echo.

REM Get current directory and script path
set SCRIPT_DIR=%~dp0
set SCRIPT_PATH=%SCRIPT_DIR%continuous-data-sync.cjs
set NODE_PATH=node.exe

REM Check if task already exists and remove it
echo Checking for existing task...
schtasks /Query /TN "BuildingVitals-DataSync" >nul 2>&1
if %errorlevel% equ 0 (
    echo Task already exists. Removing old task...
    schtasks /Delete /TN "BuildingVitals-DataSync" /F
)

echo.
echo Creating scheduled task...
echo.

REM Create XML file for the task
set XML_FILE=%TEMP%\BuildingVitals-Sync-Task.xml

echo ^<?xml version="1.0" encoding="UTF-16"?^> > "%XML_FILE%"
echo ^<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"^> >> "%XML_FILE%"
echo   ^<RegistrationInfo^> >> "%XML_FILE%"
echo     ^<Description^>Continuously syncs Building Vitals data from ACE IoT to Supabase every 60 seconds^</Description^> >> "%XML_FILE%"
echo   ^</RegistrationInfo^> >> "%XML_FILE%"
echo   ^<Triggers^> >> "%XML_FILE%"
echo     ^<BootTrigger^> >> "%XML_FILE%"
echo       ^<Enabled^>true^</Enabled^> >> "%XML_FILE%"
echo       ^<Delay^>PT1M^</Delay^> >> "%XML_FILE%"
echo     ^</BootTrigger^> >> "%XML_FILE%"
echo     ^<LogonTrigger^> >> "%XML_FILE%"
echo       ^<Enabled^>true^</Enabled^> >> "%XML_FILE%"
echo     ^</LogonTrigger^> >> "%XML_FILE%"
echo   ^</Triggers^> >> "%XML_FILE%"
echo   ^<Settings^> >> "%XML_FILE%"
echo     ^<MultipleInstancesPolicy^>IgnoreNew^</MultipleInstancesPolicy^> >> "%XML_FILE%"
echo     ^<DisallowStartIfOnBatteries^>false^</DisallowStartIfOnBatteries^> >> "%XML_FILE%"
echo     ^<StopIfGoingOnBatteries^>false^</StopIfGoingOnBatteries^> >> "%XML_FILE%"
echo     ^<AllowHardTerminate^>true^</AllowHardTerminate^> >> "%XML_FILE%"
echo     ^<StartWhenAvailable^>true^</StartWhenAvailable^> >> "%XML_FILE%"
echo     ^<RunOnlyIfNetworkAvailable^>false^</RunOnlyIfNetworkAvailable^> >> "%XML_FILE%"
echo     ^<AllowStartOnDemand^>true^</AllowStartOnDemand^> >> "%XML_FILE%"
echo     ^<Enabled^>true^</Enabled^> >> "%XML_FILE%"
echo     ^<Hidden^>false^</Hidden^> >> "%XML_FILE%"
echo     ^<RunOnlyIfIdle^>false^</RunOnlyIfIdle^> >> "%XML_FILE%"
echo     ^<WakeToRun^>false^</WakeToRun^> >> "%XML_FILE%"
echo     ^<ExecutionTimeLimit^>P3D^</ExecutionTimeLimit^> >> "%XML_FILE%"
echo     ^<Priority^>7^</Priority^> >> "%XML_FILE%"
echo     ^<RestartOnFailure^> >> "%XML_FILE%"
echo       ^<Interval^>PT5M^</Interval^> >> "%XML_FILE%"
echo       ^<Count^>3^</Count^> >> "%XML_FILE%"
echo     ^</RestartOnFailure^> >> "%XML_FILE%"
echo   ^</Settings^> >> "%XML_FILE%"
echo   ^<Actions Context="Author"^> >> "%XML_FILE%"
echo     ^<Exec^> >> "%XML_FILE%"
echo       ^<Command^>%NODE_PATH%^</Command^> >> "%XML_FILE%"
echo       ^<Arguments^>"%SCRIPT_PATH%"^</Arguments^> >> "%XML_FILE%"
echo       ^<WorkingDirectory^>%SCRIPT_DIR%^</WorkingDirectory^> >> "%XML_FILE%"
echo     ^</Exec^> >> "%XML_FILE%"
echo   ^</Actions^> >> "%XML_FILE%"
echo ^</Task^> >> "%XML_FILE%"

REM Create the task from XML
schtasks /Create /XML "%XML_FILE%" /TN "BuildingVitals-DataSync"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   SUCCESS! Task created successfully!
    echo ========================================
    echo.
    echo Task Details:
    echo   Name: BuildingVitals-DataSync
    echo   Script: %SCRIPT_PATH%
    echo   Triggers: System Boot, User Logon
    echo.

    REM Query the task to show details
    schtasks /Query /TN "BuildingVitals-DataSync" /V /FO LIST

    echo.
    echo ========================================
    echo.

    set /p start_now="Start the sync service now? (Y/N): "
    if /i "%start_now%"=="Y" (
        echo.
        echo Starting task...
        schtasks /Run /TN "BuildingVitals-DataSync"
        echo.
        echo Task started! The sync service is now running.
        echo It will automatically start on system boot and user login.
    )
) else (
    echo.
    echo ========================================
    echo   ERROR: Failed to create task
    echo ========================================
    echo.
    echo Please try running as Administrator
)

REM Clean up XML file
del "%XML_FILE%" >nul 2>&1

echo.
echo ========================================
echo   Useful Commands:
echo ========================================
echo.
echo   View task status:
echo     schtasks /Query /TN "BuildingVitals-DataSync" /V /FO LIST
echo.
echo   Start task manually:
echo     schtasks /Run /TN "BuildingVitals-DataSync"
echo.
echo   Stop task:
echo     schtasks /End /TN "BuildingVitals-DataSync"
echo.
echo   Delete task:
echo     schtasks /Delete /TN "BuildingVitals-DataSync" /F
echo.
echo   View in Task Scheduler GUI:
echo     taskschd.msc
echo.

pause