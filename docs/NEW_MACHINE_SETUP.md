# Setting up TickerPro on a new machine (Windows)

## 1. Get the code
Either unzip the transfer zip, or:
```powershell
winget install Git.Git
git clone https://github.com/19otherrsh-dot/Tickerpro.git
cd Tickerpro
```

## 2. Run the setup script
From the repo root:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```
It installs anything missing (Git, Node LTS, Docker Desktop, 7-Zip, Python 3.11), restores the
`.env` files from `secrets.7z` (asks for the passphrase — kept in your password manager, never in
the repo), starts Postgres/Redis/Kafka/ClickHouse/Ollama, pulls the AI models (~10 GB), installs
dependencies, migrates + seeds the database and builds everything. It is safe to re-run.

If Docker Desktop is freshly installed it may need a reboot and its first-run WSL 2 setup — the
script tells you; reboot and run it again.

Flags: `-SkipModels` (no model downloads), `-SkipBuild`.

## 3. Start the platform
```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-dev.ps1
```
Opens windows for the apps (`npm run dev`), the API worker and the Python ai-service, then waits
for the API health check.

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 — `admin@tickerpro.com` / `admin123456` |
| API | http://localhost:4000 (`/api/health/ready`) |
| Webhook processor | http://localhost:4001 |
| AI service | http://localhost:8000 |
| Ollama | http://localhost:11434 |

Mobile app: `cd apps\mobile; npx expo start`.

## 4. Verify nothing is missing
- [ ] Log in to the dashboard
- [ ] Inbox → AI Summarize / suggested replies return real text (Ollama + ai-service)
- [ ] Send a test broadcast and watch progress (worker + Kafka + Redis)
- [ ] Analytics page loads (ClickHouse)
- [ ] Knowledge base ingest works (ai-service + pgvector)
- [ ] Meta webhook verifies — if the public URL/tunnel changed, update it in the Meta app dashboard
- [ ] Shopify / Stripe / HubSpot callback URLs if the host changed

## 5. Restore Claude Code project memory
Open Claude Code in the project folder once, then copy `.claude/memory/*.md` into
`~/.claude/projects/<project-path-slug>/memory/` (the slug is the project path with `:` and `\`
replaced by `-`, e.g. `d--me-Antigravity-Doubletick`).

## Keeping secrets.7z current
After changing any `.env`:
```powershell
& "C:\Program Files\7-Zip\7z.exe" a -t7z -mhe=on -mx=9 -p<PASSPHRASE> secrets.7z .env apps\api\.env packages\database\.env apps\webhook-processor\.env
```
