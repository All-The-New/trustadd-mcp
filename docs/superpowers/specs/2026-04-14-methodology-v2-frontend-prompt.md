---
name: Methodology v2 frontend — planning + implementation kickoff
description: Self-contained prompt for the next session. Start with a planning pass (no code) before implementing frontend changes to consume the v2 backend.
created: 2026-04-14
---

# Kickoff Prompt (paste as first message next session)

> You are picking up the **frontend half** of the Methodology v2 migration. Backend is **complete** on branch `feat/methodology-v2-backend` (commit `d67f8cd`, 263/263 tests green, audited via Codex). Deploying the backend without the frontend would crash the public SPA — `client/src/components/agent-card.tsx` and `client/src/pages/agent-profile.tsx` still type `Verdict = "TRUSTED" | "CAUTION" | "UNTRUSTED" | "UNKNOWN"`, and `VERDICT_CONFIG[verdict]` lookups will be `undefined` for every v2 agent.
>
> ## THIS SESSION STARTS WITH PLANNING. NO CODE UNTIL THE PLAN IS SIGNED OFF.
>
> Use `/brainstorming` (or the `superpowers:brainstorming` skill directly) as the first tool call. The goal of the planning pass is a written plan in `docs/superpowers/plans/2026-04-14-methodology-v2-frontend.md` that I (the user) review and approve before any implementation begins. If you realize mid-planning that you need a deeper design exploration on a specific surface, break it out into its own brainstorm sub-step rather than guessing.
>
> ## Read before planning
>
> 1. **Backend branch**: `git log --oneline main..feat/methodology-v2-backend` — 8 commits. Key files: `server/trust-score.ts` (types + pure scorer), `server/trust-verifications.ts` (9 verifications), `server/trust-report-compiler.ts` (6-tier Verdict, `FullReportData`, `TrustRating`, `EvidenceBasis`, `Verification`, `REPORT_VERSION=3`), `server/routes/helpers.ts` (`PublicVerdict = Verdict | "UNKNOWN"`).
> 2. **Spec**: `docs/superpowers/specs/2026-04-13-methodology-v2-design.md` — v1→v2 migration rationale, tier semantics, badge definitions, score distribution expectations.
> 3. **Methodology page (source of truth for strings/colors)**: `client/src/pages/methodology.tsx` + `client/src/lib/content-zones.ts` METHODOLOGY export + VERIFICATIONS array. Already live in prod (commit c7d65fb). Use its color palette and icon choices as the visual vocabulary.
> 4. **Known v1 frontend surfaces that consume verdicts** (enumerate more during planning):
>    - `client/src/components/agent-card.tsx` — `VERDICT_CONFIG` table, used in directory / leaderboards / "top trusted" tiles
>    - `client/src/pages/agent-profile.tsx` — `VERDICT_CONFIG` + rendering of the detailed report (needs new `trustRating` / `verifications` / `evidenceBasis` layers)
>    - Any component that reads `/api/v1/trust/*` (paid endpoints) — shape changed: no more top-level `trust.*`, now `trustRating.*` + sibling `verifications[]`
>    - `/trust-api` demo/playground page — live-demo block hits the paid endpoints
>    - Leaderboard and directory pages — filter + order depend on verdict bucketing
>    - Status / analytics pages — `getTrustScoreDistribution` returns 10-point buckets; map them to 6-tier labels
> 5. **Backend data contract for the frontend** (read carefully):
>    - `QuickCheckData` (`server/trust-report-compiler.ts:55-73`) — shape the $0.01 endpoint returns. New fields: `verificationCount` (0-9), `evidenceBasis`. Uses 6-tier UPPERCASE `Verdict`.
>    - `FullReportData` (`server/trust-report-compiler.ts:108-163`) — shape the $0.05 endpoint returns. **Two-layer**: `trustRating` (score + verdict + breakdown + evidenceBasis + confidence + provenance + qualityTier/spamFlags/lifecycleStatus/updatedAt) and `verifications[]` (all 9 entries, earned or not).
>    - `/api/agents` free-tier response now emits one of the 6 v2 verdicts (via `redactAgentForPublic` → `verdictFor` → `computeVerdict`). `"UNKNOWN"` is still emitted for agents with null `trustScore`.
>    - 5 categories (not 5 dimensions): `categories: { transactions, reputation, profile, longevity, community }` with maxes `35/25/15/15/10`.
>    - 21 signals (not 17), each with `category` (not `dimension`) and canonical human-readable `name` strings matching content-zones.ts.
> 6. **Backend quirks that shape frontend expectations**:
>    - **Attestations always score 0 in v2** — the 25-point Reputation category is unreachable until the v3 attestation pipeline lands. Effective ceiling is ~75/100. UI should still show the category (it's in the spec) but gracefully communicate "container before content".
>    - **Provenance is honest about gaps** — `trustRating.provenance.methodologyVersion` is `number | null` (not always v2). A non-null value always pairs with non-null `signalHash` + `scoredAt`. Render a "provenance incomplete" state when any of the three is null.
>    - **`sybil.rawScoreBeforeDampening`** — numeric value showing what the score would be without dampening, for the "here's why we knocked you down" disclosure panel. Only present when sybil signals exist.
>
> ## Planning deliverables (what the plan doc must answer)
>
> Brainstorm each of these with me. Don't guess; ask questions.
>
> 1. **Verdict visual language**: 6 tiers need distinct colors + icons. The methodology page already picked a palette — does the rest of the UI adopt it verbatim, or do we want different treatments for "badge in a card" vs "hero banner on profile"? What about the `UNKNOWN` state for unscored agents (7th visual state on free-tier cards)?
> 2. **Directory/leaderboard ordering under v2**: `server/storage/agents.ts` currently uses v1-era SQL (`>= 30` for TRUSTED bucket, `>= 60` for top). Should frontend drive UX that stays consistent with those buckets, or do we refresh the SQL thresholds (30→40 for BUILDING, or keep 30 because v2 scores compress downward)? Is there a score distribution we want to preview before deciding?
> 3. **Agent profile redesign scope**: The `FullReportData` shape changed substantively. Do we do a minimal port (same visual, just feed new data) or take the opportunity to restructure the panels around the two-layer architecture (a Trust Rating card + a Verifications strip + an Evidence Basis callout)? What's the minimum ship to avoid regressing vs v1?
> 4. **Evidence Basis treatment**: Should this appear on the free-tier agent card too (it fits the "honest about gaps" principle) or only on the paid full report? How do we handle the "profile data only — no verified transactions recorded yet" summary visually without implying the agent is bad?
> 5. **Verifications display**: 9 binary badges. Show all 9 always (grayed when unearned) or only earned ones? On cards vs profile pages differently? How does this interact with Profile Image (which is also a badge-feeling signal but part of the score)?
> 6. **Trust API demo page**: It shows live JSON responses. Do we update it to show the new two-layer shape as-is (documentation use), or also demo a "rendered" version so integrators see what they can build?
> 7. **Analytics / leaderboard v2 mapping**: The 10-point score-distribution buckets need a 6-tier overlay. Is there a story here ("where do most agents land? UNVERIFIED is the largest bucket — here's why") worth telling explicitly?
> 8. **Content updates**: `/api/v1/trust/methodology` already returns v2 methodology. Does any marketing copy need updating (home, /trust-api, /methodology — though that last one already is v2)?
> 9. **Deploy choreography**: Do we ship backend + frontend in one atomic merge (safer, bigger blast radius) or stage (harder to coordinate)? What dark-launch / feature-flag story, if any?
> 10. **Test strategy**: The backend has 263 tests. What does "tested" mean for the frontend — component tests via vitest/testing-library, Playwright flows on the demo endpoints, manual smoke on key pages?
>
> ## Planning guardrails
>
> - **No code edits during planning.** If you catch yourself reaching for the Edit tool, stop and ask.
> - **Read the backend contract literally.** The type signatures in `server/trust-report-compiler.ts` are the spec — don't invent fields.
> - **Source of truth for strings/colors = content-zones.ts METHODOLOGY + methodology.tsx VERIFICATIONS.** Deviating from those requires explicit reason.
> - **Deploy is blocked on both pieces shipping.** We're NOT doing a backend-only intermediate deploy. Planning should assume atomic cutover.
> - **Author for any commits once implementation starts**: `All The New <admin@allthenew.com>` (per CLAUDE.md).
>
> ## Once the plan is approved
>
> Execution follows `superpowers:subagent-driven-development` (same as the backend session). Stop before deploy — I'll review and choreograph the cutover.
>
> ## Deploy order (informational, for context only)
>
> When both sides are ready and approved:
> 1. Merge the frontend branch into `feat/methodology-v2-backend` (or sibling branch into `main`).
> 2. Deploy to Vercel (atomic — backend + frontend in the same deploy).
> 3. Run `UPDATE trust_reports SET expires_at = NOW()` via Supabase MCP to flush v1/v2 cache (backup: version mismatch auto-invalidates on next read).
> 4. Trigger `recalculate-scores` task manually via Trigger.dev MCP to refresh all 102k agent scores under v2 (~5 min).
> 5. Verify: `/api/v1/trust/distribution` (or the admin distribution endpoint) shows all 6 tiers populated; SPA free-tier cards render correctly; paid endpoints return the two-layer shape; Sentry shows no verdict-lookup errors.
> 6. Post-deploy: refresh `server/storage/agents.ts` v1-era comments + ordering thresholds in tandem with the new tier semantics (flagged as a follow-up in the backend audit, not the frontend session's scope but worth doing on this branch).

Begin by reading task #0 in `~/.claude/projects/-Users-ethserver-CLAUDE-trustadd/memory/project_next_tasks.md`, then the backend contract files above, then invoke `/brainstorming` to start the planning pass.
