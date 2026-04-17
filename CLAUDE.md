# CLAUDE.md — TrustAdd Project Instructions

Read `bootstrap.md` for the complete project documentation including architecture, database schema, environment variables, API routes, and deployment details.

## Quick Start

```bash
npm install
npm run dev                    # Express + Vite HMR on port 5001
```

## Deployment Stack

| Layer | Service | Notes |
|-------|---------|-------|
| Frontend | **Vercel** (static SPA) | React/Vite builds to `dist/public`, served as static files |
| API | **Vercel** (serverless) | Express app wrapped in `api/[...path].ts` catch-all |
| Database | **Supabase** PostgreSQL | Project `agfyfdhvgekekliujoxc` (us-east-2), Drizzle ORM |
| Background Jobs | **Trigger.dev** | 13 tasks in `trigger/` directory (10 scheduled + 3 child tasks) + `alert.ts` helper function |
| Analytics | **Vercel Web Analytics** | `@vercel/analytics/react` in App.tsx, plus custom `api_request_log` table |
| Error Tracking | **Sentry** | OTEL integration via `trigger.config.ts`, captures all task failures |
| DNS/CDN | **Cloudflare** | trustadd.com → Vercel |

## MCP Tooling (use first, before CLI)

All core services have MCP integrations. **Prefer MCP tools over CLI/dashboard** for all operations.

| Service | MCP | Capabilities |
|---------|-----|-------------|
| **Supabase** | Connected | SQL queries, migrations, tables, edge functions, logs, advisors |
| **Vercel** | Connected | Deployments, projects, build logs, runtime logs, domains, toolbar threads |
| **Cloudflare** | Connected | DNS, Workers, KV, R2, D1, Hyperdrive, documentation search |
| **GitHub** | Connected (platform connector) | PRs, issues, actions, releases. Fallback: `gh` CLI (`/opt/homebrew/bin/gh`, auth: `All-The-New`) |
| **Trigger.dev** | Connected (`~/.claude.json`, scoped to `proj_nabhtdcabmsfzbmlifqh`) | Tasks, runs, deployments, docs search, project management |

**Workflow priority**: MCP tool → CLI fallback → dashboard as last resort.

## Key Architecture Decisions

- **Monorepo layout**: `client/` (React), `server/` (Express), `shared/` (schema + types)
- **Vercel serverless API**: Express app runs as a single catch-all serverless function (`api/[...path].ts`)
- **Database-first types**: All types flow from `shared/schema.ts` via Drizzle ORM + drizzle-zod
- **Background services**: Trigger.dev scheduled tasks with per-chain sub-tasks, metadata tracking, and queue concurrency control
- **Multi-chain**: 9 EVM chains share the same contract addresses; chain config in `shared/chains.ts`
- **API tiering**: Free tier = ecosystem analytics + redacted agent directory (verdict badges, no scores). Paid tier (x402) = per-agent trust intelligence (scores, breakdowns, community signals, transactions). See `docs/api-tiering.md`
- **ESM imports**: All relative imports use `.js` extensions for Vercel serverless compatibility
- **Testing**: Vitest with 294 node tests + 20 browser tests in `__tests__/` — trust scoring, verdict logic, free tier redaction, confidence, sybil detection, MPP, Tempo. Run `npm test`. Architecture assessment in `docs/superpowers/specs/2026-04-13-architecture-adr1-fortify.md` (all 9 items complete)

## Important Files

- `shared/schema.ts` — 19 tables: 12 core (agents, events, indexer, feedback, x402, transactions, admin) + 4 operational (alerts, health, rate-limits, api-log) + 2 marketplace (bazaar ×2) + trust_reports cache. Insert schemas and TypeScript types for all.
- `shared/mpp-schema.ts` — 3 MPP tables (mppDirectoryServices, mppProbes, mppDirectorySnapshots) + insert schemas
- `shared/chains.ts` — Multi-chain configuration (9 EVM chains + Tempo L1, RPC URLs, contract addresses)
- `server/storage.ts` — Database abstraction layer (IStorage interface + thin DatabaseStorage delegator, ~384 lines)
- `server/storage/agents.ts` — Agent CRUD, events, analytics, quality, skills, protocol queries (~1900 lines)
- `server/storage/indexer.ts` — Indexer state, events, metrics queries (~130 lines)
- `server/storage/feedback.ts` — Community feedback queries (~130 lines)
- `server/storage/analytics.ts` — Probes, transactions, bazaar, status queries (~560 lines)
- `server/storage/mpp.ts` — MPP directory, probes, Tempo transaction queries (~280 lines)
- `server/routes.ts` — Route orchestrator (~23 lines) — calls 6 domain route files
- `server/routes/helpers.ts` — Shared route utilities (verdictFor, redactAgentForPublic, cached, parseChainId)
- `server/routes/status.ts` — Status, health, chains, sitemap routes
- `server/routes/agents.ts` — Agent CRUD, trust-scores, per-agent feedback routes
- `server/routes/analytics.ts` — Analytics, economy, skills, bazaar, quality routes
- `server/routes/admin.ts` — Admin routes (auth, sync, usage, dashboard, audit)
- `server/routes/trust.ts` — Trust Data Product API v1 (x402-gated)
- `server/routes/mpp.ts` — MPP directory, probes, Tempo stats routes (feature-flagged: ENABLE_MPP_UI)
- `server/index.ts` — Local dev entry point (starts Vite HMR + background services)
- `server/db.ts` — Lazy PostgreSQL pool + Drizzle setup (Supabase pooler compatible)
- `api/[...path].ts` — Vercel serverless catch-all (wraps Express app)
- `api/agent/[id].ts` — SSR meta tag injection for agent pages (SEO: serves index.html with per-agent title, description, OG tags, canonical, JSON-LD)
- `api/health.ts` — Standalone health check with DB connection test
- `server/lib/request-logger.ts` — Fire-and-forget API request logging middleware (path normalization, 90-day stochastic cleanup)
- `server/lib/request-context.ts` — Request context tracking (request ID, user IP)
- `server/lib/admin-audit.ts` — Admin action audit trail logging
- `server/lib/time-budget.ts` — Time budget tracking for Trigger.dev tasks
- `server/tempo-transaction-indexer.ts` — Tempo chain pathUSD transfer indexing logic
- `server/mpp-prober.ts` — MPP endpoint prober (Payment Required header detection)
- `server/mpp-directory.ts` — MPP directory discovery and indexing
- `server/bazaar-classify.ts` — x402 Bazaar service classification
- `server/anchor.ts` — Merkle root publishing on Base (fire-and-forget helper)
- `trigger/` — 13 Trigger.dev tasks: `blockchain-indexer` (orchestrator, */2 cron) → `chain-indexer` (per-chain child, 2 cycles + 90s checkpointed wait), `community-feedback` (orchestrator, daily 4am) → `community-scrape` (per-platform child), `transaction-indexer` (every 6h), `tempo-transaction-indexer` (every 6h), `x402-prober` (daily 3am), `mpp-prober` (daily 3:30am), `mpp-directory-indexer` (daily 4:30am), `bazaar-indexer` (every 6h), `recalculate-scores` (daily 5am: scores + sybil dampening + slugs + classification + report recompilation) → `anchor-scores` (Merkle root publish on Base, fire-and-forget child), `watchdog` (every 15min), + `alert.ts` helper function
- `server/trust-score.ts` — Trust scoring engine (5 categories, 21 signals, centralized thresholds, pure — no DB imports)
- `server/trust-score-pipeline.ts` — DB orchestration: prefetchers, batch updates, recalc entry points (splits pipeline from pure scorer)
- `server/trust-categories.ts` — `deriveCategoryStrengths()` — maps internal 5-category breakdown + sybilRiskScore to public `{identity, behavioral, community, attestation, authenticity}` qualitative tiers
- `server/trust-verifications.ts` — 9-verifications Layer 2 (Multi-Chain, x402 Enabled, GitHub/Farcaster Connected, IPFS, OASF, Early Adopter, Active Maintainer, First Transaction) — pure function, does NOT affect score
- `server/trust-provenance.ts` — Signal provenance hashing (SHA-256 of canonical scoring inputs, METHODOLOGY_VERSION=2)
- `server/trust-confidence.ts` — Confidence level computation (6 sources weighted to sum 1.0, consistency flags)
- `server/trust-methodology.ts` — Public methodology JSON (5-tier verdictThresholds, v2 changelog)
- `server/pipeline-health.ts` — Pipeline health tracking with circuit breakers (dynamic imports for Trigger.dev compat)
- `server/trust-report-compiler.ts` — Trust report compiler v4 (5-tier `computeVerdict`, two-layer shape, `categoryStrengths` field, provenance, confidence, sybil dampening)
- `server/sybil-detection.ts` — Sybil detection module (4 signal detectors, risk scoring 0-1, dampening multiplier, SQL prefetcher)
- `server/lib/x402-gate.ts` — x402 payment middleware for Trust Data Product (CDP facilitator on Base)
- `docs/trust-product.md` — Trust Data Product specification (tiers, pricing, verdict logic, payment flow)
- `docs/api-tiering.md` — API tiering architecture: free ecosystem analytics vs x402-gated trust intelligence
- `docs/trust-api.yaml` — OpenAPI 3.1 spec for Trust API v1 endpoints
- `docs/tier-calibration.md` — Current verdict thresholds, rationale for temporary BUILDING floor=20, conditions for re-raising, full change checklist
- `docs/smoke-checklist-methodology-v2.md` — Pre-deploy smoke checklist for methodology v2 surfaces
- `script/sync-trigger-env.ts` — Env var sync script for Trigger.dev (manual run)
- `server/lib/admin-auth.ts` — Cookie-based admin auth (HMAC tokens, IP whitelist, session middleware)
- `client/src/components/admin-layout.tsx` — Admin shell with nav, session guard, logout
- `client/src/pages/admin/*.tsx` — 6 admin pages: login, dashboard, usage, status-details, tasks, audit-log
- `vercel.json` — Vercel routing and build configuration
- `client/src/lib/content-zones.ts` — Centralized copy for all public pages (marketing, pillars, METHODOLOGY categories, verdict list)
- `client/src/lib/verdict.ts` — Single source of truth for 5-tier `VerdictDescriptor` (color, icon, label, shortLabel, score range). Imported by every stamp/badge/strip
- `client/src/lib/address-color.ts` — `addressToColor()` + `addressToGradientPair()` shared helpers
- `client/src/components/trust-stamp.tsx` — `<TrustStamp />` 3 sizes (hero 340×101 / square 64×64 / chip 32px-tall), null-score renders INSUFFICIENT + `—`
- `client/src/components/verification-chips.tsx` — Priority-ordered chip row with pure `computeVisibleCount()` + useLayoutEffect ResizeObserver overflow
- `client/src/components/score-rail.tsx` — Segmented-bar gauge with floating chip (segment widths: 4/16/40/20/20 — reflects current BUILDING floor=20)
- `client/src/components/category-bars.tsx` — 5 qualitative bars (Identity/Behavioral/Community/Attestation/Authenticity) driven by `categoryStrengths`
- `client/src/components/zone-card.tsx` — Wrapper enforcing earned/populated/empty states with 3px left-border + status-tag
- `client/src/components/chain-badge.tsx` — Chain badge with `short` variant (`⬡ 5c`) and `extraChainCount` prop
- `client/src/pages/agent-profile.tsx` — Agent profile shell: banner + 5-tab scaffold (split into `agent-profile/` subdirectory)
- `client/src/pages/agent-profile/` — 6 component files: `banner.tsx`, `overview-tab.tsx`, `score-tab.tsx`, `on-chain-tab.tsx`, `community-tab.tsx`, `history-tab.tsx`
- `client/src/pages/trust-api.tsx` — Trust API product page (5-tier verdict, pricing, live demo with mini stamp, x402 flow, JSON examples, integration guide)
- `client/src/pages/methodology.tsx` — Scoring methodology page (5 categories, 21 signals, 5-tier table, data sources, new `<EcosystemDistribution />` section)
- `client/src/pages/analytics.tsx` — Analytics dashboard (includes 5-tier strip + 10-bucket histogram driven by `/api/analytics/trust-tiers`)
- `client/src/pages/principles.tsx` — Design principles page (10 principles distilled from trust oracle research)
- `client/src/pages/bazaar.tsx` — Bazaar marketplace dashboard (/bazaar)
- `client/src/pages/mpp.tsx` — Multi-Protocol Payments page (/mpp, feature-flagged: VITE_ENABLE_MPP_UI)
- `client/src/App.tsx` — React routing (22 routes: 16 public + 6 admin)
- `vitest.config.ts` — Node-env test suite (294 tests: trust scoring, verdict, sybil, confidence, category-strengths, free-tier, provenance, MPP, Tempo, …)
- `vitest.browser.config.ts` — jsdom-env test suite for `__tests__/browser/*.browser.test.tsx` (20 tests: TrustStamp, VerificationChips, ScoreRail). Run via `npm run test:browser`

## Required Environment Variables

Managed via Vercel CLI (project is linked at `.vercel/project.json`):

```bash
# View current env vars
npx vercel env ls

# Update a value (e.g. DATABASE_URL)
npx vercel env rm DATABASE_URL production --yes
printf 'postgresql://...' | npx vercel env add DATABASE_URL production

# Then redeploy
npx vercel deploy --prod
```

Key variables:
```
DATABASE_URL=postgresql://trustadd_app.agfyfdhvgekekliujoxc:...@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```
- Must use **transaction-mode pooler** (port 6543), NOT direct connection (port 5432)
- DB user is `trustadd_app` (not `postgres`) — has full privileges on all tables
- Supabase project: `agfyfdhvgekekliujoxc` (us-east-2)

Admin-specific variables:
```
ADMIN_PASSWORD=<password for /admin/login>
ADMIN_SECRET=<HMAC signing key for session cookies>
ADMIN_WHITELIST_IPS=<comma-separated IPs for auto-auth bypass>
```

See `bootstrap.md` for the full list of environment variables including API keys and feature flags.

## Build & Deploy

```bash
# Local development
npm run dev                      # Express + Vite HMR on port 5001

# Production (Vercel auto-deploys from main branch on push)
npx vercel deploy --prod         # Manual deploy if needed

# Trigger.dev jobs (auto-deploy via GitHub Actions on push to trigger/, server/, shared/)
# Manual deploy not available locally (no Docker) — use GitHub Actions or workflow_dispatch

# Schema changes — must use Supabase SQL directly (trustadd_app doesn't own tables)
# Schema changes: run `npm run db:generate` to create migration SQL, then apply via Supabase MCP/SQL editor
```

## Critical Infrastructure Notes

- **Cloudflare DNS**: Must be set to **DNS-only (grey cloud)** — orange cloud proxy causes SSL 525 with Vercel
- **Vercel Deployment Protection**: Must remain **OFF** — enabling it breaks API calls from the frontend AND the SSR function's self-fetch of `index.html`
- **`server/db.ts`**: Both `pool` and `db` are lazy Proxies — this is intentional. Prevents `DATABASE_URL` check at import time (required for Trigger.dev build container indexing)
- **Trigger.dev config**: `trigger.config.ts` must use `export default defineConfig(...)`, include `maxDuration`, and list `pg` in `build.external` (esbuild bundles pg incorrectly without it, causing silent DB connection failures). Sentry integration via `@sentry/node` with `onFailure` hook. Project ref: `proj_nabhtdcabmsfzbmlifqh`
- **`.npmrc`**: `legacy-peer-deps=true` required — `@sentry/node@10` has peerOptional deps on `@opentelemetry/*@^2.1.0` but Trigger.dev pins `@2.0.1`. Without this, `npm ci` fails on CI.
- **Trigger.dev task imports**: ALL task files MUST use dynamic `import()` for `../server/` and `../shared/` modules inside the `run` function — static top-level imports crash during container module initialization. `@trigger.dev/sdk/v3` and other `trigger/*.ts` task files CAN be imported statically (e.g., `blockchain-indexer.ts` imports `chain-indexer.ts` for `batchTriggerAndWait`).
- **Trigger.dev env vars**: Set in dashboard (Settings > Environment Variables > Production). Feature flags (`ENABLE_TX_INDEXER`, `ENABLE_PROBER`, `ENABLE_RERESOLVE`) must be lowercase `true`. `SENTRY_DSN` enables error tracking.
- **GitHub Actions**: `TRIGGER_ACCESS_TOKEN` secret (PAT starting with `tr_pat_`) must be set in repo for auto-deploy workflow to function. Workflow also deploys to preview environment on PRs.
- **Trigger.dev deploy paths**: Workflow triggers on changes to `trigger/`, `trigger.config.ts`, `server/`, `shared/`, `package.json`, `package-lock.json`, `.npmrc`, and the workflow file itself.
- **Admin queryFn pattern**: The default TanStack Query `queryFn` joins `queryKey` array elements with `/`, so `["/api/foo", "?bar=1"]` becomes `/api/foo/?bar=1`. Admin pages with URL params MUST use a custom `queryFn` with direct `fetch()` calls instead of relying on the default.

## Style & Conventions

- TypeScript strict mode throughout
- Path aliases: `@/` → `client/src/` (Vite only), relative `../shared/` in server code
- Shadcn UI components in `client/src/components/ui/`
- TanStack Query v5 for data fetching (object-form only)
- wouter for client-side routing
- Tailwind CSS 3 with dark mode (`class` strategy)
- Inter font, professional blue theme
- Git author: `All The New <admin@allthenew.com>` (required for Vercel Hobby deploys)

## MPP Integration (launched 2026-04-16, Path A)

**Current state:** FULLY LIVE. Indexer + UI both live as of 2026-04-17. PR #4 (`e82a691`) + runbook Steps 7–8 completed.

**Flags in production (as of 2026-04-17):**

| Flag | Scope | Value | Meaning |
|---|---|---|---|
| `ENABLE_MPP_INDEXER` | Trigger.dev prod | `true` | 3 MPP tasks run on schedule |
| `ENABLE_MPP_UI` | Vercel prod | `true` | `/api/mpp/*` routes live |
| `VITE_ENABLE_MPP_UI` | Vercel prod | `true` | `/mpp` page + `/economy` MPP card + header nav visible |
| `TEMPO_RPC_URL` | Vercel + Trigger.dev prod | `https://rpc.tempo.xyz` | Primary Tempo RPC |
| `TEMPO_RPC_URL_FALLBACK` | Trigger.dev prod | (same as primary; no real fallback yet) | Swap to QuickNode/Chainstack when provisioned |
| `MPP_DIRECTORY_SOURCE` | Vercel prod | `api` | Uses `mpp.dev/api/services` JSON endpoint |
| `MPP_DIRECTORY_SOURCE` | Trigger.dev prod | `auto` (→ api) | **Manual update needed in dashboard** → set to `api` |
| `TEMPO_PATHUSD_DEPLOYMENT_BLOCK` | Trigger.dev prod | `5172409` | First pathUSD Transfer at this block (resolved 2026-04-16) |
| `TEMPO_TRANSFER_WITH_MEMO_TOPIC` | Trigger.dev prod | unset | Memo decoding deferred for launch |

**Directory scraper resolved:** `mpp.dev/services` is JS-rendered (Waku). `mpp.dev/api/services` returns structured JSON. Switched `MPP_DIRECTORY_SOURCE=api` on Vercel. Trigger.dev still uses `auto` (which also resolves to API source via `createDirectorySource`). Confirm by running `mpp-directory-indexer` one-shot after 24h and checking `mpp_directory_services` row count.

**Pipeline tasks (all deployed in `v20260416.3`):**
- `mpp-prober` — daily 3:30 AM UTC
- `mpp-directory-indexer` — daily 4:30 AM UTC
- `tempo-transaction-indexer` — every 6 hours

**Scoring integration:** Path A — Methodology v2 ships with **MPP invisible to scoring**. MPP data accumulates in the backend for 4-6 weeks; v3 integrates MPP signals (cross-protocol presence, pathUSD volume, Tempo longevity). See `docs/roadmap-mpp.md` for the full v3 plan + external integration roadmap (Stripe API, Tempo block explorer, Bitquery/GraphQL).

**Smoke-test inspection queries:**

```sql
SELECT 'services' AS tbl, COUNT(*) FROM mpp_directory_services
UNION ALL SELECT 'snapshots', COUNT(*) FROM mpp_directory_snapshots
UNION ALL SELECT 'probes', COUNT(*) FROM mpp_probes
UNION ALL SELECT 'tempo_sync_state', COUNT(*) FROM transaction_sync_state WHERE chain_id = 4217
UNION ALL SELECT 'tempo_txs', COUNT(*) FROM agent_transactions WHERE chain_id = 4217;
```

See:
- `docs/superpowers/runbooks/2026-04-16-mpp-launch.md` — step-by-step launch operator runbook
- `docs/superpowers/plans/2026-04-16-mpp-launch.md` — launch implementation plan (20 tasks)
- `docs/superpowers/specs/2026-04-15-mpp-integration-design.md` — original design spec
- `docs/superpowers/plans/2026-04-15-mpp-integration.md` — Phase 1+2 build plan
- `docs/roadmap-mpp.md` — Path A decision + v3 integration roadmap
