# TrustAdd V2 — Feature Roadmap

*Created: February 2026*

---

## Vision

TrustAdd V2 transforms TrustAdd from an ERC-8004 agent explorer into the **universal trust infrastructure layer for autonomous AI agents**. Three strategic pillars:

1. **TrustAdd Score** — A composite 0-100 trust metric that becomes the signature product. "TrustAdd = Trust Score."
2. **x402 Agent Economy Dashboard** — Economic intelligence for agent payment flows, making TrustAdd the Bloomberg Terminal for agent commerce.
3. **Multi-Protocol Agent Index** — Expand beyond ERC-8004 to index Olas, Virtuals Protocol, and ELIZA agents, making TrustAdd the universal agent data layer.

Supporting features (Watchlists, Agent Claiming, On-Chain Reputation) build retention, two-sided marketplace dynamics, and protocol-native trust signals.

---

## 1. TrustAdd Score

### Rationale

Every competitor in the ERC-8004 space (8004scan, trust8004, Agentscan) has some form of agent scoring or ranking. TrustAdd currently has none. However, competitors use opaque or gamifiable reputation scores derived from on-chain feedback (which has zero genuine entries as of Feb 2026). TrustAdd's opportunity is a **transparent, multi-signal composite score** that uses verifiable data — not gamified ratings.

The TrustAdd Score is the single most important feature for V2. It becomes the brand: "What's this agent's TrustAdd Score?"

### Score Formula (0-100)

| Category | Max Points | Signals | Rationale |
|----------|-----------|---------|-----------|
| **Identity** | 25 | name (5), description (5), image (5), endpoints (5), tags/categories (5) | Complete identity = more trustworthy. Agents with no name or description are suspicious. |
| **History** | 20 | registration age (10), metadata updates (5), cross-chain presence (5) | Longevity and consistency signal reliability. Cross-chain presence shows intentional multi-chain deployment. |
| **Capability** | 15 | x402 support (5), OASF skills (5), endpoint count (5) | Agents that declare capabilities and support payment standards are more serious. |
| **Community** | 20 | GitHub health (10), Farcaster score (5), social presence count (5) | External community signals provide independent validation. |
| **Transparency** | 20 | URI scheme quality (8), trust mechanisms (7), active status (5) | IPFS metadata is more trustworthy than HTTP. Declared trust mechanisms show intentional design. |

### Scoring Details

**Identity (0-25)**
- Has name: +5
- Has description: +5
- Has image URL: +5
- Has at least one endpoint: +5
- Has tags or OASF skills: +5

**History (0-20)**
- Registration age: 0 days = 0, 7+ days = 5, 30+ days = 10
- Metadata update events: 1 event = 0, 2+ events = +5
- Cross-chain presence (same controller address on 2+ chains): +5

**Capability (0-15)**
- x402 payment support: +5
- OASF skills count: 1+ = 3, 3+ = 5
- Endpoint count: 1+ = 3, 3+ = 5

**Community (0-20)**
- GitHub health score: mapped proportionally to 0-10
- Farcaster score: mapped proportionally to 0-5
- Has any community feedback source: +5

**Transparency (0-20)**
- Metadata URI scheme: IPFS = +8, HTTP/HTTPS = +4, data: URI = +2
- Trust mechanisms declared (supportedTrust array): +7
- Active status = true: +5

### Data Sources

All signals come from existing TrustAdd data:
- `agents` table: identity fields, endpoints, capabilities, metadata URI, trust mechanisms, active status, chain ID
- `agent_metadata_events` table: event count, registration date
- `community_feedback_summaries` table: GitHub health score, Farcaster score, source counts
- Cross-chain controller matching: query agents with same `controllerAddress` across different `chainId` values

### Network Effects

- **For users**: Instant trust assessment — "Is this agent worth integrating?" answered in one number
- **For agent operators**: Incentive to complete profiles, add endpoints, maintain GitHub repos — all verifiable actions that improve score
- **For the ecosystem**: A neutral, transparent scoring standard that any application can reference

### API Surface

- `GET /api/agents/:id/trust-score` — score + breakdown + last updated
- `GET /api/trust-scores/top?limit=20&chain=` — leaderboard
- `GET /api/trust-scores/distribution` — histogram (0-10, 10-20, ... 90-100)
- Existing `GET /api/agents` and `GET /api/agents/:id` include trust score fields
- Sort by `trust-score` in directory listing

### Frontend Display

- **Agent Profile**: Large circular score ring (emerald 70+, amber 40-69, red <40, gray unscored) with 5-category breakdown bar
- **Agent Card**: Small colored badge with score number
- **Directory**: "Trust Score" sort option
- **Analytics**: Score distribution histogram, average by chain, top-10 leaderboard

### Effort Estimate

- Schema + calculation engine: Small (1 session)
- API wiring + triggers: Small (1 session)
- Frontend display: Medium (1 session)
- Analytics integration: Small (1 session)

### Dependencies

- Existing `agents` table, `community_feedback_summaries` table
- No external APIs required — all data already indexed

---

## 2. x402 Agent Economy Dashboard

### Rationale

x402 (HTTP 402 Payment Required) is the emerging standard for agent-to-agent payments, developed by Coinbase and Cloudflare. It allows agents to charge for API calls via USDC on-chain settlements on Base. As of Feb 2026, the x402 ecosystem has processed 100M+ payments.

TrustAdd currently tracks `x402Support` as a boolean per agent. This is a massive untapped opportunity: by tracking actual payment flows, TrustAdd becomes the **economic intelligence layer** for the agent economy.

### How x402 Works

```
┌──────────┐     HTTP Request      ┌──────────┐
│  Client  │ ──────────────────→   │  Server  │
│  Agent   │                       │  Agent   │
│          │  ← 402 + Payment Req  │          │
│          │                       │          │
│          │  Signs USDC tx        │          │
│          │  ──────────────────→  │          │
│          │                       │          │
│          │  ← 200 + Response     │          │
└──────────┘                       └──────────┘
                    │
                    ▼
            ┌──────────────┐
            │   Base L2    │
            │  USDC ERC-20 │
            │   Transfer   │
            └──────────────┘
```

1. Client agent sends HTTP request to server agent's endpoint
2. Server responds with `402 Payment Required` + payment details (amount, USDC address, network)
3. Client signs a USDC transfer transaction on Base
4. Facilitator (Coinbase/Cloudflare) verifies payment and proxies the request
5. Server returns the API response
6. USDC transfer settles on-chain as a standard ERC-20 Transfer event

### Data Sources

**Primary: On-Chain USDC Transfers**
- USDC contract on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Monitor `Transfer(address from, address to, uint256 value)` events
- Cross-reference `to` addresses with known agent endpoint domains/addresses
- Challenge: Cannot definitively distinguish x402 payments from regular USDC transfers without facilitator data

**Secondary: Facilitator APIs (if available)**
- Coinbase x402 facilitator may expose payment metadata
- Cloudflare Workers AI x402 integration
- These would provide definitive x402 attribution

**Tertiary: Agent Endpoint Probing**
- Probe agent HTTP endpoints to detect 402 responses
- Extract payment addresses from 402 response headers
- Map payment addresses to on-chain USDC flows

### Dashboard Concept

**Economy Overview**
- Total agent economy size (USDC volume through known agent addresses)
- Payment velocity (transactions per hour/day)
- Active paying agents / active earning agents
- Average transaction size
- Growth trends (daily/weekly/monthly)

**Agent-Level Economics**
- Revenue earned (USDC received at agent's payment address)
- Payments made (USDC sent from agent's controller address)
- Top customers / top providers
- Revenue trend over time
- Price per API call (if detectable from payment amounts)

**Ecosystem Intelligence**
- Top earning agents leaderboard
- Most active economic corridors (which agents pay which agents)
- Chain distribution of payments
- Economic network graph visualization

### Tracking Approaches

| Approach | Feasibility | Accuracy | Effort |
|----------|------------|----------|--------|
| **Address monitoring** — Extract payment addresses from agent endpoints, monitor USDC flows | High | Medium (can't distinguish x402 from regular transfers) | Medium |
| **Facilitator API** — Query Coinbase/Cloudflare for x402-specific transaction data | Depends on API availability | High | Low (if API exists) |
| **Endpoint probing** — Send requests to agent endpoints, detect 402 responses, extract payment config | High | High for detection, low for volume | Medium |
| **Hybrid** — Probe endpoints for payment addresses, then monitor those addresses on-chain | High | Medium-High | Medium-Large |

### Recommended Approach

Phase 1: **Endpoint Probing** — Detect which agents support x402 and extract their payment addresses. Update `x402Support` from boolean to include payment address data.

Phase 2: **Address Monitoring** — Index USDC Transfer events on Base involving known agent payment addresses. Build volume/revenue metrics.

Phase 3: **Facilitator Integration** — If/when Coinbase or Cloudflare expose x402-specific APIs, integrate for definitive payment attribution.

### Competitive Context

No competitor tracks agent economic activity. 8004scan and others show x402 badges but no payment data. This would make TrustAdd the only platform providing economic intelligence for the agent economy.

### Effort Estimate

- Phase 1 (endpoint probing + payment address extraction): Medium (1-2 sessions)
- Phase 2 (USDC indexer on Base): Large (2-3 sessions)
- Phase 3 (facilitator integration): Unknown (depends on API availability)
- Dashboard frontend: Medium (1-2 sessions)

### Dependencies

- Base chain RPC access (already configured)
- USDC contract ABI (standard ERC-20)
- Agent endpoint accessibility (some may be behind auth)

---

## 3. Multi-Protocol Agent Index

### Rationale

ERC-8004 is one of several agent registry protocols. Each captures different aspects of agent identity:

| Protocol | Focus | What It Captures |
|----------|-------|-----------------|
| **ERC-8004** | Identity + Reputation | Who the agent is, what it does, trust mechanisms |
| **Olas (Autonolas)** | Components + Services | What the agent is built from, service lifecycle, staking |
| **Virtuals Protocol** | Economics + Commerce | Agent tokenization, market caps, commercial transactions |
| **ELIZA (ai16z)** | Framework + Community | Developer adoption, open-source presence |

By indexing all four, TrustAdd becomes the **universal agent data layer** — the only place to see an agent's identity, technical composition, economic activity, and community presence in one view.

### Protocol Deep Dives

#### Olas (Autonolas)

**Overview**: Olas is a platform for creating, deploying, and managing autonomous agent services. It uses ERC-721 NFT registries for components, agents, and services.

**Contract Architecture**:
- `ComponentRegistry` — NFT registry for reusable software components
- `AgentRegistry` — NFT registry for agent definitions (composed of components)
- `ServiceRegistry` — NFT registry for deployed services (composed of agents)
- `ServiceStakingToken` — Staking contracts for service operators

**Chains**: Ethereum, Gnosis, Polygon, Arbitrum, Optimism, Base, Celo, Solana (8+ chains)

**Data Available**:
- ~15,000 registered components/agents/services
- Component dependency graphs (which components make up which agents)
- Service states: pre-registration, active-registration, finished-registration, deployed, terminated-bonded
- Staking data: stake amounts, reward rates, slashing events
- Developer incentives: contribution tracking, rewards

**Integration Approach**:
1. Index `CreateUnit` events from ComponentRegistry and AgentRegistry
2. Index `CreateService` and `UpdateService` events from ServiceRegistry
3. Map Olas agents to ERC-8004 agents via controller address or metadata matching
4. Display Olas component composition on TrustAdd agent profiles
5. Include Olas staking/service data in TrustAdd Score calculation

**Unique Value for TrustAdd Score**:
- Component count and dependency depth signal technical maturity
- Active service state signals operational reliability
- Staking amount signals economic commitment
- Multi-registry presence (Olas + ERC-8004) signals ecosystem engagement

#### Virtuals Protocol

**Overview**: Virtuals Protocol enables tokenized AI agents with their own ERC-20 tokens and an Agent Commerce Protocol (ACP) for inter-agent transactions.

**ACP Lifecycle**:
```
Request → Negotiate → Escrow → Deliver → Settle
  │           │          │         │         │
  ▼           ▼          ▼         ▼         ▼
 Buyer     Both      USDC/token  Seller   Release
 posts     agree     locked      delivers  funds
 job       on terms  in escrow   output    to seller
```

**Chains**: Base, Solana

**Data Available**:
- 18,000+ tokenized agents
- Agent token market caps and trading volume
- ACP transaction history (requests, negotiations, settlements)
- Escrow amounts and completion rates
- Agent-to-agent interaction graphs

**Integration Approach**:
1. Index agent token creation events on Base
2. Track ACP lifecycle events (request, negotiate, escrow, settle, dispute)
3. Map Virtuals agents to ERC-8004 agents via address or name matching
4. Display economic metrics (market cap, ACP volume) on TrustAdd profiles
5. Include Virtuals activity in TrustAdd Score economic signals

**Unique Value for TrustAdd Score**:
- Market cap signals community confidence
- ACP completion rate signals reliability
- Transaction volume signals active usage
- Escrow history signals trustworthiness in commerce

#### ELIZA (ai16z)

**Overview**: ELIZA is an open-source multi-agent simulation framework by ai16z. It's the most popular framework for building autonomous agents.

**Detection Strategy**:
- No on-chain registry — ELIZA agents are identified by framework usage
- **GitHub detection**: Search for repos using `@ai16z/eliza` as a dependency
- **Runtime detection**: ELIZA agents expose specific API patterns and response headers
- **Metadata matching**: Some ERC-8004 agents declare ELIZA in their description or tags

**Data Available**:
- GitHub repository metrics for ELIZA-based projects
- Framework version and plugin usage
- Community size (ELIZA main repo: 15K+ stars)
- Developer activity and contribution patterns

**Integration Approach**:
1. Scan ERC-8004 agent metadata for ELIZA references (description, tags, endpoints)
2. Check GitHub repos (already indexed) for ELIZA dependencies
3. Tag agents with `framework: eliza` in TrustAdd
4. Display framework info on agent profiles
5. Framework adoption as a community signal in TrustAdd Score

**Unique Value for TrustAdd Score**:
- Using a well-known framework signals technical competence
- Framework community size provides indirect trust signal
- Active framework maintenance signals ongoing development

### Cross-Protocol Identity Resolution

The key technical challenge is matching agents across protocols:

| Match Method | Confidence | Feasibility |
|-------------|-----------|-------------|
| Same controller/owner address | Very High | Check owner addresses across registries |
| Same metadata URI | High | Compare IPFS/HTTP URIs across registries |
| Same name + description | Medium | Fuzzy text matching with manual review |
| Same endpoint domains | High | Domain extraction and matching |
| ENS resolution | Very High | If agents use ENS names resolvable to addresses |

### How Multi-Protocol Data Enriches TrustAdd Score

New score signals from multi-protocol data:

| Signal | Source | Score Impact |
|--------|--------|-------------|
| Registered on 2+ protocols | Cross-protocol | +5 to History |
| Has Olas service in active state | Olas | +3 to Capability |
| Has staked capital | Olas | +5 to Transparency |
| Has token with >$10K market cap | Virtuals | +3 to Community |
| ACP completion rate >90% | Virtuals | +5 to History |
| Uses established framework (ELIZA) | ELIZA | +3 to Capability |

### Competitive Context

No competitor indexes multiple agent protocols. 8004scan, Agentscan, trust8004, and 8004agents all focus exclusively on ERC-8004. Olas has its own explorer (olas.network). Virtuals has its own marketplace. Nobody combines them.

### Effort Estimate

- Olas indexer: Large (2-3 sessions — multiple contracts, multiple chains)
- Virtuals indexer: Large (2-3 sessions — ACP lifecycle is complex)
- ELIZA detection: Small (1 session — metadata scanning + GitHub checks)
- Cross-protocol identity resolution: Medium (1-2 sessions)
- Frontend multi-protocol display: Medium (1-2 sessions)

### Dependencies

- RPC access to additional chains (Gnosis, Optimism, Celo for Olas)
- Virtuals Protocol ABI / contract addresses on Base
- Olas contract addresses on all chains (publicly documented)

---

## 4. Watchlists & Change Alerts

### Rationale

TrustAdd currently has no user retention mechanism. Users visit, look up an agent, and leave. Watchlists create a reason to return: "Get notified when agents you care about change."

### Features

- **Watchlist**: Users can save agents to a personal watchlist (stored in localStorage initially, DB-backed later)
- **Change Detection**: Monitor for metadata updates, trust score changes, new community feedback, cross-chain registrations
- **Alert Delivery**: In-app notification bell initially; email/webhook later
- **Threshold Alerts**: "Alert me if TrustAdd Score drops below 50" or "Alert me when trust score changes by more than 10 points"

### Data Sources

- `agent_metadata_events` table — new events trigger alerts
- `trustScore` / `trustScoreBreakdown` — score changes trigger alerts
- `community_feedback_summaries` — new feedback triggers alerts
- Indexer — new agent registrations matching saved criteria

### Network Effects

- Users who set up watchlists return 3-5x more frequently (industry benchmark for alert features)
- Watchlist data reveals which agents are most "watched" — valuable signal for the ecosystem
- Alert thresholds create urgency and drive engagement

### Effort Estimate

- Backend (alert engine, storage): Medium (1-2 sessions)
- Frontend (watchlist UI, notification bell): Medium (1-2 sessions)
- Email/webhook delivery: Medium (1 session)

### Dependencies

- TrustAdd Score (for score-based alerts)
- User identity system (even if just localStorage initially)

---

## 5. Agent Claiming / Operator Profiles

### Rationale

Currently, TrustAdd is a read-only explorer. Agent operators have no way to claim their agents, update profiles, or engage with the platform. This is a one-sided marketplace. Adding operator profiles creates a **two-sided marketplace flywheel**:

1. Operators claim agents → they get a profile page and analytics
2. Operators improve their profiles → TrustAdd Scores go up
3. Higher scores → more visibility in directory and leaderboard
4. More visibility → more users discover and integrate agents
5. More usage → operators invest more in their TrustAdd presence

### Features

- **Wallet-Based Claiming**: Connect wallet, prove ownership of controller address, claim associated agents
- **Operator Profile**: Public page showing all agents owned by a controller, aggregate statistics, operator bio
- **Profile Customization**: Operators can add verified social links, team info, support contacts
- **Analytics Dashboard**: Private analytics for operators — how many views their agents get, search appearances, watchlist additions
- **Verified Badge**: Claimed agents get a "Verified Operator" badge on their profile and card

### Verification Flow

```
1. Operator connects wallet (wagmi/RainbowKit)
2. TrustAdd checks: does this address match any agent's controllerAddress?
3. If yes: sign a message to prove ownership
4. Agent is now "claimed" — operator can customize profile
5. Claimed status is stored in DB (agents.claimed = true)
```

### Network Effects

- Two-sided marketplace dynamics (operators AND users)
- Operators become advocates — they share their TrustAdd profile
- Claimed agents have higher trust (verified operator)
- Operator analytics create stickiness

### Competitive Context

8004scan and trust8004 offer wallet connection and agent registration. Neither offers operator profiles or analytics. This would be unique to TrustAdd.

### Effort Estimate

- Wallet connection + claiming flow: Medium (1-2 sessions)
- Operator profile pages: Medium (1-2 sessions)
- Analytics dashboard: Medium (1-2 sessions)

### Dependencies

- wagmi / RainbowKit (or similar wallet connection library)
- TrustAdd Score (verified operator influences score)

---

## 6. On-Chain Reputation Readiness

### Rationale

The ERC-8004 Reputation Registry is deployed on all 5 chains but has zero genuine `FeedbackPosted` events as of Feb 2026. When feedback starts flowing, TrustAdd needs to be ready to index, display, and incorporate it into the TrustAdd Score.

### Current State

- Reputation Registry contract: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` (same address on all chains)
- TrustAdd indexer already monitors for events but has found none
- The protocol stores raw feedback on-chain; scoring is an application-layer concern
- This is explicitly TrustAdd's opportunity: become the scoring/aggregation layer

### FeedbackPosted Event Structure

```solidity
event FeedbackPosted(
    address indexed agent,
    address indexed client,
    uint256 indexed feedbackId,
    uint8 valueScore,      // 0-100
    bytes32 tag1,
    bytes32 tag2,
    string feedbackURI,    // IPFS link to detailed feedback
    bytes32 contentHash    // KECCAK-256 integrity check
);
```

### What to Build

1. **Event Indexing**: Already partially implemented — ensure `FeedbackPosted` events are captured and stored
2. **Feedback Display**: Show feedback on agent profiles — reviewer address, score, tags, linked detailed report
3. **Sybil Detection**: Flag suspicious patterns — multiple feedbacks from same address, burst patterns, self-feedback
4. **Score Integration**: Incorporate on-chain reputation into TrustAdd Score
   - Average feedback score → Community category points
   - Feedback count → Community category points
   - Reviewer diversity → Transparency category points
5. **Reviewer Profiles**: Track who leaves feedback, build reviewer reputation over time

### Scoring Integration Plan

When `FeedbackPosted` events exist, add to TrustAdd Score:

| Signal | Category | Points |
|--------|----------|--------|
| Has 1+ on-chain feedback | Community | +3 |
| Average feedback score >70 | Community | +5 |
| Feedback from 3+ unique reviewers | Transparency | +3 |
| No revoked feedback | Transparency | +2 |

### Effort Estimate

- Event indexing (complete existing implementation): Small (1 session)
- Feedback display UI: Medium (1-2 sessions)
- Sybil detection heuristics: Medium (1 session)
- Score integration: Small (already part of score engine)

### Dependencies

- Actual `FeedbackPosted` events on-chain (external dependency — ecosystem must start posting feedback)
- Existing indexer infrastructure

---

## Priority & Sequencing

### Phase 1: TrustAdd Score (Current Session)

The TrustAdd Score is the foundation. It creates the signature metric, provides API infrastructure, and establishes TrustAdd as a trust authority.

```
Schema + Engine → API + Wiring → Frontend (Profile + Directory) → Analytics
```

### Phase 2: Watchlists & Alerts

User retention feature. Low complexity, high impact on engagement metrics. Can be built entirely with existing data.

### Phase 3: Agent Claiming / Operator Profiles

Two-sided marketplace. Requires wallet integration but creates the flywheel that drives organic growth.

### Phase 4: x402 Agent Economy Dashboard

Economic intelligence layer. Requires new indexing infrastructure (USDC transfers on Base) but positions TrustAdd uniquely in the market.

### Phase 5: Multi-Protocol Agent Index

Universal agent data layer. Highest complexity but highest differentiation. Each protocol can be added incrementally.

### Phase 6: On-Chain Reputation

Ready when the ecosystem is ready. Infrastructure should be pre-built so TrustAdd is first-to-market when feedback starts flowing.

---

## Competitive Positioning

### Current Landscape

| Competitor | Position | Weakness |
|-----------|----------|----------|
| 8004scan | Full-featured Etherscan clone | Opaque scoring, no off-chain signals |
| Agentscan | Analytics platform | No trust scoring, no community data |
| 8004agents | News + directory hybrid | No unique data features |
| trust8004 | Trust-scoring leaderboard | Only 53 ranked agents, gamifiable |

### TrustAdd V2 Position

> **"The universal trust infrastructure for AI agents."**

| Differentiator | Why It Matters |
|---------------|---------------|
| **Multi-signal trust score** | Competitors use single-source scores (on-chain feedback only). TrustAdd combines identity, history, capability, community, and transparency. |
| **Off-chain community data** | Only TrustAdd incorporates GitHub health, Farcaster presence, and future social signals. |
| **Multi-protocol index** | No competitor indexes agents beyond ERC-8004. |
| **Economic intelligence** | No competitor tracks agent payment flows or economic activity. |
| **Event history timeline** | No competitor shows how agent identity evolves over time. |
| **Neutral + transparent** | Score formula is public and verifiable. No hidden weights. |

### Moats

1. **Data moat**: Multi-protocol + multi-signal data is hard to replicate
2. **Score moat**: As TrustAdd Score becomes referenced by other applications, switching costs increase
3. **Network moat**: Operator profiles and watchlists create two-sided network effects
4. **First-mover moat**: First to combine on-chain identity + off-chain community + economic data

---

## Technical Feasibility Summary

| Feature | Data Available | Infra Needed | Risk |
|---------|---------------|-------------|------|
| TrustAdd Score | All signals exist in DB | Calculation engine, API endpoints | Low |
| x402 Economy | Partial (x402Support bool) | USDC indexer, endpoint prober | Medium (attribution challenge) |
| Olas Integration | Public contracts documented | New indexer, new chains | Low-Medium |
| Virtuals Integration | Public contracts on Base | ACP event indexer | Medium (complex lifecycle) |
| ELIZA Detection | GitHub repos + metadata | Metadata scanner | Low |
| Watchlists | Existing agent data | Notification engine | Low |
| Agent Claiming | Controller addresses exist | Wallet connection, auth | Low-Medium |
| On-Chain Reputation | Contract deployed, no events | Event listener ready | Low (waiting on ecosystem) |

---

## Success Metrics

| Metric | Current | V2 Target |
|--------|---------|-----------|
| Agents with trust scores | 0 | 19,900 (100%) |
| Agents indexed (all protocols) | ~19,900 (ERC-8004 only) | 50,000+ (multi-protocol) |
| API consumers | Unknown | 10+ applications referencing TrustAdd Score |
| Agents with economic data | ~130 (x402 boolean) | 500+ (with payment flows) |
| User retention (return visits) | Baseline | +3x with watchlists |
| Claimed agents | 0 | 100+ |
| On-chain feedback indexed | 0 | Ready for first event |
