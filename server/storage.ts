import {
  type Agent,
  type InsertAgent,
  type AgentMetadataEvent,
  type InsertAgentMetadataEvent,
  type IndexerState,
  type IndexerEvent,
  type InsertIndexerEvent,
  type IndexerMetric,
  type InsertIndexerMetric,
  type CommunityFeedbackSource,
  type InsertCommunityFeedbackSource,
  type CommunityFeedbackItem,
  type InsertCommunityFeedbackItem,
  type CommunityFeedbackSummary,
  type InsertCommunityFeedbackSummary,
  type X402Probe,
  type InsertX402Probe,
  type AgentTransaction,
  type InsertAgentTransaction,
  type BazaarService,
  type InsertBazaarService,
  type BazaarSnapshot,
  type InsertBazaarSnapshot,
} from "../shared/schema.js";
import * as agentQueries from "./storage/agents.js";
import * as indexerQueries from "./storage/indexer.js";
import * as feedbackQueries from "./storage/feedback.js";
import * as analyticsQueries from "./storage/analytics.js";

export interface AgentQueryOptions {
  limit?: number;
  offset?: number;
  search?: string;
  filter?: "all" | "claimed" | "unclaimed" | "has-metadata" | "x402-enabled" | "has-reputation" | "has-feedback";
  chainId?: number;
  sort?: "newest" | "oldest" | "trust-score" | "name";
  minTrustScore?: number;
  excludeSpam?: boolean;
}

export interface PaginatedAgents {
  agents: Agent[];
  total: number;
  limit: number;
  offset: number;
}

export interface IStorage {
  getAgents(options?: AgentQueryOptions): Promise<PaginatedAgents>;
  getAllAgents(chainId?: number): Promise<Agent[]>;
  getAgentsForReResolve(chainId: number): Promise<Array<Pick<Agent, 'id' | 'metadataUri' | 'tags' | 'oasfSkills'>>>;
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentByErc8004Id(erc8004Id: string, chainId: number): Promise<Agent | undefined>;
  getAgentByContractAddress(address: string, chainId: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: string): Promise<void>;
  getAgentIdsForSitemap(): Promise<Array<{ id: string; slug: string | null; updatedAt: Date | null }>>;

  getAgentEvents(agentId: string): Promise<AgentMetadataEvent[]>;
  createAgentEvent(event: InsertAgentMetadataEvent): Promise<AgentMetadataEvent>;
  getEventByTxHash(txHash: string, eventType: string, chainId?: number): Promise<AgentMetadataEvent | undefined>;
  getEventByAgentAndTxHash(agentId: string, txHash: string, eventType: string): Promise<AgentMetadataEvent | undefined>;

  getIndexerState(chainId: number): Promise<IndexerState>;
  updateIndexerState(chainId: number, updates: Partial<IndexerState>): Promise<void>;

  getRecentEvents(limit?: number, chainId?: number): Promise<Array<{
    event: AgentMetadataEvent;
    agentName: string | null;
    agentImage: string | null;
    agentErc8004Id: string;
    agentId: string;
    agentSlug: string | null;
  }>>;

  getAgentFeedbackSummary(agentId: string): Promise<{
    feedbackCount: number;
    uniqueReviewers: number;
    firstFeedbackBlock: number | null;
    lastFeedbackBlock: number | null;
    events: AgentMetadataEvent[];
  }>;

  getStats(chainId?: number): Promise<{
    totalAgents: number;
    claimedAgents: number;
    totalEvents: number;
    lastProcessedBlock: number;
    isIndexerRunning?: boolean;
    lastError?: string | null;
    chainBreakdown?: Array<{
      chainId: number;
      totalAgents: number;
      lastProcessedBlock: number;
      isRunning: boolean;
      lastError: string | null;
    }>;
  }>;

  logIndexerEvent(event: InsertIndexerEvent): Promise<IndexerEvent>;
  getSpamRanges(chainId: number, afterBlock: number): Promise<Array<{ from: number; to: number }>>;
  getRecentIndexerEvents(limit?: number, chainId?: number, eventType?: string): Promise<IndexerEvent[]>;
  getIndexerEventCounts(sinceMinutes?: number, chainId?: number): Promise<Array<{ eventType: string; count: number }>>;
  recordMetricsPeriod(metrics: InsertIndexerMetric): Promise<IndexerMetric>;
  getMetricsHistory(chainId?: number, hours?: number): Promise<IndexerMetric[]>;
  pruneOldEvents(olderThanDays?: number): Promise<number>;
  pruneOldMetrics(olderThanDays?: number): Promise<number>;

  getCommunityFeedbackSources(agentId?: string, platform?: string): Promise<CommunityFeedbackSource[]>;
  createCommunityFeedbackSource(source: InsertCommunityFeedbackSource): Promise<CommunityFeedbackSource>;
  updateCommunityFeedbackSource(id: number, updates: Partial<CommunityFeedbackSource>): Promise<void>;
  getStaleSourcesForPlatform(platform: string, olderThanHours: number): Promise<CommunityFeedbackSource[]>;

  createCommunityFeedbackItem(item: InsertCommunityFeedbackItem): Promise<CommunityFeedbackItem | null>;
  getCommunityFeedbackItems(agentId: string, platform?: string, itemType?: string, limit?: number): Promise<CommunityFeedbackItem[]>;
  pruneOldFeedbackItems(olderThanDays: number, platform?: string): Promise<number>;

  getCommunityFeedbackSummary(agentId: string): Promise<CommunityFeedbackSummary | undefined>;
  upsertCommunityFeedbackSummary(agentId: string, data: Partial<InsertCommunityFeedbackSummary>): Promise<CommunityFeedbackSummary>;
  getAgentsWithCommunityFeedback(limit?: number, offset?: number): Promise<CommunityFeedbackSummary[]>;
  getCommunityFeedbackSummariesByAgentIds(agentIds: string[]): Promise<CommunityFeedbackSummary[]>;
  getCommunityFeedbackStats(): Promise<{ totalAgentsWithFeedback: number; totalItems: number; platformBreakdown: Array<{ platform: string; count: number }> }>;

  getTrustScoreLeaderboard(limit?: number, chainId?: number): Promise<Array<{ id: string; name: string | null; imageUrl: string | null; chainId: number; trustScore: number; trustScoreBreakdown: any; slug: string | null; primaryContractAddress: string | null; erc8004Id: string | null; description: string | null; x402Support: boolean | null; endpoints: any; qualityTier: string | null; spamFlags: any; lifecycleStatus: string | null }>>;
  getTrustScoreDistribution(chainId?: number): Promise<Array<{ bucket: string; count: number }>>;
  getTrustTierDistribution(): ReturnType<typeof import("./storage/agents.js").getTrustTierDistribution>;
  getTrustScoreStatsByChain(): Promise<Array<{ chainId: number; avgScore: number; agentCount: number }>>;

  getEconomyOverview(): Promise<{
    totalAgents: number;
    x402Agents: number;
    agentsWithEndpoints: number;
    chainsWithX402: number;
    endpointTypes: Array<{ type: string; count: number }>;
    chainBreakdown: Array<{ chainId: number; total: number; x402: number; withEndpoints: number; adoptionRate: number }>;
  }>;
  getTopX402Agents(limit?: number, chainId?: number): Promise<Array<{
    id: string; slug: string | null; name: string | null; imageUrl: string | null; chainId: number;
    trustScore: number | null; trustScoreBreakdown: any; endpoints: any; description: string | null;
  }>>;
  getEndpointAnalysis(): Promise<Array<{ type: string; count: number; percentage: number }>>;
  getX402AdoptionByChain(): Promise<Array<{
    chainId: number; totalAgents: number; x402Agents: number; adoptionRate: number;
    withEndpoints: number; avgTrustScore: number | null;
  }>>;

  createProbeResult(probe: InsertX402Probe): Promise<X402Probe>;
  getProbeResults(agentId?: string, limit?: number): Promise<X402Probe[]>;
  getProbeStats(): Promise<{ totalProbed: number; found402: number; uniquePaymentAddresses: number; lastProbeAt: Date | null }>;
  getAgentsWithPaymentAddresses(): Promise<Array<{
    agentId: string; agentName: string | null; agentSlug: string | null; chainId: number;
    paymentAddress: string; paymentNetwork: string | null; paymentToken: string | null; probedAt: Date;
  }>>;
  getStaleProbeAgentIds(olderThanHours: number): Promise<string[]>;
  getRecentProbeForEndpoint(agentId: string, endpointUrl: string): Promise<X402Probe | undefined>;

  createTransaction(tx: InsertAgentTransaction): Promise<AgentTransaction>;
  getTransactions(options?: { agentId?: string; limit?: number; offset?: number }): Promise<AgentTransaction[]>;
  getTransactionStats(): Promise<{
    totalTransactions: number; totalVolumeUsd: number; uniqueBuyers: number; uniqueSellers: number;
    volumeByChain: Array<{ chainId: number; volume: number; count: number }>;
  }>;
  getAgentTransactionStats(agentId: string): Promise<{
    totalVolume: number; txCount: number; uniquePayers: number; lastTxAt: Date | null;
  }>;
  getTopEarningAgents(limit?: number): Promise<Array<{
    agentId: string; agentName: string | null; agentSlug: string | null; chainId: number;
    totalVolume: number; txCount: number; imageUrl: string | null;
  }>>;
  getTransactionVolume(period: string): Promise<Array<{ date: string; volume: number; count: number }>>;
  getTransactionSyncState(address: string, chainId: number): Promise<{ lastSyncedBlock: number } | null>;
  upsertTransactionSyncState(address: string, chainId: number, block: number): Promise<void>;
  getMostRecentSyncTime(): Promise<Date | null>;
  getKnownPaymentAddresses(): Promise<Array<{ address: string; chainId: number; agentId: string }>>;

  getStatusSummary(): Promise<{
    proberStats: { totalProbed: number; found402: number; uniquePaymentAddresses: number; lastProbeAt: Date | null };
    txSyncStats: { addressCount: number; syncedCount: number; errorCount: number; lastSyncedAt: Date | null };
    discoveryStats: { agentsToday: number; agentsThisWeek: number; totalAgents: number };
    eventCounts24h: Array<{ chainId: number; eventType: string; count: number }>;
  }>;

  getQualitySummary(): Promise<{
    totalAgents: number;
    verifiedAgents: number;
    tierCounts: { high: number; medium: number; low: number; spam: number; archived: number; unclassified: number };
    spamFlagCounts: { whitespace_name: number; blank_uri: number; spec_uri: number; code_as_uri: number; test_agent: number; duplicate_template: number };
    trustDistribution: Array<{ bucket: string; count: number }>;
    perChainQuality: Array<{ chainId: number; chainName: string; total: number; high: number; medium: number; low: number; spam: number }>;
    lastUpdated: string;
  }>;

  getQualityOffenders(): Promise<{
    topSpamControllers: Array<{ address: string; agentCount: number; chains: number[]; topFlag: string }>;
    topSpamTemplates: Array<{ fingerprint: string; agentCount: number; controllerCount: number; sampleUri: string; uriType: string; chains: number[] }>;
    multiChainSpammers: Array<{ address: string; chainCount: number; agentCount: number; chains: number[] }>;
    topHighQualityControllers: Array<{ address: string; agentCount: number; chains: number[]; avgTrustScore: number; maxTrustScore: number }>;
    dailyRegistrations: Array<{ date: string; high: number; medium: number; low: number; spam: number }>;
    spamConcentration: { top20Count: number; totalSpam: number; top20Pct: number };
  }>;

  getProtocolStats(): Promise<{
    totalAgents: number;
    withMetadata: number;
    totalEvents: number;
    chainCount: number;
    erc8004: { registered: number; withMetadata: number; totalEvents: number; chainBreakdown: Array<{ chainId: number; count: number }> };
    x402: { enabled: number; adoptionRate: number; chainBreakdown: Array<{ chainId: number; count: number }> };
    oasf: { withSkills: number; withDomains: number; topSkillCategories: string[] };
    mcp: { declaring: number; adoptionRate: number };
    a2a: { declaring: number; adoptionRate: number };
  }>;

  // Bazaar (x402 marketplace)
  upsertBazaarService(data: InsertBazaarService): Promise<BazaarService>;
  upsertBazaarServices(data: InsertBazaarService[]): Promise<number>;
  markBazaarServicesInactive(seenCutoff: Date): Promise<number>;
  getBazaarServices(opts?: { category?: string; network?: string; search?: string; sortBy?: string; limit?: number; offset?: number }): Promise<{ services: BazaarService[]; total: number }>;
  getBazaarStats(): Promise<{
    totalServices: number;
    activeServices: number;
    categoryBreakdown: Array<{ category: string; count: number }>;
    networkBreakdown: Array<{ network: string; count: number }>;
    priceStats: { median: number | null; mean: number | null; min: number | null; max: number | null };
    totalPayToWallets: number;
  }>;
  getBazaarSnapshots(limit?: number): Promise<BazaarSnapshot[]>;
  createBazaarSnapshot(data: InsertBazaarSnapshot): Promise<BazaarSnapshot>;
  getBazaarTopServices(limit?: number): Promise<BazaarService[]>;
}

export class DatabaseStorage implements IStorage {
  // --- Agents ---
  getAgents(options?: AgentQueryOptions) { return agentQueries.getAgents(options); }
  getAgentIdsForSitemap() { return agentQueries.getAgentIdsForSitemap(); }
  getAllAgents(chainId?: number) { return agentQueries.getAllAgents(chainId); }
  getAgentsForReResolve(chainId: number) { return agentQueries.getAgentsForReResolve(chainId); }
  getAgent(id: string) { return agentQueries.getAgent(id); }
  getAgentByErc8004Id(erc8004Id: string, chainId: number) { return agentQueries.getAgentByErc8004Id(erc8004Id, chainId); }
  getAgentByContractAddress(address: string, chainId: number) { return agentQueries.getAgentByContractAddress(address, chainId); }
  createAgent(agent: InsertAgent) { return agentQueries.createAgent(agent); }
  updateAgent(id: string, updates: Partial<InsertAgent>) { return agentQueries.updateAgent(id, updates); }
  deleteAgent(id: string) { return agentQueries.deleteAgent(id); }
  getAgentEvents(agentId: string) { return agentQueries.getAgentEvents(agentId); }
  createAgentEvent(event: InsertAgentMetadataEvent) { return agentQueries.createAgentEvent(event); }
  getEventByTxHash(txHash: string, eventType: string, chainId?: number) { return agentQueries.getEventByTxHash(txHash, eventType, chainId); }
  getEventByAgentAndTxHash(agentId: string, txHash: string, eventType: string) { return agentQueries.getEventByAgentAndTxHash(agentId, txHash, eventType); }
  getRecentEvents(limit?: number, chainId?: number) { return agentQueries.getRecentEvents(limit, chainId); }
  getAgentFeedbackSummary(agentId: string, controllerAddress?: string | null) { return agentQueries.getAgentFeedbackSummary(agentId, controllerAddress); }
  getStats(chainId?: number) { return agentQueries.getStats(chainId); }
  getAnalyticsOverview() { return agentQueries.getAnalyticsOverview(); }
  getAnalyticsChainDistribution() { return agentQueries.getAnalyticsChainDistribution(); }
  getAnalyticsRegistrations() { return agentQueries.getAnalyticsRegistrations(); }
  getAnalyticsMetadataQuality() { return agentQueries.getAnalyticsMetadataQuality(); }
  getAnalyticsX402ByChain() { return agentQueries.getAnalyticsX402ByChain(); }
  getAnalyticsControllerConcentration() { return agentQueries.getAnalyticsControllerConcentration(); }
  getAnalyticsUriSchemes() { return agentQueries.getAnalyticsUriSchemes(); }
  getAnalyticsCategories() { return agentQueries.getAnalyticsCategories(); }
  getAnalyticsImageDomains() { return agentQueries.getAnalyticsImageDomains(); }
  getAnalyticsModels() { return agentQueries.getAnalyticsModels(); }
  getAnalyticsEndpointsCoverage() { return agentQueries.getAnalyticsEndpointsCoverage(); }
  getAnalyticsTopAgents() { return agentQueries.getAnalyticsTopAgents(); }
  getTrustScoreLeaderboard(limit?: number, chainId?: number) { return agentQueries.getTrustScoreLeaderboard(limit, chainId); }
  getTrustScoreDistribution(chainId?: number) { return agentQueries.getTrustScoreDistribution(chainId); }
  getTrustTierDistribution() { return agentQueries.getTrustTierDistribution(); }
  getTrustScoreStatsByChain() { return agentQueries.getTrustScoreStatsByChain(); }
  getEconomyOverview() { return agentQueries.getEconomyOverview(); }
  getTopX402Agents(limit?: number, chainId?: number) { return agentQueries.getTopX402Agents(limit, chainId); }
  getEndpointAnalysis() { return agentQueries.getEndpointAnalysis(); }
  getX402AdoptionByChain() { return agentQueries.getX402AdoptionByChain(); }
  getQualitySummary() { return agentQueries.getQualitySummary(); }
  getQualityOffenders() { return agentQueries.getQualityOffenders(); }
  getProtocolStats() { return agentQueries.getProtocolStats(); }
  getSkillsSummary() { return agentQueries.getSkillsSummary(); }
  getSkillsChainDistribution() { return agentQueries.getSkillsChainDistribution(); }
  getSkillsTopCapabilities(limit?: number) { return agentQueries.getSkillsTopCapabilities(limit); }
  getSkillsCategoryBreakdown() { return agentQueries.getSkillsCategoryBreakdown(); }
  getSkillsTrustCorrelation() { return agentQueries.getSkillsTrustCorrelation(); }
  getSkillsOasfOverview() { return agentQueries.getSkillsOasfOverview(); }
  getSkillsNotableAgents(limit?: number) { return agentQueries.getSkillsNotableAgents(limit); }

  // --- Indexer ---
  getIndexerState(chainId: number) { return indexerQueries.getIndexerState(chainId); }
  updateIndexerState(chainId: number, updates: Partial<IndexerState>) { return indexerQueries.updateIndexerState(chainId, updates); }
  logIndexerEvent(event: InsertIndexerEvent) { return indexerQueries.logIndexerEvent(event); }
  getSpamRanges(chainId: number, afterBlock: number) { return indexerQueries.getSpamRanges(chainId, afterBlock); }
  getRecentIndexerEvents(limit?: number, chainId?: number, eventType?: string) { return indexerQueries.getRecentIndexerEvents(limit, chainId, eventType); }
  getIndexerEventCounts(sinceMinutes?: number, chainId?: number) { return indexerQueries.getIndexerEventCounts(sinceMinutes, chainId); }
  recordMetricsPeriod(metrics: InsertIndexerMetric) { return indexerQueries.recordMetricsPeriod(metrics); }
  getMetricsHistory(chainId?: number, hours?: number) { return indexerQueries.getMetricsHistory(chainId, hours); }
  pruneOldEvents(olderThanDays?: number) { return indexerQueries.pruneOldEvents(olderThanDays); }
  pruneOldMetrics(olderThanDays?: number) { return indexerQueries.pruneOldMetrics(olderThanDays); }

  // --- Feedback ---
  getCommunityFeedbackSources(agentId?: string, platform?: string) { return feedbackQueries.getCommunityFeedbackSources(agentId, platform); }
  createCommunityFeedbackSource(source: InsertCommunityFeedbackSource) { return feedbackQueries.createCommunityFeedbackSource(source); }
  updateCommunityFeedbackSource(id: number, updates: Partial<CommunityFeedbackSource>) { return feedbackQueries.updateCommunityFeedbackSource(id, updates); }
  getStaleSourcesForPlatform(platform: string, olderThanHours: number) { return feedbackQueries.getStaleSourcesForPlatform(platform, olderThanHours); }
  createCommunityFeedbackItem(item: InsertCommunityFeedbackItem) { return feedbackQueries.createCommunityFeedbackItem(item); }
  getCommunityFeedbackItems(agentId: string, platform?: string, itemType?: string, limit?: number) { return feedbackQueries.getCommunityFeedbackItems(agentId, platform, itemType, limit); }
  pruneOldFeedbackItems(olderThanDays: number, platform?: string) { return feedbackQueries.pruneOldFeedbackItems(olderThanDays, platform); }
  getCommunityFeedbackSummary(agentId: string) { return feedbackQueries.getCommunityFeedbackSummary(agentId); }
  upsertCommunityFeedbackSummary(agentId: string, data: Partial<InsertCommunityFeedbackSummary>) { return feedbackQueries.upsertCommunityFeedbackSummary(agentId, data); }
  getAgentsWithCommunityFeedback(limit?: number, offset?: number) { return feedbackQueries.getAgentsWithCommunityFeedback(limit, offset); }
  getCommunityFeedbackSummariesByAgentIds(agentIds: string[]) { return feedbackQueries.getCommunityFeedbackSummariesByAgentIds(agentIds); }
  getCommunityFeedbackStats() { return feedbackQueries.getCommunityFeedbackStats(); }

  // --- Analytics ---
  createProbeResult(probe: InsertX402Probe) { return analyticsQueries.createProbeResult(probe); }
  getProbeResults(agentId?: string, limit?: number) { return analyticsQueries.getProbeResults(agentId, limit); }
  getProbeStats() { return analyticsQueries.getProbeStats(); }
  getAgentsWithPaymentAddresses() { return analyticsQueries.getAgentsWithPaymentAddresses(); }
  getStaleProbeAgentIds(olderThanHours: number) { return analyticsQueries.getStaleProbeAgentIds(olderThanHours); }
  getRecentProbeForEndpoint(agentId: string, endpointUrl: string) { return analyticsQueries.getRecentProbeForEndpoint(agentId, endpointUrl); }
  createTransaction(tx: InsertAgentTransaction) { return analyticsQueries.createTransaction(tx); }
  getTransactions(options?: { agentId?: string; limit?: number; offset?: number }) { return analyticsQueries.getTransactions(options); }
  getTransactionStats() { return analyticsQueries.getTransactionStats(); }
  getAgentTransactionStats(agentId: string) { return analyticsQueries.getAgentTransactionStats(agentId); }
  getTopEarningAgents(limit?: number) { return analyticsQueries.getTopEarningAgents(limit); }
  getTransactionVolume(period: string) { return analyticsQueries.getTransactionVolume(period); }
  getTransactionSyncState(address: string, chainId: number) { return analyticsQueries.getTransactionSyncState(address, chainId); }
  upsertTransactionSyncState(address: string, chainId: number, block: number) { return analyticsQueries.upsertTransactionSyncState(address, chainId, block); }
  getMostRecentSyncTime() { return analyticsQueries.getMostRecentSyncTime(); }
  getKnownPaymentAddresses() { return analyticsQueries.getKnownPaymentAddresses(); }
  getStatusSummary() { return analyticsQueries.getStatusSummary(); }
  upsertBazaarService(data: InsertBazaarService) { return analyticsQueries.upsertBazaarService(data); }
  upsertBazaarServices(data: InsertBazaarService[]) { return analyticsQueries.upsertBazaarServices(data); }
  markBazaarServicesInactive(seenCutoff: Date) { return analyticsQueries.markBazaarServicesInactive(seenCutoff); }
  getBazaarServices(opts?: { category?: string; network?: string; search?: string; sortBy?: string; limit?: number; offset?: number }) { return analyticsQueries.getBazaarServices(opts); }
  getBazaarStats() { return analyticsQueries.getBazaarStats(); }
  getBazaarSnapshots(limit?: number) { return analyticsQueries.getBazaarSnapshots(limit); }
  createBazaarSnapshot(data: InsertBazaarSnapshot) { return analyticsQueries.createBazaarSnapshot(data); }
  getBazaarTopServices(limit?: number) { return analyticsQueries.getBazaarTopServices(limit); }
}

export const storage = new DatabaseStorage();
