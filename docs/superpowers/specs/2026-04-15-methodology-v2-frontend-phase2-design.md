# Methodology v2 Frontend — Phase 2 Design Spec

**Status:** Phase 2 design LOCKED. Implementation pending.
**Date:** 2026-04-15
**Phase 1 dependency:** `docs/superpowers/specs/2026-04-15-methodology-v2-frontend-design.md` (LOCKED)
**Backend dependency:** branch `feat/methodology-v2-backend` (commit `d67f8cd`, 263/263 tests)
**Visual mockups:** `.superpowers/brainstorm/*/content/*.html` — 20+ screens covering every decision in this spec
**Development posture:** Site is public but pre-launch / stealth mode (no meaningful traffic). Phase 2 can assume reasonable risk for faster iteration.

---

## Table of contents

1. [Changes that impact the backend contract](#1-changes-that-impact-the-backend-contract)
2. [Verdict system — 5 visible tiers](#2-verdict-system--5-visible-tiers)
3. [Mobile banner](#3-mobile-banner)
4. [Below-banner structure (Option C)](#4-below-banner-structure-option-c)
5. [Tab wireframes](#5-tab-wireframes)
6. [Zone-level activation](#6-zone-level-activation)
7. [Score tab](#7-score-tab)
8. [Leaderboard card](#8-leaderboard-card)
9. [Trust API page](#9-trust-api-page)
10. [Score distribution analytics](#10-score-distribution-analytics)
11. [Content copy updates](#11-content-copy-updates)
12. [SQL threshold refresh](#12-sql-threshold-refresh)
13. [Deploy choreography](#13-deploy-choreography)
14. [Test strategy](#14-test-strategy)
15. [Naming changes](#15-naming-changes)
16. [v3 backlog (logged, out of scope)](#16-v3-backlog-logged-out-of-scope)
17. [Implementation sequencing](#17-implementation-sequencing)

---

## 1. Changes that impact the backend contract

Phase 2 was scoped as "frontend only within frozen backend contract." Two decisions surface necessary backend deltas:

### 1a. Verdict consolidation: 6 tiers → 5 visible tiers
- Remove `UNVERIFIED` from `Verdict` union
- Rename `INSUFFICIENT_DATA` → `INSUFFICIENT`
- `computeVerdict()` simplified: `>= 80 VERIFIED, >= 60 TRUSTED, >= 40 BUILDING, else INSUFFICIENT` (FLAGGED still requires active negative evidence)
- `PublicVerdict = Verdict | "UNKNOWN"` retained; UNKNOWN reserved for null-score agents (API only, UI never renders UNKNOWN as a stamp — see §2)

### 1b. Category scores exposed in a safe form
Score tab's free-tier breakdown (§7) needs per-category indicators. To avoid leaking the gated numeric breakdown, backend adds a tier-bucketed field:
- New `categoryStrengths` field on the free `trustRating` API shape: `{ identity: 'high' | 'medium' | 'low' | 'none', behavioral: ..., community: ..., authenticity: ..., attestation: ... }` (5 keys)
- Derived at compile time from category numeric scores, bucketed by coarse thresholds (e.g., `>=70 = high`, `>=40 = medium`, `>=1 = low`, `0 = none`)
- Raw numeric scores remain gated behind the $0.05 Full Report
- Free tier JSON stays lean: `categoryStrengths` is qualitative only

Both changes are small (type edits, threshold bucketing, fixture updates). Backend must ship alongside frontend atomically — no intermediate deploy.

---

## 2. Verdict system — 5 visible tiers

**Visible:** VERIFIED · TRUSTED · BUILDING · INSUFFICIENT · FLAGGED

| Tier | Score | Color | Icon (Lucide) |
|---|---|---|---|
| VERIFIED | 80–100 | `#10b981` emerald | `BadgeCheck` |
| TRUSTED | 60–79 | `#22c55e` green | `CheckCircle` |
| BUILDING | 40–59 | `#3b82f6` blue | `TrendingUp` |
| INSUFFICIENT | 0–39 | `#a1a1aa` zinc-400 | `CircleDot` |
| FLAGGED | active negative evidence | `#ef4444` red | `AlertTriangle` |

**UNKNOWN handling (rare, short-lived):** agent exists in index but `trust_score = null` (scoring pipeline hasn't run yet). UI renders as **INSUFFICIENT tier with `—` in place of the score number**. No spinner, no placeholder, no pending component — just the INSUFFICIENT stamp with a dash. API still returns `verdict: "UNKNOWN"` for programmatic consumers who need the distinction.

**Stamp sizes (Phase 1 spec updated):**
- **Hero 340×101** — agent profile banner
- **Square 64×64** — leaderboard card (NEW, replaces the rectangular 150×60 "leaderboard" size from Phase 1 — that size is no longer used)
- **Mobile chip 32px tall** — inline contexts (Score tab header)

Tier name fit at 64×64: default `9px/900 letter-spacing 0.5`. Long tiers (INSUFFICIENT) get modifier class `.long` → `8px/900 letter-spacing 0`.

---

## 3. Mobile banner

**<640px layout — Option B locked:**
- Full banner width, constrained to viewport
- Top row: image 64×64 (left) + flex text column (right, `min-width: 0`)
- Text column inside `height: 64px` with `justify-content: center` — eyebrow + 2-line-clamped title vertically centered
- Eyebrow: classification only (drop "Active since..." on mobile), `9px/700 letter-spacing 2px`, single-line ellipsis
- Title: `17px/800 line-height 1.2`, 2-line clamp with word-break
- Description: `11px/400 line-height 1.45`, 2-line clamp + MORE link (inline expand, pushes content down)
- Trust Rating stamp: **full-width** below description, split-block (52px icon slab + flex info block)
- Chips: wrap allowed, all visible (no progressive drops)
- Gradient bg: derived from `addressToColor(agent.controllerAddress)`
- Banner container: `overflow: hidden` + `min-width: 0` on all flex children (prevents overflow with long names)
- Image fallback (no URL): charcoal gradient + faded robot emoji

---

## 4. Below-banner structure (Option C)

**Tabs are the primary UI.** Only one thin item lives above the tabs. Verifications are distributed *into* tab content as zone-level activation (§6).

```
[Banner]
[Early-stage disclaimer bar, dismissible]
[Tabs: Overview | Score | On-Chain | Community | History]
[Tab content with contextual zone-activated content + gated sections + CTA]
```

**Early-stage disclaimer** — single thin row above tabs:
> ⚠ **Early-stage ecosystem** — Attestation signals aren't active yet; effective score ceiling is ~75/100. Applies to all agents until v3.

Dismissible via localStorage. Removable globally when v3 ships (one line to delete the global disclaimer component mount).

**Per-agent "insufficient data" disclaimer** — inline, only on INSUFFICIENT-tier agent profiles:
> ⓘ Limited on-chain activity available. Score reflects available evidence only.

---

## 5. Tab wireframes

Five tabs, each with real free content + (optional) gated section + restrained CTA:

### Overview (fully free)
- **About** (full unabbreviated description — banner only shows 2-line clamped version)
- **Identity** (chain, contract, controller, ERC-8004 ID)
- **Discovery** (first seen, last updated, metadata URI, status) — **also carries Early Adopter + Active Maintainer as data rows**: `Early Adopter: ✓ Yes` / `Active Maintainer: — No`
- **Metadata URI** (earned zone when IPFS/Arweave — carries `IPFS Metadata` verification)
- **Public Links** (website, docs, ENS — derived from `agent.endpoints` + controller reverse ENS lookup; muted + "NONE" tag when empty)
- **Declared Capabilities**
- **OASF Skills** (earned zone when declared — carries `OASF Skills` verification)

No CTA. No gated section.

### Score
- **Score rail** — horizontal segmented bar with 5 tier colors. Score chip (mobile-chip size, tier-recolored) positioned horizontally at score% above the bar. Large white dot marker (18px) on the bar at the same position. Tier labels anchor under each segment.
- **Evidence Basis** callout (lead section): "Based on N verified transactions from M unique payers across K chains, indexed over D days" — in blue-tinted card
- **Score Breakdown** (Option B with category rubric exposure):
  - 5 category rows with colored icon tiles: Identity (user/blue) · Behavioral (activity/green) · Community (people/purple) · Attestation (shield/amber) · **Authenticity** (shield-alert/red, formerly "Sybil Resistance")
  - Proportional bars per category — widths derived from new `categoryStrengths` tier buckets (not raw scores)
  - No qualitative word labels ("STRONG" etc.) — bars only
  - Tooltip "i" hint next to each category name (hover reveals description)
  - Footer: **"View Methodology"** (neutral button, educational) + **"Unlock full breakdown"** (blue CTA, links to /trust-api — no pricing shown)
- **Confidence** indicator (low/medium/high with a small meter)
- Dashed divider + gated block describing 21 signal scores / sybil detail / provenance hash
- Single "View on Trust API →" CTA at bottom

### On-Chain Activity
- **3 stat tiles** (earned zones): Verified Txs count · Chains count · x402 Status (Live/Off)
- **Chain Presence** (earned zone — carries `Multi-Chain` verification when 3+): each chain with brand-colored logo tile (Base #0052FF, Arbitrum #28A0F0, Optimism #FF0420, Polygon #8247E5, Ethereum #627EEA, etc.), first-seen date, aggregate tx count, activity indicator (ACTIVE/LOW/DORMANT based on recency bucketing)
- **x402 Endpoint** (earned zone — carries `x402 Enabled`): endpoint URL, last-probed timestamp, probe response status
- Dashed divider + gated block: transaction list, unique payers, payment patterns, per-chain volume breakdown
- Single "View on Trust API →" CTA

### Community
- **Indexed Sources** summary card (blue-tinted): "1 of 2 community sources indexed" — scales to N/M as we add sources
- **Per-source cards** in responsive grid (`repeat(auto-fit, minmax(180px, 1fr))`):
  - GitHub (black/white GitHub mark SVG) — earned when `githubHealthScore > 0`
  - Farcaster (purple Warpcast mark) — earned when `farcasterScore > 0`
  - Future: Discord, X, Lens, etc. — grid auto-flows
  - Each card: logo + name + status badge (INDEXED/NOT LINKED) + link or empty state
- Dashed divider + gated block: health scores, commit history, follower counts, Neynar score
- Single "View on Trust API →" CTA

### History (fully free)
- Metadata event timeline (registrations, metadata updates, ownership changes)
- Absorbs the v1 "Technical" tab content (block numbers, raw events)
- No CTA, no gated section

---

## 6. Zone-level activation

**Replaces the original "verification strip" idea.** Every verification badge lives *inside* the content zone that represents it. This eliminates redundancy between a strip saying "✓ GitHub Connected" and a GitHub card below showing the same fact.

**Rules:**
- **Populated zone with verification earned:** 3px green left-border + tiny green dot on section label + small uppercase status tag top-right (e.g., `IPFS ✓`, `DECLARED ✓`, `INDEXED ✓`, `LIVE ✓`, `MULTI ✓`)
- **Populated zone without a verification tie:** plain label, no dot, no border (e.g., About, Identity, Capabilities)
- **Empty zone (no content):** 3px grey left-border + muted content at ~55% opacity + "NONE" tag

**Mapping all 9 verifications to zones:**
| Verification | Zone |
|---|---|
| IPFS Metadata | Metadata URI card (Overview) |
| OASF Skills | OASF Skills card (Overview) |
| GitHub Connected | GitHub source card (Community) |
| Farcaster Connected | Farcaster source card (Community) |
| x402 Enabled | x402 Endpoint block + stat tile (On-Chain) |
| Multi-Chain | Chain Presence block + stat tile (On-Chain) |
| First Transaction | Verified Txs stat tile (On-Chain) |
| Early Adopter | Discovery card data row (Overview) |
| Active Maintainer | Discovery card data row (Overview) |

**Where the compact chip form survives:** leaderboard card (scan-friendly, different context from profile zone model) and methodology page (canonical verification documentation).

---

## 7. Score tab

### Score rail header
- Horizontal 0–100 bar, segmented by tier width (4%/20%/20%/20%/36% for FLAG/INSUFFICIENT/BUILDING/TRUSTED/VERIFIED respectively — FLAGGED rendered as thin 4% red segment at the far left only when applicable)
- Score chip floats above the bar, positioned at `score%` via `left: X%; transform: translateX(-50%)` — recolored to match tier
- Edge clamping: chips near the left/right edges use adjusted translateX (e.g., `-20%` for left edge, `-80%` for right edge) so they stay in-frame
- White dot marker on the bar, 18px diameter with dark halo + outer white ring (box-shadow layers) — strongly readable against any tier color
- Below bar: 6 tier labels anchored under their segments (short code "FLAG" for the tiny FLAGGED segment)

### Score Breakdown (Option B — qualitative bars)
- Driven by the new `categoryStrengths` field from backend
- No exact numbers visible
- Makes the Score tab visually alive without leaking gated data
- Tooltips on hover describe what each category measures

### Evidence Basis
- Prominent blue-tinted card immediately after the score rail
- Dynamic copy: "Based on N verified transactions from M unique payers across K chains, indexed over D days"
- Empty state: "Profile data only — no verified transactions recorded yet for this agent"

### Gated section
- Dashed divider with small "Detailed breakdown" label
- 60%-opacity dashed-border gated block listing what's inside the Full Report (5 category scores, 21 signals, sybil dampening detail, provenance hash)
- Single "View on Trust API →" CTA — blue, understated, no pricing shown

---

## 8. Leaderboard card

Half-page width default (`lg:grid-cols-2` on `/agents` + landing). Mobile/tablet: 1-col.

**Layout (~450px wide card at half-page, ~380px at mobile):**
- **Top row:** avatar 64×64 (left) + flex text column (name + chain-badge on same line, description 2-line-clamped below) + **square stamp 64×64 (right)**
- **Chip row** (below, full-width, `display: flex; gap: 5px`):
  - Address (fixed width, `flex: 0 1 auto`) — `0x7d...f4e8` mono
  - Priority-ordered earned verifications (flex `1 1 auto`, stretch to fill)
  - "+N more" chip (fixed, `flex: 0 1 auto`) — only when genuine overflow occurs

### Square stamp 64×64
- **Top block (tier color):** score number only, `22px/800 font-variant-numeric: tabular-nums` (icon removed — score carries the tier visually via color + number)
- **Bottom block (tier-tint, 18px min-height):** tier name, `9px/900 letter-spacing 0.5`. Long tier (INSUFFICIENT) uses `.long` modifier → `8px/900 letter-spacing 0`
- Score fallback: `—` when `score == null` or `verdict === "UNKNOWN"`, tier = INSUFFICIENT

### Chain badge
- Right-anchored on title row, fixed width, never shrinks
- Desktop: `⬡ Base +4`
- Mobile (<640px): `⬡ 5c` (count-only)

### Verification chip priority order
Earned-first, in this priority:
1. First Transaction — `✓ 1st Tx`
2. x402 Enabled — `✓ x402`
3. GitHub Connected — `✓ GitHub`
4. IPFS Metadata — `✓ IPFS`
5. OASF Skills — `✓ OASF`
6. Active Maintainer — `✓ Active`
7. Farcaster Connected — `✓ Farcaster`
8. Multi-Chain — `✓ Multi`
9. Early Adopter — `✓ Early`

**Fit-as-many-as-possible** — "+N more" only appears on actual overflow:
- Runtime measurement via `useLayoutEffect` + `element.scrollWidth` + `ResizeObserver`
- Render all chips in hidden measurement pass
- Walk priority list, accumulate widths + gaps, stop when next chip overflows
- Reserve ~50px for "+N more" only when dropped count > 0
- Visible chips use `flex: 1 1 auto` to grow and fill remaining space
- Alternative: ~40-line custom hook instead of a library dependency

**Clicking "+N more"** navigates to agent profile (canonical verification list lives there as zone-activation).

### Title / description overflow
- Title: single-line ellipsis with full title in `title=""` tooltip attribute
- Description: 2-line `-webkit-line-clamp` with `word-break: break-word`
- Empty description: italic "No description provided." at 50% opacity (preserves 2-line vertical space)

### Dropped from v1 card
- Endpoint count chip (low scan value)
- Profile % chip (internal completeness metric, conflicts with verification count)

---

## 9. Trust API page

See `.superpowers/brainstorm/*/content/trust-api-page.html` for visual reference.

### Changes
- **VerdictBadge internal component** (lines 20–32) — replace v1 variants (TRUSTED/CAUTION/UNTRUSTED/UNKNOWN) with the 5 tiers + UNKNOWN
- **Quick Check feature list:**
  - Kept: verdict, composite score
  - Added: evidence basis summary, 9 verification states, confidence level, methodology version + provenance hash, **category strengths** (qualitative)
  - Removed: "5-category score breakdown" (moved to Full Report), "x402 status" (now in verifications)
- **Full Report feature list:**
  - Added: 5 numeric category scores, 21 individual signal scores, sybil detection signals and dampening detail
  - Kept: agent identity, tx history, GitHub health, Farcaster engagement, registration timeline, per-chain breakdown
- **NEW: JSON examples section** between pricing cards and "How x402 Works". Shows both tiers with the two-layer shape (`trustRating` + `verifications` + `evidenceBasis`, plus Full Report's `categoryScores`/`signalScores`/`community`/`transactions`)
- **Live demo result card** — replace verdict badge + inline pricing line with mini 48×48 square stamp + evidence summary. Drop inline pricing.
- **Endpoint paths** — verify against `server/routes/trust.ts` during implementation

---

## 10. Score distribution analytics

Rendered on **both** `/analytics` and the `/methodology` page (as a new "Ecosystem Distribution" section — methodology is the canonical home for honest data about what the scoring produces in practice).

### Three components

**a. 5-tier summary strip** — 5 tier cards with 3px left-border in tier color:
| Tier | Example count (prod 2026-04-15) |
|---|---|
| VERIFIED | 0 (0.0%) |
| TRUSTED | 30 (0.03%) |
| BUILDING | 3,961 (3.8%) |
| INSUFFICIENT | 56,044 (54.3% — non-flagged) |
| FLAGGED | 42,633 (41.3%) |

**b. 10-bucket histogram** — horizontal bars, each bucket colored by its tier:
- Preserves score-granularity for power users
- Tier badge next to count labels each bar
- Widths proportional to count (max 100%)

**c. Narrative callout:**
> The agent economy is early: of ~103,000 registered agents, 54% are INSUFFICIENT, 41% are FLAGGED, 4% are BUILDING, and fewer than 0.05% have reached TRUSTED. Zero agents are VERIFIED. As x402 and community-attestation systems mature, expect the distribution to shift upward.

### Implementation
- `getTrustScoreDistribution` in `server/storage/agents.ts` — keep 10-bucket SQL, add a `tier` field via CASE mapping
- Augment or add endpoint: per-tier totals + separate FLAGGED count
- No Recharts needed — plain CSS divs render faster and are simpler
- Dynamic percentages in narrative copy (computed at render time)

---

## 11. Content copy updates

### `client/src/lib/content-zones.ts`

- **Home page pillars heading:** "Five Dimensions of Agent Trust" → **"Five Categories of Agent Trust"**
- **Pillars array:** replace 3 current items (Identity & Capability / Community & Reputation / History & Transparency) with v2's 5 actual categories:
  1. **Identity** — controller, metadata, on-chain identity signals
  2. **Behavioral** — transaction patterns, payment cadence, activity consistency
  3. **Community** — GitHub health, Farcaster presence, external reputation
  4. **Attestation** — third-party verifications via on-chain attestation (inactive in v2, scheduled for v3)
  5. **Authenticity** — detection of coordinated agent networks (Sybil resistance; public-facing name is Authenticity)
- **Verdict list copy** (line 133): "TRUSTED, CAUTION, UNTRUSTED, or UNKNOWN" → **"VERIFIED, TRUSTED, BUILDING, INSUFFICIENT, or FLAGGED"**
- **METHODOLOGY.categories** — verify all 5 category records use the v2 naming. Rename any references to "Sybil Resistance" → "Authenticity" for public-facing copy (internal type/API name `sybil` unchanged)
- **Tier references in prose** — swap all `INSUFFICIENT_DATA`/`UNVERIFIED` → `INSUFFICIENT`

### `client/src/pages/methodology.tsx`
- Add **"Ecosystem Distribution"** section using the analytics design (§10)
- Drop the UNVERIFIED row from any tier tables (now merged into INSUFFICIENT)
- Update the "Attestation" description to use a softer aspirational tone (v3-inactive)
- Add the **Early-stage ecosystem** disclaimer to the methodology narrative (context for viewers exploring how trust is measured)

### `client/src/pages/trust-api.tsx`
All changes from §9.

---

## 12. SQL threshold refresh

**File:** `server/storage/agents.ts`

| Line | Current | v2 change | Rationale |
|---|---|---|---|
| 77 | `score >= 60` for TRUSTED quality gate | **Keep `>= 60`** | Aligns with new TRUSTED floor (60–79) |
| 806 | `score >= 30` for leaderboard inclusion | **Change to `>= 40`** | Match BUILDING floor — leaderboard shows agents with meaningful trust signals. ~4k qualifying agents at current production scale |
| 831, 853, 856 | 10-point bucket labels | No logic change; analytics page colors them by tier | — |

---

## 13. Deploy choreography

**Atomic cutover — single PR strategy.** Site is public but pre-launch (stealth mode, no meaningful traffic) — acceptable risk for a coordinated deploy.

### Pre-merge
- All 263 backend tests green on `feat/methodology-v2-backend` + frontend branch
- New frontend component tests pass (stamp variants, chip overflow, score rail positioning)
- Manual smoke on staging (Vercel preview URL)
- Trigger dev test run on preview branch

### Merge sequence
1. **Merge to `main` triggers:**
   - Vercel deploys Express API + React frontend atomically (~2 min)
   - GitHub Actions deploys Trigger.dev production tasks (~4–5 min)
   - Short window (~2 min) between these where Trigger tasks may emit old verdict strings (`UNVERIFIED` / `INSUFFICIENT_DATA`). Impact: minimal — tasks auto-retry, no user-facing error
2. **Post-merge:**
   - `UPDATE trust_reports SET expires_at = NOW()` (flush cached reports)
   - Manually trigger `recalculate-scores` once — refreshes all ~100k agent scores with the new 5-tier logic
   - `npx vercel deploy --prod` (force fresh edge cache)
   - Spot-check 5–10 agents across tiers on production
   - Verify Trust API demo with a known TRUSTED agent

### Rollback
- `git revert` the merge commit → push → Vercel redeploys old version (~2 min)
- GitHub Actions redeploys old Trigger tasks automatically
- No DB migration required — nothing to roll back at the data layer

### Stealth-mode note
Because site traffic is minimal pre-launch, the 2-minute Trigger-mismatch window is tolerable. Post-launch, revisit with a blue/green or staged deploy strategy.

---

## 14. Test strategy

### Unit tests (Vitest)
- `trust-report-compiler.test.ts` — `computeVerdict()` returns correct tier for each score range. Add UNVERIFIED deprecation test (any call with `UNVERIFIED` in expectations is a rewrite)
- `trust-verifications.test.ts` — all 9 verifications compute correctly (existing; verify still pass)
- NEW: `category-strengths.test.ts` — tier-bucketing function for `categoryStrengths` field

### Component tests (Vitest + React Testing Library)
- `<TrustStamp />` — renders for all 5 tiers + null-score fallback (INSUFFICIENT with "—")
- `<VerificationChips />` — priority ordering + overflow "+N more" at 0, 1, 3, 5, 8, 9 earned
- `<ScoreRail />` — chip positions correctly at scores 0, 50, 72, 92; edge clamping works

### Manual smoke checklist (documented in spec, run pre-deploy)
- Agent profile: banner + 5 tabs at desktop + mobile widths
- Leaderboard: 2-col at `lg+`, 1-col at `sm`
- Home page: new 5-category pillars render
- Trust API demo: lookup returns correct JSON shape
- Analytics: score distribution shows 5 tiers + histogram
- Methodology: new "Ecosystem Distribution" section renders

### Optional Playwright (if time allows)
- Trust API demo flow: enter address → result card renders correctly
- Home → /agents → click card → profile loads

---

## 15. Naming changes

| Internal (API / type / code) | Public-facing (UI / copy / docs) |
|---|---|
| `sybil` | **Authenticity** |
| `INSUFFICIENT_DATA` | **INSUFFICIENT** |
| `UNVERIFIED` | — (folded into INSUFFICIENT) |
| `UNKNOWN` (API response) | — (never rendered; UI falls back to INSUFFICIENT + "—" score) |

**Rationale for "Authenticity" over "Sybil Resistance":**
- One word (matches Identity, Behavioral, Community, Attestation)
- Human-friendly — users don't need to know what Sybil means
- Semantic match: the category measures whether the agent is a real, distinct entity (not part of a coordinated fake network)
- Trivially swappable in `content-zones.ts` if user later prefers a different public name. Internal `sybil` identifier stays — no backend rename needed.

---

## 16. v3 backlog (logged, out of scope)

### New verification candidates (require backend changes)
- **Domain Verified** — endpoint URL matches a known project domain
- **Docs Published** — linked docs site detected
- **Open Source** — GitHub repo has OSI-approved license (MIT, Apache, etc.)
- **ENS Resolved** — controller has ENS reverse record
- **Audited** — public audit reference provided
- **Repeat Payers** — ≥ N unique payers paid more than once (high behavioral signal)

### Leaderboard chips (need backend data)
- **Category chip** — requires content-categorization pipeline (rule-based on name + description + known x402 categories, or LLM classifier in enrichment task). No reliable data today (`oasf_domains` 0.06%, `capabilities` 5.7% coverage, both free-text / noisy)
- **Activity chip** — requires computed `lastActivityAt` field on agents (`max` of metadata event + tx recency timestamps), exposed on agent list endpoint. Current `lifecycle_status` is a quality signal, not real-time activity

### Phase 2 → v3 upgrade
- Attestation category becomes active (ERC-8004 reputation-event table + pipeline)
- Global "Early-stage ecosystem" disclaimer removed when attestation category has meaningful coverage

---

## 17. Implementation sequencing

Recommended order for the next-session plan:

1. **Backend type changes** (verdict consolidation + `categoryStrengths` field)
   - Edit `server/trust-report-compiler.ts` — remove UNVERIFIED, rename INSUFFICIENT_DATA → INSUFFICIENT, add tier-bucketing for categoryStrengths
   - Update `computeVerdict()` thresholds
   - Rewrite fixtures + tests
   - Run existing backend test suite to green

2. **Frontend component library** (standalone, testable)
   - `<TrustStamp />` — 3 sizes (hero / square / chip) with 5-tier variants + null fallback
   - `<VerificationChips />` — priority overflow logic
   - `<ScoreRail />` — gauge with chip sliding
   - `<CategoryBars />` — score breakdown using `categoryStrengths`
   - `<ZoneCard />` — generic activated-zone wrapper
   - `<ChainBadge />` update — mobile short form

3. **Agent profile page** (`agent-profile.tsx`)
   - Banner zone (Phase 1 design + mobile from §3)
   - Early-stage disclaimer bar
   - 5 tabs with zone activation (§5, §6)
   - Score rail + breakdown + evidence (§7)

4. **Leaderboard card** (`agent-card.tsx`) — complete rewrite per §8

5. **Trust API page** (`trust-api.tsx`) — §9

6. **Methodology page** (`methodology.tsx`) — §10 + §11

7. **Analytics page** (`analytics.tsx`) — §10

8. **Content zones** (`content-zones.ts`) — §11

9. **SQL threshold edits** — §12

10. **Tests** — §14 throughout

11. **Atomic deploy** — §13

---

## Open questions / items to confirm at implementation time

- Exact API endpoint paths for Quick Check / Full Report — verify against `server/routes/trust.ts` and update JSON examples accordingly
- Bucket thresholds for `categoryStrengths` (`high/medium/low/none`) — calibrate against production distribution at implementation time (e.g., `>=70 high, >=40 medium, >=1 low, 0 none` is a starting point; may need adjustment)
- Confirm `lastActivityAt` or equivalent available for chain-presence ACTIVE/LOW/DORMANT derivation — if not present, use `lastUpdatedBlock` timestamp bucket as fallback

---

**End of Phase 2 design spec.**
