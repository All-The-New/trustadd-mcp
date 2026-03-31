import { storage } from "./storage";
import { log } from "./index";

const SEED_AGENTS = [
  {
    erc8004Id: "erc8004-agent-0xa1b2c3d4e5f6",
    primaryContractAddress: "0xa1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    controllerAddress: "0x1234567890abcdef1234567890abcdef12345678",
    name: "Aether Protocol Agent",
    description: "Autonomous DeFi portfolio rebalancing agent operating across Uniswap V3 and Aave V3. Specializes in yield optimization and risk-adjusted returns for liquidity providers.",
    claimed: true,
    firstSeenBlock: 19234567,
    lastUpdatedBlock: 19456789,
    capabilities: ["DeFi Trading", "Portfolio Rebalancing", "Yield Optimization", "Risk Management"],
    metadataUri: "ipfs://QmSomeHash1",
  },
  {
    erc8004Id: "erc8004-agent-0xb2c3d4e5f6a7",
    primaryContractAddress: "0xb2c3d4e5f6a70829314b5c6d7e8f90a1b2c3d4e5",
    controllerAddress: "0x2345678901bcdef02345678901bcdef023456789",
    name: "Sentinel Watcher",
    description: "On-chain security monitoring agent that tracks smart contract interactions for anomalous behavior patterns. Publishes transparent security signals for the community.",
    claimed: true,
    firstSeenBlock: 19156789,
    lastUpdatedBlock: 19478901,
    capabilities: ["Security Monitoring", "Anomaly Detection", "Alert Publishing", "Contract Analysis"],
    metadataUri: "ipfs://QmSomeHash2",
  },
  {
    erc8004Id: "erc8004-agent-0xc3d4e5f6a7b8",
    primaryContractAddress: "0xc3d4e5f6a7b80931425c6d7e8f90a1b2c3d4e5f6",
    controllerAddress: "0x3456789012cdef13456789012cdef1345678901",
    name: "Oracle Bridge Agent",
    description: "Data oracle agent that bridges off-chain market data to on-chain consumers. Provides price feeds for over 200 cryptocurrency pairs with verifiable data provenance.",
    claimed: false,
    firstSeenBlock: 19345678,
    lastUpdatedBlock: 19345678,
    capabilities: ["Price Oracle", "Data Bridging", "Market Data"],
    metadataUri: null,
  },
  {
    erc8004Id: "erc8004-agent-0xd4e5f6a7b8c9",
    primaryContractAddress: "0xd4e5f6a7b8c90a42536d7e8f90a1b2c3d4e5f6a7",
    controllerAddress: "0x4567890123def24567890123def245678901234",
    name: null,
    description: null,
    claimed: false,
    firstSeenBlock: 19467890,
    lastUpdatedBlock: 19467890,
    capabilities: null,
    metadataUri: null,
  },
  {
    erc8004Id: "erc8004-agent-0xe5f6a7b8c9d0",
    primaryContractAddress: "0xe5f6a7b8c9d00b53647e8f90a1b2c3d4e5f6a7b8",
    controllerAddress: "0x5678901234ef35678901234ef3567890123456",
    name: "Governance Delegate",
    description: "Automated governance participation agent for DAO voting across multiple protocols. Analyzes proposals, casts votes according to predefined policy frameworks, and publishes reasoning transparently.",
    claimed: true,
    firstSeenBlock: 19278901,
    lastUpdatedBlock: 19489012,
    capabilities: ["DAO Governance", "Proposal Analysis", "Vote Delegation", "Policy Execution"],
    metadataUri: "ipfs://QmSomeHash5",
  },
];

const SEED_EVENTS = [
  {
    erc8004Id: "erc8004-agent-0xa1b2c3d4e5f6",
    events: [
      {
        txHash: "0xabc123def456789012345678901234567890abcdef1234567890abcdef123456",
        blockNumber: 19234567,
        eventType: "AgentRegistered",
        rawData: { agentId: "erc8004-agent-0xa1b2c3d4e5f6", name: "Aether Protocol Agent", version: "1.0" },
      },
      {
        txHash: "0xdef456abc789012345678901234567890abcdef1234567890abcdef123456789",
        blockNumber: 19345678,
        eventType: "MetadataUpdated",
        rawData: { field: "description", previousValue: "DeFi rebalancing agent", newValue: "Autonomous DeFi portfolio rebalancing agent operating across Uniswap V3 and Aave V3." },
      },
      {
        txHash: "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
        blockNumber: 19400000,
        eventType: "ReputationUpdated",
        rawData: { module: "performance", signal: "uptime", value: "99.7%", period: "30d" },
      },
      {
        txHash: "0x456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123",
        blockNumber: 19456789,
        eventType: "EndorsementAdded",
        rawData: { endorser: "0x9876543210fedcba9876543210fedcba98765432", type: "operational_reliability", message: "Consistent performance over 6 months" },
      },
    ],
  },
  {
    erc8004Id: "erc8004-agent-0xb2c3d4e5f6a7",
    events: [
      {
        txHash: "0x789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345",
        blockNumber: 19156789,
        eventType: "AgentRegistered",
        rawData: { agentId: "erc8004-agent-0xb2c3d4e5f6a7", name: "Sentinel Watcher", version: "2.1" },
      },
      {
        txHash: "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        blockNumber: 19300000,
        eventType: "MetadataUpdated",
        rawData: { field: "capabilities", added: ["Alert Publishing"], removed: [] },
      },
      {
        txHash: "0xcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678901",
        blockNumber: 19478901,
        eventType: "ReputationUpdated",
        rawData: { module: "accuracy", signal: "true_positive_rate", value: "94.2%", period: "90d" },
      },
    ],
  },
  {
    erc8004Id: "erc8004-agent-0xc3d4e5f6a7b8",
    events: [
      {
        txHash: "0xef0123456789abcdef0123456789abcdef0123456789abcdef01234567890123",
        blockNumber: 19345678,
        eventType: "AgentRegistered",
        rawData: { agentId: "erc8004-agent-0xc3d4e5f6a7b8", name: "Oracle Bridge Agent", version: "1.0" },
      },
    ],
  },
  {
    erc8004Id: "erc8004-agent-0xd4e5f6a7b8c9",
    events: [
      {
        txHash: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        blockNumber: 19467890,
        eventType: "AgentRegistered",
        rawData: { agentId: "erc8004-agent-0xd4e5f6a7b8c9", registrationType: "automatic" },
      },
    ],
  },
  {
    erc8004Id: "erc8004-agent-0xe5f6a7b8c9d0",
    events: [
      {
        txHash: "0x23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01",
        blockNumber: 19278901,
        eventType: "AgentRegistered",
        rawData: { agentId: "erc8004-agent-0xe5f6a7b8c9d0", name: "Governance Delegate", version: "3.0" },
      },
      {
        txHash: "0x456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123",
        blockNumber: 19380000,
        eventType: "IdentityUpdated",
        rawData: { field: "policyFramework", value: "Conservative DeFi Governance v2" },
      },
      {
        txHash: "0x6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345",
        blockNumber: 19489012,
        eventType: "EndorsementAdded",
        rawData: { endorser: "0xfedcba9876543210fedcba9876543210fedcba98", type: "governance_expertise", message: "Active and thoughtful voting participation" },
      },
    ],
  },
];

export async function seedDatabase() {
  try {
    const existingAgents = await storage.getAgents({ limit: 1 });
    if (existingAgents.total > 0) {
      log("Database already seeded, skipping", "seed");
      return;
    }

    log("Seeding database with sample ERC-8004 agents...", "seed");

    for (const agentData of SEED_AGENTS) {
      const agent = await storage.createAgent(agentData);

      const agentEvents = SEED_EVENTS.find((e) => e.erc8004Id === agentData.erc8004Id);
      if (agentEvents) {
        for (const eventData of agentEvents.events) {
          await storage.createAgentEvent({
            agentId: agent.id,
            txHash: eventData.txHash,
            blockNumber: eventData.blockNumber,
            eventType: eventData.eventType,
            rawData: eventData.rawData,
          });
        }
      }

      log(`Seeded agent: ${agent.name || agent.erc8004Id}`, "seed");
    }

    await storage.getIndexerState();
    await storage.updateIndexerState({
      lastProcessedBlock: 19500000,
      isRunning: false,
    });

    log("Database seeding complete", "seed");
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}
