# TrustAdd Trust Oracle Design Principles

## Purpose of This Document

TrustAdd is positioning itself as the trust oracle for the AI agent economy — the system agents check before paying for services, interacting with contracts, or trusting other agents. This document establishes the design principles that every feature, API endpoint, database schema, and UI element must adhere to. These are not aspirational guidelines. They are engineering constraints.

Being a trust oracle means our errors have downstream consequences. If we over-rate a malicious service, agents relying on our score lose money. If we under-rate a legitimate service, we damage a provider's livelihood. Every principle below is designed to minimize both failure modes while building the credibility TrustAdd needs to become essential infrastructure.

Save this document to `docs/principles/trust-oracle-design-principles.md` in the TrustAdd repository. Reference it in CLAUDE.md as a required read before any trust-related feature work.

---

## Principle 1: Epistemic Honesty — Never Claim More Than You Know

The most important principle. Every trust assessment must communicate what was checked, what wasn't checked, and how confident we are.

This principle is grounded in how trust functions between AI agents. The World Economic Forum identifies that "trust between AI agents is formed through the exchange of signals — performance history, reputational data and predictable behaviour. Agents evaluate one another based on competence and intent." [Source 1] If our signals are incomplete, we must say so — because agents will make financial decisions based on what we report.

**Rules:**
- Every trust score includes a coverage indicator showing how many signals were available out of how many were attempted
- If a data source was unavailable, the score explicitly states "not checked" for that dimension — never silently omit it
- Use language like "based on available signals" not "this service is safe"
- Absence of negative evidence is not positive evidence — "no known exploits" is NOT "audited and secure"
- Distinguish between "verified false" and "unknown" — they are fundamentally different states

**Implementation pattern:** Every trust assessment response includes a `signals` array showing each dimension, its status (checked/unavailable/not-applicable), its value, and the timestamp of the data it's based on.

```
{
  "score": 72,
  "confidence": "medium",
  "signals_checked": 4,
  "signals_available": 6,
  "signals": [
    { "dimension": "identity", "status": "checked", "value": "verified", "source": "erc8004", "as_of": "2026-04-13T..." },
    { "dimension": "longevity", "status": "checked", "value": "94_days", "source": "bazaar_first_seen", "as_of": "2026-04-13T..." },
    { "dimension": "payment_volume", "status": "unavailable", "reason": "bitquery_rate_limited" },
    ...
  ]
}
```

---

## Principle 2: Separate Facts from Judgments

The system produces two types of output: observable facts and computed judgments. These must be strictly separated in the data model, API responses, and UI.

The InfoWorld Data Trust Scoring Framework describes this separation formally: compliance evaluates regulatory alignment, while "contextual clarity concerns how well the dataset's scope, limitations and intended uses are documented. Developers need enough metadata and narrative context to understand where the data is reliable and where it is not." [Source 2] The same applies to trust scores — users need to see the evidence beneath the judgment.

**Facts** (high confidence, independently verifiable):
- This wallet has ERC-8004 identity: yes/no
- This service registered on the Bazaar on [date]
- This endpoint returned HTTP 200 at [timestamp] with [latency]ms
- This wallet received X USDC in Y transactions over Z period

**Judgments** (our algorithm, our responsibility):
- Trust score: B+
- Risk level: low/medium/high
- Category classification: "data service"
- Trend: "improving" / "declining" / "stable"

**Implementation rules:**
- Store facts and scores in separate database tables
- API responses include both, clearly labeled
- UI shows the score prominently but makes underlying facts expandable/inspectable
- When the scoring algorithm changes, facts remain unchanged — only scores are recomputed
- Users can always access raw signals to form their own judgment

---

## Principle 3: Immutable Audit Trail

Every trust assessment TrustAdd produces must be permanently recorded with full provenance. If a score changes, both old and new scores are preserved.

This is especially critical in the agent economy. Anthropic's own research found that "in just one year, AI agents went from exploiting 2% of smart contract vulnerabilities to 55.88% — it costs just $1.22 on average for an agent to exhaustively scan a contract for vulnerability." [Source 3] When agents are exploiting contracts at this rate, the ability to prove what a trust oracle reported at a specific moment becomes both a safety mechanism and a liability shield.

**Rules:**
- Append-only scoring table: every assessment is a new row, never an update
- Each assessment row includes a hash of the input signals that produced it, proving what data we had at the time
- Expose a score history endpoint per service so anyone can verify what TrustAdd reported and when
- Never retroactively modify a historical score — if we discover an error, add a correction record that references the original
- Consider periodic on-chain anchoring of score snapshots (Merkle root on Base) for cryptographic proof — this is especially credible in the Ethereum ecosystem and aligns with our positioning

**Why this matters:** "Here is exactly what we knew and what we reported at that timestamp" is both a liability shield and a trust-building mechanism. Agents and their operators need to audit why a decision was made based on our data.

---

## Principle 4: Graceful Degradation — Fail Visibly, Never Silently

TrustAdd depends on multiple external data sources (CDP Bazaar API, Bitquery, community Bazaar, Alchemy, health check endpoints). Any can fail at any time.

The Cloud Security Alliance's Agentic Trust Framework (ATF) establishes that trust systems must have "circuit breakers [that] prevent runaway failures" and that "all actions are logged, inputs are validated." [Source 4] The CSA further specifies a maturity model where agents "observe, report, and recommend actions for human approval" — our data pipeline should follow the same pattern.

**Rules:**
- Every data source has a `last_successful_fetch` timestamp stored and displayed
- If a source hasn't refreshed within its expected window, all scores depending on it show a "stale data" warning
- Health checks that fail immediately mark that dimension as "unknown" — never show the last good result as current
- The Bazaar page shows a "data freshness" indicator: green (current), yellow (stale but within tolerance), red (failed)
- Monitor the data pipeline itself, not just the services being scored — a silent cron failure is the most dangerous failure mode
- Set up alerting (via Resend) when any data source fails for more than 2 consecutive poll cycles

**Implementation pattern:** A `data_source_health` table tracking every source, its expected poll interval, last success, last failure, and current status. An admin dashboard (even if just for you initially) that shows this at a glance.

---

## Principle 5: Adversarial Resilience — Assume Gaming

If TrustAdd scores influence agent behavior, those scores become an attack surface. Design for adversarial inputs from day one.

Academic research on blockchain oracle trust management validates this concern. TCO-DRL research demonstrates that trust evaluation must happen "from multiple dimensions" and uses "an improved sliding time window to monitor reputation changes in real time, enhancing resistance to malicious attacks." [Source 5] The research shows that without multi-dimensional trust evaluation, malicious oracle allocation rates are 39%+ higher.

The NCC Group's AI security guidance further warns that "AI systems should inherit the trust level of the data they process. If an AI model is exposed to untrusted input, its capabilities must be restricted accordingly." This concept — Dynamic Capability Shifting — applies directly to our scoring pipeline. [Source 6]

**Threat models to account for:**
- **Score inflation:** Malicious service creates ERC-8004 identity, generates fake payment volume by self-paying, appears trustworthy. Mitigation: weight organic payment patterns differently from self-referential ones. Flag wallets where payer and receiver share transaction history.
- **Reputation bombing:** Flooding negative feedback against a competitor. Mitigation: weight feedback by the reputation of the feedback-giver, not just volume. Require minimum stake or identity verification for feedback to count.
- **Sybil attacks:** One actor creates many services that cross-reference each other positively. Mitigation: wallet clustering analysis. Flag services where all positive feedback comes from a small set of related wallets.
- **Temporal manipulation:** Stand up a healthy-looking service just before a poll cycle, get scored, then swap the endpoint for something malicious. Mitigation: randomize poll times. Weight consistency over time more heavily than point-in-time snapshots. Require multiple consecutive healthy checks before score improves.
- **Data source poisoning:** If an attacker knows which sources TrustAdd trusts, they might manipulate those sources. Mitigation: cross-reference multiple independent sources. Flag when sources disagree.

**Implementation rule:** Store raw wallet addresses and transaction data so clustering analysis can be added later without re-collecting. Don't build all mitigations for v1 — but document the threat model and ensure the schema supports future anti-gaming work.

---

## Principle 6: Data Provenance — Track the Origin of Every Signal

Every data point in the system must be traceable to its source. This is the blockchain oracle research principle applied to our context.

Chainlink's oracle design requires that "nodes are required to sign the data and their reputation is also being managed based on metrics like performance, completed tasks, and reaction time." Data is "collected from different off-chain data providers and then aggregated by an on-chain aggregation smart contract." [Source 7] We apply the same rigor to our off-chain data pipeline.

The academic survey on trustworthy blockchain oracles further notes that reputation systems like Witnet "reward the successful majority consensus witnesses while penalizing the contradicting witnesses" — establishing that provenance tracking is the foundation of accountability. [Source 8]

**Rules:**
- Every stored data point includes: source system, fetch timestamp, raw response hash, and any transformation applied
- If we derive a value (e.g., "category: data service" from a keyword match on a description), store both the raw description and the derived value with the derivation method
- When displaying data to users, make the source inspectable — "this payment volume data comes from Bitquery, last updated 3 hours ago"
- If two sources disagree (e.g., CDP says a service exists but community Bazaar says it's down), surface the conflict rather than silently picking one
- Version all derivation/classification logic so we can trace which algorithm version produced which score

---

## Principle 7: Open Methodology, Proprietary Data

Publish how trust scores are calculated. Keep the aggregated historical dataset as the competitive advantage.

The World Economic Forum's guidance on designing for trust in the agent age emphasizes that "durable trust depends on systems designed for cognitive resonance rather than engineered through emotional persuasion. Consistency over persuasion: predictable, principled behaviour builds trust more effectively than adaptive persuasion." [Source 9] Publishing our methodology is how we demonstrate predictability and earn trust from the developer community.

McKinsey's 2026 AI Trust Maturity Survey found that "only about one-third of organizations report maturity levels of three or higher in strategy, governance, and agentic AI governance" and that "risk awareness is outpacing the implementation of controls." [Source 10] Being transparent about our controls and methodology positions TrustAdd ahead of this industry-wide governance gap.

**What we publish:**
- A public "TrustAdd Methodology" page explaining every signal, its weight, and what score levels mean
- Version history of the methodology — when we change the algorithm, publish the changelog with rationale
- The specific criteria required for each score level (e.g., "A score requires verified identity AND 30+ days active AND positive payment volume AND passing health checks")

**What we protect:**
- Historical snapshots of Bazaar services over time
- Cross-referenced identity-payment-health datasets
- Trend data and computed analytics
- Proprietary scoring model weights (publish the factors, not the exact weights)

**Why:** Transparency builds trust in the trust oracle. Opacity kills it. But the raw data we've collected and structured is genuinely scarce and valuable — that's the business asset.

---

## Principle 8: Conservative by Default — Earn Trust Upward

Initial scores should be more skeptical than seems necessary. It's far better to under-rate a legitimate service than to over-rate a malicious one.

Allianz's Responsible AI framework codifies this as: "Responsible AI is not only about enabling innovation, it is also about saying 'no' to certain applications. Allianz excludes AI systems that would structurally undermine trust, even if they were technically feasible or promised short-term efficiency gains." [Source 11] The same conservatism should apply to our trust scores.

**Rules:**
- New services with no history start at "Unrated" or "Insufficient Data" — not "Neutral"
- Require multiple independent positive signals before scoring above a baseline threshold
- Weight negative signals more heavily than positive ones — one failed health check matters more than 100 successful ones
- Define explicit requirements for each score tier and document them publicly
- Set a maximum rate of score improvement — no service should go from "Unknown" to "A" in a single day regardless of signals
- Scores can decrease instantly (e.g., failed health check) but can only increase gradually (consistent positive signals over time)

**The asymmetry is intentional:** False negatives (under-rating a good service) cost the service provider some reputation temporarily. False positives (over-rating a bad service) cost agents real money. The cost of false positives is higher, so the system must be biased against them.

---

## Principle 9: Your Security Is the Product

If TrustAdd is compromised and scores are manipulated, the damage cascades to every agent relying on us.

The CSA's Agentic Trust Framework applies Zero Trust principles directly to AI agent governance: "No AI agent should be trusted by default, regardless of purpose or claimed capability. Trust must be earned through demonstrated behavior and continuously verified through monitoring." [Source 4] This same principle applies to our own infrastructure — we don't trust our own systems by default either.

The NIST AI Risk Management Framework (AI RMF) further emphasizes that governance must cover the full lifecycle: "organized around the Govern, Map, Measure, Manage functions — it emphasizes organizational governance, risk identification and measurement, and operational risk treatments." [Source 12]

**Non-negotiable infrastructure requirements:**
- Supabase Row Level Security on every table
- Environment variables for all API keys and secrets — never in code, never in logs
- Two-factor auth on every infrastructure account (Coinbase, Supabase, Vercel, Cloudflare, GitHub, Alchemy, Bitquery)
- Database backups with point-in-time recovery enabled
- No admin/write endpoints exposed without authentication, even in development
- Deploy previews on Vercel must not access production data

**TrustAdd-specific security concerns:**
- The cron job that polls sources and computes scores is the most critical code path — if compromised, an attacker controls all output. Keep it simple, auditable, and heavily logged.
- API keys for data sources (Alchemy, Bitquery, Coinbase) feed trust scores — if leaked, an attacker can manipulate what data the system sees. Rotate on a schedule.
- When x402 payment gating is added, the wallet private key is a high-value secret. Use Coinbase Server Wallets (TEE-backed) rather than managing keys directly.
- Rate-limit all public API endpoints to prevent both abuse and data scraping

---

## Principle 10: Privacy by Design — Minimize Data, Maximize Utility

Trust scoring involves analyzing wallet addresses, transaction patterns, and service behavior. Handle this data responsibly.

McKinsey's survey found that the trust gap "is especially pronounced for intellectual property infringement and personal privacy, suggesting that risk awareness is outpacing the implementation of controls." [Source 10] Privacy failures would directly undermine our positioning as a trust provider.

Research on blockchain-based reputation systems recommends that "a network of reputation oracles could aggregate users' ratings and publish only a hashed reputation value on-chain, keeping individual inputs hidden. This approach combines the benefits of decentralization with data minimization." [Source 13]

The emerging governance framework from responsible AI practitioners identifies four foundational pillars: "identity, data, consent, and decision-making. These elements form the backbone of modern AI governance frameworks." [Source 14]

**Rules:**
- Wallet addresses are pseudonymous, not anonymous — treat them as potentially identifying information
- Store the minimum data needed for scoring. Don't collect data "just in case."
- If we detect patterns linking wallets to real identities, don't store or expose that linkage
- If we aggregate data for analytics (e.g., "top earning wallets"), anonymize or pseudonymize appropriately in public-facing displays
- Comply with GDPR's data minimization principle even if the data is on-chain — on-chain doesn't mean "no privacy obligations"
- When data is no longer needed for scoring (e.g., raw API responses older than 90 days), archive or delete according to a defined retention policy
- Never sell or share raw transaction data with third parties

---

## Principle 11: Multi-Source Verification — No Single Point of Truth

A trust oracle that trusts a single source is just a proxy, not an oracle. The value comes from cross-referencing.

This principle is core to how every major blockchain oracle works. Chainlink "supports data collection from multiple sources and APIs" and "data is aggregated by an on-chain aggregation smart contract." [Source 7] The academic survey on oracle trust notes that "achieving a fully trustworthy oracle platform for blockchain is still at an early stage" specifically because "we need to integrate novel security and privacy mechanisms into existing trust models, to detect, prevent, and mitigate Sybil and collusion among oracles." [Source 8]

The Chainlink oracle problem framework further specifies the need for "reputation systems — feeding signed on-chain data into reputation systems allows users to make informed decisions; certification services — enabling nodes to obtain certifications; advanced cryptography and hardware — providing flexibility for zero-knowledge proofs and trusted execution environments." [Source 15]

**Rules:**
- Never base a trust score on a single data source for any dimension
- When sources agree, confidence increases. When they disagree, flag the conflict and reduce confidence.
- Maintain at least two independent paths to every critical data point where feasible (e.g., CDP Bazaar + community Bazaar for service listing data)
- If a source is the sole provider for a dimension (e.g., only Bitquery provides payment volume), clearly mark that dimension as "single-source" in the score output
- Plan for source redundancy — if Bitquery shuts down, what's our fallback for payment data?

---

## Principle 12: Bounded Claims — Define What We Are and What We're Not

TrustAdd must be clear about the limits of its trust assessments to avoid creating false confidence.

The Harvard Business Review analysis of AI agent trust warns that "personal AI agents introduce significant trust and accountability risks, including susceptibility to hacking, marketing manipulation, misinformation, and conflicting loyalties" and recommends that agents "should be treated as fiduciaries, held to legal and ethical standards that prioritize the user's interests." [Source 16] As a system that influences agent decisions, we carry a fiduciary-adjacent responsibility to be honest about our limits.

The Gartner TRiSM (Trust, Risk, and Security Management) framework for agentic AI proposes "a risk taxonomy to capture the unique threats and vulnerabilities of Agentic AI, ranging from coordination failures to prompt-based adversarial manipulation" and emphasizes "strategies for improving explainability." [Source 12] Bounded claims are how we implement explainability.

**We ARE:**
- A data aggregation and signal processing service
- A convenience layer that saves agents time by pre-computing trust signals
- A historical record of Bazaar ecosystem data

**We are NOT:**
- A guarantee of safety — our scores represent available evidence, not certainty
- A substitute for due diligence on high-value transactions
- An auditor — we aggregate audit signals from others, we don't perform audits ourselves
- An insurance provider — we don't indemnify against losses based on our scores
- A regulator — we don't have authority to delist or block services

**Implementation:** Include a clear disclaimer in every API response and on every UI page displaying trust scores. Not hidden in footer text — visible, concise, and honest: "TrustAdd scores reflect available evidence as of [timestamp]. They are not guarantees of safety. Verify independently for high-value decisions."

---

## Principle 13: Circuit Breakers — Know When to Stop

If TrustAdd detects that its own systems may be compromised or producing unreliable data, it should stop serving scores rather than serve bad ones.

The CSA Agentic Trust Framework establishes explicit maturity levels for agent autonomy, with the foundational level requiring that agents "observe, report, and recommend actions for human approval" with "circuit breakers [that] prevent runaway failures." [Source 4] Higher autonomy levels add "behavioral anomaly detection, comprehensive PII protection, role-based access control" and "full policy-as-code enforcement, streaming anomaly detection."

The NCC Group's security guidance emphasizes "trust segmentation — high-trust agents should never be exposed to unvalidated or polluted data, while low-trust agents should not have access to privileged functions." [Source 6] Our own scoring pipeline should follow these same boundaries.

**Triggers for circuit breakers:**
- Data pipeline has not refreshed in >24 hours and no alert was generated (indicates monitoring failure)
- Scores change dramatically for >20% of services in a single poll cycle (indicates data source corruption or gaming)
- Health check infrastructure itself fails (can't distinguish between "services are down" and "our checker is down")
- Any evidence of unauthorized access to the scoring pipeline or database

**Response:** Serve cached scores with prominent "system under review" warning. Do not serve fresh scores until the issue is diagnosed and resolved. Notify users/agents via status page.

---

## Principle 14: Interoperability — Build for the Ecosystem, Not Just Yourself

TrustAdd exists within a broader trust ecosystem (ERC-8004 Reputation Registry, Validation Registry, MolTrust, DJD Agent Score, AgentStamp). Design to complement, not compete.

The ERC-8004 specification itself establishes this interoperability expectation: "Scoring and aggregation occur both on-chain and off-chain, enabling an ecosystem of specialized services for agent scoring, auditor networks, and insurance pools." [Source 17] The standard explicitly envisions multiple providers contributing to a composite trust picture — TrustAdd should be one of those providers, not an isolated system.

The x402 Bazaar ecosystem is also built on interoperability. The community Bazaar MCP server already provides "ERC-8004 trust scoring" alongside health checks and facilitator compatibility flags. [Source 18] Tools like MolTrust provide "trust verification middleware for x402 payments" that "extracts wallet from X-PAYMENT header, verifies via trust scoring." [Source 19] TrustAdd should both consume and contribute to these systems.

Cross-chain and cross-platform reputation research further emphasizes that "score-based systems can also be interoperable, but they typically require either a shared backend or bridging mechanisms" and that the industry is moving toward "schemas for reputation credentials that can be shared across worlds, reputation APIs that enable queries across worlds." [Source 13]

**Rules:**
- Read from and contribute to the ERC-8004 Reputation and Validation registries where appropriate
- Use standard identifiers (ERC-8004 agentId, wallet addresses) not proprietary IDs
- Expose trust data in formats other systems can consume (JSON API, potentially on-chain)
- Don't create lock-in — an agent should be able to verify TrustAdd's assessment using public on-chain data
- Follow emerging standards (OASF, A2A, MCP conventions) for interoperability with agent frameworks

---

## Pre-Ship Checklist

Before any trust-related feature goes live, answer these questions:

1. **If this output is wrong, what's the worst-case consequence?** Size the risk.
2. **Can we prove what we reported and when?** If not, add logging before shipping.
3. **What happens when a data source is down?** If the answer is "nothing changes," that's a bug.
4. **Could someone game this signal?** Document the threat even if you're not mitigating it yet.
5. **Are we claiming more than we actually checked?** If yes, add caveats.
6. **Is the source of every data point traceable?** If not, add provenance metadata.
7. **Does the score degrade gracefully with missing data?** Test with 1, 2, and 3 sources unavailable.
8. **Is there a clear disclaimer visible to the consumer of this score?** Not just in the docs — in the response.

---

## Summary

These 14 principles reduce to one meta-principle: **a trust oracle earns trust the same way it measures it — through consistency, transparency, verifiability, and honest acknowledgment of limitations.**

Build slowly. Claim conservatively. Log everything. Publish your methodology. Protect your infrastructure. And always tell the user exactly what you know and what you don't.

---

## Research Sources

### Agent Economy Trust & Identity

1. **World Economic Forum** — "Trust is the new currency in the AI agent economy" (July 2025). Covers agent-to-agent trust, human-to-agent trust, and the relationship between societal trust and economic performance. https://www.weforum.org/stories/2025/07/ai-agent-economy-trust/

2. **InfoWorld** — "A data trust scoring framework for reliable and responsible AI systems" (March 2026). Proposes a formal scoring framework covering accuracy, completeness, consistency, timeliness, compliance, and contextual clarity, with aggregation formulas and semantic integrity constraints for LLM-era data. https://www.infoworld.com/article/4150077/a-data-trust-scoring-framework-for-reliable-and-responsible-ai-systems.html

3. **Anthropic Red Team Research** — "AI agents find $4.6M in blockchain smart contract exploits" (2025). SCONE-bench evaluation showing AI agents exploiting 55.88% of post-knowledge-cutoff smart contract vulnerabilities, with average scan cost of $1.22. Establishes the threat model for why trust verification matters. https://red.anthropic.com/2025/smart-contracts/

### Zero Trust & Security Frameworks

4. **Cloud Security Alliance (CSA)** — "Agentic Trust Framework: Zero Trust for AI Agents" (February 2026). Applies NIST 800-207 Zero Trust principles to AI agents. Defines maturity levels from "Intern" to "Principal" with explicit promotion criteria, circuit breakers, and implementation stacks. Open specification under Creative Commons. https://cloudsecurityalliance.org/blog/2026/02/02/the-agentic-trust-framework-zero-trust-governance-for-ai-agents

5. **TCO-DRL Research** — "A Trust-Aware and Cost-Optimized Blockchain Oracle Selection Model with Deep Reinforcement Learning" (2025-2026). Academic paper demonstrating multi-dimensional trust evaluation with sliding time windows for real-time reputation monitoring. Reduces malicious oracle allocation by 39.10%. Published in Future Generation Computer Systems (ScienceDirect). https://www.sciencedirect.com/science/article/abs/pii/S0167739X26001238

6. **NCC Group / eSecurity Planet** — "RSAC 2026: Rethinking Trust in Agentic AI Security" (April 2026). Introduces Dynamic Capability Shifting (AI systems inherit trust level of data they process) and trust segmentation principles. https://www.esecurityplanet.com/artificial-intelligence/rsac-2026-rethinking-trust-in-agentic-ai-security/

### Blockchain Oracle Design

7. **Chainlink** — "The Blockchain Oracle Problem" (ongoing reference). Canonical description of oracle architecture: Fetch → Validate → Compute → Broadcast. Covers reputation systems, certification services, multi-source aggregation, and the challenge of bringing off-chain data on-chain trustlessly. https://chain.link/education-hub/oracle-problem

8. **Al-Breiki et al. / ResearchGate** — "Trustworthy Blockchain Oracles: Review, Comparison, and Open Research Challenges" (2020, widely cited through 2026). Comprehensive academic survey of oracle trust models including Chainlink, Witnet, Provable, TownCrier. Covers reputation-based, voting-based, and TEE-based trust approaches. https://www.researchgate.net/publication/341174793_Trustworthy_Blockchain_Oracles_Review_Comparison_and_Open_Research_Challenges

### AI Governance & Trust Maturity

9. **World Economic Forum** — "How to design for trust in the age of AI agents" (February 2026). Argues that durable trust requires "cognitive resonance" — legible reasoning and bounded agency — rather than persuasion. Proposes a layered trust stack for autonomous AI. https://www.weforum.org/stories/2026/02/how-to-design-for-trust-in-the-age-of-ai-agents/

10. **McKinsey** — "State of AI trust in 2026: Shifting to the agentic era" (March 2026). Survey of ~500 organizations. Average RAI maturity score of 2.3/5. Finds persistent gap between risks considered relevant and those being actively mitigated, especially for privacy and IP. Introduces agentic AI governance as a new maturity dimension. https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/tech-forward/state-of-ai-trust-in-2026-shifting-to-the-agentic-era

11. **Allianz** — "Responsible AI: Building Trust in Insurance" (March 2026). Eight overarching principles for responsible AI including human oversight, bias monitoring, and the principle of saying "no" to applications that would undermine trust even if technically feasible. https://www.allianz.com/en/mediacenter/news/articles/260318-responsible-use-of-ai-at-allianz.html

12. **Gartner TRiSM / ScienceDirect** — "TRiSM for Agentic AI: A review of Trust, Risk, and Security Management in LLM-based Agentic Multi-Agent Systems" (March 2026). Proposes risk taxonomy for agentic AI including coordination failures and prompt-based adversarial manipulation. Introduces Component Synergy Score (CSS) and Tool Utilization Efficacy (TUE) metrics. References NIST AI RMF and EU AI Act compliance obligations. https://www.sciencedirect.com/science/article/pii/S2666651026000069

### Privacy & Reputation Systems

13. **MDPI** — "A Review on Blockchain-Based Trust and Reputation Schemes in Metaverse Environments" (November 2025). Covers hybrid off-chain computation, privacy-preserving reputation aggregation (publishing only hashed values), data minimization, cross-chain reputation portability, and Metaverse Standards Forum interoperability schemas. https://www.mdpi.com/2410-387x/9/4/74

14. **Allen & Devaux** — "Privacy, AI, and the New Rules of Trust in 2026" (March 2026). Identifies four foundational pillars of responsible AI: identity, data, consent, and decision-making. Argues that trust in AI requires transparency and accountability beyond compliance checklists. https://www.allendevaux.com/post/ai-privacy-trust-governance-2026

### Agent Identity & Trust Scoring

15. **Chainlink** — "The Blockchain Oracle Problem" (ongoing). Specifically the section on reputation systems, certification services, and advanced cryptography/hardware requirements for trustworthy oracle operation. https://chain.link/education-hub/oracle-problem

16. **Harvard Business Review** — "Can AI Agents Be Trusted?" (May 2025). Argues personal AI agents should be treated as fiduciaries with legal and ethical standards prioritizing user interests. Recommends three-pronged approach: legal frameworks, market-based enforcement (insurance, monitoring), and local-first data design. https://hbr.org/2025/05/can-ai-agents-be-trusted

17. **ERC-8004 Specification** — "ERC-8004: Trustless Agents" (Ethereum Improvement Proposals). Defines Identity Registry (ERC-721 based), Reputation Registry (signed feedback with off-chain metadata), and Validation Registry (independent validator checks). The standard TrustAdd's scoring must interoperate with. https://eips.ethereum.org/EIPS/eip-8004

18. **x402 Discovery MCP Server (Community)** — "x402-discovery-mcp" by rplryan. Community-built Bazaar with 251+ services, health checks, facilitator compatibility, and ERC-8004 trust scoring. The existing discovery layer TrustAdd should complement. https://glama.ai/mcp/servers/@rplryan/x402-discovery-mcp

19. **Awesome ERC-8004 Repository** — Curated list of ERC-8004 ecosystem projects including MolTrust (x402 trust verification middleware), DJD Agent Score, AgentStamp, and Helixa Agent Skill. Maps the ecosystem TrustAdd operates within. https://github.com/sudeepb02/awesome-erc8004

### Additional Context

20. **OneReach AI** — "AI Governance Frameworks & Best Practices for Enterprises 2026" (March 2026). Nine guiding principles for AI governance frameworks including accountability, transparency, fairness, privacy, security, reliability, explainability, human oversight, and sustainability. https://onereach.ai/blog/ai-governance-frameworks-best-practices/

21. **Medium / Raktim Singh** — "AI Agent Identity & Zero-Trust: The 2026 Playbook" (January 2026). Applies NIST 800-207 Zero Trust to AI agent governance. Notes that non-human identities outnumber human users 100:1 and that traditional IAM was never designed for autonomous agents. https://medium.com/@raktims2210/ai-agent-identity-zero-trust-the-2026-playbook-for-securing-autonomous-systems-in-banks-e545d077fdff

22. **HUMAN Security** — "AgenticTrust: The Trust Layer for Agentic Commerce" (January 2026). Introduces adaptive trust for AI agents — permission management, behavioral monitoring, and the principle that "a trusted AI agent today could become a liability tomorrow." https://www.humansecurity.com/learn/blog/agentictrust-govern-ai-agents/

---

*Document compiled April 2026. Research sources reflect the state of the field as of early-mid 2026. The agent trust ecosystem is evolving rapidly — revisit sources quarterly.*
