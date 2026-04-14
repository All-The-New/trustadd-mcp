# TrustAdd Methodology v2 — Design Specification

**Date:** 2026-04-13
**Status:** Approved
**Methodology Version:** v1 → v2
**Scope:** Complete methodology redesign — scoring philosophy, signal taxonomy, weights, tier system, badge system, methodology page

---

## Executive Summary

Methodology v2 fundamentally reorients the TrustAdd Score from a profile completeness metric to a **behavioral risk assessment**. The score answers one question: *What is the risk of this interaction going wrong?*

The core shift: blockchain-verifiable behavioral signals (transactions, attestations) move from ~10% to **60%** of the score. Self-reported signals (profile metadata, declarations) drop from ~45% to **25%**. Most agents in the current ecosystem will score 15-35, landing in "Insufficient Data" — and that is correct. Trust is earned through verifiable behavior, not self-reported metadata.

This is designed for the coming market. When x402 transactions and ERC-8004 attestations begin flowing at scale, TrustAdd will be the first system measuring them. The methodology builds the container before it's filled.

**Implementation is split across three sessions:**
1. **This session:** Methodology spec + methodology page update (content, tiers, badges, diagrams)
2. **Next session:** Backend implementation (scoring engine, trust reports, tier system)
3. **Final session:** Frontend integrations (agent profiles, directory, leaderboard, API responses)

---

## 1. Core Philosophy

### What the Score Measures

The TrustAdd Score measures **interaction risk** — the likelihood that a transaction with this agent will go wrong. It is not a profile quality score. It is not a measure of how well an agent filled out its registration.

This is analogous to how credit bureaus work: a FICO score predicts default risk based on behavioral history, not based on how nice your loan application looks.

### Trust Is Earned, Not Declared

An agent that registers with a perfect profile, uploads an image, declares skills, and links a GitHub repo — but has never processed a single transaction or received a single attestation — has not earned trust. It has set up well. Those are different things.

In v2, that agent scores 25-35 out of 100. It lands in the "Insufficient Data" tier. This is not a negative judgment — it's an honest assessment: we don't have enough behavioral evidence to vouch for this agent yet.

### The Two-Layer Architecture

**Layer 1: Trust Rating (0-100)** — The headline score. Driven by blockchain-verifiable behavioral evidence. Powers the machine-readable verdict and the human-visible tier badge. This is the "star rating."

**Layer 2: Profile Badges** — Positive recognition for metadata, community, and technical signals. Visible on agent profiles and in the directory. Do NOT inflate the Trust Rating. Give new agents something to earn immediately while they build behavioral history. This is the "business listing."

The separation is critical: your profile badges tell agents "this agent has set up well." Your Trust Rating tells agents "this agent has performed well." Both are useful. Only one should drive trust decisions.

---

## 2. Signal Categories & Weights

### Category Architecture

Each category answers a distinct question about the agent:

| Category | Max Pts | Question | Signal Type |
|----------|---------|----------|-------------|
| **Transaction Activity** | **35** | Does this agent actually do business? | Behavioral (core) |
| **Reputation & Attestations** | **25** | Have others formally vouched for this agent? | Behavioral (core) |
| **Agent Profile** | **15** | Is this a real, identifiable agent? | Self-reported |
| **Longevity & Consistency** | **15** | Has this agent been active and consistent over time? | Time-based |
| **Community** | **10** | Is there external signal about this agent? | External (bonus) |

**Behavioral core: 60 pts (60%).** Supporting signals: 40 pts (40%).

### Why This Distribution

- **Transaction Activity (35 pts):** The hardest signal to fake. Generating real payment volume with diverse payers costs real money. This is the credit history of the agent economy.

- **Reputation & Attestations (25 pts):** The formal feedback mechanism. ERC-8004 reputation events are on-chain and verifiable. Slightly less weight than transactions because attestations can be gamed through collusion (until counterparty-quality weighting is added in v3). Still significant because attestations are the only mechanism that captures "was the customer satisfied?"

- **Agent Profile (15 pts):** Merges the old Identity (25 pts) and Transparency (20 pts) categories into one cleaner category. Answers "is this a real agent?" without dominating the score. Profile image gets +5 pts within this category (33% of Profile) to incentivize visual identity.

- **Longevity & Consistency (15 pts):** Time matters, but only when paired with activity. Registration age alone earns modest points. Time since first transaction (requiring actual behavioral history) earns the highest points in this category.

- **Community (10 pts):** External validation from GitHub, Farcaster, etc. A bonus, not a gate. An agent with thousands of dollars in verified transactions and many attestations but no Farcaster account should still reach Verified tier. Community signals differentiate in the mid-range but don't gatekeep at the top.

### v3 Path

When transaction and attestation data reaches meaningful volume across the ecosystem, weights will shift to 70/30 (behavioral/supporting) in methodology v3. This is documented as an explicit forward direction. Starting at 60/40 provides sufficient differentiation in the current thin-data ecosystem while establishing the behavioral-first philosophy.

---

## 3. Signal Definitions

### 3.1 Transaction Activity (35 pts max)

Measures actual economic activity flowing through the agent. All signals require on-chain evidence. All transaction signals measure **inbound payments** to the agent's discovered payment addresses — outbound spending is not a trust signal.

| Signal | Condition | Points | Data Source |
|--------|-----------|--------|-------------|
| x402 payment volume | Any inbound | +5 | Transaction indexer |
| | $100+ total | +10 | |
| | $1,000+ total | +15 | |
| Transaction count | 5+ transactions | +3 | Transaction indexer |
| | 20+ transactions | +5 | |
| | 50+ transactions | +8 | |
| Payer diversity | 3+ unique payers | +3 | Transaction indexer |
| | 10+ unique payers | +5 | |
| x402 endpoint live | Responds with 402 headers | +5 | x402 prober |
| Payment address verified | At least one on-chain payment address | +2 | x402 prober |

**Max: 15 + 8 + 5 + 5 + 2 = 35 pts**

**Design notes:**
- Volume thresholds ($100, $1,000) are denominated in USD equivalent at time of transaction.
- Payer diversity counts unique sender addresses across all chains.
- x402 endpoint liveness is binary — responds with proper 402 headers or doesn't.
- Payment address verification confirms at least one address discovered via x402 probing has received on-chain transfers.

### 3.2 Reputation & Attestations (25 pts max)

Measures formal trust signals from other agents and users. All signals require on-chain evidence via ERC-8004 reputation registry.

| Signal | Condition | Points | Data Source |
|--------|-----------|--------|-------------|
| Attestations received | 1+ | +3 | ERC-8004 reputation events |
| | 5+ | +7 | |
| | 10+ | +12 | |
| | 25+ | +18 | |
| Attestor diversity | 3+ unique attestors | +3 | ERC-8004 reputation events |
| | 10+ unique attestors | +7 | |

**Max: 18 + 7 = 25 pts**

**Design notes:**
- Attestations are ERC-8004 reputation events recorded on-chain.
- Attestor diversity counts unique addresses that have submitted reputation feedback.
- In v3, attestor quality weighting (EigenTrust-style) will be added: attestations from already-trusted agents will count more than attestations from unknown/new agents.
- Currently, this category will be near-zero for almost all agents. This is intentional — the empty space is the "container before it's filled."

### 3.3 Agent Profile (15 pts max)

Measures whether the agent presents as a real, identifiable entity. Merges the former Identity and Transparency categories. These are self-reported signals — important for discovery and presentation but not trust-driving.

| Signal | Condition | Points | Data Source |
|--------|-----------|--------|-------------|
| Profile image | Valid image URL (PNG, SVG, IPFS, data URI) | +5 | ERC-8004 metadata |
| Description quality | 30+ characters | +1 | ERC-8004 metadata |
| | 100+ characters | +2 | |
| Name | Non-empty, trimmed | +2 | ERC-8004 metadata |
| Endpoints declared | At least one API endpoint | +2 | ERC-8004 metadata |
| Skills/tags | OASF skills or tags present | +1 | ERC-8004 metadata / OASF |
| Metadata storage | IPFS or Arweave | +2 | ERC-8004 metadataUri |
| | HTTPS | +1 | |
| Active status | Marked active on-chain | +1 | ERC-8004 metadata |

**Max: 5 + 2 + 2 + 2 + 1 + 2 + 1 = 15 pts**

**Design notes:**
- Profile image is worth 33% of the entire Profile category. Agents without images leave a third of their Profile score on the table.
- Description quality is tiered: any description over 30 chars gets +1, quality descriptions over 100 chars get +2.
- Metadata storage rewards decentralized storage (IPFS/Arweave) over centralized (HTTPS). HTTP and data: URIs receive 0 pts.
- Trust protocol declarations (eip712, erc7710, etc.) are removed as a signal — they're unverifiable declarations that don't predict behavior.

### 3.4 Longevity & Consistency (15 pts max)

Measures sustained presence and activity over time. Time alone is insufficient — the highest signals require evidence of activity during that time.

| Signal | Condition | Points | Data Source |
|--------|-----------|--------|-------------|
| Registration age | 7+ days | +1 | ERC-8004 indexer |
| | 30+ days | +2 | |
| | 90+ days | +4 | |
| Metadata maintenance | 1+ update events | +1 | ERC-8004 events |
| | 3+ update events | +3 | |
| Cross-chain presence | 2+ chains (same controller) | +2 | ERC-8004 indexer |
| | 3+ chains | +3 | |
| Time since first transaction | Any transaction | +2 | Transaction indexer |
| | 30+ days since first tx | +3 | |
| | 90+ days since first tx | +5 | |

**Max: 4 + 3 + 3 + 5 = 15 pts**

**Design notes:**
- Registration age is reduced from 10 pts (v1) to 4 pts. Age alone proves very little.
- "Time since first transaction" is the key signal: it requires both time AND behavioral activity. An agent registered 90 days ago with no transactions gets 0 pts here. An agent with 90+ days of transaction history gets 5 pts.
- Cross-chain presence indicates investment and reach — maintaining registrations on multiple chains costs gas and effort.

### 3.5 Community (10 pts max)

External validation from platforms and communities. A bonus category — agents can reach Verified tier without any community signals. But agents with community presence get a meaningful differentiator in the mid-range.

| Signal | Condition | Points | Data Source |
|--------|-----------|--------|-------------|
| GitHub health | Score > 0 | +1 | Community scraper |
| | Score 40+ | +3 | |
| | Score 70+ | +5 | |
| Farcaster engagement | Normalized score > 0 | +1 | Community scraper |
| | Score 0.4+ | +2 | |
| | Score 0.7+ | +3 | |
| Community sources | Any verified community data | +2 | Community scraper |

**Max: 5 + 3 + 2 = 10 pts**

**Design notes:**
- GitHub health score comes from the GitHub API (commit frequency, contributors, issues, stars, etc.).
- Farcaster engagement is normalized 0-1 from the Neynar API.
- Community sources count distinct verified data sources (GitHub, Farcaster, on-chain reputation lists).
- An agent with zero community presence but strong Transaction Activity (35) + Reputation (25) + Profile (15) + Longevity (15) can still reach 90/100.

---

## 4. Trust Tier System

### 6-Tier Structure

| Score Range | Tier | Color | Icon | Human Meaning | Machine Action |
|-------------|------|-------|------|--------------|----------------|
| 80-100 | **Verified** | Emerald/green | Shield with check | Extensive verified behavioral evidence from multiple sources confirms trust | Proceed with high confidence |
| 60-79 | **Trusted** | Green | Checkmark | Meaningful transaction history and positive attestation signals | Proceed normally |
| 40-59 | **Building** | Blue | Arrow up / trending | Early behavioral evidence — track record forming | Proceed with verification |
| 20-39 | **Insufficient Data** | Gray | Info circle | Profile present, no verified behavioral evidence yet | Apply extra caution |
| 5-19 | **Unverified** | Dark gray | Question mark | Minimal profile, no behavioral evidence | Elevated scrutiny required |
| 0-4 | **Flagged** | Red | Warning triangle | Active negative signals: spam patterns, failed transactions, confirmed bad behavior | Avoid or require manual approval |

**Note on FLAGGED tier:** Unlike other tiers, FLAGGED is not purely score-based. It requires active negative evidence (spam flags, archived status, clone detection). An agent scoring 0-4 due to simply having no data — but with no spam indicators — receives UNVERIFIED, not FLAGGED. This preserves the distinction between "haven't done anything" and "did something bad."

### Tier Semantics

**Verified vs Trusted:** "Verified" means the evidence is extensive and cross-validated — multiple transaction sources, attestations from diverse parties, sustained over time. "Trusted" means there's meaningful evidence but not yet extensive. The distinction helps agents calibrate: Verified = low friction, Trusted = normal process.

**Building:** The transitional tier. Agents here have started earning behavioral trust — a few transactions, maybe an attestation — but haven't accumulated enough for a Trusted verdict. This is where agents go when they begin their trust journey.

**Insufficient Data vs Unverified:** Both lack behavioral evidence, but they're different situations. "Insufficient Data" means the agent has a complete profile, maybe community signals, possibly decent age — it's set up well but hasn't transacted. "Unverified" means the agent has barely set up at all. The distinction matters because "Insufficient Data" is a neutral waiting state while "Unverified" suggests the agent hasn't invested in its own identity.

**Flagged:** Reserved for active negative evidence. This is NOT "low score" — it's "we found something bad." Spam patterns, clone detection, failed transaction patterns, confirmed bad actor behavior. The language is intentionally heavy because this tier represents actual risk, not just missing data.

### Verdict Determination Logic

```
function computeVerdict(score, qualityTier, spamFlags, lifecycleStatus):

  // Hard FLAGGED conditions (score override)
  if qualityTier in (spam, archived):
    return FLAGGED
  if lifecycleStatus == archived:
    return FLAGGED
  if spamFlags.length > 0 AND score < 10:
    return FLAGGED

  // Score-based tiers
  if score >= 80:
    return VERIFIED
  if score >= 60:
    return TRUSTED
  if score >= 40:
    return BUILDING
  if score >= 20:
    return INSUFFICIENT_DATA
  if score >= 5:
    return UNVERIFIED

  // Very low score with no spam flags = still UNVERIFIED (benefit of doubt)
  return UNVERIFIED
```

**Key change from v1:** The FLAGGED tier is only assigned through active negative evidence (spam flags, archived status), not merely through low scores. An agent with a score of 3 and no spam flags gets UNVERIFIED, not FLAGGED. This preserves the distinction between "haven't done anything" and "did something bad."

---

## 5. Evidence Basis Display

### The "How Many Reviews" Problem

A Trust Rating of 35 means very different things depending on what evidence produced it:
- "35 — Based on profile data only" → We barely know this agent
- "35 — Based on 12 transactions and 2 attestations" → Concerning — it has history but scored low

The evidence basis is the quantity signal that tells you how seriously to take the score.

### Human Display

Every Trust Rating on the website is accompanied by a brief evidence summary:

| Evidence State | Display Text |
|---------------|-------------|
| No behavioral data | "Based on profile data only — no verified transactions recorded yet" |
| Transactions only | "Based on {n} verified transactions" |
| Attestations only | "Based on {n} on-chain attestations" |
| Both | "Based on {n} verified transactions and {m} attestations" |
| Rich data | "Based on {n} transactions from {p} unique payers and {m} attestations" |

### Machine Display (API)

```json
{
  "score": 35,
  "tier": "INSUFFICIENT_DATA",
  "confidence": "low",
  "evidenceBasis": {
    "transactionCount": 0,
    "attestationCount": 0,
    "uniquePayers": 0,
    "uniqueAttestors": 0,
    "dataSources": ["identity", "community"],
    "summary": "Based on profile data only"
  }
}
```

The `confidence` field maps to data completeness:
- **high**: Behavioral data (transactions + attestations) AND identity AND community signals present
- **medium**: Behavioral data present but limited, OR strong identity + community without behavioral
- **low**: Identity and/or community present, no behavioral data
- **minimal**: Barely any data available

---

## 6. Profile Badges (Layer 2)

Badges are positive recognition signals visible on agent profiles and in directory listings. They do NOT affect the Trust Rating. They give new agents immediate, earnable milestones and help users quickly assess an agent's characteristics.

### Badge Definitions

| Badge | Icon | Earned When | Purpose |
|-------|------|------------|---------|
| **Multi-Chain** | Chain links | Registered on 3+ chains | Shows investment and reach |
| **x402 Enabled** | Lightning bolt | x402 endpoint detected and responsive | Signals payment capability |
| **GitHub Connected** | GitHub mark | Linked GitHub project with health data | Shows open-source presence |
| **Farcaster Connected** | Farcaster icon | Farcaster social presence detected | Shows social presence |
| **IPFS Metadata** | Lock/shield | Metadata stored on IPFS or Arweave | Shows decentralization commitment |
| **OASF Skills** | Code brackets | Declared OASF skills/capabilities | Shows structured capability declarations |
| **Early Adopter** | Star | Registered before 2026-06-01 (first 6 months after ERC-8004 mainnet deployment) | Recognizes pioneers |
| **Active Maintainer** | Refresh arrows | Regular metadata updates over 90+ days | Shows ongoing maintenance |
| **First Transaction** | Milestone flag | At least one verified payment received | Critical milestone — first behavioral evidence |

### Badge Display Rules

- Badges appear on agent profile pages as small, colored icons with tooltips.
- In directory/leaderboard listings, the top 3-4 most significant badges are shown inline.
- Badge count is NOT a ranking signal — a fully-badged agent with no transactions still has a low Trust Rating.
- The "First Transaction" badge is visually prominent because it represents the bridge from self-reported to behavioral trust.

### Note on Profile Image

Profile image is handled through scoring (+5 pts in Agent Profile, 33% of the category) and leaderboard UI treatment (agents with images get visual priority: larger cards, photo thumbnails). It does not need a separate badge.

---

## 7. Ecosystem Maturity & Language

### Early Ecosystem Notice

The methodology page includes a prominent, honest notice:

> **Early Ecosystem Notice**
>
> The AI agent economy is in its earliest stages. Most agents have limited or no transaction history, which means most Trust Ratings reflect profile data rather than verified behavioral evidence. As x402 payments and ERC-8004 attestations grow, Trust Ratings will become increasingly meaningful.
>
> TrustAdd is building the measurement infrastructure now so it's ready when the data arrives. Empty sections in trust reports — like "No verified transactions recorded yet" — are not bugs. They're honest assessments of what we know today.

### Language Principles

- **Never overstate:** "Based on available signals" rather than "this agent is safe."
- **Name the gap:** "No verified transactions recorded yet" rather than silently omitting the section.
- **Distinguish absence from negative evidence:** "Insufficient Data" is neutral. "Flagged" is accusatory. They mean different things.
- **Show the container:** Display empty behavioral sections on agent profiles to show users where data will appear and what the system is designed to capture.
- **Frame forward:** "Trust Ratings will become increasingly meaningful as transaction data grows" — honest about the present, confident about the future.

---

## 8. Methodology Versioning & Evolution

### Version Strategy

- **v2** (this release): 60/40 behavioral/supporting split. Fixed weights. Dynamic language for ecosystem maturity.
- **v3** (when behavioral data reaches meaningful volume): Shift to 70/30 split. Add counterparty-quality weighting for attestations (EigenTrust-style). Recalibrate thresholds based on empirical distribution.
- **Future versions**: As warranted by protocol changes, ecosystem maturity, or new data sources. Each version is announced, documented with rationale, and triggers full score recalculation.

### Version Mechanics

- `METHODOLOGY_VERSION` constant in codebase, included in every trust report and API response.
- Version changelog published on the methodology page.
- All scores recalculated when the methodology version bumps.
- Historical scores preserved in the database with their methodology version for audit purposes.
- No automatic/continuous weight adjustment — all changes are deliberate, versioned, and announced.

### Protocol Modularity

New protocols (e.g., A2A conformance testing, Solana agent registries, new attestation standards) are integrated as signal providers within existing categories:

- A new payment protocol → signals feed into **Transaction Activity**
- A new attestation standard → signals feed into **Reputation & Attestations**
- A new capability declaration format → signals feed into **Agent Profile**
- A new social platform → signals feed into **Community**

The category structure is stable; the signals within each category evolve. This means adding a new data source doesn't require a methodology version bump — only weight changes or category restructuring do.

---

## 9. Expected Score Distribution (Current Ecosystem)

### Where agents land under v2

| Agent Type | Transaction Activity | Reputation | Profile | Longevity | Community | Total | Tier |
|-----------|---------------------|-----------|---------|-----------|-----------|-------|------|
| Full profile, GitHub, multi-chain, 90+ days, no transactions | 0 | 0 | 13-15 | 7-10 | 5-10 | **25-35** | Insufficient Data |
| Partial profile, some age, no transactions | 0 | 0 | 6-10 | 2-6 | 0-3 | **8-19** | Unverified |
| Minimal/spam agent | 0 | 0 | 0-3 | 0-1 | 0 | **0-4** | Flagged or Unverified |
| Agent with x402 endpoint + some transactions | 10-20 | 0 | 10-15 | 5-10 | 3-8 | **28-53** | Insufficient Data to Building |
| Agent with meaningful transactions + attestations | 20-30 | 10-15 | 12-15 | 10-13 | 5-10 | **57-83** | Building to Verified |
| Demo agent (goal state) | 30-35 | 18-25 | 14-15 | 13-15 | 8-10 | **83-100** | Verified |

### Key observations

1. **Most current agents land at 15-35** — this is correct and intentional.
2. **The leaderboard still differentiates** — within Insufficient Data, agents with better profiles, GitHub, multi-chain rank higher.
3. **The first transacting agents will jump dramatically** — even modest transaction activity (5+ txs, $100+ volume) pushes an agent into the 40-55 range, well above the metadata-only crowd.
4. **Verified tier is genuinely hard to reach** — requires strong performance across ALL categories. This makes it meaningful.

---

## 10. Chain Coverage

### Current: 9 EVM Chains

Ethereum, BNB Chain, Polygon, Arbitrum, Base, Celo, Gnosis, Optimism, Avalanche — all sharing the same ERC-8004 contract addresses.

### Planned: Solana

Solana support is on the roadmap. When added:
- Solana agent registries feed into the same signal categories
- Cross-chain presence scoring extends to include Solana
- New chain = new signal provider, not a methodology change

### Protocol-Agnostic Architecture

The methodology is chain-agnostic by design. Signals are defined in terms of what they measure (transaction volume, attestation count, etc.), not which chain they come from. Adding a new chain is an infrastructure decision, not a methodology decision.

---

## 11. Competitive Differentiation

### What v2 does that competitors don't

1. **Behavioral-first scoring:** 402audit weights 40% on payment reputation. TrustAdd v2 weights 60% on behavioral signals. We're the most aggressive on "trust is earned."

2. **Two-layer transparency:** No competitor separates "how trustworthy is this agent" from "how well did this agent set up its profile." The Trust Rating + Profile Badge separation makes this explicit.

3. **Honest about thin data:** Most competitors either don't score thin-file agents or give them inflated scores based on metadata. TrustAdd v2 clearly labels "Insufficient Data" and shows the empty behavioral sections.

4. **Published methodology with versioning:** The full signal taxonomy, weights, and thresholds are public. Changes are versioned and announced. This IS the product — transparency builds trust in the trust oracle.

5. **Container before content:** By building the measurement infrastructure for attestations and transaction quality before the data arrives, TrustAdd is positioned to be the first credible source when behavioral data starts flowing.

### What we learn from competitors

- **EigenTrust/OpenRank:** Counterparty-quality weighting for attestations → planned for v3.
- **Spectral Finance:** Rich behavioral feature engineering from transaction patterns → planned as transaction data grows.
- **402audit:** Proxy detection and pricing analysis → potential future signals.
- **MolTrust:** Agent-to-agent peer ratings → future via ERC-8004 reputation events.
- **Trusta Labs:** Sybil cluster detection via graph mining → planned anti-gaming defense.

---

## 12. Methodology Page Updates

The public methodology page (`/methodology`) will be rewritten to reflect v2. Key changes:

### Structure

1. **Hero section** — What the TrustAdd Score measures (risk, not profile quality)
2. **Early Ecosystem Notice** — Honest framing of current data state
3. **Two-Layer Architecture** — Trust Rating vs Profile Badges explanation
4. **Score composition bar** — New 5-category visualization (35/25/15/15/10)
5. **6-Tier visualization** — Color-coded tiers with icons, descriptions, score ranges
6. **Scoring categories** — Detailed signal tables for each category
7. **Evidence basis** — How to read the data depth indicator
8. **Profile badges** — Badge showcase with icons and earn conditions
9. **Data sources & freshness** — Update cadence table
10. **Methodology principles** — Updated principles reflecting v2 philosophy
11. **Versioning & evolution** — How the methodology evolves, v3 forward direction
12. **CTA** — Trust API link

### Visual Treatment

- Tier badges use the same color scheme as agent profiles (green → blue → gray → red gradient)
- Score composition bar shows the 60/40 behavioral/supporting split visually
- Badge icons are consistent with those used on agent profile pages
- Empty state sections show "No data yet" patterns that will appear on agent profiles
- Similar card/table styling to current page but reorganized for new content hierarchy

---

## Appendix A: Migration from v1 to v2

### Signal Mapping

| v1 Signal | v1 Category (pts) | v2 Mapping | v2 Category (pts) |
|-----------|--------------------|------------|---------------------|
| agent_name | Identity (5) | Name | Agent Profile (2) |
| description_quality | Identity (5) | Description quality | Agent Profile (2) |
| image_url | Identity (5) | Profile image | Agent Profile (5) |
| endpoints_declared | Identity (5) | Endpoints declared | Agent Profile (2) |
| tags_or_skills | Identity (5) | Skills/tags | Agent Profile (1) |
| agent_age | History (10) | Registration age | Longevity (4) |
| metadata_updates | History (5) | Metadata maintenance | Longevity (3) |
| cross_chain_presence | History (5) | Cross-chain presence | Longevity (3) |
| x402_payment | Capability (5) | x402 endpoint live | Transaction Activity (5) |
| oasf_skills | Capability (5) | Skills/tags | Agent Profile (1) |
| endpoint_count | Capability (5) | Endpoints declared | Agent Profile (2) |
| github_health | Community (10) | GitHub health | Community (5) |
| farcaster_presence | Community (5) | Farcaster engagement | Community (3) |
| community_sources | Community (5) | Community sources | Community (2) |
| metadata_storage | Transparency (8) | Metadata storage | Agent Profile (2) |
| trust_protocols | Transparency (7) | *Removed* | — |
| active_status | Transparency (5) | Active status | Agent Profile (1) |
| *New* | — | x402 payment volume | Transaction Activity (15) |
| *New* | — | Transaction count | Transaction Activity (8) |
| *New* | — | Payer diversity | Transaction Activity (5) |
| *New* | — | Payment address verified | Transaction Activity (2) |
| *New* | — | Attestations received | Reputation (18) |
| *New* | — | Attestor diversity | Reputation (7) |
| *New* | — | Time since first tx | Longevity (5) |

### Score Impact

Every agent's score will change. Most will decrease significantly because:
1. The behavioral categories (60 pts) will be near-zero for most agents
2. The supporting categories (40 pts) have lower maximums than v1's equivalents

This is expected and intentional. The methodology page will include a v2 changelog section explaining the reweighting and its rationale.

---

## Appendix B: Anti-Gaming Considerations

### Current Defenses

- **Transaction volume requires real money:** Generating $1,000 in payment volume with 10+ unique payers is economically expensive to fake.
- **Attestation diversity:** A single entity creating many wallets to self-attest is detectable via address clustering (planned for v3).
- **Spam flag system:** Known spam patterns, placeholder names, clone detection remain active.
- **Quality tier classification:** Heuristic-based classification gates FLAGGED status.

### Planned Defenses (v3+)

- **Counterparty quality weighting (EigenTrust):** Attestations from trusted agents count more than from unknown agents.
- **Sybil cluster detection:** Graph mining on controller addresses to detect coordinated fake agent networks.
- **Transaction pattern analysis:** Detecting wash trading (circular payment patterns) and artificial volume.
- **Temporal anomaly detection:** Sudden spikes in attestations or transactions triggering review flags.

### Philosophy

Gaming resistance is designed around economic cost: achieving a high Trust Rating should require genuine investment of time, money, and reputation that would be uneconomical to fake at scale. Perfect gaming resistance is impossible, but making gaming expensive and detectable is achievable.
