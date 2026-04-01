# CLAUDE.md — TrustAdd Project Instructions

Read `bootstrap.md` for the complete project documentation including architecture, database schema, environment variables, API routes, and deployment details.

## Quick Start

```bash
npm install
npm run dev                    # Express + Vite HMR on port 5000
```

## Deployment Stack

| Layer | Service | Notes |
|-------|---------|-------|
| Frontend | **Vercel** (static SPA) | React/Vite builds to `dist/public`, served as static files |
| API | **Vercel** (serverless) | Express app wrapped in `api/[...path].ts` catch-all |
| Database | **Supabase** PostgreSQL | Project `agfyfdhvgekekliujoxc` (us-east-2), Drizzle ORM |
| Background Jobs | **Trigger.dev** | 5 scheduled tasks in `trigger/` directory |
| DNS/CDN | **Cloudflare** | trustadd.com → Vercel |

## Key Architecture Decisions

- **Monorepo layout**: `client/` (React), `server/` (Express), `shared/` (schema + types)
- **Vercel serverless API**: Express app runs as a single catch-all serverless function (`api/[...path].ts`)
- **Database-first types**: All types flow from `shared/schema.ts` via Drizzle ORM + drizzle-zod
- **Background services**: Migrated to Trigger.dev scheduled tasks (not in-process)
- **Multi-chain**: 5 EVM chains share the same contract addresses; chain config in `shared/chains.ts`
- **ESM imports**: All relative imports use `.js` extensions for Vercel serverless compatibility

## Important Files

- `shared/schema.ts` — All 11 database tables, insert schemas, and TypeScript types
- `shared/chains.ts` — Multi-chain configuration (5 EVM chains, RPC URLs, contract addresses)
- `server/storage.ts` — Database abstraction layer (IStorage interface, ~2300 lines)
- `server/routes.ts` — All API endpoints (~900 lines)
- `server/index.ts` — Local dev entry point (starts Vite HMR + background services)
- `server/db.ts` — Lazy PostgreSQL pool + Drizzle setup (Supabase pooler compatible)
- `api/[...path].ts` — Vercel serverless catch-all (wraps Express app)
- `api/health.ts` — Standalone health check with DB connection test
- `trigger/` — 5 Trigger.dev background job definitions
- `vercel.json` — Vercel routing and build configuration
- `client/src/App.tsx` — React routing (12 pages)

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

See `bootstrap.md` for the full list of environment variables including API keys and feature flags.

## Build & Deploy

```bash
# Local development
npm run dev                      # Express + Vite HMR on port 5000

# Production (Vercel auto-deploys from main branch on push)
npx vercel deploy --prod         # Manual deploy if needed

# Trigger.dev jobs (auto-deploy via GitHub Actions on push to trigger/ or server/)
npx trigger.dev@4.4.3 deploy --local-build   # Manual deploy from local machine
# Note: --local-build required locally (depot.dev has network timeout); GitHub Actions uses default

# Schema changes — must use Supabase SQL directly (trustadd_app doesn't own tables)
# drizzle-kit push will fail; run DDL in Supabase SQL editor instead
```

## Critical Infrastructure Notes

- **Cloudflare DNS**: Must be set to **DNS-only (grey cloud)** — orange cloud proxy causes SSL 525 with Vercel
- **Vercel Deployment Protection**: Must remain **OFF** — enabling it breaks API calls from the frontend
- **`server/db.ts`**: Both `pool` and `db` are lazy Proxies — this is intentional. Prevents `DATABASE_URL` check at import time (required for Trigger.dev build container indexing)
- **Trigger.dev config**: `trigger.config.ts` must include `maxDuration` (v4 requirement). Project ref: `proj_nabhtdcabmsfzbmlifqh`
- **GitHub Actions**: `TRIGGER_ACCESS_TOKEN` secret must be set in repo for auto-deploy workflow to function (v4 CLI requires this env var name)

## Style & Conventions

- TypeScript strict mode throughout
- Path aliases: `@/` → `client/src/` (Vite only), relative `../shared/` in server code
- Shadcn UI components in `client/src/components/ui/`
- TanStack Query v5 for data fetching (object-form only)
- wouter for client-side routing
- Tailwind CSS 3 with dark mode (`class` strategy)
- Inter font, professional blue theme
- Git author: `All The New <admin@allthenew.com>` (required for Vercel Hobby deploys)
