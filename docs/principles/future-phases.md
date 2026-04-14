# Trust Oracle — Future Implementation Phases

## Phase 2: Anti-Gaming & Sybil Resistance (Principle 5)

**Status:** Complete
**Completed:** 2026-04-13
**Dependencies:** Phase 1 complete ✓

### What was built:
1. **Controller clustering detection** — Controllers with >10 agents flagged. Severity: low (11-50), medium (51-500), high (>500). In production: 463 controllers flagged.
2. **Metadata fingerprint clustering** — Agents sharing identical fingerprints across different controllers. 4,119 clusters detected.
3. **Self-referential payment detection** — Cycles between controlled wallets in `agent_transactions`. Limited data (26 agents with txs) but detection ready.
4. **Temporal burst detection** — >50% of tx volume in last 24h flagged. Minimum 5 transactions required.
5. **Score dampening** — Risk score (0-1) converts to multiplier (0.5-1.0) applied to raw trust score during `recalculateAllScores()`.

### Schema additions:
- `sybil_signals jsonb` column on agents table
- `sybil_risk_score real` column on agents table

### Integration:
- `server/sybil-detection.ts` — Pure detection functions + SQL prefetcher
- Called during `recalculateAllScores()` in `server/trust-score.ts`
- Sybil block included in full trust reports via `server/trust-report-compiler.ts`

---

## Phase 3: On-Chain Score Anchoring (Principles 3, 14)

**Status:** Code complete — pending contract deployment
**Completed:** 2026-04-13 (code), deployment TBD
**Dependencies:** Phase 1 complete, funded oracle wallet on Base

### What was built:
1. **TrustRoot.sol** — Minimal Solidity contract (`contracts/TrustRoot.sol`) for owner-only Merkle root publishing on Base. Functions: `publishRoot`, `latestRoot`, `roots`, `rootCount`, `transferOwnership`.
2. **Merkle tree module** — `server/anchor.ts` builds `StandardMerkleTree` from scored agents (leaves: `[address, chainId, score, methodologyVersion, timestamp]`), extracts per-agent proofs, and publishes roots via viem.
3. **Trigger.dev anchor task** — `trigger/anchor-scores.ts` runs after daily recalculate (fire-and-forget). Queries scored agents, builds tree, publishes root on-chain (if wallet configured), bulk-upserts proofs to `trust_anchors` table.
4. **Trust report integration** — `provenance.anchor` block in Full Report includes Merkle proof, root, leaf hash, tx hash, block number, and basescan verification URL.
5. **Schema** — `trust_anchors` table with unique index on `agentId`, stores per-agent Merkle proofs and on-chain tx metadata.

### Libraries:
- `@openzeppelin/merkle-tree` (JS tree generation)
- `viem` (contract interaction, dynamic import in Trigger.dev)

### Cost: ~$0.01/day on Base (22k gas per root publication).

### Remaining infrastructure steps:
- Deploy `TrustRoot.sol` on Base mainnet
- Fund oracle wallet with ~0.01 ETH on Base (lasts months)
- Apply `migrations/0001_strange_punisher.sql` to create `trust_anchors` table
- Set Trigger.dev env vars: `ORACLE_PRIVATE_KEY`, `TRUST_ROOT_ADDRESS`, `BASE_RPC_URL` (optional, defaults to `https://mainnet.base.org`)

---

## Phase 4: ERC-8004 / EAS Attestations (Principle 14)

**Status:** Planned
**Estimated effort:** 3-5 days
**Dependencies:** Phase 3 complete (shares oracle wallet)

### What to build:
1. **EAS attestation task** — New Trigger.dev task (`erc8004-attester`) that runs post-recalculate. For high-quality agents, submit attestations to Ethereum Attestation Service on Base.
2. **ERC-8004 Reputation Registry writes** — Use `giveFeedback()` on the deployed Reputation Registry at `0x8004B663056A597Dffe9eCcC1965A193B7388713`.

### Approach:
- Start with EAS (lower friction, no self-feedback restriction)
- Add ERC-8004 Reputation Registry writes as step two
- Attest weekly rather than daily to limit gas spend

### Libraries:
- `@ethereum-attestation-service/eas-sdk`
- ERC-8004 contract ABI from `erc-8004/erc-8004-contracts` GitHub

---

*Last updated: 2026-04-13*
