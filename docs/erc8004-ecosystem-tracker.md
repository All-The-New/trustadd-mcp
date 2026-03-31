# ERC-8004 Ecosystem Tracker

## Standard Status

| Milestone | Date | Status |
|-----------|------|--------|
| EIP Draft Published | Aug 13, 2025 | Done |
| Public Discussion (Ethereum Magicians) | Aug 14, 2025 | Done |
| First Community Call | Sep 23, 2025 | Done |
| Standard Freeze / Testnet Phase Complete | Oct 8, 2025 | Done |
| Formal Unveiling (EF dAI + Consensys) | Oct 9, 2025 | Done |
| Trustless Agents Day (DevConnect Buenos Aires) | Nov 21, 2025 | Done |
| Mainnet Launch (Identity + Reputation Registries) | Jan 29, 2026 | Done |
| Base L2 Expansion | Q1 2026 | In Progress |
| Glamsterdam Fork Integration (potential) | Q2 2026 | Planned |
| V2 Specification | 2026 (ongoing) | In Development |
| Validation Registry Mainnet Deployment | TBD 2026 | Under Active Development |

**Key People:** Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), Erik Reppel (Coinbase)

**Resources:**
- EIP Spec: https://eips.ethereum.org/EIPS/eip-8004
- GitHub: https://github.com/erc-8004/erc-8004-contracts
- Ethereum Magicians: https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098
- GitHub PR: https://github.com/ethereum/ERCs/pull/1170

---

## V2 Specification — Planned Enhancements

### Enhanced MCP (Model Context Protocol) Support
- Better integration with agent tool/prompt exposure
- Standardized endpoint advertisement format
- Broader cross-runtime compatibility

### Improved x402 Integration
- Tighter coupling with Cloudflare/Coinbase x402 payment standard
- Payment proofs embedded in reputation feedback (verify only paying customers review)
- x402 has processed 100M+ payments in 6 months but isn't yet standard practice for ERC-8004 feedback

### Validation Registry (Third Registry)
- **Not yet deployed to mainnet** — under active development with TEE community
- Will support three validation methods:
  - **Staking-based**: Validators stake capital, re-execute agent tasks, face slashing for dishonesty
  - **zkML (Zero-Knowledge ML)**: Mathematical proofs verifying computation was correct
  - **TEE (Trusted Execution Environment)**: Hardware enclaves proving correct code ran on correct inputs
- Independent validators can attest to agent work quality
- No built-in payment/incentive logic (application-layer concern)

### Agent Cards Standard Evolution
- Binding ENS names to agent identities, verbs, schemas, x402 entrypoints
- W3C DID resolution support
- Stricter metadata schema validation

---

## Reputation Phase — What's Planned

### Current State (Feb 2026)
- Reputation Registry is deployed and functional on all chains
- Zero genuine feedback posted on-chain
- ~19,000 agents registered across 5 chains
- Cold start problem: no one wants to be first

### Planned Reputation Features

**Core Mechanics (Already in Contract)**
- Pre-authorized feedback via EIP-191 (EOA) or ERC-1271 (smart contract) signatures
- Value scores: fixed-point integers (0-100 with configurable decimals)
- Tags for context labeling (tag1, tag2 — e.g., "DeFi", "audit")
- FeedbackURI pointing to off-chain detailed reports (IPFS)
- KECCAK-256 hash for integrity verification
- Revocation support (clients can revoke past feedback)

**Ecosystem Tooling (Expected Community-Built)**
- Reputation aggregators — filter Sybil attacks, compute weighted scores
- Reviewer reputation systems — track trustworthiness of who leaves feedback
- Validator networks — independent verification services
- Insurance agents — price coverage based on reputation/stake

**Key Design Decision: Raw Data On-Chain, Scoring Off-Chain**
- The protocol intentionally does NOT compute a single reputation score
- Raw feedback is stored on-chain; aggregation/scoring is an application-layer concern
- Multiple competing aggregation services can offer different scoring methodologies
- This is TrustAdd's opportunity — we can be the aggregation layer

### Community Concerns (From Ethereum Magicians)
- Sybil vulnerability: pre-authorization only partially mitigates spam
- Agent code can change after accumulating reputation
- Collusion/amplification loops are possible
- "Lots of additional infrastructure needs to be built on top to produce a robust reputation oracle" — Auditless Research

---

## Adoption Metrics to Monitor

| Metric | Current (Feb 2026) | Update (Mar 17, 2026) | Source |
|--------|-------------------|-----------------------|--------|
| Agents Registered (our index) | ~19,000 | — | TrustAdd prod DB |
| Agents Registered (ecosystem-wide) | ~24,000-49,000 | 100,000+ (Marco) | Launch day transcript |
| FeedbackPosted Events | 0 | ACP now posting live | Virtuals ACP integration |
| Validation Registry Status | Not deployed | TEE Key Registry: April/May | Davide Crapis, EF |
| x402 Payment Transactions | 100M+ | 100M+ | Coinbase/Cloudflare |
| V2 Spec Status | In development | ERC-8183 (conditional payments) announced | Davide Crapis |
| Solana Support | Not available | Live (~Mar 7, 2026) | 8004scan / OLAS |
| Supported EVM Chains | 5 | 20+ | Launch day |
| ACP (Virtuals) Revenue | — | $3M+ processed, 28K users | Celeste Ang, Virtuals |
| bond.credit Watchtower | — | Launching week of Mar 17 | bond.credit team |

### Signals to Watch For
- First FeedbackPosted transaction on any chain (Virtuals ACP is now posting live)
- Validation Registry (TEE Key Registry) deployment — expected April/May 2026
- bond.credit oracle address once watchtower launches
- ERC-8131 (job escrow) mainnet deployment
- ERC-8183 (conditional payments / Agent e-commerce) deployment
- V2 spec draft publication
- Major platform integrations (Coinbase wallet, MetaMask agent features)
- Glamsterdam fork inclusion decision
- Solana chain addition to TrustAdd indexer

---

## New Standards Emerging (March 2026)

| Standard | Author | Status | Description |
|----------|--------|--------|-------------|
| ERC-8131 | Virtuals + EF | Draft | Job escrow primitive: buyer → escrow → seller → evaluator → release |
| ERC-8183 | EF (Davide Crapis) | Draft | Conditional payments / Agent e-commerce with extensible hooks |
| ERC-8194/8195 | Daydreams | Draft | Task market protocol + payment-gated transaction relay |
| TEE Key Registry | EF | April/May 2026 | Address book of TEE-verified public keys per agent |

---

## Key Ecosystem Players (Updated March 2026)

| Project | Role | ERC-8004 Integration | TrustAdd Relevance |
|---------|------|---------------------|--------------------|
| Virtuals / ACP | Agent commerce platform | Graduated agents auto-registered; job ratings posted as FeedbackPosted | Live reputation source |
| bond.credit | Agent credit scoring | Pushing scores to ERC-8004 reputation registry | Live credit score source (launching Mar 2026) |
| RedStone | Oracle / data layer | Data provider for financial agents | Data source transparency signal |
| Agent Zero (ag0) | SDK + semantic search | SDK downloaded 40K+ times; search API live | Potential search integration |
| OLAS / Autonolas | Agent services | 663 daily active agents; 15M+ transactions; Identity Register Bridger | Multi-protocol data source |
| Zifi | DeFi yield agent | ZK proofs for off-chain computation posted to Validation Registry | ZK validation pioneer |
| Daydreams | Task market | market.daydreams.systems live on Base mainnet | Task market pioneer; ERC-8194/8195 author |
