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

## Console
- [ ] No uncaught errors / missing imports in the browser console
