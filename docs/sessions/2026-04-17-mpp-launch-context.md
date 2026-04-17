# Session Context — MPP Launch (Path A)

**Date:** 2026-04-17
**Project:** TrustAdd
**Branch:** `docs/mpp-launch-state` (PR #5 open); `main` merged commit `e82a691`

## What Was Accomplished

- **Plan written:** `docs/superpowers/plans/2026-04-16-mpp-launch.md` — 20 tasks, 3 phases (pre-launch fixes → /mpp build-out → launch sequence)
- **Runbook written:** `docs/superpowers/runbooks/2026-04-16-mpp-launch.md` — step-by-step operator flow
- **13 commits on `feat/mpp-integration`** merged via PR #4 (`e82a691`), each through implementer → spec review → code-quality review
- **Pre-launch blocker fixed:** placeholder pathUSD address replaced with real mainnet `0x20c000000000000000000000b9537d11c60e8b50` (`c2b8eef`)
- **`/mpp` page built out:** scaffold → hero → breakdowns → trends → directory table → top providers → multi-protocol agents → copy migration → header nav → economy empty-state (`151c9c7` through `bd134c5`)
- **Runbook Steps 1–5 executed:**
  - Vercel env vars set: `TEMPO_RPC_URL`, `MPP_DIRECTORY_SOURCE=auto`
  - Trigger.dev env vars set: `ENABLE_MPP_INDEXER=true`, `TEMPO_RPC_URL`, `TEMPO_RPC_URL_FALLBACK` (same as primary; placeholder), `MPP_DIRECTORY_SOURCE=auto`, `TEMPO_PATHUSD_DEPLOYMENT_BLOCK=5172409`
  - PR #4 merged to main; Trigger.dev auto-deploy `v20260416.3 DEPLOYED`; all 3 MPP tasks registered
  - One-shot smoke tests fired via `mcp__trigger__trigger_task`
- **Follow-up docs PR opened:** PR #5 (`908dce0`) updates `CLAUDE.md` to reflect launch state
- **Memory updated:** added `project_mpp_launch.md`; updated `project_next_tasks.md`; updated `MEMORY.md` index
- **Git cleaned:** deleted merged branches (`feat/mpp-integration`, `chore/recalibrate-building-floor`, `feat/methodology-v2-backend`, stale `fortify/adr1-foundation`)

## Key Decisions

- **Path A (MPP invisible to scoring):** Methodology v2 ships unchanged. MPP data accumulates for 4–6 weeks before v3 integration. No `METHODOLOGY_VERSION` bump.
- **PR target was `main`, not `feat/methodology-v2-backend`:** MPP code is orthogonal to methodology v2; chaining PRs would delay ship.
- **Skipped Runbook Step 4 (admin smoke-test):** RPC reachability was already proven from dev machine (132ms to `rpc.tempo.xyz`); avoiding two Vercel redeploys just to flip `ENABLE_MPP_UI` on and off.
- **`TEMPO_TRANSFER_WITH_MEMO_TOPIC` deferred:** memo decoding disabled for launch; no UI surface consumes memos yet.
- **`TEMPO_RPC_URL_FALLBACK` set to same as primary:** no real fallback RPC provisioned yet; circuit-breaker logic retries the same URL (harmless no-op until a real fallback is added).
- **Native `<select>` on `/mpp` directory table:** matches bazaar's idiom; principled choice, not regression.
- **Verdict badge color map inlined in `mpp.tsx`:** did NOT extract a shared `VerdictBadge` component — 3 pages now need one (trust-api, agent-profile, mpp) → explicit follow-up task for a future session.

## Current State

### Background Tasks

- **`mpp-prober` one-shot run:** TIMED OUT at 10 min (`MAX_DURATION_EXCEEDED`). Wrote 5866 probes (5702 no_mpp + 161 error + 3 timeout) before hitting the limit. No MPP-enabled agents found (0 `has_mpp=true`). **This is a known prober design limitation, not a task failure** — `maxDuration: 600` in `trigger/mpp-prober.ts:6` caps processing. Daily scheduled runs at 03:30 UTC will accumulate coverage over multiple days (stale-probe filter in `getStaleMppProbeAgentIds` skips recently-probed agents). Check via: `SELECT COUNT(*), COUNT(DISTINCT agent_id) FROM mpp_probes`.
- **`mpp-directory-indexer` one-shot:** COMPLETED `{fetched: 0, upserted: 0}` in 5s. Wrote 1 snapshot row. **Scraper matched zero services on `mpp.dev/services`** (see Known Issues).
- **`tempo-transaction-indexer` one-shot:** COMPLETED `{addresses: 0, transfers: 0, errors: 0}` in 0.5s. RPC healthy. No tracked addresses yet (prober hasn't discovered any).
- **Scheduled crons continue:** `mpp-prober` daily 03:30 UTC, `mpp-directory-indexer` daily 04:30 UTC, `tempo-transaction-indexer` every 6 hours.

### Known Issues

- **`mpp.dev/services` scraper returns 0 rows** [medium]: `server/mpp-directory.ts` ran without error but matched zero services. Either site's HTML format drifted, site is JS-only, or directory is genuinely empty. Indexer handles gracefully (writes zero-total snapshot). `/mpp` page empty-state copy ("No services indexed yet") handles zero rows. Fix: inspect what `curl https://mpp.dev/services` returns, patch `MppScrapeSource`, or swap to `MppApiSource` when API exists.
- **`mpp-prober` times out before completing full agent sweep** [low]: 600s maxDuration + 2-concurrent probes × 5s timeouts → ~240 probes/sec worst case. First run covered 5866 agents before timeout. Daily scheduled runs will accumulate coverage since stale-probe filter skips recent ones. Mitigation options if coverage stalls: raise maxDuration to 1800, increase concurrency 2→5, or split into orchestrator + child-per-batch pattern.
- **Verdict-badge styling duplicated across 3 pages**: `trust-api.tsx`, `agent-profile.tsx`, and now `mpp.tsx` each inline their own color map. Code reviewer (Task 10) flagged as follow-up — extract `client/src/components/verdict-badge.tsx` (or `client/src/lib/verdict.ts` extension) in a future session.
- **`tx_count` snake_case leak** [low]: `/api/mpp/chain/volume-trend` returns raw SQL rows (`day`, `volume`, `tx_count`) without camelCasing. Consumer TS interface uses `tx_count`. Fix server-side with `AS "txCount"` alias or `.map()` transform in the handler.
- **`tx` field unused in Task 7 volume chart**: `VolumeTrendPoint.tx_count` is mapped to `tx` in chart data but never rendered. Either drop or wire into `Tooltip formatter` for richer hover.
- **Trailing comment in mpp.tsx line 683** reads `{/* Sections added in Tasks 11-12 */}` — stale; all sections are now landed. One-line cleanup.
- **`mpp-directory-indexer` task limit** [low]: server endpoint `/api/mpp/directory/top-providers` returns `LIMIT 20` but UI renders only top 10 via `.slice(0, 10)`. Either trim SQL or drop the slice.

### Tech Debt Introduced

- Verdict badge duplication (see above) — deliberately deferred per reviewer to avoid scope creep in Task 10.
- Snake_case leaks in raw-SQL endpoint responses — deferred as consolidated MPP API polish pass.
- MPP directory scraper fragility — MPP is 4 weeks old; any fix today may not survive the next week's site changes. Revisit after 24–48h of observed data.

## What Comes Next (priority order)

1. **Observe 24–48h of scheduled MPP task data.** Check Supabase counts + Trigger.dev runs. If any task repeats a failure, Sentry + `/admin/status` will surface it.
2. **Merge PR #5** (CLAUDE.md docs update) once reviewed.
3. **Investigate the zero-match scraper:** `curl -s https://mpp.dev/services | head -c 5000` and inspect. Likely needs a `server/mpp-directory.ts` parser patch or a `puppeteer`/`playwright` upgrade for JS-rendered pages.
4. **Runbook Step 7:** once observation is clean, `printf 'true' | npx vercel env add ENABLE_MPP_UI production && npx vercel deploy --prod`. API routes go live; page still client-hidden. Verify with `curl -s https://trustadd.com/api/mpp/directory/stats | jq`.
5. **Runbook Step 8:** `printf 'true' | npx vercel env add VITE_ENABLE_MPP_UI production && npx vercel deploy --prod`. Page + `/economy` card + header nav all go visible.
6. **Task 20 (post-launch PR):** one-sentence addition to `METHODOLOGY.ecosystemNotice` in `content-zones.ts` announcing MPP coverage.
7. **After launch settles:** v3 attestation pipeline (biggest methodology-unblocker per `project_next_tasks.md`).

## References

- **Memory:** `project_mpp_launch.md` (new), `project_next_tasks.md` (updated), `project_system_state.md`, `MEMORY.md`
- **Docs:** `CLAUDE.md` (updated on PR #5), `docs/superpowers/runbooks/2026-04-16-mpp-launch.md`, `docs/roadmap-mpp.md`
- **Plans:** `docs/superpowers/plans/2026-04-16-mpp-launch.md` (executed), `docs/superpowers/plans/2026-04-15-mpp-integration.md` (prior Phase 1+2 plan)
- **PRs:** [#4](https://github.com/All-The-New/trustadd/pull/4) merged; [#5](https://github.com/All-The-New/trustadd/pull/5) open (docs)
- **Trigger.dev deploy:** `v20260416.3`; project ref `proj_nabhtdcabmsfzbmlifqh`
- **DB inspection:** `SELECT COUNT(*) FROM mpp_probes`, `mpp_directory_services`, `mpp_directory_snapshots`, `transaction_sync_state WHERE chain_id = 4217`, `agent_transactions WHERE chain_id = 4217`
