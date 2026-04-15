# Methodology v2 Frontend — Design Spec

**Status:** Phase 1 (Trust Rating stamp + Banner Zone) LOCKED  
**Phase 2:** Mobile banner, Verifications strip, Evidence basis, Disclaimers, Tabs, Leaderboard card — NOT YET DESIGNED  
**Date:** 2026-04-15  
**Brainstorm session:** Visual companion mockups in `.superpowers/brainstorm/`

---

## Naming (locked)

| Term | Use | Context |
|---|---|---|
| **Trust Rating** | The product — primary consumer-facing term | Headline everywhere. Matches backend `trustRating` object. Eventual trademark target. |
| **Trust Score** | The numeric 0–100 specifically | "The Trust Score is 73." Use when referring to just the number. |
| **Verdict** | Machine-facing tier enum | API/developer-facing, unchanged. `verdict: "TRUSTED"`. Stays internal. |
| **TrustAdd** | Brand/issuer | Attributed via shield mark on stamps. Used in prose: "TrustAdd's Trust Rating." |

---

## Trust Rating Stamp (locked)

The signature visual of the product. A **Certificate Card** — split-block layout with an icon slab (tier-colored) and an info block (tier-tinted bg, data-pattern watermark).

### Design system

- **Shape:** Landscape rectangle, split into icon slab (left) + info block (right)
- **Hierarchy:** Tier name dominant > score secondary > icon supporting
- **Brand mark:** Shield + "TRUST RATING" lockup in brand blue (`#0a59d0` / `#60a5fa`). Acts as product logo. Blue = constant brand, tier color = variable assessment.
- **Data pattern:** Subtle horizontal scan-lines in the info block (digital-ID aesthetic)
- **Font system:** Inter variable (weights 100–900). Score uses tabular-nums. Mono accents via JetBrains Mono fallback.

### Three sizes

#### Hero (340×101) — Agent Detail page stamp
- Icon slab: 100px wide, icon 44px, score 28px/800
- Info block: shield+TRUST RATING lockup (16px shield, 11px/800 text, letter-spacing 2px), tier name 42px/900, meta row (Methodology v2 badge + date)
- Padding: 12px symmetric, 4px gap rhythm between lockup → tier → meta
- Meta row bottom-aligns with score bottom (structural via flex + matched padding)

#### Leaderboard card (150×~60) — Directory/feed
- Icon slab: 46px wide, icon 22px, score 16px/900
- Info block: shield+TRUST RATING lockup (11px shield, 8px text, letter-spacing 1px, `white-space: nowrap`), tier name 15px/900
- No meta row (too small)

#### Mobile chip (32px tall) — Inline
- Horizontal: icon slab (icon 14px + score 14px side-by-side) | tier name 11px/900
- No brand lockup (stamp shape carries brand at this scale)

### Color system (6 tiers + UNKNOWN)

| Tier | Score range | Color | Icon (Lucide) |
|---|---|---|---|
| VERIFIED | 80–100 | `#10b981` (emerald) | BadgeCheck (shield-with-check + decorative border) |
| TRUSTED | 60–79 | `#22c55e` (green) | CheckCircle |
| BUILDING | 40–59 | `#3b82f6` (blue) | TrendingUp |
| INSUFFICIENT_DATA | 20–39 | `#a1a1aa` (zinc-400) | CircleDot |
| UNVERIFIED | 5–19 | `#71717a` (zinc-500) | HelpCircle (question mark) |
| FLAGGED | 0–4 (active negative evidence) | `#ef4444` (red) | AlertTriangle |
| UNKNOWN | null score (free-tier) | `#64748b` (slate) | HelpCircle |

Display name for INSUFFICIENT_DATA in space-constrained contexts: "Insufficient" (drop "_DATA").

### Brand lockup

- Shield SVG: the existing TrustAdd favicon (`favicon.svg` — blue rounded-square with white shield outline)
- Text: "TRUST RATING" in brand blue, uppercase, letter-spacing
- Shield + text compose as a single inline-flex row
- Shows on hero + leaderboard card sizes; absent on mobile chip

---

## Banner Zone — Agent Detail Page Hero (locked)

Cinematic banner layout. Agent image on the left, text column on the right, Trust Rating stamp anchored bottom-right.

### Structure

```
┌─ BANNER (gradient bg, derived from agent address) ─────────────────────┐
│                                                                         │
│  ┌──────────┐   EYEBROW (Classification + Status)                      │
│  │          │   TITLE (1-line hard clamp, ellipsis, tooltip)            │
│  │  IMAGE   │   ┌─────────────────────────────────────┬──────────────┐  │
│  │ 160×160  │   │ DESCRIPTION (2-line clamp + MORE)   │ TRUST RATING │  │
│  │          │   │                                     │    STAMP     │  │
│  │          │   │ CHAIN  ID  CONTRACT  PAYMENT  CTRL  │   260×80     │  │
│  └──────────┘   └─────────────────────────────────────┴──────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Layout rules

- **Banner height** driven by image height (160px + 2×22px padding = 204px)
- **Image:** 160×160, `border-radius: 12px`, `object-fit: cover`
  - **Fallback:** dark charcoal gradient tile (#1a1f2e → #12151f) with faded greyscale robot emoji (opacity 0.18) + subtle dashed inner border. Uses `addressToColor(agent.controllerAddress)` for gradient hue when an agent-specific image is missing.
  - **3-step image strategy:** (1) If `imageUrl` exists and naturalWidth ≥ 128 → render with cover. (2) If imageUrl exists but small → render centered at native size inside gradient tile. (3) If no imageUrl → gradient + initials/bot icon.
- **Text column:** `flex: 1`, `display: flex; flex-direction: column; justify-content: space-between`
  - **Row 1 (top):** Eyebrow + Title
  - **Row 2 (bottom):** Description + Chips + Stamp. Stamp drives Row 2 height via `align-items: stretch`.
- **Gradient bg:** Radial gradients derived from agent's address (procedural, unique per agent). Muted for low-data/Unverified agents (zinc tones instead of purple/pink).

### Row 1: Eyebrow + Title

- **Eyebrow:** `font-size: 10px; letter-spacing: 2px; font-weight: 700; text-transform: uppercase; opacity: 0.75`
  - Content: `{classification} · Active since {month} {year}` (dynamic)
  - Fallback when unclassified: `Unclassified · Active since {month} {year}`
  - Classification from agent's `qualityTier` / `category` field
- **Title:** `font-size: 34px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
  - Full title in `title` HTML attribute (tooltip on hover)
  - Full title in `<title>` tag and JSON-LD for SEO

### Row 2: Description + Identity Chips + Stamp

Row 2 uses `display: flex; align-items: stretch`. Stamp (260×80) is the **height driver** of Row 2. Content area uses `justify-content: space-between` → description top-aligns with stamp top, chips bottom-align with stamp bottom.

- **Description:** `font-size: 13px; line-height: 1.45; -webkit-line-clamp: 2`
  - "MORE" link (blue, uppercase, inline) expands to full description
  - Empty state: `"No description provided by this agent."` in italic, opacity 0.5
- **Identity chips:** Strict 1-row (`flex-wrap: nowrap; overflow: hidden`), grey palette for all chips
  - Progressive responsive drops:

| Viewport | Chips visible | Dropped |
|---|---|---|
| ≥1200px (wide desktop) | Chain, ID, Contract, Payment*, Controller | — |
| 1100–1199px | Chain, ID, Contract, Payment* | Controller |
| 900–1099px | Chain, ID, Contract | Controller, Payment |
| <900px (narrow tablet) | Chain, ID, Contract (shorter addresses) | Controller, Payment |
| <640px (mobile) | Separate stacked layout | — |

*Payment chip conditional on x402 probe success

- **Chip styling:** `font-size: 10px; padding: 4px 9px; border-radius: 4px; background: rgba(0,0,0,0.35); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.15)`. ALL chips grey (including Payment — no green tint).
- **Chip labels:** Uppercase 8px prefix (ID, CONTRACT, CONTROLLER, PAYMENT)
- **Chain chip:** Shows the agent's most-active chain (determined by: most transactions → fallback to first-registered). Display: `⬡ Base +4` (no "Primary" language). Hover tooltip shows full chain list with first-seen dates. Single-chain agents show `⬡ Base` (no "+N" hint).

### Stamp placement

- Bottom-right of Row 2
- 260×80 "banner size" (between hero 340×101 and leaderboard 150×60)
- Same Certificate Card design system, scaled proportionally
- Icon 30px, score 20px, tier 26px

### Implementation approach

- CSS container queries (94% browser support 2026) for responsive chip drops, with JS resize-observer fallback
- `addressToColor()` utility (already exists) for procedural gradient generation
- Title and description clamping via `-webkit-line-clamp` (standard, well-supported)

---

## Not yet designed (Phase 2 — next session)

The following surfaces need design before implementation can begin:

1. **Mobile banner** — stacked layout for <640px
2. **Verifications strip** — 9 badges directly below banner (earned/unearned states, multi-chain count surfaced here)
3. **Evidence basis callout** — "Based on N verified transactions from M unique payers" as a prominent band
4. **Early-stage / insufficient-data disclaimers** — pullable later, prominent but not hideous
5. **Progressive-disclosure tabs** — Overview / Score Breakdown / On-Chain Activity / Community / History
6. **Leaderboard card** — how the Trust Rating surfaces in directory/feed contexts (agent-card.tsx redesign)
7. **Trust API demo page** — updated JSON examples showing two-layer response shape
8. **Score distribution analytics** — 6-tier overlay on existing 10-point buckets
9. **Content updates** — marketing copy on home, trust-api, methodology pages
10. **Deploy choreography** — atomic cutover plan (backend + frontend in one merge)
11. **Test strategy** — component tests, Playwright flows, manual smoke checklist

---

## Backend data contract (reference)

See `server/trust-report-compiler.ts` for the authoritative types:

- `Verdict`: `"VERIFIED" | "TRUSTED" | "BUILDING" | "INSUFFICIENT_DATA" | "UNVERIFIED" | "FLAGGED"`
- `PublicVerdict`: `Verdict | "UNKNOWN"` (for free-tier, unscored agents)
- `QuickCheckData`: shape for $0.01 endpoint
- `FullReportData`: two-layer shape (`trustRating` + `verifications[]`) for $0.05 endpoint
- `REPORT_VERSION = 3`
- `EvidenceBasis`: `{ transactionCount, attestationCount, uniquePayers, uniqueAttestors, dataSources[], summary }`
- `Verification`: `{ name, earned, description, icon, color }` (9 total, always emitted)

Backend is complete on branch `feat/methodology-v2-backend` (commit `d67f8cd`, 263/263 tests green).
