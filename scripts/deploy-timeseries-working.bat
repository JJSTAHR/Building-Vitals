@echo off
echo ================================================
echo Deploying timeseries-working Edge Function
echo ================================================
echo.
echo This function bypasses JWT issues and uses service role internally
echo Created: 11/4/2025
echo.

cd /d "C:\Users\jstahr\Desktop\Building Vitals"

echo Deploying to Supabase...
call npx supabase functions deploy timeseries-working --no-verify-jwt

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Deployment failed!
    pause
    exit /b 1
)

echo.
echo ================================================
echo Deployment successful!
echo ================================================
echo.
echo The Edge Function is now available at:
echo https://[YOUR_PROJECT_ID].supabase.co/functions/v1/timeseries-working
echo.
echo To test it, POST a JSON request like:
echo {
echo   "point_names": ["RTU_1_RA_T", "RTU_1_SA_T"],
echo   "start_time": "2025-10-01T00:00:00Z",
echo   "end_time": "2025-11-04T23:59:59Z",
echo   "ace_token": "your_ace_token_here",
echo   "site": "ses_falls_city"
echo }
echo.
pause