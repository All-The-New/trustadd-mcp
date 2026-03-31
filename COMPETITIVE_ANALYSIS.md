# TrustAdd — Competitive Analysis & Feature Roadmap

*Research conducted: February 8, 2026*

## Competitors Analyzed

Four competitors listed on 8004.org as ecosystem tools:

1. **8004scan.io** — "Browse agents and reputation data"
2. **Agentscan.info** — "Explore registered agents on-chain"
3. **8004agents.ai** — "Discover AI agents in the ecosystem"
4. **trust8004.xyz** — "Discover and manage AI agents registered on-chain"

---

## Competitor Profiles

### 1. 8004scan.io

**Position:** The dominant, full-featured explorer (Etherscan for agents)

**Features:**
- Multi-chain support (Ethereum, Base, BNB Chain, Gnosis, and more)
- Agent leaderboard with composite scoring (scores like 88.5, 84.6)
- Trending / Featured / Top Ranked agent sections
- "Create Agent" button with wallet connection for agent registration
- AI semantic search toggle
- Reputation scores per agent (derived from on-chain feedback)
- Star ratings and feedback counts
- Service type labels (CUSTOM, MCP, WEB, OASF, X402)
- Live activity feed ("new agent registered 5 minutes ago")
- Table + card view toggle for directory
- Links to block explorers (Etherscan, Basescan)

**Data Points:**
- ~15,890+ registered agents
- 5,831+ feedbacks submitted
- 14,731+ active users

**Unique Value:** Most complete "Etherscan-like" experience. Wallet integration, agent creation, leaderboard, and the richest reputation data. Appears to be the official/semi-official ecosystem tool.

---

### 2. Agentscan.info

**Position:** Analytics-focused explorer with quality filtering

**Features:**
- Multi-chain (5 networks)
- "Quality Only" toggle — filters to agents with complete profiles (name + description)
- Category/skill classification with pie charts (NLP 27%, Reasoning 22%, Images 16%)
- Domain distribution analytics (Technology 52%, Media 19%, Finance 13%)
- Registration trend chart over time
- Review counts per agent
- Active status indicators ("Active" badge)
- Skill badges on agent cards (Anomaly Detection, Object Detection, etc.)
- Sort options: Newest, Oldest, Name A-Z/Z-A, Highest/Lowest Reputation
- Live activity feed with transaction hashes
- Network selector

**Data Points:**
- ~39,896 total agents (largest count)
- 5 networks supported
- 40,904 activities tracked
- 17,221 active in last 7 days
- Only 4% of agents classified into skills/domains (1,543 / 39,896)

**Unique Value:** Strongest analytics and categorization. The quality filter, category trend breakdowns, and registration charts provide ecosystem-level intelligence that others lack.

---

### 3. 8004agents.ai

**Position:** News + directory hybrid with live activity focus

**Features:**
- Prominent news/blog section with ERC-8004 ecosystem articles
- Multi-chain (10 chains)
- Table view with columns: Agent, Chain, Owner, Reputation (0-100), Feedback count, Status
- Live activity feed (real-time registrations with chain badges)
- Trending agents with tabs: Top Rated, Most Reviewed, Most Trusted
- Chain distribution visualization
- x402 badges on supported agents
- Grid and table view toggle
- Filtering by chain
- "All" vs "New" vs "Updates" activity filter

**Data Points:**
- ~35,841 agents
- 10 chains supported
- Regular news articles about ecosystem developments

**Unique Value:** The news/content angle. Only competitor combining editorial content about the ERC-8004 ecosystem with agent discovery. Acts as both a directory and information hub.

---

### 4. trust8004.xyz

**Position:** Trust-scoring leaderboard with gamification

**Features:**
- Multi-chain (10 chains)
- Sophisticated leaderboard with trust tiers: Gold, Silver, Bronze, Unverified
- Trust Score (composite metric separate from rating)
- Multiple ranking dimensions: Top Rated, Most Reviewed, Most Trusted, Most Improved
- Category-specific rankings: Initiative, Collaboration, Reasoning, Compliance, Efficiency
- Reviewer counts per agent
- Agent registration form ("Register Agent" CTA)
- Dashboard page with network analytics
- Documentation / integration guides
- Community links (Telegram, X, GitHub)

**Data Points:**
- ~31,191 agents
- 10 chains supported
- 4,074 feedbacks
- 1,230 reviewers
- 53 ranked agents (only agents with feedback appear)

**Unique Value:** Most advanced trust scoring with tiered badges and multi-dimensional rankings. The category-specific leaderboards (Reasoning, Compliance, Efficiency) are unique in the space.

---

## Feature Comparison Matrix

| Feature | 8004scan | Agentscan | 8004agents | trust8004 | TrustAdd |
|---|---|---|---|---|---|
| Multi-chain | 5+ chains | 5 chains | 10 chains | 10 chains | Ethereum only |
| Agent count | ~15,890 | ~39,896 | ~35,841 | ~31,191 | ~6,874 |
| Leaderboard | Yes | Yes (Top Ranked) | Yes | Yes (tiered) | No |
| Reputation scores | Yes | Yes | Yes (0-100) | Yes (tiered) | No |
| Wallet connect / Create agent | Yes | No | No | Yes | No |
| News/content | No | No | Yes | No | Protocol education only |
| Quality filter | No | Yes | No | No | "Has Metadata" filter |
| Category analytics | No | Yes (pie charts) | No | Yes (leaderboard dims) | Skills/Domains display |
| Live activity feed | Yes | Yes | Yes | No | No |
| Search (AI semantic) | Yes | No | No | No | Basic text search |
| On-chain event history | No | No | No | No | **Yes (unique)** |
| Identity Completeness | No | No | No | No | **Yes (unique)** |
| x402 badges | Yes | No | Yes | No | Yes |
| Trust mechanism display | No | No | No | Trust tiers | **Yes (unique)** |
| Service type labels | Yes (MCP/WEB/OASF) | No | No | No | No |
| Agent comparison | No | No | No | No | No |
| API documentation | No | No | No | Yes | No |

---

## What TrustAdd Has That Others Don't

1. **On-chain event history timeline** — None of the competitors show an append-only event log per agent. TrustAdd is the only place to see *how* an agent's identity has evolved over time. Critical for due diligence.
2. **Identity Completeness indicator** — A neutral, factual metric based on 11 profile fields. Others use opinionated reputation scores. Ours is verifiable and objective.
3. **Trust mechanism transparency** — We show *which* trust mechanisms an agent supports (reputation, crypto-economic, TEE attestation). Others just show a composite score.
4. **Protocol education** — "Three Pillars of Agent Trust" section explains ERC-8004 to newcomers. Others assume technical knowledge.

---

## Prioritized Feature Roadmap

### Tier 1 — High Impact, Close Competitive Gaps

| # | Feature | Rationale | Effort |
|---|---|---|---|
| 1 | **Multi-chain support** (Base + BNB at minimum) | Every competitor does this. We're the only Ethereum-only explorer. | Large |
| 2 | **Leaderboard page** | All four competitors have one. Ours should lean into "neutral, factual" angle — rank by completeness, feedback count, or age rather than opinionated scores. | Medium |
| 3 | **Live activity feed** | Three of four competitors show real-time registrations. Creates a sense of ecosystem momentum. | Medium |
| 4 | **Pagination** | We currently load all 6,874 agents at once. Competitors paginate (10-20 per page). Performance issue. | Small |

### Tier 2 — Differentiation Features

| # | Feature | Rationale | Effort |
|---|---|---|---|
| 5 | **Agent comparison view** | Let users compare two agents side by side. Nobody does this. Unique feature. | Medium |
| 6 | **Ecosystem analytics dashboard** | Registration trends over time, chain distribution, skill/domain breakdowns. Inspired by Agentscan's charts. | Medium |
| 7 | **Feedback / reputation display** | Show on-chain feedback data from Reputation Registry. Don't compute scores (stay neutral), but surface the raw feedback entries. | Medium |
| 8 | **API documentation page** | We have a public API but no docs. trust8004 has integration guides. | Small |

### Tier 3 — Nice to Have

| # | Feature | Rationale | Effort |
|---|---|---|---|
| 9 | **Wallet connect + agent claiming** | Let controllers claim their agents. 8004scan and trust8004 offer this. | Large |
| 10 | **RSS / notification feed** | Subscribe to an agent's on-chain activity. Nobody offers this. | Medium |
| 11 | **Embeddable trust badges** | Let agents embed a "Verified on TrustAdd" badge on their own sites. | Small |
| 12 | **AI-powered search** | 8004scan has semantic search. Could be a differentiator if done well. | Medium |

---

## Suggested Positioning

The competitors cluster into two camps:
- **"Etherscan clones"** (8004scan, 8004agents, trust8004) — focused on scores, leaderboards, gamification, and wallet interaction
- **"Analytics platforms"** (Agentscan) — focused on data, trends, and categorization

**TrustAdd should be neither.** The unique angle:

> **"The neutral, history-first inspector for AI agent identity."**

### Positioning Pillars

1. **Neutral, not gamified** — While competitors rank and score agents (incentivizing gaming), TrustAdd presents facts: completeness, history, raw data. Like a credit report vs. a credit score.

2. **History is the product** — No competitor shows the on-chain event timeline. TrustAdd is the only place to see how an agent's identity has evolved over time. This matters for due diligence and trust verification.

3. **Human-readable first** — Competitors show hex addresses and raw chain data. TrustAdd translates everything into plain English with a LinkedIn-style profile experience.

4. **Trust through transparency, not through scores** — Instead of telling users "this agent scored 84.5," show them the raw trust mechanisms, endpoints, feedback history, and let them decide.

### Tagline Options
- *"The public record for AI agent identity"*
- *"See the full story behind every AI agent"*
- *"Neutral. Factual. History-preserving."*

---

## Key Takeaways

- **Biggest gap:** Multi-chain. This is table stakes — all competitors support 5-10 chains.
- **Strongest differentiator:** Event history timeline + neutrality. Nobody else does this.
- **Biggest opportunity:** The "neutral inspector" positioning is unoccupied. Every competitor has picked a side (gamification, scores, rankings). There's room for a factual, no-opinion alternative.
- **Risk:** If we stay Ethereum-only, we'll always have a fraction of the agent count (6,874 vs 30,000-40,000). Multi-chain is the single most impactful feature to build.
