# TrustAdd API Tiering

## 1. Overview

TrustAdd exposes two API tiers with a clear commercial boundary:

**Free Tier** — ecosystem analytics, agent discovery (redacted), marketplace data, and capability intelligence. No authentication required. Designed to drive developer adoption and showcase the breadth of the agent ecosystem.

**Paid Tier (x402)** — agent-specific trust intelligence delivered via HTTP 402 micropayments. Callers pay per-lookup in USDC on Base using the x402 protocol. No API keys, no subscriptions.

The pitch: **"We show you WHO agents are for free. We charge to tell you whether you should TRUST them."**

The split is deliberate. Aggregate data (how many agents, how the ecosystem is distributed, what skills exist) has high public value and low marginal cost. Per-agent trust intelligence (score, breakdown, flags, full community signal) is the premium product — it answers the question a hiring system, orchestrator, or wallet actually needs answered before delegating work or value to an agent.

---

## 2. Architecture

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                        TrustAdd API                                  │
  │                                                                       │
  │  FREE TIER (no auth, rate-limited)                                   │
  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
  │  │  Ecosystem       │  │  Agent Directory  │  │  Marketplace /     │ │
  │  │  Analytics       │  │  (REDACTED)       │  │  Skills / Economy  │ │
  │  │                  │  │                   │  │                    │ │
  │  │  /api/analytics/ │  │  /api/agents      │  │  /api/bazaar/      │ │
  │  │  /api/stats      │  │  /api/agents/:id  │  │  /api/skills/      │ │
  │  │  /api/chains     │  │  /api/agents/:id/ │  │  /api/economy/     │ │
  │  │  /api/status/    │  │    trust-score    │  │  /api/quality/     │ │
  │  │                  │  │                   │  │    summary         │ │
  │  │  Returns: full   │  │  Strips:          │  │  /api/trust-scores/│ │
  │  │  aggregate data  │  │  - trustScore     │  │    distribution    │ │
  │  │                  │  │  - breakdown      │  │  /api/community-   │ │
  │  │                  │  │  - qualityTier    │  │    feedback/stats  │ │
  │  │                  │  │  - spamFlags      │  │                    │ │
  │  │                  │  │  - lifecycleStatus│  │  Returns: names +  │ │
  │  │                  │  │                   │  │  chain only,       │ │
  │  │                  │  │  Adds:            │  │  anonymized,       │ │
  │  │                  │  │  + verdict        │  │  no IDs/scores     │ │
  │  │                  │  │  + reportAvailable│  │                    │ │
  │  └──────────────────┘  └──────────────────┘  └────────────────────┘ │
  │                                                                       │
  │  ─────────────────────────── x402 GATE ──────────────────────────── │
  │                                                                       │
  │  PAID TIER (micropayment via x402, USDC on Base)                     │
  │  ┌──────────────────────────────────────────────────────────────────┐│
  │  │  Trust Intelligence  (/api/v1/trust/:address)                    ││
  │  │                                                                   ││
  │  │  Quick Check  $0.01 USDC                                         ││
  │  │  - trustScore (0-100)          - qualityTier                     ││
  │  │  - trustScoreBreakdown         - spamFlags                       ││
  │  │  - verdict                     - lifecycleStatus                 ││
  │  │                                                                   ││
  │  │  Full Report  $0.05 USDC  (/api/v1/trust/:address/report)        ││
  │  │  - All Quick Check fields      - community feedback blocks        ││
  │  │  - transaction history         - identity block                  ││
  │  │  - capability block            - history block                   ││
  │  │  - transparency block          - compiled verdict with rationale  ││
  │  └──────────────────────────────────────────────────────────────────┘│
  │                                                                       │
  │  GATED ENDPOINTS (previously free, now return HTTP 402)              │
  │  ┌──────────────────────────────────────────────────────────────────┐│
  │  │  /api/agents/:id/community-feedback  (and /github, /farcaster)  ││
  │  │  /api/agents/:id/transactions        (and /stats)               ││
  │  │  /api/agents/:id/history                                        ││
  │  │  /api/quality/offenders                                         ││
  │  │                                                                   ││
  │  │  Response: 402 Payment Required + x402 upgrade instructions      ││
  │  └──────────────────────────────────────────────────────────────────┘│
  │                                                                       │
  │  ANTI-SCRAPING                                                        │
  │  - /api/agents list: 10 req/min per IP, max 20 results/page          │
  │  - SSR meta tags: verdict label only, no numeric score in JSON-LD    │
  │  - Bazaar crossref: trust scores and payment addresses stripped       │
  │  - Response header X-TrustAdd-Tier: free | gated on all endpoints    │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Free Tier Endpoints

All free endpoints return `X-TrustAdd-Tier: free` in the response headers.

### Ecosystem Analytics

| Endpoint | Returns |
|---|---|
| `GET /api/analytics/overview` | Total agents, chains, transactions, ecosystem totals |
| `GET /api/analytics/protocol-stats` | Per-protocol agent and transaction counts |
| `GET /api/analytics/chain-distribution` | Agent distribution across chains |
| `GET /api/analytics/registrations` | New agent registration rate over time |
| `GET /api/analytics/metadata-quality` | Metadata completeness metrics |
| `GET /api/analytics/x402-by-chain` | x402-enabled agent counts per chain |
| `GET /api/analytics/controller-concentration` | Controller wallet concentration metrics |
| `GET /api/analytics/uri-schemes` | URI scheme adoption rates |
| `GET /api/analytics/categories` | Agent category distribution |
| `GET /api/analytics/image-domains` | Image hosting domain breakdown |
| `GET /api/analytics/models` | AI model usage across agents |
| `GET /api/analytics/endpoints-coverage` | Endpoint probe coverage stats |
| `GET /api/analytics/top-agents` | Top agents by ecosystem metric |
| `GET /api/analytics/trust-scores` | Aggregate trust score distribution (no per-agent data, no topAgents) |
| `GET /api/analytics/api-usage` | API usage statistics |

### Agent Directory (Redacted)

| Endpoint | Notes |
|---|---|
| `GET /api/agents` | Returns agent list. See redacted fields in Section 6. Rate-limited: 10 req/min, max 20/page. Adds `verdict` and `reportAvailable` to each record. |
| `GET /api/agents/:id` | Single agent detail. Same field stripping as list. Adds `verdict` and `reportAvailable`. |
| `GET /api/agents/:id/trust-score` | Returns `verdict` (string label) only. Does not return numeric score, breakdown, or tier. |
| `GET /api/agents/:id/feedback` | Returns basic agent feedback summary only (no per-platform breakdown). |

### Chain and Status

| Endpoint | Returns |
|---|---|
| `GET /api/chains` | Supported chains, RPC metadata, contract addresses |
| `GET /api/stats` | Ecosystem-wide summary statistics |
| `GET /api/health` | Service liveness and DB connection test |
| `GET /api/status/overview` | Overall system status |
| `GET /api/status/events` | Recent system events |
| `GET /api/status/metrics` | System performance metrics |
| `GET /api/status/summary` | Status summary across all services |
| `GET /api/status/tasks` | Background task status (names and last-run times) |
| `GET /api/status/alerts` | Active system alerts |
| `GET /api/events/recent` | Recent indexer events |

### Bazaar (Marketplace)

| Endpoint | Returns |
|---|---|
| `GET /api/bazaar/stats` | Bazaar aggregate statistics |
| `GET /api/bazaar/services` | Listed services with pricing |
| `GET /api/bazaar/trends` | Service listing trends over time |
| `GET /api/bazaar/top-services` | Top services by activity |
| `GET /api/bazaar/price-distribution` | Service price distribution histogram |
| `GET /api/bazaar/crossref` | Agent crossref data. Trust scores and payment addresses stripped. |

### Skills

| Endpoint | Returns |
|---|---|
| `GET /api/skills/summary` | Skill ecosystem summary |
| `GET /api/skills/chain-distribution` | Skill adoption by chain |
| `GET /api/skills/top-capabilities` | Most common capability tags |
| `GET /api/skills/category-breakdown` | Skills grouped by category |
| `GET /api/skills/trust-correlation` | Skill presence vs trust score correlation |
| `GET /api/skills/oasf-overview` | OASF schema adoption overview |
| `GET /api/skills/notable-agents` | Notable agents by skill profile |

### Economy

| Endpoint | Returns |
|---|---|
| `GET /api/economy/overview` | Total volume, transaction count, active agents |
| `GET /api/economy/top-agents` | Top agents by economic activity. `trustScore` and `trustScoreBreakdown` stripped. |
| `GET /api/economy/endpoints` | Endpoint activity metrics |
| `GET /api/economy/chain-breakdown` | Volume and count per chain. `avgTrustScore` stripped. |
| `GET /api/economy/probes` | x402 probe results aggregate |
| `GET /api/economy/transactions/stats` | Transaction aggregate statistics |
| `GET /api/economy/transactions/recent` | Recent transactions (anonymized) |
| `GET /api/economy/transactions/volume` | Volume over time |
| `GET /api/economy/transactions/top-earners` | Top earners by volume. **Anonymized**: rank + name + chainId only, no addresses or amounts. |

### Community Feedback Aggregates

| Endpoint | Returns |
|---|---|
| `GET /api/community-feedback/stats` | Platform-level aggregate stats (total posts, sentiment distribution) |
| `GET /api/community-feedback/leaderboard` | Most-mentioned agents: names only, no raw metrics |

### Quality

| Endpoint | Returns |
|---|---|
| `GET /api/quality/summary` | Aggregate tier distribution counts (high/medium/low/spam/archived/unclassified) |

### Trust Discovery (v1)

| Endpoint | Returns |
|---|---|
| `GET /api/v1/trust/:address/exists` | Boolean: whether address is indexed. Free discovery endpoint with no score data. |
| `GET /api/trust-scores/top` | Top-ranked agents: names + verdict label only, no numeric scores |
| `GET /api/trust-scores/distribution` | Histogram of score ranges (no agent IDs or names) |

---

## 4. Paid Tier Endpoints (x402)

All paid endpoints use HTTP 402 Payment Required with x402 protocol headers to initiate a USDC micropayment on Base via the Coinbase Developer Platform facilitator. Payment is per-request; no subscription required.

### Quick Check — $0.01 USDC

```
GET /api/v1/trust/:address
```

Returns per-agent trust intelligence including:

- `trustScore` — numeric 0-100
- `trustScoreBreakdown` — component subscores: `{identity, history, capability, community, transparency}`
- `trustScoreUpdatedAt` — timestamp of last score computation
- `verdict` — TRUSTED / CAUTION / UNTRUSTED / UNKNOWN
- `qualityTier` — high / medium / low / spam / archived / unclassified
- `spamFlags` — array of flag strings
- `lifecycleStatus` — active / inactive / archived

### Full Report — $0.05 USDC

```
GET /api/v1/trust/:address/report
```

Returns everything in Quick Check plus a compiled trust report with all analysis blocks:

- **Identity block** — name, controller address, registration chain, cross-chain presence
- **History block** — registration age, activity timeline, score change history
- **Capability block** — declared skills, endpoint probe results, uptime rate
- **Community block** — GitHub stars/issues, Farcaster mentions, sentiment breakdown
- **Transparency block** — manifest completeness, self-reported metadata coverage
- **Verdict block** — compiled verdict with rationale text, risk summary, confidence level

Report format matches the Trust Data Product specification in `docs/trust-product.md`.

---

## 5. Gated Endpoints (Return 402)

These endpoints were previously free and returned raw per-agent data. They now return HTTP 402 with x402 payment instructions. Callers that pay the Quick Check or Full Report price receive equivalent data through the `/api/v1/trust/` surface instead.

| Endpoint | Status |
|---|---|
| `GET /api/agents/:id/community-feedback` | 402 — use `/api/v1/trust/:address/report` |
| `GET /api/agents/:id/community-feedback/github` | 402 — use `/api/v1/trust/:address/report` |
| `GET /api/agents/:id/community-feedback/farcaster` | 402 — use `/api/v1/trust/:address/report` |
| `GET /api/agents/:id/transactions` | 402 — use `/api/v1/trust/:address/report` |
| `GET /api/agents/:id/transactions/stats` | 402 — use `/api/v1/trust/:address/report` |
| `GET /api/agents/:id/history` | 402 — use `/api/v1/trust/:address/report` |
| `GET /api/quality/offenders` | 402 — returns low/spam tier agents with full flag details |
| `GET /api/economy/payment-addresses` | 402 — use `/api/v1/trust/:address` or `/api/v1/trust/:address/report` |

All gated 402 responses include:
- `X-TrustAdd-Tier: gated` response header
- x402 payment headers pointing to the appropriate paid endpoint
- A JSON body with `upgrade` field explaining which paid endpoint to use

---

## 6. Redacted Fields

### Fields Stripped from Free `/api/agents` Responses

These fields exist in the database but are removed before free tier responses are serialized:

| Field | Type | Description |
|---|---|---|
| `trustScore` | `number` (0–100) | Composite trust score |
| `trustScoreBreakdown` | `object` | Component subscores: `{identity, history, capability, community, transparency}` |
| `trustScoreUpdatedAt` | `timestamp` | When the score was last computed |
| `qualityTier` | `string` | `high` / `medium` / `low` / `spam` / `archived` / `unclassified` |
| `spamFlags` | `string[]` | Array of flag codes (e.g. `no_transactions`, `low_community_presence`) |
| `lifecycleStatus` | `string` | `active` / `inactive` / `archived` |

### Fields Added to Free Responses

These fields are computed at response time and injected into free tier agent objects:

| Field | Type | Description |
|---|---|---|
| `verdict` | `string` | `TRUSTED` / `CAUTION` / `UNTRUSTED` / `UNKNOWN` — derived from score + tier (see Section 9) |
| `reportAvailable` | `boolean` | Whether a full report has been compiled for this address |

### Bazaar Crossref Stripping

Agent records embedded in bazaar listing responses also have trust scores and payment addresses stripped. Only name, chain, and category are preserved in crossref objects.

### SSR Meta Tags

The `/api/agent/:id` SSR function injects verdict label only into JSON-LD and OG tags. Numeric scores do not appear in server-rendered HTML, preventing score extraction via scraper without paying.

---

## 7. Anti-Scraping Measures

### Rate Limits

- `/api/agents` list endpoint: **10 requests per minute per IP**
- Page size cap: **20 results per page maximum** (ignores larger `limit` values)
- Pagination combined with rate limits means scraping the full directory takes hours, not seconds

### Anonymization in Aggregate Endpoints

Endpoints that could indirectly reconstruct per-agent data are anonymized:

- `/api/economy/transactions/top-earners` — name + chain only, no addresses or amounts
- `/api/trust-scores/top` — name + verdict only, no numeric scores
- `/api/community-feedback/leaderboard` — names only, no mention counts or sentiment scores
- `/api/trust-scores/distribution` — histogram buckets only, no agent identifiers

### SSR Layer

The agent detail SSR function (`api/agent/[id].ts`) injects only verdict label into meta tags. JSON-LD structured data does not include `trustScore`, `qualityTier`, or `spamFlags`. This means search engine crawlers and link-preview scrapers see verdict text, not score data.

---

## 8. Response Headers

Every API response includes a tier header indicating which access tier served the request:

| Header | Value | Applied To |
|---|---|---|
| `X-TrustAdd-Tier` | `free` | All free tier endpoints |
| `X-TrustAdd-Tier` | `gated` | Endpoints returning HTTP 402 |
| `X-TrustAdd-Tier` | `paid` | Responses served after successful x402 payment |

These headers allow API clients and monitoring tools to distinguish tier behavior without inspecting response bodies.

---

## 9. Verdict Logic

Verdicts are computed from `trustScore`, `qualityTier`, and `spamFlags`. The free tier exposes only the verdict label; the paid tier exposes the underlying data used to derive it.

| Verdict | Condition |
|---|---|
| `TRUSTED` | `trustScore >= 60` AND `qualityTier in (high, medium)` AND `spamFlags` is empty |
| `CAUTION` | `trustScore` 30–59 OR `qualityTier = low` OR `spamFlags` has at least one non-critical flag |
| `UNTRUSTED` | `trustScore < 30` OR `qualityTier in (spam, archived)` |
| `UNKNOWN` | Address not indexed OR indexed but not yet scored (i.e. `trustScore` is null) |

**Precedence**: `UNTRUSTED` conditions override `CAUTION` conditions. If both apply, `UNTRUSTED` wins. `UNKNOWN` is returned for addresses not present in the database AND for addresses that are indexed but have not yet had a trust score computed.

**Critical vs non-critical flags**: Flags such as `no_transactions` or `low_community_presence` are non-critical and push an agent to `CAUTION`. Flags such as `known_spam_cluster` or `controller_flagged` are critical and push to `UNTRUSTED` regardless of numeric score.

---

## 10. Future Enrichment Opportunities

Data not currently utilized in paid reports that could increase per-report value and justify higher price points:

1. **Transaction velocity** — acceleration or deceleration in transaction rate over rolling windows. Useful for detecting agents that spiked artificially before listing.

2. **Peer comparison** — percentile ranking within the agent's chain ("top 15% of Base agents by trust score"). Adds relative context that absolute scores lack.

3. **Activity timeline** — historical trust score changes with inflection point annotations. Allows buyers to see if an agent improved legitimately or gamed a specific metric.

4. **Controller portfolio** — other agents registered from the same controller wallet. A clean agent controlled by a wallet that controls known-spam agents is a risk signal.

5. **Endpoint uptime history** — x402-prober success rate over time per agent. A declining probe success rate indicates service degradation before it shows in community sentiment.

6. **Cross-protocol presence depth** — not just whether an agent appears on multiple protocols, but how active and consistent that presence is. Thin mirror profiles score differently than genuine multi-chain deployments.

7. **Spam cluster detection details** — which cluster an agent was associated with, cluster size, and cluster resolution status. Currently only the flag code is surfaced; the underlying cluster data is richer.

8. **Economic dependency graph** — which agents transact with which others. An agent whose only revenue comes from a single suspicious counterparty inherits that counterparty's risk profile.
