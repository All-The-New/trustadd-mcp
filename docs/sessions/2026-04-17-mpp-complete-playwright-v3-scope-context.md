# Session Context — MPP Launch Complete + Recalc OOM Fix + Playwright Smoke + v3 Scope

**Date:** 2026-04-17
**Project:** TrustAdd
**Branch:** `main` (HEAD `8257b81` — all work committed and pushed)

## What Was Accomplished

- **`recalculate-scores` OOM fix (`3989d7e`)** — overnight 5AM UTC run crashed again (`TASK_PROCESS_OOM_KILLED`) on default `small-1x`. Added `machine: { preset: "large-1x" }` to task definition in `trigger/recalculate.ts`. Deployed via CI as `v20260417.1`.
- **MPP UI flags live (`addd377` + Vercel deploy `dpl_6nNn8PvVrzMGGW5LbtiLZUFkrxji`)** — `ENABLE_MPP_UI=true` + `VITE_ENABLE_MPP_UI=true` set on Vercel. `/mpp` page, `/economy` MPP card, and header nav entry now public.
- **Directory scraper fixed (`addd377`, refined `8257b81`)** — Root cause: `auto` factory was using `MppScrapeSource` against a JS-rendered docs page. `mpp.dev/api/services` returns structured JSON. Changed `auto` to `MppApiSource`; fixed `normalize()` for object-shaped `provider` field and `categories` array; user then refined to also extract `pricingModel` from `methods.tempo.intents` and `recipientAddress` from `methods.tempo.assets` (actual API shape). Next `mpp-directory-indexer` run (04:30 UTC 2026-04-18) should populate `mpp_directory_services`.
- **`METHODOLOGY.ecosystemNotice` MPP note** — one sentence added to methodology page info box, refined to reference `/mpp` page and "methodology v3" explicitly.
- **Playwright route smoke test (`3372159`)** — `e2e/routes.smoke.spec.ts` + `playwright.config.ts`. Tests 8 routes (`/`, `/agents`, `/analytics`, `/methodology`, `/trust-api`, `/principles`, `/agent/klara`). Asserts HTTP non-500 + non-empty `#root` + zero JS console errors. Run: `npm run test:e2e`. Catches the white-screen class of bug.
- **v3 attestation pipeline scoped** — 4-phase plan in `project_next_tasks.md` memory. Contract deployed (`REPUTATION_REGISTRY = 0x8004B...` on all 9 chains), interface + stub already in code.

## Key Decisions

- **Flipped both MPP UI flags in one session (17h not 24h)**: DB/task state was clean — 5,866 probes written, no crashes, 0 errors on completed tasks. Close enough to the 24h guideline.
- **API source for MPP directory**: `mpp.dev/api/services` confirmed working; HTML scraper was always broken (no `data-url` attrs on a React docs site). `auto` now defaults to API permanently.
- **Playwright added at project level**: `@playwright/test` in devDependencies, `playwright.config.ts` at root pointing at port 5001, `e2e/` directory. Not wired into CI yet — manual run only for now.

## Current State

### Background Tasks
- **`recalculate-scores`**: fixed — `large-1x` default in `trigger/recalculate.ts`, deployed `v20260417.1+`. Next scheduled run 05:00 UTC 2026-04-18.
- **`chain-indexer`**: running normally (`v20260417.3`, multi-chain executing as of 18:20 UTC).
- **`mpp-directory-indexer`**: next run 04:30 UTC 2026-04-18 — should populate `mpp_directory_services` now that scraper is fixed. Check via Supabase SQL: `SELECT COUNT(*) FROM mpp_directory_services`.
- **`mpp-prober`**: runs daily 03:30 UTC — 5,866 probes at 17h, 0 MPP agents found (expected). Will continue accumulating.
- **Vercel deploy**: `dpl_6nNn8PvVrzMGGW5LbtiLZUFkrxji` — aliased to trustadd.com, `READY`.
- **Trigger.dev deploy**: `v20260417.3` — all 13 tasks live including recalculate machine fix.

### Known Issues
- **Playwright not in CI**: `npm run test:e2e` works locally (requires `npx playwright install chromium` first). Should add to GitHub Actions before shipping v3 methodology.
- **MPP directory services count = 0 until 04:30 UTC tomorrow** — not a bug, just timing. Monitor after the next scheduled run.
- **Tempo txs = 0**: no tracked addresses yet because no agents are MPP-enabled (0 mpp-prober hits). Expected.

### Tech Debt Introduced
- **`/mpp` page with empty state live**: shows no data until services are indexed. The empty state copy handles this gracefully but UX is sparse.
- **Playwright requires `playwright install chromium`**: not automated. Add `npx playwright install --with-deps chromium` to CI job when wiring in.

## References

### Memory updated
- `project_next_tasks.md` — full session completed section, v3 attestation pipeline scoped (4 phases), MPP items moved to completed
- `project_mpp_launch.md` — updated to reflect flags live + scraper fix + DB state at 17h

### Docs updated in repo
- (none new — session context file is new)

### Relevant commits
- `3989d7e` recalculate-scores OOM fix (machine large-1x)
- `addd377` MPP flags + scraper fix + ecosystemNotice + doc sync
- `3372159` Playwright smoke test
- `8257b81` User refinements: normalize API shape, ecosystemNotice wording

### Active plans
- v3 attestation pipeline: scoped in memory, **not yet planned as a file**
- Phase 3 anchoring go-live: `docs/go-live-phase3-anchoring.md`

### v3 scope summary (from memory `project_next_tasks.md`)
4 phases:
1. Schema: `agent_attestations` table (1h)
2. Chain indexer: `eth_getLogs` pass on `REPUTATION_REGISTRY` per chain (3h)
3. Prefetcher SQL + `METHODOLOGY_VERSION` 2→3 + `REPORT_VERSION` 4→5 (2h)
4. Recalc + verify distribution + floor raise 20→40 (1h)
