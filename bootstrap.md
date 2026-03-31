# TrustAdd — Bootstrap Guide

## Project Overview

TrustAdd is a public, neutral, multi-protocol, multi-chain trust rating platform for AI agents on EVM blockchains. It indexes identity, reputation, and on-chain signals from multiple protocols (ERC-8004, x402, OASF, MCP, A2A) across chains into transparent, verifiable trust scores (0-100).

The platform serves both human consumers (via rich profiles and dashboards) and machine consumers (via a free public REST API), aiming to become the industry standard for AI agent trust ratings.

**Live site:** https://trustadd.com

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS 3, Shadcn UI (Radix), wouter (routing), TanStack Query v5 |
| Backend | Express.js 5, Node.js 20+ |
| Database | PostgreSQL + Drizzle ORM |
| Blockchain | ethers.js v6, multi-chain EVM (Ethereum, Base, Polygon, Arbitrum, BNB Chain) |
| Build | Vite (frontend), esbuild (backend via `script/build.ts`) |
| Runtime | `tsx` for development, compiled CJS for production |

---

## Directory Structure

```
trustadd/
├── client/                  # React frontend
│   ├── src/
│   │   ├── App.tsx          # Root component with routes
│   │   ├── main.tsx         # Entry point
│   │   ├── index.css        # Global styles + Tailwind + CSS variables
│   │   ├── pages/           # 12 page components
│   │   │   ├── landing.tsx        # /
│   │   │   ├── directory.tsx      # /agents
│   │   │   ├── agent-profile.tsx  # /agent/:id
│   │   │   ├── analytics.tsx      # /analytics
│   │   │   ├── skills.tsx         # /skills
│   │   │   ├── economy.tsx        # /economy
│   │   │   ├── protocols.tsx      # /protocols
│   │   │   ├── status.tsx         # /status
│   │   │   ├── api-docs.tsx       # /api-docs
│   │   │   ├── quality.tsx        # /quality
│   │   │   ├── about.tsx          # /about
│   │   │   └── not-found.tsx      # 404
│   │   ├── components/      # Reusable UI components (shadcn + custom)
│   │   ├── hooks/            # Custom React hooks
│   │   └── lib/              # Utilities (queryClient, etc.)
│   ├── public/               # Static assets (favicons, robots.txt, sitemap.xml, og-image.png)
│   └── index.html            # HTML template
├── server/                   # Express backend
│   ├── index.ts              # App entry: Express setup, rate limiting, startup orchestration
│   ├── routes.ts             # All API route handlers (~900 lines)
│   ├── storage.ts            # Database abstraction layer (~2300 lines, IStorage interface)
│   ├── db.ts                 # PostgreSQL pool + Drizzle setup
│   ├── indexer.ts            # ERC-8004 blockchain indexer (~1100 lines)
│   ├── trust-score.ts        # Trust score calculation engine
│   ├── quality-classifier.ts # Quality tier assignment (high/medium/low/spam/archived)
│   ├── slugs.ts              # SEO slug generation
│   ├── alerts.ts             # Indexer health monitoring
│   ├── x402-prober.ts        # HTTP 402 payment endpoint prober
│   ├── transaction-indexer.ts# Multi-token transfer tracker (via Alchemy API)
│   ├── known-reputation-sources.ts # Placeholder for future reputation oracle mapping
│   ├── static.ts             # Production static file serving
│   ├── vite.ts               # Dev-mode Vite middleware (HMR)
│   ├── community-feedback/   # Social signal scraping system
│   │   ├── index.ts          # Module entry
│   │   ├── scheduler.ts      # Scrape scheduling
│   │   ├── source-discovery.ts # Auto-discovery of GitHub/Farcaster sources
│   │   ├── types.ts          # Type definitions
│   │   └── adapters/
│   │       ├── github.ts     # GitHub API adapter
│   │       └── farcaster.ts  # Farcaster (Neynar) adapter
│   └── lib/
│       └── indexer-utils.ts  # Shared utilities (retry, concurrency, logging)
├── shared/                   # Code shared between frontend and backend
│   ├── schema.ts             # Drizzle ORM schema + Zod validators + TypeScript types
│   └── chains.ts             # Multi-chain configuration (5 chains, RPC URLs, contract addresses)
├── scripts/                  # Operational scripts
│   ├── sync-prod-to-dev.ts   # Sync production DB to development
│   ├── classify-agents.ts    # Batch quality classification
│   ├── prod-recalc-scores.ts # Production trust score recalculation
│   ├── health-check.ts       # Health check utility
│   ├── discover-reputation-sources.ts # Reputation source discovery
│   └── post-merge.sh         # Post-merge setup (Replit-specific, can be adapted)
├── script/
│   └── build.ts              # Production build script (esbuild for backend, Vite for frontend)
├── docs/                     # Architecture and planning documents
│   ├── indexer-architecture.md
│   ├── indexer-runbook.md
│   ├── indexer-optimization-log.md
│   ├── v2-feature-roadmap.md
│   ├── off-chain-reputation-plan.md
│   └── ... (more planning docs)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── vite.config.ts
├── drizzle.config.ts
├── components.json           # Shadcn UI configuration
├── COMPETITIVE_ANALYSIS.md
├── bootstrap.md              # This file
└── CLAUDE.md                 # Claude Code project instructions
```

---

## Database Schema

11 tables defined in `shared/schema.ts`:

| Table | Purpose |
|-------|---------|
| `agents` | Core table — ERC-8004 agent identities with metadata, trust scores, quality tiers |
| `agent_metadata_events` | On-chain event history (Transfer, AgentURISet, FeedbackPosted) |
| `indexer_state` | Per-chain indexer progress (last processed block, running status) |
| `indexer_events` | Operational log of indexer activity |
| `indexer_metrics` | Hourly aggregated indexer performance metrics |
| `community_feedback_sources` | Discovered GitHub repos / Farcaster profiles linked to agents |
| `community_feedback_items` | Individual scraped items (repo stats, issues, casts) |
| `community_feedback_summaries` | Aggregated community scores per agent |
| `x402_probes` | Results of HTTP 402 endpoint probing |
| `agent_transactions` | Token transfers (USDC, USDT, DAI, WETH, ETH) to/from agent payment addresses |
| `transaction_sync_state` | Per-address sync progress for transaction indexing |

Key relationships:
- `agent_metadata_events.agent_id` → `agents.id`
- `community_feedback_sources.agent_id` → `agents.id`
- `community_feedback_items.source_id` → `community_feedback_sources.id`
- `x402_probes.agent_id` → `agents.id`
- `agent_transactions.agent_id` → `agents.id`

Use `drizzle-kit push` to sync schema to database (no migration files needed).

---

## Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (production: Neon) |
| `PORT` | HTTP server port (default: 5000) |

### Required for Blockchain Indexing
| Variable | Description |
|----------|-------------|
| `API_KEY_ALCHEMY` | Alchemy API key (primary RPC provider for all chains + transaction indexing) |

### Optional
| Variable | Description |
|----------|-------------|
| `API_KEY_INFURA` | Infura API key (fallback RPC provider) |
| `GITHUB_TOKEN` | GitHub personal access token (community feedback scraping) |
| `API_KEY_NEYNAR` | Neynar API key (Farcaster community feedback) |
| `ADMIN_SECRET` | Secret for admin endpoints (e.g., manual sync trigger) |
| `PROD_DATABASE_URL` | Production DB URL (used for dev-to-prod sync feature) |

### Feature Flags (set to `"true"` to enable)
| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_INDEXER` | Blockchain indexer (polls all enabled chains) | `false` |
| `ENABLE_RERESOLVE` | Metadata re-resolution for agents with incomplete data | `false` |
| `ENABLE_PROBER` | x402 endpoint prober (runs every 24h) | `false` |
| `ENABLE_TX_INDEXER` | Transaction indexer via Alchemy (runs every 6h) | `false` |

---

## Build & Run Commands

```bash
# Install dependencies
npm install

# Development (Express + Vite HMR on port 5000)
npm run dev

# Type checking
npm run check

# Production build (esbuild backend + Vite frontend)
npm run build

# Production start
npm start
# or: NODE_ENV=production node dist/index.cjs

# Push database schema
npx drizzle-kit push
```

---

## Background Services

The server starts multiple background services on boot (controlled by env vars):

1. **Blockchain Indexer** (`ENABLE_INDEXER=true`)
   - Polls 5 EVM chains for ERC-8004 events (Transfer, AgentURISet, FeedbackPosted)
   - Uses Alchemy (primary) + Infura/Ankr/public RPCs (fallbacks)
   - Backfills historical blocks, then polls every 60s with jitter
   - Staggered chain starts (30s apart)

2. **Metadata Re-resolver** (`ENABLE_RERESOLVE=true`)
   - Runs within the indexer cycle
   - Re-fetches metadata URIs for agents with incomplete data (missing tags, skills)
   - Tiered enrichment intervals: high-quality agents every 6h, spam every 30 days

3. **x402 Endpoint Prober** (`ENABLE_PROBER=true`)
   - First run: 7 minutes after startup
   - Probes agent HTTP endpoints for 402 Payment Required responses
   - Extracts payment addresses from headers and response bodies
   - Runs every 24h, retries on failure after 1h

4. **Transaction Indexer** (`ENABLE_TX_INDEXER=true`)
   - First run: 10 minutes after startup
   - Uses Alchemy Asset Transfers API to track USDC, USDT, DAI, WETH, ETH
   - Syncs payment addresses discovered by the prober
   - Runs every 6h, retries on failure after 30min

5. **Community Feedback Scraper** (always runs)
   - Auto-discovers GitHub repos and Farcaster profiles from agent metadata
   - Scrapes repo stats, issues, Farcaster followers/casts
   - Runs on a scheduled interval

6. **Trust Score Calculator** (runs on startup)
   - Ensures all agents have calculated trust scores
   - Batch recalculation if >50% are unscored

7. **Slug Generator** (runs on startup)
   - Ensures all agents have SEO-friendly URL slugs

---

## API Routes Summary

All routes are in `server/routes.ts`:

### Public API
- `GET /api/agents` — Paginated agent list with filtering, sorting, search
- `GET /api/agents/:id` — Single agent by ID or slug
- `GET /api/agents/:id/history` — On-chain event timeline
- `GET /api/agents/:id/feedback` — Enriched feedback (reputation sources + sybil flags)
- `GET /api/agents/:id/community-feedback` — GitHub + Farcaster community signals
- `GET /api/agents/:id/community-feedback/github` — GitHub repo details
- `GET /api/agents/:id/community-feedback/farcaster` — Farcaster profile details
- `GET /api/agents/:id/x402-probes` — x402 probe history
- `GET /api/agents/:id/transactions` — Transaction history
- `GET /api/chains` — Supported chains with stats
- `GET /api/stats` — Aggregate statistics
- `GET /api/events/recent` — Recent on-chain events
- `GET /api/health` — Health check endpoint (HTTP 200 always)

### Analytics API
- `GET /api/analytics/overview`
- `GET /api/analytics/protocol-stats`
- `GET /api/analytics/chain-distribution`
- `GET /api/analytics/registrations`
- `GET /api/analytics/metadata-quality`
- `GET /api/analytics/x402-by-chain`
- `GET /api/analytics/controller-concentration`
- `GET /api/analytics/uri-schemes`
- `GET /api/analytics/categories`
- `GET /api/analytics/image-domains`
- `GET /api/analytics/models`
- `GET /api/analytics/endpoints-coverage`
- `GET /api/analytics/top-agents`

### Economy API
- `GET /api/economy/overview`
- `GET /api/economy/top-agents`
- `GET /api/economy/top-earning`
- `GET /api/economy/endpoint-analysis`
- `GET /api/economy/x402-by-chain`
- `GET /api/economy/transactions`
- `GET /api/economy/transaction-stats`
- `GET /api/economy/transaction-volume`

### Status & Quality API
- `GET /api/status/overview`
- `GET /api/status/events`
- `GET /api/status/metrics`
- `GET /api/status/summary`
- `GET /api/status/alerts`
- `GET /api/quality/summary`
- `GET /api/quality/offenders`

### Trust & Skills API
- `GET /api/trust/leaderboard`
- `GET /api/trust/distribution`
- `GET /api/trust/by-chain`
- `GET /api/skills/overview`
- `GET /api/skills/top`
- `GET /api/skills/categories`
- `GET /api/skills/agents-by-skill`
- `GET /api/skills/trust-correlation`

### Admin
- `POST /api/admin/sync` — Trigger prod-to-dev DB sync (requires `ADMIN_SECRET`)
- `POST /api/admin/recalculate-scores` — Batch recalculate trust scores
- `POST /api/admin/probe-all` — Trigger x402 probe cycle
- `POST /api/admin/sync-transactions` — Trigger transaction sync
- `POST /api/admin/discover-sources` — Trigger community source discovery

### SEO
- `GET /sitemap-agents.xml` — Dynamic XML sitemap (44k+ agent URLs, cached 1h)

---

## Frontend Pages & Routing

Routes defined in `client/src/App.tsx` using `wouter`:

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Landing` | Hero, top trusted agents, recent discoveries, live feed |
| `/agents` | `Directory` | Searchable/filterable agent list, defaults to verified |
| `/agent/:id` | `AgentProfile` | Full trust breakdown, metadata, capabilities, timeline |
| `/analytics` | `Analytics` | Ecosystem charts and statistics |
| `/skills` | `Skills` | OASF capabilities ecosystem |
| `/economy` | `Economy` | x402 payment adoption, top earners |
| `/protocols` | `Protocols` | ERC-8004, OASF, x402 educational content |
| `/status` | `StatusPage` | Live indexer health, alerts, per-chain sync |
| `/api-docs` | `ApiDocs` | Interactive API documentation |
| `/quality` | `Quality` | Transparency report, quality tiers, spam analysis |
| `/about` | `About` | About page |

---

## SEO Setup

- `robots.txt` — In `client/public/robots.txt`, allows all crawlers, references both sitemaps
- Static sitemap — `client/public/sitemap.xml` with all 10 page URLs
- Dynamic sitemap — `GET /sitemap-agents.xml` generates XML for all non-spam agents
- Canonical tags — `client/src/components/seo.tsx` component sets `<link rel="canonical">`
- Social cards — `twitter:card` set to `summary_large_image`, OG image at `/og-image.png`
- JSON-LD — Agent profile pages inject `SoftwareApplication` structured data with `AggregateRating`
- Font — Inter only (loaded from Google Fonts in `client/index.html`)

---

## Trust Score Engine

Five scoring categories (0-100 total):

| Category | Max Points | Signals |
|----------|-----------|---------|
| Identity (25) | Name, description length, image, endpoints, tags/skills |
| History (20) | Age in days, update count, cross-chain presence |
| Capability (15) | x402 support, OASF skill count, endpoint count |
| Community (20) | GitHub health score, Farcaster score, source count |
| Transparency (20) | URI scheme (IPFS=8, HTTPS=5), supported trust protocols, active status |

**Verified agent** = trust score >= 20 AND quality tier not spam/archived.

---

## Quality Classification

Agents are assigned quality tiers: `high`, `medium`, `low`, `spam`, `archived`, `unclassified`.

Spam detection flags: `whitespace_name`, `blank_uri`, `spec_uri`, `code_as_uri`, `test_agent`, `duplicate_template`.

---

## Inactive / Future Features

These features are implemented but dormant (require real on-chain data to activate):

- **Known Reputation Sources** — `server/known-reputation-sources.ts` uses placeholder addresses
- **ACP Activity Detection** — `detectAcpAgent()` exists but is not called
- **Source Attribution Badges** — Activates when reviewer addresses match KNOWN_SOURCES
- **Sybil Warning Banners** — Triggers when FeedbackPosted events exist in DB
- **Enriched Feedback** — `/api/agents/:id/feedback` returns empty sources/sybilFlags

See `docs/implementation-report-ecosystem-intelligence.md` for the re-enable checklist.

---

## External Service Dependencies

| Service | Purpose | Required? |
|---------|---------|-----------|
| Neon PostgreSQL | Production database | Yes |
| Alchemy | Primary RPC + Asset Transfers API | Yes (for indexing + tx tracking) |
| Infura | Fallback RPC provider | Optional |
| Ankr / Public RPCs | Additional fallback RPCs | Built-in (no key needed) |
| GitHub API | Community feedback (repo stats, issues) | Optional (rate-limited without token) |
| Neynar API | Farcaster data (followers, casts) | Optional |

---

## Blockchain Configuration

5 EVM chains supported (defined in `shared/chains.ts`):

| Chain | Chain ID | Identity Registry | Reputation Registry |
|-------|----------|-------------------|---------------------|
| Ethereum | 1 | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| Base | 8453 | Same | Same |
| Polygon | 137 | Same | Same |
| Arbitrum | 42161 | Same | Same |
| BNB Chain | 56 | Same | Same |

All chains share the same contract addresses (cross-chain deployment).

---

## Production Deployment Notes

### Previous Setup (Replit)
- Deployed on Replit Reserved VM
- Build: `npm run build` → Deploy: `npx drizzle-kit push && node ./dist/index.cjs`
- Port 5000 mapped to external port 80

### For New Host
1. Provision PostgreSQL (or use existing Neon database)
2. Set all required environment variables
3. `npm install && npm run build`
4. `npx drizzle-kit push` (syncs schema to DB)
5. `NODE_ENV=production node dist/index.cjs`
6. Health check: `GET /api/health` returns HTTP 200

### Rate Limiting
- API: 100 requests/min per IP
- Admin: 2 requests/hour per IP

### Graceful Shutdown
The server handles SIGTERM/SIGINT with graceful cleanup of all background services.

---

## Replit-Specific Items to Replace

These are Replit-specific and should be adapted for the new host:

1. **Vite plugins** — `vite.config.ts` conditionally loads `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, and `@replit/vite-plugin-runtime-error-modal`. These only run in development and are gated by `process.env.REPL_ID`, so they will naturally be skipped on a non-Replit host. They can be safely removed from `devDependencies` if desired.

2. **Dev server setup** — `server/vite.ts` uses Vite middleware mode for development HMR. This is standard Vite usage and works on any host.

3. **Build script** — `script/build.ts` uses esbuild to bundle the server and Vite to build the frontend. Platform-independent.

4. **Database** — Production DB is on Neon (independent of Replit). The `DATABASE_URL` connection string works anywhere.

5. **Post-merge script** — `scripts/post-merge.sh` is Replit-specific for automated CI. Replace with your CI/CD pipeline's equivalent.

6. **Replit-only npm packages** — `@replit/connectors-sdk`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, and `@replit/vite-plugin-runtime-error-modal` are Replit-specific dev/integration packages. They are not needed at runtime on a non-Replit host. Remove them from `package.json` when setting up the new environment.

---

## User Preferences

- Professional blue theme with Inter font
- Dark mode toggle
- Plain English copy (no jargon)
- Mobile-friendly responsive design
- Use "verified" (not "claimed") for agents meeting quality threshold (trust >= 20, non-spam)
