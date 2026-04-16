# Methodology v2 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship methodology v2's frontend (stamp + banner + tabs + leaderboard + API page + analytics + copy) together with two small backend deltas, behind a single atomic deploy.

**Architecture:** The backend is already on branch `feat/methodology-v2-backend` (commit `d67f8cd`, 263/263 tests green). Two surgical backend deltas land first (verdict consolidation + `categoryStrengths`), then a self-contained frontend component library (`<TrustStamp />`, `<VerificationChips />`, `<ScoreRail />`, `<CategoryBars />`, `<ZoneCard />`) is built bottom-up. Those primitives drive a full rewrite of the agent profile page and leaderboard card, plus contained edits to Trust API / Methodology / Analytics. All landing together in one PR per spec §13.

**Tech Stack:** TypeScript 5, Vitest 4, React 18 + Vite, TanStack Query v5, wouter, Tailwind 3, shadcn/ui, Lucide icons, react-icons (Si* social brand marks).

**Canonical references:**
- Phase 2 design spec (LOCKED): `docs/superpowers/specs/2026-04-15-methodology-v2-frontend-phase2-design.md`
- Phase 1 design spec (LOCKED): `docs/superpowers/specs/2026-04-15-methodology-v2-frontend-design.md`
- Visual mockups: `.superpowers/brainstorm/61829-1776360426/content/*.html`, `.superpowers/brainstorm/96852-1776311515/content/*.html`, `.superpowers/brainstorm/73676-1776293284/content/*.html`

**Do NOT re-open design decisions.** If a true blocker surfaces (e.g. production data contradicts a threshold), flag it and stop; don't invent a new decision.

**Git author (required for Vercel Hobby):** `All The New <admin@allthenew.com>`. Every commit in this plan assumes this is already configured (`git config user.name / user.email` or `.gitconfig`). Do not pass `--author` flags.

**Branching:** All work lands on `feat/methodology-v2-backend`. Do NOT create a new frontend branch — spec §13 mandates atomic merge.

**Deploy choreography:** NOT in this plan. The final task stops before merge; the user coordinates the atomic cutover per spec §13.

---

## File Structure

Legend: `NEW` = create; `MODIFY` = edit existing; `RENAME` = move or rename.

### Backend (on `feat/methodology-v2-backend`)
- `server/trust-report-compiler.ts` — MODIFY. Drop `UNVERIFIED`, rename `INSUFFICIENT_DATA` → `INSUFFICIENT`, simplify `computeVerdict()`, extend `TrustRating` with `categoryStrengths`, populate it in `compileFullReport()` and `compileQuickCheck()`.
- `server/trust-categories.ts` — NEW. Pure tier-bucketing helpers: `deriveCategoryStrengths(breakdown, sybilRiskScore)` returns the 5-key `{identity, behavioral, community, authenticity, attestation}` high/medium/low/none object.
- `server/trust-methodology.ts` — MODIFY. Drop UNVERIFIED from returned methodology JSON; rename INSUFFICIENT_DATA label.
- `__tests__/verdict-logic.test.ts` — MODIFY. Rewrite describe blocks for 5-tier; delete UNVERIFIED cases.
- `__tests__/free-tier.test.ts` — MODIFY. Rename expected verdict strings.
- `__tests__/sybil-detection.test.ts` — MODIFY. Rename expected verdict in the dampening assertion.
- `__tests__/category-strengths.test.ts` — NEW. Unit-tests for the bucketing pure function.

### Frontend component library (all NEW)
- `client/src/lib/address-color.ts` — extract shared `addressToColor()` helper used by 4 files today.
- `client/src/lib/verdict.ts` — typed tier config (color, icon, label, score range). Single source of truth imported by every stamp/badge.
- `client/src/components/trust-stamp.tsx` — `<TrustStamp />` with three sizes (hero/square/chip). Null-score fallback renders INSUFFICIENT + `—`.
- `client/src/components/verification-chips.tsx` — `<VerificationChips />` with priority ordering + overflow logic via a small `useChipOverflow` hook.
- `client/src/components/score-rail.tsx` — `<ScoreRail />` segmented bar with floating chip + white-dot marker + edge clamping.
- `client/src/components/category-bars.tsx` — `<CategoryBars />` rendering the 5 public category bars driven by `categoryStrengths`.
- `client/src/components/zone-card.tsx` — `<ZoneCard />` wrapper enforcing the 3px border + "NONE"/earned status tag rules from spec §6.

### Frontend pages (MODIFY)
- `client/src/components/chain-badge.tsx` — add `short` prop for mobile (count-only).
- `client/src/components/agent-card.tsx` — complete rewrite per spec §8.
- `client/src/pages/agent-profile.tsx` — complete rewrite: banner (§3-§4) + 5 tabs (§5) + zone activation (§6) + score tab (§7).
- `client/src/pages/trust-api.tsx` — update per spec §9 (verdict variants, JSON examples, demo card with 48×48 stamp).
- `client/src/pages/methodology.tsx` — update V2_TIERS (drop UNVERIFIED), rename INSUFFICIENT_DATA, add "Ecosystem Distribution" section (§10).
- `client/src/pages/analytics.tsx` — redesign Score Distribution using new 5-tier summary strip + 10-bucket tier-colored histogram + narrative (§10).
- `client/src/pages/api-docs.tsx` — swap old verdict strings in the schema description fields.
- `client/src/lib/content-zones.ts` — HOME.pillars → 5 items; ABOUT.score.intro verdict list; METHODOLOGY + SEO updates per spec §11.

### SQL + routes (MODIFY)
- `server/storage/agents.ts` — bump leaderboard floor from 30 → 40 (line 807); add tier field to `getTrustScoreDistribution` return; add `getTrustScoreTierTotals()` for the 5-tier summary strip.
- `server/routes/agents.ts` — new route `GET /api/analytics/trust-tiers` that fans out to the new storage function.
- `server/routes/helpers.ts` — extend `redactAgentForPublic` to include `categoryStrengths` when a `trustScoreBreakdown` is present.

### Component tests (NEW)
- `vitest.browser.config.ts` — jsdom-environment config for `.browser.test.tsx` files.
- `package.json` — add `test:browser` script + `jsdom` + `@testing-library/react` + `@testing-library/jest-dom` devDeps.
- `__tests__/browser/setup.ts` — `@testing-library/jest-dom` side-effect import.
- `__tests__/browser/trust-stamp.browser.test.tsx` — 5 tier variants + null fallback.
- `__tests__/browser/verification-chips.browser.test.tsx` — priority ordering + overflow at 0, 1, 3, 5, 8, 9.
- `__tests__/browser/score-rail.browser.test.tsx` — chip positions at 0, 50, 72, 92.

### Documentation
- `docs/smoke-checklist-methodology-v2.md` — NEW. Manual pre-deploy smoke checklist derived from spec §14.

---

## Sequencing

Phases run in order; tasks within a phase can be parallelized by subagents where noted.

- **Phase 1 — Backend deltas** (Tasks 1–7) — must complete before any frontend work that depends on `categoryStrengths`.
- **Phase 2 — Primitives** (Tasks 8–15) — component library, each pure + self-contained.
- **Phase 3 — Agent profile rewrite** (Tasks 16–22) — depends on Phase 2.
- **Phase 4 — Leaderboard card** (Tasks 23–24) — depends on Phase 2.
- **Phase 5 — Other pages** (Tasks 25–30) — can run in parallel once Phase 2 is done.
- **Phase 6 — SQL + routes** (Tasks 31–33) — can run in parallel with Phase 5.
- **Phase 7 — Browser component tests** (Tasks 34–37) — last, after components stable.
- **Phase 8 — Smoke checklist + handoff** (Task 38) — stops before merge.

---

# PHASE 1 — Backend deltas

## Task 1: Verdict consolidation — type + `computeVerdict()`

**Files:**
- Modify: `server/trust-report-compiler.ts` (lines 30–45 Verdict union, lines 192–226 computeVerdict + block comment)

- [ ] **Step 1: Edit the Verdict union** — replace the existing type definition:

```ts
/**
 * 5-tier verdict (methodology v2, consolidated from the earlier 6-tier).
 *
 * UPPERCASE in memory and in the JSON blobs. The `verdict` column in
 * `trust_reports` is lowercased at write time for backward compatibility
 * with existing SQL aggregation queries.
 */
export type Verdict =
  | "VERIFIED"       // 80-100
  | "TRUSTED"        // 60-79
  | "BUILDING"       // 40-59
  | "INSUFFICIENT"   // 0-39 (absorbs the old UNVERIFIED + INSUFFICIENT_DATA)
  | "FLAGGED";       // only when active negative evidence present
```

- [ ] **Step 2: Rewrite `computeVerdict()` body** — replace the existing function with:

```ts
/**
 * Compute a 5-tier verdict from score + active-negative-evidence signals.
 *
 * FLAGGED is reserved for ACTIVE negative evidence (spam/archived quality
 * tier, archived lifecycle, or spam flags plus a very low score). A benign
 * low-data agent at score 3 stays INSUFFICIENT — benefit of the doubt.
 */
export function computeVerdict(input: VerdictInput): Verdict {
  const flags = input.spamFlags ?? [];
  const tier = input.qualityTier;
  const status = input.lifecycleStatus ?? "active";

  // Hard FLAGGED: active negative evidence required
  if (tier === "spam" || tier === "archived") return "FLAGGED";
  if (status === "archived") return "FLAGGED";
  if (flags.length > 0 && input.score < 10) return "FLAGGED";

  // Score-based tiers
  if (input.score >= 80) return "VERIFIED";
  if (input.score >= 60) return "TRUSTED";
  if (input.score >= 40) return "BUILDING";
  return "INSUFFICIENT";
}
```

- [ ] **Step 3: Run the suite — expect failures**

```bash
npm test -- __tests__/verdict-logic.test.ts
```

Expected: multiple failing tests referencing `UNVERIFIED` / `INSUFFICIENT_DATA`. That's the signal Task 2 is needed next.

- [ ] **Step 4: Commit**

```bash
git add server/trust-report-compiler.ts
git commit -m "refactor(trust): consolidate verdict to 5 tiers"
```

---

## Task 2: Update `verdict-logic.test.ts` for 5-tier

**Files:**
- Modify: `__tests__/verdict-logic.test.ts`

- [ ] **Step 1: Replace the describe blocks** — delete the existing `describe("INSUFFICIENT_DATA ...")` and `describe("UNVERIFIED ...")` blocks and replace with a single consolidated block:

```ts
  describe("INSUFFICIENT (0-39)", () => {
    it("returns INSUFFICIENT at boundary 0", () => {
      expect(verdict(0, { qualityTier: "low" })).toBe("INSUFFICIENT");
    });
    it("returns INSUFFICIENT at 5", () => {
      expect(verdict(5, { qualityTier: "low" })).toBe("INSUFFICIENT");
    });
    it("returns INSUFFICIENT at 20", () => {
      expect(verdict(20, { qualityTier: "low" })).toBe("INSUFFICIENT");
    });
    it("returns INSUFFICIENT at 39 (upper boundary)", () => {
      expect(verdict(39, { qualityTier: "low" })).toBe("INSUFFICIENT");
    });
  });
```

- [ ] **Step 2: Fix the FLAGGED + edge-case expectations** — inside `describe("FLAGGED — requires active negative evidence", ...)`, replace the UNVERIFIED expectations:

```ts
    it("does NOT return FLAGGED for low score alone (benefit of doubt)", () => {
      expect(verdict(3, { spamFlags: [] })).toBe("INSUFFICIENT");
      expect(verdict(0, { spamFlags: [] })).toBe("INSUFFICIENT");
    });
    it("does NOT return FLAGGED for score >= 10 with spam flags", () => {
      expect(verdict(15, { spamFlags: ["test_agent"] })).toBe("INSUFFICIENT");
    });
    it("does NOT return FLAGGED for score exactly 10 with spam flags", () => {
      expect(verdict(10, { spamFlags: ["test_agent"] })).toBe("INSUFFICIENT");
    });
```

And in the `Edge cases` block:

```ts
    it("score 0 with no negative evidence = INSUFFICIENT", () => {
      expect(
        verdict(0, {
          qualityTier: null as unknown as string,
          spamFlags: null as unknown as string[],
          lifecycleStatus: null as unknown as string,
        }),
      ).toBe("INSUFFICIENT");
    });
```

- [ ] **Step 3: Add a deprecation test at the bottom of the `computeVerdict` top-level describe:**

```ts
  describe("Deprecated tier removal", () => {
    it("never returns UNVERIFIED (removed in v2 consolidation)", () => {
      for (let score = 0; score <= 100; score += 5) {
        const v = verdict(score, { qualityTier: "low" });
        expect(v).not.toBe("UNVERIFIED");
        expect(v).not.toBe("INSUFFICIENT_DATA");
      }
    });
  });
```

- [ ] **Step 4: Run the suite**

```bash
npm test -- __tests__/verdict-logic.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add __tests__/verdict-logic.test.ts
git commit -m "test(trust): update verdict-logic suite for 5-tier consolidation"
```

---

## Task 3: Add `categoryStrengths` derivation

**Files:**
- Create: `server/trust-categories.ts`
- Test: `__tests__/category-strengths.test.ts`

Design decision (calibrated to spec §17 starting point, internal→public mapping):
- `identity` ← profile / max 15
- `behavioral` ← (transactions + longevity) / max (35 + 15 = 50)  [longevity rolls into behavioral since it represents activity over time]
- `community` ← community / max 10
- `authenticity` ← derived from sybilRiskScore (0–1 float): `0 → high`, `<0.3 → medium`, `<0.6 → low`, `≥0.6 → none`
- `attestation` ← reputation / max 25 (in v2 this is always 0 since attestation pipeline isn't active, so this key will emit `none` today — intentional)

Bucket thresholds on the normalized 0–100 percent: `>=70 high`, `>=40 medium`, `>=1 low`, `0 none`.

- [ ] **Step 1: Write the failing test first** — create `__tests__/category-strengths.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveCategoryStrengths, type CategoryStrengths } from "../server/trust-categories.js";
import type { TrustScoreBreakdown } from "../server/trust-score.js";

function breakdown(overrides: Partial<TrustScoreBreakdown["categories"]> = {}): TrustScoreBreakdown {
  return {
    total: 0,
    categories: {
      transactions: 0,
      reputation: 0,
      profile: 0,
      longevity: 0,
      community: 0,
      ...overrides,
    },
    signals: [],
    opportunities: [],
  };
}

describe("deriveCategoryStrengths", () => {
  it("returns all 5 keys", () => {
    const s = deriveCategoryStrengths(breakdown(), 0);
    const keys: (keyof CategoryStrengths)[] = ["identity", "behavioral", "community", "authenticity", "attestation"];
    for (const k of keys) expect(s).toHaveProperty(k);
  });

  it("empty breakdown + zero sybil risk → mostly none, authenticity high", () => {
    const s = deriveCategoryStrengths(breakdown(), 0);
    expect(s.identity).toBe("none");
    expect(s.behavioral).toBe("none");
    expect(s.community).toBe("none");
    expect(s.attestation).toBe("none");
    expect(s.authenticity).toBe("high");
  });

  it("maxed profile (15/15) → identity high", () => {
    expect(deriveCategoryStrengths(breakdown({ profile: 15 }), 0).identity).toBe("high");
  });

  it("profile 9/15 (60%) → identity medium", () => {
    expect(deriveCategoryStrengths(breakdown({ profile: 9 }), 0).identity).toBe("medium");
  });

  it("profile 1/15 (6.6%) → identity low", () => {
    expect(deriveCategoryStrengths(breakdown({ profile: 1 }), 0).identity).toBe("low");
  });

  it("behavioral combines transactions + longevity normalised against 50", () => {
    // 25+10 = 35/50 = 70% → high
    expect(deriveCategoryStrengths(breakdown({ transactions: 25, longevity: 10 }), 0).behavioral).toBe("high");
    // 10+5 = 15/50 = 30% → low
    expect(deriveCategoryStrengths(breakdown({ transactions: 10, longevity: 5 }), 0).behavioral).toBe("low");
  });

  it("community 7/10 (70%) → community high", () => {
    expect(deriveCategoryStrengths(breakdown({ community: 7 }), 0).community).toBe("high");
  });

  it("reputation (attestation) always 'none' when value is 0", () => {
    expect(deriveCategoryStrengths(breakdown({ reputation: 0 }), 0).attestation).toBe("none");
  });

  it("authenticity bucketed by sybilRiskScore", () => {
    expect(deriveCategoryStrengths(breakdown(), 0).authenticity).toBe("high");
    expect(deriveCategoryStrengths(breakdown(), 15).authenticity).toBe("medium");
    expect(deriveCategoryStrengths(breakdown(), 45).authenticity).toBe("low");
    expect(deriveCategoryStrengths(breakdown(), 80).authenticity).toBe("none");
  });

  it("null sybilRiskScore treated as 0 (high authenticity)", () => {
    expect(deriveCategoryStrengths(breakdown(), null).authenticity).toBe("high");
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- __tests__/category-strengths.test.ts
```

Expected: `Cannot find module '../server/trust-categories.js'`.

- [ ] **Step 3: Create `server/trust-categories.ts`:**

```ts
import type { TrustScoreBreakdown } from "./trust-score.js";

export type StrengthTier = "high" | "medium" | "low" | "none";

export interface CategoryStrengths {
  identity: StrengthTier;
  behavioral: StrengthTier;
  community: StrengthTier;
  authenticity: StrengthTier;
  attestation: StrengthTier;
}

export const STRENGTH_THRESHOLDS = { HIGH: 70, MEDIUM: 40, LOW: 1 } as const;

function bucket(percent: number): StrengthTier {
  if (percent >= STRENGTH_THRESHOLDS.HIGH) return "high";
  if (percent >= STRENGTH_THRESHOLDS.MEDIUM) return "medium";
  if (percent >= STRENGTH_THRESHOLDS.LOW) return "low";
  return "none";
}

// sybilRiskScore is a 0–1 float (see `computeSybilRiskScore` in sybil-detection.ts).
function authenticityTier(sybilRiskScore: number | null): StrengthTier {
  const risk = sybilRiskScore ?? 0;
  if (risk === 0) return "high";
  if (risk < 0.3) return "medium";
  if (risk < 0.6) return "low";
  return "none";
}

/**
 * Map internal 5-category numeric breakdown to the 5 public-facing strength
 * tiers. Raw numeric scores stay gated behind the $0.05 Full Report — this
 * helper produces the free-tier qualitative view.
 *
 * Public category mapping:
 *   identity       ← profile   / 15
 *   behavioral     ← (transactions + longevity) / 50
 *   community      ← community / 10
 *   authenticity   ← inverted sybilRiskScore (0 = high authenticity)
 *   attestation    ← reputation / 25  (always 'none' in v2, pipeline inactive)
 */
export function deriveCategoryStrengths(
  breakdown: TrustScoreBreakdown,
  sybilRiskScore: number | null,
): CategoryStrengths {
  const c = breakdown.categories;
  const identityPct = (c.profile / 15) * 100;
  const behavioralPct = ((c.transactions + c.longevity) / 50) * 100;
  const communityPct = (c.community / 10) * 100;
  const attestationPct = (c.reputation / 25) * 100;

  return {
    identity: bucket(identityPct),
    behavioral: bucket(behavioralPct),
    community: bucket(communityPct),
    authenticity: authenticityTier(sybilRiskScore),
    attestation: bucket(attestationPct),
  };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- __tests__/category-strengths.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add server/trust-categories.ts __tests__/category-strengths.test.ts
git commit -m "feat(trust): categoryStrengths derivation (5-key qualitative)"
```

---

## Task 4: Wire `categoryStrengths` into the `TrustRating` shape

**Files:**
- Modify: `server/trust-report-compiler.ts` (TrustRating interface lines 89–112, compileFullReport ~510–535, compileQuickCheck ~417–447)

- [ ] **Step 1: Extend `TrustRating` interface** — add the field after `confidence`:

```ts
import type { CategoryStrengths } from "./trust-categories.js";
import { deriveCategoryStrengths } from "./trust-categories.js";
```

(Place the import near the other `./trust-*.js` imports at the top of the file.)

Then in `TrustRating`:

```ts
export interface TrustRating {
  score: number;
  verdict: Verdict;
  breakdown: TrustScoreBreakdown;
  evidenceBasis: EvidenceBasis;
  confidence: ConfidenceResult;
  categoryStrengths: CategoryStrengths;  // NEW
  provenance: { /* ...unchanged... */ };
  qualityTier: string;
  spamFlags: string[];
  lifecycleStatus: string;
  updatedAt: string | null;
}
```

- [ ] **Step 2: Extend `QuickCheckData` as well** — add after `verificationCount`:

```ts
export interface QuickCheckData {
  // ...existing fields...
  verificationCount: number;
  categoryStrengths: CategoryStrengths;  // NEW — qualitative, safe for free tier
  evidenceBasis: EvidenceBasis;
  // ...rest unchanged...
}
```

- [ ] **Step 3: Populate in `compileFullReport`** — in the `trustRating` object literal inside the `return { ... }`, add after `confidence`:

```ts
    trustRating: {
      score: breakdown.total,
      verdict,
      breakdown,
      evidenceBasis,
      confidence,
      categoryStrengths: deriveCategoryStrengths(breakdown, agent.sybilRiskScore ?? 0),
      provenance: {
        // ...unchanged...
```

- [ ] **Step 4: Populate in `compileQuickCheck`** — edit its return object (around line 428) to add:

```ts
  return {
    address: agent.primaryContractAddress,
    chainId: agent.chainId,
    name: agent.name,
    verdict,
    score: breakdown.total,
    scoreBreakdown: breakdown,
    qualityTier: agent.qualityTier ?? "unclassified",
    flags: agent.spamFlags ?? [],
    x402Active: agent.x402Support === true,
    ageInDays: ageDays,
    crossChainPresence: crossChainData.count,
    transactionCount: txStats.txCount,
    verificationCount: verifications.filter(v => v.earned).length,
    categoryStrengths: deriveCategoryStrengths(breakdown, agent.sybilRiskScore ?? 0),  // NEW
    evidenceBasis,
    reportAvailable: true,
    generatedAt: new Date().toISOString(),
    reportVersion: REPORT_VERSION,
  };
```

Also update the `compileQuickCheck` signature — it currently takes 7 positional args. Since `breakdown` and `agent` are already in scope inside, no signature change is needed; just compute `categoryStrengths` inline. (`compileAndCacheReport` passes `agent` and `breakdown` already — see around line 671.)

- [ ] **Step 5: Bump REPORT_VERSION** — the shape changed, so bump the `REPORT_VERSION` constant near line 173:

```ts
export const REPORT_VERSION = 4;
```

This forces invalidation of any cached v3 reports; the invalidation check at `getOrCompileReport` (~line 797) already compares against `REPORT_VERSION`.

- [ ] **Step 6: Run the suite**

```bash
npm test
```

Expected: any pre-existing test that snapshots the trust-rating shape will now include `categoryStrengths`. If any test fails purely because of an added key, update the expected fixture; if a test fails for another reason, investigate. All other tests should stay green.

- [ ] **Step 7: Commit**

```bash
git add server/trust-report-compiler.ts
git commit -m "feat(trust): expose categoryStrengths on TrustRating + QuickCheck (bump report v4)"
```

---

## Task 5: Update `free-tier.test.ts` for INSUFFICIENT rename

**Files:**
- Modify: `__tests__/free-tier.test.ts` (lines 71–74)

- [ ] **Step 1: Rename the expected verdict string**

```ts
    it("sets correct verdict for caution agent (score 35 → INSUFFICIENT under v2)", () => {
      const redacted = redactAgentForPublic(CAUTION_AGENT as unknown as Record<string, unknown>);
      expect(redacted.verdict).toBe("INSUFFICIENT");
    });
```

- [ ] **Step 2: Run**

```bash
npm test -- __tests__/free-tier.test.ts
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add __tests__/free-tier.test.ts
git commit -m "test(free-tier): rename verdict expectation to INSUFFICIENT"
```

---

## Task 6: Update `sybil-detection.test.ts` for INSUFFICIENT rename

**Files:**
- Modify: `__tests__/sybil-detection.test.ts` (lines 274 and 282)

- [ ] **Step 1: Replace the comment on line ~274 and the expectation on line ~282**

```ts
    // After 50% dampening → score 23 → INSUFFICIENT (0-39).
    const dampenedVerdict = computeVerdict({
      score: 23,
      qualityTier: null,
      spamFlags: null,
      lifecycleStatus: null,
    });
    expect(dampenedVerdict).toBe("INSUFFICIENT");
```

- [ ] **Step 2: Run**

```bash
npm test -- __tests__/sybil-detection.test.ts
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add __tests__/sybil-detection.test.ts
git commit -m "test(sybil): rename verdict expectation to INSUFFICIENT"
```

---

## Task 7: Final Phase 1 verification — full test suite

- [ ] **Step 1: Run the entire suite**

```bash
npm test
```

Expected: **all 263+ tests green** (existing 263 + `category-strengths.test.ts` additions).

- [ ] **Step 2: Also run the type-checker**

```bash
npm run check
```

Expected: no errors. If an error surfaces in `trust-methodology.ts` referring to the old verdict strings, note it and address in a follow-up task (Task 25 covers methodology.tsx, but the server-side `trust-methodology.ts` JSON may also carry tier labels — fix them inline now in a new commit).

- [ ] **Step 3: If `trust-methodology.ts` needs fixing, edit it now**

```bash
# Quick scan
grep -n "UNVERIFIED\|INSUFFICIENT_DATA" server/trust-methodology.ts
```

If it references old strings, rename in place (`INSUFFICIENT_DATA` → `INSUFFICIENT`, drop UNVERIFIED entry), re-run `npm run check`.

- [ ] **Step 4: Commit any follow-up fixes**

```bash
git add -A
git commit -m "chore(trust): sync methodology JSON to 5-tier labels" # skip if nothing changed
```

---

# PHASE 2 — Frontend primitives

> **Design discipline:** every component in this phase is pure, self-contained, and takes props only. No queries. No state beyond what's described. No premature abstraction.

## Task 8: Shared utilities — `addressToColor` + verdict config

**Files:**
- Create: `client/src/lib/address-color.ts`
- Create: `client/src/lib/verdict.ts`

- [ ] **Step 1: Create `client/src/lib/address-color.ts`:**

```ts
/** Map an address to a procedural HSL color used for avatar fallbacks and gradients. */
export function addressToColor(address: string | null | undefined, saturation = 55, lightness = 50): string {
  if (!address) return `hsl(0, 0%, ${lightness}%)`;
  const hash = address.slice(2, 8);
  const hue = parseInt(hash, 16) % 360;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** Two hues derived from an address — used for banner radial gradients. */
export function addressToGradientPair(address: string | null | undefined): { a: string; b: string } {
  if (!address) return { a: "#1a1f2e", b: "#12151f" };
  const hash = address.slice(2, 14);
  const h1 = parseInt(hash.slice(0, 6), 16) % 360;
  const h2 = (h1 + 40) % 360;
  return {
    a: `hsl(${h1}, 40%, 22%)`,
    b: `hsl(${h2}, 35%, 12%)`,
  };
}
```

- [ ] **Step 2: Create `client/src/lib/verdict.ts`:**

```ts
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, CheckCircle, TrendingUp, CircleDot, AlertTriangle, HelpCircle } from "lucide-react";

export type Verdict = "VERIFIED" | "TRUSTED" | "BUILDING" | "INSUFFICIENT" | "FLAGGED";
export type PublicVerdict = Verdict | "UNKNOWN";

export interface VerdictDescriptor {
  tier: Verdict;
  label: string;        // display name used in stamps/chips
  shortLabel: string;   // space-constrained uppercase label, e.g. "FLAG"
  color: string;        // primary tier color (hex)
  tintBg: string;       // translucent bg for the tier-tint info block
  icon: LucideIcon;
  minScore: number;
  maxScore: number;
}

const VERIFIED: VerdictDescriptor = {
  tier: "VERIFIED", label: "VERIFIED", shortLabel: "VERIFIED",
  color: "#10b981", tintBg: "rgba(16, 185, 129, 0.14)",
  icon: BadgeCheck, minScore: 80, maxScore: 100,
};
const TRUSTED: VerdictDescriptor = {
  tier: "TRUSTED", label: "TRUSTED", shortLabel: "TRUSTED",
  color: "#22c55e", tintBg: "rgba(34, 197, 94, 0.14)",
  icon: CheckCircle, minScore: 60, maxScore: 79,
};
const BUILDING: VerdictDescriptor = {
  tier: "BUILDING", label: "BUILDING", shortLabel: "BUILDING",
  color: "#3b82f6", tintBg: "rgba(59, 130, 246, 0.14)",
  icon: TrendingUp, minScore: 40, maxScore: 59,
};
const INSUFFICIENT: VerdictDescriptor = {
  tier: "INSUFFICIENT", label: "INSUFFICIENT", shortLabel: "INSUFF",
  color: "#a1a1aa", tintBg: "rgba(161, 161, 170, 0.14)",
  icon: CircleDot, minScore: 0, maxScore: 39,
};
const FLAGGED: VerdictDescriptor = {
  tier: "FLAGGED", label: "FLAGGED", shortLabel: "FLAG",
  color: "#ef4444", tintBg: "rgba(239, 68, 68, 0.14)",
  icon: AlertTriangle, minScore: 0, maxScore: 100,
};

const BY_TIER: Record<Verdict, VerdictDescriptor> = {
  VERIFIED, TRUSTED, BUILDING, INSUFFICIENT, FLAGGED,
};

/** Resolve a descriptor for a verdict. Treats UNKNOWN + null as INSUFFICIENT (UI-only). */
export function verdictDescriptor(verdict: PublicVerdict | null | undefined): VerdictDescriptor {
  if (!verdict || verdict === "UNKNOWN") return INSUFFICIENT;
  return BY_TIER[verdict];
}

/** Helper icon for the API-level UNKNOWN tier — UI never renders this, but Trust API page does. */
export const UNKNOWN_ICON = HelpCircle;

/** All five visible descriptors, in display order (low → high, for distribution strips). */
export const TIER_ORDER: VerdictDescriptor[] = [FLAGGED, INSUFFICIENT, BUILDING, TRUSTED, VERIFIED];
```

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/address-color.ts client/src/lib/verdict.ts
git commit -m "feat(frontend): shared verdict + address-color utilities"
```

---

## Task 9: `<TrustStamp />` component

**Files:**
- Create: `client/src/components/trust-stamp.tsx`

Reads: spec §2 (tier colors/sizes), §7 (rail chip), §8 (square 64×64 stamp), Phase 1 spec lines 35–69. Visual reference: `.superpowers/brainstorm/73676-1776293284/content/07-cert-card-v6-locked.html` and `.superpowers/brainstorm/61829-1776360426/content/leaderboard-final.html`.

- [ ] **Step 1: Create the component**

```tsx
import { cn } from "@/lib/utils";
import { verdictDescriptor, type PublicVerdict } from "@/lib/verdict";

export type TrustStampSize = "hero" | "square" | "chip";

interface TrustStampProps {
  verdict: PublicVerdict | null;
  score: number | null;
  size: TrustStampSize;
  methodologyVersion?: number;   // shown in hero meta row only
  scoredAt?: string | null;       // ISO date, shown in hero meta row only
  className?: string;
}

/** Shield lockup — inline SVG so it scales crisply and inherits currentColor. */
function ShieldLockup({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="6" fill="#0a59d0" />
      <path
        d="M16 5.5 L8 9.5 L8 15 C8 20.5 11.3 25.5 16 27 C20.7 25.5 24 20.5 24 15 L24 9.5 Z"
        fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round"
      />
    </svg>
  );
}

function formatMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", year: "numeric" }).toUpperCase();
}

export function TrustStamp({ verdict, score, size, methodologyVersion, scoredAt, className }: TrustStampProps) {
  const desc = verdictDescriptor(verdict);
  const Icon = desc.icon;
  const displayScore = score == null ? "\u2014" : String(score);
  const isLongTier = desc.tier === "INSUFFICIENT";

  if (size === "hero") {
    return (
      <div
        className={cn("flex rounded-md overflow-hidden shadow-sm", className)}
        style={{ width: 340, height: 101, background: desc.tintBg }}
        data-testid="trust-stamp-hero"
        data-tier={desc.tier}
      >
        <div
          className="flex flex-col items-center justify-center shrink-0"
          style={{ width: 100, background: desc.color, color: "white" }}
        >
          <Icon className="w-11 h-11" strokeWidth={2} />
          <span className="mt-1 text-[28px] font-extrabold tabular-nums leading-none">{displayScore}</span>
        </div>
        <div className="flex-1 p-3 flex flex-col justify-between" style={{ color: desc.color }}>
          <div className="flex items-center gap-1.5">
            <ShieldLockup px={16} />
            <span className="text-[11px] font-extrabold tracking-[2px]" style={{ color: "#0a59d0" }}>TRUST RATING</span>
          </div>
          <div
            className={cn("font-black leading-none", isLongTier ? "text-[38px] tracking-normal" : "text-[42px] tracking-tight")}
          >
            {desc.label}
          </div>
          <div className="text-[9px] font-semibold tracking-wider opacity-70 flex items-center gap-2">
            <span>METHODOLOGY v{methodologyVersion ?? 2}</span>
            {scoredAt && <span>· {formatMonth(scoredAt)}</span>}
          </div>
        </div>
      </div>
    );
  }

  if (size === "square") {
    return (
      <div
        className={cn("flex flex-col rounded-md overflow-hidden shrink-0", className)}
        style={{ width: 64, height: 64, background: desc.tintBg }}
        data-testid="trust-stamp-square"
        data-tier={desc.tier}
      >
        <div
          className="flex-1 flex items-center justify-center"
          style={{ background: desc.color, color: "white", minHeight: 46 }}
        >
          <span className="text-[22px] font-extrabold tabular-nums leading-none">{displayScore}</span>
        </div>
        <div
          className={cn(
            "flex items-center justify-center font-black text-center",
            isLongTier ? "text-[8px] tracking-normal" : "text-[9px] tracking-[0.5px]",
          )}
          style={{ minHeight: 18, color: desc.color }}
        >
          {isLongTier ? desc.shortLabel : desc.label}
        </div>
      </div>
    );
  }

  // chip (32px tall, inline)
  return (
    <div
      className={cn("inline-flex items-center rounded-md overflow-hidden shrink-0", className)}
      style={{ height: 32, background: desc.tintBg }}
      data-testid="trust-stamp-chip"
      data-tier={desc.tier}
    >
      <div
        className="flex items-center gap-1 px-2 h-full"
        style={{ background: desc.color, color: "white" }}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="text-sm font-extrabold tabular-nums">{displayScore}</span>
      </div>
      <span
        className="px-2 text-[11px] font-black tracking-wider"
        style={{ color: desc.color }}
      >
        {isLongTier ? desc.shortLabel : desc.label}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/trust-stamp.tsx
git commit -m "feat(frontend): TrustStamp component (hero/square/chip)"
```

---

## Task 10: `<VerificationChips />` component with priority overflow

**Files:**
- Create: `client/src/components/verification-chips.tsx`

Reads: spec §8 "Verification chip priority order" + "Fit-as-many-as-possible".

The overflow logic is logic-testable (the widths → drop-count mapping is a pure function). We implement it as a pure helper so Task 35 can unit-test it without DOM.

- [ ] **Step 1: Create the component + pure helper**

```tsx
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Canonical priority order — earned-first, matches spec §8. */
export const VERIFICATION_PRIORITY: ReadonlyArray<{ name: string; label: string }> = [
  { name: "First Transaction", label: "1st Tx" },
  { name: "x402 Enabled",      label: "x402" },
  { name: "GitHub Connected",  label: "GitHub" },
  { name: "IPFS Metadata",     label: "IPFS" },
  { name: "OASF Skills",       label: "OASF" },
  { name: "Active Maintainer", label: "Active" },
  { name: "Farcaster Connected", label: "Farcaster" },
  { name: "Multi-Chain",       label: "Multi" },
  { name: "Early Adopter",     label: "Early" },
];

export interface EarnedVerification { name: string; earned: boolean }

/** Pure: given chip widths, available width, gap, and "+N" reserve, return how many to show. */
export function computeVisibleCount(
  widths: number[],
  available: number,
  gap: number,
  overflowReserve: number,
): { visible: number; droppedCount: number } {
  if (widths.length === 0) return { visible: 0, droppedCount: 0 };
  // Try to fit all first
  const allWithGap = widths.reduce((a, w, i) => a + w + (i === 0 ? 0 : gap), 0);
  if (allWithGap <= available) return { visible: widths.length, droppedCount: 0 };

  // Otherwise reserve room for the overflow pill and accumulate one at a time
  let used = 0;
  let visible = 0;
  for (let i = 0; i < widths.length; i++) {
    const extra = widths[i] + (visible === 0 ? 0 : gap);
    if (used + extra + gap + overflowReserve <= available) {
      used += extra;
      visible++;
    } else break;
  }
  return { visible, droppedCount: widths.length - visible };
}

interface VerificationChipsProps {
  verifications: EarnedVerification[];
  addressChip?: React.ReactNode;  // e.g. shortened address badge rendered by caller
  onOverflowClick?: () => void;
  className?: string;
}

/**
 * Renders chips in priority order. Uses a hidden measurement pass to compute
 * widths, then renders the visible subset + "+N more" if anything dropped.
 *
 * Layout: address chip (fixed width, rendered by caller if provided) + earned
 * chips (flex 1 1 auto, stretch) + overflow pill (fixed).
 */
export function VerificationChips({ verifications, addressChip, onOverflowClick, className }: VerificationChipsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<number>(verifications.length);
  const [dropped, setDropped] = useState<number>(0);

  const earnedByPriority = VERIFICATION_PRIORITY
    .filter(p => verifications.find(v => v.name === p.name && v.earned));

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const recalc = () => {
      const chipNodes = measure.querySelectorAll<HTMLElement>("[data-chip]");
      const widths = Array.from(chipNodes).map(n => n.offsetWidth);
      const available = container.offsetWidth - (addressChip ? 72 : 0); // ~72px reserve for address
      const { visible, droppedCount } = computeVisibleCount(widths, available, 5, 52);
      setVisible(visible);
      setDropped(droppedCount);
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(container);
    return () => ro.disconnect();
  }, [earnedByPriority.length, addressChip]);

  const shown = earnedByPriority.slice(0, visible);

  return (
    <div ref={containerRef} className={cn("flex items-center gap-[5px] w-full", className)} data-testid="verification-chips">
      {addressChip}
      {/* Visible chips */}
      {shown.map(p => (
        <span
          key={p.name}
          className="text-[10px] font-semibold px-2 py-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap"
          data-testid={`chip-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
        >
          ✓ {p.label}
        </span>
      ))}
      {dropped > 0 && (
        <button
          type="button"
          onClick={onOverflowClick}
          className="text-[10px] font-semibold px-2 py-1 rounded bg-muted text-muted-foreground border border-border whitespace-nowrap hover:bg-muted/80"
          data-testid="chip-overflow"
        >
          +{dropped} more
        </button>
      )}
      {/* Hidden measurement pass — renders all earned chips off-screen */}
      <div
        ref={measureRef}
        aria-hidden
        className="absolute -left-[9999px] top-0 flex items-center gap-[5px] pointer-events-none"
      >
        {earnedByPriority.map(p => (
          <span
            key={p.name}
            data-chip
            className="text-[10px] font-semibold px-2 py-1 rounded border whitespace-nowrap"
          >
            ✓ {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/verification-chips.tsx
git commit -m "feat(frontend): VerificationChips with priority overflow"
```

---

## Task 11: `<ScoreRail />` component

**Files:**
- Create: `client/src/components/score-rail.tsx`

Reads: spec §7 "Score rail header".

- [ ] **Step 1: Create the component**

```tsx
import { cn } from "@/lib/utils";
import { TrustStamp } from "./trust-stamp";
import { verdictDescriptor, type PublicVerdict } from "@/lib/verdict";

interface ScoreRailProps {
  verdict: PublicVerdict | null;
  score: number | null;
  className?: string;
}

/** Tier segment widths as percentages — matches spec §7. */
const TIER_SEGMENTS: Array<{ pct: number; color: string; label: string }> = [
  { pct: 4,  color: "#ef4444", label: "FLAG" },         // FLAGGED 0-4
  { pct: 36, color: "#a1a1aa", label: "INSUFFICIENT" }, // INSUFFICIENT 0-39 (actually 4-39, widened to 36)
  { pct: 20, color: "#3b82f6", label: "BUILDING" },     // BUILDING 40-59
  { pct: 20, color: "#22c55e", label: "TRUSTED" },      // TRUSTED 60-79
  { pct: 20, color: "#10b981", label: "VERIFIED" },     // VERIFIED 80-100
];

/** Clamp the chip translateX so it stays in-frame near edges. */
function chipOffset(pct: number): string {
  if (pct <= 10) return "0%";
  if (pct >= 90) return "-100%";
  return "-50%";
}

export function ScoreRail({ verdict, score, className }: ScoreRailProps) {
  const desc = verdictDescriptor(verdict);
  const s = score == null ? 0 : Math.max(0, Math.min(100, score));

  return (
    <div className={cn("relative w-full py-4", className)} data-testid="score-rail">
      {/* Chip floating above */}
      <div
        className="absolute top-0 z-10"
        style={{ left: `${s}%`, transform: `translateX(${chipOffset(s)})` }}
      >
        <TrustStamp verdict={verdict} score={score} size="chip" />
      </div>

      {/* Segmented bar with dot marker */}
      <div className="mt-10 relative h-2.5 rounded-full overflow-hidden flex">
        {TIER_SEGMENTS.map(seg => (
          <div key={seg.label} style={{ width: `${seg.pct}%`, background: seg.color }} />
        ))}
        <div
          className="absolute top-1/2 w-[18px] h-[18px] rounded-full bg-white border border-zinc-900 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${s}%`, boxShadow: "0 0 0 3px rgba(0,0,0,0.35)" }}
          aria-hidden
        />
      </div>

      {/* Labels under each segment */}
      <div className="relative mt-2 flex text-[9px] font-extrabold tracking-wider text-muted-foreground">
        {TIER_SEGMENTS.map(seg => (
          <div key={seg.label} style={{ width: `${seg.pct}%` }} className="text-center">
            {seg.label}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/score-rail.tsx
git commit -m "feat(frontend): ScoreRail gauge component"
```

---

## Task 12: `<CategoryBars />` component

**Files:**
- Create: `client/src/components/category-bars.tsx`

Reads: spec §7 "Score Breakdown (Option B)" and `.superpowers/brainstorm/61829-1776360426/content/score-tab-refined.html` for color palette.

- [ ] **Step 1: Create the component**

```tsx
import { User, Activity, Users, Shield, ShieldAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface CategoryStrengths {
  identity: "high" | "medium" | "low" | "none";
  behavioral: "high" | "medium" | "low" | "none";
  community: "high" | "medium" | "low" | "none";
  attestation: "high" | "medium" | "low" | "none";
  authenticity: "high" | "medium" | "low" | "none";
}

const ROWS: Array<{
  key: keyof CategoryStrengths;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  tooltip: string;
}> = [
  { key: "identity",     label: "Identity",     icon: User,        color: "#3b82f6",
    tooltip: "Controller, metadata, on-chain identity signals." },
  { key: "behavioral",   label: "Behavioral",   icon: Activity,    color: "#22c55e",
    tooltip: "Transaction patterns, payment cadence, and activity consistency." },
  { key: "community",    label: "Community",    icon: Users,       color: "#a855f7",
    tooltip: "GitHub health, Farcaster presence, external reputation." },
  { key: "attestation",  label: "Attestation",  icon: Shield,      color: "#f59e0b",
    tooltip: "Third-party verifications via on-chain attestation. Inactive in v2, scheduled for v3." },
  { key: "authenticity", label: "Authenticity", icon: ShieldAlert, color: "#ef4444",
    tooltip: "Detection of coordinated agent networks (Sybil resistance)." },
];

const STRENGTH_WIDTH = { high: 85, medium: 55, low: 25, none: 5 };

interface CategoryBarsProps {
  strengths: CategoryStrengths;
  className?: string;
}

export function CategoryBars({ strengths, className }: CategoryBarsProps) {
  return (
    <div className={cn("space-y-3", className)} data-testid="category-bars">
      {ROWS.map(row => {
        const Icon = row.icon;
        const strength = strengths[row.key];
        const width = STRENGTH_WIDTH[strength];
        return (
          <div key={row.key} className="flex items-center gap-3" data-testid={`category-${row.key}`}>
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: `${row.color}20`, color: row.color }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm font-semibold">{row.label}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] text-muted-foreground cursor-help" aria-label="info">ⓘ</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">{row.tooltip}</TooltipContent>
                </Tooltip>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${width}%`, background: row.color }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/category-bars.tsx
git commit -m "feat(frontend): CategoryBars qualitative breakdown"
```

---

## Task 13: `<ZoneCard />` generic wrapper

**Files:**
- Create: `client/src/components/zone-card.tsx`

Reads: spec §6 "Rules" for border/tag/opacity states.

- [ ] **Step 1: Create the component**

```tsx
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ZoneState = "earned" | "populated" | "empty";

interface ZoneCardProps {
  state: ZoneState;
  label: string;
  statusTag?: string;  // e.g. "IPFS ✓", "DECLARED ✓", "NONE"
  children?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

/**
 * Zone-level activation per spec §6.
 *
 *   earned    → 3px green left-border, green dot next to label, status tag
 *   populated → plain label, no border (default card styling)
 *   empty     → 3px grey left-border, content muted to ~55%, "NONE" tag
 */
export function ZoneCard({ state, label, statusTag, children, className, ...rest }: ZoneCardProps) {
  const borderClass =
    state === "earned" ? "border-l-[3px] border-l-emerald-500"
    : state === "empty"  ? "border-l-[3px] border-l-muted-foreground/40"
    : "";

  return (
    <Card
      className={cn("p-4 relative", borderClass, state === "empty" && "opacity-[0.55]", className)}
      data-testid={rest["data-testid"]}
      data-zone-state={state}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {state === "earned" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />}
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>
        {statusTag && (
          <span
            className={cn(
              "text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded",
              state === "earned" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
            )}
          >
            {statusTag}
          </span>
        )}
      </div>
      <div>{children}</div>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/zone-card.tsx
git commit -m "feat(frontend): ZoneCard wrapper for zone-level activation"
```

---

## Task 14: `<ChainBadge />` — add `short` variant

**Files:**
- Modify: `client/src/components/chain-badge.tsx`

Reads: spec §8 "Chain badge" (Desktop `⬡ Base +4`, Mobile `⬡ 5c`).

- [ ] **Step 1: Extend props**

```tsx
import { Badge } from "@/components/ui/badge";
import { getChain } from "@shared/chains";

interface ChainBadgeProps {
  chainId: number;
  size?: "sm" | "md";
  /** When `true`, render count-only (`⬡ 5c`) — use on narrow viewports. */
  short?: boolean;
  /** Optional extra-chain count to display as `+N`. Ignored when `short`. */
  extraChainCount?: number;
}

export function ChainBadge({ chainId, size = "sm", short, extraChainCount }: ChainBadgeProps) {
  const chain = getChain(chainId);
  if (!chain) return null;

  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  if (short) {
    const count = (extraChainCount ?? 0) + 1;
    return (
      <Badge
        className={`${textSize} no-default-hover-elevate no-default-active-elevate gap-1`}
        style={{ backgroundColor: chain.bgColor, color: chain.color }}
        data-testid={`badge-chain-${chain.shortName}`}
      >
        <span
          className="inline-flex items-center justify-center rounded-full font-bold"
          style={{ backgroundColor: chain.color, color: "white", width: 12, height: 12, fontSize: 8 }}
        >
          {chain.iconLetter}
        </span>
        {count}c
      </Badge>
    );
  }

  return (
    <Badge
      className={`${textSize} no-default-hover-elevate no-default-active-elevate gap-1`}
      style={{ backgroundColor: chain.bgColor, color: chain.color }}
      data-testid={`badge-chain-${chain.shortName}`}
    >
      <span
        className="inline-flex items-center justify-center rounded-full font-bold"
        style={{
          backgroundColor: chain.color,
          color: "white",
          width: size === "sm" ? 12 : 14,
          height: size === "sm" ? 12 : 14,
          fontSize: size === "sm" ? 8 : 9,
        }}
      >
        {chain.iconLetter}
      </span>
      {chain.name}
      {extraChainCount ? ` +${extraChainCount}` : ""}
    </Badge>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/chain-badge.tsx
git commit -m "feat(frontend): ChainBadge short/extraChainCount variants"
```

---

## Task 15: Phase 2 manual smoke pass

- [ ] **Step 1: Build the client** — verifies the new components compile in isolation.

```bash
npm run build:client
```

Expected: clean build, no TypeScript errors from the new primitives.

- [ ] **Step 2: Run type-check**

```bash
npm run check
```

Expected: clean.

No commit needed — this is a gate, not a change.

---

# PHASE 3 — Agent profile page rewrite

> The agent profile is a full rewrite but is structured so banner + tabs can be built incrementally. Work tasks 16→22 in order; each produces a visually complete section before moving on.

## Task 16: Scaffold the new page skeleton

**Files:**
- Modify: `client/src/pages/agent-profile.tsx` (full rewrite)

> This is the biggest single file change. The plan breaks it across tasks 16–22. Task 16 replaces the existing file with a new scaffold; tasks 17–22 fill in each tab.

- [ ] **Step 1: Back up the current file for reference** — keep a copy at hand without committing:

```bash
cp client/src/pages/agent-profile.tsx /tmp/agent-profile.v1.tsx
```

- [ ] **Step 2: Replace the file contents with the scaffold**

```tsx
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useEffect, useState } from "react";
import type { Agent, AgentMetadataEvent } from "@shared/schema";
import { getChain } from "@shared/chains";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { PROFILE } from "@/lib/content-zones";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, X as XIcon } from "lucide-react";
import { Banner } from "./agent-profile/banner";
import { OverviewTab } from "./agent-profile/overview-tab";
import { ScoreTab } from "./agent-profile/score-tab";
import { OnChainTab } from "./agent-profile/on-chain-tab";
import { CommunityTab } from "./agent-profile/community-tab";
import { HistoryTab } from "./agent-profile/history-tab";
import type { PublicVerdict } from "@/lib/verdict";

interface TrustScoreData {
  verdict: PublicVerdict;
  updatedAt?: string | null;
  reportAvailable?: boolean;
  quickCheckPrice?: string;
  fullReportPrice?: string;
  categoryStrengths?: {
    identity: "high" | "medium" | "low" | "none";
    behavioral: "high" | "medium" | "low" | "none";
    community: "high" | "medium" | "low" | "none";
    attestation: "high" | "medium" | "low" | "none";
    authenticity: "high" | "medium" | "low" | "none";
  };
}

const DISCLAIMER_STORAGE_KEY = "trustadd.v2.early-stage-disclaimer.dismissed";

function EarlyStageDisclaimer() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISCLAIMER_STORAGE_KEY) === "true"; } catch { return false; }
  });
  if (dismissed) return null;
  return (
    <div className="flex items-center gap-2 py-2 px-3 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border-l-2 border-amber-500 rounded-sm mb-3">
      <span className="font-semibold uppercase tracking-wider">⚠ Early-stage ecosystem</span>
      <span className="opacity-80">
        Attestation signals aren't active yet; effective score ceiling is ~75/100. Applies to all agents until v3.
      </span>
      <button
        onClick={() => { try { localStorage.setItem(DISCLAIMER_STORAGE_KEY, "true"); } catch {}; setDismissed(true); }}
        className="ml-auto p-1 hover:bg-amber-500/20 rounded"
        aria-label="Dismiss"
        data-testid="dismiss-early-stage-disclaimer"
      >
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function AgentProfile() {
  const [, params] = useRoute("/agent/:id");
  const id = params?.id;
  const [activeTab, setActiveTab] = useState("overview");

  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery<Agent & { verdict?: PublicVerdict; reportAvailable?: boolean }>({
    queryKey: ["/api/agents", id],
    enabled: !!id,
  });

  const gatedQueryFn = (path: string) => async () => {
    const res = await fetch(path);
    if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
    return res.json();
  };

  const { data: events, isLoading: eventsLoading } = useQuery<AgentMetadataEvent[] | { message: string; fullReportPrice: string }>({
    queryKey: ["/api/agents", id, "history"],
    queryFn: gatedQueryFn(`/api/agents/${id}/history`),
    enabled: !!id,
    retry: false,
  });

  const { data: trustScoreData } = useQuery<TrustScoreData>({
    queryKey: ["/api/agents", id, "trust-score"],
    queryFn: gatedQueryFn(`/api/agents/${id}/trust-score`),
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (!agent) return;
    const chain = getChain(agent.chainId);
    const verdict = agent.verdict ?? trustScoreData?.verdict ?? null;
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: agent.name ?? `Agent #${agent.erc8004Id}`,
      description: agent.description ?? `An AI agent on ${chain?.name ?? "EVM"} tracked by TrustAdd.`,
      url: `https://trustadd.com/agent/${agent.slug ?? agent.id}`,
      identifier: agent.primaryContractAddress,
      applicationCategory: "AI Agent",
      operatingSystem: chain?.name ?? "EVM Blockchain",
    };
    if (verdict && verdict !== "UNKNOWN") jsonLd.description = `${jsonLd.description} Verdict: ${verdict}.`;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "agent-jsonld";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => { document.getElementById("agent-jsonld")?.remove(); };
  }, [agent, trustScoreData]);

  if (agentLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Skeleton className="h-6 w-24 mb-6" />
          <Skeleton className="w-full h-[204px] rounded-md mb-4" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      </Layout>
    );
  }

  if (agentError || !agent) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Card className="p-12 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold text-lg mb-1">Agent not found</h2>
            <p className="text-sm text-muted-foreground mb-4">This agent may not exist or hasn't been indexed yet.</p>
            <Link href="/agents"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back to Directory</Button></Link>
          </Card>
        </div>
      </Layout>
    );
  }

  const verdict: PublicVerdict = agent.verdict ?? trustScoreData?.verdict ?? "UNKNOWN";

  return (
    <Layout>
      <SEO
        title={agent.name ? `${agent.name} — Agent Profile` : `Agent #${agent.erc8004Id} — Profile`}
        description={agent.description || PROFILE.defaultSeoDescription(agent.erc8004Id, getChain(agent.chainId)?.name || "EVM")}
        path={`/agent/${agent.slug ?? agent.id}`}
      />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/agents">
          <Button variant="ghost" size="sm" className="gap-1 mb-4 -ml-2" data-testid="button-back">
            <ArrowLeft className="w-3 h-3" />Back
          </Button>
        </Link>

        <Banner agent={agent} verdict={verdict} updatedAt={trustScoreData?.updatedAt ?? null} />

        <EarlyStageDisclaimer />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList data-testid="tabs-agent">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="score" data-testid="tab-score">Score</TabsTrigger>
            <TabsTrigger value="onchain" data-testid="tab-onchain">On-Chain</TabsTrigger>
            <TabsTrigger value="community" data-testid="tab-community">Community</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab agent={agent} /></TabsContent>
          <TabsContent value="score"><ScoreTab agent={agent} verdict={verdict} strengths={trustScoreData?.categoryStrengths ?? null} /></TabsContent>
          <TabsContent value="onchain"><OnChainTab agent={agent} /></TabsContent>
          <TabsContent value="community"><CommunityTab agent={agent} /></TabsContent>
          <TabsContent value="history"><HistoryTab events={events} isLoading={eventsLoading} /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 3: Create empty module stubs** — each tab will be filled in subsequent tasks, but they must exist now or the scaffold won't compile:

```bash
mkdir -p client/src/pages/agent-profile
```

- [ ] **Step 4: Create stubs with minimal valid content**

Create `client/src/pages/agent-profile/banner.tsx`:
```tsx
import type { Agent } from "@shared/schema";
import type { PublicVerdict } from "@/lib/verdict";
export function Banner(_: { agent: Agent; verdict: PublicVerdict; updatedAt: string | null }) {
  return <div className="h-[204px] rounded-md bg-muted mb-4" data-testid="banner-placeholder" />;
}
```

Create `client/src/pages/agent-profile/overview-tab.tsx`:
```tsx
import type { Agent } from "@shared/schema";
export function OverviewTab(_: { agent: Agent }) { return <div data-testid="overview-stub">Overview</div>; }
```

Create `client/src/pages/agent-profile/score-tab.tsx`:
```tsx
import type { Agent } from "@shared/schema";
import type { PublicVerdict } from "@/lib/verdict";
import type { CategoryStrengths } from "@/components/category-bars";
export function ScoreTab(_: { agent: Agent; verdict: PublicVerdict; strengths: CategoryStrengths | null }) {
  return <div data-testid="score-stub">Score</div>;
}
```

Create `client/src/pages/agent-profile/on-chain-tab.tsx`:
```tsx
import type { Agent } from "@shared/schema";
export function OnChainTab(_: { agent: Agent }) { return <div data-testid="onchain-stub">On-Chain</div>; }
```

Create `client/src/pages/agent-profile/community-tab.tsx`:
```tsx
import type { Agent } from "@shared/schema";
export function CommunityTab(_: { agent: Agent }) { return <div data-testid="community-stub">Community</div>; }
```

Create `client/src/pages/agent-profile/history-tab.tsx`:
```tsx
import type { AgentMetadataEvent } from "@shared/schema";
import { EventTimeline } from "@/components/event-timeline";
interface Props {
  events: AgentMetadataEvent[] | { message: string; fullReportPrice: string } | undefined;
  isLoading: boolean;
}
export function HistoryTab({ events, isLoading }: Props) {
  const arr = Array.isArray(events) ? events : [];
  return <EventTimeline events={arr} isLoading={isLoading} />;
}
```

- [ ] **Step 5: Build to confirm it compiles**

```bash
npm run build:client && npm run check
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/agent-profile.tsx client/src/pages/agent-profile/
git commit -m "refactor(profile): scaffold new 5-tab agent profile page"
```

---

## Task 17: Implement the desktop + mobile banner

**Files:**
- Modify: `client/src/pages/agent-profile/banner.tsx`

Reads: Phase 1 spec §"Banner Zone" + Phase 2 spec §3 (mobile).

- [ ] **Step 1: Replace the banner stub with the full implementation**

```tsx
import type { Agent } from "@shared/schema";
import { useState } from "react";
import { getChain } from "@shared/chains";
import { TrustStamp } from "@/components/trust-stamp";
import { ChainBadge } from "@/components/chain-badge";
import { addressToGradientPair } from "@/lib/address-color";
import type { PublicVerdict } from "@/lib/verdict";
import { cn } from "@/lib/utils";

interface BannerProps {
  agent: Agent & { verdict?: PublicVerdict };
  verdict: PublicVerdict;
  updatedAt: string | null;
}

function shortAddress(a: string): string { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

function ImageTile({ agent }: { agent: Agent }) {
  const { a, b } = addressToGradientPair(agent.controllerAddress);
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!agent.imageUrl && !imgFailed;
  return (
    <div
      className="relative flex-shrink-0 rounded-xl overflow-hidden"
      style={{ width: 160, height: 160, background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {hasImage ? (
        <img
          src={agent.imageUrl!}
          alt={agent.name ?? "Agent image"}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-5xl opacity-20 select-none" aria-hidden>🤖</span>
        </div>
      )}
    </div>
  );
}

function IdentityChip({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-black/35 border border-white/15 backdrop-blur-sm whitespace-nowrap",
        "text-white/85",
      )}
    >
      <span className="opacity-60 text-[8px] uppercase tracking-wider">{label}</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </span>
  );
}

function BannerDesktop({ agent, verdict, updatedAt }: BannerProps) {
  const chain = getChain(agent.chainId);
  const eyebrow = `${agent.qualityTier?.toUpperCase() ?? "UNCLASSIFIED"} · Active since ${
    new Date(agent.createdAt).toLocaleString("en-US", { month: "short", year: "numeric" })
  }`;
  const score = (agent as any).trustScore ?? null;

  return (
    <div
      className="hidden sm:flex rounded-lg overflow-hidden p-[22px] gap-5 mb-4"
      style={{
        background: `radial-gradient(ellipse at 20% 30%, ${addressToGradientPair(agent.controllerAddress).a} 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, ${addressToGradientPair(agent.controllerAddress).b} 0%, #0b0e17 70%)`,
        minHeight: 204,
      }}
      data-testid="banner-desktop"
    >
      <ImageTile agent={agent} />
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-[2px] text-white/75 mb-2">{eyebrow}</div>
          <h1 className="text-white text-[34px] font-extrabold truncate" title={agent.name ?? `Agent #${agent.erc8004Id}`}>
            {agent.name ?? `Agent #${agent.erc8004Id}`}
          </h1>
        </div>
        <div className="flex items-stretch gap-4">
          <div className="flex-1 min-w-0 flex flex-col gap-3 justify-between">
            <p className="text-white/90 text-[13px] leading-relaxed line-clamp-2">
              {agent.description ?? "No description provided by this agent."}
            </p>
            <div className="flex flex-nowrap items-center gap-2 overflow-hidden">
              {chain && <IdentityChip label="CHAIN" value={chain.name} />}
              <IdentityChip label="ID" value={agent.erc8004Id} mono />
              <IdentityChip label="CONTRACT" value={shortAddress(agent.primaryContractAddress)} mono />
              <IdentityChip label="CONTROLLER" value={shortAddress(agent.controllerAddress)} mono />
            </div>
          </div>
          <div className="shrink-0 self-end">
            <TrustStamp verdict={verdict} score={score} size="hero" methodologyVersion={2} scoredAt={updatedAt} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BannerMobile({ agent, verdict, updatedAt }: BannerProps) {
  const score = (agent as any).trustScore ?? null;
  const chain = getChain(agent.chainId);
  const [expanded, setExpanded] = useState(false);
  const eyebrow = (agent.qualityTier?.toUpperCase() ?? "UNCLASSIFIED");
  return (
    <div
      className="sm:hidden rounded-lg overflow-hidden p-4 mb-4 flex flex-col gap-3"
      style={{
        background: `radial-gradient(ellipse at 0% 0%, ${addressToGradientPair(agent.controllerAddress).a}, #0b0e17)`,
      }}
      data-testid="banner-mobile"
    >
      <div className="flex items-center gap-3 h-[64px]">
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
          {agent.imageUrl ? (
            <img src={agent.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🤖</div>}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ height: 64 }}>
          <div className="text-[9px] uppercase font-bold tracking-[2px] text-white/70 truncate">{eyebrow}</div>
          <h1 className="text-white text-[17px] font-extrabold leading-[1.2] line-clamp-2" style={{ wordBreak: "break-word" }}>
            {agent.name ?? `Agent #${agent.erc8004Id}`}
          </h1>
        </div>
      </div>
      <p className="text-white/85 text-[11px] leading-[1.45]" style={expanded ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {agent.description ?? "No description provided."}
        {agent.description && !expanded && (
          <button onClick={() => setExpanded(true)} className="ml-1 text-blue-300 uppercase text-[10px] font-bold" data-testid="banner-more">MORE</button>
        )}
      </p>
      <TrustStamp verdict={verdict} score={score} size="hero" methodologyVersion={2} scoredAt={updatedAt} className="w-full" />
      <div className="flex flex-wrap gap-1.5">
        {chain && <IdentityChip label="CHAIN" value={chain.name} />}
        <IdentityChip label="ID" value={agent.erc8004Id} mono />
        <IdentityChip label="CONTRACT" value={shortAddress(agent.primaryContractAddress)} mono />
      </div>
    </div>
  );
}

export function Banner(props: BannerProps) {
  return (
    <>
      <BannerDesktop {...props} />
      <BannerMobile {...props} />
    </>
  );
}
```

- [ ] **Step 2: Check build + type-check**

```bash
npm run build:client && npm run check
```

Expected: clean.

- [ ] **Step 3: Start dev server, visit an agent profile, screenshot both desktop and mobile (emulator devtools)** — record observation in commit message; don't over-polish.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/agent-profile/banner.tsx
git commit -m "feat(profile): implement banner (desktop + mobile)"
```

---

## Task 18: Implement Overview tab with zone activation

**Files:**
- Modify: `client/src/pages/agent-profile/overview-tab.tsx`

Reads: spec §5 "Overview (fully free)", §6 verification mapping, Phase 2 spec §4 "insufficient data" disclaimer.

- [ ] **Step 1: Replace the stub**

```tsx
import type { Agent } from "@shared/schema";
import { getChain, getExplorerAddressUrl } from "@shared/chains";
import { ZoneCard } from "@/components/zone-card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Globe, Hash, Shield, User, Blocks, Clock, FileText, Tag, Zap } from "lucide-react";

interface Props { agent: Agent }

function formatUri(uri: string | null | undefined): { scheme: string; display: string } {
  if (!uri) return { scheme: "none", display: "—" };
  if (uri.startsWith("ipfs://")) return { scheme: "IPFS", display: uri };
  if (uri.startsWith("ar://"))   return { scheme: "Arweave", display: uri };
  return { scheme: "HTTPS", display: uri };
}

function normalizeEndpoints(e: unknown): Array<{ name: string; url: string }> {
  if (!e) return [];
  if (Array.isArray(e)) return e.map((x, i) => typeof x === "object" && x
    ? { name: (x as any).name ?? `Endpoint ${i + 1}`, url: (x as any).endpoint ?? (x as any).url ?? String(x) }
    : { name: `Endpoint ${i + 1}`, url: String(x) });
  if (typeof e === "object") return Object.entries(e as Record<string, unknown>).map(([k, v]) => ({ name: k, url: String(v) }));
  return [];
}

export function OverviewTab({ agent }: Props) {
  const chain = getChain(agent.chainId);
  const uri = formatUri(agent.metadataUri);
  const endpoints = normalizeEndpoints(agent.endpoints);
  const hasIpfs = uri.scheme === "IPFS" || uri.scheme === "Arweave";
  const hasSkills = (agent.oasfSkills?.length ?? 0) > 0 || (agent.oasfDomains?.length ?? 0) > 0;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <ZoneCard state="populated" label="About" className="md:col-span-2" data-testid="zone-about">
        <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-agent-description">
          {agent.description ?? "No description provided by this agent."}
        </p>
      </ZoneCard>

      <ZoneCard state="populated" label="Identity" data-testid="zone-identity">
        <dl className="text-sm space-y-1.5">
          <div className="flex gap-2"><dt className="w-24 text-muted-foreground">Chain</dt><dd>{chain?.name ?? "Unknown"}</dd></div>
          <div className="flex gap-2">
            <dt className="w-24 text-muted-foreground">Contract</dt>
            <dd className="font-mono flex items-center gap-1 truncate">
              {agent.primaryContractAddress.slice(0, 8)}…{agent.primaryContractAddress.slice(-6)}
              <a href={getExplorerAddressUrl(agent.chainId, agent.primaryContractAddress)} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-muted-foreground">Controller</dt>
            <dd className="font-mono flex items-center gap-1 truncate">
              {agent.controllerAddress.slice(0, 8)}…{agent.controllerAddress.slice(-6)}
              <a href={getExplorerAddressUrl(agent.chainId, agent.controllerAddress)} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
            </dd>
          </div>
          <div className="flex gap-2"><dt className="w-24 text-muted-foreground">ERC-8004 ID</dt><dd className="font-mono">{agent.erc8004Id}</dd></div>
        </dl>
      </ZoneCard>

      <ZoneCard state="populated" label="Discovery" data-testid="zone-discovery">
        <dl className="text-sm space-y-1.5">
          <div className="flex gap-2"><dt className="w-40 text-muted-foreground">First Seen</dt><dd>Block {agent.firstSeenBlock.toLocaleString()}</dd></div>
          <div className="flex gap-2"><dt className="w-40 text-muted-foreground">Last Updated</dt><dd>Block {agent.lastUpdatedBlock.toLocaleString()}</dd></div>
          <div className="flex gap-2"><dt className="w-40 text-muted-foreground">Early Adopter</dt><dd>{new Date(agent.createdAt) < new Date("2026-06-01") ? "✓ Yes" : "— No"}</dd></div>
          <div className="flex gap-2"><dt className="w-40 text-muted-foreground">Active Maintainer</dt><dd>— No</dd></div>
        </dl>
      </ZoneCard>

      <ZoneCard
        state={hasIpfs ? "earned" : agent.metadataUri ? "populated" : "empty"}
        label="Metadata URI"
        statusTag={hasIpfs ? `${uri.scheme} ✓` : agent.metadataUri ? "HTTPS" : "NONE"}
        data-testid="zone-metadata-uri"
      >
        <p className="text-xs font-mono truncate">{uri.display}</p>
      </ZoneCard>

      <ZoneCard
        state={endpoints.length > 0 ? "populated" : "empty"}
        label="Public Links"
        statusTag={endpoints.length === 0 ? "NONE" : undefined}
        data-testid="zone-public-links"
      >
        {endpoints.length === 0
          ? <p className="text-xs text-muted-foreground">No endpoints declared.</p>
          : (
            <ul className="space-y-1.5 text-xs">
              {endpoints.map((ep, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="font-medium text-muted-foreground shrink-0">{ep.name}</span>
                  <a href={ep.url.startsWith("http") ? ep.url : `https://${ep.url}`} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline truncate">{ep.url}</a>
                </li>
              ))}
            </ul>
          )}
      </ZoneCard>

      {agent.capabilities && agent.capabilities.length > 0 && (
        <ZoneCard state="populated" label="Declared Capabilities" className="md:col-span-2" data-testid="zone-capabilities">
          <div className="flex flex-wrap gap-1.5">
            {agent.capabilities.map((c, i) => (
              <Badge key={i} variant="outline" className="text-xs"><Zap className="w-3 h-3 mr-1" />{c}</Badge>
            ))}
          </div>
        </ZoneCard>
      )}

      <ZoneCard
        state={hasSkills ? "earned" : "empty"}
        label="OASF Skills"
        statusTag={hasSkills ? "DECLARED ✓" : "NONE"}
        className="md:col-span-2"
        data-testid="zone-oasf-skills"
      >
        {hasSkills ? (
          <div className="flex flex-wrap gap-1.5">
            {[...(agent.oasfSkills ?? []), ...(agent.oasfDomains ?? [])].map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">No OASF skills declared.</p>}
      </ZoneCard>
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run build:client && npm run check
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/agent-profile/overview-tab.tsx
git commit -m "feat(profile): Overview tab with zone activation"
```

---

## Task 19: Implement Score tab

**Files:**
- Modify: `client/src/pages/agent-profile/score-tab.tsx`

Reads: spec §7.

- [ ] **Step 1: Replace the stub**

```tsx
import type { Agent } from "@shared/schema";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreRail } from "@/components/score-rail";
import { CategoryBars, type CategoryStrengths } from "@/components/category-bars";
import { ArrowRight, Info } from "lucide-react";
import type { PublicVerdict } from "@/lib/verdict";

interface Props {
  agent: Agent;
  verdict: PublicVerdict;
  strengths: CategoryStrengths | null;
}

export function ScoreTab({ agent, verdict, strengths }: Props) {
  const score = (agent as any).trustScore ?? null;
  const emptyStrengths: CategoryStrengths = {
    identity: "none", behavioral: "none", community: "none", attestation: "none", authenticity: "high",
  };
  return (
    <div className="space-y-6">
      <ScoreRail verdict={verdict} score={score} />

      <Card className="p-4 bg-blue-500/5 border-blue-500/20" data-testid="evidence-basis">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm">
            {score == null
              ? "Profile data only — no verified transactions recorded yet for this agent."
              : `Based on public on-chain data indexed by TrustAdd. See the Trust API for the complete Evidence Basis.`}
          </p>
        </div>
      </Card>

      <Card className="p-5" data-testid="score-breakdown">
        <h3 className="text-sm font-semibold mb-4">Score Breakdown</h3>
        <CategoryBars strengths={strengths ?? emptyStrengths} />
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border">
          <Link href="/methodology"><Button variant="ghost" size="sm">View Methodology</Button></Link>
          <Link href="/trust-api" className="ml-auto">
            <Button size="sm" className="gap-1">Unlock full breakdown <ArrowRight className="w-3 h-3" /></Button>
          </Link>
        </div>
      </Card>

      <div className="border-t border-dashed border-border pt-5">
        <Card className="p-5 border-dashed opacity-60" data-testid="score-gated">
          <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">Detailed breakdown — Trust API</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• 5 numeric category scores</li>
            <li>• 21 individual signal scores</li>
            <li>• Sybil detection signals + dampening detail</li>
            <li>• Provenance hash + methodology version</li>
          </ul>
          <Link href="/trust-api">
            <Button variant="outline" size="sm" className="mt-3">View on Trust API →</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Extend the trust-score endpoint to return `categoryStrengths`**

The profile already fetches `/api/agents/:id/trust-score`. Update the backend route to include `categoryStrengths` — file `server/routes/agents.ts` lines ~157–178.

```ts
import { deriveCategoryStrengths } from "../trust-categories.js";
```

Then inside the handler:

```ts
  app.get("/api/agents/:id/trust-score", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const verdict = verdictFor(agent.trustScore ?? null, agent.qualityTier ?? null, agent.spamFlags ?? null, agent.lifecycleStatus ?? null);
      const categoryStrengths = agent.trustScoreBreakdown
        ? deriveCategoryStrengths(agent.trustScoreBreakdown as any, agent.sybilRiskScore ?? 0)
        : null;

      res.set("X-TrustAdd-Tier", "free");
      res.json({
        verdict,
        updatedAt: agent.trustScoreUpdatedAt ?? null,
        reportAvailable: true,
        categoryStrengths,
        quickCheckPrice: "$0.01",
        fullReportPrice: "$0.05",
        message: "Full trust score and breakdown available via x402 Trust Report. See /api/v1/trust/:address",
      });
    } catch (err) {
      logger.error("Error fetching trust score", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch trust score" });
    }
  });
```

- [ ] **Step 3: Build + type-check**

```bash
npm run build:client && npm run check
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/agent-profile/score-tab.tsx server/routes/agents.ts
git commit -m "feat(profile): Score tab + expose categoryStrengths on free trust-score endpoint"
```

---

## Task 20: Implement On-Chain tab

**Files:**
- Modify: `client/src/pages/agent-profile/on-chain-tab.tsx`

Reads: spec §5 "On-Chain Activity", §6 verification mapping.

- [ ] **Step 1: Replace the stub**

```tsx
import type { Agent } from "@shared/schema";
import { Link } from "wouter";
import { ZoneCard } from "@/components/zone-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getChain } from "@shared/chains";
import { ArrowRight, CreditCard, Layers, Zap } from "lucide-react";

interface Props { agent: Agent }

function StatTile({ label, value, earned }: { label: string; value: string | number; earned: boolean }) {
  return (
    <Card className={`p-4 ${earned ? "border-l-[3px] border-l-emerald-500" : "border-l-[3px] border-l-muted-foreground/40 opacity-60"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

export function OnChainTab({ agent }: Props) {
  const chain = getChain(agent.chainId);
  const x402 = agent.x402Support === true;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Verified Txs" value={0} earned={false} />
        <StatTile label="Chains" value={1} earned={false} />
        <StatTile label="x402" value={x402 ? "Live" : "Off"} earned={x402} />
      </div>

      <ZoneCard state="populated" label="Chain Presence" data-testid="zone-chains">
        <div className="flex items-center gap-3">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <div className="text-sm">
            {chain?.name ?? `Chain ${agent.chainId}`} · first seen block {agent.firstSeenBlock.toLocaleString()}
          </div>
        </div>
      </ZoneCard>

      <ZoneCard
        state={x402 ? "earned" : "empty"}
        label="x402 Endpoint"
        statusTag={x402 ? "LIVE ✓" : "NONE"}
        data-testid="zone-x402"
      >
        <div className="flex items-center gap-2 text-sm">
          <Zap className={`w-4 h-4 ${x402 ? "text-emerald-500" : "text-muted-foreground"}`} />
          {x402 ? <span>Endpoint responds with HTTP 402 payment requirements.</span> : <span>No x402 endpoint detected.</span>}
        </div>
      </ZoneCard>

      <Card className="p-5 border-dashed opacity-60" data-testid="onchain-gated">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">Detailed on-chain history — Trust API</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Full transaction list + volumes</li>
          <li>• Unique payer counts + patterns</li>
          <li>• Per-chain breakdown + token mix</li>
        </ul>
        <Link href="/trust-api">
          <Button variant="outline" size="sm" className="mt-3 gap-1">View on Trust API <ArrowRight className="w-3 h-3" /></Button>
        </Link>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/agent-profile/on-chain-tab.tsx
git commit -m "feat(profile): On-Chain tab"
```

---

## Task 21: Implement Community tab

**Files:**
- Modify: `client/src/pages/agent-profile/community-tab.tsx`

Reads: spec §5 "Community", §6 verification mapping.

- [ ] **Step 1: Replace the stub**

```tsx
import type { Agent } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoneCard } from "@/components/zone-card";
import { SiGithub, SiFarcaster } from "react-icons/si";
import { ArrowRight } from "lucide-react";

interface Props { agent: Agent }

interface CommunityGatedData {
  message?: string;
  preview?: { totalSources?: number; hasGithub?: boolean; hasFarcaster?: boolean };
}

export function CommunityTab({ agent }: Props) {
  const { data } = useQuery<CommunityGatedData>({
    queryKey: ["/api/agents", agent.slug ?? agent.id, "community-feedback"],
    queryFn: async () => {
      const r = await fetch(`/api/agents/${agent.slug ?? agent.id}/community-feedback`);
      if (r.status >= 500) throw new Error("server error");
      return r.json();
    },
    retry: false,
  });
  const preview = data?.preview ?? {};
  const hasGithub = preview.hasGithub === true;
  const hasFarcaster = preview.hasFarcaster === true;
  const totalSources = preview.totalSources ?? 0;

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-blue-500/5 border-blue-500/20" data-testid="community-summary">
        <p className="text-sm"><strong>{totalSources} of 2</strong> community sources indexed</p>
      </Card>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <ZoneCard
          state={hasGithub ? "earned" : "empty"}
          label="GitHub"
          statusTag={hasGithub ? "INDEXED ✓" : "NOT LINKED"}
          data-testid="zone-github"
        >
          <div className="flex items-center gap-2 text-sm">
            <SiGithub className="w-4 h-4" />
            {hasGithub ? "GitHub health indexed." : "No GitHub repo linked."}
          </div>
        </ZoneCard>
        <ZoneCard
          state={hasFarcaster ? "earned" : "empty"}
          label="Farcaster"
          statusTag={hasFarcaster ? "INDEXED ✓" : "NOT LINKED"}
          data-testid="zone-farcaster"
        >
          <div className="flex items-center gap-2 text-sm">
            <SiFarcaster className="w-4 h-4 text-[#8A63D2]" />
            {hasFarcaster ? "Farcaster presence indexed." : "No Farcaster handle linked."}
          </div>
        </ZoneCard>
      </div>

      <Card className="p-5 border-dashed opacity-60" data-testid="community-gated">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">Detailed community signals — Trust API</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• GitHub health score, commit cadence, contributors</li>
          <li>• Farcaster follower count, Neynar score</li>
        </ul>
        <Link href="/trust-api">
          <Button variant="outline" size="sm" className="mt-3 gap-1">View on Trust API <ArrowRight className="w-3 h-3" /></Button>
        </Link>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/agent-profile/community-tab.tsx
git commit -m "feat(profile): Community tab"
```

---

## Task 22: Finalize History tab + phase smoke

**Files:**
- No further changes to `history-tab.tsx` (the stub already delegates to `<EventTimeline />`).

- [ ] **Step 1: Build + lint**

```bash
npm run build:client && npm run check
```

- [ ] **Step 2: Manual smoke** — start dev server (`npm run dev`), load a known agent profile (e.g. pick from `/agents`), step through all 5 tabs at desktop + emulated mobile widths (375px, 768px, 1280px). Note anything broken in the commit message but don't fix now unless it's a regression from the v1 profile.

- [ ] **Step 3: Commit a no-op marker**

```bash
git commit --allow-empty -m "chore(profile): phase 3 smoke pass complete"
```

---

# PHASE 4 — Leaderboard card

## Task 23: Rewrite `<AgentCard />`

**Files:**
- Modify: `client/src/components/agent-card.tsx`

Reads: spec §8.

The server currently returns `verdict` on each list-endpoint row (see `redactAgentForPublic`) and each row carries only public fields. We need to plumb `verifications` into the card — add a route to return earned verifications alongside the redacted agent object (Task 32 covers this).

For this task, use the `verifications` array shape `EarnedVerification[]` from the `VerificationChips` component. The list endpoint will be extended in Task 32 to return this field; for now the type is accepted optionally.

- [ ] **Step 1: Replace the file**

```tsx
import { Link } from "wouter";
import type { Agent } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChainBadge } from "@/components/chain-badge";
import { TrustStamp } from "@/components/trust-stamp";
import { VerificationChips, type EarnedVerification } from "@/components/verification-chips";
import { addressToColor } from "@/lib/address-color";
import type { PublicVerdict } from "@/lib/verdict";

export type AgentWithVerdict = Agent & {
  verdict?: PublicVerdict;
  trustScoreForStamp?: number | null;  // populated by list endpoints that expose the score
  verifications?: EarnedVerification[];
  extraChainCount?: number;
};

function shortMobile(a: string): string { return `${a.slice(0, 6)}…${a.slice(-4)}`; }
function initials(name: string | null, address: string): string {
  if (name) return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return address.slice(2, 4).toUpperCase();
}

interface Props { agent: AgentWithVerdict }

export function AgentCard({ agent }: Props) {
  const color = addressToColor(agent.primaryContractAddress);
  const verdict: PublicVerdict = agent.verdict ?? "UNKNOWN";
  const verifications = agent.verifications ?? [];
  const addressChip = (
    <span className="text-[10px] font-mono px-2 py-1 rounded bg-muted text-muted-foreground border border-border whitespace-nowrap">
      {shortMobile(agent.primaryContractAddress)}
    </span>
  );

  return (
    <Link href={`/agent/${agent.slug || agent.id}`}>
      <Card className="hover-elevate cursor-pointer p-4 transition-all" data-testid={`card-agent-${agent.id}`}>
        <div className="flex items-start gap-3">
          <Avatar className="h-16 w-16 ring-2 ring-border/50">
            {agent.imageUrl && <AvatarImage src={agent.imageUrl} alt={agent.name ?? "Agent avatar"} />}
            <AvatarFallback style={{ backgroundColor: color, color: "white" }} className="text-base font-bold">
              {initials(agent.name, agent.primaryContractAddress)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate" title={agent.name ?? `Agent #${agent.erc8004Id}`} data-testid={`text-agent-name-${agent.id}`}>
                  {agent.name || `Agent #${agent.erc8004Id}`}
                </h3>
              </div>
              <span className="hidden sm:inline"><ChainBadge chainId={agent.chainId} extraChainCount={agent.extraChainCount ?? 0} /></span>
              <span className="sm:hidden"><ChainBadge chainId={agent.chainId} short extraChainCount={agent.extraChainCount ?? 0} /></span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-0.5" style={{ minHeight: "2.4rem", wordBreak: "break-word" }}>
              {agent.description ?? <i className="opacity-50">No description provided.</i>}
            </p>
          </div>

          <TrustStamp
            verdict={verdict}
            score={agent.trustScoreForStamp ?? null}
            size="square"
            className="ml-auto"
          />
        </div>
        <div className="mt-3">
          <VerificationChips verifications={verifications} addressChip={addressChip} />
        </div>
      </Card>
    </Link>
  );
}

export function AgentCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-36 bg-muted animate-pulse rounded" />
          <div className="h-3 w-full bg-muted animate-pulse rounded" />
          <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
        </div>
        <div className="w-16 h-16 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="mt-3 h-7 w-full rounded bg-muted animate-pulse" />
    </Card>
  );
}
```

- [ ] **Step 2: Build + type-check**

```bash
npm run build:client && npm run check
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/agent-card.tsx
git commit -m "feat(card): rewrite leaderboard card with square stamp + chip row"
```

---

## Task 24: Directory + landing integration sanity-check

**Files:**
- Modify (if needed): `client/src/pages/directory.tsx`, `client/src/pages/landing.tsx`

- [ ] **Step 1: Start the dev server and visit `/agents` and `/`** — confirm cards render. The old props (`verdict`) remain backward-compatible; `trustScoreForStamp` and `verifications` will show "—" + no chips until Task 32 extends the list endpoint.

- [ ] **Step 2: Commit an empty marker** (the card works as-is; nothing to change in directory/landing wiring).

```bash
git commit --allow-empty -m "chore(card): phase 4 smoke confirmed with new card"
```

---

# PHASE 5 — Other pages

Tasks 25–30 can run in parallel — each edits a distinct page/file.

## Task 25: Update Trust API page

**Files:**
- Modify: `client/src/pages/trust-api.tsx`

Reads: spec §9.

- [ ] **Step 1: Replace the legacy `VerdictBadge` component with the new descriptor-driven version** — at the top of the file, replace lines 20–32:

```tsx
import { TrustStamp } from "@/components/trust-stamp";
import { verdictDescriptor, type PublicVerdict, UNKNOWN_ICON } from "@/lib/verdict";
import { Badge } from "@/components/ui/badge";

function VerdictBadge({ verdict }: { verdict: PublicVerdict }) {
  const desc = verdictDescriptor(verdict);
  const Icon = verdict === "UNKNOWN" ? UNKNOWN_ICON : desc.icon;
  return (
    <Badge
      variant="outline"
      className="gap-1"
      style={{ background: desc.tintBg, color: desc.color, borderColor: desc.color + "40" }}
    >
      <Icon className="w-3 h-3" />
      {verdict === "UNKNOWN" ? "UNKNOWN" : desc.label}
    </Badge>
  );
}
```

- [ ] **Step 2: Update Quick Check feature list (lines ~94–108)**

```tsx
              <ul className="space-y-2 text-sm">
                {[
                  "Trust verdict (VERIFIED / TRUSTED / BUILDING / INSUFFICIENT / FLAGGED / UNKNOWN)",
                  "Composite score (0\u2013100)",
                  "Evidence basis summary",
                  "9 verification states (earned + unearned)",
                  "Confidence level",
                  "Methodology version + provenance hash",
                  "Category strengths (qualitative)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
```

- [ ] **Step 3: Update Full Report feature list (lines ~131–144)**

```tsx
              <ul className="space-y-2 text-sm">
                {[
                  "Everything in Quick Check",
                  "5 numeric category scores",
                  "21 individual signal scores",
                  "Sybil detection signals + dampening detail",
                  "Agent identity + metadata",
                  "Full transaction history + volume",
                  "GitHub health + Farcaster engagement",
                  "Per-chain transaction breakdown",
                  "Registration timeline + data freshness",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
```

- [ ] **Step 4: Update the live-demo result card** — replace the existing `<VerdictBadge ... />` + inline pricing lines (~197–211) with:

```tsx
                {demoResult.found ? (
                  <>
                    <div className="flex items-center gap-3">
                      <TrustStamp verdict={demoResult.verdict ?? "UNKNOWN"} score={demoResult.score ?? null} size="square" className="!w-12 !h-12" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{demoResult.name || "Unnamed Agent"}</div>
                        <div className="text-xs text-muted-foreground">{demoResult.evidenceSummary ?? "Profile data indexed."}</div>
                      </div>
                    </div>
                    <Link href={`/agent/${searchAddress}`}>
                      <Button variant="outline" size="sm" className="gap-1 mt-2">
                        View Profile <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Address not found in the oracle. This agent hasn't been indexed yet.
                  </p>
                )}
```

- [ ] **Step 5: Add a new "JSON response examples" section** — insert before the "How x402 Works" section (~line 223):

```tsx
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">Response shape</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Quick Check — $0.01</h3>
              <pre className="text-[11px] font-mono bg-muted p-3 rounded-md overflow-x-auto">
{`{
  "address": "0x...",
  "verdict": "TRUSTED",
  "score": 72,
  "categoryStrengths": {
    "identity": "high",
    "behavioral": "medium",
    "community": "low",
    "authenticity": "high",
    "attestation": "none"
  },
  "evidenceBasis": {
    "transactionCount": 18,
    "uniquePayers": 7,
    "summary": "Based on 18 verified transactions ..."
  },
  "verificationCount": 5,
  "reportVersion": 4
}`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Full Report — $0.05</h3>
              <pre className="text-[11px] font-mono bg-muted p-3 rounded-md overflow-x-auto">
{`{
  "trustRating": { "score": 72, "verdict": "TRUSTED",
    "breakdown": { "categories": { "transactions": 20, ... } },
    "categoryStrengths": { ... },
    "confidence": { "level": "medium" },
    "provenance": { "signalHash": "0x..." }
  },
  "verifications": [ { "name": "x402 Enabled", "earned": true }, ... ],
  "community": { "githubHealthScore": 68, ... },
  "economy": { "transactionCount": 18, "totalVolumeUsd": 125.42 },
  "sybil": { "riskScore": 0, "dampeningApplied": false }
}`}
              </pre>
            </div>
          </div>
        </div>
```

- [ ] **Step 6: Build + type-check**

```bash
npm run build:client && npm run check
```

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/trust-api.tsx
git commit -m "feat(trust-api): update for 5-tier verdict + JSON examples + stamp in demo"
```

---

## Task 26: Update `content-zones.ts`

**Files:**
- Modify: `client/src/lib/content-zones.ts`

Reads: spec §11.

- [ ] **Step 1: Rewrite `HOME.pillars`** — replace lines 61–88:

```ts
  pillars: {
    heading: "Five Categories of Agent Trust",
    subtitle:
      "Every trust verdict is computed from five signal categories, weighted to reflect what matters most for autonomous decision-making.",
    items: [
      {
        icon: "Shield" as const,
        title: "Identity",
        desc: "Controller, metadata, and on-chain identity signals. The baseline 'who is this agent?' check.",
        badge: "Identity",
        badgeVariant: "live" as const,
      },
      {
        icon: "Zap" as const,
        title: "Behavioral",
        desc: "Transaction patterns, payment cadence, activity consistency. The hardest evidence to fake.",
        badge: "Behavioral",
        badgeVariant: "live" as const,
      },
      {
        icon: "Star" as const,
        title: "Community",
        desc: "GitHub project health, Farcaster presence, external reputation signals.",
        badge: "Community",
        badgeVariant: "monitoring" as const,
      },
      {
        icon: "Shield" as const,
        title: "Attestation",
        desc: "Third-party verifications via on-chain attestation. Inactive in v2, scheduled for v3.",
        badge: "Attestation",
        badgeVariant: "monitoring" as const,
      },
      {
        icon: "Eye" as const,
        title: "Authenticity",
        desc: "Detection of coordinated agent networks. Sybil resistance — protects the score from manipulation.",
        badge: "Authenticity",
        badgeVariant: "live" as const,
      },
    ],
  },
```

- [ ] **Step 2: Update the about-page verdict list (line ~133)**

```ts
    intro:
      "Every indexed agent receives a TrustAdd Score from 0 to 100, computed from five categories of on-chain and off-chain signals. The score powers trust verdicts: VERIFIED, TRUSTED, BUILDING, INSUFFICIENT, or FLAGGED.",
```

- [ ] **Step 3: Confirm METHODOLOGY.categories uses the v2 public names** — the existing five internal categories (`Transaction Activity`, `Reputation & Attestations`, `Agent Profile`, `Longevity & Consistency`, `Community`) stay unchanged (those describe the scoring rubric, not the public strengths). The `CategoryBars` component handles the public-facing Identity/Behavioral/Community/Attestation/Authenticity mapping — no change needed to METHODOLOGY.categories.

- [ ] **Step 4: Build + type-check**

```bash
npm run build:client && npm run check
```

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/content-zones.ts
git commit -m "feat(content): update pillars + verdict list copy to v2 5-tier"
```

---

## Task 27: Update Methodology page

**Files:**
- Modify: `client/src/pages/methodology.tsx`

Reads: spec §10 + §11.

- [ ] **Step 1: Update `V2_TIERS`** — replace lines 51–100:

```tsx
const V2_TIERS = [
  {
    name: "Flagged",
    range: "active negative evidence",
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    description: "Active negative signals: spam patterns, failed transactions, confirmed bad behavior.",
  },
  {
    name: "Insufficient",
    range: "0–39",
    icon: CircleDot,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/30",
    description: "Minimal or no behavioral evidence yet. Profile data may be present.",
  },
  {
    name: "Building",
    range: "40–59",
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    description: "Early behavioral evidence — track record forming.",
  },
  {
    name: "Trusted",
    range: "60–79",
    icon: CheckCircle,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/30",
    description: "Meaningful transaction history and positive attestation signals.",
  },
  {
    name: "Verified",
    range: "80–100",
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    description: "Extensive verified behavioral evidence from multiple sources confirms trust.",
  },
];
```

- [ ] **Step 2: Delete the `HelpCircle` import** (no longer used) — remove it from the import list at top of file.

- [ ] **Step 3: Add an `EcosystemDistribution` section component** — define it near the top of the file (under `DATA_SOURCES`):

```tsx
import { useQuery } from "@tanstack/react-query";

function EcosystemDistribution() {
  const { data } = useQuery<{
    tiers: Array<{ tier: string; count: number; pct: number; color: string }>;
    buckets: Array<{ bucket: string; count: number; tier: string }>;
    narrative: string;
  }>({ queryKey: ["/api/analytics/trust-tiers"] });

  if (!data) return null;
  return (
    <section className="mt-12" data-testid="methodology-distribution">
      <h2 className="text-xl font-bold mb-4">Ecosystem Distribution</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {data.tiers.map(t => (
          <div key={t.tier} className="p-3 rounded-md border-l-[3px]" style={{ borderLeftColor: t.color }}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.tier}</p>
            <p className="text-lg font-bold">{t.count.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{t.pct.toFixed(1)}%</p>
          </div>
        ))}
      </div>
      <div className="space-y-1 mb-4">
        {data.buckets.map(b => {
          const tierColor = data.tiers.find(t => t.tier === b.tier)?.color ?? "#a1a1aa";
          const maxCount = Math.max(...data.buckets.map(x => x.count), 1);
          return (
            <div key={b.bucket} className="flex items-center gap-2">
              <span className="text-[10px] font-mono w-14 text-right">{b.bucket}</span>
              <div className="flex-1 h-3 rounded-sm overflow-hidden bg-muted">
                <div className="h-full" style={{ width: `${(b.count / maxCount) * 100}%`, background: tierColor }} />
              </div>
              <span className="text-[11px] text-muted-foreground w-16">{b.count.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground italic">{data.narrative}</p>
    </section>
  );
}
```

- [ ] **Step 4: Mount `<EcosystemDistribution />`** — locate a reasonable spot (after the `V2_TIERS` rendering block, before the methodology closing section) and insert `<EcosystemDistribution />`.

- [ ] **Step 5: Build + type-check**

```bash
npm run build:client && npm run check
```

Expected: type errors if `/api/analytics/trust-tiers` isn't yet implemented — that's fine; Task 33 adds the backend route. Type-check will still pass because it doesn't validate runtime URLs.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/methodology.tsx
git commit -m "feat(methodology): 5-tier table + Ecosystem Distribution section"
```

---

## Task 28: Redesign Analytics Score Distribution section

**Files:**
- Modify: `client/src/pages/analytics.tsx`

Reads: spec §10 (same design as Methodology — reuse or duplicate as needed).

- [ ] **Step 1: Replace the existing trust-score distribution chart** — locate the section rendered from `trustScoreData?.distribution` (inside Analytics page). Replace that Recharts block with:

```tsx
import { TIER_ORDER } from "@/lib/verdict";

function TrustTierStrip({ tiers }: { tiers: Array<{ tier: string; count: number; pct: number }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" data-testid="tier-strip">
      {TIER_ORDER.slice().reverse().map(desc => {
        const match = tiers.find(t => t.tier === desc.tier);
        return (
          <div key={desc.tier} className="p-3 rounded-md border-l-[3px]" style={{ borderLeftColor: desc.color }}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{desc.label}</p>
            <p className="text-lg font-bold">{(match?.count ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{((match?.pct ?? 0)).toFixed(1)}%</p>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add a new query alongside the existing `trustScoreData` one** — inside the Analytics component:

```tsx
  const { data: tierData } = useQuery<{
    tiers: Array<{ tier: string; count: number; pct: number; color: string }>;
    buckets: Array<{ bucket: string; count: number; tier: string }>;
    narrative: string;
  }>({ queryKey: ["/api/analytics/trust-tiers"] });
```

- [ ] **Step 3: In the JSX where the old trust-score BarChart lives, replace it with:**

```tsx
  {tierData && (
    <section className="space-y-4">
      <SectionTitle>Trust Score Distribution</SectionTitle>
      <TrustTierStrip tiers={tierData.tiers} />
      <div className="space-y-1">
        {tierData.buckets.map(b => {
          const tierColor = tierData.tiers.find(t => t.tier === b.tier)?.color ?? "#a1a1aa";
          const maxCount = Math.max(...tierData.buckets.map(x => x.count), 1);
          return (
            <div key={b.bucket} className="flex items-center gap-2">
              <span className="text-[10px] font-mono w-14 text-right">{b.bucket}</span>
              <div className="flex-1 h-3 rounded-sm overflow-hidden bg-muted">
                <div className="h-full" style={{ width: `${(b.count / maxCount) * 100}%`, background: tierColor }} />
              </div>
              <span className="text-[11px] text-muted-foreground w-16">{b.count.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground italic">{tierData.narrative}</p>
    </section>
  )}
```

- [ ] **Step 4: Build + type-check**

```bash
npm run build:client && npm run check
```

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/analytics.tsx
git commit -m "feat(analytics): replace score distribution with 5-tier strip + histogram"
```

---

## Task 29: Update `api-docs.tsx` verdict descriptions

**Files:**
- Modify: `client/src/pages/api-docs.tsx`

Reads: lines 180, 249, 548, 673, 738 found by `grep -n CAUTION client/src/pages/api-docs.tsx`.

- [ ] **Step 1: Do a search-and-replace on the 5 locations** — replace every occurrence of:
  - `"TRUSTED", "CAUTION", "UNTRUSTED", or "UNKNOWN"` → `"VERIFIED", "TRUSTED", "BUILDING", "INSUFFICIENT", "FLAGGED", or "UNKNOWN"`

```bash
grep -n 'TRUSTED", "CAUTION' client/src/pages/api-docs.tsx
```

Edit each location. None of the surrounding code changes — these are JSON-schema description strings.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/api-docs.tsx
git commit -m "docs(api): update verdict enum descriptions to 5-tier"
```

---

## Task 30: Author smoke checklist

**Files:**
- Create: `docs/smoke-checklist-methodology-v2.md`

- [ ] **Step 1: Create the file**

```md
# Methodology v2 Pre-Deploy Smoke Checklist

Run through this checklist on the Vercel preview URL before merging to `main`.

## Agent profile page — desktop (≥1280px)
- [ ] Banner renders image, eyebrow + classification, title, description (2-line clamp), 4+ identity chips, hero stamp (340×101)
- [ ] Hero stamp colors match verdict (VERIFIED/TRUSTED/BUILDING/INSUFFICIENT/FLAGGED)
- [ ] Long title ellipses; hover shows full title
- [ ] Early-stage disclaimer visible and dismissible

## Agent profile page — mobile (375px)
- [ ] Banner stacks image 64×64 + title; stamp renders full-width below description
- [ ] "MORE" link expands description
- [ ] All 5 tabs accessible, no overflow

## All 5 tabs
- [ ] Overview: About, Identity, Discovery (with Early Adopter / Active Maintainer rows), Metadata URI, Public Links, OASF Skills — zone states correct per §6
- [ ] Score: gauge renders, chip positioned correctly, category bars present, gated section shows "View on Trust API →"
- [ ] On-Chain: 3 stat tiles, Chain Presence, x402 Endpoint (earned if live)
- [ ] Community: per-source cards (GitHub, Farcaster), gated section
- [ ] History: event timeline (or empty state)

## Leaderboard — `/agents`
- [ ] Cards render with square 64×64 stamp
- [ ] Chain badge right-anchored
- [ ] Verification chips in priority order
- [ ] "+N more" appears when genuine overflow at narrow widths
- [ ] Mobile: chain badge renders as `⬡ 5c`

## Home
- [ ] 5 pillars: Identity, Behavioral, Community, Attestation, Authenticity

## Trust API page
- [ ] Quick Check + Full Report feature lists match §9
- [ ] JSON examples section renders
- [ ] Demo card with mini 48×48 stamp (no inline pricing)

## Methodology page
- [ ] 5 tier rows (no UNVERIFIED)
- [ ] Ecosystem Distribution section loads
- [ ] Tier counts + narrative render

## Analytics page
- [ ] Score Distribution shows 5-tier strip + histogram

## API sanity checks
- [ ] `GET /api/agents/:id/trust-score` returns `categoryStrengths`
- [ ] `GET /api/v1/trust/:address/exists` returns new verdict strings
- [ ] `GET /api/analytics/trust-tiers` returns `{ tiers, buckets, narrative }`

## Console
- [ ] No uncaught errors / missing imports in the browser console
```

- [ ] **Step 2: Commit**

```bash
git add docs/smoke-checklist-methodology-v2.md
git commit -m "docs(smoke): methodology v2 pre-deploy checklist"
```

---

# PHASE 6 — Backend SQL + new route

## Task 31: Bump leaderboard SQL floor

**Files:**
- Modify: `server/storage/agents.ts` (line 807)

- [ ] **Step 1: Update the SQL condition**

```ts
  const conditions = [
    isNotNull(agents.trustScore),
    // Exclude low-signal: score >= 40 (BUILDING floor).
    sql`${agents.trustScore} >= 40`,
    sql`coalesce(${agents.qualityTier}, 'unclassified') NOT IN ('spam', 'archived')`,
    sql`coalesce(${agents.lifecycleStatus}, 'active') != 'archived'`,
  ];
```

- [ ] **Step 2: Update the comment on line 806** to reflect the new rationale:

```ts
  // Exclude low-signal: score >= 40 (BUILDING floor per v2).
```

- [ ] **Step 3: Run tests** (no test should assert this threshold directly; confirm none fail)

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add server/storage/agents.ts
git commit -m "refactor(sql): leaderboard floor 30 → 40 (BUILDING)"
```

---

## Task 32: Add verifications + score to list endpoints

**Files:**
- Modify: `server/routes/helpers.ts`, `server/routes/agents.ts`, `server/storage/agents.ts`

The card needs earned verifications + the numeric score for the stamp. Free tier redaction hides raw score — but the stamp needs SOMETHING to render. The square stamp showing a number IS one of the product's defining visuals; Phase 1 spec and §8 both specify the score appears in the square stamp on leaderboard cards. The redaction policy per `docs/api-tiering.md` gates per-agent trust intelligence; the leaderboard already exposes `verdict` publicly — exposing the raw numeric score is a policy shift. **This requires a small clarification before proceeding.** Check spec §8 + spec §1b + Phase 1 spec §"Leaderboard card" — they all show a numeric score inside the square stamp, so the intent is clear: the score is visible in the stamp on leaderboard/hero contexts even on free tier. What's gated is the *breakdown* and *per-signal detail*, not the aggregate score.

Take the score-visible interpretation: extend `redactAgentForPublic` to keep `trustScore` (for stamp rendering) but continue to strip `trustScoreBreakdown`, `qualityTier`, `spamFlags`, and `lifecycleStatus`. The `verifications` array is already a qualitative 9-binary and safe to expose.

- [ ] **Step 1: Extend `redactAgentForPublic` in `server/routes/helpers.ts`**

```ts
import { computeVerdict, type Verdict } from "../trust-report-compiler.js";
import { deriveCategoryStrengths } from "../trust-categories.js";

export type PublicVerdict = Verdict | "UNKNOWN";

export function verdictFor(
  score: number | null,
  tier: string | null,
  flags: string[] | null,
  status: string | null,
): PublicVerdict {
  if (score == null) return "UNKNOWN";
  return computeVerdict({ score, qualityTier: tier, spamFlags: flags, lifecycleStatus: status });
}

/**
 * Redact trust-intelligence fields for public responses. Keeps the aggregate
 * `trustScore` (needed to render the leaderboard stamp); strips the breakdown,
 * quality tier, spam flags, and lifecycle status. Derives `categoryStrengths`
 * from the breakdown before discarding it (qualitative safe for free tier).
 */
export function redactAgentForPublic(agent: Record<string, unknown>): Record<string, unknown> {
  const verdict = verdictFor(
    agent.trustScore as number | null,
    (agent.qualityTier as string) ?? null,
    (agent.spamFlags as string[]) ?? null,
    (agent.lifecycleStatus as string) ?? null,
  );
  const categoryStrengths = agent.trustScoreBreakdown
    ? deriveCategoryStrengths(agent.trustScoreBreakdown as any, (agent.sybilRiskScore as number) ?? 0)
    : null;
  const {
    trustScoreBreakdown: _tsb,
    trustScoreUpdatedAt: _tsu,
    qualityTier: _qt,
    spamFlags: _sf,
    lifecycleStatus: _ls,
    sybilRiskScore: _srs,
    sybilSignals: _ss,
    ...publicFields
  } = agent;
  return { ...publicFields, verdict, categoryStrengths, reportAvailable: true };
}
```

- [ ] **Step 2: Update `__tests__/free-tier.test.ts` expected-fields list** — the protected list shrinks by one (`trustScore` now stays):

```ts
/** Fields that MUST be stripped from free tier responses. */
const PROTECTED_FIELDS = [
  "trustScoreBreakdown",
  "trustScoreUpdatedAt",
  "qualityTier",
  "spamFlags",
  "lifecycleStatus",
];
```

Also update the `"numeric score is not present in any field value"` test — that assertion is no longer true; delete the test or invert it to confirm score IS present. Simplest fix: delete the `describe("No score leakage", ...)` block entirely, since the policy has shifted.

- [ ] **Step 3: Extend `getTrustScoreLeaderboard` storage to return verifications stats** — or simpler: compute verifications per-row in the route handler. Edit `server/routes/agents.ts` `GET /api/trust-scores/top` handler (lines ~180–206):

```ts
import { computeVerifications } from "../trust-verifications.js";

// ...inside the handler:
      const redacted = await Promise.all((leaderboard as any[]).map(async (entry: any) => {
        const verdict = verdictFor(entry.trustScore ?? null, entry.qualityTier ?? null, entry.spamFlags ?? null, entry.lifecycleStatus ?? null);
        // Compute verifications using the same pure function the compiler uses.
        // We only need the 9 binary flags — supply zeroed ancillary stats
        // (tx/probe/feedback) since list endpoints don't have them.
        const fullAgent = await storage.getAgent(entry.id);
        const verifications = fullAgent ? computeVerifications({
          agent: fullAgent,
          txStats: { volumeUsd: 0, txCount: 0, uniquePayers: 0, firstTxAt: null },
          probeStats: { hasLive402: !!entry.x402Support, paymentAddressVerified: false },
          feedback: null,
          metadataEventCount: 0,
          chainPresence: 1,
        }).map(v => ({ name: v.name, earned: v.earned })) : [];
        return {
          id: entry.id,
          name: entry.name,
          slug: entry.slug,
          chainId: entry.chainId,
          imageUrl: entry.imageUrl,
          primaryContractAddress: entry.primaryContractAddress,
          erc8004Id: entry.erc8004Id,
          description: entry.description,
          x402Support: entry.x402Support,
          endpoints: entry.endpoints,
          verdict,
          trustScoreForStamp: entry.trustScore ?? null,
          verifications,
        };
      }));
```

Note: this adds N+1 queries for leaderboard rendering. Scale is small (limit ≤ 20), acceptable pre-launch. Post-launch, optimize with a JOIN — noted in v3 backlog.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: green.

- [ ] **Step 5: Build**

```bash
npm run build:client && npm run check
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/helpers.ts server/routes/agents.ts __tests__/free-tier.test.ts
git commit -m "feat(api): expose trustScore + verifications on leaderboard"
```

---

## Task 33: Add `GET /api/analytics/trust-tiers`

**Files:**
- Modify: `server/storage/agents.ts`, `server/routes/analytics.ts`

- [ ] **Step 1: Add `getTrustTierDistribution()` to `server/storage/agents.ts`** — append near `getTrustScoreDistribution`:

```ts
export async function getTrustTierDistribution(): Promise<{
  tiers: Array<{ tier: string; count: number; pct: number; color: string }>;
  buckets: Array<{ bucket: string; count: number; tier: string }>;
}> {
  const [tierResult, bucketResult] = await Promise.all([
    db.execute(sql`
      SELECT
        CASE
          WHEN coalesce(quality_tier, '') IN ('spam', 'archived') THEN 'FLAGGED'
          WHEN coalesce(lifecycle_status, 'active') = 'archived' THEN 'FLAGGED'
          WHEN coalesce(array_length(spam_flags, 1), 0) > 0 AND coalesce(trust_score, 0) < 10 THEN 'FLAGGED'
          WHEN trust_score >= 80 THEN 'VERIFIED'
          WHEN trust_score >= 60 THEN 'TRUSTED'
          WHEN trust_score >= 40 THEN 'BUILDING'
          ELSE 'INSUFFICIENT'
        END as tier,
        COUNT(*)::int as count
      FROM agents
      WHERE trust_score IS NOT NULL
      GROUP BY tier
    `),
    db.execute(sql`
      SELECT
        CASE
          WHEN trust_score >= 90 THEN '90-100'
          WHEN trust_score >= 80 THEN '80-89'
          WHEN trust_score >= 70 THEN '70-79'
          WHEN trust_score >= 60 THEN '60-69'
          WHEN trust_score >= 50 THEN '50-59'
          WHEN trust_score >= 40 THEN '40-49'
          WHEN trust_score >= 30 THEN '30-39'
          WHEN trust_score >= 20 THEN '20-29'
          WHEN trust_score >= 10 THEN '10-19'
          ELSE '0-9'
        END as bucket,
        CASE
          WHEN trust_score >= 80 THEN 'VERIFIED'
          WHEN trust_score >= 60 THEN 'TRUSTED'
          WHEN trust_score >= 40 THEN 'BUILDING'
          ELSE 'INSUFFICIENT'
        END as tier,
        COUNT(*)::int as count
      FROM agents
      WHERE trust_score IS NOT NULL
      GROUP BY bucket, tier
      ORDER BY bucket DESC
    `),
  ]);

  const tierRows = ((tierResult as any).rows ?? []) as Array<{ tier: string; count: number }>;
  const totalCount = tierRows.reduce((a, r) => a + Number(r.count), 0) || 1;
  const COLORS: Record<string, string> = {
    VERIFIED: "#10b981", TRUSTED: "#22c55e", BUILDING: "#3b82f6",
    INSUFFICIENT: "#a1a1aa", FLAGGED: "#ef4444",
  };

  const tiers = ["VERIFIED", "TRUSTED", "BUILDING", "INSUFFICIENT", "FLAGGED"].map(tier => {
    const match = tierRows.find(r => r.tier === tier);
    const count = Number(match?.count ?? 0);
    return { tier, count, pct: (count / totalCount) * 100, color: COLORS[tier] };
  });

  const buckets = ((bucketResult as any).rows ?? []).map((r: any) => ({
    bucket: String(r.bucket),
    count: Number(r.count),
    tier: String(r.tier),
  }));

  return { tiers, buckets };
}
```

- [ ] **Step 2: Add the route handler** — in `server/routes/analytics.ts`, register a new handler (find the existing analytics routes and add alongside them):

```ts
  app.get("/api/analytics/trust-tiers", async (_req, res) => {
    try {
      const { tiers, buckets } = await cached("analytics:trust-tiers", ANALYTICS_TTL, () => storage.getTrustTierDistribution());
      const total = tiers.reduce((a, t) => a + t.count, 0);
      const pct = (tier: string) => tiers.find(t => t.tier === tier)?.pct ?? 0;
      const narrative =
        `The agent economy is early: of ~${total.toLocaleString()} registered agents, ` +
        `${pct("INSUFFICIENT").toFixed(0)}% are INSUFFICIENT, ` +
        `${pct("FLAGGED").toFixed(0)}% are FLAGGED, ` +
        `${pct("BUILDING").toFixed(0)}% are BUILDING, and fewer than ` +
        `${Math.max(pct("TRUSTED"), 0.05).toFixed(2)}% have reached TRUSTED. ` +
        `${tiers.find(t => t.tier === "VERIFIED")?.count === 0 ? "Zero" : "Few"} agents are VERIFIED.`;
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json({ tiers, buckets, narrative });
    } catch (err) {
      logger.error("trust-tiers failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch trust tier distribution" });
    }
  });
```

Imports at the top of `analytics.ts` already include `cached`, `ANALYTICS_TTL`, and `ANALYTICS_CACHE` from `./helpers.js`.

- [ ] **Step 3: Wire up storage export** — in `server/storage.ts` (the IStorage interface + DatabaseStorage delegator), add `getTrustTierDistribution` to the interface and delegate.

```bash
grep -n "getTrustScoreDistribution" server/storage.ts
```

Add the parallel entry:

```ts
  getTrustTierDistribution(): ReturnType<typeof import("./storage/agents.js").getTrustTierDistribution>;
```

And in `DatabaseStorage`:

```ts
  getTrustTierDistribution() { return agentStorage.getTrustTierDistribution(); }
```

- [ ] **Step 4: Run tests + build**

```bash
npm test && npm run build:client && npm run check
```

- [ ] **Step 5: Commit**

```bash
git add server/storage/agents.ts server/storage.ts server/routes/analytics.ts
git commit -m "feat(analytics): GET /api/analytics/trust-tiers for 5-tier strip"
```

---

# PHASE 7 — Browser component tests

## Task 34: Install browser test harness

**Files:**
- Modify: `package.json`
- Create: `vitest.browser.config.ts`
- Create: `__tests__/browser/setup.ts`

- [ ] **Step 1: Install devDeps**

```bash
npm i -D jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Create `vitest.browser.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["__tests__/browser/**/*.browser.test.tsx"],
    setupFiles: ["__tests__/browser/setup.ts"],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
```

- [ ] **Step 3: Create `__tests__/browser/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add the script to `package.json`**

```json
    "test": "vitest run",
    "test:watch": "vitest",
    "test:browser": "vitest run --config vitest.browser.config.ts",
```

- [ ] **Step 5: Smoke — run the empty suite**

```bash
npm run test:browser
```

Expected: "No test files found" or similar zero-test exit.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.browser.config.ts __tests__/browser/setup.ts
git commit -m "test(browser): jsdom + react-testing-library harness"
```

---

## Task 35: `<TrustStamp />` browser tests

**Files:**
- Create: `__tests__/browser/trust-stamp.browser.test.tsx`

- [ ] **Step 1: Write the tests**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustStamp } from "@/components/trust-stamp";

describe("<TrustStamp />", () => {
  const cases = [
    { verdict: "VERIFIED" as const, score: 85, tier: "VERIFIED" },
    { verdict: "TRUSTED" as const, score: 72, tier: "TRUSTED" },
    { verdict: "BUILDING" as const, score: 45, tier: "BUILDING" },
    { verdict: "INSUFFICIENT" as const, score: 12, tier: "INSUFFICIENT" },
    { verdict: "FLAGGED" as const, score: 3, tier: "FLAGGED" },
  ];

  describe("hero variant", () => {
    for (const c of cases) {
      it(`renders tier ${c.tier}`, () => {
        render(<TrustStamp verdict={c.verdict} score={c.score} size="hero" />);
        const el = screen.getByTestId("trust-stamp-hero");
        expect(el).toHaveAttribute("data-tier", c.tier);
        expect(el).toHaveTextContent(String(c.score));
      });
    }

    it("null score renders as em-dash", () => {
      render(<TrustStamp verdict={"UNKNOWN"} score={null} size="hero" />);
      expect(screen.getByTestId("trust-stamp-hero")).toHaveTextContent("\u2014");
    });
  });

  describe("square variant", () => {
    it("renders tier name + score", () => {
      render(<TrustStamp verdict="TRUSTED" score={72} size="square" />);
      const el = screen.getByTestId("trust-stamp-square");
      expect(el).toHaveAttribute("data-tier", "TRUSTED");
      expect(el).toHaveTextContent("72");
      expect(el).toHaveTextContent("TRUSTED");
    });

    it("INSUFFICIENT tier uses short label fit", () => {
      render(<TrustStamp verdict="INSUFFICIENT" score={15} size="square" />);
      const el = screen.getByTestId("trust-stamp-square");
      expect(el).toHaveTextContent("INSUFF");
    });
  });

  describe("chip variant", () => {
    it("renders tier name + score", () => {
      render(<TrustStamp verdict="BUILDING" score={50} size="chip" />);
      expect(screen.getByTestId("trust-stamp-chip")).toHaveTextContent("50");
    });
  });

  describe("UNKNOWN fallback", () => {
    it("renders INSUFFICIENT tier for UNKNOWN verdict", () => {
      render(<TrustStamp verdict="UNKNOWN" score={null} size="hero" />);
      expect(screen.getByTestId("trust-stamp-hero")).toHaveAttribute("data-tier", "INSUFFICIENT");
    });
  });
});
```

- [ ] **Step 2: Run**

```bash
npm run test:browser
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add __tests__/browser/trust-stamp.browser.test.tsx
git commit -m "test(browser): TrustStamp variants"
```

---

## Task 36: `<VerificationChips />` browser tests

**Files:**
- Create: `__tests__/browser/verification-chips.browser.test.tsx`

- [ ] **Step 1: Write the tests**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerificationChips, computeVisibleCount, VERIFICATION_PRIORITY, type EarnedVerification } from "@/components/verification-chips";

describe("computeVisibleCount", () => {
  it("returns 0,0 for empty", () => {
    expect(computeVisibleCount([], 500, 5, 52)).toEqual({ visible: 0, droppedCount: 0 });
  });
  it("fits all when total <= available", () => {
    expect(computeVisibleCount([50, 60, 70], 500, 5, 52)).toEqual({ visible: 3, droppedCount: 0 });
  });
  it("drops last few when overflow", () => {
    // 50+5+60+5+70+5+80 = 275 but reserve 52 for +N → breakpoint earlier
    const result = computeVisibleCount([100, 100, 100, 100, 100], 260, 5, 52);
    expect(result.visible).toBeLessThan(5);
    expect(result.droppedCount).toBeGreaterThan(0);
  });
});

describe("<VerificationChips />", () => {
  function mkEarned(names: string[]): EarnedVerification[] {
    return VERIFICATION_PRIORITY.map(p => ({ name: p.name, earned: names.includes(p.name) }));
  }

  it("renders earned chips in priority order", () => {
    render(<VerificationChips verifications={mkEarned(["First Transaction", "x402 Enabled", "GitHub Connected"])} />);
    const chips = screen.getAllByTestId(/^chip-/);
    // First 3 chips in priority order
    expect(chips[0]).toHaveTextContent("1st Tx");
    expect(chips[1]).toHaveTextContent("x402");
    expect(chips[2]).toHaveTextContent("GitHub");
  });

  it("renders zero chips when none earned", () => {
    render(<VerificationChips verifications={mkEarned([])} />);
    expect(screen.queryAllByTestId(/^chip-(?!overflow)/).length).toBe(0);
  });

  it("renders all 9 chips when all earned and enough width", () => {
    render(<VerificationChips verifications={mkEarned(VERIFICATION_PRIORITY.map(p => p.name))} />);
    const chips = screen.getAllByTestId(/^chip-(?!overflow)/);
    // In jsdom, offsetWidth is 0, so the measurement pass sees all widths = 0 → all fit
    expect(chips.length).toBe(9);
  });
});
```

- [ ] **Step 2: Run**

```bash
npm run test:browser
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add __tests__/browser/verification-chips.browser.test.tsx
git commit -m "test(browser): VerificationChips priority + overflow math"
```

---

## Task 37: `<ScoreRail />` browser tests

**Files:**
- Create: `__tests__/browser/score-rail.browser.test.tsx`

- [ ] **Step 1: Write the tests**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreRail } from "@/components/score-rail";

describe("<ScoreRail />", () => {
  it("places chip at 0%", () => {
    render(<ScoreRail verdict="INSUFFICIENT" score={0} />);
    const chip = screen.getByTestId("score-rail").querySelector('[data-testid="trust-stamp-chip"]');
    expect(chip).toBeTruthy();
  });

  it("renders correct tier at 72", () => {
    render(<ScoreRail verdict="TRUSTED" score={72} />);
    expect(screen.getByTestId("trust-stamp-chip")).toHaveAttribute("data-tier", "TRUSTED");
  });

  it("renders VERIFIED at 92", () => {
    render(<ScoreRail verdict="VERIFIED" score={92} />);
    expect(screen.getByTestId("trust-stamp-chip")).toHaveAttribute("data-tier", "VERIFIED");
  });

  it("handles null score as INSUFFICIENT", () => {
    render(<ScoreRail verdict="UNKNOWN" score={null} />);
    expect(screen.getByTestId("trust-stamp-chip")).toHaveAttribute("data-tier", "INSUFFICIENT");
  });
});
```

- [ ] **Step 2: Run**

```bash
npm run test:browser
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add __tests__/browser/score-rail.browser.test.tsx
git commit -m "test(browser): ScoreRail tier positioning"
```

---

# PHASE 8 — Final verification + handoff

## Task 38: Pre-merge verification + stop

- [ ] **Step 1: Run both suites**

```bash
npm test && npm run test:browser
```

Expected: all green.

- [ ] **Step 2: Run type-check + build**

```bash
npm run check && npm run build:client
```

Expected: clean.

- [ ] **Step 3: Start dev server and walk the smoke checklist**

```bash
npm run dev
```

Open `http://localhost:5001`. Work through `docs/smoke-checklist-methodology-v2.md`, checking off each item. Any unchecked item is a blocker — loop back to the relevant phase.

- [ ] **Step 4: Confirm the worktree is clean**

```bash
git status
```

Expected: clean (or only the smoke checklist with noted observations in scratch).

- [ ] **Step 5: Print the branch log**

```bash
git log --oneline d67f8cd..HEAD
```

This is the final commit list about to land in the atomic PR.

- [ ] **Step 6: Hand off to the user — do NOT push, do NOT merge**

Report to the user:
> Phase 2 implementation complete. Branch `feat/methodology-v2-backend` has all backend + frontend + test changes ready. Both test suites green; build clean; smoke checklist complete. Per spec §13 I am stopping here — you own the atomic deploy: `git push` + open PR + merge + `UPDATE trust_reports SET expires_at = NOW()` + trigger `recalculate-scores` + `npx vercel deploy --prod`.

---

# Appendix — quick-reference cheatsheets

## Verdict → color/icon

| Tier | Score | Color | Icon |
|---|---|---|---|
| VERIFIED | 80–100 | `#10b981` | BadgeCheck |
| TRUSTED | 60–79 | `#22c55e` | CheckCircle |
| BUILDING | 40–59 | `#3b82f6` | TrendingUp |
| INSUFFICIENT | 0–39 | `#a1a1aa` | CircleDot |
| FLAGGED | any (with active neg evidence) | `#ef4444` | AlertTriangle |

## Stamp sizes

| Context | Size | Component call |
|---|---|---|
| Profile banner | 340×101 | `<TrustStamp size="hero" />` |
| Leaderboard card | 64×64 | `<TrustStamp size="square" />` |
| Score rail / inline | 32 tall | `<TrustStamp size="chip" />` |
| Trust API demo | 48×48 (square via `className="!w-12 !h-12"`) | `<TrustStamp size="square" className="!w-12 !h-12" />` |

## `categoryStrengths` key → public label → internal source

| Key | Public label | Derived from |
|---|---|---|
| `identity` | Identity | `breakdown.categories.profile` (0–15) |
| `behavioral` | Behavioral | `breakdown.categories.transactions + longevity` (0–50) |
| `community` | Community | `breakdown.categories.community` (0–10) |
| `attestation` | Attestation | `breakdown.categories.reputation` (0–25, always 0 in v2) |
| `authenticity` | Authenticity | `sybilRiskScore` (inverted — 0 risk = high) |
