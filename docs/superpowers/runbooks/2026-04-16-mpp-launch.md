# MPP Launch Runbook

**Date:** 2026-04-16
**Target branch:** main (via PR from feat/mpp-integration)
**Owner:** <operator>
**Est. time:** 45 min active + 24–48 h observation
**Rollback:** Every step is individually reversible via the same flag flip in reverse.

## Preconditions

- [ ] PR from `feat/mpp-integration` merged to `main`
- [ ] `npm test` green on `main` (279+ passing)
- [ ] Supabase migration `0002_mpp_integration.sql` already applied (verify with `\d mpp_directory_services` in Supabase SQL editor)
- [ ] Git author is `All The New <admin@allthenew.com>`

## Step 1 — Set Vercel environment variables (flags still OFF)

```bash
# From the project root (.vercel/project.json must exist)
printf 'https://rpc.tempo.xyz' | npx vercel env add TEMPO_RPC_URL production
# Optional — skip if no fallback RPC is provisioned
# printf 'https://<quicknode-or-chainstack-endpoint>' | npx vercel env add TEMPO_RPC_URL_FALLBACK production
printf 'auto' | npx vercel env add MPP_DIRECTORY_SOURCE production
# Leave these two OFF for now
# ENABLE_MPP_UI and VITE_ENABLE_MPP_UI remain UNSET (or set to 'false')
```

Verify:

```bash
npx vercel env ls production | grep -E 'TEMPO_RPC_URL|MPP_DIRECTORY_SOURCE|ENABLE_MPP_UI'
```

Redeploy so env vars take effect:

```bash
npx vercel deploy --prod
```

## Step 2 — Set Trigger.dev environment variables (flag still OFF)

Via Trigger.dev dashboard: **Settings → Environment Variables → Production**. Add:

| Var | Value | Notes |
|---|---|---|
| `ENABLE_MPP_INDEXER` | `false` | Keep OFF until Step 5 |
| `TEMPO_RPC_URL` | `https://rpc.tempo.xyz` | |
| `TEMPO_RPC_URL_FALLBACK` | (optional) | QuickNode/Chainstack |
| `MPP_DIRECTORY_SOURCE` | `auto` | |
| `TEMPO_PATHUSD_DEPLOYMENT_BLOCK` | `5172409` | Resolved 2026-04-16 via RPC binary-search of pathUSD Transfer logs; first Transfer at block 5172409 in tx 0xcb7a3eb8ac7167a831... |

`TEMPO_TRANSFER_WITH_MEMO_TOPIC` is intentionally left unset for launch — memo decoding is deferred (decision recorded in plan Task 3). Re-deploy is not needed here because Trigger.dev reads env vars at run time; the next deploy will consume them.

## Step 3 — Push Trigger.dev code (flag still OFF)

GitHub Actions auto-deploys on push to paths `trigger/`, `server/`, `shared/`, `package.json`, `package-lock.json`, `.npmrc`. Confirm the deploy workflow ran green in the Actions tab after the merge to main.

Verify in Trigger.dev dashboard that the three tasks appear in the task list:
- `mpp-prober`
- `mpp-directory-indexer`
- `tempo-transaction-indexer`

Their runs list should be empty or show `skipped: true` (the early return when `ENABLE_MPP_INDEXER !== "true"`).

## Step 4 — Smoke-test RPC reachability and admin endpoints

Confirm Tempo RPC is reachable from your dev machine (result captured 2026-04-16: HTTP 200, ~130ms round-trip, `result: "0x1079"` = chain ID 4217):

```bash
curl -s -o /dev/null -w 'HTTP %{http_code} | %{time_total}s\n' \
  -X POST https://rpc.tempo.xyz \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
# Expected: HTTP 200 | < 2s
```

For the server-side smoke test, temporarily enable `ENABLE_MPP_UI=true` in Vercel, redeploy, then (with an admin session cookie set — see `/admin/login`):

```bash
curl -X POST https://trustadd.com/api/admin/mpp/index-tempo \
  -H "Cookie: <admin-session-cookie>"
# Expected: {"message":"Tempo sync started","status":"running"} — the task is fire-and-forget
```

Check Trigger.dev run logs for the corresponding one-shot run. If RPC fails, set `TEMPO_RPC_URL_FALLBACK` in Vercel AND Trigger.dev before proceeding.

Then flip `ENABLE_MPP_UI=false` back OFF and redeploy (public should still not see the page).

## Step 5 — Enable the indexer and accumulate 24–48 h of data

In Trigger.dev dashboard, change `ENABLE_MPP_INDEXER` to `true`. The next scheduled runs will execute:
- 03:30 UTC daily — `mpp-prober`
- 04:30 UTC daily — `mpp-directory-indexer`
- every 6 h — `tempo-transaction-indexer`

Watch Sentry for new errors from these tasks over the next 24–48 h. Check `/admin/status` for SLA compliance.

## Step 6 — Review data directly in Supabase

Expected population after one full day:

```sql
SELECT count(*), min(first_seen_at), max(last_seen_at) FROM mpp_directory_services;
SELECT snapshot_date, total_services, active_services FROM mpp_directory_snapshots ORDER BY snapshot_date DESC LIMIT 5;
SELECT count(*), count(distinct agent_id) FROM mpp_probes;
SELECT count(*), sum(amount_usd) FROM agent_transactions WHERE chain_id = 4217;
```

If directory rows are absent, inspect Sentry and Trigger.dev logs for the directory-indexer task. A zero-row result is expected if the directory is still empty or format has drifted; Sentry should surface the parse error with an HTML snippet.

## Step 7 — Turn server-side `ENABLE_MPP_UI` on (API live, page still hidden)

```bash
printf 'true' | npx vercel env add ENABLE_MPP_UI production
npx vercel deploy --prod
```

At this point `/api/mpp/*` returns real data (not 404). `/mpp` still renders as an empty page to end users because `VITE_ENABLE_MPP_UI` is still false (the Vite build embeds that flag at compile time).

Verify:

```bash
curl -s https://trustadd.com/api/mpp/directory/stats | jq .
# Expected: a populated JSON object with non-zero totalServices after the indexer ran
```

## Step 8 — Turn client-side `VITE_ENABLE_MPP_UI` on (page + economy section go live)

```bash
printf 'true' | npx vercel env add VITE_ENABLE_MPP_UI production
npx vercel deploy --prod
```

This triggers a new frontend bundle. Once deploy completes:

- `/mpp` renders the full dashboard with data
- `/economy` shows the Cross-Protocol Payment Ecosystem card
- Header nav Analytics dropdown shows the MPP entry (gated by the same flag via the header commit landed in the launch PR)

## Step 9 — Final smoke test

- [ ] `https://trustadd.com/mpp` loads
- [ ] Hero KPIs show non-zero values
- [ ] Category pie renders
- [ ] Directory table has rows; search + filters work
- [ ] Multi-protocol agents section — if >0, click through to an agent profile
- [ ] Nav `/` → Analytics dropdown → MPP → `/mpp`

## Step 10 — Announce in `content-zones.METHODOLOGY.ecosystemNotice`

See plan Task 20. Separate PR.

## Rollback

Any step can be reverted by reversing the flag flip:
- Step 5 → set `ENABLE_MPP_INDEXER=false` in Trigger.dev (data stops accumulating; existing data remains)
- Step 7 → `npx vercel env rm ENABLE_MPP_UI production && npx vercel deploy --prod` (API routes unregistered)
- Step 8 → `npx vercel env rm VITE_ENABLE_MPP_UI production && npx vercel deploy --prod` (page + nav link hidden)

## Known launch-scope deferrals

- MPP invisible to trust scoring (Path A — roadmap §1)
- `METHODOLOGY_VERSION` not bumped
- `TransferWithMemo` event decoding disabled (memo column empty)
- No Stripe/Bitquery/Tempo explorer integrations (roadmap §4)
