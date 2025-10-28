param(
  [string]$EnvFile = "secrets/.env.secrets.local"
)

if (-not (Test-Path $EnvFile)) {
  Write-Host "Secrets file not found: $EnvFile" -ForegroundColor Yellow
  Write-Host "Create it with lines like:" -ForegroundColor Yellow
  Write-Host "  ACE_API_KEY=..." -ForegroundColor Yellow
  Write-Host "  SUPABASE_URL=..." -ForegroundColor Yellow
  Write-Host "  SUPABASE_SERVICE_ROLE_KEY=..." -ForegroundColor Yellow
  exit 1
}

# Load key=value pairs
Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^(?<k>[A-Za-z_][A-Za-z0-9_]*)=(?<v>.*)$') {
    $name = $Matches['k']
    $val = $Matches['v']
    Set-Item -Path Env:$name -Value $val | Out-Null
  }
}

function Set-Secret($key, $val, $toml) {
  if (-not $val) { Write-Host "Skipping $key (empty)" -ForegroundColor DarkYellow; return }
  Write-Host "Setting $key in $toml..." -ForegroundColor Cyan
  $p = Start-Process -FilePath "wrangler" -ArgumentList @("secret","put",$key,"-c",$toml) -NoNewWindow -PassThru -RedirectStandardInput pipe
  $p.StandardInput.WriteLine($val)
  $p.StandardInput.Close()
  $p.WaitForExit()
  if ($p.ExitCode -ne 0) { throw "wrangler secret put $key failed for $toml" }
}

try {
  $ace = $Env:ACE_API_KEY
  $supaUrl = $Env:SUPABASE_URL
  $supaRole = $Env:SUPABASE_SERVICE_ROLE_KEY

  if ($ace) {
    Set-Secret "ACE_API_KEY" $ace "wrangler-etl.toml"
    Set-Secret "ACE_API_KEY" $ace "wrangler.toml"
    Set-Secret "ACE_API_KEY" $ace "wrangler-watchdog.toml"
    Set-Secret "ACE_API_KEY" $ace "wrangler-backfill-queue.toml"
  }
  if ($supaUrl) {
    Set-Secret "SUPABASE_URL" $supaUrl "wrangler-etl.toml"
    Set-Secret "SUPABASE_URL" $supaUrl "wrangler.toml"
  }
  if ($supaRole) {
    Set-Secret "SUPABASE_SERVICE_ROLE_KEY" $supaRole "wrangler-etl.toml"
    Set-Secret "SUPABASE_SERVICE_ROLE_KEY" $supaRole "wrangler.toml"
  }
  Write-Host "All secrets updated." -ForegroundColor Green
} catch {
  Write-Error $_
  exit 1
}
