# PowerShell Monitoring Script for Backfill Progress
# Run this script to continuously monitor backfill progress

$WorkerURL = "https://building-vitals-backfill.jstahr.workers.dev"
$RefreshInterval = 10 # seconds

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Vitals - Backfill Monitor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

while ($true) {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Building Vitals - Backfill Monitor" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
    Write-Host ""

    try {
        # Get status from worker
        $response = Invoke-RestMethod -Uri "$WorkerURL/status" -Method Get

        Write-Host "Status: " -NoNewline
        if ($response.status -eq "complete") {
            Write-Host $response.status -ForegroundColor Green
        } elseif ($response.status -eq "in_progress") {
            Write-Host $response.status -ForegroundColor Yellow
        } else {
            Write-Host $response.status -ForegroundColor Red
        }

        Write-Host ""
        Write-Host "Progress Information:" -ForegroundColor White
        Write-Host "  Current Date: $($response.progress.current_date)"
        Write-Host "  Completed Dates: $($response.progress.completed_dates.Count) / $($response.progress.total_dates)"
        Write-Host "  Progress: $($response.progress.percent)"
        Write-Host "  Samples Fetched: $($response.progress.samples_fetched)"

        # Progress bar
        $percentValue = [double]($response.progress.percent -replace '%', '')
        $barLength = 50
        $filledLength = [int]($barLength * $percentValue / 100)
        $bar = ('#' * $filledLength).PadRight($barLength, '-')
        Write-Host ""
        Write-Host "  [$bar] $($response.progress.percent)" -ForegroundColor Cyan

        if ($response.errors -and $response.errors.Count -gt 0) {
            Write-Host ""
            Write-Host "Recent Errors:" -ForegroundColor Red
            $response.errors | Select-Object -Last 5 | ForEach-Object {
                Write-Host "  - $($_.timestamp): $($_.error)" -ForegroundColor Red
            }
        }

        Write-Host ""
        Write-Host "Last Updated: $($response.last_updated)"

        if ($response.status -eq "complete") {
            Write-Host ""
            Write-Host "Backfill Complete!" -ForegroundColor Green
            Write-Host "Total samples collected: $($response.progress.samples_fetched)" -ForegroundColor Green
            break
        }

    } catch {
        Write-Host "Error fetching status: $_" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "Refreshing in $RefreshInterval seconds... (Press Ctrl+C to stop)" -ForegroundColor Gray
    Start-Sleep -Seconds $RefreshInterval
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")