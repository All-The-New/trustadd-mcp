# New Session Prompt — Methodology v2 Frontend Implementation + Deploy

Copy-paste the block below into a fresh Claude Code session to pick up this work.

---

## Prompt

Continue the methodology v2 frontend rollout. **All design work is complete.** This session focuses on creating the implementation + deployment plan, executing the implementation via subagent-driven-development, and coordinating the atomic deploy.

### Read before starting

1. **Phase 2 design spec (LOCKED — single source of truth for all design decisions):** `docs/superpowers/specs/2026-04-15-methodology-v2-frontend-phase2-design.md` — 17 sections covering: verdict consolidation (5 visible tiers), mobile banner, below-banner structure (Option C), 5 tab wireframes, zone-level activation, Score tab gauge + category breakdown, 64×64 square leaderboard stamp, priority verification chips with overflow, Trust API page updates, Ecosystem Distribution analytics, content copy updates, SQL thresholds, deploy choreography, test strategy, naming (Authenticity for public, sybil internal), v3 backlog.

2. **Phase 1 design spec (LOCKED):** `docs/superpowers/specs/2026-04-15-methodology-v2-frontend-design.md` — Trust Rating stamp sizes, Banner Zone, color system. **Note:** Phase 2 spec updates the stamp sizes: leaderboard is now **64×64 square** (replacing the 150×60 rectangular size that's no longer used).

3. **Backend current state:** branch `feat/methodology-v2-backend`, commit `d67f8cd`, 263/263 tests green. Two small backend deltas are needed on top of this branch — called out in Phase 2 spec §1:
   - Verdict consolidation: remove `UNVERIFIED` from union, rename `INSUFFICIENT_DATA` → `INSUFFICIENT`, simplify `computeVerdict()` thresholds
   - New `categoryStrengths` field on `trustRating` exposing qualitative tier buckets (`high/medium/low/none`) per category, keeping raw numeric scores gated

4. **Visual mockups (reference only, 20+ screens):** `.superpowers/brainstorm/*/content/*.html`

5. **Memory files** — `project_next_tasks.md` and `project_system_state.md` already updated with Phase 2 status.

### Context

- **Site is public but pre-launch (stealth mode)** — no meaningful traffic. Can assume reasonable risk for faster iteration. Post-launch will shift to more careful dev posture.
- **Git author:** `All The New <admin@allthenew.com>` (required for Vercel Hobby deploys)
- Backend + frontend + Trigger.dev tasks deploy atomically in one PR — explicitly planned in Phase 2 spec §13

### Suggested workflow

1. **Invoke `/superpowers:writing-plans`** to create an implementation plan from the Phase 2 design spec. The plan should follow the sequencing in Phase 2 spec §17:
   - Backend type changes on `feat/methodology-v2-backend` branch (verdict consolidation + `categoryStrengths`)
   - Frontend component library (`<TrustStamp />`, `<VerificationChips />`, `<ScoreRail />`, `<CategoryBars />`, `<ZoneCard />`)
   - Agent profile page rewrite (banner + 5 tabs + zone activation)
   - Leaderboard card rewrite
   - Trust API page updates
   - Methodology page (new Ecosystem Distribution section + copy)
   - Analytics page (score distribution redesign)
   - Content zones + SQL threshold edits
   - Tests throughout
   - Atomic deploy coordination

2. **Invoke `/superpowers:subagent-driven-development`** to execute the plan with independent task parallelization.

3. **Stop before deploy** — user reviews implementation output and coordinates the atomic cutover per Phase 2 spec §13.

### Guardrails

- **Phase 1 + Phase 2 design are LOCKED.** Don't re-open design questions. If a true blocker surfaces during implementation, call it out to the user — don't invent a new decision unilaterally.
- **Backend contract is frozen except for the two deltas** explicitly listed in Phase 2 spec §1.
- **Don't skip hooks** or bypass git signing.
- **Stamp sizes:** hero 340×101 (profile banner) · square 64×64 (leaderboard card) · mobile chip 32px (score rail + inline). The old 150×60 size is deprecated.
- **Tier count:** 5 visible tiers. UNKNOWN is API-only; UI renders null-score as INSUFFICIENT with `—`.
- **Public-facing category name:** "Authenticity" (was Sybil Resistance). Internal identifier `sybil` unchanged.
- **Pricing display:** keep all pricing on the Trust API page only. Profile pages show only "View on Trust API →" CTAs.

### Deploy outline (from Phase 2 spec §13, for reference)

1. Single PR to main — backend deltas + frontend rewrite + Trigger.dev task updates together
2. Vercel deploys API + SPA atomically (~2 min)
3. GitHub Actions deploys Trigger.dev (~4–5 min) — short window where tasks may emit old verdict strings, acceptable pre-launch
4. Post-deploy: `UPDATE trust_reports SET expires_at = NOW()` (flush cache) → manually trigger `recalculate-scores` (refreshes ~100k agents) → `npx vercel deploy --prod` (fresh edge cache) → spot-check 5–10 agents + Trust API demo
5. Rollback: `git revert` merge commit → push. No DB migration, nothing at the data layer to revert.

---

**End of prompt.**
