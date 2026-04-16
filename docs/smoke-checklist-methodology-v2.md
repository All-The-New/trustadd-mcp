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
- [ ] Overview: About, Identity, Discovery (with Early Adopter / Active Maintainer rows), Metadata URI, Public Links, OASF Skills — zone states correct per spec §6
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
- [ ] Quick Check + Full Report feature lists match spec §9
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

## Browser route smoke (MANDATORY — add to every release)
Load each of these in a fresh browser tab and confirm:
1. The page renders (not white/blank)
2. Browser console has zero uncaught errors / React `type is invalid` warnings

- [ ] `/` (landing) — known hazard: icon lookup maps in `landing.tsx` (`pillarIcons`, `featureIcons`) must contain every icon name referenced by `HOME.pillars` + `HOME.features` in `content-zones.ts`. A missing entry returns `undefined` and crashes the whole route with no DOM output.
- [ ] `/agents`
- [ ] `/agent/:id` (pick any agent)
- [ ] `/analytics`
- [ ] `/methodology`
- [ ] `/trust-api`
- [ ] `/principles`

## Console
- [ ] No uncaught errors / missing imports in the browser console
