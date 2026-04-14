# TrustAdd Indexer Architecture

This document serves as the canonical technical reference for the TrustAdd indexing system. It describes the four core services, their lifecycles, error recovery strategies, and telemetry.

## 1. System Overview

TrustAdd's indexing engine is a suite of four independent but coordinated services that synchronize data from multiple blockchains and external APIs into a shared PostgreSQL (Supabase) database.

### 1.1 Deployment Target

TrustAdd runs on two separate runtimes:

**API + Frontend: Vercel Serverless**
- React SPA served as static files from `dist/public/`
- Express API wrapped in a single catch-all serverless function (`api/[...path].ts`)
- Stateless — no in-process indexers, no background timers
- Cold starts are handled by lazy DB initialization (Proxy pattern in `server/db.ts`)

**Background Jobs: Trigger.dev**
- 10 scheduled/on-demand tasks in `trigger/` directory
- Blockchain indexer, transaction indexer, x402 prober, community feedback, score recalculation, watchdog, alerts, bazaar indexer
- Tasks run in isolated containers with their own DB connections
- Cron schedules managed via Trigger.dev dashboard

**Local Development: `server/index.ts`**
- In-process indexers, probers, and community feedback scheduler run alongside the Express API
- Vite HMR for frontend development
- Uses `setTimeout` self-scheduling for background services
- Startup staggering (below) applies only to local dev mode

### 1.2 Startup Timeline (Local Dev Only)

In local development (`npm run dev`), services stagger their initial execution to avoid database connection stampedes:

```text
T+0s:   Blockchain Indexer chains start (30s apart: ETH 0s, BNB 30s, Polygon 60s, Base 90s, Arb 120s)
T+5m:   Metadata re-resolution begins (ETH 5m, BNB 6m, Polygon 7m, Base 8m, Arb 9m)
T+7m:   x402 Prober (first run)
T+10m:  Transaction Indexer (first run)
T+15m+: Community Feedback (first run; retries every 5min if DB is not yet warm)
```

In production, each service runs as a separate Trigger.dev task with its own cron schedule. Staggering is not needed because tasks execute independently.

> **Supabase connection pooling:** The production database uses Supabase's transaction-mode pooler (port 6543) with `max: 2` connections. The DB pool in `server/db.ts` uses lazy initialization (Proxy pattern) to avoid `DATABASE_URL` checks at import time — this is required for Trigger.dev's build container to index task files without a live database.

### 1.3 Environment Variables

| Variable | Purpose | Default / Example |
|----------|---------|-------------------|
| `ENABLE_INDEXER` | Global toggle for blockchain indexing | `true` |
| `ENABLE_RERESOLVE` | Global toggle for agent metadata re-resolution | `true` |
| `ENABLE_PROBER` | Global toggle for x402 endpoint probing | `true` |
| `ENABLE_TX_INDEXER` | Global toggle for Alchemy transaction syncing | `true` |
| `API_KEY_ALCHEMY` | Required for Transaction Indexer and primary RPC on all chains | `(your-key)` |
| `API_KEY_INFURA` | Keyed fallback RPC for ETH, Polygon, Base, Arb | `(your-key)` |
| `DATABASE_URL` | Neon/PostgreSQL connection string | `postgres://...` |
| `PROD_DATABASE_URL` | Production DB (used by sync/health scripts) | `postgres://...` |

---

## 2. Blockchain Indexer

The core system responsible for discovering ERC-8004 agents and tracking metadata updates.

### 2.1 Poll Lifecycle

Each chain runs an independent poll loop (`ERC8004Indexer` class):

1.  **Check State**: Read `lastProcessedBlock` from `indexer_state`.
2.  **Determine Range**: Get `currentBlock`.
    *   If `currentBlock - lastProcessedBlock > 2,000`: **Backfill Mode**.
    *   Else: **Live Mode**.
3.  **Process Blocks**: Fetch `Transfer` and `AgentURISet` events using `eth_getLogs`.
    *   **Backfill**: per-chain chunk size (see §2.3), 30s RPC timeout.
    *   **Live**: 2,000 block chunks, 15s RPC timeout.
4.  **Resolve Metadata**: For new agents, fetch JSON from `agentURI`. Supports `http`, `https`, `ipfs://`, and `data:` URIs.
5.  **Update DB**: Atomically create/update agents and log `agent_metadata_events`.
6.  **Schedule**: Set `setTimeout` for next cycle (60s + jitter).

### 2.2 Error Recovery Ladder

The indexer employs a multi-stage recovery strategy to handle RPC instability:

1.  **Multi-Provider Fallback**: On any RPC call failure, the indexer immediately retries across all configured fallback providers in order (primary → fallback → fallback-2 → ...) before escalating.
2.  **Retry**: Immediate retry on transient failures (up to 2 consecutive errors in a running cycle).
3.  **Backoff**: After 2 failures, switch to exponential backoff (starting at 60s, max 10min).
4.  **Provider Recycle**: After 3 consecutive timeouts, destroy and recreate all `ethers.JsonRpcProvider` instances to clear stale TCP connections.
5.  **Exhaustion**: After 5 failed start attempts, wait 15 minutes before restarting the ladder.

> **DB Isolation in `start()`**: Both DB update calls inside `start()` are wrapped in try-catch. A cold Neon DB returning "Connection terminated" will not abort a chain that has successfully connected to an RPC endpoint — the chain logs a warning and continues polling. The DB state self-corrects within the next poll cycle.

### 2.3 Constants & Rationale

| Constant | Value | Why? |
|----------|-------|------|
| `POLL_INTERVAL_MS` | 60,000 | Balances data freshness with RPC cost. |
| `POLL_DELAYED_RETRY` | 30,000 | Prevents log spam when a backfill cycle exceeds the poll interval. |
| `CHAIN_START_STAGGER` | 30,000 | Prevents DB connection spikes on application startup. |
| `BACKFILL_BLOCK_RANGE` | 50,000 | Default `eth_getLogs` chunk size. Per-chain overrides apply (see table below). |
| `RPC_TIMEOUT_BACKFILL` | 30,000 | Allows more time for heavy history queries. |

#### Per-Chain Backfill Block Ranges

Each chain's `backfillBlockRange` is configured in `shared/chains.ts`. Chains with faster block times produce more log entries per chunk and require smaller ranges to stay under Alchemy's 10,000-log response limit:

| Chain | Block Time | Backfill Range | Rationale |
|---|---|---|---|
| Ethereum (1) | ~12s | 50,000 (default) | Low event density; 50k blocks ≈ 7 days — well under limit. |
| BNB Chain (56) | ~3s | **1,000** | Alchemy BSC has a hard `eth_getLogs` block-range cap of ~3,500 blocks per call; 5,000 still triggered `-32005`. 1,000 is safely below all provider limits (Alchemy: 3,500, official BSC nodes: 5,000). |
| Polygon (137) | ~2s | **10,000** | Fast block time; conservative range to avoid limit. Alchemy Polygon allows larger ranges. |
| Base (8453) | ~2s | **10,000** | Fast block time; conservative range to avoid limit. |
| Arbitrum (42161) | ~0.25s | 50,000 (default) | Low agent event density despite fast blocks; no limit issues observed. |

The chosen chunk size is logged at the start of every backfill cycle: e.g., `chunk=1,000` for BNB, `chunk=10,000` for Polygon/Base.

---

## 3. x402 Prober

The Prober scans agent endpoints to identify x402 (Payment Required) capabilities.

### 3.1 Operations

*   **SSRF Protection**: Blocklist for `localhost`, private IPs (10.x, 192.x), and cloud metadata services.
*   **Concurrency**: Set to **2**. Low concurrency is critical to prevent database pool exhaustion during long HTTP wait windows.
*   **Self-Scheduling**: Uses `setTimeout` self-scheduling. If a cycle fails, it retries in 1 hour instead of waiting the full 24h interval.
*   **Stale Threshold**: Re-probes endpoints every 24 hours.

### 3.2 Detection Logic

The prober issues a GET request with a `TrustAdd/1.0` User-Agent. It looks for:
1.  **HTTP 402 Status Code**.
2.  **Payment Headers**: `x-payment-address`, `x-payment-network`, etc.
3.  **JSON Body**: Fields like `paymentAddress`, `accepts`, or `x402`.

---

## 4. Transaction Indexer

Synchronizes payment transactions for identified x402 agents using Alchemy's `getAssetTransfers` API.

### 4.1 Sync Strategy

*   **Scope**: Tracks ETH, USDC, USDT, DAI, and WETH.
*   **Method**: Incremental sync starting from `lastSyncedBlock` per address.
*   **Circuit Breaker**: If a specific chain hits 5 consecutive Alchemy errors, it is skipped for the remainder of the cycle.
*   **Self-Scheduling**: Retries failed cycles in 30 minutes; successful cycles run every 6 hours.

---

## 5. Community Feedback

Aggregates off-chain reputation data from social and developer platforms.

*   **Adapter Pattern**: Extensible architecture (GitHub, Farcaster, etc.).
*   **Graceful Failure**: If one adapter fails, others continue. Failures are logged but do not crash the scheduler.
*   **Normalization**: All feedback (stars, follows, casts) is normalized into a unified schema for trust score calculation.

---

## 6. Telemetry & Visibility

The system flushes telemetry to the DB every 60 minutes.

### 6.1 Database Tables

*   **`indexer_state`**: Connectivity and sync progress per chain.
*   **`indexer_events`**: Categorized log (cycle_complete, error, rate_limit, etc.).
*   **`indexer_metrics`**: Aggregate stats (blocks/hr, error rates, discovery counts).
*   **`x402_probes`**: Raw results of every endpoint probe.
*   **`tx_sync_state`**: Per-address tracking for the Transaction Indexer.

---

## 7. RPC & DB Strategy

### 7.1 RPC Fallback

Every indexer maintains a primary provider and an ordered list of fallback providers. `getRpcUrls()` in `shared/chains.ts` returns `{ primary, fallbacks[] }`. On any failure, `rpcWithFallback()` iterates through all fallbacks in sequence before throwing. Providers are recycled (all of them) after 3 consecutive timeouts to clear "zombie" sockets.

| Chain | Provider Order |
|---|---|
| Ethereum (1) | Alchemy → Infura |
| BNB Chain (56) | Alchemy → Ankr → `bsc-dataseed.binance.org` → `bsc-dataseed1.defibit.io` |
| Polygon (137) | Alchemy → Ankr → Infura → PublicNode (`polygon-bor-rpc.publicnode.com`) → dRPC (`polygon.drpc.org`) |
| Base (8453) | Alchemy → `mainnet.base.org` → Ankr → Infura |
| Arbitrum (42161) | Alchemy → Ankr → Infura → `arb1.arbitrum.io/rpc` |

Public RPCs (Ankr, official chain endpoints) require no API key and act as resilient fallbacks when Alchemy or Infura are unavailable.

### 7.2 DB Pool Configuration

The `pg.Pool` (via `server/db.ts`) is configured for Supabase's transaction-mode connection pooler:

*   **`max: 2`**: Sized for Vercel serverless (each function instance gets its own pool; low max prevents pooler exhaustion).
*   **`statement_timeout: 30s`**: Prevents long-running queries from blocking the pooler.
*   **`idleTimeoutMillis: 3000`**: Returns connections quickly on serverless (short-lived instances).

In local development (`npm run dev`), the same pool serves both the API and in-process indexers. The low `max` value means indexer queries and API queries share a small pool — this is acceptable for development but would need to be increased for a persistent VM deployment.

> **Important:** Both `pool` and `db` in `server/db.ts` are lazy Proxies. This prevents `DATABASE_URL` validation at import time, which is required for Trigger.dev's build container to index task files without a live database connection.
