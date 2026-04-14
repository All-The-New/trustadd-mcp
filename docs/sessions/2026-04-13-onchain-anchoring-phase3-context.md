# Session Context — Trust Oracle Phase 3 (On-Chain Score Anchoring)

**Date:** 2026-04-13
**Project:** TrustAdd
**Branch:** main

## What Was Accomplished

### On-Chain Score Anchoring Phase 3 (9 tasks, all complete)
- `e778131` — TrustRoot.sol contract (owner-only Merkle root publishing on Base)
- `cbf947f` — `trust_anchors` schema table + Drizzle migration
- `df6d463` — Dependencies: viem, @openzeppelin/merkle-tree; viem added to build.external
- `f8160d2` — `server/anchor.ts` module (Merkle tree building, proof extraction, on-chain publish, ABI) + 12 tests
- `875710b` — `trigger/anchor-scores.ts` Trigger.dev task (tree build → on-chain publish → bulk upsert proofs)
- `a971977` — Wired anchor-scores into daily recalculate pipeline (fire-and-forget)
- `f2774ea` — Trust report provenance block extended with `anchor` field; anchor fetch parallelized in Promise.all
- `dd1a554` — Phase 3 status updated in `docs/principles/future-phases.md`
- `cd056a6` — TypeScript fix: Array.from for tree.entries() iterable
- `5deca63` — Code review fixes: removed unused param, replaced non-null assertion

### Reviews Conducted
- **Per-task**: Spec compliance + code quality review for each task (subagent-driven development)
- **Final code review**: Full implementation audit — verdict: **Ready to Ship**
- Key review findings addressed: moved anchor fetch into Promise.all (perf), removed unused `agents` param from `extractProofs`, replaced `a.score!` with `a.score ?? 0`

## Key Decisions

- **Graceful degradation**: Anchor task works in 3 modes — full on-chain + proofs, proofs-only (no wallet), or skip (no agents). Safe to deploy before contract is live.
- **Fire-and-forget pattern**: `anchorScoresTask.trigger()` (not `.triggerAndWait()`) to avoid eating the recalculate task's 540s budget.
- **viem in build.external**: Large library, shouldn't be bundled by esbuild. Dynamic import inside `run()` function.
- **`_leafHash` private API**: Used `(tree as any)._leafHash(index)` for leaf hash extraction. Reviewer flagged this — should pin @openzeppelin/merkle-tree version or compute hash manually before a version bump.
- **Two-step ownership transfer**: Reviewer suggested upgrading TrustRoot.sol to OpenZeppelin Ownable2Step before deployment.

## Current State

### What's Deployed
- Code is on `main` branch. Push triggers:
  - Vercel auto-deploy (frontend + API)
  - GitHub Actions → Trigger.dev deploy (background tasks)

### Migration Pending
- `migrations/0001_strange_punisher.sql` needs to be applied to create `trust_anchors` table via Supabase MCP/SQL editor

### Env Vars Needed (Trigger.dev dashboard)
| Variable | Description | Required for |
|----------|-------------|--------------|
| `ORACLE_PRIVATE_KEY` | Oracle wallet private key (hex, no 0x prefix) | On-chain publish |
| `TRUST_ROOT_ADDRESS` | Deployed TrustRoot.sol address on Base | On-chain publish |
| `BASE_RPC_URL` | Base RPC URL (defaults to `https://mainnet.base.org`) | On-chain publish |

Without these, anchor task still runs — builds tree and stores proofs locally, skips on-chain publishing.

### Test Suite
- 199/199 tests passing (15 new: 12 anchor module + 3 provenance type contract)
- Pre-existing tsc errors: 3 in trust-report-compiler.ts (undefined vs null), unchanged

## Next Steps (prioritized)

1. **Apply migration** — Run `migrations/0001_strange_punisher.sql` via Supabase MCP
2. **Push to main** — Triggers Vercel + Trigger.dev deploy
3. **Deploy TrustRoot.sol** — To Base mainnet (Remix/Foundry, owner = existing oracle wallet)
4. **Fund oracle wallet** — ~0.01 ETH on Base (lasts months at ~$0.01/day)
5. **Set env vars** — `ORACLE_PRIVATE_KEY`, `TRUST_ROOT_ADDRESS` in Trigger.dev Production
6. **Verify first anchoring** — Next 5 AM UTC recalculate run triggers anchor-scores
7. **Pin @openzeppelin/merkle-tree** — To avoid `_leafHash` breakage on update
8. **Consider Ownable2Step** — For TrustRoot.sol before deployment

## References

- Plan: `docs/superpowers/plans/2026-04-13-onchain-anchoring-phase3.md`
- Previous: `docs/sessions/2026-04-13-sybil-detection-phase2-context.md`
- Phase status: `docs/principles/future-phases.md` (Phase 3: code complete)
