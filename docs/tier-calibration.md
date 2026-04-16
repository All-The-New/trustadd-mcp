# Tier Calibration Tracker

The 5-tier verdict thresholds are expected to move as the agent economy matures and as the scoring methodology gains new signals. This doc tracks the current calibration and the conditions that should trigger re-evaluation.

## Current thresholds (as of 2026-04-16)

| Tier | Score range | Notes |
|---|---|---|
| VERIFIED | 80–100 | 0 agents today; requires attestation or exceptional multi-category strength |
| TRUSTED | 60–79 | 0 agents today; ceiling effectively ~40 until attestation lands |
| BUILDING | **20–59** | Temporarily lowered from 40 on 2026-04-16 so the leaderboard isn't empty while attestation is v3-gated |
| INSUFFICIENT | 0–19 | |
| FLAGGED | any, with active negative evidence | |

## Why BUILDING floor = 20 today

Methodology v2 has 5 internal scoring categories (max points in parens):
transactions (35), reputation/attestation (25), profile (15), longevity (15), community (10).

The **reputation/attestation category is gated to v3** (the on-chain attestation pipeline isn't built yet), so it contributes 0 points for every agent today. The effective ceiling drops from 100 → 75.

Empirically, even the most-active agent in prod (Klara — 2,418 txs, $6,208 USD volume, 29 unique payers) scores 42 raw (28 transactions + 9 profile + 5 longevity + 0 attestation + 0 community), dampened to 39 by sybil risk 0.15. That's the **de facto current ceiling**, not the theoretical 75.

With a 40-point BUILDING floor:
- 0 agents earned BUILDING or above
- Leaderboard was empty
- Every agent rendered as INSUFFICIENT

With the new 20-point floor:
- ~57 agents land in BUILDING (score 20–59)
- Active-tx agents like Klara, Merkle, Based East Africa Builds, Clawnch show as BUILDING
- Early signals of tx activity are recognized

## When to re-raise

Raise the BUILDING floor back toward 40 once **any** of these conditions are true:

1. **Attestation pipeline ships (v3)** — adds up to 25 pts/agent, lifting every active agent's effective ceiling to ~65. At that point a 40 floor means "this agent has on-chain attestation OR very strong commercial activity" — the original semantic.
2. **Distribution shift** — p99 agent score rises above 45 organically (from more tx volume, not scoring changes). That's the signal the ecosystem has matured enough for the stricter threshold.
3. **Community category activation** — if GitHub/Farcaster linking gets popular (>10% agents), the 10-pt community category starts pushing active agents past 50 on its own.

## Where to change it

Raising the floor requires updates in:

- `server/trust-report-compiler.ts` — `computeVerdict()` body (line ~225)
- `server/storage/agents.ts` — `getTrustScoreLeaderboard` SQL condition
- `server/storage/agents.ts` — `getTrustTierDistribution` CASE expression (the boundary that picks BUILDING vs INSUFFICIENT)
- `server/trust-methodology.ts` — `verdictThresholds.BUILDING` and `verdictThresholds.INSUFFICIENT` strings + changelog entry
- `client/src/lib/verdict.ts` — `BUILDING.minScore` and `INSUFFICIENT.maxScore`
- `client/src/components/score-rail.tsx` — `TIER_SEGMENTS` widths (INSUFFICIENT + BUILDING) and the JSDoc
- `client/src/pages/methodology.tsx` — `V2_TIERS` `range` strings (Insufficient + Building)
- `__tests__/verdict-logic.test.ts` — BUILDING + INSUFFICIENT describe blocks
- `__tests__/free-tier.test.ts` — CAUTION_AGENT fixture verdict expectation
- `__tests__/sybil-detection.test.ts` — dampened-score verdict expectation
- This doc — bump current thresholds table + add a dated calibration entry below

## Calibration history

| Date | Change | Rationale |
|---|---|---|
| 2026-04-16 | BUILDING floor 40 → 20 | Full recalc under methodology v2 showed no agent clears 40 while attestation is v3-gated; 20 floor restores ~57 agents to the BUILDING tier and preserves meaningful leaderboard ordering |
