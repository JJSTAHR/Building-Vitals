@echo off
REM ============================================================================
REM Batch wrapper to execute October-November database fix
REM ============================================================================

echo ============================================================================
echo DATABASE FIX SCRIPT - October-November 2025 Data Access
echo ============================================================================
echo.

REM Check if PowerShell is available
where pwsh >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using PowerShell Core...
    pwsh -ExecutionPolicy Bypass -File "%~dp0run-oct-nov-fix.ps1"
) else (
    where powershell >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Using Windows PowerShell...
        powershell -ExecutionPolicy Bypass -File "%~dp0run-oct-nov-fix.ps1"
    ) else (
        echo ERROR: PowerShell not found!
        exit /b 1
    )
)

echo.
echo ============================================================================
echo Script execution completed
echo ============================================================================
pause
