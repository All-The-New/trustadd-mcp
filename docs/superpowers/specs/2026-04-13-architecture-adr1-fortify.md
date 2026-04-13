# ADR-1: Fortify the Foundation

**Status:** Proposed
**Date:** 2026-04-13
**Deciders:** Project owner
**Supersedes:** None
**Related:** ADR-2 (Modular Monolith — Phase 2 target)

---

## Context

TrustAdd has grown from a solo-dev prototype to a production system serving trust intelligence across 9 EVM chains via an x402 micropayment API. The architecture is fundamentally sound — Vercel serverless for API, Trigger.dev for background jobs, Supabase PostgreSQL for persistence, and a well-designed two-tier API model.

However, the codebase was built for speed-to-market, and several structural gaps will become blockers at growth scale (2-5 developers, thousands of API calls/day):

1. **No test infrastructure** — zero tests exist. Refactoring and feature development carry unquantifiable risk.
2. **God files** — `routes.ts` (1,734 LOC) and `storage.ts` (2,546 LOC) contain all domain logic. Every feature touches these files, causing constant merge conflicts with multiple developers.
3. **Broken rate limiting** — the in-memory rate limiter on Vercel serverless resets per cold start, providing inconsistent enforcement.
4. **No versioned migrations** — `drizzle-kit push` is used instead of migration files, making schema changes unreviewable in PRs.
5. **Stale architecture docs** — `indexer-architecture.md` references a Replit Reserved VM deployment that no longer exists.

These are not architectural flaws — they're growth-stage gaps. The system works today. The question is whether it can support parallel development and increased load without regressions.

---

## Decision

**Fortify the existing architecture before restructuring.** Address the 5 gaps above in priority order. Do not introduce new infrastructure (Redis, event buses, domain folders) until the foundation is solid.

The rationale: you cannot safely restructure without tests. Every other improvement depends on this. A well-tested monolith beats a poorly-tested modular monolith.

---

## Priority Stack

### P0: Test Infrastructure

**What:** Add Vitest + test database configuration. Write tests for the highest-risk code paths.

**Scope:**

| Test Suite | Files | What It Validates |
|-----------|-------|-------------------|
| Trust score calculation | `trust-score.test.ts` | Known agent profiles → expected scores. Edge cases: null fields, zero events, max scores. |
| Verdict logic | `verdict-logic.test.ts` | Score + tier + flags → correct verdict. Precedence: UNTRUSTED overrides CAUTION. UNKNOWN for null scores. |
| Report compilation | `report-compiler.test.ts` | Report structure matches Trust Data Product spec. Cache TTL enforcement. Address resolution (contract, controller, payment). |
| Free tier redaction | `free-tier.test.ts` | `redactAgentForPublic()` strips all 6 protected fields. `verdict` and `reportAvailable` are injected. No score leakage in any free endpoint. |
| x402 gate enforcement | `paid-tier.test.ts` | Gated endpoints return 402 without payment. Payment header validation. Correct pricing per endpoint. |
| Agent queries | `agent-queries.test.ts` | Pagination, search, filters, sorting. Edge cases: empty results, max page size enforcement. |

**Config:**
```
vitest.config.ts          — workspace config
__tests__/                — test directory at project root
  setup.ts                — test DB connection, seed data
  fixtures/               — known agent profiles for deterministic testing
```

**Test DB options (pick one):**
- **Supabase branch database** — requires Supabase Pro plan ($25/mo). Closest to production. Recommended if plan is active.
- **Local PostgreSQL via Docker** — free, fast, runs in CI. Use `docker-compose.test.yml` with the same schema. Recommended for CI pipelines.
- **In-memory mocking** — for pure logic tests (verdict, scoring) that don't need a real DB. Use for the fastest feedback loop.

### P1: Split God Files

**What:** Break `routes.ts` and `storage.ts` into smaller files organized by URL prefix / table group.

**routes.ts (1,734 LOC) → 5 files:**

| File | URL Prefix | Approx LOC |
|------|-----------|------------|
| `routes/trust.ts` | `/api/v1/trust/*` | ~200 |
| `routes/agents.ts` | `/api/agents/*`, `/api/stats` | ~300 |
| `routes/analytics.ts` | `/api/analytics/*`, `/api/economy/*`, `/api/bazaar/*`, `/api/skills/*`, `/api/quality/*`, `/api/community-feedback/*` | ~500 |
| `routes/admin.ts` | `/api/admin/*` | ~400 |
| `routes/status.ts` | `/api/status/*`, `/api/events/*`, `/api/chains`, `/api/health` | ~200 |

Each file exports a `register(app: Express)` function. `routes.ts` becomes a thin orchestrator that imports and calls all 5.

**storage.ts (2,546 LOC) → 4 files:**

| File | Tables | Approx LOC |
|------|--------|------------|
| `storage/agents.ts` | `agents`, `agent_metadata_events` | ~600 |
| `storage/indexer.ts` | `indexer_state`, `indexer_events`, `indexer_metrics` | ~500 |
| `storage/feedback.ts` | `community_feedback_sources`, `community_feedback_items`, `community_feedback_summaries` | ~400 |
| `storage/analytics.ts` | `x402_probes`, `agent_transactions`, `transaction_sync_state`, `bazaar_services`, `bazaar_snapshots`, `trust_reports` | ~800 |

The `IStorage` interface stays in `storage.ts` as the public contract. Implementation delegates to the 4 sub-files.

**Key constraint:** No behavioral changes. Pure file-splitting refactor. Run tests (from P0) before and after to confirm.

### P1: Fix Rate Limiting

**What:** Remove the in-memory rate limiter from `routes.ts`. Keep only the DB-backed rate limiter.

**Current state:**
- `routes.ts` lines 72-80: in-memory `Map<string, { count, resetAt }>`
- `api/[...path].ts`: DB-backed rate limiter (authoritative)
- Both run independently — the in-memory one resets per cold start

**Action:**
1. Delete the in-memory `rateLimitBuckets` Map and `checkRateLimit()` function from `routes.ts`
2. Remove all `checkRateLimit()` calls from route handlers
3. Verify DB-backed rate limiter in `api/[...path].ts` covers all rate-limited endpoints
4. Add `X-RateLimit-*` headers to DB-backed limiter responses for client visibility

**If DB-backed latency becomes measurable (>50ms per check):** Add Upstash Redis. Free tier: 10K commands/day. Drop-in replacement for the DB-backed store.

### P2: Versioned Migrations

**What:** Switch from `drizzle-kit push` to `drizzle-kit generate` + committed migration SQL files.

**Workflow:**
1. Run `drizzle-kit generate` → creates `drizzle/XXXX_migration_name.sql`
2. Commit migration file in PR → reviewable schema change
3. Apply via Supabase MCP `apply_migration` tool or CI pipeline
4. Remove `drizzle-kit push` from any scripts/docs

**Note:** Since `trustadd_app` DB user doesn't own tables, DDL must run via Supabase SQL editor or MCP. Migration files serve as the reviewable record; application is manual or via MCP.

### P2: Update Stale Docs

**What:** Update `docs/indexer-architecture.md` to reflect current deployment reality.

**Changes:**
- Section 1.1: Replace Replit Reserved VM references with Vercel serverless + Trigger.dev
- Section 1.2: Update startup timeline for Trigger.dev cron-based execution (not self-scheduling timers)
- Section 7.2: Update DB pool config for Supabase transaction-mode pooler (max: 2, not max: 8)
- Add note: local dev uses `server/index.ts` with in-process indexers; production uses Trigger.dev tasks

---

## Options Considered

### Option A: Fortify First, Then Restructure (Selected)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — no new abstractions, just splitting and testing |
| Risk | Low — pure refactoring with test safety net |
| Collaboration payoff | High — smaller files = fewer merge conflicts |
| Time to impact | 1-2 weeks for P0+P1 |

**Pros:** Immediately improves developer experience. Tests enable all future changes. No new infrastructure.
**Cons:** Doesn't solve domain boundary problem (deferred to ADR-2).

### Option B: Jump to Modular Monolith

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — new directory structure, module interfaces, import rewiring |
| Risk | High — restructuring without tests means regressions are likely |
| Collaboration payoff | Higher long-term, but short-term disruption |
| Time to impact | 3-4 weeks |

**Pros:** Solves the domain boundary problem immediately.
**Cons:** Without tests, the restructuring itself becomes a source of bugs. Multiple devs can't work during the restructure.

### Option C: Add Infrastructure (Redis, Event Bus, Read Replicas)

| Dimension | Assessment |
|-----------|------------|
| Complexity | High — new services, new failure modes, new billing |
| Risk | Medium — well-understood technologies, but operational overhead |
| Collaboration payoff | Low — infrastructure doesn't help with code organization |
| Time to impact | 2-3 weeks per service |

**Pros:** Solves specific scaling concerns (caching, rate limiting, read load).
**Cons:** Premature. Current load doesn't justify the operational cost. Adds complexity without addressing the collaboration and safety gaps.

---

## Trade-off Analysis

The core trade-off is **speed vs completeness**. Option A gets the most impactful improvements shipped fastest. Option B is the right destination but requires Option A as a prerequisite. Option C solves problems that don't exist yet at current scale.

The in-memory rate limiter is a real bug — it provides false confidence that rate limiting works when it doesn't across instances. This is the only item that qualifies as a defect rather than a gap.

---

## Consequences

**What becomes easier:**
- Multiple developers can work on different route groups without conflicts
- Schema changes become reviewable in PRs
- Trust scoring logic has regression protection
- Rate limiting actually works consistently

**What becomes harder:**
- Nothing significant. These are purely additive improvements.

**What we'll need to revisit:**
- After fortification, execute ADR-2 (Modular Monolith) to establish formal domain boundaries
- Monitor DB-backed rate limiter latency; add Upstash Redis if it exceeds 50ms
- Evaluate Sentry for Express error handler (currently only in Trigger.dev)

---

## Action Items

1. [ ] Set up Vitest + test DB configuration
2. [ ] Write trust score + verdict logic tests (P0)
3. [ ] Write free tier redaction + x402 gate tests (P0)
4. [ ] Split `routes.ts` into 5 domain route files (P1)
5. [ ] Split `storage.ts` into 4 domain query files (P1)
6. [ ] Remove in-memory rate limiter, verify DB-backed limiter coverage (P1)
7. [ ] Switch to `drizzle-kit generate` for migration files (P2)
8. [ ] Update `indexer-architecture.md` for current deployment model (P2)
9. [ ] Add Sentry to Express error handler (P2)
