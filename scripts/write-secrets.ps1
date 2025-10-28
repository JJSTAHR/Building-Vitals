param(
  [string]$AceToken = "",
  [string]$SupabaseUrl = "",
  [string]$SupabaseServiceRoleKey = "",
  [string]$SupabaseCliToken = ""
)

$dest = Join-Path $PSScriptRoot "..\secrets\.env.secrets.local"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null

$lines = @()
if ($AceToken) { $lines += "ACE_API_KEY=$AceToken" }
if ($SupabaseUrl) { $lines += "SUPABASE_URL=$SupabaseUrl" }
if ($SupabaseServiceRoleKey) { $lines += "SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceRoleKey" }
if ($SupabaseCliToken) { $lines += "SUPABASE_CLI_TOKEN=$SupabaseCliToken" }

if ($lines.Count -eq 0) {
  Write-Host "No values provided. Specify at least one parameter." -ForegroundColor Yellow
  exit 1
}

$content = ($lines -join "`r`n") + "`r`n"
Set-Content -Path $dest -Value $content -NoNewline
Write-Host "Wrote secrets to $dest" -ForegroundColor Green

