# Phase 3 Go-Live: On-Chain Score Anchoring

Single source of truth for the remaining mainnet cutover items after Phase 3 code + schema landed.

**Current state (2026-04-14):**
- Code: shipped (2026-04-13)
- Schema: `trust_anchors` table applied to production Supabase (`agfyfdhvgekekliujoxc`) on 2026-04-14
- Tests: 210 passing
- Anchor task runs in **local-only mode** (builds Merkle tree, stores proofs in `trust_anchors`, skips on-chain publish) until env vars are set

**Definition of done:** First anchoring run after 5 AM UTC writes a Merkle root to `TrustRoot.sol` on Base, populates `trust_anchors` rows with `anchor_tx_hash` + `anchor_block_number`, and `/api/v1/trust/:address/report` surfaces `provenance.anchor` with a verifiable BaseScan link.

---

## Cutover checklist

### 1. Pin `@openzeppelin/merkle-tree` to exact version
**Why:** `server/anchor.ts` uses `(tree as any)._leafHash(index)` — a private API. A minor/patch upgrade could silently break proof generation without a test catching it.

**Action:**
```bash
# In package.json, change from "^X.Y.Z" → "X.Y.Z" (drop the caret)
npm install @openzeppelin/merkle-tree@<current-version> --save-exact
npm test     # confirm anchor tests still pass
git commit -am "deps: pin @openzeppelin/merkle-tree (private _leafHash API usage)"
```

### 2. Deploy `TrustRoot.sol` to Base mainnet
**Contract:** `contracts/TrustRoot.sol` — owner-only Merkle root publishing. Functions: `publishRoot`, `latestRoot`, `roots`, `rootCount`, `transferOwnership`.

**Pre-deploy consideration:** Codex audit flagged the use of OpenZeppelin `Ownable` (single-tx ownership transfer) as a medium-risk finding. Consider upgrading to `Ownable2Step` before deploy so ownership transfers require the new owner to accept. Evaluate cost/benefit: the oracle wallet is hot-wallet-only for `publishRoot`, and ownership transfer should be rare.

**Action (Foundry):**
```bash
cd contracts
forge create TrustRoot.sol:TrustRoot \
  --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```
Constructor sets `msg.sender` as owner. Record the deployed address — it becomes `TRUST_ROOT_ADDRESS`.

**Alternative:** Remix + MetaMask with the deployer wallet.

### 3. Fund oracle wallet
**Target balance:** ~0.01 ETH on Base (~$25 at $2500 ETH, covers years at ~22k gas/day).

**Action:** Send from a funded Base wallet to the oracle address (the wallet whose private key will go into `ORACLE_PRIVATE_KEY`). Owner of `TrustRoot.sol` must match, or `transferOwnership` to the oracle after deploy.

### 4. Set Trigger.dev env vars
**Dashboard:** Trigger.dev project `proj_nabhtdcabmsfzbmlifqh` → Settings → Environment Variables → Production.

| Variable | Value | Required |
|---|---|---|
| `ORACLE_PRIVATE_KEY` | hex (no `0x` prefix) of funded Base wallet | yes |
| `TRUST_ROOT_ADDRESS` | Base mainnet address from Step 2 | yes |
| `BASE_RPC_URL` | `https://mainnet.base.org` (or paid RPC) | optional (default OK) |

After save, Trigger.dev does NOT auto-redeploy — env changes apply on the next task run.

### 5. Verify first anchoring run
**Timing:** `recalculate-scores` runs at `0 5 * * *` UTC and triggers `anchor-scores` fire-and-forget at the end. First run after env vars land will publish a root.

**Verification SQL (via Supabase MCP):**
```sql
SELECT
  COUNT(*)                                 AS anchor_rows,
  COUNT(anchor_tx_hash)                    AS anchored_onchain,
  MAX(anchored_at)                         AS last_anchor,
  (SELECT merkle_root FROM trust_anchors ORDER BY anchored_at DESC LIMIT 1) AS latest_root
FROM trust_anchors;
```
Expected after first successful publish: `anchor_rows > 0`, `anchored_onchain = anchor_rows` (all rows share the same tx), `latest_root` matches `TrustRoot.latestRoot()` on-chain.

**On-chain verification:**
- BaseScan: search `TRUST_ROOT_ADDRESS` → Transactions tab → confirm a `publishRoot(bytes32)` call
- Read contract: `latestRoot()` returns the same hex string as `latest_root` above

**API verification:**
```bash
curl -H "Authorization: Bearer <key>" \
  https://trustadd.com/api/v1/trust/<scored-agent-address>/report \
  | jq '.provenance.anchor'
```
Expected: object with `merkleRoot`, `leafHash`, `proof[]`, `anchorTxHash`, `anchorBlockNumber`, `basescanUrl`. If `null`, the agent wasn't in that day's anchored batch — wait for the next run or check `trust_anchors` for the specific `agent_id`.

**Failure triage:**
- Task failed: Trigger.dev dashboard → `anchor-scores` run logs; Sentry for stack trace
- Task succeeded but no on-chain tx: check for `"On-chain publish skipped"` log → env vars missing/misread
- On-chain reverted: insufficient gas balance, wrong `TRUST_ROOT_ADDRESS`, or deployer ≠ oracle (ownership mismatch)
- `provenance.anchor` null in API: `batchRecompileReports` didn't re-run the affected agent — check `trust_reports.updated_at`

---

## Rollback
If something goes wrong post-deploy:
1. **Unset `ORACLE_PRIVATE_KEY` in Trigger.dev** — anchor task reverts to local-only mode (builds tree, writes proofs, no on-chain publish). Safe default.
2. **Existing on-chain roots are immutable** — there's nothing to rollback on-chain. Each day's root supersedes the last for the purpose of `latestRoot()`.
3. **Don't drop `trust_anchors`** — the table is append-only per-agent (unique on `agent_id`, upserted each run). Historical rows retain value even if publishing stops.

---

## Notes
- Oracle wallet also funds Phase 4 (ERC-8004/EAS attestations) per the plan — topping up now covers both phases.
- `deleteAgent` already cascades through `trust_anchors` transactionally (session 6 fix), so agent deletes won't FK-fail.
- Methodology version is embedded in every leaf (`anchored_methodology_version`) and every proof — changing METHODOLOGY_VERSION invalidates old proofs intentionally (cryptographic commitment to the exact scoring rubric).
