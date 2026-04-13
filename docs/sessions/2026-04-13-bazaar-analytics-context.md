# Session Context — Bazaar Analytics + Audit Fixes

**Date:** 2026-04-13
**Project:** TrustAdd
**Branch:** main

## What Was Accomplished

- **Bazaar page v1** (`3632044`): Schema (bazaar_services, bazaar_snapshots), CDP indexer task (every 6h), 4 API endpoints, full analytics page with KPI cards, pie chart, service explorer
- **Bazaar page v2** (`f684797`): Fixed classifier (65% "other" → 0.3%), added finance category, price distribution chart, click-to-expand service detail, ERC-8004 cross-reference section, fixed x402Scout parsing (0 → 1,330 enriched)
- **Width fix** (`574e525`): Added `max-w-6xl` container wrapper matching other pages
- **Trust Data Product** (`d5631de`): x402-gated trust API, payment middleware, report compiler, request logging
- **API tiering** (`74ef0df`): Free ecosystem analytics vs x402-gated trust intelligence, agent redaction, verdict badges
- **Audit fixes** (`422f5da`): SSR spamFlags type bug (number→string[]), 402 query handling in frontend, API docs verdict taxonomy, try/catch on gated routes, conditional reportAvailable
- **Security** (`1b517a8`, `d69f35d`): sql.raw elimination, CORS conflicts, JSON-LD XSS escape

## Key Decisions

- **Base mainnet only**: CDP Bazaar has 13.8k resources but we filter to ~11.5k Base mainnet (skip testnets)
- **Bitquery deferred to v2**: On-chain payment volume needs API key signup
- **Finance category added**: lowpaymentfee.com (10k+ generic endpoints) now classified as finance instead of other
- **x402Scout enrichment via `endpoints` key**: Response structure differs from what was assumed
- **Timestamp-based inactive marking**: Replaced huge URL array approach with `last_seen_at < runStartedAt`

## Current State

### Background Tasks
- `bazaar-indexer`: Running every 6h on Trigger.dev (v20260413.15). Last run: 11,567 services, 1,330 scout-enriched. Verified working.
- Growth trends: Will auto-populate as daily snapshots accumulate (currently 1 snapshot)

### Known Issues
- x402Scout catalog returned 1,330 services but URL matching to CDP may miss some — scout uses `url` field while CDP uses `resource` in `accepts[]`
- In-memory rate limiter in routes.ts is per-instance only (documented); DB-backed limiter in api/[...path].ts is authoritative

### Tech Debt Introduced
- `lowpaymentfee.com` constitutes ~92% of all services (10.6k of 11.5k) — consider flagging as "bulk provider" or de-emphasizing in UI
- Bazaar indexer upserts are serial (one-at-a-time) instead of batched — 6h cadence makes this non-critical

## Next Steps (Prioritized)

1. **Bitquery integration** (deferred from this session): Sign up for API key, add on-chain USDC payment volume per service
2. **Growth trends**: Wait 2-3 days for snapshots to accumulate, then verify trend chart renders
3. **Homepage integration (Phase 6)**: Add Trust API section, pricing cards, "For Agents" page
4. **Publish `@trustadd/mcp` to npm**: Package at `packages/trustadd-mcp/`
5. **Trigger.dev report recompilation**: Add `batchRecompileReports()` to recalculate task
6. **Bazaar API on CDP Bazaar**: Register TrustAdd's own Trust API as an x402 service

## References

- Memory: `project_system_state.md` (updated with bazaar + trust product sections), `project_next_tasks.md`
- Docs: `docs/trust-api.yaml`, `docs/trust-product.md`, `docs/api-tiering.md`
- Schema: `bazaar_services`, `bazaar_snapshots` tables in Supabase
- Trigger task: `trigger/bazaar-indexer.ts` (cron: `0 */6 * * *`)
- Frontend: `client/src/pages/bazaar.tsx`
