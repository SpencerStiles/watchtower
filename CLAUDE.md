# WatchTower

AI agent monitoring SaaS — drop-in SDK for OpenAI/Anthropic, quality scoring, real-time dashboards, alerts, Stripe billing.

## Architecture

```
┌─────────────────┐        POST /api/v1/events         ┌──────────────────────────┐
│ User's App      │  ──────────────────────────────▶    │ @watchtower/web          │
│                 │  Bearer token (API key)              │ (Next.js 14 + Prisma)    │
│ ┌─────────────┐ │                                     │                          │
│ │@watchtower/ │ │                                     │  Event Ingestion         │
│ │sdk          │ │                                     │    ▼                     │
│ │             │ │                                     │  Quality Scoring (L1+L2) │
│ │ Batcher ────┤ │                                     │    ▼                     │
│ │ Transport   │ │                                     │  PostgreSQL (Prisma)     │
│ └─────────────┘ │                                     │    ▼                     │
└─────────────────┘                                     │  SSE → Dashboard         │
                                                        │  Alert Check → Email     │
                                                        └──────────────────────────┘
```

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@watchtower/sdk` | `packages/sdk/` | Client wrapper for OpenAI/Anthropic. Batches events and sends to server. |
| `@watchtower/web` | `packages/web/` | Next.js dashboard, API routes, scoring pipeline, Stripe billing. |

## Key Files

### SDK
- `src/watchtower.ts` — Main class. `wrap()` auto-detects client type.
- `src/wrappers/openai.ts` / `anthropic.ts` — Intercept `.create()` calls, emit events.
- `src/batcher.ts` — Buffers events, flushes on size threshold or interval.
- `src/transport.ts` — HTTP sender with retry buffer (max 1000 events).

### Web
- `src/app/api/v1/events/route.ts` — Public event ingestion endpoint (Bearer token auth).
- `src/app/api/v1/agents/` — Agent CRUD (developer-only).
- `src/app/api/v1/webhooks/stripe/route.ts` — Stripe webhook handler.
- `src/lib/scoring/` — Two-layer quality scoring pipeline.
- `src/lib/alert-check.ts` — Alert evaluation + email dispatch.
- `src/lib/rate-limit.ts` — In-memory rate limiter (single-instance only).
- `src/lib/sse.ts` — SSE connection pool (in-memory, single-instance only).
- `prisma/schema.prisma` — Full database schema.

## Data Flow: Event Ingestion

```
SDK (batch of events)
  → POST /api/v1/events (Bearer token)
  → Validate API key (SHA256 hash lookup)
  → Rate limit check (in-memory)
  → Zod schema validation
  → For each event in batch:
      → Upsert Conversation (by sessionId)
      → Create Event record
      → Score (Layer 1: errors, empty, identity leaks, keywords)
      → Score (Layer 2: anomalous length, hedging, sentiment, repetition)
      → Create QualityFlag records for any issues
      → Update Conversation.qualityScore (avg of event scores)
      → Update Agent.qualityScore (EWMA, alpha=0.3)
  → Broadcast via SSE (fire-and-forget)
  → Check alert thresholds → send email if triggered
```

## Auth & Roles

- **NextAuth** with GitHub/Google OAuth
- Two roles: `DEVELOPER` (full org access) and `BUSINESS_OWNER` (view-only via BusinessDashboard)
- API key auth on `/api/v1/events` only (public endpoint, no session required)
- API keys hashed with SHA256 before storage; shown once on creation

## Quality Scoring

- **Layer 1 (immediate):** Error detection, empty responses, AI identity leaks, blocked/required keyword checks
- **Layer 2 (contextual):** Anomalous response length, excessive hedging (>=3), negative sentiment (>=2), repetitive sentences (>=3)
- Scoring: base 100, deductions by severity (LOW -5, MEDIUM -15, HIGH -30, CRITICAL -50)
- Agent score: EWMA of conversation scores (alpha=0.3)

## Known Limitations (intentional trade-offs)

- **In-memory state:** Rate limiter, SSE pool, and alert dedup are in-memory Maps. Resets on deploy. Single-instance only. Redis migration tracked in TODOS.md.
- **No streaming support:** SDK throws on `stream:true`. Tracked in TODOS.md.
- **Per-event error isolation is best-effort:** Event ingestion uses a single DB transaction for the batch. A DB-level error on one event (deadlock, timeout) aborts the transaction and causes subsequent events in the same batch to fail. Nothing is committed, and idempotent `externalId` upserts make client retries safe.

## Development

```bash
npm install
cd packages/web && cp .env.example .env  # fill in values
npx prisma db push && npx prisma db seed
cd ../.. && npm run dev

# Tests
npm test              # all packages
npm run test:sdk      # SDK only
npm run test:web      # web only
```

## Conventions

- TypeScript strict mode in both packages
- Zod for all API input validation
- Structured JSON logging (`src/lib/logger.ts`)
- Prisma for all DB access (no raw SQL)
- Vitest for testing
