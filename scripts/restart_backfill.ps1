# Restart Stuck Building Vitals Backfill
# This script restarts a stuck backfill process and monitors progress

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESTARTING STUCK BACKFILL PROCESS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to trigger backfill
function Start-Backfill {
    param (
        [bool]$Reset = $false,
        [bool]$Continue = $true
    )

    $body = @{
        site = "ses_falls_city"
        reset = $Reset
        continue = $Continue
    } | ConvertTo-Json

    try {
        Write-Host "Triggering backfill..." -ForegroundColor Yellow
        $response = Invoke-RestMethod -Uri "https://building-vitals-backfill.jstahr.workers.dev/trigger" `
            -Method Post -Body $body -ContentType "application/json"

        Write-Host "✅ Backfill triggered successfully!" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "❌ Error triggering backfill: $_" -ForegroundColor Red
        return $null
    }
}

# Function to check status
function Get-BackfillStatus {
    try {
        $status = Invoke-RestMethod -Uri "https://building-vitals-backfill.jstahr.workers.dev/status" -Method Get
        return $status
    } catch {
        Write-Host "Error getting status: $_" -ForegroundColor Red
        return $null
    }
}

# Check current status first
Write-Host "Checking current backfill status..." -ForegroundColor Cyan
$currentStatus = Get-BackfillStatus

if ($currentStatus) {
    Write-Host ""
    Write-Host "Current Status: $($currentStatus.status)" -ForegroundColor $(if ($currentStatus.status -eq "in_progress") { "Yellow" } else { "Red" })
    Write-Host "Current Date: $($currentStatus.progress.current_date)" -ForegroundColor White

    # Calculate time stuck
    if ($currentStatus.last_updated) {
        $lastUpdate = [DateTime]::Parse($currentStatus.last_updated)
        $timeSince = (Get-Date) - $lastUpdate

        if ($timeSince.TotalMinutes -gt 10) {
            Write-Host ""
            Write-Host "⚠️ BACKFILL APPEARS STUCK!" -ForegroundColor Red
            Write-Host "Last updated: $([math]::Round($timeSince.TotalMinutes, 1)) minutes ago" -ForegroundColor Yellow

            # Ask to restart
            Write-Host ""
            $restart = Read-Host "Do you want to restart the backfill? (Y/N)"

            if ($restart -eq 'Y' -or $restart -eq 'y') {
                Write-Host ""
                Write-Host "Restarting backfill process..." -ForegroundColor Cyan

                # Try to continue from where it left off
                $result = Start-Backfill -Reset $false -Continue $true

                if ($result) {
                    Write-Host ""
                    Write-Host "Monitoring new progress..." -ForegroundColor Green

                    # Monitor for 30 seconds to ensure it's running
                    $monitorEnd = (Get-Date).AddSeconds(30)
                    $previousDate = $currentStatus.progress.current_date

                    while ((Get-Date) -lt $monitorEnd) {
                        Start-Sleep -Seconds 5
                        $newStatus = Get-BackfillStatus

                        if ($newStatus) {
                            if ($newStatus.progress.current_date -ne $previousDate) {
                                Write-Host "✅ Progress detected! Now processing: $($newStatus.progress.current_date)" -ForegroundColor Green
                                $previousDate = $newStatus.progress.current_date
                            } else {
                                Write-Host "." -NoNewline
                            }
                        }
                    }

                    Write-Host ""
                    Write-Host ""
                    Write-Host "========================================" -ForegroundColor Green
                    Write-Host "✅ Backfill restarted successfully!" -ForegroundColor Green
                    Write-Host "========================================" -ForegroundColor Green

                    # Final status
                    $finalStatus = Get-BackfillStatus
                    if ($finalStatus) {
                        $completedCount = $finalStatus.progress.completed_dates.Count
                        $totalDates = $finalStatus.progress.total_dates
                        $actualPercent = [math]::Round(($completedCount / $totalDates) * 100, 2)

                        Write-Host ""
                        Write-Host "Current Progress:" -ForegroundColor Cyan
                        Write-Host "  Status: $($finalStatus.status)" -ForegroundColor White
                        Write-Host "  Current Date: $($finalStatus.progress.current_date)" -ForegroundColor White
                        Write-Host "  Progress: $actualPercent% ($completedCount / $totalDates dates)" -ForegroundColor White
                        Write-Host "  Samples Fetched: $($finalStatus.progress.samples_fetched)" -ForegroundColor White
                    }
                }
            }
        } else {
            Write-Host "✅ Backfill appears to be running (last update: $([math]::Round($timeSince.TotalSeconds, 0)) seconds ago)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "Could not get backfill status. Starting new backfill..." -ForegroundColor Yellow
    Start-Backfill -Reset $false -Continue $true
}

Write-Host ""
Write-Host "To monitor continuously, run: .\monitor_backfill.ps1" -ForegroundColor Cyan