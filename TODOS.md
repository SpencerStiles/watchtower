# WatchTower — TODOs

Tracked items from the CEO plan review (2026-03-15).

## P1 — Must do before production

### Add streaming support to SDK
- **What:** Intercept `stream:true` calls, buffer chunks, reconstruct full response for scoring, yield chunks to caller.
- **Why:** Most production LLM calls use streaming. Without this, the majority of calls go unmonitored.
- **Current state:** SDK throws on `stream:true` (2A decision — makes gap visible instead of silent).
- **Effort:** L
- **Depends on:** Nothing

### Add data retention policy
- **What:** Add `retainPayloads` boolean to Agent config (default true). Scheduled job deletes event request/response bodies older than 30 days.
- **Why:** Full LLM payloads stored in DB contain PII and grow unbounded. Compliance risk + storage cost.
- **Effort:** S
- **Depends on:** Deployment infrastructure (needs cron/scheduled job support)

## P2 — Should do soon after launch

### Add API key rotation
- **What:** Allow developers to generate a new key while keeping the old key active for a 24h grace period.
- **Why:** If a key is compromised, there's currently no way to rotate without creating a new agent and losing history.
- **Effort:** M
- **Depends on:** Nothing

### Migrate in-memory state to Redis
- **What:** Move rate limiter, SSE connection registry, and alert dedup map to Redis.
- **Why:** Current in-memory state resets on every deploy and blocks horizontal scaling.
- **Effort:** M
- **Depends on:** Redis infrastructure provisioning

### Add shared types package
- **What:** Create `@watchtower/shared` package with `EventPayload` and other types shared between SDK and web.
- **Why:** Currently duplicated between packages. Will drift as features are added.
- **Effort:** S
- **Depends on:** Nothing

### Add usage-based billing / event counting
- **What:** Track event count per organization per billing period. Enforce tier limits (Starter: 50k, Pro: 500k).
- **Why:** Pricing tiers are defined but not enforced. Any user on Starter can ingest unlimited events.
- **Effort:** M
- **Depends on:** Nothing

## P3 — Future

### Multi-provider SDK support
- **What:** Add wrappers for Google Gemini, Mistral, Cohere, and other LLM providers.
- **Why:** Expands addressable market beyond OpenAI/Anthropic users.
- **Effort:** M per provider
- **Depends on:** Shared types package (P2) for cleaner wrapper architecture
