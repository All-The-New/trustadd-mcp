# Off-Chain Reputation Layer — Implementation Plan

## Executive Summary

TrustAdd builds an off-chain reputation aggregator that collects mentions, reviews, and sentiment about ERC-8004 agents from social media, developer platforms, and community forums — then displays this as a "Community Feedback" tab on each agent's profile. The system uses a **pluggable adapter pattern** so new platforms can be added independently.

**Current Status:** GitHub adapter fully implemented. Twitter, Reddit, and other platforms documented for future implementation.

---

## 1. Architecture Overview

### Adapter Pattern

The Community Feedback system is built on a modular adapter architecture:

```
┌────────────────────────────────────────────────────────────┐
│                  CommunityFeedbackScheduler                │
│  (Orchestrates scraping, manages timing, error handling)   │
└──────┬──────────┬──────────┬──────────┬───────────────────┘
       │          │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐
  │ GitHub │ │Twitter │ │Reddit  │ │ Future │
  │Adapter │ │Adapter │ │Adapter │ │Adapter │
  │(BUILT) │ │(PLAN)  │ │(PLAN)  │ │  ...   │
  └────┬───┘ └───┬────┘ └───┬────┘ └───┬────┘
       │         │          │          │
  ┌────▼─────────▼──────────▼──────────▼────┐
  │           Storage Layer                  │
  │  community_feedback_sources              │
  │  community_feedback_items                │
  │  community_feedback_summaries            │
  └──────────────────┬──────────────────────┘
                     │
  ┌──────────────────▼──────────────────────┐
  │        Frontend Display                  │
  │  Agent Profile "Community" tab           │
  │  Directory card star badges              │
  └─────────────────────────────────────────┘
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Adapter Interface | `server/community-feedback/types.ts` | `FeedbackSourceAdapter` contract all adapters implement |
| Scheduler | `server/community-feedback/scheduler.ts` | Orchestrates scraping with concurrency control and error handling |
| Source Discovery | `server/community-feedback/source-discovery.ts` | Scans agents table to find platform links and create sources |
| GitHub Adapter | `server/community-feedback/adapters/github.ts` | Scrapes GitHub repos for stars, forks, issues, commits |
| Entry Point | `server/community-feedback/index.ts` | Initializes the system on server startup |

### Data Flow

1. **Source Discovery** — Scans all agents for platform links (GitHub URLs, Twitter handles, etc.) and inserts them into `community_feedback_sources`
2. **Scheduled Scraping** — The scheduler finds stale sources, calls the appropriate adapter, stores results
3. **Summary Aggregation** — After scraping, summaries are recomputed per agent
4. **API Serving** — REST endpoints serve feedback data to the frontend
5. **UI Display** — Agent profile "Community" tab and directory card badges

---

## 2. Agent Matching Strategy

### Available Matching Data (from indexed agents)

| Data Point | Agents with Data | Match Quality |
|------------|-----------------|---------------|
| Agent name | ~54% | Medium — names may not be unique |
| Description | ~54% | Low — useful for disambiguation only |
| Website endpoint | ~2% | High — domain name is a strong identifier |
| Twitter/X link | ~0.3% | Very High — direct social account link |
| GitHub link | ~1% | Very High — direct developer presence |
| Email endpoint | ~0.1% | Medium — domain extraction possible |
| A2A endpoint | ~1% | Medium — domain extraction possible |

### Matching Tiers

**Tier 1 — Direct Link Match (highest confidence)** [IMPLEMENTED]
- Agent metadata contains explicit GitHub, Twitter, or website URLs
- Scrape those specific accounts/domains for mentions, reviews, discussions
- Zero false positive risk
- Used by: GitHub adapter

**Tier 2 — Domain-Based Match (high confidence)** [FUTURE]
- Extract domains from A2A/MCP/web endpoints (e.g., `minara.ai` from `https://x402.minara.ai/`)
- Search for that domain on social platforms
- Cross-reference with agent name for confirmation

**Tier 3 — Name-Based Match (medium confidence, requires validation)** [FUTURE]
- Search social platforms for the agent name + context keywords ("ERC-8004", "AI agent", "on-chain")
- Use AI classification to verify relevance
- Higher false positive risk — requires human or AI review before display

---

## 3. Implemented Platform: GitHub

### What It Captures
- Repository stars, forks, open issues count
- Contributor count
- Last commit date
- Primary language
- Repository description
- Recent open issues (titles, authors, labels)

### Health Score (0-100)

The GitHub adapter computes a health score from multiple signals:

| Signal | Points | Scoring |
|--------|--------|---------|
| Stars | 0-20 | 0=0, 1-5=5, 6-20=10, 21-100=15, 100+=20 |
| Recent commits | 0-25 | <7d=25, <30d=20, <90d=10, <365d=5, else 0 |
| Open issues ratio | 0-15 | Lower ratio (issues/stars) is better |
| Contributors | 0-20 | 1=5, 2-3=10, 4-10=15, 10+=20 |
| Forks | 0-10 | 0=0, 1-5=5, 5+=10 |
| Has description | 0-5 | Boolean |
| Has README | 0-5 | Boolean |

### API Requirements
- Uses `GITHUB_TOKEN` env var for authenticated requests (5,000 req/hr vs 60/hr unauthenticated)
- 4 API calls per repo: repo info, contributors, commits, issues
- Cost: Free

### Error Handling
- **404 (repo deleted/private)** — marks source as inactive
- **403 (rate limited)** — throws error, scheduler retries on next cycle
- **Rate limit headers** — checks `x-ratelimit-remaining`, pauses if low

---

## 4. Future Platform: X/Twitter Semantic Engine

### Two-Stage Pipeline

Twitter requires semantic analysis because mentions are unstructured text. The pipeline has two stages:

**Stage 1: Relevance Filter (cheap model)**
```
Input: Tweet text + agent metadata
Task: "Is this tweet actually about this specific AI agent?"
Model: GPT-5 Nano (~$11/1M requests)
Output: relevant (true/false) + confidence (0-1)
```

Prompt template:
```
You are classifying whether a social media post is about a specific AI agent.

Agent: {agent_name}
Description: {agent_description}
Keywords: {agent_tags}
Platform identifiers: {twitter_handle}, {domain}

Post: "{tweet_text}"

Is this post specifically about or discussing this AI agent?
Reply with JSON: { "relevant": true/false, "confidence": 0.0-1.0, "reason": "brief explanation" }
```

**Stage 2: Sentiment Classification**
```
Input: Relevant tweet text
Task: "What is the sentiment toward this agent?"
Model: GPT-5 Nano or GPT-4o Mini for higher accuracy
Output: sentiment (positive/negative/neutral/mixed) + score (0-1)
```

Prompt template:
```
Classify the sentiment of this social media post about an AI agent.

Agent: {agent_name}
Post: "{tweet_text}"

Consider: Is the author expressing satisfaction, frustration, curiosity, or criticism?
Watch for sarcasm, irony, and indirect references.

Reply with JSON:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "score": 0.0-1.0,
  "aspects": ["reliability", "performance", "cost", "documentation"],
  "is_sarcastic": true/false
}
```

### Expected Accuracy

| Task | Expected Accuracy | Notes |
|------|-------------------|-------|
| Relevance classification | 85-90% | Higher for agents with unique names |
| Sentiment (clear cases) | 88-94% | Straightforward praise/criticism |
| Sarcasm detection | 70-87% | Hardest edge case, crypto community uses heavy sarcasm |
| Mixed sentiment | 75-85% | Posts that praise one aspect while criticizing another |

### Edge Cases

- **Sarcasm**: "Oh great, another agent that promises the world" — negative despite positive words
- **Indirect references**: "@user's agent just rugged me" — mentions agent without name
- **Mixed sentiment**: "Fast execution but terrible documentation" — mixed
- **Bot filtering**: Ignore retweet bots, automated promotion accounts
- **Context threads**: A negative reply to a positive tweet about the agent
- **Minimum threshold**: Only display sentiment data when 3+ mentions exist

### Cost Breakdown

| Item | Monthly Cost |
|------|-------------|
| X/Twitter API Basic | $200 |
| Relevance classification (GPT-5 Nano, ~5K tweets/day) | ~$1 |
| Sentiment classification (filtered subset, ~500/day) | ~$0.10 |
| **Total** | **~$201/month** |

### API Access Options

| Tier | Cost | Capacity | Notes |
|------|------|----------|-------|
| X Basic | $200/month | 15,000 tweets/month | Sufficient for Tier 1 agents |
| X Pro | $5,000/month | 1M tweets/month | Full-scale monitoring |
| Third-party (TwitterAPI.io) | ~$0.10-0.50/1K tweets | Pay-as-you-go | Cost-effective alternative |

---

## 5. Platform: Reddit — SHELVED

**Status: Shelved (Feb 2026)**

### Reasons for Shelving (data-backed analysis of 19,901 agents)

1. **No source discovery path**: Only 1 agent out of 19,901 has a Reddit URL in its endpoints (TradeOS AI → r/TradeOS_AI). Source discovery requires direct links in agent metadata.

2. **Name-based matching is unreliable**: Agent names are too generic for Reddit search:
   - 2,047 agents named "test"
   - 731 named "AxiAgent_7422"
   - 330 with blank names
   - 3,784 names under 10 characters (e.g., "gala", "agent", "eth")
   - Common names like "Quantum Quill" (19 dupes), "Nexus Nova" (10 dupes) would match unrelated content

3. **Reddit API access barrier**: Reddit ended self-serve creation of OAuth apps. New apps require manual approval through a request form describing the use case.

4. **Low expected coverage**: ERC-8004 agents are too new to have meaningful Reddit discussion. Even distinctive agent names like "Clawmpfuss" are unlikely to have Reddit mentions.

### Revisit Conditions
- When >50 agents have Reddit URLs in their metadata
- When ERC-8004 ecosystem grows enough to generate organic Reddit discussion
- When Reddit simplifies API access for non-commercial monitoring

---

## 6. Platform: Farcaster/Warpcast — IMPLEMENTED

**Status: Built (Feb 2026) — Neynar API adapter**

### Implementation Details
- **Adapter**: `server/community-feedback/adapters/farcaster.ts`
- **Source discovery**: Extracts usernames from `farcaster.xyz/{username}` and `warpcast.com/{username}` endpoint URLs
- **Current coverage**: 8 agents with Farcaster links (5 unique usernames)
- **API**: Neynar REST API (free tier, `NEYNAR_API_KEY` env var)
- **Data captured**:
  - Profile: followers, following, Neynar user score (0-1), FID, bio, verified ETH/SOL addresses
  - Feed: recent casts with per-cast engagement (likes, recasts, replies)
  - Computed: average engagement per cast, total casts, last cast date
- **Summary columns**: `farcasterFollowers`, `farcasterFollowing`, `farcasterScore`, `farcasterFid`, `farcasterLastCastAt`, `farcasterTotalCasts`, `farcasterEngagementAvg`

### Why Farcaster Works
- Crypto-native audience — most aligned with ERC-8004 ecosystem
- Wallet-connected identities enable cross-referencing with on-chain agent controllers
- Agents are actively building Farcaster presence (Clawd has 580 followers)
- Free API access via Neynar
- Growing adoption as the primary social layer for on-chain agents

---

## 6b. Platform: Olas Marketplace — SHELVED

**Status: Shelved (Feb 2026)**

### Investigation Findings
- 87 agents link to `marketplace.olas.network` in their endpoints
- Marketplace is a Next.js SPA that reads from on-chain registries
- The `/erc8004/{network}/ai-agents/{id}` endpoint returns ERC-8004 agent card JSON — identical to data we already index from on-chain events
- No additional usage stats, staking data, transaction counts, or community engagement metrics exposed via API
- Not worth an adapter since there is no unique data to scrape beyond what the indexer already captures

---

## 7. Future Platform: Telegram

### Strategy
- Difficult — no public message API
- Would need bot presence in specific groups
- Could monitor public channels only

### Implementation Challenges
- Requires Telegram Bot API + being added to specific groups
- Cannot monitor private groups without explicit access
- Message volume can be very high, need aggressive filtering
- Not recommended for initial implementation

---

## 8. Future Platform: Discord

### Strategy
- Similar to Telegram — requires bot in specific servers
- Would need to join relevant AI agent / ERC-8004 community servers

### Implementation Challenges
- Requires Discord bot with message read permissions
- Server owners must approve bot access
- Complex permission model
- Not recommended for initial implementation

---

## 9. Future Platform: Ethereum Magicians Forum

### Strategy
- RSS/web scraping for protocol-level discussion
- Direct source for ERC-8004 implementation discussions

### What to Capture
- Forum posts mentioning specific agents or projects
- Developer feedback on agent implementations
- Protocol-level discussions about agent behavior

### Implementation Notes
- No formal API — would need periodic web scraping or RSS monitoring
- Low volume, high signal
- Lower priority — check periodically for major discussions

---

## 10. Future Platform: DeFi Llama / DeepDAO

### Strategy
- Governance participation data for governance-focused agents
- On-chain activity metrics from DeFi protocols

### What to Capture
- Governance proposals created/voted on
- Protocol TVL interactions
- DAO membership and activity

---

## 11. Future: On-Chain Reputation

When ERC-8004 `FeedbackPosted` events start appearing on-chain, these can be integrated as the highest-trust feedback source:
- Direct on-chain attestations
- Cryptographically verified reviewers
- Immutable feedback history
- Already captured by the existing indexer — just needs UI integration

---

## 12. Database Schema

Three tables support the community feedback system:

### `community_feedback_sources`
Tracks per-agent, per-platform scraping state.
- Unique constraint on `(agentId, platform, platformIdentifier)`
- `isActive` flag for disabling deleted/private repos
- `scrapeErrors` counter for monitoring reliability

### `community_feedback_items`
Individual feedback data points from any platform.
- Unique constraint on `(sourceId, externalId)` for dedup
- `sentiment` and `sentimentScore` nullable (factual data like GitHub stats don't have sentiment)
- `rawData` stores full platform response for future re-processing

### `community_feedback_summaries`
Aggregated reputation per agent, materialized after each scrape run.
- One row per agent (unique on `agentId`)
- Platform-specific columns (githubStars, twitterMentions, etc.)
- `overallScore` for future composite reputation

---

## 13. Adding a New Platform

See `docs/community-feedback-adapter-guide.md` for the complete developer guide on implementing a new adapter.

---

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Twitter API price increase | Budget impact | Third-party API fallback (TwitterAPI.io) |
| Low mention volume | Empty feedback sections | Only show tab when data exists |
| False positive matches (Tier 3) | Incorrect attribution | Start with Tier 1 only; require AI + confidence threshold |
| API rate limiting | Incomplete data | Respect rate limits, cache aggressively, stagger requests |
| Sentiment misclassification | Inaccurate ratings | Confidence scores; minimum mention thresholds |
| Legal/ToS concerns | Service disruption | Use only official APIs; respect robots.txt |
| Repository renamed/moved | Stale data | Handle 404s gracefully, mark sources inactive |

---

## 15. Success Metrics

| Metric | Phase 1 (GitHub) | Phase 2 (+ Twitter) | Phase 3 (+ Reddit) |
|--------|-----------------|--------------------|--------------------|
| Agents with feedback data | 28+ | 400+ | 500+ |
| Data points captured/day | 112+ (4 per repo) | 2,000+ | 3,000+ |
| Sentiment accuracy | N/A (factual) | >85% | >85% |
| Profile engagement lift | Baseline | +20% time-on-page | +30% time-on-page |
| Monthly cost | $0 | ~$201 | ~$222 |
