# PowerShell Script to Fix Building Vitals Data Issue
# Run this script to populate D1 and R2 with historical data

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Vitals - Data Population Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Deploy the ACE API Key to Backfill Worker
Write-Host "Step 1: Deploying ACE API Key to Backfill Worker..." -ForegroundColor Yellow
Write-Host "Note: Use the SAME token that's working in your browser" -ForegroundColor Green
Write-Host ""

cd "C:\Users\jstahr\Desktop\Building Vitals"
wrangler secret put ACE_API_KEY --env production

Write-Host ""
Write-Host "When prompted, paste this token (from your browser):" -ForegroundColor Yellow
Write-Host "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc1NzYxMTE4NiwianRpIjoiNjY1ZDM2NjMtZjFhZC00YWYxLTliZmEtNGMwMzRmMTllYjA4IiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5Ijoic2VzXzAwMDFfZmFsbHNfY2l0eSIsIm5iZiI6MTc1NzYxMTE4NiwiZXhwIjoxNzg5MTQ3MTg2fQ.5g9JVBO_18x42srsJ4ZUNIqMbK6XeQDyrqqS-WEFc0g" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter after pasting the token..."

# Step 2: Deploy the Backfill Worker
Write-Host ""
Write-Host "Step 2: Deploying Backfill Worker with fixes..." -ForegroundColor Yellow
wrangler deploy --env production

Start-Sleep -Seconds 2

# Step 3: Clear any failed state
Write-Host ""
Write-Host "Step 3: Clearing failed backfill state..." -ForegroundColor Yellow
wrangler kv:key delete --binding=BACKFILL_STATE "backfill_state" --env production 2>$null

# Step 4: Start the Backfill
Write-Host ""
Write-Host "Step 4: Starting Historical Data Backfill..." -ForegroundColor Yellow
Write-Host "This will populate D1 and R2 with data from January 2024 to October 2025" -ForegroundColor Green
Write-Host ""

$backfillUrl = "https://building-vitals-backfill.jstahr.workers.dev/trigger"
$body = @{
    site = "ses_falls_city"
    start_date = "2024-01-01"
    end_date = "2025-10-16"
    reset = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $backfillUrl -Method Post -Body $body -ContentType "application/json"
    Write-Host "Backfill Started Successfully!" -ForegroundColor Green
    Write-Host $response | ConvertTo-Json
} catch {
    Write-Host "Error starting backfill: $_" -ForegroundColor Red
}

# Step 5: Check Status
Write-Host ""
Write-Host "Step 5: Checking Backfill Status..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $status = Invoke-RestMethod -Uri "https://building-vitals-backfill.jstahr.workers.dev/status" -Method Get
    Write-Host ""
    Write-Host "Current Status:" -ForegroundColor White
    Write-Host "  Status: $($status.status)" -ForegroundColor $(if ($status.status -eq "in_progress") { "Yellow" } else { "Green" })
    Write-Host "  Progress: $($status.progress.percent)" -ForegroundColor Cyan
    Write-Host "  Samples Fetched: $($status.progress.samples_fetched)" -ForegroundColor Cyan
    Write-Host "  Current Date: $($status.progress.current_date)" -ForegroundColor White
} catch {
    Write-Host "Error checking status: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MONITORING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To monitor progress, run:" -ForegroundColor Yellow
Write-Host "  .\scripts\monitor_backfill.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or check status manually:" -ForegroundColor Yellow
Write-Host '  Invoke-RestMethod "https://building-vitals-backfill.jstahr.workers.dev/status"' -ForegroundColor Cyan
Write-Host ""
Write-Host "View logs:" -ForegroundColor Yellow
Write-Host "  wrangler tail --env production" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Backfill is running! Data will start appearing in your charts soon." -ForegroundColor Green
Write-Host "Full backfill may take 24-48 hours depending on data volume." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")