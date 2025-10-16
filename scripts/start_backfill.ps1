# Start Building Vitals Historical Data Backfill

$body = @{
    site = "ses_falls_city"
    start_date = "2024-01-01"
    end_date = "2025-10-16"
    reset = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://building-vitals-backfill.jstahr.workers.dev/trigger" -Method Post -Body $body -ContentType "application/json"
    Write-Host "Backfill Started Successfully!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json)
} catch {
    Write-Host "Error starting backfill: $_" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusDescription -ForegroundColor Red
}