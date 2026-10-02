# TickerPro — AI-First Omnichannel WhatsApp CRM

> The most powerful open-source WhatsApp Business API platform for high-growth brands.

![License](https://img.shields.io/badge/license-Dual_License-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)
![Next.js](https://img.shields.io/badge/Next.js-15-000)
![Fastify](https://img.shields.io/badge/Fastify-5.x-202020)

---

## 🚀 Overview

TickerPro is a full-stack, enterprise-grade WhatsApp CRM built as a **Turborepo monorepo**. It consolidates WhatsApp, Instagram DMs, and Facebook Messenger into a single unified inbox — powered by AI, real-time analytics, and marketing automation.

### Why TickerPro?

Where TickerPro is genuinely differentiated — and where the incumbents are simply
better. We'd rather you trust this table than be surprised later.

| Feature | Wati | DoubleTick | AiSensy | **TickerPro** |
|---|:---:|:---:|:---:|:---:|
| **Open source / self-hostable** | ❌ | ❌ | ❌ | ✅ |
| **Local LLM (no per-token cost, data stays in your VPC)** | ❌ | ❌ | ❌ | ✅ |
| **Native A/B testing for broadcasts** | ❌ | ❌ | ❌ | ✅ |
| Per-conversation billing engine (true Meta cost, no markup) | ⚠️ ~20% markup | ⚠️ | ⚠️ | ✅ |
| AI copilot (summarize + suggest) | ✅ | ✅ | ⚠️ | ✅ |
| Omnichannel (WhatsApp + Instagram + Messenger) | ✅ | ⚠️ WA-focused | ❌ | ✅ |
| WhatsApp Flows (multi-screen forms) | ✅ | ✅ | ⚠️ | ✅ |
| Internal notes, SLA auto-escalation | ✅ | ✅ | ⚠️ | ✅ |
| Outbound webhooks / Zapier | ✅ | ✅ | ⚠️ | ✅ |
| Visual drag-and-drop bot builder | ✅ | ✅ | ✅ | ✅ |
| AI product image recognition (photo → cart) | ❌ | ✅ | ❌ | ✅ |
| Shopify **+ WooCommerce** | ✅ | ✅ | ⚠️ | ✅ |
| Native mobile apps (iOS/Android) | ✅ | ✅ **mobile-first** | ✅ | ❌ |
| Official Meta partner / green-tick onboarding | ✅ | ✅ | ✅ | ❌ **not yet** |

> **Being straight with you:** TickerPro's edge is being open-source, self-hostable,
> and able to run entirely on a local LLM — no vendor sees your customer data and
> there are no per-token AI fees. What we do *not* have is what an incumbent buys
> you: Meta partner status, green-tick onboarding, native mobile apps, and a
> deliverability track record. If those are your priority, use Wati or DoubleTick.

---

## 🏗️ Architecture

```
tickerpro/
├── apps/
│   ├── web/                  # Next.js 15 Dashboard (React, SSR)
│   ├── api/                  # Fastify 5 REST API + WebSocket
│   └── webhook-processor/    # Fastify ingestion layer → Kafka
├── packages/
│   ├── database/             # Prisma ORM + Schema
│   ├── ui/                   # Shared React components
│   └── typescript-config/    # Shared TS configs
└── docker-compose.yml        # PostgreSQL, Redis, Kafka, ClickHouse
```

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, CSS Modules |
| **API** | Fastify 5, Zod, JWT |
| **Database** | PostgreSQL + Prisma ORM |
| **Real-Time** | WebSocket (Fastify WS) |
| **Queue** | Apache Kafka (KafkaJS) |
| **Analytics** | ClickHouse |
| **Cache** | Redis |
| **AI** | Ollama (local LLM) |
| **Payments** | Stripe |
| **E-Commerce** | Shopify API |
| **CI/CD** | GitHub Actions → AWS ECR/ECS |

---

## ✨ Feature Highlights

### 📬 Unified Inbox
- Real-time messaging across **WhatsApp, Instagram, and Messenger**
- Typing indicators, read receipts, message reactions
- Emoji picker, file attachments, canned responses
- Conversation transfer between agents

### 🤖 AI Copilot
- **1-click Summarize**: Condense 100+ message threads instantly
- **Smart Reply Suggestions**: Context-aware draft replies
- **Sentiment Analysis**: Color-coded conversation sentiment
- Powered by local **Ollama** models (no API costs)

### 📢 Marketing Automation
- **Broadcasts** with template support and live progress tracking
- **A/B Testing**: Split audiences 50/50 between template variants
- **Drip Campaigns**: Multi-step automated follow-up sequences
- **Abandoned Cart Recovery**: Shopify webhook → WhatsApp drip

### 🛒 Commerce & Payments
- Shopify product sync + catalog management
- In-chat payment links via **Stripe**
- Revenue attribution from **Click-to-WhatsApp** ads

### 🔐 Enterprise Security
- **RBAC**: Route-level role enforcement (SUPER_ADMIN → VIEWER)
- **Audit Logs**: Searchable, filterable security event timeline
- **Conversation Billing**: Per-24h window credit system (Meta pricing)

### 🔗 Developer Ecosystem
- **Outbound Webhooks**: Signed payloads to Zapier/Make/custom backends
- **Public REST API** with API key auth
- **WhatsApp Flows**: Build native multi-screen forms
- **Template Builder**: Create, submit, and sync template approval with Meta

### 📊 Analytics
- Real-time dashboards in **ClickHouse**
- CSAT survey collection and scoring
- Ad spend → revenue attribution

---

## 🛠️ Getting Started

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL, Redis, Kafka, ClickHouse)
- A Meta Business App with WhatsApp API access
- (Optional) Ollama for AI features

### Quick Start

```bash
# 1. Clone
git clone https://github.com/your-org/tickerpro.git && cd tickerpro

# 2. Install
npm install

# 3. Environment
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, META_ACCESS_TOKEN, etc.

# 4. Start infrastructure
docker-compose up -d

# 5. Push database schema
cd packages/database && npx prisma db push && cd ../..

# 6. Run everything
npx turbo dev
```

The dashboard will be available at `http://localhost:3000` and the API at `http://localhost:4000`.

---

## 📁 API Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/conversations` | List conversations |
| `POST` | `/api/messages/:id/send` | Send message (with billing check) |
| `POST` | `/api/broadcasts` | Create broadcast |
| `GET/POST` | `/api/templates` | Manage WhatsApp templates |
| `GET/POST` | `/api/flows` | Manage WhatsApp Flows |
| `POST` | `/api/copilot/summarize` | AI summarize conversation |
| `POST` | `/api/copilot/suggest-replies` | AI reply suggestions |
| `GET` | `/api/contacts/export` | Export contacts as CSV |
| `POST` | `/api/contacts/import` | Bulk import contacts |
| `GET/POST/DELETE` | `/api/outbound-webhooks` | Manage outbound webhooks |
| `GET` | `/api/audit` | Query audit logs |
| `POST` | `/api/integrations/meta/oauth` | Meta Embedded Signup |
| `GET` | `/api/analytics/*` | Analytics dashboards |
| `WS` | `/ws` | Real-time WebSocket |

---

## 🚢 Deployment

See the full [Deployment Guide](./docs/deployment-guide.md) for AWS ECS, GCP Cloud Run, and bare-metal instructions.

A GitHub Actions workflow is included at `.github/workflows/deploy-aws.yml` for automated CI/CD.

---

## 📋 Roadmap

- [x] Phase 1: Core CRM (Inbox, Contacts, Auth)
- [x] Phase 2: Marketing (Broadcasts, Drips, Bot Studio)
- [x] Phase 3: Billing & Commerce (Stripe, Shopify)
- [x] Phase 4: Ads & Attribution (Click-to-WhatsApp)
- [x] Phase 5: AI Copilot & Agent Productivity
- [x] Phase 6: RBAC, Billing Engine, Audit Logs
- [x] Phase 7: Meta OAuth, Template Builder, CSV Ops
- [x] Phase 8: WhatsApp Flows, Outbound Webhooks, Omnichannel

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## 📄 License

TickerPro is distributed under an **Open-Core Dual License** model:
- **Core Features**: AGPLv3 (Open Source)
- **Enterprise Features (AI Copilot, ClickHouse Analytics, Multi-Number Support)**: Commercial License

See the [LICENSE](./LICENSE) file for more details.
