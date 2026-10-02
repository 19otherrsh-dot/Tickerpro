# Setting up TickerPro on a new machine

## 1. Install prerequisites
- Git, Node 24.x, npm 11.9.0 (`npm i -g npm@11.9.0`)
- Python 3 (for `apps/ai-service`)
- 7-Zip (to decrypt secrets)
- Docker Desktop (Postgres, Redis, Kafka, ClickHouse via `docker-compose.yml`)
- Ollama + the models used by `apps/ai-service`
- Expo / EAS CLI (for `apps/mobile`)

## 2. Clone and restore secrets
```powershell
git clone https://github.com/19otherrsh-dot/Tickerpro.git
cd Tickerpro
& "C:\Program Files\7-Zip\7z.exe" x secrets.7z -p<PASSPHRASE>
```
This restores `.env`, `apps/api/.env` and `packages/database/.env`.
The passphrase is NOT stored in the repo — keep it in your password manager.

To update the archive after changing any `.env`:
```powershell
& "C:\Program Files\7-Zip\7z.exe" a -t7z -mhe=on -mx=9 -p<PASSPHRASE> secrets.7z .env apps\api\.env packages\database\.env
```

## 3. Install and build
```powershell
npm install
pip install -r apps/ai-service/requirements.txt
docker compose up -d
cd packages/database; npx prisma migrate deploy; cd ../..
npm run build
```

## 4. Restore Claude Code project memory
Open Claude Code in the project folder once (so it creates its project dir), then copy
`.claude/memory/*.md` into `~/.claude/projects/<project-path-slug>/memory/`
(the slug is the project path with `:` and `\` replaced by `-`, e.g. `d--me-Antigravity-Doubletick`).

## 5. Re-point external integrations
- Meta WhatsApp webhook URL (if tunnel/domain changed) — verify token must match `META_WEBHOOK_VERIFY_TOKEN`
- Shopify / Stripe / HubSpot callback URLs if the host changed
