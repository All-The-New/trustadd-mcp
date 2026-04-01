# CLAUDE.md — TrustAdd Project Instructions

Read `bootstrap.md` for the complete project documentation including architecture, database schema, environment variables, API routes, and deployment details.

## Quick Start

```bash
npm install
npx drizzle-kit push          # sync schema to PostgreSQL
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

Set in **Vercel Dashboard > Project Settings > Environment Variables**:

```
DATABASE_URL=postgresql://...    # Supabase transaction-mode pooler (port 6543)
```

See `bootstrap.md` for the full list of 12 environment variables including API keys and feature flags.

## Build & Deploy

```bash
# Local development
npm run dev                      # Express + Vite HMR on port 5000

# Production (Vercel auto-deploys from main branch)
# Frontend: npm run build:client (Vite → dist/public)
# API: Vercel compiles api/*.ts as serverless functions
# Schema: npx drizzle-kit push (run manually when schema changes)
```

## Style & Conventions

- TypeScript strict mode throughout
- Path aliases: `@/` → `client/src/` (Vite only), relative `../shared/` in server code
- Shadcn UI components in `client/src/components/ui/`
- TanStack Query v5 for data fetching (object-form only)
- wouter for client-side routing
- Tailwind CSS 3 with dark mode (`class` strategy)
- Inter font, professional blue theme
- Git author: `All The New <admin@allthenew.com>` (required for Vercel Hobby deploys)
