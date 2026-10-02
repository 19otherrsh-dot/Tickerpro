<#
  Starts the full TickerPro dev stack. Run scripts\setup.ps1 once first.

  Opens three windows:
    - npm run dev        web :3000, api :4000, webhook-processor :4001, widget
    - api worker         broadcasts, drips, background jobs
    - ai-service :8000   Python RAG / suggest-reply / ingest
  then waits for the API health check.
#>
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

docker compose up -d db redis kafka clickhouse ollama
if ($LASTEXITCODE -ne 0) { throw 'docker compose failed - is Docker Desktop running?' }

function Open-Window([string]$title, [string]$dir, [string]$command) {
  $cmd = "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location '$dir'; $command"
  Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $cmd
}

Open-Window 'TickerPro dev'    $Root 'npm run dev'
Open-Window 'TickerPro worker' $Root 'npm run worker -w api'
Open-Window 'TickerPro ai-service' (Join-Path $Root 'apps\ai-service') '.\run-dev.ps1'

Write-Host 'Waiting for API health (up to 2 min)...'
$deadline = (Get-Date).AddMinutes(2)
while ((Get-Date) -lt $deadline) {
  try {
    Invoke-WebRequest 'http://localhost:4000/api/health/ready' -UseBasicParsing -TimeoutSec 5 | Out-Null
    Write-Host 'API is ready.' -ForegroundColor Green
    Write-Host 'Dashboard: http://localhost:3000   (admin@tickerpro.com / admin123456)'
    return
  } catch { Start-Sleep -Seconds 5 }
}
Write-Warning 'API did not report ready in 2 minutes - check the "TickerPro dev" window.'
