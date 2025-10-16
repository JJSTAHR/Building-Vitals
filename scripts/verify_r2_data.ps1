# PowerShell Script to Verify R2 Data Population
# This script checks if data is being written to R2 storage

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "R2 Storage Data Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$SiteName = "ses_falls_city"

# Function to run wrangler commands
function Run-WranglerCommand {
    param(
        [string]$Command,
        [string]$Description
    )

    Write-Host $Description -ForegroundColor Yellow
    Write-Host "Running: wrangler $Command" -ForegroundColor Gray
    Write-Host ""

    $result = Invoke-Expression "wrangler $Command 2>&1"
    return $result
}

# Step 1: Check R2 bucket for site data
Write-Host "Step 1: Checking R2 bucket for site data..." -ForegroundColor Green
$r2Files = Run-WranglerCommand `
    -Command "r2 object list ace-timeseries --prefix=timeseries/$SiteName/" `
    -Description "Listing files in R2 for site: $SiteName"

if ($r2Files) {
    $fileCount = ($r2Files | Measure-Object).Count
    Write-Host "Found $fileCount files in R2" -ForegroundColor Green

    # Show first few files
    Write-Host "Sample files:" -ForegroundColor White
    $r2Files | Select-Object -First 10 | ForEach-Object {
        Write-Host "  $_"
    }
} else {
    Write-Host "No files found in R2 for site $SiteName" -ForegroundColor Red
    Write-Host "This indicates the backfill has not successfully written any data yet." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

# Step 2: Check a specific date file
Write-Host ""
Write-Host "Step 2: Checking specific date file..." -ForegroundColor Green
$testDate = "2024/10/15"
$testFile = "timeseries/$SiteName/$testDate.ndjson.gz"

Write-Host "Checking for file: $testFile" -ForegroundColor Gray
$fileExists = Run-WranglerCommand `
    -Command "r2 object get ace-timeseries $testFile --file test-download.ndjson.gz" `
    -Description "Attempting to download test file"

if (Test-Path "test-download.ndjson.gz") {
    $fileSize = (Get-Item "test-download.ndjson.gz").Length
    Write-Host "File exists! Size: $fileSize bytes" -ForegroundColor Green

    # Clean up
    Remove-Item "test-download.ndjson.gz" -Force
} else {
    Write-Host "File does not exist" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

# Step 3: Check D1 database for recent data
Write-Host ""
Write-Host "Step 3: Checking D1 database for recent data..." -ForegroundColor Green
Write-Host "Run this SQL query in your D1 console:" -ForegroundColor Yellow
Write-Host ""
Write-Host @"
SELECT
    MIN(timestamp) as earliest_timestamp,
    MAX(timestamp) as latest_timestamp,
    COUNT(*) as total_records,
    COUNT(DISTINCT DATE(timestamp)) as unique_days
FROM timeseries
WHERE site_name = '$SiteName';
"@ -ForegroundColor Cyan

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

# Step 4: Test direct API query
Write-Host ""
Write-Host "Step 4: Testing direct API query..." -ForegroundColor Green
$queryUrl = "https://building-vitals-query.jstahr.workers.dev/api/sites/$SiteName/timeseries/paginated"
$startTime = "2024-01-01T00:00:00Z"
$endTime = "2024-12-31T23:59:59Z"

Write-Host "Testing query for date range: $startTime to $endTime" -ForegroundColor Gray
Write-Host "URL: $queryUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "Run this curl command to test:" -ForegroundColor Yellow
Write-Host ""
Write-Host "curl `"$queryUrl?start_time=$startTime&end_time=$endTime`" -H `"X-ACE-Token: YOUR_TOKEN`"" -ForegroundColor Cyan

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "1. Check if R2 has data files for your site" -ForegroundColor White
Write-Host "2. Verify specific date files exist" -ForegroundColor White
Write-Host "3. Query D1 to see data range" -ForegroundColor White
Write-Host "4. Test direct API queries" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")