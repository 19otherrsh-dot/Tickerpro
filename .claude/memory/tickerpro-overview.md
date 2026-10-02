---
name: tickerpro-overview
description: What the TickerPro/Doubletick product is and the commercialization goal driving the work
metadata: 
  node_type: memory
  type: project
  originSessionId: 05e9e9e7-268a-4a1a-a39a-fc4d461ce986
---

The repo at `d:\me\Antigravity\Doubletick` is **TickerPro** — an open-source, AI-first omnichannel WhatsApp Business CRM (Turborepo monorepo: web/api/webhook-processor/ai-service/mobile/widget; Postgres+Prisma, Redis, Kafka, ClickHouse, Ollama local LLM, Stripe/Shopify/HubSpot).

The user's throughline across sessions is **commercializing this product**, not just coding. Established direction (2026-06-22): the defensible moat is **open-source + local-LLM (no per-token cost / data-residency) + self-host**. Recommended go-to-market: managed-cloud open-core SaaS; target D2C Shopify brands and data-sensitive verticals (BFSI/healthcare). Biggest weakness is distribution, not features.

Key constraint on this machine: **no Docker, no local Postgres/Redis/Kafka/ClickHouse** — full stack can't run here; only `web` (Next.js prod build) and standalone builds verify. Builds/tests must run with the sandbox disabled (otherwise `spawn EPERM`). See [[tickerpro-gaps-roadmap]].