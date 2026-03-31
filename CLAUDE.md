# CLAUDE.md — TrustAdd Project Instructions

Read `bootstrap.md` for the complete project documentation including architecture, database schema, environment variables, API routes, and deployment details.

## Quick Start

```bash
npm install
npx drizzle-kit push          # sync schema to PostgreSQL
npm run dev                    # Express + Vite HMR on port 5000
```

## Key Architecture Decisions

- **Monorepo layout**: `client/` (React), `server/` (Express), `shared/` (schema + types)
- **Single-process server**: Express serves both API and frontend (Vite in dev, static files in prod)
- **Database-first types**: All types flow from `shared/schema.ts` via Drizzle ORM + drizzle-zod
- **Background services**: Blockchain indexer, x402 prober, transaction indexer, and community feedback scraper all run as in-process scheduled tasks (not separate workers)
- **Multi-chain**: 5 EVM chains share the same contract addresses; chain config in `shared/chains.ts`
- **Feature flags**: Background services controlled by env vars (`ENABLE_INDEXER`, `ENABLE_PROBER`, `ENABLE_TX_INDEXER`, `ENABLE_RERESOLVE`)

## Important Files

- `shared/schema.ts` — All 11 database tables, insert schemas, and TypeScript types
- `shared/chains.ts` — Multi-chain configuration (5 EVM chains, RPC URLs, contract addresses)
- `server/storage.ts` — Database abstraction layer (IStorage interface, ~2300 lines)
- `server/routes.ts` — All API endpoints (~900 lines)
- `server/index.ts` — Server entry point and startup orchestration
- `server/indexer.ts` — Blockchain indexer (~1100 lines)
- `server/trust-score.ts` — Trust score calculation (5 categories, 0-100)
- `client/src/App.tsx` — React routing (12 pages)

## Required Environment Variables

```
DATABASE_URL=postgresql://...    # PostgreSQL connection string
PORT=5000                        # Server port
```

See `bootstrap.md` for the full list of 12 environment variables including API keys and feature flags.

## Build & Deploy

```bash
npm run build                    # esbuild (server) + Vite (frontend)
npx drizzle-kit push             # sync DB schema
NODE_ENV=production node dist/index.cjs
```

## Style & Conventions

- TypeScript strict mode throughout
- Path aliases: `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`
- Shadcn UI components in `client/src/components/ui/`
- TanStack Query v5 for data fetching (object-form only)
- wouter for client-side routing
- Tailwind CSS 3 with dark mode (`class` strategy)
- Inter font, professional blue theme
