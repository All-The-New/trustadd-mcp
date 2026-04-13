# Top Trusted Agents — Design Spec

**Date:** 2026-04-13
**Status:** Approved

## Problem

The homepage "Top Trusted Agents" section and the Agent Directory both show agents sorted by newest — redundant with "Recently Discovered". No trust-based ranking is surfaced anywhere on the frontend, despite the backend fully supporting it.

**Root cause:** `server/routes.ts:189` explicitly remaps `trust-score` sort to `newest`, blocking trust-based ordering at the API level. The storage layer supports it (`storage.ts:297`).

## Changes

### 1. Homepage — Use `/api/trust-scores/top` endpoint

**File:** `client/src/pages/landing.tsx`

Switch the "Top Trusted Agents" query from:
```ts
fetch("/api/agents?limit=10&sort=newest")
```
to:
```ts
fetch("/api/trust-scores/top?limit=10")
```

The `/api/trust-scores/top` endpoint already exists and returns verdict-only data:
```ts
{ id, name, slug, chainId, imageUrl, verdict }
```

The `AgentCard` component expects `AgentWithVerdict` (full `Agent` + `verdict`). The top endpoint returns a subset, so map the response to match. Missing fields (description, endpoints, etc.) render as empty — the card handles nulls gracefully.

### 2. Directory — Unblock `trust-score` sort

**File:** `server/routes.ts` (line ~189)

Remove the `trust-score → newest` remap:
```ts
// Before
const sort = rawSort === "trust-score" ? "newest" as const : rawSort as ...;

// After
const sort = rawSort as "newest" | "oldest" | "trust-score" | "name" | undefined;
```

The `redactAgentForPublic()` function already strips `trustScore`, `trustScoreBreakdown`, `trustScoreUpdatedAt`, `qualityTier`, `spamFlags`, and `lifecycleStatus` from all `/api/agents` responses. Only verdict badges and `reportAvailable` are injected. No score data leaks.

**File:** `client/src/pages/directory.tsx`

Add "Top Trusted" to sort options and make it the default:
```ts
const SORT_OPTIONS: { key: SortState; label: string }[] = [
  { key: "trust-score", label: "Top Trusted" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "name", label: "Name" },
];
```

Default sort state: `"trust-score"` instead of `"newest"`.

Update `SortState` type to include `"trust-score"`.

Update `activeFilterCount` logic: change `sort !== "newest"` to `sort !== "trust-score"` so the filter badge doesn't show as active when using the new default.

**File:** `client/src/lib/content-zones.ts`

Update `HOME.topTrusted.viewAll` from `"View leaderboard"` to `"View all agents"` (consistent with directory, not a separate leaderboard page).

## What leaks vs what stays gated

| Data | Visibility |
|------|-----------|
| Relative trust ordering | Public (via sort order) |
| Verdict labels (TRUSTED/CAUTION/UNTRUSTED/UNKNOWN) | Public (already shown on every card) |
| Numeric trust scores (0-100) | Gated (x402 $0.01) |
| Score breakdowns (5 categories) | Gated (x402 $0.01) |
| Quality tier, spam flags, lifecycle status | Gated (x402 $0.01) |
| Full evidence reports | Gated (x402 $0.05) |

## No new endpoints, no new components

All changes use existing infrastructure:
- `/api/trust-scores/top` — existing endpoint
- `/api/agents?sort=trust-score` — existing storage support, just unblocked at route level
- `AgentCard` — already renders verdict badges
- `redactAgentForPublic()` — already strips scores
