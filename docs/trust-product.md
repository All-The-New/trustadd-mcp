# TrustAdd Trust API — Product Specification

## Overview

The TrustAdd Trust API is an **agent trust oracle** — a paid data service that provides trust assessments for ERC-8004 agents across 9 EVM chains. Agents query TrustAdd before transacting with a counterparty to get a machine-readable trust verdict backed by transparent, on-chain evidence.

**Analogy:** A credit check for the agent economy. Before Agent A pays Agent B for a service, Agent A pays TrustAdd $0.01 to verify Agent B is trustworthy.

**Payment protocols:**
- **x402** — USDC on Base (chain 8453), settled by the Coinbase CDP facilitator. EIP-3009 authorization — gasless for the payer.
- **MPP** — pathUSD on Tempo (chain 4217). Direct transfer; client submits the tx hash on retry (`Authorization: MPP 0x<hash>`). TrustAdd verifies on-chain via the Tempo RPC and replay-guards for 1h.

Both rails price the same: $0.01 Quick Check, $0.05 Full Report. The 402 response advertises every configured rail in a single `WWW-Authenticate` header set.

### MPP request flow

1. Client requests `GET /api/v1/trust/0xabc...` with no payment.
2. Server returns `HTTP 402` with `WWW-Authenticate: Payment id="...", realm="trustadd.com", method="tempo", intent="charge", request="<base64url-JSON>"`. Decoded payload contains `{recipient, asset, amount, chainId}`.
3. Client sends a pathUSD transfer on Tempo to `recipient` for at least `amount` base units.
4. Client retries with `Authorization: MPP 0x<txHash>`.
5. TrustAdd fetches the tx receipt via Tempo RPC, validates the `Transfer` log (asset, recipient, amount ≥ price), records `(txHash, logIndex)` in a 1h replay cache, then serves the JSON.

---

## Product Tiers

### Quick Check — $0.01 USDC

**Endpoint:** `GET /api/v1/trust/{address}`

A fast, machine-actionable trust verdict. Designed for automated agent decision-making — the response tells an agent whether to proceed, apply caution, or abort a transaction.

**Response time target:** < 200ms (cached), < 2s (on-demand compilation)

**Response:**

```json
{
  "address": "0x1234...abcd",
  "chainId": 8453,
  "name": "ExampleAgent",
  "verdict": "TRUSTED",
  "score": 72,
  "scoreBreakdown": {
    "identity": 20,
    "history": 15,
    "capability": 12,
    "community": 15,
    "transparency": 10
  },
  "tier": "high",
  "flags": [],
  "x402Active": true,
  "ageInDays": 145,
  "crossChainPresence": 3,
  "transactionCount": 23,
  "reportAvailable": true,
  "generatedAt": "2026-04-12T14:30:00.000Z",
  "reportVersion": 1
}
```

### Full Report — $0.05 USDC

**Endpoint:** `GET /api/v1/trust/{address}/report`

A comprehensive trust profile with full evidence. Designed for detailed due diligence — includes on-chain history, economic activity, community signals, and data freshness metadata.

**Response time target:** < 500ms (cached), < 5s (on-demand compilation)

**Response:**

```json
{
  "agent": {
    "id": "agent_abc123",
    "erc8004Id": 42,
    "name": "ExampleAgent",
    "description": "An autonomous trading agent...",
    "chains": [8453, 1, 137],
    "imageUrl": "https://...",
    "slug": "exampleagent",
    "endpoints": [
      { "url": "https://agent.example.com/api", "name": "Main API" }
    ],
    "capabilities": ["trading", "data-analysis"],
    "skills": ["market-data", "portfolio-management"]
  },
  "trust": {
    "verdict": "TRUSTED",
    "score": 72,
    "breakdown": {
      "identity": 20,
      "history": 15,
      "capability": 12,
      "community": 15,
      "transparency": 10
    },
    "tier": "high",
    "flags": [],
    "lifecycleStatus": "active",
    "updatedAt": "2026-04-12T05:00:00.000Z"
  },
  "onChain": {
    "firstSeenAt": "2025-11-18T12:00:00.000Z",
    "ageInDays": 145,
    "metadataEvents": 14,
    "crossChainCount": 3,
    "chains": [
      { "chainId": 8453, "name": "Base", "firstSeenBlock": 25000000 },
      { "chainId": 1, "name": "Ethereum", "firstSeenBlock": 21700000 },
      { "chainId": 137, "name": "Polygon", "firstSeenBlock": 67000000 }
    ]
  },
  "economy": {
    "x402Support": true,
    "paymentAddresses": [
      { "address": "0xpay...", "network": "base", "token": "USDC" }
    ],
    "transactionCount": 23,
    "totalVolumeUsd": 1450.00,
    "topTokens": [
      { "symbol": "USDC", "count": 15, "volumeUsd": 1200.00 },
      { "symbol": "USDT", "count": 5, "volumeUsd": 200.00 },
      { "symbol": "ETH", "count": 3, "volumeUsd": 50.00 }
    ]
  },
  "community": {
    "githubHealthScore": 85,
    "githubStars": 120,
    "githubForks": 34,
    "githubLastCommitAt": "2026-04-10T08:00:00.000Z",
    "githubContributors": 8,
    "farcasterScore": 0.6,
    "farcasterFollowers": 450,
    "totalSources": 3
  },
  "meta": {
    "generatedAt": "2026-04-12T14:30:00.000Z",
    "reportVersion": 1,
    "dataFreshness": {
      "trustScore": "2026-04-12T05:00:00.000Z",
      "probes": "2026-04-12T03:00:00.000Z",
      "transactions": "2026-04-11T18:00:00.000Z",
      "community": "2026-04-12T04:00:00.000Z"
    }
  }
}
```

### Free Endpoint — Exists Check

**Endpoint:** `GET /api/v1/trust/{address}/exists`

Zero-cost discovery. Agents can check whether TrustAdd has data on an address before deciding to pay for a report.

**Response:**

```json
{
  "found": true,
  "name": "ExampleAgent",
  "verdict": "TRUSTED",
  "x402Required": true,
  "quickCheckPrice": "$0.01",
  "fullReportPrice": "$0.05",
  "paymentNetwork": "eip155:8453",
  "paymentToken": "USDC"
}
```

---

## Verdict Logic

| Verdict | Criteria | Agent Action |
|---------|----------|-------------|
| **TRUSTED** | Score >= 60 AND tier in (high, medium) AND no spam flags | Proceed with transaction |
| **CAUTION** | Score 30-59 OR tier = low/unclassified OR has non-critical flags | Apply extra validation, consider full report |
| **UNTRUSTED** | Score < 30 OR tier = spam/archived OR lifecycleStatus = archived | Abort transaction, notify user |
| **UNKNOWN** | Address not found in TrustAdd database | Use own judgment, request manual approval |

### Spam Flags

Flags that can appear in the `flags` array:

- `no_metadata` — Agent has no metadata URI set
- `empty_description` — Missing or trivially short description
- `suspicious_name` — Name matches known spam patterns
- `inactive` — Agent lifecycle status is inactive/archived
- `no_history` — Zero on-chain events beyond initial registration
- `clone_detected` — Metadata fingerprint matches known spam cluster

---

## Scoring Methodology

Trust scores are computed across 5 categories (max 100 points total):

| Category | Max Points | What It Measures |
|----------|-----------|-----------------|
| **Identity** (25) | Name, description quality, image, endpoints, tags/skills |
| **History** (20) | Agent age, metadata update frequency, cross-chain presence |
| **Capability** (15) | x402 support, OASF skills/domains, endpoint count |
| **Community** (20) | GitHub health score, Farcaster engagement, source count |
| **Transparency** (20) | Metadata URI scheme (IPFS/Arweave > HTTPS), trust protocols, active status |

Scores are recalculated daily at 5:00 AM UTC via batch processing. Reports are cached for 1 hour and recompiled on-demand when stale.

---

## Address Resolution

The Trust API accepts any address associated with an ERC-8004 agent:

1. **Primary contract address** — the agent's registered contract
2. **Controller address** — the wallet that controls the agent
3. **Payment address** — addresses discovered via x402 endpoint probing

This means agents can look up counterparties by whichever address they encounter during a transaction.

---

## Payment Flow (x402)

```
Agent A                          TrustAdd API                     CDP Facilitator
  |                                  |                                  |
  |  GET /api/v1/trust/0xAgentB     |                                  |
  |-------------------------------->|                                  |
  |                                  |                                  |
  |  402 Payment Required            |                                  |
  |  PAYMENT-REQUIRED: {             |                                  |
  |    price: $0.01,                 |                                  |
  |    network: eip155:8453,         |                                  |
  |    payTo: 0xTreasury,            |                                  |
  |    token: USDC                   |                                  |
  |  }                               |                                  |
  |<---------------------------------|                                  |
  |                                  |                                  |
  |  [Sign EIP-3009 authorization]   |                                  |
  |                                  |                                  |
  |  GET /api/v1/trust/0xAgentB     |                                  |
  |  PAYMENT-SIGNATURE: {signed}     |                                  |
  |-------------------------------->|                                  |
  |                                  |  Verify + settle on Base         |
  |                                  |-------------------------------->|
  |                                  |  tx_hash                         |
  |                                  |<---------------------------------|
  |                                  |                                  |
  |  200 OK                          |                                  |
  |  PAYMENT-RESPONSE: {tx_hash}     |                                  |
  |  { verdict: "TRUSTED", ... }     |                                  |
  |<---------------------------------|                                  |
```

Key properties:
- **Gasless for the payer** — Agent A signs an off-chain authorization; the CDP facilitator pays gas
- **USDC on Base** — lowest fees, native EIP-3009 support
- **Atomic** — payment and data delivery happen in a single HTTP request/response

---

## Agent Integration Pattern

### The Trust Gate

Any agent framework can implement a trust gate — a pre-transaction check that queries TrustAdd:

```
Before transacting with address X:

1. GET trustadd.com/api/v1/trust/{X}/exists  (free)
   → If not found: proceed with caution or skip

2. GET trustadd.com/api/v1/trust/{X}  (pays $0.01 via x402)
   → TRUSTED:    proceed with transaction
   → CAUTION:    request full report or apply extra validation
   → UNTRUSTED:  abort transaction, notify user

3. (Optional) GET trustadd.com/api/v1/trust/{X}/report  (pays $0.05 via x402)
   → Full evidence for human review or detailed agent reasoning
```

### Distribution

- **MCP Server** (`@trustadd/mcp`) — installable in Claude Code, Cursor, Windsurf, and any MCP-compatible agent
- **REST API** — direct HTTP calls from any language/framework
- **OASF Skill** (roadmap) — interoperable with ERC-8004 agent skill registries

---

## Pricing Rationale

| Tier | Price | Rationale |
|------|-------|-----------|
| Quick Check | $0.01 USDC | Low enough for routine use (like a DNS lookup). If checking trust before a $5 service call, $0.01 is a no-brainer. |
| Full Report | $0.05 USDC | 5x premium for full evidence package. Used for higher-value transactions or when verdict is CAUTION. |
| Exists Check | Free | Zero-friction discovery. Agents learn TrustAdd exists and has data before paying. |

**Revenue model:** Volume-based. 1,000 agents checking 10x/day = $100/day on quick checks alone.

**Facilitator cost:** $0.001/tx via Coinbase CDP (1,000 free/month). Net margin: ~90% on quick checks, ~98% on full reports.

---

## Data Sources

All data in trust reports is sourced from TrustAdd's existing indexing infrastructure:

| Data | Source | Refresh Rate |
|------|--------|-------------|
| Agent identity | ERC-8004 Identity Registry (9 chains) | Every 2 hours (blockchain indexer) |
| Trust score | Calculated from 5 categories | Daily at 5 AM UTC |
| x402 probes | HTTP 402 endpoint discovery | Daily at 3 AM UTC |
| Transactions | Alchemy Asset Transfers API | Every 6 hours |
| GitHub signals | GitHub API via community scraper | Daily at 4 AM UTC |
| Farcaster signals | Neynar API via community scraper | Daily at 4 AM UTC |

---

## Supported Chains

The Trust API indexes agents across all 9 ERC-8004 deployment chains:

| Chain | Chain ID |
|-------|----------|
| Ethereum | 1 |
| BNB Chain | 56 |
| Polygon | 137 |
| Arbitrum | 42161 |
| Base | 8453 |
| Celo | 42220 |
| Gnosis | 100 |
| Optimism | 10 |
| Avalanche | 43114 |

All chains share the same ERC-8004 contract addresses. Agents registered on any chain are discoverable via the Trust API.

---

## Versioning

- **API version:** v1 (in URL path)
- **Report version:** Integer in response (`reportVersion: 1`), incremented on schema changes
- **Backward compatibility:** New fields are additive. Existing fields are never removed or renamed within a major version.
