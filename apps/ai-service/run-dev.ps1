# Runs the ai-service locally with the same DB / LLM settings as the API.
# The service reads plain environment variables (no dotenv), so load them from apps/api/.env.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Get-Content '..\api\.env' |
  Where-Object { $_ -match '^(DATABASE_URL|OPENAI_API_BASE|OPENAI_API_KEY)=' } |
  ForEach-Object {
    $k, $v = $_ -split '=', 2
    Set-Item "env:$k" $v.Trim().Trim('"')
  }

& '.\.venv\Scripts\python.exe' -m uvicorn main:app --host 0.0.0.0 --port 8000
