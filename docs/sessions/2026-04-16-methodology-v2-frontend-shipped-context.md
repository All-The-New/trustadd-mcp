# Session Context — Methodology v2 Frontend Shipped + BUILDING Floor Calibration + White-Screen Fix

**Date:** 2026-04-16
**Project:** TrustAdd
**Branch:** `main` (all work merged; `main` HEAD `e82a691`)

## What Was Accomplished

- **PR [#2](https://github.com/All-The-New/trustadd/pull/2) merged (`7d6088e`)** — methodology v2 frontend + backend deltas atomic cutover, 34 commits, 278 server + 20 browser tests green. Full plan in [`docs/superpowers/plans/2026-04-16-methodology-v2-frontend.md`](../superpowers/plans/2026-04-16-methodology-v2-frontend.md).
- **PR [#3](https://github.com/All-The-New/trustadd/pull/3) merged (`45f9e7f`)** — BUILDING verdict floor 40 → 20 calibration. 57 agents land in BUILDING today vs. 0 at floor=40. Intent + re-raise conditions in [`docs/tier-calibration.md`](../tier-calibration.md).
- **Deploy + recalc completed** — Vercel prod, Trigger.dev prod. `recalculate-scores` ran on `large-1x` (default small-1x OOMed) — 102,725 agents rescored in 67s, Merkle anchor auto-triggered on Base.
- **White-screen fix (`5be9823`)** — `landing.tsx` `pillarIcons` map was missing `Zap` icon after v2 pillars expanded from 3 to 5 items. No error boundary → full route crashed → user reported white screen on prod. Fixed and redeployed.
- **Smoke checklist hardened (`4e031cc`)** — added mandatory "Browser route smoke" section to [`docs/smoke-checklist-methodology-v2.md`](../smoke-checklist-methodology-v2.md) explicitly calling out the icon-map hazard.
- **CLAUDE.md synced (`8c35288`)** — Important Files section reflects methodology v2 frontend primitives + tier-calibration doc.
- **Memory updated** — `project_system_state.md` rewritten, `project_next_tasks.md` updated, new entries: `feedback_scoring_recalibration.md`, `feedback_icon_lookup_maps.md`. Recalc OOM learning added to `feedback_trigger_deploy.md`.

## Key Decisions

- **Verdict 6 tiers → 5 visible**: removed UNVERIFIED, renamed INSUFFICIENT_DATA → INSUFFICIENT. UNKNOWN retained API-only; UI renders as INSUFFICIENT + `—` for null scores.
- **`categoryStrengths` field**: qualitative `{identity/behavioral/community/attestation/authenticity: high|medium|low|none}` added to free-tier Quick Check + TrustRating. Derived from internal 5-category numeric breakdown + `sybilRiskScore` (0–1 float). Raw numerics stay gated in Full Report.
- **`redactAgentForPublic` policy shift**: keeps aggregate `trustScore` visible on free tier so the leaderboard square stamp can render a number. Still strips breakdown, qualityTier, spamFlags, lifecycleStatus, sybil signals.
- **BUILDING floor temporarily 20**: effective prod score ceiling is ~40 (max agent is Klara at 39) because attestation category is gated to v3. At 40 floor, leaderboard was empty. Full rationale + re-raise conditions in `docs/tier-calibration.md`.
- **`recalculate-scores` needs `large-1x`**: default small-1x OOMs on 102k agents. Scheduled task config not yet bumped — next scheduled daily run may OOM.

## Current State

### Background Tasks
- **Vercel prod**: last deploy bundle `index-cJnfHyks.js` (fix deploy for `5be9823`). Smoke check passed — HTML + bundle 200, new pillars visible.
- **Trigger.dev prod**: version `20260416.1`, all 11 tasks live.
- **trust_reports cache**: flushed post-recalc; will repopulate naturally as `/api/v1/trust/:address` paid calls arrive.

### Known Issues
- **Scheduled recalc may OOM**: `recalculate-scores` runs daily at 5 AM UTC on default machine preset. If a run OOMs in the morning, need to set `machine: "large-1x"` as the task default in `trigger/recalculate.ts`. Check [Trigger.dev dashboard](https://cloud.trigger.dev/projects/v3/proj_nabhtdcabmsfzbmlifqh) or run `mcp__trigger__list_runs`.
- **Narrative copy rounds to whole %**: `/api/analytics/trust-tiers` narrative shows "0% BUILDING" when 57 agents are 0.06% of 102k. Cosmetic.
- **Two unrelated untracked docs** (`verified-credentials-spec.md`, `verticals-spec.md`) in repo root — not my work, predate session. Leaving alone.

### Tech Debt Introduced
- **`/api/trust-scores/top` is N+1**: extended in PR #2 to include per-agent verifications. Calls `storage.getAgent(entry.id)` inside a Promise.all per leaderboard entry. Acceptable at `limit ≤ 20`, but should batch with a `getAgentsByIds()` helper before scale.
- **`schema.ts report_version` default** still `.default(1)` while `REPORT_VERSION = 4`. Never fires at runtime (INSERT paths always pass value) but misleading. One-line fix + migration.
- **No Playwright route smoke**: white-screen bug slipped through because nothing exercised actual renders. Added to "Polish / small followups" — ~30 lines of Playwright visiting each top-level route, asserting zero console errors + non-empty root.

## References

### Memory updated
- `project_system_state.md` (full rewrite)
- `project_next_tasks.md` (session updates)
- `MEMORY.md` (index entries)
- `feedback_trigger_deploy.md` (recalc OOM note)
- `feedback_scoring_recalibration.md` (new)
- `feedback_icon_lookup_maps.md` (new)

### Docs updated in repo
- `docs/tier-calibration.md` (new, PR #3)
- `docs/smoke-checklist-methodology-v2.md` (new in PR #2, hardened in `4e031cc`)
- `docs/superpowers/plans/2026-04-16-methodology-v2-frontend.md` (plan, committed)
- `CLAUDE.md` Important Files section

### Relevant commits (session-scoped)
- `7d6088e` PR #2 merge (methodology v2)
- `45f9e7f` PR #3 merge (BUILDING floor)
- `8c35288` CLAUDE.md sync
- `5be9823` landing.tsx white-screen fix
- `4e031cc` smoke checklist browser routes section

### Active plans
- Methodology v2 frontend: **complete** (all 38 tasks shipped).
- v3 attestation pipeline: **not yet planned**.

### Note on session scope
Between `/close` and `/next`, another session shipped [PR #4](https://github.com/All-The-New/trustadd/pull/4) (MPP integration, merge commit `e82a691`). That work is NOT part of this session's context — see [`project_mpp_launch.md`](../../../../.claude/projects/-Users-ethserver-CLAUDE-trustadd/memory/project_mpp_launch.md) for MPP state. Per updated `project_next_tasks.md`, MPP launch rollout (UI flag flips + directory-scraper fix) is now Task 0.
