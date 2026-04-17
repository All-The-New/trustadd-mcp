# TrustAdd — Bootstrap Guide

## Project Overview

TrustAdd is a public, neutral, multi-protocol, multi-chain trust rating platform for AI agents on EVM blockchains. It indexes identity, reputation, and on-chain signals from multiple protocols (ERC-8004, x402, OASF, MCP, A2A) across 9 EVM chains into transparent, verifiable trust scores (0-100).

The platform serves both human consumers (via rich profiles and dashboards) and machine consumers (via a free public REST API and paid Trust Data Product API), aiming to become the industry standard for AI agent trust ratings.

**Live site:** https://trustadd.com

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.3 + TypeScript, Vite 7, Tailwind CSS 3, Shadcn UI (Radix), wouter 3 (routing), TanStack Query v5 |
| Backend | Express.js 5, Node.js 20+ |
| Database | PostgreSQL 15 + Drizzle ORM (hosted on Supabase, project `agfyfdhvgekekliujoxc`, us-east-2) |
| Blockchain | ethers.js v6, viem 2, multi-chain EVM (9 chains) |
| Payments | @coinbase/x402 2.x — HTTP 402 payment protocol on Base (USDC, gasless via CDP facilitator) |
| Background Jobs | Trigger.dev v4 (13 tasks in `trigger/`, project `proj_nabhtdcabmsfzbmlifqh`) |
| Analytics | Vercel Web Analytics + custom `api_request_log` table |
| Error Tracking | Sentry (`@sentry/node`) via `trigger.config.ts` `onFailure` hook |
| Build | Vite (frontend), esbuild (backend via `script/build.ts`) |
| Runtime | `tsx` for development, compiled CJS for production |
| Hosting | Vercel (frontend SPA + API serverless), Cloudflare DNS |

---

## Deployment Architecture

```
Browser
  │
  ▼
Cloudflare DNS (trustadd.com → Vercel)
  │
  ▼
Vercel (Edge Network)
  ├── Static SPA (dist/public) ← vite build
  ├── /api/* → serverless function (api/[...path].ts) ← wraps Express app
  ├── /api/health → api/health.ts (standalone)
  ├── /api/agent/:id → api/agent/[id].ts (SSR meta injection)
  └── /sitemap-agents.xml → api/[...path].ts
  │
  ▼
Supabase PostgreSQL (transaction-mode pooler, port 6543)
  │
Trigger.dev (scheduled background jobs, auto-deployed on push to main)
  └── 13 tasks: indexers, probers, recalculate, watchdog, feedback
```

**Critical:** Cloudflare DNS must stay **DNS-only (grey cloud)**. Orange cloud proxy breaks Vercel's SSL (525 error).

---

## Directory Structure

```
trustadd/
├── api/                         # Vercel serverless handlers
│   ├── [...path].ts             # Catch-all → wraps Express app
│   ├── agent/[id].ts            # SSR meta tag injection (OG, JSON-LD, canonical)
│   └── health.ts                # Standalone health check with DB ping
├── client/                      # React frontend (Vite SPA)
│   ├── src/
│   │   ├── App.tsx              # 22 routes (16 public + 6 admin)
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── pages/               # 16 public pages + 6 admin pages
│   │   │   ├── landing.tsx            # /
│   │   │   ├── directory.tsx          # /agents
│   │   │   ├── agent-profile.tsx      # /agent/:id (shell, 6 sub-components)
│   │   │   ├── analytics.tsx          # /analytics
│   │   │   ├── skills.tsx             # /skills
│   │   │   ├── economy.tsx            # /economy
│   │   │   ├── protocols.tsx          # /protocols
│   │   │   ├── status.tsx             # /status
│   │   │   ├── api-docs.tsx           # /api-docs
│   │   │   ├── quality.tsx            # /quality
│   │   │   ├── about.tsx              # /about
│   │   │   ├── trust-api.tsx          # /trust-api
│   │   │   ├── methodology.tsx        # /methodology
│   │   │   ├── principles.tsx         # /principles
│   │   │   ├── bazaar.tsx             # /bazaar
│   │   │   ├── mpp.tsx                # /mpp (feature-flagged: VITE_ENABLE_MPP_UI)
│   │   │   ├── not-found.tsx          # 404 catch-all
│   │   │   └── admin/                 # 6 admin pages (session-guarded)
│   │   │       ├── login.tsx          # /admin/login
│   │   │       ├── dashboard.tsx      # /admin
│   │   │       ├── usage.tsx          # /admin/usage
│   │   │       ├── status-details.tsx # /admin/status
│   │   │       ├── tasks.tsx          # /admin/tasks
│   │   │       └── audit-log.tsx      # /admin/audit-log
│   │   ├── agent-profile/       # 6 profile sub-components
│   │   │   ├── banner.tsx
│   │   │   ├── overview-tab.tsx
│   │   │   ├── score-tab.tsx
│   │   │   ├── on-chain-tab.tsx
│   │   │   ├── community-tab.tsx
│   │   │   └── history-tab.tsx
│   │   ├── components/          # Shadcn UI + custom components
│   │   ├── hooks/               # use-toast, use-mobile
│   │   └── lib/                 # verdict.ts, content-zones.ts, address-color.ts, queryClient.ts, utils.ts
│   └── index.html
├── server/                      # Express backend
│   ├── index.ts                 # Entry: Express setup, Vite HMR, request logging
│   ├── routes.ts                # Route orchestrator (calls 6 domain route files)
│   ├── db.ts                    # Lazy PostgreSQL pool + Drizzle setup (Proxy pattern)
│   ├── storage.ts               # IStorage interface + DatabaseStorage delegator (~384 lines)
│   ├── storage/                 # Domain storage modules
│   │   ├── agents.ts            # Agent CRUD, events, analytics, quality, skills, protocol queries (~1900 lines)
│   │   ├── analytics.ts         # Probes, transactions, bazaar, status queries (~560 lines)
│   │   ├── feedback.ts          # Community feedback queries (~130 lines)
│   │   ├── indexer.ts           # Indexer state, events, metrics queries (~130 lines)
│   │   └── mpp.ts               # MPP directory, probes, Tempo transactions (~280 lines)
│   ├── routes/                  # Domain route modules
│   │   ├── agents.ts            # Agent list/search, trust scores, feedback routes
│   │   ├── analytics.ts         # Economy, skills, bazaar, quality analytics
│   │   ├── status.ts            # Status, health, chains, sitemap
│   │   ├── trust.ts             # Trust Data Product API v1 (x402-gated)
│   │   ├── admin.ts             # Admin auth, sync, scoring, usage, audit
│   │   ├── mpp.ts               # MPP directory, probes, Tempo stats
│   │   └── helpers.ts           # Shared: verdictFor(), redactAgentForPublic(), cached(), parseChainId()
│   ├── lib/                     # Shared server utilities
│   │   ├── admin-auth.ts        # Cookie-based HMAC auth, IP whitelist
│   │   ├── admin-audit.ts       # Admin action audit trail logging
│   │   ├── x402-gate.ts         # x402 payment middleware (CDP facilitator on Base)
│   │   ├── request-logger.ts    # Fire-and-forget API logging, 90-day stochastic cleanup
│   │   ├── request-context.ts   # Request context tracking (request ID, user IP)
│   │   ├── rate-limiter.ts      # Sliding-window rate limiting (100/min public, 2/hr admin)
│   │   ├── indexer-utils.ts     # Retry logic, concurrency control, RPC fallback
│   │   ├── time-budget.ts       # Time budget tracking for Trigger.dev tasks
│   │   ├── log.ts               # Centralized logging setup
│   │   └── logger.ts            # Logger instance
│   ├── trust-score.ts           # Pure scoring engine (5 categories, 21 signals, 0-100)
│   ├── trust-score-pipeline.ts  # DB orchestration: prefetchers, batch updates, recalc entry points
│   ├── trust-categories.ts      # deriveCategoryStrengths() → public {identity, behavioral, community, attestation, authenticity}
│   ├── trust-confidence.ts      # Confidence level computation (6 sources, consistency flags)
│   ├── trust-provenance.ts      # Signal provenance hashing (SHA-256, METHODOLOGY_VERSION=2)
│   ├── trust-verifications.ts   # 9-layer verifications (pure function, does NOT affect score)
│   ├── trust-report-compiler.ts # Trust report compiler v4 (5-tier verdict, category strengths, provenance, confidence)
│   ├── trust-methodology.ts     # Public methodology JSON (5-tier thresholds, v2 changelog)
│   ├── sybil-detection.ts       # 4 signal detectors, risk scoring 0-1, dampening multiplier, SQL prefetcher
│   ├── quality-classifier.ts    # Quality tier: high/medium/low/spam/archived/unclassified
│   ├── slugs.ts                 # SEO-friendly URL slug generation
│   ├── alerts.ts                # Indexer health monitoring, circuit breaker triggers
│   ├── pipeline-health.ts       # Pipeline health circuit breakers (dynamic imports for Trigger.dev compat)
│   ├── anchor.ts                # Merkle root publishing on Base (fire-and-forget helper)
│   ├── indexer.ts               # ERC-8004 blockchain event indexer (~1900 lines)
│   ├── x402-prober.ts           # HTTP 402 endpoint prober — detects x402 support, extracts addresses
│   ├── transaction-indexer.ts   # Multi-token transfer tracker via Alchemy (USDC, USDT, DAI, WETH, ETH)
│   ├── tempo-transaction-indexer.ts # Tempo chain pathUSD transfer indexing
│   ├── mpp-prober.ts            # MPP endpoint prober — Payment Required header detection
│   ├── mpp-directory.ts         # MPP directory discovery and indexing
│   ├── bazaar-classify.ts       # x402 Bazaar service classification
│   ├── known-reputation-sources.ts  # Reputation oracle mapping (future use)
│   ├── community-feedback/      # Social signal scraping system
│   │   ├── index.ts             # Module entry, source coordination
│   │   ├── scheduler.ts         # Scrape scheduling and batching
│   │   ├── source-discovery.ts  # GitHub/Farcaster source auto-discovery
│   │   ├── types.ts             # Type definitions
│   │   └── adapters/
│   │       ├── github.ts        # GitHub API adapter (repo stats, issues, contributors)
│   │       └── farcaster.ts     # Farcaster adapter via Neynar (followers, casts, engagement)
│   ├── vite.ts                  # Dev-mode Vite middleware (HMR)
│   ├── static.ts                # Production static file serving (SPA catch-all)
│   └── seed.ts                  # Test data seeding for local development
├── shared/                      # Code shared between frontend and backend
│   ├── schema.ts                # 16 Drizzle tables + insert schemas + TypeScript types
│   ├── mpp-schema.ts            # 3 MPP tables (mppDirectoryServices, mppProbes, mppDirectorySnapshots)
│   └── chains.ts                # 9 EVM chains + Tempo L1 config (RPC URLs, contract addresses, colors)
├── trigger/                     # Trigger.dev scheduled tasks (13 tasks + 1 helper)
│   ├── blockchain-indexer.ts    # Orchestrator, */2 cron → dispatches chain-indexer children
│   ├── chain-indexer.ts         # Child: per-chain ERC-8004 indexer (2 cycles + 90s wait)
│   ├── community-feedback.ts    # Orchestrator, daily 4am → dispatches community-scrape children
│   ├── community-feedback-scraper.ts # Child: per-platform GitHub/Farcaster scraper
│   ├── transaction-indexer.ts   # Every 6h: multi-token transfer tracking via Alchemy
│   ├── tempo-transaction-indexer.ts  # Every 6h: Tempo chain pathUSD indexing
│   ├── x402-prober.ts           # Daily 3am: HTTP 402 endpoint probing
│   ├── mpp-prober.ts            # Daily 3:30am: MPP Payment Required detection
│   ├── mpp-directory-indexer.ts # Daily 4:30am: MPP directory discovery
│   ├── bazaar-indexer.ts        # Every 6h: x402 Bazaar marketplace indexing
│   ├── recalculate.ts           # Daily 5am: trust scores, sybil dampening, slugs, classification, report recompile
│   ├── anchor-scores.ts         # Child: Merkle root publish on Base (fire-and-forget)
│   ├── watchdog.ts              # Every 15min: indexer health + circuit breakers + alerts
│   └── alert.ts                 # Helper function: failure alert delivery to webhook
├── __tests__/                   # Test suites
│   ├── trust-score.test.ts      # Trust scoring engine
│   ├── verdict-logic.test.ts    # 5-tier verdict logic
│   ├── verifications.test.ts    # 9-layer verification system
│   ├── sybil-detection.test.ts  # Sybil risk detection
│   ├── confidence.test.ts       # Confidence computation
│   ├── free-tier.test.ts        # Free-tier redaction
│   ├── quality-classifier.test.ts  # Quality tier assignment
│   ├── category-strengths.test.ts  # Category strength derivation
│   ├── mpp-directory.test.ts    # MPP directory discovery
│   ├── mpp-auth-header.test.ts  # MPP auth header parsing
│   ├── mpp-storage.test.ts      # MPP storage operations
│   ├── tempo-log-decoder.test.ts   # Tempo log decoding
│   └── browser/                 # jsdom browser component tests
│       ├── trust-stamp.browser.test.tsx
│       ├── verification-chips.browser.test.tsx
│       └── score-rail.browser.test.tsx
├── docs/                        # Architecture and planning documents
├── migrations/                  # Database migration SQL files
├── scripts/                     # Operational scripts (sync-prod-to-dev, classify-agents, etc.)
├── script/
│   ├── build.ts                 # Production build (esbuild backend + Vite frontend)
│   └── sync-trigger-env.ts      # Trigger.dev env var sync utility
├── contracts/                   # Smart contract files
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── vite.config.ts
├── vitest.config.ts             # Node tests (294 tests across 12 suites)
├── vitest.browser.config.ts     # Browser tests (20 tests across 3 suites)
├── drizzle.config.ts
├── trigger.config.ts            # Trigger.dev project config (Sentry, pg external, maxDuration 600s)
├── vercel.json                  # Vercel routing (rewrites to api/[...path])
├── components.json              # Shadcn UI configuration
├── bootstrap.md                 # This file
└── CLAUDE.md                    # Claude Code project instructions
```

---

## Database Schema

Defined in `shared/schema.ts` (16 tables) and `shared/mpp-schema.ts` (3 tables):

### Core Tables

| Table | Purpose |
|-------|---------|
| `agents` | Agent identities — ERC-8004 metadata, trust scores, quality tiers, slugs |
| `agent_metadata_events` | On-chain event history (Transfer, AgentURISet, FeedbackPosted) |
| `indexer_state` | Per-chain indexer progress (last processed block) |
| `indexer_events` | Operational indexer activity log |
| `indexer_metrics` | Hourly aggregated indexer performance metrics |
| `community_feedback_sources` | Discovered GitHub repos / Farcaster profiles linked to agents |
| `community_feedback_items` | Scraped items (repo stats, issues, casts) |
| `community_feedback_summaries` | Aggregated community scores per agent |
| `x402_probes` | HTTP 402 endpoint probe results |
| `agent_transactions` | Token transfers (USDC, USDT, DAI, WETH, ETH) to/from payment addresses |
| `transaction_sync_state` | Per-address sync progress for transaction indexer |
| `admin_audit_log` | Admin action audit trail |
| `trust_reports` | Cached compiled trust reports for x402-gated Trust Data Product API (1h TTL, upserted per-agent) |

### Operational Tables

| Table | Purpose |
|-------|---------|
| `alert_deliveries` | Alert deduplication for watchdog task |
| `pipeline_health` | Circuit breaker state per pipeline |
| `rate_limit_entries` | Sliding-window rate limit buckets |
| `api_request_log` | API request analytics (path, latency, status, 90-day retention) |

### Marketplace Tables

| Table | Purpose |
|-------|---------|
| `bazaar_services` | x402 Bazaar service registry |
| `bazaar_snapshots` | Daily Bazaar state snapshots |

### MPP Tables (`shared/mpp-schema.ts`)

| Table | Purpose |
|-------|---------|
| `mpp_directory_services` | MPP service registry (URL, pricing, payment methods) |
| `mpp_directory_snapshots` | Daily directory snapshots |
| `mpp_probes` | Agent MPP endpoint probe results |

**Key relations:** `agent_metadata_events.agent_id → agents.id`, `community_feedback_sources.agent_id → agents.id`, `community_feedback_items.source_id → community_feedback_sources.id`

**Database notes:**
- Supabase project `agfyfdhvgekekliujoxc` (us-east-2), DB user `trustadd_app`
- Must use **transaction-mode pooler** (port 6543), NOT direct connection (port 5432)
- Schema changes: run `npm run db:generate` then apply SQL via Supabase SQL editor (trustadd_app lacks DDL ownership)
- Both `pool` and `db` in `server/db.ts` are lazy Proxies to avoid import-time `DATABASE_URL` check (required for Trigger.dev build)

---

## Environment Variables

### Core Infrastructure
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase transaction-mode pooler, port 6543) |
| `PORT` | HTTP server port (default: 5001) |

### Blockchain & Indexing
| Variable | Description |
|----------|-------------|
| `API_KEY_ALCHEMY` | Alchemy API key — primary RPC + Asset Transfers API for all chains |
| `API_KEY_INFURA` | Infura API key (fallback RPC) |

### Community Feedback
| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub PAT for community feedback scraping (higher rate limits) |
| `API_KEY_NEYNAR` | Neynar API key for Farcaster data (followers, casts) |

### Admin & Security
| Variable | Description |
|----------|-------------|
| `ADMIN_PASSWORD` | Password for `/admin/login` |
| `ADMIN_SECRET` | HMAC signing key for session cookies |
| `ADMIN_WHITELIST_IPS` | Comma-separated IPs for auto-auth bypass |

### Trust Data Product (x402-gated API)
| Variable | Description |
|----------|-------------|
| `CDP_API_KEY_ID` | Coinbase Developer Platform API key ID |
| `CDP_PRIVATE_KEY` | CDP private key (base64-encoded) |
| `TRUST_PRODUCT_PAY_TO` | Treasury wallet address on Base (USDC recipient) |
| `TRUST_PRODUCT_ENABLED` | Set `true` to activate x402 payment gates |

### Error Tracking
| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry DSN — enables error tracking in Trigger.dev tasks |

### MPP Integration (feature-flagged)
| Variable | Description |
|----------|-------------|
| `ENABLE_MPP_UI` | Set `true` to enable `/api/mpp/*` routes |
| `VITE_ENABLE_MPP_UI` | Set `true` to show MPP UI on `/economy` page |
| `TEMPO_RPC_URL` | Tempo chain RPC endpoint |
| `TEMPO_RPC_URL_FALLBACK` | Fallback RPC for Tempo |
| `ENABLE_MPP_INDEXER` | Set `true` to run MPP Trigger.dev tasks |
| `MPP_DIRECTORY_SOURCE` | `auto`, `api`, or `scrape` |

### Trigger.dev Feature Flags
| Variable | Description |
|----------|-------------|
| `ENABLE_TX_INDEXER` | Enable transaction indexer task |
| `ENABLE_PROBER` | Enable x402 prober task |
| `ENABLE_RERESOLVE` | Enable metadata re-resolution in chain-indexer |

### Alerts
| Variable | Description |
|----------|-------------|
| `ALERT_WEBHOOK_URL` | Webhook URL for watchdog/job failure alerts |

**Env var management:** Use Vercel CLI, not dashboard.
```bash
npx vercel env ls
printf 'value' | npx vercel env add VAR_NAME production
```

---

## Build & Run Commands

```bash
# Install dependencies
npm install                        # requires --legacy-peer-deps (set in .npmrc)

# Development (Express + Vite HMR on port 5001)
npm run dev

# Type checking
npm run check

# Production build (esbuild backend + Vite frontend)
npm run build
npm run build:client               # Vite frontend only

# Tests
npm test                           # 294 node tests (vitest)
npm run test:watch                 # Watch mode
npm run test:browser               # 20 browser tests (jsdom)

# Database migrations
npm run db:generate                # Generate Drizzle migration SQL
# Apply via Supabase SQL editor (do NOT use drizzle-kit push — ownership constraint)

# Deploy
npx vercel deploy --prod           # Manual Vercel deploy
# Trigger.dev deploys automatically via GitHub Actions on push to main
```

---

## Background Jobs (Trigger.dev)

All background work runs as Trigger.dev scheduled tasks (auto-deployed on push, no local polling needed). Project ref: `proj_nabhtdcabmsfzbmlifqh`.

**Scheduled Tasks (10):**

| Task | Schedule | Purpose |
|------|----------|---------|
| `blockchain-indexer` | Every 2 min | Orchestrates per-chain ERC-8004 indexing |
| `watchdog` | Every 15 min | Indexer health, circuit breakers, alerts |
| `transaction-indexer` | Every 6h | Multi-token Alchemy transfer indexing |
| `tempo-transaction-indexer` | Every 6h | Tempo chain pathUSD indexing |
| `bazaar-indexer` | Every 6h | x402 Bazaar marketplace indexing |
| `x402-prober` | Daily 3am UTC | HTTP 402 endpoint probing |
| `mpp-prober` | Daily 3:30am UTC | MPP Payment Required detection |
| `community-feedback` | Daily 4am UTC | Orchestrates GitHub/Farcaster scraping |
| `mpp-directory-indexer` | Daily 4:30am UTC | MPP directory discovery |
| `recalculate-scores` | Daily 5am UTC | Scores + sybil dampening + slugs + classification + report recompile |

**Child Tasks (3):** `chain-indexer`, `community-scrape`, `anchor-scores`

**Critical config rules:**
- All task files MUST use dynamic `import()` for `../server/` and `../shared/` modules inside `run` — static top-level imports crash container initialization
- `trigger/` task files and `@trigger.dev/sdk/v3` CAN be imported statically
- `pg` and `viem` must be in `build.external` (esbuild bundles them incorrectly)
- `maxDuration: 600` (10 min) per task
- Sentry integration via `trigger.config.ts` `onFailure` hook

---

## API Routes Summary

Routes are split across 6 domain files under `server/routes/`:

### Public Agent API (`routes/agents.ts`)
- `GET /api/agents` — Paginated agent list with filtering, sorting, search
- `GET /api/agents/:id` — Single agent by ID or slug
- `GET /api/agents/:id/history` — On-chain event timeline
- `GET /api/agents/:id/feedback` — Community feedback
- `GET /api/agents/:id/community-feedback` — GitHub + Farcaster signals
- `GET /api/agents/:id/x402-probes` — x402 probe history
- `GET /api/agents/:id/transactions` — Transaction history

### Analytics & Economy API (`routes/analytics.ts`)
- `GET /api/analytics/*` — Protocol stats, chain distribution, registrations, metadata quality, categories, models, trust-tiers
- `GET /api/economy/*` — Overview, top agents, transactions, endpoint analysis, x402 by chain
- `GET /api/skills/*` — OASF skills overview, top, categories, trust correlation
- `GET /api/trust/*` — Leaderboard, distribution, by-chain
- `GET /api/quality/*` — Summary, offenders, transparency report
- `GET /api/bazaar/*` — Bazaar marketplace stats

### Status & Infrastructure (`routes/status.ts`)
- `GET /api/status/*` — Overview, events, metrics, summary, alerts
- `GET /api/chains` — Supported chains with stats
- `GET /api/stats` — Aggregate statistics
- `GET /api/events/recent` — Recent on-chain events
- `GET /sitemap-agents.xml` — Dynamic XML sitemap (cached 1h)

### MPP API (`routes/mpp.ts`, feature-flagged by `ENABLE_MPP_UI`)
- `GET /api/mpp/directory` — MPP service directory
- `GET /api/mpp/probes` — MPP probe results
- `GET /api/mpp/stats` — MPP statistics
- `GET /api/mpp/tempo/transactions` — Tempo chain transaction data

### Trust Data Product (`routes/trust.ts`, x402-gated)
- `GET /api/v1/trust/:address/exists` — Free existence check (verdict preview + pricing)
- `GET /api/v1/trust/:address` — Quick Check ($0.01 USDC via x402) — score, verdict, flags
- `GET /api/v1/trust/:address/report` — Full Report ($0.05 USDC via x402) — complete evidence

### Admin (`routes/admin.ts`)
- `POST /api/admin/sync` — Prod-to-dev DB sync
- `POST /api/admin/recalculate-scores` — Batch recalculate trust scores
- `POST /api/admin/probe-all` — Trigger x402 probe cycle
- `GET /api/admin/trust-product/stats` — Trust data product usage analytics
- `GET /api/admin/usage` — API request analytics
- `GET /api/admin/audit-log` — Admin action audit trail

### Health
- `GET /api/health` — Health check with DB ping

---

## Trust Score Engine

Five scoring categories (0-100 total):

| Category | Max Points | Key Signals |
|----------|-----------|-------------|
| Identity | 25 | Name, description length, image, endpoints, tags, skills |
| History | 20 | Age in days, update frequency, cross-chain presence |
| Capability | 15 | x402 support, OASF skill count, endpoint coverage |
| Community | 20 | GitHub health, Farcaster engagement, source count |
| Transparency | 20 | URI scheme (IPFS=8/HTTPS=5), protocol support, active status |

**5-Tier Verdict System:**
| Verdict | Score Range | Description |
|---------|-------------|-------------|
| TRUSTED | ≥ 80 | Fully verified, high confidence |
| CAUTION | 50-79 | Established but incomplete signals |
| BUILDING | 20-49 | Active but limited track record |
| UNTRUSTED | 1-19 | Insufficient signals or low quality |
| INSUFFICIENT | null/0 | Not enough data to score |

**Sybil dampening:** Applies a multiplier (0.1-1.0) to reduce scores for agents showing clone indicators (name/image reuse, batch registration, identical metadata).

See `docs/tier-calibration.md` for current threshold rationale and `docs/trust-product.md` for Trust Data Product spec.

---

## Blockchain Configuration

9 EVM chains defined in `shared/chains.ts`. All chains share the same contract addresses:

| Chain | Chain ID |
|-------|----------|
| Ethereum | 1 |
| BNB Chain | 56 |
| Polygon | 137 |
| Optimism | 10 |
| Gnosis | 100 |
| Base | 8453 |
| Celo | 42220 |
| Arbitrum | 42161 |
| Avalanche | 43114 |

**Shared contract addresses:**
- `IDENTITY_REGISTRY`: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- `REPUTATION_REGISTRY`: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

**Tempo L1** (MPP, chain ID 4217): Purpose-built chain for Multi-Protocol Payments, pathUSD token.

---

## Frontend Pages & Routing

22 routes defined in `client/src/App.tsx` using wouter:

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Landing | Hero, top agents, recent activity feed, live stats |
| `/agents` | Directory | Searchable/filterable agent list |
| `/agent/:id` | AgentProfile | Trust breakdown, metadata, 5-tab scaffold |
| `/analytics` | Analytics | Ecosystem charts, 5-tier distribution |
| `/skills` | Skills | OASF capabilities ecosystem |
| `/economy` | Economy | x402 adoption, top earners, Tempo MPP |
| `/protocols` | Protocols | ERC-8004, OASF, x402 educational content |
| `/status` | StatusPage | Indexer health, alerts, per-chain sync |
| `/api-docs` | ApiDocs | Interactive API documentation |
| `/quality` | Quality | Transparency report, quality tiers, spam analysis |
| `/about` | About | About page |
| `/trust-api` | TrustApi | Trust Data Product: pricing, x402 flow, live demo |
| `/methodology` | Methodology | Scoring methodology: 5 categories, 21 signals, distributions |
| `/principles` | Principles | 10 design principles for trust oracle |
| `/bazaar` | Bazaar | x402 Bazaar marketplace dashboard |
| `/mpp` | MppPage | Multi-Protocol Payments page (feature-flagged) |
| `/admin/*` | Admin/* | 6 admin pages: login, dashboard, usage, status, tasks, audit-log |

---

## SEO Setup

- `robots.txt` — In `client/public/`, allows all crawlers
- Static sitemap — `client/public/sitemap.xml` with all page URLs
- Dynamic sitemap — `GET /sitemap-agents.xml` for all non-spam agents (cached 1h)
- Canonical tags — `client/src/components/seo.tsx`
- Social cards — `twitter:card` + `og:image` at `/og-image.png`
- JSON-LD — Agent pages inject `SoftwareApplication` + `AggregateRating` via `api/agent/[id].ts`

---

## Quality Classification

| Tier | Description |
|------|-------------|
| `high` | Complete metadata, active, high engagement |
| `medium` | Mostly complete, some signals missing |
| `low` | Minimal metadata, low activity |
| `spam` | Flags: whitespace_name, blank_uri, spec_uri, code_as_uri, test_agent, duplicate_template |
| `archived` | Previously active, no recent events |
| `unclassified` | Not yet scored |

---

## External Service Dependencies

| Service | Purpose | Required? |
|---------|---------|-----------|
| Supabase PostgreSQL | Production database | Yes |
| Vercel | Frontend hosting + API serverless | Yes |
| Trigger.dev | Background job scheduling | Yes (for indexing) |
| Alchemy | Primary RPC + Asset Transfers API | Yes (for indexing) |
| Coinbase CDP | x402 payment facilitator on Base | Yes (for Trust Product) |
| Infura | Fallback RPC provider | Optional |
| GitHub API | Community feedback (repo stats, issues) | Optional |
| Neynar API | Farcaster data (followers, casts) | Optional |
| Sentry | Error tracking for Trigger.dev tasks | Optional |

---

## Production Deployment

### Vercel (Frontend + API)
- Project linked at `.vercel/project.json`
- Auto-deploys from `main` branch on push
- `vercel.json` configures rewrites: `/api/*` → serverless, `/agent/:id` → SSR, everything else → SPA

### Trigger.dev (Background Jobs)
- Auto-deploys via GitHub Actions (`.github/workflows/`) on push to `trigger/`, `server/`, `shared/`, `package.json`, `package-lock.json`, `.npmrc`, `trigger.config.ts`
- Project ref: `proj_nabhtdcabmsfzbmlifqh`
- `TRIGGER_ACCESS_TOKEN` secret required in GitHub repo settings

### Database Schema Changes
```bash
npm run db:generate    # Generate migration SQL from schema.ts
# Apply via Supabase SQL editor — trustadd_app lacks table ownership for direct apply
```

### Rate Limiting
- Public API: 100 requests/min per IP
- Admin: 2 requests/hour per IP

### Health Check
`GET /api/health` — returns HTTP 200 with DB connection status

---

## Style & Conventions

- TypeScript strict mode throughout
- Path aliases: `@/` → `client/src/` (Vite only), relative `../shared/` in server code
- Shadcn UI components in `client/src/components/ui/`
- TanStack Query v5 for data fetching (object-form only)
- wouter for client-side routing
- Tailwind CSS 3 with dark mode (`class` strategy)
- Inter font, professional blue theme
- Git author: `All The New <admin@allthenew.com>` (required for Vercel Hobby deploys)
- `.npmrc`: `legacy-peer-deps=true` — required for `@sentry/node@10` + Trigger.dev `@opentelemetry/*@^2.0.1` mismatch
- ESM imports in `api/` use `.js` extensions for Vercel serverless compatibility
