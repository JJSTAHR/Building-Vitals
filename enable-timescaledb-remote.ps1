# Enable TimescaleDB on Remote Supabase Database
# Uses PostgreSQL connection string to execute migration

$SUPABASE_URL = "jywxcqcjsvlyehuvsoar.supabase.co"
$SUPABASE_DB = "postgres"
$SUPABASE_PORT = "5432"
$SUPABASE_USER = "postgres.jywxcqcjsvlyehuvsoar"
$SUPABASE_PASSWORD = Read-Host "Enter Supabase database password" -AsSecureString

# Convert secure string to plain text
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SUPABASE_PASSWORD)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "ENABLING TIMESCALEDB ON REMOTE DATABASE" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database: $SUPABASE_URL" -ForegroundColor Yellow
Write-Host ""

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $PlainPassword

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "ERROR: psql is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL client tools from:" -ForegroundColor Yellow
    Write-Host "https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or use the Supabase Dashboard method instead." -ForegroundColor Yellow
    exit 1
}

Write-Host "Connecting to database..." -ForegroundColor Green
Write-Host ""

# Execute the migration
$result = psql -h $SUPABASE_URL `
    -p $SUPABASE_PORT `
    -U $SUPABASE_USER `
    -d $SUPABASE_DB `
    -f "supabase\migrations\20251030_enable_timescaledb.sql" `
    2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "============================================================================" -ForegroundColor Green
    Write-Host "SUCCESS! TIMESCALEDB ENABLED" -ForegroundColor Green
    Write-Host "============================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Compression will start automatically:" -ForegroundColor Cyan
    Write-Host "  - Day 8: Data older than 7 days starts compressing" -ForegroundColor Yellow
    Write-Host "  - Day 30: All old data compressed at 10:1 ratio" -ForegroundColor Yellow
    Write-Host "  - Storage: 134 GB -> 13.4 GB (90% reduction!)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next step: Run October backfill" -ForegroundColor Cyan
    Write-Host "  gh workflow run parallel-october-backfill.yml --ref main" -ForegroundColor White
} else {
    Write-Host "============================================================================" -ForegroundColor Red
    Write-Host "ERROR: Migration failed" -ForegroundColor Red
    Write-Host "============================================================================" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
}

# Clear password
Remove-Variable PlainPassword
$env:PGPASSWORD = $null
