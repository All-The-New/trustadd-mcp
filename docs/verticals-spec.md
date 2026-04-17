# Product Spec: Vertical Trust Profiles

**Status:** Draft
**Date:** 2026-04-15
**Origin:** Competitive research session (MoTrust analysis)

---

## 1. Concept

Generic trust scores treat all agents the same. A DeFi trading agent and a music licensing agent have fundamentally different risk profiles and relevant signals. Vertical trust profiles apply domain-specific signal weights and bonus signals on top of the base methodology, producing verdicts meaningful to that context.

---

## 2. Architecture: Base + Overlay

```
Base Methodology (current 17 signals, 100 points)
  └── Vertical Overlay
        ├── Weight adjustments (re-weight existing dimensions)
        ├── Bonus signals (vertical-specific, +20 points max)
        └── Verdict modifiers (domain-specific thresholds)
```

The base score stays universal (0-100). Verticals add a normalized overlay that adjusts the final score and produces domain-specific verdicts. Agents without a vertical get the standard score unchanged.

---

## 3. Implementation Shape

```typescript
// trust-methodology.ts extension
type VerticalId = "defi" | "commerce" | "governance" | "prediction-market";

export function getMethodology(vertical?: VerticalId): Methodology {
  const base = getBaseMethodology();  // current 17 signals
  if (!vertical) return base;
  const overlay = VERTICAL_OVERLAYS[vertical];
  return applyOverlay(base, overlay);
}
```

Trust report output with vertical:

```json
{
  "score": 78,
  "verdict": "trusted",
  "vertical": "defi",
  "verticalVerdict": "Trusted for DeFi up to $5,000",
  "baseScore": 72,
  "verticalBonus": 6,
  "verticalSignals": [
    { "name": "transaction_volume_tier", "points": 4, "maxPoints": 5 },
    { "name": "liquidation_history", "points": 5, "maxPoints": 5 }
  ]
}
```

---

## 4. Vertical Definitions

### DeFi Agent — "Trusted for DeFi up to $X"

| Adjustment | Rationale |
|-----------|-----------|
| History weight 20 → 30 | Longevity matters enormously — rug pulls happen fast |
| Community weight 20 → 25 | DeFi reputation is public and auditable |
| **New signal:** Transaction volume tier | $1K vs $1M agents need different trust thresholds |
| **New signal:** Liquidation history | Has this agent been liquidated? How often? |
| **New signal:** MEV behavior | Front-running or sandwich attacks = instant penalty |
| **Verdict modifier:** Score threshold scales with requested trust amount | 60 enough for $100, need 85+ for $10K |

### Commerce/Shopping Agent — "Trusted Buyer/Seller"

| Adjustment | Rationale |
|-----------|-----------|
| Identity weight 25 → 35 | Verified identity is critical for commerce |
| Capability weight 15 → 20 | Payment capability (x402) is table stakes |
| **New signal:** Dispute/refund rate | Like eBay seller rating |
| **New signal:** Escrow compliance | Does the agent use escrow for high-value txns? |
| **New signal:** Delivery completion rate | For service-providing agents |
| **Verdict modifier:** Includes spend limit recommendation | "Trusted up to $500/tx" |

### Governance Agent — "Trusted Delegate"

| Adjustment | Rationale |
|-----------|-----------|
| History weight 20 → 35 | Governance reputation is built over months/years |
| Transparency weight 20 → 25 | Voting rationale should be public |
| **New signal:** Voting participation rate | Active governance participation |
| **New signal:** Delegation diversity | Does this agent blindly follow one whale? |
| **New signal:** Proposal quality | If proposing, do proposals pass? |
| **Verdict:** "Trusted Delegate" label | Different badge, different meaning than generic "Trusted" |

### Prediction Market Agent — "Market Participant"

| Adjustment | Rationale |
|-----------|-----------|
| Sybil detection weight increased | Prediction markets are Sybil attack magnets |
| **New signal:** Wash trading detection | Coordinated self-trading |
| **New signal:** Position diversity | Informed bets vs manipulation |
| **New signal:** Market correlation | Suspicious correlation with other agents |
| **Verdict modifier:** Market integrity flag | "Clean participant" vs "Flagged" |

---

## 5. Rollout Order

1. **DeFi first** — on-chain transaction data already flows; liquidation/MEV data available via existing RPC
2. **Commerce second** — natural x402 extension; payment data already indexed
3. **Governance** — requires DAO data partnerships (Snapshot, Tally, etc.)
4. **Prediction markets** — requires Polymarket/similar integrations

---

## 6. Revenue Surfaces

| Surface | Description | Pricing |
|---------|-------------|---------|
| **Vertical API queries** | DeFi protocol pays for DeFi overlay on every agent check | Higher per-request price than generic via x402 |
| **Vertical credentials** | "TrustAdd Verified: DeFi" carries a premium over generic credential | Higher issuance/renewal fee |
| **Vertical data partnerships** | Liquidation data, dispute data, voting data from protocols | Revenue share or data licensing |

---

## 7. Open Questions

- What's the minimum viable vertical — just weight adjustments, or do we need the bonus signals from day one?
- Should verticals be self-selected by agents (operators choose) or auto-detected from OASF skills?
- How do we handle agents that span multiple verticals (e.g., a DeFi agent that also participates in governance)?

---

## 8. Dependencies

- Existing: `trust-methodology.ts`, `trust-score.ts`, `trust-report-compiler.ts`
- New: vertical overlay engine, vertical-specific data collectors (liquidation, MEV, dispute, voting)
- Data partnerships needed for governance and prediction market verticals
- Related spec: `docs/verified-credentials-spec.md` (credentials can be vertical-scoped)
