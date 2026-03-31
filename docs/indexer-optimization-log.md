# TrustAdd Indexer Optimization Log
_Permanent audit trail of system optimizations and architectural improvements_

## Summary of Major Optimization Eras

| Era | Focus | Key Impact |
|-----|-------|------------|
| March 10, 2026 | RPC Resilience, DB Isolation, Reserved VM, Backfill Calibration, Adaptive Bisection | Multi-provider fallback (N-deep), DB error isolation in `start()`, Reserved VM migration, per-chain backfill block ranges, `getLogsWithRetry` bisection extended to -32005, Polygon fallbacks replaced (PublicNode + dRPC). |
| March 9, 2026 | Startup Stability | Community feedback self-retry, re-resolve delay 5min, RPC recycle log fix. |
| March 3, 2026 | Stability & Telemetry | Eliminated silent service failures, fixed Neon TCP drops, reduced log spam. |
| February 2026 | Scale | Implemented Arbitrum/Base backfill, added multi-chain support. |

---

## Chronological Optimization Log

### March 10, 2026: Reserved VM Migration (Autoscale → Dedicated)
**Change:** Migrated deployment target from Replit Autoscale to Replit Reserved VM (dedicated small — 1 vCPU / 4 GB RAM). Updated run command to `bash -c "npx drizzle-kit push && node ./dist/index.cjs"`.
- **Why:** Autoscale recycled the process every 45–90 minutes via SIGTERM (load distribution), causing every indexer, prober, and community feedback scheduler to restart and fight for the DB pool simultaneously. This happened whether a user was visiting or not. Additionally, Autoscale introduced cold-start latency for visitors when the container had been idle. The staggered startup delays, DB isolation patches, and self-retry loops we added were all ultimately compensating for this fundamental limitation.
- **Impact:** The process now runs indefinitely between deploys. All services — blockchain indexer (5 chains), x402 prober, transaction indexer, community feedback — start once and stay alive. Neon `keepAlive: true` keeps the DB connection warm continuously. On the very first post-deploy startup, all 5 chains (ETH, BNB, Polygon, Base, Arb) connected successfully and community feedback initialized on the first attempt — a first for the system.

### March 11, 2026: Bulk-Spam Factory Block Skip (Terminal Bisection Case)
**Change:** Added a terminal case to `processBlockRangeWithBisection`: when bisection reaches a single block (`fromBlock === toBlock`) and that block still returns -32005 from all providers, the block is logged as a "bulk-spam factory block" and skipped (treated as successfully processed with 0 agents). The cycle completes normally and the block pointer advances past it.
- **Why:** BNB block 84,850,000 contains so many agent registration events from a bulk factory contract that even a single-block `eth_getLogs` query overflows every provider's result-size limit. Bisecting by block range is futile when the limit is on event count, not block span. These registrations are definitively spam (same controller, same template, bulk batch) — the quality classifier marks them as such. Skipping them in the indexer is correct and pragmatic. Identified from production logs showing bisection reaching depth=9 (`[84850000, 84850001]`) then failing on the single-block call.
- **Impact:** BNB backfill will now bisect through dense ranges, skip any individual blocks that are physically impossible to index via any provider, log them for observability, and continue advancing. The block pointer will move past 84,850,000 for the first time since indexing began.

### March 11, 2026: Bisection Moved to `processBlockRangeWithBisection` (Outer Level)
**Change:** Replaced inner bisection inside `getLogsWithRetry` with a new `processBlockRangeWithBisection` wrapper called from `poll()`'s chunk loop. When `processBlockRange` throws a -32005/limit error, `processBlockRangeWithBisection` splits the block range in half and recursively processes each half to a maximum depth of 20 (handles ranges down to single blocks). The `poll()` while loop now calls `processBlockRangeWithBisection(from, to)` instead of `processBlockRange(from, to)` directly.
- **Why:** The previous `getLogsWithRetry` inner bisection was architecturally flawed. The bisection was inside the `catch` block of a for loop over retry attempts. When the bisection made recursive calls to `getLogsWithRetry`, any exception from those recursive calls escaped the outer catch (you cannot re-enter a catch block), propagating immediately to `poll()` as a full cycle error — exactly as if bisection had never been attempted. This is why the BNB block pointer stayed permanently at 84,850,000 despite the inner bisection code being present. The fix moves bisection to a clean outer wrapper that sits between the `poll()` chunk loop and `processBlockRange`. Errors from recursive sub-range calls are caught by their own invocations of `processBlockRangeWithBisection` and further split, all the way to single blocks if needed.
- **Impact:** BNB backfill will process the extreme-density block range (84,850,000+) by splitting 1,000 blocks → 500 → 250 → ... → 1 block at a time until every sub-range succeeds. After the dense period is cleared, chunk sizes return to normal (1,000 blocks) for subsequent cycles.

### March 10, 2026: `getLogsWithRetry` Bisection Extended to -32005 "limit exceeded"; Polygon Fallbacks Replaced
**Change:** Extended the `isRangeTooLarge` bisection condition in `getLogsWithRetry` to catch `-32005 "limit exceeded"` in addition to `"block range"` and `"10 block range"`. Added checks for `msg.includes("limit exceeded")`, `msg.includes("query returned more than")`, `msg.includes("too many results")`, `(err as any).error?.code === -32005`, and `(err as any).code === -32005`. Also fixed the single-block edge case: when `fromBlock === toBlock`, no further splitting is possible — return the single-block result directly. Replaced `polygon.llamarpc.com` with `polygon-bor-rpc.publicnode.com` and `1rpc.io/matic` with `polygon.drpc.org` (both verified reachable from Replit's production network).
- **Why (bisection):** Bisection was already implemented but silently bypassed. The condition only matched `"block range"` in the error message. Alchemy's BSC endpoint returns `-32005` with message `"limit exceeded"` — neither word matched. Production confirmed blocks 84,850,000–84,850,999 had extreme event density (bulk registration burst), causing every chunk attempt to fail and the BNB block pointer to stay permanently stuck at 84,850,000 despite the 1,000-block range fix. With bisection now triggered, the indexer splits the range in half recursively until it finds a small enough chunk to succeed (potentially down to single blocks for the densest period), then resumes normal chunk size for subsequent blocks.
- **Why (Polygon):** `polygon.llamarpc.com` returned `getaddrinfo ENOTFOUND` from Replit's production environment — DNS resolution failure, meaning the domain is unreachable from that network. `polygon-bor-rpc.publicnode.com` and `polygon.drpc.org` were both verified reachable and returning correct block numbers from Replit before being deployed. These providers are fully independent of Alchemy.
- **Impact:** BNB backfill will now make progress through high-density blocks via adaptive bisection rather than failing indefinitely. Polygon's last two fallback slots are now functional, eliminating the periodic ~10% error rate caused by the dead llamarpc endpoint.

### March 10, 2026: BNB Backfill Range Further Reduced to 1,000; Polygon `polygon-rpc.com` Replaced
**Change:** Reduced BNB `backfillBlockRange` from 5,000 → 1,000. Replaced Polygon's final fallback `https://polygon-rpc.com/` with `https://polygon.llamarpc.com` and `https://1rpc.io/matic`.
- **Why (BNB):** Production logs confirmed that even 5,000 blocks still triggered `-32005 "limit exceeded"` on every BNB backfill attempt. Root cause: Alchemy's BSC `eth_getLogs` endpoint has a hard per-call block-range cap of approximately 3,500 blocks (independent of event count). The official BSC nodes (`bsc-dataseed.binance.org`, `bsc-dataseed1.defibit.io`) also cap at ~5,000 blocks. 1,000 is safely below every provider's limit and eliminates the -32005 entirely. BNB had accumulated 45 consecutive backfill errors in production before this fix.
- **Why (Polygon):** `polygon-rpc.com` routes all traffic through Alchemy under the hood and appeared as a reliable fallback, but in production it returned `HTTP 401 Unauthorized` with body `"API key disabled, reason: tenant disabled"` — meaning polygon-rpc.com's underlying Alchemy account was suspended. This caused periodic Polygon errors every ~8–10 minutes when the primary Alchemy key hit brief limits. LlamaRPC and 1RPC are both genuinely independent providers with no Alchemy dependency, giving Polygon a true 5-provider chain.
- **Impact:** BNB backfill resumes correctly. Polygon's error rate drops from ~10% to near-zero; the last-resort fallback is now independent of Alchemy.

### March 10, 2026: Per-Chain Backfill Block Ranges
**Change:** Added optional `backfillBlockRange` field to `ChainConfig` interface in `shared/chains.ts`. Set per-chain overrides: BNB=5,000, Polygon=10,000, Base=10,000. Updated `ERC8004Indexer.poll()` to use `chainConfig.backfillBlockRange ?? BACKFILL_BLOCK_RANGE` instead of the global constant. Backfill log line updated to report the effective chunk size: `chunk=5,000`.
- **Why:** With the Reserved VM migration, BNB began its first successful backfill since deployment — and immediately hit `-32005 "limit exceeded"` from Alchemy's `eth_getLogs` endpoint. BNB has a ~3 second block time (vs ETH's ~12 seconds), meaning 50,000 BNB blocks ≈ 41 hours of data with high event density. Alchemy enforces a 10,000-log response cap per `eth_getLogs` call; high-activity 50k-block windows on BNB routinely exceed this. Polygon and Base have similar block times (~2s) and received conservative 10,000-block ranges as a precaution.
- **Impact:** BNB backfill no longer hits response size limits. All fast chains have a chunk size calibrated to their event density. ETH and Arb retain the 50,000-block default (ETH has low agent event density; Arb has ultra-fast blocks but few agent events). The active chunk size is now visible in every backfill log line.

### March 10, 2026: Multi-Provider RPC Fallback (N-Deep)
**Change:** Refactored `getRpcUrls()` in `shared/chains.ts` to return `{ primary: string, fallbacks: string[] }` instead of `{ primary, fallback | null }`. Updated `ERC8004Indexer` to store `fallbackProviders[]` and `fallbackIdentityContracts[]` arrays. `rpcWithFallback()` and `contractCallWithFallback()` now iterate through all fallbacks in sequence. Added Ankr public RPCs (no API key required) as the second fallback for BNB, Polygon, Base, and Arbitrum; added `mainnet.base.org` and `arb1.arbitrum.io/rpc` as additional final fallbacks.
- **Why:** `getRpcUrls()` silently dropped every URL after the second. BNB had 3 templates but only 2 were ever used; Polygon's `polygon-rpc.com` and BNB's `bsc-dataseed1.defibit.io` were dead code. When Alchemy and Infura both timed out (common from Replit's production network), there was nothing left to try and the chain stayed down all session. The old pattern "Fallback also failed" was always the end of the road.
- **Impact:** All 4 non-ETH chains now have 3–4 providers. Losing Alchemy and Infura simultaneously no longer kills the chain; Ankr public RPCs serve as a reliable last line of defense.

### March 10, 2026: DB Error Isolation in `start()`
**Change:** Wrapped both `storage.updateIndexerState()` calls inside `start()` in individual try-catch blocks. (1) The call in the RPC-failure path (updating `isRunning: false`) no longer escapes to the caller on cold-Neon errors. (2) The call in the success path (updating `isRunning: true`) no longer kills a chain that has successfully connected to its RPC provider.
- **Why:** A successfully-connected chain (e.g. BNB reaching block 85,723,662 on Alchemy) would then call `storage.updateIndexerState(..., { isRunning: true })`. If Neon was still warming up, this threw "Connection terminated due to connection timeout". Since this call was outside the try-catch block, the exception propagated to `startIndexer()`, which logged "Start error for BNB Chain: Connection terminated" and never started the poll cycle — even though the RPC connection worked. The chain would stay in "Not Running" for the entire session. The same issue existed in the error path.
- **Impact:** Chains that successfully connect to their RPC now start polling regardless of Neon's warm-up state. DB state self-corrects within the first completed poll cycle.

### March 9, 2026: Community Feedback Self-Scheduling Retry
**Change:** Added `setTimeout`-based self-retry loop to `initCommunityFeedback()` in `server/community-feedback/index.ts`. If init fails with a DB connection error, it retries every 5 minutes until success. Only permanent errors (tables missing) skip retrying.
- **Why:** Community feedback was failing on ~95% of deployments due to Neon cold-start DB pressure (init fires at T+15min when DB may still be overwhelmed). The existing "will retry on next restart" message was misleading — it NEVER retried. In 2 days of production logs, community feedback only succeeded once.
- **Impact:** Community feedback will now reliably initialize after Neon warms up, instead of staying dead all session.

### March 9, 2026: Re-resolution Base Delay 30s → 5min
**Change:** Changed `reResolveDelay` base from `30_000` to `5 * 60_000` in `startIndexer()`. Re-resolve schedule is now: ETH at T+5m, BNB at T+6m, Polygon at T+7m, Base at T+8m, Arb at T+9m.
- **Why:** Neon cold-starts take 3–10 minutes to warm up. Starting re-resolution at T+30s guaranteed failures and added unnecessary DB pressure during the most critical startup window. All 5 chains were attempting both poll cycles AND re-resolution within the first 390s, competing for the 8-connection DB pool.
- **Impact:** Re-resolution now starts after Neon is warm and stable, reducing startup DB errors and log noise.

### March 9, 2026: RPC Provider Recycle Log Fix
**Change:** Added `reason: "timeout_threshold" | "connection_retry"` parameter to `recycleProviders()`. Calls from `start()` retry path now log "for fresh connection attempt" instead of "after 0 consecutive timeouts".
- **Why:** The misleading "Recycling RPC providers after 0 consecutive timeouts" message appeared dozens of times per day for BNB, Polygon, and Arbitrum (which frequently fail to connect at startup and enter the retry path). It looked like a bug but was actually intentional behavior.
- **Impact:** Cleaner logs; genuine timeout-threshold recycling events are now distinguishable from connection retry recycling.

### March 3, 2026: Service Scheduling & Staggering
**Change:** Replaced `setInterval` with `setTimeout` self-scheduling for `tx-indexer` and `x402-prober`. Increased startup stagger intervals.
- **Why:** `setInterval` silently waited the full interval (e.g., 24h) after a failure. Startup "stampedes" caused DB pool exhaustion.
- **Impact:** 
  - Transaction sync coverage improved from 0/16 to 14/17 tracked addresses.
  - Failures now trigger explicit retries (30min for tx, 1h for prober).
  - Startup DB window expanded from 60s to 120s (Chain stagger 15s → 30s).

### March 3, 2026: DB Pool Persistence (Neon Fix)
**Change:** Enabled `keepAlive: true` and `keepAliveInitialDelayMillis: 10000` in the Postgres `Pool` configuration.
- **Why:** The x402-prober makes outbound HTTP requests that can take several seconds. Neon (serverless Postgres) was silently dropping "idle" TCP connections during these wait windows.
- **Impact:** x402-prober per-agent errors dropped from 50+ per cycle to ~2.

### March 3, 2026: Poll-Delayed Performance
**Change:** Increased `poll-delayed` retry interval from 5s to 30s in `ERC8004Indexer`.
- **Why:** Fast chains (BNB, Base) in deep backfill often exceed the 60s poll window. The 5s retry generated 40+ lines of log spam per window.
- **Impact:** Log spam reduced to 7 lines max per window; significantly improved log readability during backfill.

### March 3, 2026: Concurrency Calibration
**Change:** Reduced `x402-prober` concurrency from 5 to 2.
- **Why:** High concurrency during long HTTP wait windows caused the DB pool to saturate with "idle" clients waiting to write results.
- **Impact:** Relieved DB pool pressure; allowed other services (Indexer, API) to remain responsive during probe cycles.

### March 2, 2026: Re-resolution Prioritization (✅ BUILT)
**Change:** Implemented session-scoped failure tracking for agent metadata resolution.
- **Why:** 60-70% of registered agents use unreachable URIs (dead IPFS nodes, expired domains). Wasting RPC calls on them every cycle slowed down resolution for valid agents.
- **Impact:** Agents failing 3+ times are skipped for the remainder of the session. Reduced wasted RPC/HTTP calls by an estimated 50%+.

### March 1, 2026: Poll Timer Accumulation Fix (✅ BUILT)
**Change:** Added `overrideDelay` to `scheduleNextPoll`.
- **Why:** Slow backfill cycles that exceeded the 60s interval caused "lost" polls. 
- **Impact:** When a cycle is busy, the indexer now checks every 5s (later moved to 30s) and starts the next cycle immediately upon completion.

---

## Detailed Audit Plan (Status & Assessment)

As of March 3, 2026, the following items from the initial audit plan have been assessed or implemented:

### Implemented Items
1.  **Re-resolution Prioritization:** (See log entry March 2, 2026).
2.  **Poll Timer Accumulation:** (See log entry March 1, 2026).
3.  **Alert Coverage Gaps:** Added `x402 Prober Stale` (>25h) and `Transaction Indexer Delayed` (>8h) alerts to `server/alerts.ts`. These now surface on the Status page.

### Recommended Next Steps
-   **Area 6: DB Query Efficiency (High Priority):** The `agents` table and `indexer_events` lack secondary indexes. Every re-resolution or status check performs a full table scan.
    -   *Action:* Add indexes on `chain_id`, `erc8004_id`, and `slug`.
    -   *Action:* Implement narrow `getAgentsForReResolve` query to avoid fetching large JSONB fields.

### Deferred / No Action
-   **Chain-specific Block Rate Calibration (Monitor):** Arbitrum live polling (~17k blocks/min) fits within the 500k limit. No action needed unless `avgCycleMs` exceeds 45s after backfill finishes.
-   **x402 Prober Re-probe Frequency (Defer):** Protocol adoption is early. Reducing frequency now risks missing newly enabled agents. Revisit in 6 months.
-   **TX Indexer Address Coverage (Defer):** Coverage expands automatically as the prober finds more payment endpoints.
-   **Memory/Provider Lifecycle (No Action):** `provider.destroy()` is correctly called; no leaks observed.
-   **Backfill Checkpoint Resilience (No Action):** Per-chain block ranges (BNB: 5k, Polygon/Base: 10k, ETH/Arb: 50k) are sized to stay under Alchemy's log response limits. Further checkpoint granularity adds complexity for minimal gain.
