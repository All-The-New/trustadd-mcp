# ADR-2: Modular Monolith — Domain-Driven Architecture

**Status:** Proposed (execute after ADR-1 complete)
**Date:** 2026-04-13
**Deciders:** Project owner
**Depends on:** ADR-1 (Fortify the Foundation)

---

## Context

After ADR-1 fortifies the codebase with tests, smaller files, and working rate limiting, the next growth-scale challenge is establishing formal domain boundaries. As the team grows to 3-5 developers, each person needs to understand which code they own, what interfaces they can depend on, and what invariants they must not break.

The current flat `server/` directory has no organizational signal. A new developer looking at `storage.ts`, `routes.ts`, `indexer.ts`, `trust-score.ts`, `x402-prober.ts`, `transaction-indexer.ts`, `alerts.ts`, and `community-feedback/` cannot quickly understand which files relate to which product concern.

### Dependency Analysis (Validated)

A full import trace of the codebase confirms:

**Cleanly separable (zero circular deps, pure storage abstraction):**
- Indexing domain (indexer + transaction-indexer + x402-prober) — uses only `storage.*`
- Community Intelligence (adapters + scheduler) — uses only `storage.*`
- Alerts (health monitoring) — uses only `storage.*` + `db`

**Must stay together (shared DB access pattern):**
- Trust Engine (trust-score.ts + trust-report-compiler.ts) — both access DB directly for batch operations

**Orchestration layer (cannot isolate, bridges all domains):**
- API Gateway (routes) — imports from all domains

**Critical isolation requirement:**
- Indexing Pipeline must not share a failure domain with the Trust Engine
- Currently: `indexer.ts` calls `recalculateScore()` and `classifyAgent()` inline
- This means an indexer error during scoring can crash the indexing cycle
- Solution: remove inline scoring from the indexer; rely on the daily Trigger.dev cron

---

## Decision

Restructure `server/` into 6 domain modules, each with its own routes, storage queries, and public API. Maintain a single deployable unit (monolith) — no microservices, no event buses, no new infrastructure.

---

## Target Architecture

### Directory Structure

```
server/
├── domains/
│   ├── trust/                    # Trust Engine (scoring + reports + verdicts)
│   │   ├── routes.ts             # /api/v1/trust/* endpoints
│   │   ├── storage.ts            # trust_reports queries, report cache management
│   │   ├── score-calculator.ts   # 5-factor trust score computation
│   │   ├── quality-classifier.ts # Quality tier assignment (high/medium/low/spam)
│   │   ├── report-compiler.ts    # Full report compilation, address resolution
│   │   ├── verdict.ts            # Verdict logic (TRUSTED/CAUTION/UNTRUSTED/UNKNOWN)
│   │   ├── types.ts              # Domain-specific types (QuickCheckData, FullReportData, Verdict)
│   │   └── index.ts              # Public API: { computeVerdict, getOrCompileReport, ... }
│   │
│   ├── indexing/                  # Blockchain + Transaction Indexing Pipeline
│   │   ├── routes.ts             # /api/status/*, /api/chains, /api/events/*
│   │   ├── storage.ts            # indexer_state, indexer_events, indexer_metrics queries
│   │   ├── erc8004-indexer.ts    # Multi-chain ERC-8004 contract event indexer
│   │   ├── transaction-indexer.ts# Alchemy asset transfer sync
│   │   ├── x402-prober.ts        # HTTP 402 endpoint discovery
│   │   ├── alerts.ts             # Indexer health monitoring + delivery
│   │   ├── types.ts              # IndexerConfig, ChainState, ProbeResult
│   │   └── index.ts              # Public API: { startIndexer, stopIndexer, probeAllAgents, ... }
│   │
│   ├── community/                # Community Intelligence (off-chain signals)
│   │   ├── routes.ts             # /api/community-feedback/*
│   │   ├── storage.ts            # feedback sources, items, summaries queries
│   │   ├── adapters/
│   │   │   ├── github.ts         # GitHub API adapter (stars, forks, commits, issues)
│   │   │   └── farcaster.ts      # Neynar/Farcaster adapter (casts, followers, engagement)
│   │   ├── scheduler.ts          # Source discovery + scrape scheduling
│   │   ├── types.ts              # FeedbackSource, FeedbackItem, AdapterResult
│   │   └── index.ts              # Public API: { discoverAllSources, getCommunityStats, ... }
│   │
│   ├── agents/                   # Agent Directory + Registry
│   │   ├── routes.ts             # /api/agents/*, /api/stats
│   │   ├── storage.ts            # Agent CRUD, search, pagination, redaction
│   │   ├── redaction.ts          # Free tier field stripping (redactAgentForPublic)
│   │   ├── types.ts              # AgentQueryOptions, PaginatedAgents
│   │   └── index.ts              # Public API: { getAgents, getAgent, redactAgentForPublic, ... }
│   │
│   ├── analytics/                # Ecosystem Analytics + Economy + Bazaar + Skills
│   │   ├── routes.ts             # /api/analytics/*, /api/economy/*, /api/bazaar/*, /api/skills/*, /api/quality/*
│   │   ├── storage.ts            # Aggregate queries, bazaar queries, economy queries
│   │   ├── types.ts              # AnalyticsOverview, EconomyStats, BazaarService
│   │   └── index.ts              # Public API: { getAnalyticsOverview, getBazaarStats, ... }
│   │
│   └── admin/                    # Admin Console
│       ├── routes.ts             # /api/admin/*
│       ├── auth.ts               # Cookie-based session (DB-backed after ADR-1)
│       ├── audit.ts              # Audit logging middleware
│       ├── types.ts              # AdminSession, AuditEntry
│       └── index.ts              # Public API: { requireAdminSession, handleAdminLogin, ... }
│
├── lib/                          # Cross-cutting utilities (shared across domains)
│   ├── x402-gate.ts              # x402 payment middleware factory
│   ├── rate-limiter.ts           # DB-backed rate limiting
│   ├── request-logger.ts         # API request logging (fire-and-forget)
│   ├── request-context.ts        # AsyncLocalStorage request context
│   ├── logger.ts                 # Structured JSON logger
│   ├── indexer-utils.ts          # Retry, concurrency, backoff utilities
│   └── log.ts                    # Legacy log function (deprecate gradually)
│
├── db.ts                         # Shared DB pool + Drizzle instance (lazy proxy)
├── index.ts                      # App bootstrap, middleware, startup orchestration
└── router.ts                     # NEW: imports all domain route registrars, mounts them
```

### Module Boundary Rules

**Rule 1: Domains import only through `index.ts`**
```typescript
// CORRECT — import through public API
import { computeVerdict } from "../trust/index.js";

// WRONG — import internal file directly
import { computeVerdict } from "../trust/verdict.js";
```

**Rule 2: Domains can import from `shared/` and `server/lib/` freely**
```typescript
// CORRECT — shared schema and cross-cutting utilities
import { agents } from "../../shared/schema.js";
import { createLogger } from "../lib/logger.js";
```

**Rule 3: Cross-domain data access goes through exported functions, not direct DB queries**
```typescript
// CORRECT — trust domain asks community domain for data
import { getCommunityFeedbackSummary } from "../community/index.js";

// WRONG — trust domain queries community tables directly
import { communityFeedbackSummaries } from "../../shared/schema.js";
const summary = await db.select().from(communityFeedbackSummaries)...;
```

**Rule 4: No circular dependencies between domains**

If Domain A needs data from Domain B and Domain B needs data from Domain A, extract the shared concern into `shared/` or `server/lib/`.

### Domain Communication Map

```
                    ┌──────────────┐
                    │ API Gateway  │  (router.ts — mounts all domain routes)
                    │              │
                    └──┬───┬───┬──┘
                       │   │   │
         ┌─────────────┼───┼───┼─────────────────────────┐
         │             │   │   │                          │
    ┌────▼───┐   ┌─────▼──┐│ ┌─▼──────────┐   ┌─────────▼──┐
    │ Trust  │   │ Agents ││ │ Analytics  │   │   Admin    │
    │ Engine │   │ Dir.   ││ │ + Bazaar   │   │  Console   │
    └───┬────┘   └────────┘│ └────────────┘   └────────────┘
        │                  │
        │ reads            │
        ▼                  │
    ┌────────────┐   ┌─────▼──────┐
    │ Community  │   │  Indexing   │
    │ Intel      │   │  Pipeline  │
    └────────────┘   └────────────┘

    Arrows = reads via public API (index.ts exports)
    No circular dependencies
    Trust reads from Community (feedback summaries for reports)
    Trust reads from Agents (agent data for reports)
    Analytics reads from all domains (aggregate queries)
```

### Indexing ↔ Trust Decoupling

**Current (tight coupling):**
```
indexer discovers agent → calls recalculateScore() → calls classifyAgent() → blocks indexer
```

**After restructure:**
```
indexer discovers agent → writes to agents table → returns immediately
Trigger.dev cron (daily 5 UTC) → calls trust/score-calculator.ensureScoresCalculated()
```

The inline `recalculateScore()` and `classifyAgent()` calls are removed from `erc8004-indexer.ts`. The daily cron handles all scoring. For real-time scoring needs, a `POST /api/admin/recalculate/:agentId` endpoint triggers on-demand recalculation.

**Failure isolation:**
- Indexing crash → Trust Engine continues serving cached reports (1-hour TTL)
- Trust Engine crash → Indexing continues discovering agents (scores will be stale until next cron)
- Community Intel crash → Trust reports serve with stale community data (graceful degradation)

---

## Migration Plan

### Phase 1: Create domain directories (1 day)

1. Create `server/domains/` directory structure
2. Move files to their domain directories (rename only, no logic changes)
3. Update all import paths
4. Run full test suite (from ADR-1) to confirm zero regressions

### Phase 2: Extract public APIs (2-3 days)

1. Create `index.ts` for each domain — export only the functions other domains need
2. Update cross-domain imports to go through `index.ts`
3. Remove direct DB access from `trust-report-compiler.ts` where it queries community/transaction tables (~15 direct queries). Replace with calls to `community/index.ts` and `agents/index.ts` exports. This is the largest single-file change in the migration.
4. Run full test suite after each domain extraction

### Phase 3: Remove inline scoring from indexer (1 day)

1. Remove `recalculateScore()` and `classifyAgent()` calls from `erc8004-indexer.ts`
2. Verify Trigger.dev `recalculate-scores` cron covers all scoring needs
3. Add `POST /api/admin/recalculate/:agentId` for on-demand recalculation
4. Run indexer tests + trust scoring tests

### Phase 4: Create router.ts (half day)

1. Create `server/router.ts` that imports all domain route registrars
2. Each domain's `routes.ts` exports `register(app: Express)`
3. `server/index.ts` calls `router.registerAll(app)` instead of the monolithic `registerRoutes()`

---

## Options Considered

### Option A: Modular Monolith with Domain Directories (Selected)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — new directory structure, import rewiring |
| Risk | Low — with ADR-1 tests in place, refactoring is safe |
| Collaboration payoff | High — clear ownership boundaries, parallel development |
| Future optionality | High — any domain can be promoted to a service later |

**Pros:** Clean boundaries. Parallel development. Each domain is independently testable. No new infrastructure.
**Cons:** More directories to navigate. Import paths are longer.

### Option B: Service-Oriented Architecture

| Dimension | Assessment |
|-----------|------------|
| Complexity | High — multiple deployments, service discovery, async communication |
| Risk | High — distributed system failure modes, network partitions |
| Collaboration payoff | Highest — complete independence per service |
| Future optionality | N/A — this IS the future state |

**Pros:** Complete domain isolation. Independent scaling per service.
**Cons:** Premature for 2-5 devs and thousands of calls/day. Operational overhead exceeds benefit. Would require event bus, API gateway, distributed tracing.

### Option C: Flat File Split Only (ADR-1 scope)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — just split files, no new structure |
| Risk | Lowest — minimal change |
| Collaboration payoff | Medium — fewer conflicts, but no ownership signals |
| Future optionality | Low — doesn't set up for service extraction |

**Pros:** Fastest. Least disruption.
**Cons:** Doesn't solve the "which files belong to which domain?" problem. Doesn't establish module interfaces. Doesn't decouple indexing from trust.

---

## Trade-off Analysis

The primary trade-off is between **organizational clarity** and **navigation overhead**. Domain directories make ownership explicit and enable parallel development, but they add depth to the file tree. At 2-5 developers, the organizational benefit outweighs the navigation cost.

The indexing-trust decoupling is the highest-value architectural change. Even if the directory restructure is deferred, removing inline scoring from the indexer should be done. It's a targeted, low-risk change that eliminates the primary cross-domain failure coupling.

---

## Consequences

**What becomes easier:**
- Developer onboarding: "you own the community/ domain" is a clear assignment
- Parallel development: changes to trust scoring don't touch indexing files
- Testing: each domain has its own test suite with focused fixtures
- Future service extraction: any domain with a clean `index.ts` API can become a microservice

**What becomes harder:**
- Cross-domain features require understanding multiple module APIs
- Import paths are longer (`../domains/trust/index.js` vs `./trust-score.js`)
- New files need to be placed in the correct domain directory

**What we'll need to revisit:**
- If any domain's storage file exceeds 500 LOC, consider further splitting by table
- If cross-domain calls become a performance bottleneck, consider shared caching layer
- At 10K+ API calls/day, evaluate whether analytics domain should have its own read replica
- At 5+ developers, evaluate whether any domain should become an independent service

---

## Enterprise Platforms to Consider (Future)

These are NOT part of this ADR. They are noted for reference when specific triggers are met.

| Platform | Trigger for Adoption | Purpose |
|----------|---------------------|---------|
| **Upstash Redis** | DB-backed rate limiter latency > 50ms | Drop-in serverless Redis for caching and rate limiting |
| **Supabase Realtime** | Customer request for live trust score updates | WebSocket subscriptions on DB changes |
| **OpenTelemetry** | Customer SLAs requiring p99 latency guarantees | Distributed tracing across API + Trigger.dev |
| **Zod OpenAPI (zod-openapi)** | API contract drift between code and `trust-api.yaml` | Generate OpenAPI spec from route Zod schemas |
| **GitHub Actions CI** | Multiple developers merging to main daily | Run test suite on every PR, block merge on failure |
| **Sentry for Express** | API error rate exceeds 1% | Extend Sentry from Trigger.dev to the Express error handler |

---

## Action Items

1. [ ] Complete ADR-1 (tests + file splits) — prerequisite
2. [ ] Create `server/domains/` directory structure
3. [ ] Move files to domain directories (rename + import path updates)
4. [ ] Create `index.ts` public API for each domain
5. [ ] Remove inline scoring from `erc8004-indexer.ts`
6. [ ] Create `server/router.ts` as the route orchestrator
7. [ ] Update CLAUDE.md "Important Files" section for new paths
8. [ ] Add domain boundary lint rule (optional): no direct imports across domain internals
