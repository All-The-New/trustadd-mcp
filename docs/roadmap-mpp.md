# MPP Integration Roadmap

**Status:** Phase 1 + Phase 2 shipped (directory intelligence + Tempo on-chain analytics). Phase 3 (scoring integration) deferred to Methodology v3.
**Last updated:** 2026-04-16

---

## 1. Path Decision — Methodology v2 ships without MPP scoring

After evaluating three paths for how MPP integrates with Methodology v2, **we chose Path A**: ship v2 with MPP invisible to scoring, integrate MPP into v3 once we have observed data.

### Rationale

- **v2 is close to shipping.** Bringing MPP into the scoring engine would require a `METHODOLOGY_VERSION` bump, full recompute of all agent scores, tier re-calibration, and a provenance-hash migration — weeks of work at a moment when v2's non-MPP story is ready.
- **We don't have MPP data yet.** MPP launched 4 weeks ago. Before weighting a signal, we want to observe its distribution across real agents. Path A lets the backend accumulate a baseline dataset while v2 ships.
- **Methodology page stays honest.** Users reading the scoring methodology see exactly what the score reflects (x402 + ERC-8004). No "coming soon" asterisks.
- **Risk containment.** Any issue in MPP indexing (wrong contract address, directory format change, RPC instability) stays isolated from scoring correctness.

### What "MPP invisible to scoring" means concretely

- `server/trust-score.ts` — **unchanged**. No new signal category.
- `METHODOLOGY_VERSION` — **unchanged**. Existing provenance hashes remain valid.
- `/methodology` page copy — **unchanged**. No MPP references.
- `/economy` and `/mpp` pages — **show MPP analytics**. Gated by `VITE_ENABLE_MPP_UI`.
- Agent profile pages — **no MPP badge**. No MPP breakdown in trust reports.
- x402-gated Trust Data Product API — **unchanged output shape**. Buyers get the same v2 report.

### What changes when v3 ships

See [§3 — Methodology v3 MPP Integration](#3-methodology-v3-mpp-integration) below.

---

## 2. Current Phase 1 + 2 Scope (shipped)

- 3 Trigger.dev tasks (`mpp-prober`, `mpp-directory-indexer`, `tempo-transaction-indexer`)
- 3 new tables (`mpp_directory_services`, `mpp_directory_snapshots`, `mpp_probes`)
- 10 public + 3 admin API endpoints (all gated by `ENABLE_MPP_UI`)
- `/mpp` page (skeleton) + `/economy` cross-protocol section
- Feature-flagged off in production (`ENABLE_MPP_INDEXER=false`, `ENABLE_MPP_UI=false`)

Branch: `feat/mpp-integration`. Migration applied to `agfyfdhvgekekliujoxc` (TrustAdd Supabase).

---

## 3. Methodology v3 — MPP Integration Plan

Decision deferred until we have **~4-6 weeks of observed MPP data** (directory growth trajectory, transaction volume distribution, agent overlap with x402). At that point, we re-open this section with calibrated weight recommendations.

### Candidate signals for v3

| Signal | Category | Rationale | Data source |
|---|---|---|---|
| **Multi-protocol presence bonus** | Supporting (new) | Research report calls cross-protocol presence "the strongest trust signal" — harder to fake than single-protocol. | `getMultiProtocolAgentIds()` query |
| **MPP payment volume** | Behavioral (extends Transaction Activity 3.1) | Mirrors x402 tiered volume thresholds, weighted per pathUSD totals. | `agent_transactions` where `chain_id = 4217` and `category = 'mpp_payment'` |
| **MPP probe success** | Behavioral (new tier under 3.1) | Parallel to "x402 endpoint verified" — an agent advertising MPP support and returning a valid 402 challenge. | `mpp_probes.has_mpp = true` |
| **Tempo address continuity** | Longevity & Consistency (3.4) | First-seen vs. current activity gap for Tempo addresses. | `agent_transactions.block_timestamp` min/max |
| **Directory presence** | Agent Profile (3.3) | Listed in mpp.dev/services OR Bazaar = verified provider identity. | `mpp_directory_services` join agent |

### Engine changes required

1. **Extend `server/trust-score.ts`** to fetch MPP probe state + Tempo transaction volume alongside existing x402 signals. Keep the prefetch pattern used for sybil detection.
2. **Bump `METHODOLOGY_VERSION`** to `v3.0.0` (breaking) or `v2.1.0` if v3 is treated as additive bonus only. Full v3 is the cleaner story.
3. **Re-calibrate tier thresholds** — add MPP-active agents to the calibration dataset before freezing weights.
4. **Recompute all scores** via `recalculate-scores` task. Plan for 2-4 hour backfill.
5. **Add provenance hash test** so v3 inputs are canonically hashed (prevents silent drift).
6. **Update methodology page copy** (`client/src/lib/content-zones.ts` → `METHODOLOGY`) with MPP signal descriptions.
7. **Update trust report schema** — add `crossProtocol` section alongside existing behavioral/supporting breakdown.
8. **Extend sybil detection** to cross-reference both protocols — a sybil on x402 that's also sybil on MPP is higher confidence; an x402 sybil with legit MPP volume deserves review.

### Estimated effort

~2 weeks of backend + scoring work + 1 week of calibration + page updates. Target: methodology v3 ships ~4-6 weeks after this roadmap date, conditional on MPP data volume.

---

## 4. External Integration Roadmap — future data sources

These integrations are **not scoped for current MPP launch.** Listed here so we don't lose track as the product matures.

### 4.1 Stripe API (merchant-side MPP payment data)

**What it provides:** MPP payments that flow through Stripe's PaymentIntent API with `payment_method_types: ['crypto']` and `deposit_options: { networks: ['tempo'] }`. Stripe is co-author of MPP; many enterprise agents will route their MPP payments through Stripe dashboards.

**Why we'd want it:** Coverage of fiat-rails MPP activity that doesn't show up in pure on-chain Tempo indexing (e.g. card-funded MPP payments, BNPL settlements).

**Blockers:**
- Requires Stripe account + API key
- **Merchant-side only** — we can only see payments WE receive via Stripe. To see agent-to-agent Stripe-mediated MPP data, we'd need aggregator access (Stripe Atlas-style partnerships), which doesn't exist today.
- Viable only as a "TrustAdd-as-merchant" integration, OR if Stripe opens an analytics API for MPP traffic.

**When to revisit:** When Stripe publishes any cross-account MPP analytics endpoint, or when we ourselves accept MPP payments for a Trust API tier (unlikely, per our "we don't take MPP" non-goal in the design spec).

### 4.2 Tempo Block Explorer API (`explore.mainnet.tempo.xyz`)

**What it provides:** Transaction metadata richer than raw `eth_getLogs` returns — contract verification status, ABI-decoded function calls, fee-token information, address labeling.

**Why we'd want it:** Three use cases we currently lack:
1. Decode `TransferWithMemo` and other Tempo-specific events without hardcoding topic hashes.
2. Display human-readable transaction context on the `/mpp` page (who is this recipient, what contract is this).
3. Resolve the pathUSD deployment block via indexed metadata rather than binary-search RPC calls.

**Blockers:**
- API surface unknown — explorer is live, but we haven't confirmed a public REST/GraphQL API exists yet.
- If the explorer uses Blockscout or Etherscan fork, we'd get familiar endpoints.

**When to revisit:** After the MPP Analytics page ships and we want richer UX (decoded tx details, labeled addresses). Also good to revisit when we extend to support `TransferWithMemo` events — the explorer's ABI registry would let us skip the `TEMPO_TRANSFER_WITH_MEMO_TOPIC` env var config.

### 4.3 Bitquery / GraphQL Indexers

**What it provides:** Pre-indexed Tempo chain data via GraphQL — aggregations (daily volume, top receivers, largest transfers) without running our own indexer.

**Why we'd want it:**
- Reduce RPC pressure on `rpc.tempo.xyz`.
- Get historical data for the pre-prober bootstrap window (when we didn't know an address was worth tracking).
- Cross-chain analytics (Base + Tempo unified volume query) without stitching two RPC indexers.

**Blockers:**
- Tempo support status unknown — Bitquery is progressive about chain coverage, but we haven't verified. Research report flags this.
- Pricing unclear beyond free tier.
- Would add a new provider dependency to the pipeline.

**When to revisit:**
- If our own Tempo indexer hits scale issues (the spec §14 notes 10K+ txs/day as the threshold for checkpoint-based resumption — Bitquery could eliminate that work entirely).
- If v3 scoring wants to weigh historical volume before we started indexing an address.
- If a cross-chain "total agent revenue across all protocols" metric becomes a product requirement.

### 4.4 Other candidates noted but lower priority

- **1RPC Tempo endpoint** — privacy-preserving RPC alternative. Same data as public RPC, may be useful if we want a third fallback tier.
- **Conduit Tempo** — design partner on Tempo, may offer better uptime guarantees for production once we're volume-bound.
- **QuickNode / Chainstack Tempo** — already in the design spec as potential `TEMPO_RPC_URL_FALLBACK` values. Free tiers available.

---

## 5. Unified Probe Table Refactor (documented in design spec §14)

When adding a 3rd payment protocol (MPP is our second after x402), refactor `x402_probes` + `mpp_probes` into `agent_payment_probes` with a `protocol` column. Not done yet because premature abstraction — MPP is 4 weeks old and the schema may still shift.

---

## 6. Directory Source Swap (documented in design spec §14)

Current: `MppScrapeSource` scrapes `mpp.dev/services` HTML.

Future: swap to `MppApiSource` the moment Tempo publishes a machine-readable directory API. Interface is already defined; implementation swap is a one-line change in `createDirectorySource()`.

---

## 7. Payment Method Normalization

Current: `payment_methods` stored as `jsonb` array.

Future: when MPP grows and per-method analytics queries become common, convert to a dimension table with FK-to-service for faster aggregation.

---

## Related documents

- [MPP Integration Design Spec](./superpowers/specs/2026-04-15-mpp-integration-design.md) — original architecture
- [MPP Integration Plan](./superpowers/plans/2026-04-15-mpp-integration.md) — executed implementation plan
- [Methodology v2 Design Spec](./superpowers/specs/2026-04-13-methodology-v2-design.md) — scoring engine (no MPP)
- Research report (local only): `~/Desktop/trustadd-mpp-research-report.md`
