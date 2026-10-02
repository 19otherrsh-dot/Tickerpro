<#
  One-shot TickerPro setup for a fresh Windows machine. Safe to re-run.

  Usage (from the repo root):
    powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
    powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -SkipModels -SkipBuild

  What it does:
    1. Installs missing prerequisites via winget (Git, Node LTS, Docker Desktop, 7-Zip, Python 3.11)
    2. Restores .env files from secrets.7z (asks for the passphrase) if any are missing
    3. Starts Docker Desktop and the infrastructure containers
    4. Pulls the Ollama models (llama3, nomic-embed-text, llava)
    5. npm install (also generates the Prisma client)
    6. Applies DB migrations and seeds the demo workspace
    7. Creates the Python venv for apps/ai-service
    8. Builds every workspace
#>
param(
  [switch]$SkipModels,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path', 'User')
}
# Run a native command and fail loudly on a non-zero exit code.
function Exec([scriptblock]$cmd) {
  & $cmd
  if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE): $cmd" }
}
# Probe a native command without letting stderr trip $ErrorActionPreference.
function Probe([string]$cmdLine) {
  cmd /c "$cmdLine >nul 2>&1"
  return $LASTEXITCODE -eq 0
}
function Winget-Install([string]$id) {
  Write-Host "    installing $id ..."
  winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements
  Refresh-Path
}

# ── 1. Prerequisites ─────────────────────────────────────────────────────────
Step '1/8 Prerequisites'
if (-not (Have 'winget')) { throw 'winget is required (install "App Installer" from the Microsoft Store).' }

if (-not (Have 'git'))    { Winget-Install 'Git.Git' }
if (-not (Have 'node'))   { Winget-Install 'OpenJS.NodeJS.LTS' }
if (-not (Have 'docker')) { Winget-Install 'Docker.DockerDesktop' }

$SevenZip = Join-Path $env:ProgramFiles '7-Zip\7z.exe'
if (-not (Test-Path $SevenZip)) { Winget-Install '7zip.7zip' }

# ai-service pins packages (pydantic 2.3, psycopg2 2.9.9, tiktoken 0.5.1) that have
# no wheels for Python 3.12+, so it needs 3.11 specifically.
if (-not (Probe 'py -3.11 --version')) { Winget-Install 'Python.Python.3.11' }

foreach ($c in 'git', 'node', 'npm', 'docker') {
  if (-not (Have $c)) { throw "$c is still not on PATH. Close this window, open a new one, and re-run (a reboot may be needed after installing Docker)." }
}
$nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) { throw "Node $(node -v) is too old; need 20+." }
Ok "node $(node -v), npm $(npm -v), $(git --version)"

# ── 2. Secrets ───────────────────────────────────────────────────────────────
Step '2/8 Environment files'
$EnvFiles = '.env', 'apps\api\.env', 'packages\database\.env', 'apps\webhook-processor\.env'
$missing = @($EnvFiles | Where-Object { -not (Test-Path $_) })
if ($missing.Count -gt 0) {
  if (-not (Test-Path 'secrets.7z')) { throw "Missing $($missing -join ', ') and no secrets.7z to restore from." }
  $sec = Read-Host 'Passphrase for secrets.7z' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  # -aos: never overwrite an .env that already exists
  & $SevenZip x 'secrets.7z' "-p$pw" -aos -y | Out-Null
  $pw = $null
  if ($LASTEXITCODE -ne 0) { throw 'Could not open secrets.7z (wrong passphrase?).' }
  $still = @($EnvFiles | Where-Object { -not (Test-Path $_) })
  if ($still.Count -gt 0) { throw "Still missing after restore: $($still -join ', ')" }
}
Ok ($EnvFiles -join ', ')

# ── 3. Docker + infrastructure ───────────────────────────────────────────────
Step '3/8 Docker infrastructure'
if (-not (Probe 'docker info')) {
  $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dd) { Start-Process $dd }
  Write-Host '    waiting for Docker Desktop to start (up to 4 min)...'
  $deadline = (Get-Date).AddMinutes(4)
  while (-not (Probe 'docker info')) {
    if ((Get-Date) -gt $deadline) { throw 'Docker did not start. Open Docker Desktop, finish its first-run setup (WSL 2), then re-run.' }
    Start-Sleep -Seconds 5
  }
}
Exec { docker compose up -d db redis kafka clickhouse ollama }

Write-Host '    waiting for Postgres to be healthy...'
$dbId = (docker compose ps -q db).Trim()
$deadline = (Get-Date).AddMinutes(2)
do {
  $health = (docker inspect --format '{{.State.Health.Status}}' $dbId).Trim()
  if ($health -eq 'healthy') { break }
  if ((Get-Date) -gt $deadline) { throw "Postgres not healthy (status: $health). Check: docker compose logs db" }
  Start-Sleep -Seconds 3
} while ($true)
Ok 'db, redis, kafka, clickhouse, ollama are up'

# ── 4. AI models ─────────────────────────────────────────────────────────────
Step '4/8 Ollama models'
if ($SkipModels) {
  Ok 'skipped (-SkipModels)'
} else {
  foreach ($m in 'llama3', 'nomic-embed-text', 'llava') {
    Write-Host "    pulling $m ..."
    Exec { docker compose exec -T ollama ollama pull $m }
  }
  Ok 'llama3 (chat), nomic-embed-text (embeddings), llava (vision)'
}

# ── 5. Node dependencies ─────────────────────────────────────────────────────
Step '5/8 npm install'
Exec { npm install }

# ── 6. Database ──────────────────────────────────────────────────────────────
Step '6/8 Database migrations + seed'
Push-Location 'packages\database'
try {
  Exec { npx prisma migrate deploy }
  Exec { npx tsx prisma/seed.ts }
} finally { Pop-Location }
Ok 'schema applied; demo login: admin@tickerpro.com / admin123456'

# ── 7. Python ai-service ─────────────────────────────────────────────────────
Step '7/8 Python ai-service'
$venv = 'apps\ai-service\.venv'
if (-not (Test-Path "$venv\Scripts\python.exe")) { Exec { py -3.11 -m venv $venv } }
Exec { & "$venv\Scripts\python.exe" -m pip install --upgrade pip --quiet }
Exec { & "$venv\Scripts\python.exe" -m pip install -r 'apps\ai-service\requirements.txt' --quiet }
Ok "venv at $venv"

# ── 8. Build ─────────────────────────────────────────────────────────────────
Step '8/8 Build'
if ($SkipBuild) { Ok 'skipped (-SkipBuild)' } else { Exec { npm run build } }

Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host 'Start everything with:  powershell -ExecutionPolicy Bypass -File scripts\start-dev.ps1'
