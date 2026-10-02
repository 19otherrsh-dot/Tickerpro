# Deployment Guide

This guide covers the human/environment steps needed to deploy TickerPro. The
codebase itself is deploy-ready (Dockerfiles, health probes, graceful shutdown,
CI-gated pipeline with migrations); what remains below **cannot be done from the
repo alone** and needs you.

> **Status check.** As of this writing the project is **not yet a git repository**,
> so CI/CD has never run. Step 1 is the single highest-leverage action — it turns
> on the automated gate (lint → typecheck → test → build) that catches regressions.

---

## 0. Prerequisites

- **Node.js 20+** (Next.js 16 requires it; CI and Docker images are pinned to 20)
- **Docker** + Docker Compose (for local/self-host, and to build production images)
- A **Meta Business App** with WhatsApp Cloud API access (and, for omnichannel, a
  Facebook Page / Instagram professional account)
- For AWS: an **ECR repo**, an **ECS cluster + services**, and an OIDC deploy role

---

## 1. Initialize git and push (do this first)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Pushing to `main` triggers [.github/workflows/main.yml](.github/workflows/main.yml)
(CI). Confirm it passes **before** relying on the deploy workflow — deploy only
runs after CI succeeds.

Verify locally first if you like:

```bash
npm ci
npx turbo run check-types   # must be clean (5/5 packages)
npx turbo run test          # 57 tests
npx turbo run build         # 4/4 packages
```

---

## 2. Configure environment variables

Two separate `.env` surfaces. **Never commit these** — `.gitignore` and
`.dockerignore` already exclude them.

### a) Root `.env` — for `docker compose` (self-host)

Copy [.env.example](.env.example) → `.env` and fill in:

| Var | Required | Notes |
|---|:---:|---|
| `POSTGRES_PASSWORD` | ✅ | Postgres password (compose fails fast if unset) |
| `JWT_SECRET` | ✅ | Long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `META_APP_SECRET` | prod | Enables webhook signature verification (fail-closed in prod) |
| `META_WEBHOOK_VERIFY_TOKEN` | prod | Must be non-default in production |
| `SHOPIFY_API_SECRET` | if used | Shopify webhook HMAC verification |
| `NEXT_PUBLIC_API_URL` | prod | Browser-facing API URL, **baked into the web image at build time** (compose passes it as a build arg). Defaults to `http://localhost:4000`. |

### b) `apps/api/.env` — for the API service (see [apps/api/.env.example](apps/api/.env.example))

Beyond the above, the API also reads:

- `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `CORS_ORIGIN`
- **Meta send**: `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID`
- **AI (copilot/RAG)**: `OPENAI_API_KEY`, `OPENAI_API_BASE` (set to your Ollama
  URL, e.g. `http://ollama:11434/v1`, to run local/no-cost), `OPENAI_MODEL`
- **Email** (password reset, etc.): `EMAIL_PROVIDER` (`console` | `resend` |
  `sendgrid`), `EMAIL_FROM`, `APP_URL`, and `RESEND_API_KEY` / `SENDGRID_API_KEY`
- **ClickHouse**: `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DB`
- **Error tracking** (optional): `SENTRY_DSN` (also `npm i @sentry/node` to activate)

---

## 3. Local / self-host deploy (Docker Compose)

```bash
docker compose up -d --build
```

The stack starts in the right order automatically:

1. `db`, `redis`, `kafka`, `clickhouse`, `ollama` come up
2. **`migrate`** runs `prisma migrate deploy` and exits (api/worker wait for it)
3. `api` starts and becomes healthy on `/api/health/ready`
4. `worker`, `web`, `webhook-processor` start (AI runs on `ollama` via the Node gateway)

- Web dashboard → http://localhost:3000
- API → http://localhost:4000 (readiness: `GET /api/health/ready`)

To reset everything (including volumes): `docker compose down -v && docker compose up -d --build`.

---

## 4. AWS ECS production deploy

The deploy pipeline is [.github/workflows/deploy-aws.yml](.github/workflows/deploy-aws.yml).
It runs **only after CI succeeds on `main`**, then: runs DB migrations → builds &
pushes images → registers a new task-def revision per service pointing at the new
image → updates the service.

### One-time setup

1. **GitHub repo secrets** (Settings → Secrets and variables → Actions):
   - `AWS_DEPLOY_ROLE_ARN` — the IAM role GitHub OIDC assumes
   - `DATABASE_URL` — connection string used for `prisma migrate deploy`
   - `NEXT_PUBLIC_API_URL` — the **browser-facing** API URL (e.g.
     `https://api.yourdomain.com`). ⚠️ This is inlined into the web bundle at
     **build time** (it's a `NEXT_PUBLIC_*` var), so the deploy passes it as a
     Docker `--build-arg`. Setting it only as a runtime env var has **no effect**
     on client-side code — the browser would fall back to `http://localhost:4000`.
2. **ECR**: create the `tickerpro` repository (or change `ECR_REPOSITORY` in the workflow).
3. **ECS**: create the cluster and three services. The workflow assumes these
   names — change the `env:` block if yours differ:
   - Cluster: `tickerpro-cluster`
   - Task-def families: `tickerpro-api`, `tickerpro-webhook`, `tickerpro-web`
   - Container names inside each task def: `api`, `webhook-processor`, `web`
   - Services: `tickerpro-api-service`, `tickerpro-webhook-service`, `tickerpro-web-service`
4. **Task definitions**: set all runtime env vars (Section 2b) as ECS
   secrets/environment, ideally via AWS Secrets Manager / SSM. Point health checks
   at `/api/health/ready` (API) with a sensible `startPeriod`.
5. **Managed dependencies**: provision RDS Postgres (with the `pgvector`
   extension — the schema uses it), ElastiCache Redis, an MSK/Kafka cluster, and
   ClickHouse. Wire their endpoints into the task-def env.

### Deploy

Push to `main`. CI runs; on success, the deploy workflow ships. Roll back by
re-running the workflow on an earlier green commit (ECS keeps prior task-def revisions).

---

## 5. Post-deploy verification

- [ ] `GET /api/health/ready` returns `200` with `database: "ok"`
- [ ] Register a user, log in (confirms DB + JWT + migrations)
- [ ] Configure the Meta webhook URL → `https://<api-host>/api/webhooks/meta`
      with your `META_WEBHOOK_VERIFY_TOKEN`; send a test WhatsApp message and
      confirm it appears in the inbox
- [ ] Send an outbound message from the dashboard (confirms real delivery, not
      just a DB write)
- [ ] Trigger a password reset and confirm the email is delivered (switch
      `EMAIL_PROVIDER` off `console` for real sending)

---

## 6. Known gaps / decisions still open

- **AI service**: the Python `apps/ai-service` has been **retired** — copilot,
  sentiment, and RAG all run through the Node AI gateway (against `ollama`). It's
  removed from `docker-compose` and the deploy workflow; the leftover
  `apps/ai-service/` directory is unreferenced dead code and can be deleted.
- **Mobile app**: `apps/mobile` is a starter Expo template, not production.
- **Meta partner status / green-tick onboarding**: an external/business step, not code.
- **Observability**: `@sentry/node` is optional and not installed; add it + set
  `SENTRY_DSN` to activate error tracking.
- **Secrets**: prefer AWS Secrets Manager / SSM over plain task-def env for
  anything sensitive.
