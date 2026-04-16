# MPP Integration — Design Spec

**Date:** 2026-04-15
**Status:** Draft — awaiting implementation plan
**Scope:** Phase 1 (Directory Intelligence) + Phase 2 (Tempo On-Chain Analytics)
**Deferred:** Phase 3 (Cross-Protocol Trust Scoring changes)

---

## 1. Context

TrustAdd currently indexes two protocols for agent trust intelligence: **ERC-8004** (identity/reputation across 9 EVM chains) and **x402** (HTTP payment protocol on Base via Coinbase's Bazaar). The Machine Payments Protocol (MPP), co-authored by Stripe and Tempo Labs, launched March 18, 2026 as a parallel agent payment standard with its own chain (Tempo, ID 4217) and directory (`mpp.dev/services`).

Stripe, Visa, and Anthropic support both x402 and MPP — the agent economy will be multi-protocol. TrustAdd's value increases proportionally with protocol coverage. This spec defines the integration to make TrustAdd the first cross-protocol trust intelligence platform.

Background research: [`trustadd-mpp-research-report.md`](../../../Desktop/trustadd-mpp-research-report.md).

## 2. Goals and Non-Goals

### Goals

- Index the MPP Payments Directory daily; track service listings, categories, pricing, payment methods
- Probe known agent endpoints for MPP support; extract Tempo payment addresses
- Index Tempo chain (pathUSD) for inbound transactions to tracked payment addresses
- Expose MPP analytics via free-tier API endpoints
- Enable cross-protocol comparison (x402 vs MPP) and multi-protocol presence detection
- All work feature-flagged for safe rollout

### Non-Goals

- No changes to the trust scoring engine (Phase 3)
- No changes to agent profile pages or trust report structure (Phase 3)
- No changes to the x402-gated Trust Data Product API (Phase 3)
- No Tempo chain support in the ERC-8004 indexer (Tempo is not an ERC-8004 chain)
- No MPP payment gateway integration on TrustAdd itself (we index MPP, we don't accept MPP payments)

## 3. Architecture Approach

**Parallel infrastructure** mirroring the x402 / bazaar / transaction-indexer patterns. New MPP-specific tables, tasks, prober, and routes live alongside their x402 counterparts without touching production tables. This matches the existing codebase's pattern of one-module-per-protocol and keeps MPP isolated behind a feature flag during the unstable early phase of the protocol.

Rejected alternatives:
- **Unified multi-protocol tables** (adding a `protocol` column to `bazaar_services`, `x402_probes`): muddies production data, harder to feature-flag, risky migration on 11K+ bazaar rows.
- **Adapter pattern** (protocol-agnostic abstraction with plug-in implementations): premature abstraction. MPP is 4 weeks old with evolving APIs. YAGNI.

## 4. Data Model

### 4.1 New tables

#### `mpp_directory_services`
Mirrors `bazaar_services` for the MPP Payments Directory.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `serviceUrl` | text, unique | MPP endpoint URL |
| `serviceName` | text | Human-readable name |
| `providerName` | text, nullable | Organization/company name |
| `description` | text, nullable | |
| `category` | text | Classified: `ai-model`, `dev-infra`, `compute`, `data`, `commerce` |
| `pricingModel` | text | `charge`, `stream`, `session` |
| `priceAmount` | text, nullable | String for precision |
| `priceCurrency` | text, nullable | Token address (PATH USD default) |
| `paymentMethods` | jsonb | `[{method: "tempo", currency: "0x20c0..."}, {method: "stripe"}]` |
| `recipientAddress` | text, nullable | Tempo payment address if crypto |
| `isActive` | boolean, default true | Soft-delete on disappearance |
| `firstSeenAt` | timestamp | |
| `lastSeenAt` | timestamp | |
| `metadata` | jsonb, nullable | Extra: health, latency |
| `createdAt` / `updatedAt` | timestamps | |

Indexes: `serviceUrl` (unique), `category`, `isActive`, `lastSeenAt`.

#### `mpp_directory_snapshots`
Daily aggregates, mirrors `bazaar_snapshots`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `snapshotDate` | date, unique | One row per day |
| `totalServices` | integer | |
| `activeServices` | integer | |
| `categoryBreakdown` | jsonb | |
| `pricingModelBreakdown` | jsonb | |
| `paymentMethodBreakdown` | jsonb | Not mutually exclusive |
| `priceStats` | jsonb | `{median, mean, min, max, p25, p75}` |
| `createdAt` | timestamp | |

#### `mpp_probes`
MPP endpoint probe results, mirrors `x402_probes`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `agentId` | uuid FK → agents | |
| `endpointUrl` | text | |
| `probeStatus` | text | `success`, `no_mpp`, `error`, `timeout` |
| `httpStatus` | integer, nullable | |
| `hasMpp` | boolean | |
| `paymentMethods` | jsonb, nullable | Parsed from `WWW-Authenticate: Payment` |
| `tempoAddress` | text, nullable | Extracted Tempo recipient |
| `challengeData` | jsonb, nullable | Parsed challenge params |
| `responseHeaders` | jsonb, nullable | Raw payment headers |
| `probedAt` | timestamp | |
| `createdAt` | timestamp | |

Indexes: `agentId`, `hasMpp`, `tempoAddress`, `probedAt`.

### 4.2 Reused tables

**`agent_transactions`**: MPP transactions write here with `chainId: 4217`, `tokenSymbol: "pathUSD"`, `category: "mpp_payment"`. No schema change.

**`transaction_sync_state`**: Tempo addresses tracked here with `chainId: 4217`. No schema change — compound UK on `(paymentAddress, chainId)` already supports multi-chain.

**`agents.endpoints`** (existing jsonb): Input source for the MPP prober, same as for x402.

### 4.3 Cross-protocol query predicates

Multi-protocol presence is the strongest trust signal. Concrete SQL predicates:

```sql
WITH x402_agents AS (
  SELECT DISTINCT agent_id FROM x402_probes
  WHERE probe_status = 'success' AND payment_address IS NOT NULL
),
mpp_agents AS (
  SELECT DISTINCT agent_id FROM mpp_probes
  WHERE has_mpp = true
)
SELECT a.id, a.name
FROM agents a
JOIN x402_agents x ON x.agent_id = a.id
JOIN mpp_agents  m ON m.agent_id = a.id;
```

At 102K agents the join is linear; no index changes needed.

## 5. Background Tasks (Trigger.dev)

All tasks gated by `ENABLE_MPP_INDEXER=true`. Default **off** in production initially.

### 5.1 `trigger/mpp-directory-indexer.ts`

Schedule: `30 4 * * *` (daily 4:30 AM UTC, after bazaar-indexer at 4 AM).

Implementation-first task: **discover directory data shape**. Three-stage fallback:

1. **Try structured API**: `GET https://mpp.dev/api/services` or `GET https://mpp.dev/.well-known/mpp-directory`. If 200 with JSON, use it.
2. **Try individual service `/api` endpoints**: Research confirms MPP services self-describe via `GET /api`. Seed from any known list (mpp.dev scrape, research report examples) and fan out.
3. **Scrape `mpp.dev/services`**: HTML scrape with defensive parsing. This is the expected v1 fallback.

The directory source is abstracted behind an interface:

```ts
interface MppDirectorySource {
  fetchServices(): Promise<RawMppService[]>;
  healthCheck(): Promise<boolean>;
}
```

Two concrete implementations (`MppApiSource`, `MppScrapeSource`) selected at runtime. Start with scrape, swap to API when one becomes available without touching downstream code.

Flow:
1. Fetch via active source
2. For each service, optionally hit its `/api` for full schema enrichment (rate-limited, best-effort)
3. Classify category (reuse `server/bazaar-classify.ts` patterns — may need MPP-specific classifier)
4. Upsert into `mpp_directory_services` (conflict on `serviceUrl`)
5. Mark services not seen as `isActive=false`
6. Write daily snapshot to `mpp_directory_snapshots`

**Failure modes:**
- Directory unreachable → skip run, Sentry alert via existing `onFailure` hook, retry next day
- Per-service `/api` failure → log + skip, continue with others
- Parse error (scraper) → emit Sentry event with HTML snippet for debugging

Concurrency: queue limit 1 (single-writer).

### 5.2 `trigger/mpp-prober.ts`

Schedule: `30 3 * * *` (daily 3:30 AM UTC, after x402-prober at 3 AM).

Flow:
1. Select agents with declared HTTP endpoints (same query as x402-prober)
2. Concurrency-limited probe (MAX_CONCURRENT=2):
   - `GET` with User-Agent header, 5s timeout
   - If 402, parse ALL `WWW-Authenticate: Payment` headers (multiple allowed per MPP spec)
   - Extract per method: `id`, `realm`, `method` (tempo/stripe/lightning), `intent` (charge/stream/session), base64url-decode `request` for amount/currency/recipient
3. Write result to `mpp_probes`
4. If Tempo recipient discovered: upsert to `transaction_sync_state` with `chainId: 4217`

**SSRF safety**: Same blocklist as x402-prober (localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, cloud metadata endpoints). Only http/https protocols.

**Admin trigger**: `POST /api/admin/mpp/probe-all` (cookie-gated).

### 5.3 `trigger/tempo-transaction-indexer.ts`

Schedule: `0 */6 * * *` (every 6 hours, aligned with existing transaction-indexer).

**Bootstrap — resolve PATH USD deployment block:**
On first run, if `TEMPO_PATHUSD_DEPLOYMENT_BLOCK` is unset:
1. Query Tempo RPC for the earliest `Transfer` log on `0x20c0000000000000000000000000000000000000` via binary search over `eth_getLogs` (bounded block windows).
2. Persist result as `indexer_state` row with `chainId: 4217`, `lastProcessedBlock` = deployment block.
3. Log deployment block for manual capture as env var.

Until resolved, default to block 0 (fine for a young chain with sub-second finality).

**Flow per run:**
1. Read payment addresses from `transaction_sync_state` where `chainId: 4217`
2. For each address (queue concurrency 2):
   - Query Tempo RPC for `Transfer(_, to=address, _)` logs on pathUSD since `lastSyncedBlock`
   - Also query `TransferWithMemo(_, to=address, _, _)` events (Tempo-specific)
   - Page in 10K block windows to stay within RPC limits
3. Parse logs → `agent_transactions` inserts:
   - `chainId: 4217`, `tokenSymbol: "pathUSD"`, `amount` (6-decimal parse), `amountUsd` = amount (1:1 USD stablecoin), `category: "mpp_payment"`, `memo` from `TransferWithMemo` if present (store in existing metadata column or add minor schema extension during impl)
4. Update `transaction_sync_state.lastSyncedBlock`

**RPC reliability — circuit breaker pattern** (mirrors existing `server/pipeline-health.ts`):
- Per-chain circuit breaker: 5 consecutive failures → open circuit for 10 minutes
- Exponential backoff on 429/5xx: 1s → 2s → 4s → 8s → 16s
- If primary RPC (`TEMPO_RPC_URL`) fails repeatedly, fall back to `TEMPO_RPC_URL_FALLBACK` (optional env var; set to QuickNode/Chainstack endpoint for redundancy)
- Health state reported via existing pipeline health dashboard

**Tempo-specific gotchas addressed:**
- No native gas token: don't call `eth_getBalance`; only query TIP-20 `balanceOf` if needed (not needed for v1)
- `feeToken` / `feePayer` fields in receipts: tolerate unknown fields in ethers.js provider (no strict decoding)
- Tx type `0x76`: we don't decode full transactions, only event logs via `eth_getLogs` which is standard — safe

## 6. Configuration

### 6.1 `shared/chains.ts` addition

```ts
export const TEMPO_CHAIN_CONFIG = {
  chainId: 4217,
  name: "Tempo",
  shortName: "tempo",
  rpcUrl: process.env.TEMPO_RPC_URL || "https://rpc.tempo.xyz",
  rpcUrlFallback: process.env.TEMPO_RPC_URL_FALLBACK,
  explorer: "https://explore.mainnet.tempo.xyz",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 6 }, // no native gas token
  tokens: {
    pathUSD: {
      address: "0x20c0000000000000000000000000000000000000",
      symbol: "pathUSD",
      decimals: 6,
    },
  },
  deploymentBlock: parseInt(process.env.TEMPO_PATHUSD_DEPLOYMENT_BLOCK || "0", 10),
};
```

Exported separately from `CHAIN_CONFIGS` (ERC-8004 array) — Tempo is not an ERC-8004 chain and the existing blockchain-indexer loop is untouched.

### 6.2 Environment variables

| Var | Purpose | Default |
|-----|---------|---------|
| `ENABLE_MPP_INDEXER` | Master feature flag for all MPP tasks | `false` |
| `ENABLE_MPP_UI` | Frontend feature flag | `false` |
| `TEMPO_RPC_URL` | Primary Tempo RPC | `https://rpc.tempo.xyz` |
| `TEMPO_RPC_URL_FALLBACK` | Secondary RPC (QuickNode/Chainstack) | (unset) |
| `TEMPO_PATHUSD_DEPLOYMENT_BLOCK` | Resolved deployment block | (set after bootstrap) |
| `MPP_DIRECTORY_SOURCE` | `api` \| `scrape` \| `auto` | `auto` |

Set via Vercel CLI per `CLAUDE.md` conventions. Trigger.dev env vars set via dashboard (Settings > Environment Variables > Production).

## 7. API Endpoints

All new endpoints are **free-tier analytics**. Trust-intelligence endpoints (per-agent, x402-gated) remain out of scope for this phase.

**Files:**
- New: `server/routes/mpp.ts` (domain router)
- New: `server/storage/mpp.ts` (storage layer)
- Modified: `server/routes.ts` (register router, ~2 lines)

### 7.1 Directory endpoints

| Endpoint | Cache | Purpose |
|----------|-------|---------|
| `GET /api/mpp/directory/stats` | 5min | Total/active service count, category breakdown, payment method breakdown, price median/mean, latest snapshot timestamp |
| `GET /api/mpp/directory/services` | 1min | Paginated list. Filters: `?category=`, `?paymentMethod=`, `?search=`, `?page=&limit=` |
| `GET /api/mpp/directory/trends` | 1hr | Time-series from `mpp_directory_snapshots`: service count, category shifts, price trends |
| `GET /api/mpp/directory/top-providers` | 5min | Top providers by service count or estimated volume |

### 7.2 Adoption endpoints

| Endpoint | Cache | Purpose |
|----------|-------|---------|
| `GET /api/mpp/adoption` | 5min | Count of agents with `hasMpp=true`, cross-tab with x402 |
| `GET /api/mpp/probes/recent` | 1min | Last N successful MPP probes (admin-adjacent) |

### 7.3 Chain analytics endpoints

| Endpoint | Cache | Purpose |
|----------|-------|---------|
| `GET /api/mpp/chain/stats` | 5min | Tempo: indexed pathUSD inbound volume, tx count, unique payers, active recipients |
| `GET /api/mpp/chain/volume-trend` | 1hr | Daily volume chart from `agent_transactions` where `chainId=4217` |

### 7.4 Cross-protocol endpoints

| Endpoint | Cache | Purpose |
|----------|-------|---------|
| `GET /api/ecosystem/protocol-comparison` | 5min | Side-by-side: x402 vs MPP service counts, volume, adoption trends |
| `GET /api/ecosystem/multi-protocol-agents` | 5min | Agents detected on both x402 AND MPP — redacted per free-tier rules |

### 7.5 Admin endpoints

Extend `server/routes/admin.ts`:

- `POST /api/admin/mpp/probe-all` — manually trigger mpp-prober
- `POST /api/admin/mpp/index-directory` — manually trigger directory indexer
- `POST /api/admin/mpp/index-tempo` — manually trigger tempo-transaction-indexer

Cookie-based admin auth (existing `server/lib/admin-auth.ts`).

### 7.6 Free-tier redaction

Any agent-level data through these endpoints runs through `redactAgentForPublic` from `server/routes/helpers.ts` — verdict badges only, no scores, no addresses. Aggregate stats (counts, medians) don't need redaction.

## 8. Frontend Surface

Phase 1+2 is primarily data infrastructure. Frontend changes are additive.

**Files:**
- Modified: `client/src/pages/economy.tsx` (add MPP section)
- New: `client/src/pages/mpp.tsx` (dedicated ecosystem page, behind `ENABLE_MPP_UI`)
- Modified: `client/src/App.tsx` (register `/mpp` route)
- Modified: `client/src/lib/content-zones.ts` (new copy keys)

### 8.1 Economy page extension

New section: **"Machine Payments Protocol"** below existing ecosystem cards.
- **MPP Adoption card**: "X services indexed across MPP and x402. Y agents detected on both protocols"
- **Protocol comparison chart**: side-by-side bar/line of x402 vs MPP service counts and volume trends
- **MPP Directory snapshot**: top categories, top providers, pricing model breakdown

### 8.2 New `/mpp` page

- Hero: "MPP Ecosystem Overview" — service count, category distribution, snapshot date
- Directory table: filterable/searchable, columns: name, category, payment methods, price
- Trends chart: service count + category shifts over time
- Tempo chain stats: pathUSD volume, top recipients (verdict-redacted)
- Multi-protocol agents callout: links to agent profiles (redacted)

Uses existing Shadcn components — no new UI primitives.

### 8.3 Content

All copy in `content-zones.ts`:
- `mpp.overview.title`, `mpp.overview.description`
- `mpp.methodology.crossProtocol` — why multi-protocol presence matters
- `economy.mppSection.*` — inline copy on economy page

### 8.4 Out of scope for this phase

- Per-agent trust score breakdown changes (Phase 3)
- Agent profile page MPP badge (Phase 3)
- Methodology page MPP signals (Phase 3)
- Trust report JSON structure changes (Phase 3)

## 9. Observability

Each new task wires into the existing observability stack:

### 9.1 Sentry
Already configured via `trigger.config.ts` with `onFailure` hook — all task failures auto-reported. No additional wiring needed.

### 9.2 Pipeline health
Mirror `server/pipeline-health.ts` circuit breaker pattern for each new task. New `pipeline_health` rows:
- `mpp_directory_indexer`
- `mpp_prober`
- `tempo_transaction_indexer`

Each tracks: consecutive failure count, circuit state (open/closed/half-open), last success timestamp, last error message.

### 9.3 Admin status dashboard
Existing admin status page (`/admin/status-details`) already queries pipeline health. New tasks appear automatically once their health rows are created. No page changes required.

### 9.4 Structured logging
Use existing `logger` pattern from `@trigger.dev/sdk`:
- `info` on run start/end with counts
- `warn` on per-service/per-address errors (continued processing)
- `error` on task-level failures (triggers Sentry via `onFailure`)

## 10. Testing Strategy

Target: ~15-20 new tests, matching existing `__tests__/` patterns.

### Unit tests
- `WWW-Authenticate: Payment` header parser (multiple methods, base64url request decoding, malformed headers)
- MPP directory scraper (fixture HTML, fixture JSON, error cases)
- Category classifier for MPP services
- Tempo log decoder (Transfer + TransferWithMemo events)

### Integration tests
- Directory indexer end-to-end with fixture source (mock `MppDirectorySource`)
- Prober end-to-end with `nock`-mocked HTTP
- Tempo transaction indexer with recorded `eth_getLogs` fixtures

### Storage tests
- `mpp_directory_services` upsert + soft-delete
- `mpp_probes` insert + query
- Cross-protocol multi-agent query

Run via existing `npm test` (Vitest).

## 11. Rollout Plan

1. **Schema migration** (additive only): create 3 new tables via Supabase SQL (schema-owner path per existing conventions). Safe to deploy independently.
2. **Backend tasks deploy** with `ENABLE_MPP_INDEXER=false` in production. Verified green in Trigger.dev staging.
3. **Staging enable**: set flag true in staging env, let 1 week of data accumulate, review for anomalies.
4. **Production enable**: flip `ENABLE_MPP_INDEXER=true`. Watch Sentry for 48 hours.
5. **Frontend deploy** with `ENABLE_MPP_UI=true`.
6. **Flag cleanup**: after 1 month of stability, remove feature flags and associated dead branches.

## 12. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| MPP directory format changes (4 weeks old) | Dual-source interface (API + scrape); defensive parsing; Sentry alerts; fallback to last-known-good snapshot |
| Tempo RPC instability / rate limits | Circuit breaker, exponential backoff, secondary RPC env var, per-run bounded block windows |
| Tempo chain reorgs / correctness | Not a concern: Simplex BFT = deterministic finality, no reorgs |
| Trigger.dev concurrency (Hobby = 50) | 3 new tasks well within limits; monitor via status dashboard |
| No payment volume initially | Expected; directory coverage is v1's primary value. Phase 2 chain indexing provides scaffolding for later adoption |
| PATH USD deployment block unknown | Binary-search bootstrap on first run; cache as env var |
| TransferWithMemo column storage | If existing `agent_transactions` lacks a memo field, add a nullable `memo` column during schema migration |
| Scraping fragility | Emit Sentry events with HTML snippets on parse failure; keep last-successful snapshot to prevent data loss |

## 13. Open Questions

Deferred to implementation discovery, not design blockers:

1. **Exact MPP directory endpoint**: does `mpp.dev` expose JSON anywhere? Investigate first; if yes, use `MppApiSource`. If no, ship `MppScrapeSource` and swap later.
2. **PATH USD deployment block**: resolve via binary search on first run; persist as config constant.
3. **Memo column**: confirm whether to add a `memo` column to `agent_transactions` or store in existing metadata jsonb. Decide during schema migration.
4. **Category classifier divergence**: may need MPP-specific classifier (physical goods, streaming, etc.) distinct from bazaar's x402 classifier. Start by extending, split if drift is significant.

## 14. What I'd Revisit as the System Grows

> **Tracked in [`docs/roadmap-mpp.md`](../../roadmap-mpp.md)** — that document is the source of truth for post-launch iteration. Summary pointers below.

- **Path A decision (2026-04-16):** Methodology v2 ships with MPP **invisible to scoring**. MPP data accumulates in the backend for 4-6 weeks before v3 integration. See roadmap §1.
- **Methodology v3 MPP integration** — add `crossProtocol` signal category + extend Transaction Activity (§3.1 of methodology v2 spec) with MPP volume. See roadmap §3.
- **Directory scraper → formal API:** Swap `MppScrapeSource` for `MppApiSource` when Tempo ships a directory API. Interface already defined — one-line change in factory. Roadmap §6.
- **Unified probe table:** If adding a 3rd payment protocol, refactor `x402_probes` + `mpp_probes` → `agent_payment_probes` with `protocol` column. Roadmap §5.
- **Tempo indexer scaling:** If volume hits 10K+ txs/day, add checkpoint-based resumption (mirror `chain-indexer.ts` 90s checkpoint wait pattern). Bitquery as alternative — roadmap §4.3.
- **Payment method normalization:** Convert `paymentMethods` jsonb to a dimension table as MPP grows. Roadmap §7.
- **Future data sources** (not scoped for launch): Stripe API for merchant-side MPP payments; Tempo block explorer API for rich tx metadata; Bitquery/GraphQL for pre-indexed chain data. See roadmap §4.

## 15. Effort Summary

| Area | New / Modified |
|------|----------------|
| Database | 3 new tables, 0 modified |
| Trigger.dev tasks | 3 new tasks |
| Backend files | 2 new (`server/storage/mpp.ts`, `server/routes/mpp.ts`); 3 modified (`server/routes.ts`, `server/routes/admin.ts`, `shared/chains.ts`) |
| API endpoints | 10 new public + 3 new admin |
| Frontend files | 1 new (`client/src/pages/mpp.tsx`); 3 modified (`economy.tsx`, `App.tsx`, `content-zones.ts`) |
| Tests | ~15-20 new |
| Env vars | 6 new |

Most logic is copy-adapt from existing x402 / bazaar / transaction-indexer code. Hard parts: MPP directory data shape discovery, Tempo RPC quirks, defensive parsing for 4-week-old infrastructure.
