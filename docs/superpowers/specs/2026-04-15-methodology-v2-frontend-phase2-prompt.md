# Methodology v2 Frontend — Phase 2 Design + Implementation

## Context

You are continuing the frontend half of the Methodology v2 migration. **Phase 1 design is LOCKED** (commit `cd0ad10` on branch `feat/methodology-v2-backend`). Backend is complete (commit `d67f8cd`, 263/263 tests). This session covers Phase 2 design (remaining surfaces) and then implementation of everything.

## Read before starting

1. **Phase 1 design spec (LOCKED — do not re-open):** `docs/superpowers/specs/2026-04-15-methodology-v2-frontend-design.md` — Trust Rating stamp (Certificate Card, 3 sizes, tier-dominant, blue lockup), Banner Zone (cinematic hero), naming (Trust Rating/Trust Score/Verdict/TrustAdd), color system, responsive chip rules. Visual mockups in `.superpowers/brainstorm/`.
2. **Backend contract:** `server/trust-report-compiler.ts` (types: `Verdict`, `QuickCheckData`, `FullReportData`, `TrustRating`, `EvidenceBasis`, `Verification`, `REPORT_VERSION=3`), `server/trust-score.ts` (5 categories, 21 signals), `server/trust-verifications.ts` (9 verifications), `server/routes/helpers.ts` (`PublicVerdict = Verdict | "UNKNOWN"`, `verdictFor`, `redactAgentForPublic`).
3. **Original methodology spec:** `docs/superpowers/specs/2026-04-13-methodology-v2-design.md`
4. **Backend branch log:** `git log --oneline main..feat/methodology-v2-backend`
5. **Current v1 frontend surfaces to migrate:** `client/src/components/agent-card.tsx`, `client/src/pages/agent-profile.tsx`, directory/leaderboard pages, Trust API demo page, analytics/status pages, `server/storage/agents.ts` SQL thresholds

## Phase 2 design work (brainstorm with user, then lock)

Continue using `/brainstorming` with the visual companion for design questions that need visual treatment. Use terminal for text-based questions.

### Surfaces to design:

1. **Mobile banner** (<640px) — stacked layout. Image full-width, title, chips, stamp (full-width hero size). How does description expand? Where does MORE go?

2. **Verifications strip** — 9 binary badges (Multi-Chain, x402 Enabled, GitHub Connected, Farcaster Connected, IPFS Metadata, OASF Skills, Early Adopter, Active Maintainer, First Transaction). Show ALL 9 always (earned = colored, unearned = greyed) or only earned? How does "Multi-Chain" badge show the chain count (absorbed from banner)? Responsive behavior for mobile?

3. **Evidence basis callout** — the "Based on N verified transactions from M unique payers" summary. Where does it sit? Between banner and verifications? Its own card? How to handle "profile data only — no verified transactions recorded yet" gracefully without implying the agent is bad?

4. **Disclaimers** (pullable later):
   - "Early-stage ecosystem" — Methodology v2 is new, attestation category scores zero (effective ceiling ~75/100). Applies to ALL agents. Should be easy to remove when v3 ships.
   - "Insufficient data" — for agents with UNVERIFIED/INSUFFICIENT_DATA verdict. Per-agent, contextual.
   - Treatment: banner callout? Below verifications? Collapsible?

5. **Progressive-disclosure tabs** — current v1 tabs: Overview, History, Activity, Community. Proposed v2: Overview / Score Breakdown / On-Chain Activity / Community / History. What goes in each? What's free vs gated behind $0.05 Full Report CTA?

6. **Leaderboard card** — redesign `agent-card.tsx` with Trust Rating stamp (leaderboard 150×60 size). How does the card compose with agent name, description, image, chain badge, and the stamp? This is the second-most-viewed UI after the profile page.

7. **Trust API demo page** (`client/src/pages/trust-api.tsx`) — live-demo block hits paid endpoints. Update JSON examples to show the new two-layer shape (trustRating + verifications).

8. **Score distribution analytics** — `getTrustScoreDistribution` returns 10-point buckets. Map them to 6-tier labels. How to tell the story ("most agents are UNVERIFIED — here's why").

9. **Content updates** — marketing copy on home page, trust-api page. Does "Five Dimensions of Agent Trust" language on the home page need to change to match v2 "Five Categories"?

10. **SQL threshold refresh** — `server/storage/agents.ts` lines 77, 806, 831: v1-era thresholds (30 for CAUTION, 60 for TRUSTED). Update to v2 boundaries (40 for BUILDING, 60 for TRUSTED)? Or keep 30 since v2 scores compress downward?

11. **Deploy choreography** — atomic cutover (backend + frontend merged together), cache flush, score recalculation, verification checklist.

12. **Test strategy** — component tests for VERDICT_CONFIG migration (vitest), manual smoke on key pages, Playwright flows on demo endpoints?

## Phase 1 decisions summary (DO NOT re-open)

- **Naming:** Trust Rating (product), Trust Score (number), Verdict (API enum), TrustAdd (brand via shield mark)
- **Trust Rating stamp:** Certificate Card, split-block (icon slab + info block). 3 sizes: hero (340×101), leaderboard (150×60), chip (32px tall). Tier-dominant hierarchy (tier 42px/900, score 28px/800). Shield + "TRUST RATING" lockup in brand blue.
- **Color system:** Blue = brand (constant). Tier color = assessment (variable). 6 tiers + UNKNOWN = 7 visual states. Colors: VERIFIED=#10b981, TRUSTED=#22c55e, BUILDING=#3b82f6, INSUFFICIENT_DATA=#a1a1aa, UNVERIFIED=#71717a, FLAGGED=#ef4444, UNKNOWN=#64748b.
- **Banner Zone:** Cinematic hero. Image 160×160 (fallback: charcoal + faded grey robot). Row 1: eyebrow (classification + status) + 1-line title (clamp + ellipsis). Row 2: 2-line description (clamp + MORE) + 1-row identity chips (progressive drops: Controller <1100px, Payment <900px) + stamp 260×80 bottom-right.
- **Chain chip:** most-txs → first-registered heuristic for display order. `⬡ Base +4` + hover tooltip. No "primary" language.
- **Identity chips:** all grey (including Payment). Labels: ID, CONTRACT, CONTROLLER, PAYMENT (conditional on x402).

## Implementation guardrails

- **No code edits during Phase 2 design.** Lock all surfaces before writing code.
- **Backend contract is frozen.** Don't invent fields.
- **Source of truth for strings/colors:** `content-zones.ts` METHODOLOGY + `methodology.tsx` VERIFICATIONS + the Phase 1 design spec above.
- **Deploy blocked on both pieces shipping.** Atomic cutover, no intermediate deploys.
- **Git author:** `All The New <admin@allthenew.com>`
- **After Phase 2 design locks:** Execute via `/subagent-driven-development`. Stop before deploy — user reviews and choreographs the cutover.
