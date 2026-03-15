# WatchTower

> AI agent monitoring and observability -- quality scoring, real-time dashboards, and alerts for production LLM agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/SpencerStiles/watchtower/actions)

```bash
npm install @watchtower/sdk
```

---

## What is WatchTower?

WatchTower is a monitoring platform for AI agents running in production. It wraps your OpenAI or Anthropic client in one line, captures every LLM call, and scores responses for quality issues -- hallucinations, off-brand language, sentiment problems, and anomalies. The web dashboard gives you real-time visibility into conversations, costs, and quality trends across all your agents.

## Packages

| Package | Description |
|---------|-------------|
| `@watchtower/sdk` | Drop-in wrapper for OpenAI and Anthropic clients. Captures events with automatic batching. |
| `@watchtower/web` | Next.js dashboard with quality scoring, conversation replay, alerts, and Stripe billing. |

## Quick Start

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { WatchTower } from '@watchtower/sdk';

const watchtower = new WatchTower({
  apiKey: 'wt_...',
  agentId: 'your-agent-id',
});

// Wrap your AI client -- that's it
const anthropic = watchtower.wrap(new Anthropic());

// Use the client as normal. Every call is tracked automatically.
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Flush before shutdown
await watchtower.flush();
```

Works the same way with OpenAI:

```typescript
import OpenAI from 'openai';
import { WatchTower } from '@watchtower/sdk';

const watchtower = new WatchTower({ apiKey: 'wt_...', agentId: 'your-agent-id' });
const openai = watchtower.wrap(new OpenAI());

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Features

- **Two-Layer Quality Scoring** -- Layer 1 catches errors, empty responses, AI identity leaks, and blocked/required keyword violations. Layer 2 detects anomalous response lengths, excessive hedging, negative sentiment, and repetition loops.
- **Real-Time Dashboard** -- SSE-powered live view of conversations, quality scores, token usage, and costs per agent.
- **Configurable Alerts** -- Set thresholds for quality drops, error rate spikes, and budget overruns. Email notifications with hourly deduplication.
- **Conversation Replay** -- Drill into any conversation to see every request/response pair, flags, and scores.
- **Quality Flags** -- Six categories (hallucination, off-brand, policy violation, tool failure, negative sentiment, anomaly) with four severity levels. Flags are reviewable and resolvable by team members.
- **Cost Tracking** -- Per-event token counts and cost in cents, rolled up per conversation and per agent.
- **Multi-Agent Support** -- Monitor multiple agents under one organization with per-agent API keys.
- **Client Invitations** -- Invite business stakeholders to view specific agent dashboards via email with Stripe-gated billing tiers.
- **Automatic Batching** -- SDK batches events (default: 50 events or 5s interval) to minimize overhead on your application.

## WatchTower vs. Alternatives

| | WatchTower | LangSmith | Helicone | Braintrust |
|-|------------|-----------|----------|------------|
| Setup complexity | 1 line (`wrap()`) | Tracing decorators | Proxy URL swap | Custom logger |
| Quality scoring | Built-in two-layer pipeline | Manual evaluators | None | Custom evals |
| Real-time alerts | Quality, errors, budget | Latency only | Cost only | None |
| Client dashboards | Built-in with invitations | No | No | No |
| Self-hostable | Yes (Next.js + Postgres) | No | Yes | No |
| Open source | MIT | Partial | Yes | Partial |
| Billing integration | Stripe built-in | N/A | N/A | N/A |
| Provider support | OpenAI, Anthropic | OpenAI, Anthropic, more | Any (proxy) | OpenAI, Anthropic |

## Tech Stack

- **SDK**: TypeScript, zero runtime dependencies, auto-detects OpenAI/Anthropic clients
- **Web**: Next.js 14, React 18, Tailwind CSS, Prisma, PostgreSQL
- **Auth**: NextAuth.js with Prisma adapter
- **Billing**: Stripe subscriptions and webhooks
- **Alerts**: Nodemailer with in-memory deduplication
- **Testing**: Vitest across both packages

## Local Development

```bash
git clone https://github.com/SpencerStiles/watchtower
cd watchtower
npm install

# Set up the database
cp packages/web/.env.example packages/web/.env
# Edit .env with your DATABASE_URL, NEXTAUTH_SECRET, etc.

cd packages/web
npx prisma db push
npx prisma db seed

# Run the dashboard
cd ../..
npm run dev        # starts Next.js on localhost:3000

# Run tests
npm test           # all packages
npm run test:sdk   # SDK only
npm run test:web   # web only

# Stripe webhooks (local)
npm run stripe:listen --workspace=packages/web
```

## Project Structure

```
watchtower/
  packages/
    sdk/              # @watchtower/sdk - client wrapper + event batching
      src/
        watchtower.ts   # WatchTower class with wrap() method
        wrappers/       # OpenAI and Anthropic client wrappers
        batcher.ts      # Event batching with configurable flush
        transport.ts    # HTTP transport to WatchTower API
    web/              # @watchtower/web - Next.js dashboard
      src/
        app/
          (dashboard)/  # Overview, agent detail, conversations, alerts
          api/v1/       # REST + SSE endpoints for events, metrics, flags
        lib/
          scoring/      # Two-layer quality scoring pipeline
          alert-check.ts # Alert evaluation and email dispatch
      prisma/
        schema.prisma   # PostgreSQL schema (agents, events, flags, alerts)
```

## Need monitoring for your AI agents?

I help teams ship observable, production-grade AI systems. [Work with me ->](https://cal.com/spencerstiles)
