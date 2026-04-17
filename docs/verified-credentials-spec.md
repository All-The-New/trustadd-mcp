# Product Spec: TrustAdd Verified Credentials

**Status:** Draft
**Date:** 2026-04-15
**Origin:** Competitive research session (MoTrust analysis)

---

## 1. Strategic Context

TrustAdd currently sells to the **buyer side** — relying parties who ask "should I trust this agent?" and pay per-query via x402. A second model sells to the **seller side** — agent operators who pay to get credentialed so their agents can *carry and present* proof of trustworthiness.

| Model | Analogy | Who Pays | Growth Driver |
|-------|---------|----------|---------------|
| **Buyer-side** (current) | Credit bureau / background check | The evaluator | Risk & distrust |
| **Seller-side** (new) | SSL certificate / blue checkmark | The agent operator | Competition for legitimacy |

The full credit bureau model (Experian) sells reports to lenders AND credit monitoring to consumers. TrustAdd should do the same.

---

## 2. What

A portable, cryptographically signed credential that an agent carries and presents to counterparties, proving it has been evaluated by TrustAdd and met a trust threshold. No API call required by the verifier.

---

## 3. Credential Structure

```
┌─────────────────────────────────────────┐
│  TrustAdd Verified Credential           │
│                                         │
│  Agent: 0xabc...def                     │
│  Score: 78/100  Verdict: TRUSTED        │
│  Vertical: DeFi (optional)              │
│  Issued: 2026-04-15                     │
│  Expires: 2026-04-22  (7 days)          │
│  Status: Base 0x...  tokenId: 42        │
│  Methodology: v1                        │
│  Provenance: sha256:9f3a...             │
│                                         │
│  Signed: Ed25519 by TrustAdd            │
└─────────────────────────────────────────┘
```

---

## 4. Standards

- **W3C Verifiable Credentials** — portability across platforms
- **W3C DID:web** — TrustAdd's issuer identity
- **Ed25519** — cryptographic proof
- **ERC-8004** compatible — new event types on existing contract

---

## 5. Revocation: Three-Layer Defense

| Layer | Mechanism | Speed | Use Case |
|-------|-----------|-------|----------|
| **Expiry** | Short-lived credentials (7-30 days) | Passive | Normal lifecycle — score drifts, credential expires, must re-verify to renew |
| **On-chain status bit** | Smart contract status list on Base | Minutes | Active revocation — flip a bit, any verifier checking the chain sees it immediately |
| **Emergency broadcast** | Push notification to subscribers | Seconds | Critical — agent caught draining wallets, credential invalidated + alert pushed |

**Normal case:** Credential expires in 7 days. Agent must re-verify. If score dropped below threshold, no renewal. No explicit revocation needed — gravity does the work.

**Bad actor detected:** On-chain status bit flipped. Credential is cryptographically valid but semantically dead. Any verifier checking Base sees it instantly.

---

## 6. Verification Tiers (for relying parties)

A verifier can choose their assurance level:

1. **Offline** — Is the credential expired? Check embedded timestamp. Zero API calls.
2. **Chain-only** — Is the status bit still active? One RPC call to Base, no trust in TrustAdd required.
3. **Full** — Call TrustAdd API for the live score. Deepest assurance.

---

## 7. Protocol Events

New event types on existing contract infrastructure, alongside the `anchor-scores` Merkle root:

```solidity
event CredentialIssued(uint256 indexed agentId, bytes32 credentialHash, uint256 expiry);
event CredentialRevoked(uint256 indexed agentId, bytes32 credentialHash, string reason);
```

---

## 8. Revenue Model

Agent operators pay to get and maintain credentials:

- **Issuance fee** — one-time cost per credential type
- **Renewal fee** — auto-renewal every 7-30 days while score remains above threshold
- **Vertical premium** — domain-specific credentials (DeFi, Commerce) cost more due to deeper signal analysis
- **Verification free** — verifiers pay nothing, maximizing adoption of the credential format
- Payments via x402 (USDC on Base), consistent with existing infrastructure

---

## 9. Open Questions

- Should we adopt W3C VC standard directly or build a lighter-weight proprietary format first?
- Should "claim your profile" (agent operator onboarding) be free to drive supply-side adoption?
- Do we need Lightning payment support to compete with MoTrust, or is x402/USDC sufficient?

---

## 10. Dependencies

- Existing: `anchor-scores` task, existing contract on Base
- New: credential issuance contract, W3C VC library, operator onboarding flow
- Related spec: `docs/verticals-spec.md` (vertical-specific credentials build on this)
