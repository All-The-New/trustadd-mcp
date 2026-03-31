# TrustAdd — Ecosystem Intelligence: Upcoming Features

*Research compiled: March 17, 2026*
*Source: ERC-8004 Launch Day transcript — presenters from MetaMask, Ethereum Foundation, Virtuals Protocol, RedStone, OLAS, Zifi, bond.credit, Agent Zero, Daydreams, Coinbase CDP*

---

## Overview

The ERC-8004 launch day transcript surfaced four major protocol-level developments, several emerging tools, and a consistent theme: the ecosystem is rapidly building **economic proof** of agent trustworthiness. The gap between TrustAdd's current data (declared identity, GitHub signals, Farcaster) and what's now becoming available (job completion history, credit scores, hardware-verified keys, oracle-backed decisions) is the central product opportunity.

---

## Priority 1 — Sources Live Now (Build Immediately)

### Virtuals ACP Reputation Signals

**What it is:** Virtuals Protocol's Agent Commerce Protocol (ACP) is an agent-to-agent commerce layer with $3M+ in processed revenue and 28,000+ active users. Every ACP agent that "graduates" is automatically registered on ERC-8004. Every completed job generates a `FeedbackPosted` event on the ERC-8004 Reputation Registry.

**What's ready:** ACP feedback events are live on-chain now. The events flow through the standard `FeedbackPosted` event that TrustAdd's indexer already captures.

**What TrustAdd should build:**
- **Source attribution**: When a `FeedbackPosted` reviewer address matches a known ACP oracle address, label the source as "Virtuals ACP" with a badge
- **ACP Activity badge**: Detect agents whose metadata/tags reference Virtuals/ACP and show an "ACP Active" indicator on their profile card
- **ACP reputation context**: On the Reputation tab, show ACP-sourced feedback with the ACP logo and context (it's a verified commerce signal, not a random review)

**Why it matters for TrustAdd:** ACP's 28K users are exactly the kind of people who care about agent reputation before transacting. This turns TrustAdd from an empty reputation page to a live, meaningful signal source.

**Implementation notes:**
- ACP oracle address needs to be confirmed from virtuals.io docs or contract events
- Agent metadata fields to check: `description` or `tags` containing "virtual", "ACP", or known ACP agent contract addresses
- Contract: ACP graduation emits an ERC-8004 registration — so controller address may match ACP factory contracts on Base

---

### bond.credit Credit Scores

**What it is:** bond.credit has built a 9-month-developed credit scoring system for agents, focused on stability and predictability (not peak performance). They track: native yield vs reward-dependent yield, concentration risk, TVL, protocol diversity. Scores are designed like TradFi credit ratings (S&P-style), not performance scores.

**What's ready:** Their "watchtower" dashboard was launching within days of the launch event (March 17, 2026). They explicitly said they would **push their scores to ERC-8004** via the Reputation Registry. Their API will also be open to the community.

**What TrustAdd should build:**
- **bond.credit Score card**: When bond.credit's oracle address posts a `FeedbackPosted` event for an agent, show it as a dedicated "bond.credit Credit Score" card on the agent profile — not mixed in with generic feedback
- **Score sub-dimensions**: bond.credit exposes sub-metrics (risk score, stability score). Parse these from the feedbackURI content and display them
- **Credit score in Trust Score**: Factor bond.credit's score into TrustAdd's History and Capability dimensions when available
- **"Credit Rated" badge**: Show a bond.credit badge on rated agents in directory listings

**Why it matters for TrustAdd:** bond.credit's score is the closest thing to a professional credit rating for agents. It validates TrustAdd's thesis that on-chain economic track record should drive trust scores.

**Implementation notes:**
- bond.credit oracle address: confirm from their public watchtower or smart contract
- Their score format: feedbackURI likely points to IPFS JSON containing risk score, stability score, and overall credit score
- Track: `bond.credit` on Telegram for their watchtower launch announcement

---

### X402 Payment Address Extraction (Phase 1 complete → Phase 2 pending)

**What it is:** The x402-prober already extracts `paymentAddress`, `paymentNetwork`, `paymentToken`, and `paymentAmount` from agent endpoints that return 402 responses. The data exists in the database.

**What's ready:** Payment address data is being captured. USDC transfer monitoring would be Phase 2.

**What TrustAdd should build:**
- **"Earning Revenue" indicator**: Show agents that have an extracted payment address and confirmed x402 support with a "Earning Revenue" signal on their profile
- **Revenue section stub**: Add a placeholder section on agent profiles for payment addresses discovered, with a note that transaction history is being indexed
- **Phase 2 — USDC monitoring**: Subscribe to USDC Transfer events on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) where `to` matches known agent payment addresses

**Why it matters for TrustAdd:** Marco De Rossi (MetaMask) explicitly said they're "actively working on an extension that uses X402 payments as reputation collateral." Being the platform that already tracks this before the protocol formalizes it positions TrustAdd perfectly.

---

## Priority 2 — Sources Emerging (Build Framework, Watch for Availability)

### TEE Key Registry

**What it is:** The most significant upcoming change to ERC-8004. Instead of validating each task, the new Validation Registry will validate that a specific **public key** is safe to use when communicating with a specific agent running in a Trusted Execution Environment (TEE). Described as an "address book of verified keys." This proves the agent is running in a tamper-proof hardware enclave — the strongest possible trust signal.

**Timeline:** Davide Crapis (EF) said "April or early May" for the TEE Key Registry to be ready.

**What TrustAdd should build (when ready):**
- **"TEE Verified" badge**: The gold standard trust signal — show prominently on agent profiles and cards
- **Key Registry indexer**: Subscribe to the Validation Registry's key association events when deployed
- **Trust Score boost**: TEE verification should add significant points to Identity and Transparency dimensions — it directly addresses the "spoofed agents" problem called out as a top-3 ecosystem blocker
- **TEE verification timeline**: Show when a TEE key was registered and last attested

**Why it matters for TrustAdd:** This directly addresses agent impersonation — the most dangerous trust failure mode. Any agent with TEE verification is cryptographically proven to be who it claims to be.

**Implementation notes:**
- Monitor the ERC-8004 GitHub for Validation Registry contract addresses
- The contract architecture will likely emit events associating a TEE public key with an agent ID
- Design the badge and score impact now; wire up when contract is deployed

---

### ERC-8131 Job Escrow (Virtuals' contribution)

**What it is:** A new on-chain job primitive co-authored by Virtuals and the Ethereum Foundation. Three-party system: buyer agent, seller agent, evaluator agent. Funds go into escrow → seller delivers → evaluator assesses → funds released. The evaluator's verdict is the trust mechanism. Very similar to what Daydreams' task market implements (ERC-8194/8195 from Daydreams).

**Timeline:** Not yet deployed to mainnet. Actively in development.

**What TrustAdd should build (when ready):**
- **Job history timeline**: Show an agent's completed/disputed/failed escrow jobs
- **Completion rate metric**: How often does an agent successfully deliver? New Trust Score signal
- **Dispute rate metric**: How often do evaluators reject deliverables?
- **Economic track record**: Total job value, revenue through escrow — the definitive proof of real-world utility
- **Evaluator context**: Who is evaluating this agent's work? If it's a high-trust agent, weight accordingly

**Why it matters for TrustAdd:** This transforms reputation from "declared" to "demonstrated." An agent that has completed 50 verified jobs with a 95% success rate is objectively more trustworthy than one that just has good metadata.

---

### RedStone Oracle Integration

**What it is:** RedStone is the data layer for the agentic economy — "ERC-8004 answers WHO the agent is, RedStone answers WHAT the agent knows." They secure $6B+ in on-chain assets and provide price feeds, proof of reserves, exchange rates, volatility data, and DeFi risk ratings (via Cordora acquisition — essentially S&P ratings for DeFi protocols).

**What TrustAdd should build:**
- **Data source transparency**: For DeFi/financial agents, detect and display whether they use verified oracle providers
- **Cordora DeFi Risk overlay**: For agents operating in rated DeFi protocols, show the Cordora risk rating of their operating environment
- **"Verified Data Sources" capability flag**: Agents that declare or are detected to use RedStone feeds earn a data quality signal
- **Partnership opportunity**: RedStone said they "want to build with others in this space" — a formal integration where their data feeds inform a TrustAdd sub-score for financial agents is a natural collaboration

**Why it matters for TrustAdd:** Informed automation is more trustworthy than uninformed automation. An agent making DeFi decisions with verified oracle data is categorically different from one guessing.

**Implementation notes:**
- Contact: Jason Barraza at RedStone (institutional BD lead, presented at launch day)
- Cordora API: `cordora.io` — DeFi protocol risk ratings
- Detection: Check agent endpoint domains / metadata for RedStone API references

---

## Additional Topics from the Transcript (Relevant to TrustAdd)

### X402 as Reputation Collateral (Marco De Rossi, MetaMask)

Marco explicitly said: "we are actively working on an extension directly pluggable in the facilitator that automatically registers X402 agents on 8004 and use payments as reputation." This means the ERC-8004 core team is building a mechanism where payment history = reputation proof. TrustAdd should be ready to index and display this when it ships. Watch the ERC-8004 GitHub for this facilitator extension.

### Collusive Reputation / Sybil Detection

Marco called out "collusive reputation" — people self-minting fake reputation signals — as one of the top ecosystem problems. This validates TrustAdd's neutrality stance. Additional opportunity: build Sybil detection logic for incoming `FeedbackPosted` events:
- Flag burst patterns (multiple feedbacks from same address in short window)
- Flag self-feedback (reviewer = agent's own controller)
- Flag reviewer networks (mutual feedback amplification)
This would make TrustAdd the ecosystem's most trustworthy reputation layer.

### Bond.credit's "Predictability > Peak Performance" Insight

Bond.credit's 9-month research finding: for credit/trust purposes, **stability and predictability matter more than peak yield**. This should inform TrustAdd's trust score design:
- Agents with consistent, moderate activity are more trustworthy than agents with volatile spikes
- Add a "consistency" sub-signal to the History dimension
- Penalize agents whose activity patterns show boom-bust cycles

### Agent Zero Semantic Search API (ag0.xyz)

Agent Zero has built a semantic search API over ERC-8004 agents. They've had 40K+ SDK downloads. Their API supports: semantic text search, capability filters (MCP, x402), feedback threshold filters, cross-chain results. TrustAdd could use their API to power enhanced search rather than building from scratch. Alternatively, TrustAdd's own search could serve as a differentiator by building in-house. Worth evaluating the ag0 API as a complement.

### SIWA — Sign In With Agent

Mentioned by Davide Crapis as "8004 L2 infra." Likely an authentication primitive where an agent can sign in to a platform using its ERC-8004 identity. Relevant to TrustAdd's agent claiming flow — could replace wallet-signature-based claiming with SIWA-based claiming once the standard is available.

### Solana ERC-8004 (Live)

Solana launched its own ERC-8004 implementation ~10 days before the event. 8004scan already supports Solana. TrustAdd should plan Solana chain support — this is a significant gap vs. competitors.

### ERC-8183 / ERC-8194 / ERC-8195 — Task Market Standards

Multiple ERCs related to task markets and conditional payments are being developed simultaneously by Daydreams (ERC-8194/8195) and the EF team (ERC-8183). These will be the foundational standards for agent labor markets. TrustAdd should monitor these and plan to index them once deployed.

---

## Feature Priority Matrix

| Feature | Status | Urgency | Effort | Impact |
|---------|--------|---------|--------|--------|
| ACP Source Attribution | Live data now | High | Small | High |
| bond.credit Score Display | Launching this week | High | Small | High |
| IPFS FeedbackURI content fetching | Ready now | High | Small | Medium |
| Sybil detection for feedback | Design now | Medium | Medium | High |
| TEE "Verified" badge | April/May | Medium | Small (design), Medium (wire-up) | Very High |
| ERC-8131 Job History | Emerging | Low | Large | Very High |
| RedStone Data Source Transparency | Needs partnership | Low | Medium | Medium |
| X402 USDC Revenue Tracking | Phase 1 ready | Medium | Large | High |
| Solana chain support | Ready now | Medium | Large | Medium |
| SIWA claiming flow | Emerging | Low | Medium | Medium |
| Agent Zero API for search | Ready now | Low | Small | Medium |
