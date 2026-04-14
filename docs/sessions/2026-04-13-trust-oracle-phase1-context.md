# Session Context — Trust Oracle Phase 1

**Date:** 2026-04-13
**Project:** TrustAdd
**Branch:** main

## What Was Accomplished

### Trust Oracle Phase 1 (9 tasks, all complete)
- `3315e44` — Vitest test framework (149 tests across 8 suites)
- `cc97115` — Schema migration: 4 new columns on `agents` + `pipeline_health` table
- `7965f1e`..`01a4a9c` — Signal provenance hashing + score explainability (17 signals, opportunities array)
- `1a3b77a` — Methodology endpoint (`GET /api/v1/trust/methodology`)
- `4c3740c` — Confidence levels (source coverage weighting)
- `b7b9365` — Pipeline health tracking (7 Trigger tasks instrumented)
- `faee582` — Circuit breaker alerts + report v2 (provenance + confidence in API)
- `1548c4c` — Principles doc + future phases roadmap

### Deep Audit (adversarial review)
- `d3521ca` — Fixed 4 issues: missing tx-indexer/bazaar-indexer instrumentation, methodology signal count (18→17), hasImage provenance divergence (exported `looksLikeImageUrl`)

### Other Session Work
- `e7909ae` — WIP Oracle Principles page (nav wired, content in content-zones.ts, page component created)
- `d33aa00` — Leaderboard fix (CAUTION agents included, TRUSTED first)
- `4357a10`..`0c62520` — ADR-1 execution (test infra, rate limiter fix, stale docs update)

## Key Decisions

- **Phase 1 only**: Deferred on-chain anchoring (Merkle roots), EAS attestations, and Sybil detection to future phases. Rationale: foundation work (provenance, explainability, confidence) must exist before on-chain commitments.
- **hasTransactions hardcoded false**: Batch scoring doesn't prefetch per-agent tx counts (expensive for 106k agents). Report compiler computes it correctly per-agent. Accepted tradeoff.
- **Pipeline health endpoint public**: Intentional transparency (Principle 4). Operational status is not sensitive.
- **Report version bumped to 2**: Full reports now include `provenance` and `confidence` blocks.

## Current State

### Background Tasks
- All 7 scheduled Trigger.dev tasks now report to `pipeline_health` table on success/failure
- Circuit breakers open after 3 consecutive failures for any task
- Watchdog (every 15 min) checks staleness SLAs and fires alerts for stale/open circuits
- **Verify**: After next recalculate run (5 AM UTC), check that `trust_signal_hash`, `confidence_score`, `confidence_level` columns are populated on agents

### Known Issues
- `hasTransactions: false` in batch scoring paths means stored `confidence_score` is systematically lower than per-report confidence (which correctly checks tx count). Consumers comparing the two will see different values.
- Pre-existing TypeScript type errors in `trust-report-compiler.ts` (lines 406, 465, 475) — `undefined` vs `null` from storage methods. Runtime-safe but should be cleaned up.

### WIP (Uncommitted in previous session, now committed)
- Oracle Principles page (`client/src/pages/principles.tsx`) — content wired in `content-zones.ts`, nav/routing added in header and App.tsx. Needs visual polish and review.

## Next Steps (prioritized)

1. **Verify Phase 1 deployment** — Check Vercel endpoints (`/api/v1/trust/methodology`, `/api/v1/trust/pipeline-health`). Verify Trigger.dev deploy succeeded. After next recalculate cycle, confirm new DB columns populated.
2. **Complete Oracle Principles page** — Page exists but needs visual polish. 10 principles with commitments, closing section. Consider design patterns from methodology page.
3. **Trust Oracle Phase 2: Sybil Detection** — Controller clustering, self-referential payments, temporal bursts. See `docs/principles/future-phases.md`.
4. **ADR-1: Split god files** — `routes.ts` (1,700 LOC) → 5 domain files, `storage.ts` (2,500 LOC) → 4 files. 149 tests provide safety net.
5. **Bazaar payment volume** — Re-apply from commit `89c5507`. DB columns exist. Use Alchemy `getAssetTransfers`.

## References

- Memory: `project_system_state.md` (updated), `project_next_tasks.md` (updated)
- Docs: `docs/principles/trust-oracle-design-principles.md`, `docs/principles/future-phases.md`
- Plans: `docs/superpowers/plans/2026-04-13-trust-oracle-phase1.md` (complete)
- Specs: `docs/superpowers/specs/2026-04-13-architecture-adr1-fortify.md`
