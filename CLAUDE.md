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
| Background Jobs | **Trigger.dev** | 10 tasks in `trigger/` directory (7 scheduled + 2 child tasks + 1 alert helper) |
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
- **Testing**: Vitest with 184 tests in `__tests__/` — trust scoring, verdict logic, free tier redaction, confidence, sybil detection. Run `npm test`. Architecture assessment in `docs/superpowers/specs/2026-04-13-architecture-adr1-fortify.md` (all 9 items complete)

## Important Files

- `shared/schema.ts` — All 12 database tables, insert schemas, and TypeScript types
- `shared/chains.ts` — Multi-chain configuration (9 EVM chains, RPC URLs, contract addresses)
- `server/storage.ts` — Database abstraction layer (IStorage interface + thin DatabaseStorage delegator, ~340 lines)
- `server/storage/agents.ts` — Agent CRUD, events, analytics, quality, skills, protocol queries (~1600 lines)
- `server/storage/indexer.ts` — Indexer state, events, metrics queries (~130 lines)
- `server/storage/feedback.ts` — Community feedback queries (~130 lines)
- `server/storage/analytics.ts` — Probes, transactions, bazaar, status queries (~560 lines)
- `server/routes.ts` — Route orchestrator (~20 lines) — calls 5 domain route files
- `server/routes/helpers.ts` — Shared route utilities (verdictFor, redactAgentForPublic, cached, parseChainId)
- `server/routes/status.ts` — Status, health, chains, sitemap routes
- `server/routes/agents.ts` — Agent CRUD, trust-scores, per-agent feedback routes
- `server/routes/analytics.ts` — Analytics, economy, skills, bazaar, quality routes
- `server/routes/admin.ts` — Admin routes (auth, sync, usage, dashboard, audit)
- `server/routes/trust.ts` — Trust Data Product API v1 (x402-gated)
- `server/index.ts` — Local dev entry point (starts Vite HMR + background services)
- `server/db.ts` — Lazy PostgreSQL pool + Drizzle setup (Supabase pooler compatible)
- `api/[...path].ts` — Vercel serverless catch-all (wraps Express app)
- `api/agent/[id].ts` — SSR meta tag injection for agent pages (SEO: serves index.html with per-agent title, description, OG tags, canonical, JSON-LD)
- `api/health.ts` — Standalone health check with DB connection test
- `server/lib/request-logger.ts` — Fire-and-forget API request logging middleware (path normalization, 90-day stochastic cleanup)
- `trigger/` — 10 Trigger.dev tasks: `blockchain-indexer` (orchestrator, */2 cron) → `chain-indexer` (per-chain child, 2 cycles + 90s checkpointed wait), `community-feedback` (orchestrator, daily 4am) → `community-scrape` (per-platform child), `transaction-indexer`, `x402-prober`, `recalculate-scores` (scores + sybil dampening + slugs + classification + report recompilation), `watchdog`, `bazaar-indexer`, + `alert` helper
- `server/trust-score.ts` — Trust scoring engine (17-signal explainability, provenance hash, confidence integration)
- `server/trust-provenance.ts` — Signal provenance hashing (SHA-256 of canonical scoring inputs, METHODOLOGY_VERSION)
- `server/trust-confidence.ts` — Confidence level computation (source coverage weighting, consistency flags)
- `server/trust-methodology.ts` — Public methodology definition (scoring rubric as JSON)
- `server/pipeline-health.ts` — Pipeline health tracking with circuit breakers (dynamic imports for Trigger.dev compat)
- `server/trust-report-compiler.ts` — Trust report compiler v2 (verdict logic, provenance, confidence, sybil, address resolution, cache)
- `server/sybil-detection.ts` — Sybil detection module (4 signal detectors, risk scoring, dampening multiplier, SQL prefetcher)
- `server/lib/x402-gate.ts` — x402 payment middleware for Trust Data Product (CDP facilitator on Base)
- `docs/trust-product.md` — Trust Data Product specification (tiers, pricing, verdict logic, payment flow)
- `docs/api-tiering.md` — API tiering architecture: free ecosystem analytics vs x402-gated trust intelligence
- `docs/trust-api.yaml` — OpenAPI 3.1 spec for Trust API v1 endpoints
- `script/sync-trigger-env.ts` — Env var sync script for Trigger.dev (manual run)
- `server/lib/admin-auth.ts` — Cookie-based admin auth (HMAC tokens, IP whitelist, session middleware)
- `client/src/components/admin-layout.tsx` — Admin shell with nav, session guard, logout
- `client/src/pages/admin/*.tsx` — 6 admin pages: login, dashboard, usage, status-details, tasks, audit-log
- `vercel.json` — Vercel routing and build configuration
- `client/src/lib/content-zones.ts` — Centralized copy for all public pages (all marketing/positioning text)
- `client/src/pages/trust-api.tsx` — Trust API product page (pricing, live demo, x402 flow, integration guide)
- `client/src/pages/methodology.tsx` — Scoring methodology page (5 categories, weights, signals, verdict thresholds, data sources)
- `client/src/pages/principles.tsx` — Design principles page (10 principles distilled from trust oracle research)
- `client/src/App.tsx` — React routing (21 pages: 15 public + 6 admin)

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
