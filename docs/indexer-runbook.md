# TrustAdd Indexer Operational Runbook

This document is the primary reference for operating and troubleshooting the TrustAdd indexing system. It is designed for use under pressure—keep entries concise and actionable.

## 0. Deployment Context

TrustAdd runs on a **Replit Reserved VM** (dedicated small — 1 vCPU / 4 GB RAM). Key operational differences from Autoscale:

- **No SIGTERM mid-session** — the process runs until a deploy. Indexers, probers, and the community feedback scheduler stay alive indefinitely.
- **Cold-starts are rare** — they only occur on a fresh deploy, not on every visitor request. The Neon cold-start window (3–10 min) is encountered once per deploy, not continuously.
- **On Reserved VM:** expect all 5 chains to connect and community feedback to initialize within 2–3 minutes of startup.

---

## 1. Quick Health Check
Run the integrated health check script to get an immediate overview of system status.

```bash
PROD_DATABASE_URL=<url> npx tsx scripts/health-check.ts
```

### Health Check Sections
1. **AGENT INDEX**: Counts, trust score distribution, and discovery lag.
2. **QUALITY TIERS**: Tier breakdown and re-enrichment queue size.
3. **CHAIN STATUS**: Per-chain running state, block progress, and last update age.
4. **TRANSACTION INDEXER**: Volume, unique buyers, and sync staleness.
5. **X402 PROBER**: Total probes and last run timestamp.
6. **COMMUNITY FEEDBACK**: Source and item counts.
7. **STORAGE**: Database size vs. Neon free tier limits (400MB warning).

**Exit Codes:**
- `0`: Healthy or non-critical warnings only.
- `1`: Critical issues detected (Chain down, sync stalled > 2h, etc.).

---

## 2. Failure Mode Matrix

| Alert Type | Symptom | Root Cause | Resolution Steps |
| :--- | :--- | :--- | :--- |
| **Chain Not Running** | `is_running: false` in `indexer_state` or logs show "Start error" | `ENABLE_INDEXER` false; all RPC providers timed out; or **DB "Connection terminated" during `start()`** killing a successful RPC connect. | 1. Check `ENABLE_INDEXER` env var.<br>2. Check deploy logs for RPC vs DB error distinction.<br>3. If "Warning: DB state update failed after RPC connect" appears, the chain IS running — DB state will self-correct.<br>4. If all providers fail: check Alchemy + Ankr fallback reachability. |
| **Chain Stalled** | `updated_at` age > 60min but `is_running: true` | Indexer stuck in a "Poll delayed" loop or waiting on a hung RPC request. | 1. Check logs for "Poll delayed" spam.<br>2. Restart the service to break the loop.<br>3. If recurring, check if `POLL_INTERVAL_MS` is too short for the chain's RPC speed. |
| **High RPC Error Rate** | `indexer_events` filled with `rate_limit` or `timeout` | RPC provider is saturated or degraded. | 1. Check Alchemy dashboard for usage spikes.<br>2. All chains now have 3–4 providers in fallback order; check if even public Ankr RPCs are failing.<br>3. Consider increasing `REQUEST_DELAY_MS` in `server/indexer.ts`. |
| **All Chains Down** | All indexers fail at once with "Connection terminated" | Startup DB connection stampede (Neon cold-start takes 3–10min) or Neon maintenance. | 1. Wait 10–15min — the staggered startup schedule is designed to recover automatically.<br>2. Look for "Warning: DB state update failed" messages (non-fatal, chain is still polling).<br>3. If chains never recover, check `DATABASE_URL` validity and pool max=8. |
| **x402 Prober Stale** | `lastProbeAt` > 25h ago | `ENABLE_PROBER` false or prober crashed without rescheduling. | 1. Verify `ENABLE_PROBER=true` in env.<br>2. Check logs for "Prober disabled" or crash stack traces.<br>3. Restart service to trigger immediate run. |
| **TX Indexer Offline** | `last_synced_at` > 8h ago | `ENABLE_TX_INDEXER` false or Alchemy API key invalid/expired. | 1. Verify `ENABLE_TX_INDEXER=true`.<br>2. Check logs for "Alchemy error" or "Asset transfer failed".<br>3. Verify `API_KEY_ALCHEMY` secret is valid. |
| **BNB/Polygon/Base: `eth_getLogs` -32005** | Logs show `"code": -32005, "message": "limit exceeded"` during backfill | Two possible causes: (1) too many log events in the range, or (2) provider's hard block-range cap exceeded. Alchemy BSC has a ~3,500-block hard cap per `eth_getLogs` call regardless of event count. | Current ranges: BNB=1,000, Polygon=10,000, Base=10,000, set in `shared/chains.ts`. If this recurs for BNB, reduce further (try 500). For other chains, halve the current value and redeploy. |

---

## 3. Diagnostic SQL Queries
All queries are read-only and safe to run in production.

### Chain Sync State
```sql
SELECT chain_id, is_running, last_processed_block, updated_at, 
       (extract(epoch from now() - updated_at)/60)::int as age_mins
FROM indexer_state ORDER BY chain_id;
```

### Recent System Errors (Last 3 Hours)
```sql
SELECT chain_id, event_type, message, created_at 
FROM indexer_events 
WHERE event_type IN ('error', 'timeout', 'rate_limit', 'connection_error')
  AND created_at > now() - interval '3 hours'
ORDER BY created_at DESC LIMIT 20;
```

### Per-Chain 24h Metrics
```sql
SELECT chain_id, 
       SUM(blocks_indexed) as blocks, 
       SUM(cycles_completed) as ok, 
       SUM(cycles_failed) as fail,
       ROUND(AVG(avg_cycle_ms)) as avg_ms
FROM indexer_metrics 
WHERE period_start > now() - interval '24 hours'
GROUP BY chain_id;
```

### Prober Last Run & Stats
```sql
SELECT MAX(probed_at) as last_run, 
       COUNT(*) as total_probed,
       COUNT(payment_address) as found_x402
FROM x402_probes;
```

### Transaction Sync Staleness
```sql
SELECT payment_address, chain_id, last_synced_at,
       (extract(epoch from now() - last_synced_at)/3600)::int as hours_ago
FROM transaction_sync_state 
ORDER BY last_synced_at ASC LIMIT 10;
```

### Newest Discovered Agents
```sql
SELECT name, chain_id, created_at 
FROM agents 
ORDER BY created_at DESC LIMIT 5;
```

### Quality Tier Breakdown
```sql
SELECT COALESCE(quality_tier, 'unclassified') as tier, COUNT(*) 
FROM agents 
GROUP BY 1 ORDER BY 2 DESC;
```

---

## 4. Admin Operations

### Trigger Manual Metadata Re-resolution
If agents are missing names or tags, trigger the re-resolve endpoint (requires `ADMIN_SECRET`).
```bash
curl -X POST https://<app>/api/admin/re-resolve \
  -H "x-admin-secret: <your_secret>"
```

### Manually Re-classify Agents
If many agents are 'unclassified', run the classification script.
```bash
PROD_DATABASE_URL=<url> npx tsx scripts/classify-agents.ts
```

### Database Schema Migration
Push local schema changes to production.
```bash
DATABASE_URL=$PROD_DATABASE_URL npx drizzle-kit push
```
Note: `drizzle.config.ts` reads `DATABASE_URL`, not `PROD_DATABASE_URL` — always set the prefix.

---

## 5. Critical Environment Variables

| Variable | Required | Purpose | Failure Symptom |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | Primary Neon DB connection | App fails to start, "Connection terminated" |
| `ENABLE_INDEXER` | No | Enables blockchain indexing | No new agents discovered |
| `ENABLE_RERESOLVE` | No | Enables agent metadata re-resolution | Agent names/descriptions go stale |
| `ENABLE_PROBER` | No | Enables x402 HTTP probing | Agent payment addresses missing |
| `ENABLE_TX_INDEXER` | No | Enables Alchemy TX indexing | No volume/transaction data |
| `API_KEY_ALCHEMY` | Yes* | Primary RPC for all chains + TX Indexer | "All N RPC providers failed" / "Alchemy error" in logs |
| `API_KEY_INFURA` | No | Keyed fallback RPC (ETH, Polygon, Base, Arb) | Chains fall back to public Ankr/official RPCs |
| `ADMIN_SECRET` | Yes | Protects `/api/admin/*` | 401 Unauthorized on admin routes |

*\*Required if `ENABLE_TX_INDEXER=true` or `ENABLE_INDEXER=true` (Alchemy is the primary RPC for all 5 chains).*
