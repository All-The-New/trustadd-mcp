import type { LucideIcon } from "lucide-react";
import {
  Shield,
  Layers,
  Eye,
  Star,
  Globe,
  Bot,
  Zap,
  Network,
  FileCode,
  Wrench,
  MessageSquare,
} from "lucide-react";

export const HOME = {
  hero: {
    tag: "The Trust Oracle for the Agent Economy",
    title: "The Trust Oracle for the",
    titleAccent: "Agent Economy",
    subtitle:
      "Before your agent transacts, it checks TrustAdd. We index identity, payments, and reputation across 9 chains into a single trust verdict — queryable by any agent via x402 micropayment.",
    ctaPrimary: "Explore Agents",
    ctaSecondary: "Trust API",
  },
  features: [
    {
      icon: "Shield" as const,
      title: "Trust Intelligence On Demand",
      desc: "Agents query TrustAdd before transacting — like a credit check for the agent economy. Quick verdicts from $0.01 USDC, full evidence reports from $0.05.",
    },
    {
      icon: "Layers" as const,
      title: "Cross-Layer Intelligence",
      desc: "The only oracle combining ERC-8004 identity, x402 payment data, marketplace analytics, and community signals into one composite trust score.",
    },
    {
      icon: "Bot" as const,
      title: "Built for Agents, Readable by Humans",
      desc: "Machine-queryable Trust API via x402 and MCP. Free ecosystem analytics for developers and researchers exploring the agent economy.",
    },
  ],
  pillars: {
    heading: "Five Dimensions of Agent Trust",
    subtitle:
      "Every trust verdict is computed from five signal categories, weighted to reflect what matters most for autonomous decision-making.",
    items: [
      {
        icon: "Shield" as const,
        title: "Identity & Capability",
        desc: "On-chain identity completeness, declared skills, endpoints, x402 payment support. Agents with verifiable identity and clear capabilities score higher.",
        badge: "Identity + Capability",
        badgeVariant: "live" as const,
      },
      {
        icon: "Star" as const,
        title: "Community & Reputation",
        desc: "GitHub health, Farcaster engagement, on-chain feedback. Real-world signals from people and systems that interact with agents.",
        badge: "Community",
        badgeVariant: "monitoring" as const,
      },
      {
        icon: "Eye" as const,
        title: "History & Transparency",
        desc: "Registration longevity, multi-chain presence, decentralized storage, trust mechanism declarations. Transparency signals accountability.",
        badge: "History + Transparency",
        badgeVariant: "live" as const,
      },
    ],
  },
  api: {
    title: "Trust Oracle API",
    desc: "Agents query TrustAdd before transacting. Ecosystem analytics are free and open. Trust intelligence starts at $0.01 per query via x402 micropayment on Base.",
    cta: "View Trust API",
  },
  topTrusted: {
    heading: "Top Trusted Agents",
    viewAll: "View all agents",
    emptyState: "Trust scores are being calculated. Check back soon.",
  },
  recentlyDiscovered: {
    heading: "Recently Discovered",
    viewAll: "View all agents",
  },
  liveIndexing: {
    heading: "Live Indexing",
  },
  emptyState:
    "The oracle is scanning blockchains for AI agent identities. Agents will appear here automatically as they are discovered.",
};

export const STATS = {
  agentsLabel: "Agents Indexed",
  metadataLabel: "Oracle Verified",
  x402Label: "x402 Active",
  blockLabel: "Last Block",
};

export const ABOUT = {
  header: {
    title: "About TrustAdd",
    subtitle:
      "The trust oracle for the agent economy. We believe trust should be measurable, transparent, and queryable by any agent.",
  },
  mission: {
    title: "Our Mission",
    paragraphs: [
      "As AI agents transact autonomously, knowing which ones to trust is critical infrastructure. TrustAdd is the trust oracle — agents query us before transacting, the way financial systems query credit bureaus before lending.",
      "We index identity, payments, and reputation signals from ERC-8004, x402, and emerging standards across 9 EVM chains. We combine them into a single, transparent trust verdict — available to any agent via x402 micropayment, and to any human through our free analytics dashboard.",
    ],
  },
  score: {
    title: "How the TrustAdd Score Works",
    intro:
      "Every indexed agent receives a TrustAdd Score from 0 to 100, computed from five categories of on-chain and off-chain signals. The score powers trust verdicts: TRUSTED, CAUTION, UNTRUSTED, or UNKNOWN.",
  },
  principles: {
    title: "Principles",
    items: [
      {
        title: "Neutral & Verifiable",
        desc: "We present data as-is. No endorsements, no manipulation. The scoring formula is applied equally to every agent, and the methodology is published openly.",
      },
      {
        title: "Open Ecosystem, Paid Intelligence",
        desc: "Ecosystem analytics are free — no auth required. Per-agent trust intelligence is available via x402 micropayment, from $0.01 per query. We charge for intelligence, not access.",
      },
      {
        title: "Discovery-First",
        desc: "We find agents automatically by scanning blockchains and indexing protocol events. No manual submissions, no gatekeeping. If it's on-chain, TrustAdd finds it.",
      },
    ],
  },
  protocols: {
    title: "Supported Protocols",
    intro:
      "TrustAdd indexes agent data from multiple protocols. Each feeds different trust signals into the oracle.",
  },
};

export const PROTOCOLS = {
  pageTitle: "Protocols",
  pageSubtitle:
    "TrustAdd indexes agent identity, payments, and capability data from multiple protocols — feeding trust signals into the oracle.",
  items: [
    {
      id: "erc-8004",
      name: "ERC-8004",
      tagline: "On-Chain Identity Registry",
      icon: "Shield" as const,
      description:
        "An Ethereum standard that gives every AI agent a unique, verifiable on-chain identity. Each identity is an NFT owned by the agent's controller, pointing to a metadata file with the agent's name, description, capabilities, and endpoints.",
      howItWorks:
        "Agents are registered through an Identity Registry smart contract deployed on each chain. The registry emits events when agents register, update metadata, or receive reputation feedback. TrustAdd monitors these events in real-time.",
      whatWeTrack: [
        "Agent registration and identity metadata",
        "Metadata updates and versioning",
        "Reputation feedback from other agents",
        "Controller ownership changes",
      ],
      chains: ["Ethereum", "Base", "Polygon", "Arbitrum", "BNB Chain", "Celo", "Gnosis", "Optimism", "Avalanche"],
      status: "live" as const,
      scoreCategories: ["Identity", "History", "Transparency"],
    },
    {
      id: "x402",
      name: "x402 / HTTP 402",
      tagline: "Agent Payment Protocol",
      icon: "Zap" as const,
      description:
        "A payment protocol that lets AI agents charge for their services using the HTTP 402 status code. When an agent's endpoint returns a 402 response, it signals that payment is required and includes pricing information.",
      howItWorks:
        "TrustAdd probes agent HTTP endpoints looking for 402 responses with payment headers. When found, it records the payment address, accepted tokens, and pricing. It then tracks on-chain transactions to those payment addresses.",
      whatWeTrack: [
        "x402-enabled endpoint discovery",
        "Payment address and accepted tokens",
        "On-chain transaction volume (USDC, USDT, DAI, WETH, ETH)",
        "Endpoint availability and response patterns",
      ],
      chains: ["Ethereum", "Base", "Polygon", "Arbitrum", "BNB Chain", "Celo", "Gnosis", "Optimism", "Avalanche"],
      status: "live" as const,
      scoreCategories: ["Capability"],
    },
    {
      id: "oasf",
      name: "OASF",
      tagline: "Open Agent Skills Framework",
      icon: "FileCode" as const,
      description:
        "A standard for agents to declare their capabilities and skills in a machine-readable format. OASF lets agents publish what they can do so other agents and platforms can discover and utilize their services.",
      howItWorks:
        "Agents include OASF skill declarations in their metadata. TrustAdd parses these declarations to understand what each agent is capable of, feeding capability signals into the trust score.",
      whatWeTrack: [
        "Declared skills and capabilities",
        "Skill categories and descriptions",
        "Endpoint associations per skill",
      ],
      chains: ["Protocol-agnostic"],
      status: "live" as const,
      scoreCategories: ["Capability"],
    },
    {
      id: "mcp",
      name: "MCP",
      tagline: "Model Context Protocol",
      icon: "Wrench" as const,
      description:
        "A protocol for exposing tools and data sources to language models. MCP-compatible agents can serve as tool providers, giving other AI systems structured access to their capabilities.",
      howItWorks:
        "Agents that support MCP declare tool endpoints in their metadata. TrustAdd detects MCP declarations and considers them a capability signal in the trust score.",
      whatWeTrack: [
        "MCP tool declarations",
        "Endpoint availability",
      ],
      chains: ["Protocol-agnostic"],
      status: "tracking" as const,
      scoreCategories: ["Capability"],
    },
    {
      id: "a2a",
      name: "A2A",
      tagline: "Agent-to-Agent Communication",
      icon: "Network" as const,
      description:
        "A communication protocol enabling direct, structured interactions between AI agents. A2A provides standardized message formats and discovery mechanisms for multi-agent workflows.",
      howItWorks:
        "Agents that support A2A publish agent cards describing their capabilities and communication endpoints. TrustAdd indexes these declarations as part of its capability assessment.",
      whatWeTrack: [
        "A2A agent card declarations",
        "Communication endpoint availability",
      ],
      chains: ["Protocol-agnostic"],
      status: "tracking" as const,
      scoreCategories: ["Capability"],
    },
  ],
  emerging: {
    title: "Emerging Standards",
    description:
      "We're actively monitoring new agent protocols and standards as they develop. As these mature and gain adoption, TrustAdd will integrate their signals into the trust score.",
    items: [
      "Olas — Autonomous agent framework with on-chain service registries",
      "Virtuals Protocol — Agent tokenization and trading platform",
      "Twitter/X Sentiment — Social reputation signals from agent-related discussions",
      "Agent Claiming — Verified operator identity and context",
    ],
  },
};

export const API_DOCS = {
  seo: {
    title: "API Documentation",
    description:
      "REST API for the agent economy. Free ecosystem analytics, plus x402-gated trust intelligence from $0.01 per query.",
  },
  intro:
    "TrustAdd provides two API tiers. Ecosystem analytics are free and open — no authentication required. Per-agent trust intelligence (scores, verdicts, breakdowns, evidence) is available via x402 micropayment.",
  usageNotes: {
    dataSource:
      "Data is sourced from 9 EVM chains via ERC-8004, x402, OASF, and community signals. Data freshness depends on indexer status. Use the chainId parameter to filter by chain.",
  },
};

export const ANALYTICS = {
  seo: {
    title: "Ecosystem Analytics",
    description:
      "Free, live analytics across the AI agent economy — trust score distributions, chain metrics, protocol adoption, and ecosystem growth trends.",
  },
  subtitle: "Free, live insights across the AI agent economy",
};

export const ECONOMY = {
  seo: {
    title: "Agent Economy",
    description:
      "Explore the x402 agent payment ecosystem. Transaction volumes, payment adoption, top-earning agents, and economic trends across 9 EVM chains.",
  },
};

export const SKILLS = {
  seo: {
    title: "Agent Skills & Capabilities",
    description:
      "What AI agents can do. Browse capabilities, skill categories, trust correlations, and the most capable agents in the ecosystem.",
  },
  subtitle: "What agents can do across protocols and chains",
};

export const STATUS = {
  seo: {
    title: "Oracle Status",
    description:
      "Live monitoring of TrustAdd's multi-chain oracle. Indexer health, per-chain progress, and system alerts.",
  },
};

export const DIRECTORY = {
  seo: {
    title: "Agent Directory",
    description:
      "Browse all AI agent identities discovered by the TrustAdd oracle across 9 EVM chains. Filter by chain, protocol support, and trust verdict.",
  },
  emptyState:
    "The oracle is scanning for AI agent identities. Agents will appear here as they are discovered.",
  subtitle: (total: number, chainCount: number) =>
    total > 0
      ? `${total.toLocaleString()} agents indexed across ${chainCount} chains`
      : "Discovering AI agent identities across supported chains",
};

export const PROFILE = {
  defaultDescription: (chainName: string) =>
    `This agent was discovered by the TrustAdd oracle on ${chainName}. No additional description has been provided.`,
  defaultSeoDescription: (erc8004Id: string | number, chainName: string) =>
    `AI agent #${erc8004Id} on ${chainName}. Trust verdict, score breakdown, and on-chain history from TrustAdd.`,
  reputationEmpty:
    "This agent hasn't received on-chain reputation feedback yet. As the protocol ecosystem matures, endorsements from other agents and users will appear here.",
  statusDiscovery: "Discovered automatically via on-chain indexing",
};

export const METHODOLOGY = {
  header: {
    title: "Scoring Methodology",
    subtitle:
      "The TrustAdd Score measures interaction risk — the likelihood that a transaction with an agent will go wrong. Trust is earned through verifiable behavior, not self-reported metadata.",
  },
  overview: {
    title: "What the Score Measures",
    paragraphs: [
      "The TrustAdd Score answers one question: what is the risk of this interaction going wrong? When Agent A is about to pay Agent B for a service, the score predicts whether that transaction will result in value delivered.",
      "This is a behavioral risk assessment — not a profile completeness metric. An agent with a perfect profile but zero transactions has not earned trust. It has set up well. Those are different things.",
      "Scores are recalculated daily and on-demand. The same formula is applied to every agent — no manual overrides, no special treatment. Methodology changes are versioned and published.",
    ],
  },
  ecosystemNotice:
    "The AI agent economy is in its earliest stages. Most agents have limited or no transaction history, which means most Trust Ratings reflect profile data rather than verified behavioral evidence. As x402 payments and ERC-8004 attestations grow, Trust Ratings will become increasingly meaningful. TrustAdd is building the measurement infrastructure now so it's ready when the data arrives.",
  categories: [
    {
      name: "Transaction Activity",
      shortName: "Transactions",
      icon: "Coins" as const,
      maxPoints: 35,
      color: "bg-emerald-500",
      type: "behavioral" as const,
      description:
        "Does this agent actually do business? Measures inbound x402 payment volume, transaction frequency, payer diversity, and endpoint liveness. The hardest signal to fake — generating real payment volume costs real money.",
      signals: [
        { name: "x402 payment volume", condition: "Any / $100+ / $1,000+", points: "+5 / +10 / +15" },
        { name: "Transaction count", condition: "5+ / 20+ / 50+", points: "+3 / +5 / +8" },
        { name: "Payer diversity", condition: "3+ unique / 10+ unique", points: "+3 / +5" },
        { name: "x402 endpoint live", condition: "Responds with 402 headers", points: "+5" },
        { name: "Payment address verified", condition: "On-chain payment address discovered", points: "+2" },
      ],
    },
    {
      name: "Reputation & Attestations",
      shortName: "Reputation",
      icon: "Award" as const,
      maxPoints: 25,
      color: "bg-cyan-500",
      type: "behavioral" as const,
      description:
        "Have others formally vouched for this agent? On-chain attestations via the ERC-8004 reputation registry are verifiable and permanent. This is the formal feedback mechanism — the only signal that captures 'was the customer satisfied?'",
      signals: [
        { name: "Attestations received", condition: "1+ / 5+ / 10+ / 25+", points: "+3 / +7 / +12 / +18" },
        { name: "Attestor diversity", condition: "3+ unique / 10+ unique attestors", points: "+3 / +7" },
      ],
    },
    {
      name: "Agent Profile",
      shortName: "Profile",
      icon: "Shield" as const,
      maxPoints: 15,
      color: "bg-indigo-500",
      type: "supporting" as const,
      description:
        "Is this a real, identifiable agent? Profile completeness, visual identity, endpoint declarations, and metadata storage. Important for discovery — but setting up a good profile alone doesn't prove trustworthiness.",
      signals: [
        { name: "Profile image", condition: "Valid image URL", points: "+5" },
        { name: "Description quality", condition: "30+ chars / 100+ chars", points: "+1 / +2" },
        { name: "Name", condition: "Non-empty, trimmed", points: "+2" },
        { name: "Endpoints", condition: "At least one declared", points: "+2" },
        { name: "Skills / Tags", condition: "OASF skills or tags present", points: "+1" },
        { name: "Metadata storage", condition: "HTTPS / IPFS or Arweave", points: "+1 / +2" },
        { name: "Active status", condition: "Marked active on-chain", points: "+1" },
      ],
    },
    {
      name: "Longevity & Consistency",
      shortName: "Longevity",
      icon: "Clock" as const,
      maxPoints: 15,
      color: "bg-violet-500",
      type: "supporting" as const,
      description:
        "Has this agent been active and consistent over time? Time alone is insufficient — the highest signals require evidence of activity during that time. An agent registered 90 days ago with no transactions gets minimal credit.",
      signals: [
        { name: "Registration age", condition: "7+ days / 30+ / 90+", points: "+1 / +2 / +4" },
        { name: "Metadata maintenance", condition: "1+ events / 3+ events", points: "+1 / +3" },
        { name: "Cross-chain presence", condition: "2+ chains / 3+ chains", points: "+2 / +3" },
        { name: "Time since first tx", condition: "Any / 30+ days / 90+ days", points: "+2 / +3 / +5" },
      ],
    },
    {
      name: "Community",
      shortName: "Community",
      icon: "Users" as const,
      maxPoints: 10,
      color: "bg-amber-500",
      type: "supporting" as const,
      description:
        "Is there external signal about this agent? GitHub project health, Farcaster engagement, and community presence. A bonus — agents can reach the highest tiers without any community signals, but community presence helps differentiate in the mid-range.",
      signals: [
        { name: "GitHub health", condition: "Score > 0 / 40+ / 70+", points: "+1 / +3 / +5" },
        { name: "Farcaster engagement", condition: "Score > 0 / 0.4+ / 0.7+", points: "+1 / +2 / +3" },
        { name: "Community sources", condition: "Any verified source", points: "+2" },
      ],
    },
  ],
  principles: [
    {
      title: "Behavioral First",
      desc: "60% of the score comes from blockchain-verifiable behavioral signals — transactions, attestations, endpoint liveness. Profile metadata alone cannot earn a high Trust Rating.",
    },
    {
      title: "Equal Application",
      desc: "The same formula is applied to every agent. No manual overrides, no premium tiers, no special treatment. The methodology is the product.",
    },
    {
      title: "Honest About Gaps",
      desc: "When data is missing, we say so. 'Insufficient Data' is not a failure — it's an honest assessment. We'd rather under-rate a legitimate agent temporarily than over-rate a risky one.",
    },
    {
      title: "Observable Inputs Only",
      desc: "Every signal can be independently verified — on-chain events, public metadata, open-source repos, protocol-level signals. No private data, no secret sauce.",
    },
    {
      title: "Versioned Evolution",
      desc: "Methodology changes are versioned, announced, and published with rationale. All scores recalculate on version bumps. You can always understand what produced a score and when.",
    },
    {
      title: "Gaming Resistance",
      desc: "The highest-weighted signals are the hardest to fake. Generating real payment volume with diverse payers costs real money. Trust is expensive to manufacture.",
    },
  ],
};

export const PRINCIPLES = {
  header: {
    title: "Our Principles",
    subtitle:
      "Trust oracles earn trust the same way they measure it — through transparency, honesty about limitations, and a refusal to cut corners. These are the commitments that govern how TrustAdd operates.",
  },
  sections: [
    {
      icon: "Eye" as const,
      title: "We Tell You Exactly What We Know — and What We Don't",
      paragraphs: [
        "When TrustAdd produces a trust verdict, we show you every signal that went into it. If a data source was unavailable, we say so — we never silently drop it and pretend everything is fine.",
        "Every assessment includes what was checked, what wasn't, and how fresh the data is. We use language like \"based on available signals\" rather than \"this agent is safe.\" Because absence of negative evidence isn't the same as positive evidence — and we won't pretend it is.",
      ],
      commitment:
        "You'll never have to guess what a TrustAdd score is based on. The evidence is always inspectable.",
    },
    {
      icon: "Layers" as const,
      title: "We Separate Facts from Opinions",
      paragraphs: [
        "TrustAdd produces two kinds of output: observable facts and computed judgments. We treat them as fundamentally different.",
        "Facts are things anyone can verify independently — whether an agent has an on-chain identity, when it was registered, how many transactions it's processed. Judgments are what our algorithm computes from those facts — the trust score, the verdict, the risk level.",
        "Trust reports include both the raw evidence and our interpretation. You can always look past our judgment and examine the underlying signals yourself.",
      ],
      commitment:
        "Our scores are one interpretation of the data. We'll never hide the data behind the score.",
    },
    {
      icon: "FileText" as const,
      title: "Every Score Has a Receipt",
      paragraphs: [
        "Every trust assessment includes a hash of the input signals that produced it, so we can prove what data we had at the time. Trust reports record the timestamp, the scoring version, and the provenance of every data point.",
        "We're building toward a full append-only scoring history — where every score change is preserved alongside its predecessor. The goal is that anyone can audit what TrustAdd reported about any agent at any point in time.",
      ],
      commitment:
        "Provenance and traceability. You should always be able to understand what produced a score and when.",
    },
    {
      icon: "AlertTriangle" as const,
      title: "When Something Breaks, We Tell You",
      paragraphs: [
        "TrustAdd depends on external data sources — blockchain RPCs, on-chain registries, community platforms. Any of them can go down at any time.",
        "When a data source fails, we don't keep showing the last good result as if nothing happened. We mark that signal as stale or unavailable, adjust confidence accordingly, and show you a clear freshness indicator. Green means current, yellow means stale, red means failed.",
        "If our own systems detect something seriously wrong — a data pipeline failure, anomalous scoring across many agents at once — we stop serving fresh scores entirely rather than serve potentially wrong ones.",
      ],
      commitment:
        "We'd rather tell you we don't know than tell you something wrong.",
    },
    {
      icon: "Shield" as const,
      title: "We Assume Someone Is Trying to Game the System",
      paragraphs: [
        "If trust scores influence real economic decisions, they become an attack surface. We design for that from day one.",
        "We think about actors who might create fake identities, generate artificial payment volume, coordinate sybil attacks across wallet clusters, or stand up healthy-looking services just long enough to get a good score. Not every threat is mitigated today, but every threat is documented, and our data model is designed to support the detection work ahead.",
      ],
      commitment:
        "We take adversarial resilience seriously and we're transparent about what we've built defenses for and what's still on the roadmap.",
    },
    {
      icon: "Scale" as const,
      title: "New Agents Start at Zero, Not Neutral",
      paragraphs: [
        "Our scoring is intentionally conservative. A brand-new agent with no history doesn't get the benefit of the doubt — it starts at \"Unknown\" or \"Insufficient Data.\" Trust is earned through consistent positive signals over time.",
        "The score is purely additive — agents start at zero and earn points for each verifiable signal. There are no shortcuts. An agent needs strong evidence across multiple dimensions to reach a high score, because the cost of over-trusting a bad actor is higher than the cost of being slow to recognize a good one.",
      ],
      commitment:
        "We'd rather under-rate a legitimate agent temporarily than over-rate a risky one. Conservative by default.",
    },
    {
      icon: "BookOpen" as const,
      title: "We Publish How It Works",
      paragraphs: [
        "Our scoring methodology is public. The signals we check, the categories we weight, how verdicts are computed — all published, all versioned. When we change the algorithm, we publish the changelog with our rationale.",
        "What we protect is the aggregated dataset — the historical snapshots, cross-referenced signals, and trend data we've collected over time. The method is open; the data we've assembled is the product.",
      ],
      commitment:
        "You can always understand how a score was computed. No black boxes.",
    },
    {
      icon: "GitBranch" as const,
      title: "We Don't Trust a Single Source",
      paragraphs: [
        "A trust oracle that relies on a single data source is just a proxy, not an oracle. The value comes from cross-referencing.",
        "Where possible, we verify trust signals through multiple independent paths. When sources agree, our confidence is higher. When they disagree, we flag the conflict and lower confidence rather than silently choosing one. If a dimension only has a single source, we label it accordingly.",
      ],
      commitment:
        "We triangulate wherever we can, and we're honest about where we can't.",
    },
    {
      icon: "Info" as const,
      title: "We Know What We're Not",
      paragraphs: [
        "TrustAdd is a data aggregation and signal processing service. We save agents time by pre-computing trust signals from across the ecosystem.",
        "We are not a guarantee of safety. We are not a substitute for due diligence on high-value transactions. We don't perform audits — we aggregate audit signals from others. We don't provide insurance, and we don't have authority to block or delist services.",
        "Trust reports include explicit disclaimers and provenance metadata. Not hidden in fine print — visible alongside the data that matters.",
      ],
      commitment:
        "We'll never overstate what a TrustAdd score means. Honest boundaries build more trust than inflated promises.",
    },
    {
      icon: "Network" as const,
      title: "We Build for the Ecosystem",
      paragraphs: [
        "TrustAdd exists within a broader trust ecosystem — ERC-8004 registries, validation networks, community tools. We're designed to complement these systems, not replace them.",
        "We use standard identifiers, expose data in interoperable formats, and follow emerging agent framework standards. An agent should always be able to cross-reference our assessment against the underlying public data. No lock-in, no proprietary walls around the evidence.",
      ],
      commitment:
        "We're one voice in the trust ecosystem, not the only one. And that makes the whole system stronger.",
    },
  ],
  closing: {
    tagline: "Trust is built the same way it's measured.",
    body: "These principles aren't aspirational — they're engineering constraints. Every API response, every scoring algorithm, and every data pipeline decision at TrustAdd is held to these standards.",
  },
};

export const NAV = {
  footer: {
    tagline:
      "The trust oracle for the agent economy.",
  },
};

export const SEO = {
  landing: {
    title: "The Trust Oracle for the Agent Economy",
    description:
      "TrustAdd is the trust oracle for AI agents. We index identity, payments, and reputation across 9 EVM chains into queryable trust verdicts — from $0.01 per query via x402.",
  },
  about: {
    title: "About",
    description:
      "Learn about TrustAdd's mission as the trust oracle for the agent economy, the TrustAdd Score methodology, and our open, verifiable approach to agent trust.",
  },
  protocols: {
    title: "Protocols",
    description:
      "Protocols powering the TrustAdd oracle — ERC-8004 identity, x402 payments, OASF skills, MCP tools, A2A communication.",
  },
  trustApi: {
    title: "Trust API",
    description:
      "Query the TrustAdd oracle. Quick trust checks from $0.01 USDC, full evidence reports from $0.05. Paid via x402 micropayment on Base. Free ecosystem analytics included.",
  },
  methodology: {
    title: "Scoring Methodology v2",
    description:
      "How TrustAdd measures agent trust. Behavioral-first scoring: 60% from verified transactions and attestations, 40% from profile and community signals. Six trust tiers from Verified to Flagged.",
  },
  principles: {
    title: "Our Principles",
    description:
      "The design principles that govern how TrustAdd builds trust infrastructure for the AI agent economy. Transparency, epistemic honesty, and conservative scoring.",
  },
};
