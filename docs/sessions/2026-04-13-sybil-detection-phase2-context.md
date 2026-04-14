# Session Context — Trust Oracle Phase 2 (Sybil Detection)

**Date:** 2026-04-13
**Project:** TrustAdd
**Branch:** main

## What Was Accomplished

### Sybil Detection Phase 2 (12 tasks, all complete)
- `c4ea9f8` — Schema migration: `sybil_signals jsonb` + `sybil_risk_score real` on agents table + partial index
- `3b3e329`..`76d8617` — 4 signal detectors (controller clustering, fingerprint duplication, self-referential payments, temporal burst) + risk scoring + dampening multiplier — all TDD with 35 tests
- `2f53376` — `analyzeSybilSignals` orchestrator (pure function combining all 4 detectors)
- `8af70fd` — `prefetchSybilLookups` SQL prefetcher (3 bulk queries for batch performance)
- `4cda416` — Integration into `recalculateAllScores()` — dampened scores written to DB
- `1f22f08` — Sybil block in full trust reports (`FullReportData.sybil`)
- `28ec2ab` — Code review fix: dampening applied in `compileAndCacheReport`, SQL simplified, error logging added
- `f26a908` — Integration tests (verdict interaction with dampening)
- `0405dd8` — Phase 2 marked complete in `docs/principles/future-phases.md`
- `c9ca916` — Deep audit fix: corrupted data guard in `detectSelfReferentialPayment`

### Deep Audit Results
- **Self-review**: Found and fixed `compileAndCacheReport` not applying sybil dampening (score/verdict divergence)
- **Codex adversarial review**: Found corrupted data guard issue — `totalCount=0` with `selfRefCount>0` was silently suppressed. Fixed to emit high-severity signal + log.

## Key Decisions

- **Dampening is linear 0.5-1.0**: Risk score 0 → no dampening, risk score 1 → 50% reduction. Conservative start; can tune thresholds after observing production data.
- **Only `recalculateAllScores` applies sybil detection**: The incremental path (`ensureScoresCalculated`) does not apply sybil analysis — it's only for newly indexed agents that don't have scores yet. Full recalculation runs daily at 5 AM UTC.
- **`compileAndCacheReport` also applies dampening**: Ensures trust reports have consistent scores/verdicts with the agent's stored trust_score. Uses `agent.sybilRiskScore` from DB.
- **Dimension sub-scores remain undampened**: `breakdown.total` is dampened but `breakdown.identity`, `.history`, etc. remain at raw values. API consumers summing dimensions will get a higher total than `breakdown.total`. Accepted tradeoff — an explicit `sybil.rawScoreBeforeDampening` field in the report makes this transparent.

## Current State

### Background Tasks
- **Sybil detection activates on next `recalculate-scores` run** (2026-04-14 05:00 UTC). After that run, `sybil_signals` and `sybil_risk_score` columns should be populated for flagged agents.
- **Deploy status**: GitHub push triggers both Vercel auto-deploy and Trigger.dev GitHub Actions workflow. Both should deploy the new `recalculateAllScores` code with sybil integration.

### Production Data (queried this session)
- 102,048 agents total
- 463 controllers with >10 agents (top: 6,322 agents under one controller)
- 4,119 metadata fingerprint clusters (shared across different controllers)
- 26 agents with transactions (self-referential + temporal burst detection has limited data)

### Known Issues
- **Dimension sub-score inconsistency**: After dampening, `breakdown.total != sum(breakdown.identity + ...)` for sybil-flagged agents. The `sybil.rawScoreBeforeDampening` field in reports makes this explicit.
- **`hasTransactions: false` in batch scoring**: Pre-existing gap — batch confidence calculation doesn't prefetch per-agent tx counts. Sybil detection doesn't change this.
- **`prefetchSybilLookups(db: any)`**: Parameter typed as `any` for Trigger.dev dynamic import compatibility. Could be strengthened.

## Next Steps (prioritized)

1. **Verify sybil activation** — After 2026-04-14 05:00 UTC, run SQL to check `sybil_signals` and `sybil_risk_score` are populated. Expected: 463+ controllers flagged, top controllers get dampened scores.
2. **Oracle Principles page** — WIP committed. Needs visual polish and completion.
3. **Trust Oracle Phase 3: On-Chain Score Anchoring** — Merkle root publishing on Base. See `docs/principles/future-phases.md`.
4. **Re-apply bazaar payment volume** — Code in `89c5507`, DB columns exist. Alchemy `getAssetTransfers` approach confirmed.

## References

- Memory: `project_system_state.md` (updated), `project_next_tasks.md` (updated)
- Docs: `docs/principles/future-phases.md` (Phase 2 complete)
- Plans: `docs/superpowers/plans/2026-04-13-sybil-detection-phase2.md`
- Previous: `docs/sessions/2026-04-13-trust-oracle-phase1-context.md`
