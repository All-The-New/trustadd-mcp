import {
  agents,
  agentMetadataEvents,
  indexerState,
  indexerEvents,
  indexerMetrics,
  communityFeedbackSources,
  communityFeedbackItems,
  communityFeedbackSummaries,
  x402Probes,
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
  agentTransactions,
  transactionSyncState,
  type AgentTransaction,
  type InsertAgentTransaction,
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, desc, sql, ilike, or, and, isNotNull, count, gt, lt, isNull, lte, asc, inArray } from "drizzle-orm";

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

  getTrustScoreLeaderboard(limit?: number, chainId?: number): Promise<Array<{ id: string; name: string | null; imageUrl: string | null; chainId: number; trustScore: number; trustScoreBreakdown: any }>>;
  getTrustScoreDistribution(chainId?: number): Promise<Array<{ bucket: string; count: number }>>;
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
}

export class DatabaseStorage implements IStorage {
  async getAgents(options: AgentQueryOptions = {}): Promise<PaginatedAgents> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);

    const conditions = [];

    if (options.chainId) conditions.push(eq(agents.chainId, options.chainId));
    if (options.filter === "claimed") conditions.push(eq(agents.claimed, true));
    if (options.filter === "unclaimed") conditions.push(eq(agents.claimed, false));
    if (options.filter === "has-metadata") conditions.push(isNotNull(agents.name));
    if (options.filter === "x402-enabled") conditions.push(eq(agents.x402Support, true));
    if (options.filter === "has-reputation") {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM agent_metadata_events WHERE agent_metadata_events.agent_id = ${agents.id} AND agent_metadata_events.event_type IN ('FeedbackPosted', 'ReputationUpdated', 'EndorsementAdded'))`
      );
    }
    if (options.filter === "has-feedback") {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM community_feedback_summaries WHERE community_feedback_summaries.agent_id = ${agents.id})`
      );
    }
    if (options.minTrustScore !== undefined) {
      conditions.push(sql`${agents.trustScore} >= ${options.minTrustScore}`);
    }
    if (options.excludeSpam) {
      conditions.push(sql`${agents.qualityTier} NOT IN ('spam', 'archived') OR ${agents.qualityTier} IS NULL`);
    }

    if (options.search?.trim()) {
      const q = `%${options.search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          ilike(agents.name, q),
          ilike(agents.primaryContractAddress, q),
          ilike(agents.controllerAddress, q),
          ilike(agents.erc8004Id, q),
          ilike(agents.description, q),
        )!,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ value: count() })
      .from(agents)
      .where(where);

    let orderClause;
    switch (options.sort) {
      case "trust-score":
        orderClause = sql`${agents.trustScore} DESC NULLS LAST`;
        break;
      case "oldest":
        orderClause = asc(agents.createdAt);
        break;
      case "name":
        orderClause = sql`${agents.name} ASC NULLS LAST`;
        break;
      default:
        orderClause = desc(agents.createdAt);
    }

    const rows = await db
      .select()
      .from(agents)
      .where(where)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);

    return {
      agents: rows,
      total: totalResult?.value ?? 0,
      limit,
      offset,
    };
  }

  async getAgentIdsForSitemap(): Promise<Array<{ id: string; slug: string | null; updatedAt: Date | null }>> {
    const result = await db.execute(sql`
      SELECT id, slug, created_at as "updatedAt"
      FROM agents
      WHERE quality_tier IS NULL OR quality_tier NOT IN ('spam', 'archived')
      ORDER BY created_at DESC
    `);
    return ((result as any).rows ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug ?? null,
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
    }));
  }

  async getAllAgents(chainId?: number): Promise<Agent[]> {
    if (chainId !== undefined) {
      return db.select().from(agents).where(eq(agents.chainId, chainId)).orderBy(desc(agents.createdAt));
    }
    return db.select().from(agents).orderBy(desc(agents.createdAt));
  }

  async getAgentsForReResolve(chainId: number): Promise<Array<Pick<Agent, 'id' | 'metadataUri' | 'tags' | 'oasfSkills' | 'qualityTier' | 'nextEnrichmentAt'>>> {
    return db.select({
      id: agents.id,
      metadataUri: agents.metadataUri,
      tags: agents.tags,
      oasfSkills: agents.oasfSkills,
      qualityTier: agents.qualityTier,
      nextEnrichmentAt: agents.nextEnrichmentAt,
    }).from(agents).where(
      and(
        eq(agents.chainId, chainId),
        or(
          isNull(agents.nextEnrichmentAt),
          lte(agents.nextEnrichmentAt, sql`NOW()`)
        )
      )
    );
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    if (agent) return agent;
    const [bySlug] = await db.select().from(agents).where(eq(agents.slug, id));
    return bySlug || undefined;
  }

  async getAgentByErc8004Id(erc8004Id: string, chainId: number = 1): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(
      and(eq(agents.erc8004Id, erc8004Id), eq(agents.chainId, chainId))
    );
    return agent || undefined;
  }

  async getAgentByContractAddress(address: string, chainId: number = 1): Promise<Agent | undefined> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.primaryContractAddress, address.toLowerCase()),
          eq(agents.chainId, chainId)
        )
      );
    return agent || undefined;
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const { generateSlug } = await import("./slugs");
    const slug = generateSlug(
      insertAgent.name ?? null,
      insertAgent.erc8004Id,
      insertAgent.chainId ?? 1
    );
    const [agent] = await db
      .insert(agents)
      .values({
        ...insertAgent,
        primaryContractAddress: insertAgent.primaryContractAddress.toLowerCase(),
        controllerAddress: insertAgent.controllerAddress.toLowerCase(),
        slug,
      })
      .returning();
    return agent;
  }

  async updateAgent(id: string, updates: Partial<InsertAgent>): Promise<Agent | undefined> {
    if (updates.name !== undefined) {
      const existing = await this.getAgent(id);
      if (existing) {
        const { generateSlug } = await import("./slugs");
        (updates as any).slug = generateSlug(
          updates.name ?? null,
          existing.erc8004Id,
          existing.chainId
        );
      }
    }
    const [agent] = await db
      .update(agents)
      .set(updates)
      .where(eq(agents.id, id))
      .returning();
    return agent || undefined;
  }

  async deleteAgent(id: string): Promise<void> {
    await db.delete(communityFeedbackItems).where(eq(communityFeedbackItems.agentId, id));
    await db.delete(communityFeedbackSummaries).where(eq(communityFeedbackSummaries.agentId, id));
    await db.delete(communityFeedbackSources).where(eq(communityFeedbackSources.agentId, id));
    await db.delete(agentMetadataEvents).where(eq(agentMetadataEvents.agentId, id));
    await db.delete(agents).where(eq(agents.id, id));
  }

  async getAgentEvents(agentId: string): Promise<AgentMetadataEvent[]> {
    return db
      .select()
      .from(agentMetadataEvents)
      .where(eq(agentMetadataEvents.agentId, agentId))
      .orderBy(desc(agentMetadataEvents.blockNumber));
  }

  async createAgentEvent(event: InsertAgentMetadataEvent): Promise<AgentMetadataEvent> {
    const [created] = await db
      .insert(agentMetadataEvents)
      .values(event)
      .returning();
    return created;
  }

  async getEventByTxHash(txHash: string, eventType: string, chainId?: number): Promise<AgentMetadataEvent | undefined> {
    const conditions = [
      eq(agentMetadataEvents.txHash, txHash),
      eq(agentMetadataEvents.eventType, eventType),
    ];
    if (chainId !== undefined) {
      conditions.push(eq(agentMetadataEvents.chainId, chainId));
    }
    const [event] = await db
      .select()
      .from(agentMetadataEvents)
      .where(and(...conditions));
    return event || undefined;
  }

  async getEventByAgentAndTxHash(agentId: string, txHash: string, eventType: string): Promise<AgentMetadataEvent | undefined> {
    const [event] = await db
      .select()
      .from(agentMetadataEvents)
      .where(
        and(
          eq(agentMetadataEvents.agentId, agentId),
          eq(agentMetadataEvents.txHash, txHash),
          eq(agentMetadataEvents.eventType, eventType)
        )
      );
    return event || undefined;
  }

  private getIndexerStateId(chainId: number): string {
    return chainId === 1 ? "default" : `chain-${chainId}`;
  }

  async getIndexerState(chainId: number = 1): Promise<IndexerState> {
    const stateId = this.getIndexerStateId(chainId);
    const [state] = await db.select().from(indexerState).where(eq(indexerState.id, stateId));
    if (!state) {
      const [created] = await db
        .insert(indexerState)
        .values({ id: stateId, chainId, lastProcessedBlock: 0, isRunning: false })
        .returning();
      return created;
    }
    return state;
  }

  async updateIndexerState(chainId: number = 1, updates: Partial<IndexerState>): Promise<void> {
    const stateId = this.getIndexerStateId(chainId);
    const existing = await db.select().from(indexerState).where(eq(indexerState.id, stateId));
    if (existing.length === 0) {
      await db.insert(indexerState).values({
        id: stateId,
        chainId,
        lastProcessedBlock: 0,
        isRunning: false,
        ...updates,
        updatedAt: new Date(),
      });
    } else {
      await db
        .update(indexerState)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(indexerState.id, stateId));
    }
  }

  async getRecentEvents(limit: number = 20, chainId?: number): Promise<Array<{
    event: AgentMetadataEvent;
    agentName: string | null;
    agentImage: string | null;
    agentErc8004Id: string;
    agentId: string;
    agentSlug: string | null;
  }>> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    let query = db
      .select({
        event: agentMetadataEvents,
        agentName: agents.name,
        agentImage: agents.imageUrl,
        agentErc8004Id: agents.erc8004Id,
        agentId: agents.id,
        agentSlug: agents.slug,
      })
      .from(agentMetadataEvents)
      .innerJoin(agents, eq(agentMetadataEvents.agentId, agents.id))
      .orderBy(desc(agentMetadataEvents.blockNumber))
      .limit(safeLimit);

    if (chainId !== undefined) {
      query = query.where(eq(agentMetadataEvents.chainId, chainId)) as typeof query;
    }

    return await query;
  }

  async getAgentFeedbackSummary(agentId: string, controllerAddress?: string | null): Promise<{
    feedbackCount: number;
    uniqueReviewers: number;
    firstFeedbackBlock: number | null;
    lastFeedbackBlock: number | null;
    events: AgentMetadataEvent[];
    sources: Record<string, { id: string; name: string; shortName: string; description: string; url: string; color: string; type: string; trustLevel: string }>;
    sybilFlags: Array<{ type: string; description: string; severity: "warning" | "critical" }>;
  }> {
    const { getReputationSource, detectSybilFlags } = await import("./known-reputation-sources.js");

    const feedbackTypes = ["FeedbackPosted", "ReputationUpdated", "EndorsementAdded", "EndorsementRemoved"];
    const feedbackEvents = await db
      .select()
      .from(agentMetadataEvents)
      .where(
        and(
          eq(agentMetadataEvents.agentId, agentId),
          inArray(agentMetadataEvents.eventType, feedbackTypes)
        )
      )
      .orderBy(desc(agentMetadataEvents.blockNumber));

    const reviewers = new Set<string>();
    const sources: Record<string, { id: string; name: string; shortName: string; description: string; url: string; color: string; type: string; trustLevel: string }> = {};

    for (const ev of feedbackEvents) {
      const data = ev.rawData as Record<string, unknown> | null;
      if (data && typeof data === "object" && "reviewer" in data && typeof data.reviewer === "string") {
        const reviewer = data.reviewer;
        reviewers.add(reviewer.toLowerCase());
        const source = getReputationSource(reviewer);
        if (source) {
          sources[reviewer.toLowerCase()] = source;
        }
      }
    }

    const sybilFlags = detectSybilFlags(
      feedbackEvents.map((ev) => ({ rawData: ev.rawData, agentId: ev.agentId, blockNumber: ev.blockNumber })),
      controllerAddress
    );

    return {
      feedbackCount: feedbackEvents.length,
      uniqueReviewers: reviewers.size,
      firstFeedbackBlock: feedbackEvents.length > 0 ? feedbackEvents[feedbackEvents.length - 1].blockNumber : null,
      lastFeedbackBlock: feedbackEvents.length > 0 ? feedbackEvents[0].blockNumber : null,
      events: feedbackEvents,
      sources,
      sybilFlags,
    };
  }

  async getStats(chainId?: number): Promise<{
    totalAgents: number;
    claimedAgents: number;
    totalEvents: number;
    lastProcessedBlock: number;
    newAgents24h: number;
    isIndexerRunning?: boolean;
    lastError?: string | null;
    chainBreakdown?: Array<{
      chainId: number;
      totalAgents: number;
      lastProcessedBlock: number;
      isRunning: boolean;
      lastError: string | null;
    }>;
  }> {
    const agentWhere = chainId !== undefined ? eq(agents.chainId, chainId) : undefined;
    const eventWhere = chainId !== undefined ? eq(agentMetadataEvents.chainId, chainId) : undefined;

    const [agentStats] = await db
      .select({
        totalAgents: sql<number>`count(*)::int`,
        claimedAgents: sql<number>`count(*) filter (where ${agents.claimed} = true)::int`,
        newAgents24h: sql<number>`count(*) filter (where ${agents.createdAt} >= now() - interval '24 hours')::int`,
      })
      .from(agents)
      .where(agentWhere);

    const [eventStats] = await db
      .select({
        totalEvents: sql<number>`count(*)::int`,
      })
      .from(agentMetadataEvents)
      .where(eventWhere);

    const allStates = await db.select().from(indexerState);

    if (chainId !== undefined) {
      const state = allStates.find(s => s.chainId === chainId) || await this.getIndexerState(chainId);
      return {
        totalAgents: agentStats?.totalAgents ?? 0,
        claimedAgents: agentStats?.claimedAgents ?? 0,
        totalEvents: eventStats?.totalEvents ?? 0,
        lastProcessedBlock: state.lastProcessedBlock,
        newAgents24h: agentStats?.newAgents24h ?? 0,
        isIndexerRunning: state.isRunning,
        lastError: state.lastError,
      };
    }

    const maxBlock = allStates.reduce((max, s) => Math.max(max, s.lastProcessedBlock), 0);
    const anyRunning = allStates.some(s => s.isRunning);
    const errors = allStates.filter(s => s.lastError).map(s => s.lastError);

    const chainBreakdown = await Promise.all(
      allStates.map(async (s) => {
        const [chainAgentStats] = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(agents)
          .where(eq(agents.chainId, s.chainId));
        return {
          chainId: s.chainId,
          totalAgents: chainAgentStats?.total ?? 0,
          lastProcessedBlock: s.lastProcessedBlock,
          isRunning: s.isRunning,
          lastError: s.lastError,
        };
      })
    );

    return {
      totalAgents: agentStats?.totalAgents ?? 0,
      claimedAgents: agentStats?.claimedAgents ?? 0,
      totalEvents: eventStats?.totalEvents ?? 0,
      lastProcessedBlock: maxBlock,
      newAgents24h: agentStats?.newAgents24h ?? 0,
      isIndexerRunning: anyRunning,
      lastError: errors.length > 0 ? errors.join("; ") : null,
      chainBreakdown: chainBreakdown,
    };
  }

  async getAnalyticsOverview(): Promise<{
    totalAgents: number;
    withMetadata: number;
    withImage: number;
    withDescription: number;
    x402Enabled: number;
    x402Disabled: number;
    x402Unknown: number;
    activeTrue: number;
    activeFalse: number;
    activeUnknown: number;
    uniqueControllers: number;
    crossChainControllers: number;
    withEndpoints: number;
    withOasfSkills: number;
    withOasfDomains: number;
    withSupportedTrust: number;
    reputationEvents: number;
    uniqueNames: number;
    totalNamed: number;
    newAgents24h: number;
  }> {
    const [r] = await db.select({
      totalAgents: sql<number>`count(*)::int`,
      withMetadata: sql<number>`count(*) filter (where ${agents.name} is not null)::int`,
      withImage: sql<number>`count(*) filter (where ${agents.imageUrl} is not null)::int`,
      withDescription: sql<number>`count(*) filter (where ${agents.description} is not null)::int`,
      x402Enabled: sql<number>`count(*) filter (where ${agents.x402Support} = true)::int`,
      x402Disabled: sql<number>`count(*) filter (where ${agents.x402Support} = false)::int`,
      x402Unknown: sql<number>`count(*) filter (where ${agents.x402Support} is null)::int`,
      activeTrue: sql<number>`count(*) filter (where ${agents.activeStatus} = true)::int`,
      activeFalse: sql<number>`count(*) filter (where ${agents.activeStatus} = false)::int`,
      activeUnknown: sql<number>`count(*) filter (where ${agents.activeStatus} is null)::int`,
      uniqueControllers: sql<number>`count(distinct ${agents.controllerAddress})::int`,
      withEndpoints: sql<number>`count(*) filter (where ${agents.endpoints} is not null and ${agents.endpoints}::text != '[]' and ${agents.endpoints}::text != '{}')::int`,
      withOasfSkills: sql<number>`count(*) filter (where ${agents.oasfSkills} is not null and array_length(${agents.oasfSkills}, 1) > 0)::int`,
      withOasfDomains: sql<number>`count(*) filter (where ${agents.oasfDomains} is not null and array_length(${agents.oasfDomains}, 1) > 0)::int`,
      withSupportedTrust: sql<number>`count(*) filter (where ${agents.supportedTrust} is not null and array_length(${agents.supportedTrust}, 1) > 0)::int`,
      uniqueNames: sql<number>`count(distinct ${agents.name})::int`,
      totalNamed: sql<number>`count(${agents.name})::int`,
    }).from(agents);

    const [crossChain] = await db.select({
      cnt: sql<number>`count(*)::int`,
    }).from(
      sql`(select ${agents.controllerAddress} from ${agents} group by ${agents.controllerAddress} having count(distinct ${agents.chainId}) > 1) sub`
    );

    const [repEvents] = await db.select({
      cnt: sql<number>`count(*)::int`,
    }).from(agentMetadataEvents).where(
      sql`${agentMetadataEvents.eventType} in ('FeedbackPosted', 'ReputationUpdated', 'EndorsementAdded', 'EndorsementRemoved')`
    );

    const [newAgents] = await db.select({
      cnt: sql<number>`count(*) filter (where ${agents.createdAt} >= now() - interval '24 hours')::int`,
    }).from(agents);

    return {
      ...r,
      crossChainControllers: crossChain?.cnt ?? 0,
      reputationEvents: repEvents?.cnt ?? 0,
      newAgents24h: newAgents?.cnt ?? 0,
    };
  }

  async getAnalyticsChainDistribution(): Promise<Array<{
    chainId: number;
    total: number;
    withMetadata: number;
    withImage: number;
    x402Enabled: number;
    x402Disabled: number;
    activeTrue: number;
    activeFalse: number;
    withEndpoints: number;
  }>> {
    return db.select({
      chainId: agents.chainId,
      total: sql<number>`count(*)::int`,
      withMetadata: sql<number>`count(*) filter (where ${agents.name} is not null)::int`,
      withImage: sql<number>`count(*) filter (where ${agents.imageUrl} is not null)::int`,
      x402Enabled: sql<number>`count(*) filter (where ${agents.x402Support} = true)::int`,
      x402Disabled: sql<number>`count(*) filter (where ${agents.x402Support} = false)::int`,
      activeTrue: sql<number>`count(*) filter (where ${agents.activeStatus} = true)::int`,
      activeFalse: sql<number>`count(*) filter (where ${agents.activeStatus} = false)::int`,
      withEndpoints: sql<number>`count(*) filter (where ${agents.endpoints} is not null and ${agents.endpoints}::text != '[]' and ${agents.endpoints}::text != '{}')::int`,
    }).from(agents).groupBy(agents.chainId).orderBy(sql`count(*) desc`);
  }

  async getAnalyticsRegistrations(): Promise<Array<{
    chainId: number;
    blockBucket: number;
    count: number;
  }>> {
    const rows = await db.select({
      chainId: agents.chainId,
      blockBucket: sql<number>`(${agents.firstSeenBlock} / 100000 * 100000)::int`,
      count: sql<number>`count(*)::int`,
    }).from(agents)
      .where(isNotNull(agents.firstSeenBlock))
      .groupBy(agents.chainId, sql`${agents.firstSeenBlock} / 100000 * 100000`)
      .orderBy(sql`${agents.firstSeenBlock} / 100000 * 100000`);
    return rows;
  }

  async getAnalyticsMetadataQuality(): Promise<Array<{
    chainId: number;
    complete: number;
    partial: number;
    minimal: number;
    empty: number;
  }>> {
    return db.select({
      chainId: agents.chainId,
      complete: sql<number>`count(*) filter (where ${agents.name} is not null and ${agents.description} is not null and ${agents.imageUrl} is not null)::int`,
      partial: sql<number>`count(*) filter (where ${agents.name} is not null and ${agents.description} is not null and ${agents.imageUrl} is null)::int`,
      minimal: sql<number>`count(*) filter (where ${agents.name} is not null and ${agents.description} is null)::int`,
      empty: sql<number>`count(*) filter (where ${agents.name} is null)::int`,
    }).from(agents).groupBy(agents.chainId).orderBy(sql`count(*) desc`);
  }

  async getAnalyticsX402ByChain(): Promise<Array<{
    chainId: number;
    enabled: number;
    disabled: number;
    unknown: number;
  }>> {
    return db.select({
      chainId: agents.chainId,
      enabled: sql<number>`count(*) filter (where ${agents.x402Support} = true)::int`,
      disabled: sql<number>`count(*) filter (where ${agents.x402Support} = false)::int`,
      unknown: sql<number>`count(*) filter (where ${agents.x402Support} is null)::int`,
    }).from(agents).groupBy(agents.chainId).orderBy(sql`count(*) desc`);
  }

  async getAnalyticsControllerConcentration(): Promise<{
    histogram: Array<{ bucket: string; count: number }>;
    topControllers: Array<{
      address: string;
      agentCount: number;
      chainCount: number;
      chains: number[];
      sampleNames: string[];
    }>;
  }> {
    const histRows = await db.select({
      bucket: sql<string>`case
        when cnt = 1 then '1'
        when cnt between 2 and 5 then '2-5'
        when cnt between 6 and 10 then '6-10'
        when cnt between 11 and 50 then '11-50'
        when cnt between 51 and 100 then '51-100'
        else '100+'
      end`,
      count: sql<number>`count(*)::int`,
    }).from(
      sql`(select ${agents.controllerAddress}, count(*) as cnt from ${agents} group by ${agents.controllerAddress}) sub`
    ).groupBy(sql`case
        when cnt = 1 then '1'
        when cnt between 2 and 5 then '2-5'
        when cnt between 6 and 10 then '6-10'
        when cnt between 11 and 50 then '11-50'
        when cnt between 51 and 100 then '51-100'
        else '100+'
      end`);

    const topRows = await db.execute(sql`
      select 
        controller_address as address,
        count(*)::int as agent_count,
        count(distinct chain_id)::int as chain_count,
        array_agg(distinct chain_id) as chains,
        (array_agg(name order by created_at desc) filter (where name is not null))[1:5] as sample_names
      from agents
      group by controller_address
      order by count(*) desc
      limit 15
    `);

    return {
      histogram: histRows,
      topControllers: (topRows.rows as any[]).map(r => ({
        address: r.address,
        agentCount: r.agent_count,
        chainCount: r.chain_count,
        chains: r.chains || [],
        sampleNames: (r.sample_names || []).filter(Boolean),
      })),
    };
  }

  async getAnalyticsUriSchemes(): Promise<{
    overall: Array<{ scheme: string; count: number }>;
    byChain: Array<{ chainId: number; scheme: string; count: number }>;
  }> {
    const schemeCase = sql<string>`case
      when ${agents.metadataUri} like 'data:%' then 'data:'
      when ${agents.metadataUri} like 'https://%' then 'https://'
      when ${agents.metadataUri} like 'ipfs://%' then 'ipfs://'
      when ${agents.metadataUri} like '{%' then 'raw JSON'
      when ${agents.metadataUri} is null or ${agents.metadataUri} = '' then 'empty'
      else 'other'
    end`;

    const overall = await db.select({
      scheme: schemeCase.as("scheme"),
      count: sql<number>`count(*)::int`,
    }).from(agents).groupBy(schemeCase).orderBy(sql`count(*) desc`);

    const byChain = await db.select({
      chainId: agents.chainId,
      scheme: schemeCase.as("scheme"),
      count: sql<number>`count(*)::int`,
    }).from(agents).groupBy(agents.chainId, schemeCase).orderBy(agents.chainId, sql`count(*) desc`);

    return { overall, byChain };
  }

  async getAnalyticsCategories(): Promise<{
    overall: Array<{ category: string; count: number }>;
    byChain: Array<{ chainId: number; category: string; count: number }>;
  }> {
    const categoryCase = sql<string>`case
      when lower(${agents.description}) like '%trading%' or lower(${agents.description}) like '%trade%' or lower(${agents.description}) like '%swap%' then 'Trading/DeFi'
      when lower(${agents.description}) like '%data%' or lower(${agents.description}) like '%analytics%' then 'Data/Analytics'
      when lower(${agents.description}) like '%chat%' or lower(${agents.description}) like '%assistant%' or lower(${agents.description}) like '%conversation%' then 'Chatbot/Assistant'
      when lower(${agents.description}) like '%bridge%' or lower(${agents.description}) like '%cross-chain%' then 'Cross-chain'
      when lower(${agents.description}) like '%security%' or lower(${agents.description}) like '%audit%' or lower(${agents.description}) like '%scanning%' then 'Security'
      when lower(${agents.description}) like '%nft%' or lower(${agents.description}) like '%token%' or lower(${agents.description}) like '%mint%' then 'NFT/Token'
      when lower(${agents.description}) like '%truth%' or lower(${agents.description}) like '%uncensored%' then 'Truth/Uncensored'
      when lower(${agents.description}) like '%code%' or lower(${agents.description}) like '%develop%' then 'Dev Tools'
      when lower(${agents.description}) like '%market%' or lower(${agents.description}) like '%price%' or lower(${agents.description}) like '%prediction%' then 'Market Intel'
      when lower(${agents.description}) like '%social%' or lower(${agents.description}) like '%twitter%' or lower(${agents.description}) like '%telegram%' then 'Social'
      when lower(${agents.description}) like '%sport%' or lower(${agents.description}) like '%nba%' or lower(${agents.description}) like '%nhl%' then 'Sports'
      when lower(${agents.description}) like '%weather%' then 'Weather'
      else 'General'
    end`;

    const overall = await db.select({
      category: categoryCase.as("category"),
      count: sql<number>`count(*)::int`,
    }).from(agents).where(isNotNull(agents.description)).groupBy(categoryCase).orderBy(sql`count(*) desc`);

    const byChain = await db.select({
      chainId: agents.chainId,
      category: categoryCase.as("category"),
      count: sql<number>`count(*)::int`,
    }).from(agents).where(isNotNull(agents.description)).groupBy(agents.chainId, categoryCase).orderBy(agents.chainId, sql`count(*) desc`);

    return { overall, byChain };
  }

  async getAnalyticsImageDomains(): Promise<Array<{ domain: string; count: number }>> {
    const rows = await db.execute(sql`
      select split_part(split_part(image_url, '://', 2), '/', 1) as domain, count(*)::int as count
      from agents where image_url is not null and image_url != ''
      group by domain order by count desc limit 15
    `);
    return (rows.rows as any[]).map(r => ({ domain: r.domain || 'unknown', count: r.count }));
  }

  async getAnalyticsModels(): Promise<Array<{ model: string; count: number }>> {
    const rows = await db.execute(sql`
      select 
        case
          when lower(description) like '%claude%' or lower(description) like '%anthropic%' then 'Claude/Anthropic'
          when lower(description) like '%gemini%' then 'Gemini'
          when lower(description) like '%gpt%' or lower(description) like '%openai%' then 'GPT/OpenAI'
          when lower(description) like '%llama%' then 'Llama'
          when lower(description) like '%grok%' then 'Grok'
          when lower(description) like '%deepseek%' then 'DeepSeek'
        end as model,
        count(*)::int as count
      from agents where description is not null
      group by model
      having case
        when lower(description) like '%claude%' or lower(description) like '%anthropic%' then 'Claude/Anthropic'
        when lower(description) like '%gemini%' then 'Gemini'
        when lower(description) like '%gpt%' or lower(description) like '%openai%' then 'GPT/OpenAI'
        when lower(description) like '%llama%' then 'Llama'
        when lower(description) like '%grok%' then 'Grok'
        when lower(description) like '%deepseek%' then 'DeepSeek'
      end is not null
      order by count desc
    `);
    return (rows.rows as any[]).map(r => ({ model: r.model, count: r.count }));
  }

  async getAnalyticsEndpointsCoverage(): Promise<{
    withEndpoints: number;
    withOasfSkills: number;
    withOasfDomains: number;
    byChain: Array<{ chainId: number; withEndpoints: number; withOasfSkills: number; withOasfDomains: number }>;
  }> {
    const [overall] = await db.select({
      withEndpoints: sql<number>`count(*) filter (where ${agents.endpoints} is not null and ${agents.endpoints}::text != '[]' and ${agents.endpoints}::text != '{}')::int`,
      withOasfSkills: sql<number>`count(*) filter (where ${agents.oasfSkills} is not null and array_length(${agents.oasfSkills}, 1) > 0)::int`,
      withOasfDomains: sql<number>`count(*) filter (where ${agents.oasfDomains} is not null and array_length(${agents.oasfDomains}, 1) > 0)::int`,
    }).from(agents);

    const byChain = await db.select({
      chainId: agents.chainId,
      withEndpoints: sql<number>`count(*) filter (where ${agents.endpoints} is not null and ${agents.endpoints}::text != '[]' and ${agents.endpoints}::text != '{}')::int`,
      withOasfSkills: sql<number>`count(*) filter (where ${agents.oasfSkills} is not null and array_length(${agents.oasfSkills}, 1) > 0)::int`,
      withOasfDomains: sql<number>`count(*) filter (where ${agents.oasfDomains} is not null and array_length(${agents.oasfDomains}, 1) > 0)::int`,
    }).from(agents).groupBy(agents.chainId).orderBy(sql`count(*) desc`);

    return { ...overall, byChain };
  }

  async getAnalyticsTopAgents(): Promise<{
    byCapabilities: Array<{ id: string; name: string; erc8004Id: string; chainId: number; capCount: number }>;
    byTags: Array<{ id: string; name: string; erc8004Id: string; chainId: number; tagCount: number; tags: string[] }>;
    byDescriptionLength: Array<{ id: string; name: string; erc8004Id: string; chainId: number; descLength: number; descPreview: string }>;
  }> {
    const byCaps = await db.execute(sql`
      select id, name, erc8004_id, chain_id, slug, array_length(capabilities, 1) as cap_count
      from agents where capabilities is not null and array_length(capabilities, 1) > 0 and name is not null
      order by cap_count desc limit 15
    `);

    const byTags = await db.execute(sql`
      select id, name, erc8004_id, chain_id, slug, array_length(tags, 1) as tag_count, tags
      from agents where tags is not null and array_length(tags, 1) > 0 and name is not null
      order by tag_count desc limit 15
    `);

    const byDesc = await db.execute(sql`
      select id, name, erc8004_id, chain_id, slug, length(description) as desc_length, left(description, 120) as desc_preview
      from agents where description is not null and name is not null
      order by length(description) desc limit 15
    `);

    return {
      byCapabilities: (byCaps.rows as any[]).map(r => ({ id: r.id, name: r.name, erc8004Id: r.erc8004_id, chainId: r.chain_id, slug: r.slug, capCount: r.cap_count })),
      byTags: (byTags.rows as any[]).map(r => ({ id: r.id, name: r.name, erc8004Id: r.erc8004_id, chainId: r.chain_id, slug: r.slug, tagCount: r.tag_count, tags: r.tags || [] })),
      byDescriptionLength: (byDesc.rows as any[]).map(r => ({ id: r.id, name: r.name, erc8004Id: r.erc8004_id, chainId: r.chain_id, slug: r.slug, descLength: r.desc_length, descPreview: r.desc_preview })),
    };
  }

  async logIndexerEvent(event: InsertIndexerEvent): Promise<IndexerEvent> {
    const [result] = await db.insert(indexerEvents).values(event).returning();
    return result;
  }

  async getRecentIndexerEvents(limit = 50, chainId?: number, eventType?: string): Promise<IndexerEvent[]> {
    const conditions = [];
    if (chainId !== undefined) conditions.push(eq(indexerEvents.chainId, chainId));
    if (eventType) conditions.push(eq(indexerEvents.eventType, eventType));

    const query = db.select().from(indexerEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(indexerEvents.createdAt))
      .limit(Math.min(limit, 200));

    return await query;
  }

  async getIndexerEventCounts(sinceMinutes = 60, chainId?: number): Promise<Array<{ eventType: string; count: number }>> {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    const conditions = [gt(indexerEvents.createdAt, since)];
    if (chainId !== undefined) conditions.push(eq(indexerEvents.chainId, chainId));

    const result = await db
      .select({
        eventType: indexerEvents.eventType,
        count: count(),
      })
      .from(indexerEvents)
      .where(and(...conditions))
      .groupBy(indexerEvents.eventType);

    return result.map(r => ({ eventType: r.eventType, count: Number(r.count) }));
  }

  async recordMetricsPeriod(metrics: InsertIndexerMetric): Promise<IndexerMetric> {
    const [result] = await db.insert(indexerMetrics).values(metrics).returning();
    return result;
  }

  async getMetricsHistory(chainId?: number, hours = 24): Promise<IndexerMetric[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const conditions = [gt(indexerMetrics.periodStart, since)];
    if (chainId !== undefined) conditions.push(eq(indexerMetrics.chainId, chainId));

    return await db.select().from(indexerMetrics)
      .where(and(...conditions))
      .orderBy(desc(indexerMetrics.periodStart));
  }

  async pruneOldEvents(olderThanDays = 7): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await db.delete(indexerEvents).where(lt(indexerEvents.createdAt, cutoff)).returning({ id: indexerEvents.id });
    return result.length;
  }

  async pruneOldMetrics(olderThanDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await db.delete(indexerMetrics).where(lt(indexerMetrics.createdAt, cutoff)).returning({ id: indexerMetrics.id });
    return result.length;
  }

  async getCommunityFeedbackSources(agentId?: string, platform?: string): Promise<CommunityFeedbackSource[]> {
    const conditions = [];
    if (agentId) conditions.push(eq(communityFeedbackSources.agentId, agentId));
    if (platform) conditions.push(eq(communityFeedbackSources.platform, platform));
    conditions.push(eq(communityFeedbackSources.isActive, true));
    return db.select().from(communityFeedbackSources)
      .where(and(...conditions))
      .orderBy(desc(communityFeedbackSources.createdAt));
  }

  async createCommunityFeedbackSource(source: InsertCommunityFeedbackSource): Promise<CommunityFeedbackSource> {
    const [result] = await db.insert(communityFeedbackSources)
      .values(source)
      .onConflictDoNothing()
      .returning();
    if (!result) {
      const [existing] = await db.select().from(communityFeedbackSources)
        .where(and(
          eq(communityFeedbackSources.agentId, source.agentId),
          eq(communityFeedbackSources.platform, source.platform),
          eq(communityFeedbackSources.platformIdentifier, source.platformIdentifier),
        ));
      return existing;
    }
    return result;
  }

  async updateCommunityFeedbackSource(id: number, updates: Partial<CommunityFeedbackSource>): Promise<void> {
    await db.update(communityFeedbackSources)
      .set(updates)
      .where(eq(communityFeedbackSources.id, id));
  }

  async getStaleSourcesForPlatform(platform: string, olderThanHours: number): Promise<CommunityFeedbackSource[]> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    return db.select().from(communityFeedbackSources)
      .where(and(
        eq(communityFeedbackSources.platform, platform),
        eq(communityFeedbackSources.isActive, true),
        or(
          isNull(communityFeedbackSources.lastScrapedAt),
          lte(communityFeedbackSources.lastScrapedAt, cutoff),
        ),
      ))
      .orderBy(asc(communityFeedbackSources.lastScrapedAt));
  }

  async createCommunityFeedbackItem(item: InsertCommunityFeedbackItem): Promise<CommunityFeedbackItem | null> {
    const [result] = await db.insert(communityFeedbackItems)
      .values(item)
      .onConflictDoNothing()
      .returning();
    return result || null;
  }

  async getCommunityFeedbackItems(agentId: string, platform?: string, itemType?: string, limit = 20): Promise<CommunityFeedbackItem[]> {
    const conditions = [eq(communityFeedbackItems.agentId, agentId)];
    if (platform) conditions.push(eq(communityFeedbackItems.platform, platform));
    if (itemType) conditions.push(eq(communityFeedbackItems.itemType, itemType));
    return db.select().from(communityFeedbackItems)
      .where(and(...conditions))
      .orderBy(desc(communityFeedbackItems.indexedAt))
      .limit(limit);
  }

  async pruneOldFeedbackItems(olderThanDays: number, platform?: string): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const conditions = [lt(communityFeedbackItems.indexedAt, cutoff)];
    if (platform) conditions.push(eq(communityFeedbackItems.platform, platform));
    const result = await db.delete(communityFeedbackItems)
      .where(and(...conditions))
      .returning({ id: communityFeedbackItems.id });
    return result.length;
  }

  async getCommunityFeedbackSummary(agentId: string): Promise<CommunityFeedbackSummary | undefined> {
    const [result] = await db.select().from(communityFeedbackSummaries)
      .where(eq(communityFeedbackSummaries.agentId, agentId));
    return result || undefined;
  }

  async upsertCommunityFeedbackSummary(agentId: string, data: Partial<InsertCommunityFeedbackSummary>): Promise<CommunityFeedbackSummary> {
    const [result] = await db.insert(communityFeedbackSummaries)
      .values({ agentId, ...data })
      .onConflictDoUpdate({
        target: communityFeedbackSummaries.agentId,
        set: { ...data, lastUpdatedAt: new Date() },
      })
      .returning();
    return result;
  }

  async getAgentsWithCommunityFeedback(limit = 50, offset = 0): Promise<CommunityFeedbackSummary[]> {
    return db.select().from(communityFeedbackSummaries)
      .orderBy(desc(communityFeedbackSummaries.githubStars))
      .limit(limit)
      .offset(offset);
  }

  async getCommunityFeedbackSummariesByAgentIds(agentIds: string[]): Promise<CommunityFeedbackSummary[]> {
    if (agentIds.length === 0) return [];
    return db.select().from(communityFeedbackSummaries)
      .where(inArray(communityFeedbackSummaries.agentId, agentIds));
  }

  async getCommunityFeedbackStats(): Promise<{ totalAgentsWithFeedback: number; totalItems: number; platformBreakdown: Array<{ platform: string; count: number }> }> {
    const [agentCount] = await db.select({ value: count() }).from(communityFeedbackSummaries);
    const [itemCount] = await db.select({ value: count() }).from(communityFeedbackItems);
    const breakdown = await db.select({
      platform: communityFeedbackItems.platform,
      count: count(),
    }).from(communityFeedbackItems).groupBy(communityFeedbackItems.platform);

    return {
      totalAgentsWithFeedback: agentCount?.value ?? 0,
      totalItems: itemCount?.value ?? 0,
      platformBreakdown: breakdown.map(b => ({ platform: b.platform, count: Number(b.count) })),
    };
  }
  async getTrustScoreLeaderboard(limit = 20, chainId?: number): Promise<Array<{ id: string; name: string | null; imageUrl: string | null; chainId: number; trustScore: number; trustScoreBreakdown: any; slug: string | null }>> {
    const conditions = [isNotNull(agents.trustScore)];
    if (chainId) conditions.push(eq(agents.chainId, chainId));

    const rows = await db.select({
      id: agents.id,
      name: agents.name,
      imageUrl: agents.imageUrl,
      chainId: agents.chainId,
      trustScore: agents.trustScore,
      trustScoreBreakdown: agents.trustScoreBreakdown,
      slug: agents.slug,
    }).from(agents)
      .where(and(...conditions))
      .orderBy(sql`${agents.trustScore} DESC`)
      .limit(Math.min(limit, 100));

    return rows.map(r => ({ ...r, trustScore: r.trustScore! }));
  }

  async getTrustScoreDistribution(chainId?: number): Promise<Array<{ bucket: string; count: number }>> {
    const chainFilter = chainId ? sql`AND chain_id = ${chainId}` : sql``;
    const result = await db.execute(sql`
      SELECT 
        CASE
          WHEN trust_score >= 90 THEN '90-100'
          WHEN trust_score >= 80 THEN '80-89'
          WHEN trust_score >= 70 THEN '70-79'
          WHEN trust_score >= 60 THEN '60-69'
          WHEN trust_score >= 50 THEN '50-59'
          WHEN trust_score >= 40 THEN '40-49'
          WHEN trust_score >= 30 THEN '30-39'
          WHEN trust_score >= 20 THEN '20-29'
          WHEN trust_score >= 10 THEN '10-19'
          ELSE '0-9'
        END as bucket,
        COUNT(*)::int as count
      FROM agents
      WHERE trust_score IS NOT NULL ${chainFilter}
      GROUP BY bucket
      ORDER BY bucket DESC
    `);
    return ((result as any).rows ?? []).map((r: any) => ({ bucket: r.bucket, count: Number(r.count) }));
  }

  async getTrustScoreStatsByChain(): Promise<Array<{ chainId: number; avgScore: number; agentCount: number }>> {
    const result = await db.execute(sql`
      SELECT 
        chain_id as "chainId",
        ROUND(AVG(trust_score), 1) as "avgScore",
        COUNT(*)::int as "agentCount"
      FROM agents
      WHERE trust_score IS NOT NULL
      GROUP BY chain_id
      ORDER BY "avgScore" DESC
    `);
    return ((result as any).rows ?? []).map((r: any) => ({
      chainId: Number(r.chainId),
      avgScore: Number(r.avgScore),
      agentCount: Number(r.agentCount),
    }));
  }

  async getEconomyOverview(): Promise<{
    totalAgents: number;
    x402Agents: number;
    agentsWithEndpoints: number;
    chainsWithX402: number;
    endpointTypes: Array<{ type: string; count: number }>;
    chainBreakdown: Array<{ chainId: number; total: number; x402: number; withEndpoints: number; adoptionRate: number }>;
  }> {
    const [overview, chainBreakdown, endpointTypes] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int as "totalAgents",
          COUNT(*) FILTER (WHERE x402_support = true)::int as "x402Agents",
          COUNT(*) FILTER (WHERE endpoints IS NOT NULL AND endpoints::text != '[]' AND endpoints::text != '{}')::int as "agentsWithEndpoints",
          COUNT(DISTINCT chain_id) FILTER (WHERE x402_support = true)::int as "chainsWithX402"
        FROM agents
      `),
      db.execute(sql`
        SELECT
          chain_id as "chainId",
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE x402_support = true)::int as x402,
          COUNT(*) FILTER (WHERE endpoints IS NOT NULL AND endpoints::text != '[]' AND endpoints::text != '{}')::int as "withEndpoints"
        FROM agents
        GROUP BY chain_id
        ORDER BY x402 DESC
      `),
      db.execute(sql`
        SELECT type, COUNT(*)::int as count FROM (
          SELECT LOWER(elem->>'name') as type
          FROM agents, jsonb_array_elements(
            CASE WHEN jsonb_typeof(endpoints) = 'array' THEN endpoints ELSE '[]'::jsonb END
          ) as elem
          WHERE x402_support = true AND endpoints IS NOT NULL
        ) sub
        WHERE type IS NOT NULL AND type != ''
        GROUP BY type
        ORDER BY count DESC
        LIMIT 20
      `),
    ]);

    const ov = ((overview as any).rows ?? [])[0] ?? {};
    const cb = ((chainBreakdown as any).rows ?? []).map((r: any) => ({
      chainId: Number(r.chainId),
      total: Number(r.total),
      x402: Number(r.x402),
      withEndpoints: Number(r.withEndpoints),
      adoptionRate: Number(r.total) > 0 ? Math.round((Number(r.x402) / Number(r.total)) * 100) : 0,
    }));
    const et = ((endpointTypes as any).rows ?? []).map((r: any) => ({
      type: String(r.type),
      count: Number(r.count),
    }));

    return {
      totalAgents: Number(ov.totalAgents ?? 0),
      x402Agents: Number(ov.x402Agents ?? 0),
      agentsWithEndpoints: Number(ov.agentsWithEndpoints ?? 0),
      chainsWithX402: Number(ov.chainsWithX402 ?? 0),
      endpointTypes: et,
      chainBreakdown: cb,
    };
  }

  async getTopX402Agents(limit = 20, chainId?: number): Promise<Array<{
    id: string; slug: string | null; name: string | null; imageUrl: string | null; chainId: number;
    trustScore: number | null; trustScoreBreakdown: any; endpoints: any; description: string | null;
  }>> {
    const chainFilter = chainId ? sql` AND chain_id = ${chainId}` : sql``;
    const result = await db.execute(sql`
      SELECT id, slug, name, image_url as "imageUrl", chain_id as "chainId",
             trust_score as "trustScore", trust_score_breakdown as "trustScoreBreakdown",
             endpoints, description
      FROM agents
      WHERE x402_support = true ${chainFilter}
      ORDER BY trust_score DESC NULLS LAST, name ASC
      LIMIT ${limit}
    `);
    return ((result as any).rows ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      imageUrl: r.imageUrl,
      chainId: Number(r.chainId),
      trustScore: r.trustScore != null ? Number(r.trustScore) : null,
      trustScoreBreakdown: r.trustScoreBreakdown,
      endpoints: r.endpoints,
      description: r.description,
    }));
  }

  async getEndpointAnalysis(): Promise<Array<{ type: string; count: number; percentage: number }>> {
    const [endpointCounts, totalResult] = await Promise.all([
      db.execute(sql`
        SELECT type, COUNT(DISTINCT agent_id)::int as count FROM (
          SELECT a.id as agent_id, LOWER(elem->>'name') as type
          FROM agents a, jsonb_array_elements(
            CASE WHEN jsonb_typeof(a.endpoints) = 'array' THEN a.endpoints ELSE '[]'::jsonb END
          ) as elem
          WHERE a.x402_support = true AND a.endpoints IS NOT NULL
        ) sub
        WHERE type IS NOT NULL AND type != ''
        GROUP BY type
        ORDER BY count DESC
        LIMIT 20
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as total FROM agents WHERE x402_support = true
      `),
    ]);

    const total = Number(((totalResult as any).rows ?? [])[0]?.total ?? 1);
    return ((endpointCounts as any).rows ?? []).map((r: any) => ({
      type: String(r.type),
      count: Number(r.count),
      percentage: Math.round((Number(r.count) / total) * 100),
    }));
  }

  async getX402AdoptionByChain(): Promise<Array<{
    chainId: number; totalAgents: number; x402Agents: number; adoptionRate: number;
    withEndpoints: number; avgTrustScore: number | null;
  }>> {
    const result = await db.execute(sql`
      SELECT
        chain_id as "chainId",
        COUNT(*)::int as "totalAgents",
        COUNT(*) FILTER (WHERE x402_support = true)::int as "x402Agents",
        COUNT(*) FILTER (WHERE x402_support = true AND endpoints IS NOT NULL AND endpoints::text != '[]')::int as "withEndpoints",
        ROUND(AVG(trust_score) FILTER (WHERE x402_support = true AND trust_score IS NOT NULL), 1) as "avgTrustScore"
      FROM agents
      GROUP BY chain_id
      ORDER BY "x402Agents" DESC
    `);
    return ((result as any).rows ?? []).map((r: any) => ({
      chainId: Number(r.chainId),
      totalAgents: Number(r.totalAgents),
      x402Agents: Number(r.x402Agents),
      adoptionRate: Number(r.totalAgents) > 0 ? Math.round((Number(r.x402Agents) / Number(r.totalAgents)) * 100) : 0,
      withEndpoints: Number(r.withEndpoints),
      avgTrustScore: r.avgTrustScore != null ? Number(r.avgTrustScore) : null,
    }));
  }

  async createProbeResult(probe: InsertX402Probe): Promise<X402Probe> {
    const [result] = await db.insert(x402Probes).values(probe).returning();
    return result;
  }

  async getProbeResults(agentId?: string, limit = 100): Promise<X402Probe[]> {
    if (agentId) {
      return db.select().from(x402Probes).where(eq(x402Probes.agentId, agentId)).orderBy(desc(x402Probes.probedAt)).limit(limit);
    }
    return db.select().from(x402Probes).orderBy(desc(x402Probes.probedAt)).limit(limit);
  }

  async getProbeStats(): Promise<{ totalProbed: number; found402: number; uniquePaymentAddresses: number; lastProbeAt: Date | null }> {
    const result = await db.execute(sql`
      SELECT
        COUNT(DISTINCT agent_id)::int as "totalProbed",
        COUNT(DISTINCT agent_id) FILTER (WHERE http_status = 402)::int as "found402",
        COUNT(DISTINCT payment_address) FILTER (WHERE payment_address IS NOT NULL)::int as "uniquePaymentAddresses",
        MAX(probed_at) as "lastProbeAt"
      FROM x402_probes
    `);
    const row = ((result as any).rows ?? [])[0] ?? {};
    return {
      totalProbed: Number(row.totalProbed ?? 0),
      found402: Number(row.found402 ?? 0),
      uniquePaymentAddresses: Number(row.uniquePaymentAddresses ?? 0),
      lastProbeAt: row.lastProbeAt ? new Date(row.lastProbeAt) : null,
    };
  }

  async getAgentsWithPaymentAddresses(): Promise<Array<{
    agentId: string; agentName: string | null; agentSlug: string | null; chainId: number;
    paymentAddress: string; paymentNetwork: string | null; paymentToken: string | null; probedAt: Date;
  }>> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (p.payment_address)
        p.agent_id as "agentId",
        a.name as "agentName",
        a.slug as "agentSlug",
        p.chain_id as "chainId",
        p.payment_address as "paymentAddress",
        p.payment_network as "paymentNetwork",
        p.payment_token as "paymentToken",
        p.probed_at as "probedAt"
      FROM x402_probes p
      JOIN agents a ON a.id = p.agent_id
      WHERE p.payment_address IS NOT NULL
      ORDER BY p.payment_address, p.probed_at DESC
    `);
    return ((result as any).rows ?? []).map((r: any) => ({
      agentId: r.agentId,
      agentName: r.agentName,
      agentSlug: r.agentSlug,
      chainId: Number(r.chainId),
      paymentAddress: r.paymentAddress,
      paymentNetwork: r.paymentNetwork,
      paymentToken: r.paymentToken,
      probedAt: new Date(r.probedAt),
    }));
  }

  async getStaleProbeAgentIds(olderThanHours: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const result = await db.execute(sql`
      SELECT a.id FROM agents a
      WHERE a.endpoints IS NOT NULL
        AND a.endpoints::text != '[]'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(a.endpoints) = 'array' THEN a.endpoints ELSE '[]'::jsonb END
          ) elem WHERE (elem->>'endpoint') LIKE 'http%'
        )
        AND (
          NOT EXISTS (SELECT 1 FROM x402_probes p WHERE p.agent_id = a.id)
          OR a.id IN (
            SELECT p2.agent_id FROM x402_probes p2
            GROUP BY p2.agent_id
            HAVING MAX(p2.probed_at) < ${cutoff}
          )
        )
    `);
    return ((result as any).rows ?? []).map((r: any) => r.id);
  }

  async getRecentProbeForEndpoint(agentId: string, endpointUrl: string): Promise<X402Probe | undefined> {
    const results = await db.select().from(x402Probes)
      .where(and(eq(x402Probes.agentId, agentId), eq(x402Probes.endpointUrl, endpointUrl)))
      .orderBy(desc(x402Probes.probedAt))
      .limit(1);
    return results[0];
  }

  async createTransaction(tx: InsertAgentTransaction): Promise<AgentTransaction> {
    const result = await db.execute(sql`
      INSERT INTO agent_transactions (agent_id, chain_id, tx_hash, transfer_id, from_address, to_address, token_address, token_symbol, amount, amount_usd, block_number, block_timestamp, category, metadata)
      VALUES (${tx.agentId}, ${tx.chainId}, ${tx.txHash}, ${tx.transferId}, ${tx.fromAddress}, ${tx.toAddress}, ${tx.tokenAddress}, ${tx.tokenSymbol}, ${tx.amount}, ${tx.amountUsd ?? null}, ${tx.blockNumber}, ${tx.blockTimestamp}, ${tx.category}, ${tx.metadata ? JSON.stringify(tx.metadata) : null}::jsonb)
      ON CONFLICT (transfer_id, chain_id) DO NOTHING
      RETURNING *
    `);
    return ((result as any).rows ?? [])[0] ?? tx as any;
  }

  async getTransactions(options?: { agentId?: string; limit?: number; offset?: number }): Promise<AgentTransaction[]> {
    const lim = Math.min(options?.limit ?? 50, 200);
    const off = options?.offset ?? 0;
    if (options?.agentId) {
      return db.select().from(agentTransactions)
        .where(eq(agentTransactions.agentId, options.agentId))
        .orderBy(desc(agentTransactions.blockTimestamp))
        .limit(lim).offset(off);
    }
    return db.select().from(agentTransactions)
      .orderBy(desc(agentTransactions.blockTimestamp))
      .limit(lim).offset(off);
  }

  async getTransactionStats(): Promise<{
    totalTransactions: number; totalVolumeUsd: number; uniqueBuyers: number; uniqueSellers: number;
    volumeByChain: Array<{ chainId: number; volume: number; count: number }>;
  }> {
    const statsResult = await db.execute(sql`
      SELECT
        COUNT(*)::int as total_transactions,
        COALESCE(SUM(amount_usd), 0)::float as total_volume_usd,
        COUNT(DISTINCT from_address)::int as unique_buyers,
        COUNT(DISTINCT to_address)::int as unique_sellers
      FROM agent_transactions
    `);
    const stats = ((statsResult as any).rows ?? [])[0] ?? {};

    const chainResult = await db.execute(sql`
      SELECT chain_id, COALESCE(SUM(amount_usd), 0)::float as volume, COUNT(*)::int as count
      FROM agent_transactions
      GROUP BY chain_id ORDER BY volume DESC
    `);

    return {
      totalTransactions: Number(stats.total_transactions ?? 0),
      totalVolumeUsd: Number(stats.total_volume_usd ?? 0),
      uniqueBuyers: Number(stats.unique_buyers ?? 0),
      uniqueSellers: Number(stats.unique_sellers ?? 0),
      volumeByChain: ((chainResult as any).rows ?? []).map((r: any) => ({
        chainId: Number(r.chain_id),
        volume: Number(r.volume),
        count: Number(r.count),
      })),
    };
  }

  async getAgentTransactionStats(agentId: string): Promise<{
    totalVolume: number; txCount: number; uniquePayers: number; lastTxAt: Date | null;
  }> {
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount_usd), 0)::float as total_volume,
        COUNT(*)::int as tx_count,
        COUNT(DISTINCT from_address)::int as unique_payers,
        MAX(block_timestamp) as last_tx_at
      FROM agent_transactions
      WHERE agent_id = ${agentId} AND category = 'incoming'
    `);
    const row = ((result as any).rows ?? [])[0] ?? {};
    return {
      totalVolume: Number(row.total_volume ?? 0),
      txCount: Number(row.tx_count ?? 0),
      uniquePayers: Number(row.unique_payers ?? 0),
      lastTxAt: row.last_tx_at ? new Date(row.last_tx_at) : null,
    };
  }

  async getTopEarningAgents(limit: number = 20): Promise<Array<{
    agentId: string; agentName: string | null; agentSlug: string | null; chainId: number;
    totalVolume: number; txCount: number; imageUrl: string | null;
  }>> {
    const result = await db.execute(sql`
      SELECT
        t.agent_id, a.name as agent_name, a.slug as agent_slug, a.chain_id, a.image_url,
        COALESCE(SUM(t.amount_usd), 0)::float as total_volume,
        COUNT(*)::int as tx_count
      FROM agent_transactions t
      JOIN agents a ON a.id = t.agent_id
      WHERE t.category = 'incoming'
      GROUP BY t.agent_id, a.name, a.slug, a.chain_id, a.image_url
      ORDER BY total_volume DESC
      LIMIT ${limit}
    `);
    return ((result as any).rows ?? []).map((r: any) => ({
      agentId: r.agent_id,
      agentName: r.agent_name,
      agentSlug: r.agent_slug,
      chainId: Number(r.chain_id),
      totalVolume: Number(r.total_volume),
      txCount: Number(r.tx_count),
      imageUrl: r.image_url,
    }));
  }

  async getTransactionVolume(period: string): Promise<Array<{ date: string; volume: number; count: number }>> {
    let days = 30;
    if (period === "7d") days = 7;
    else if (period === "all") days = 365;

    const result = await db.execute(sql`
      SELECT
        DATE(block_timestamp) as date,
        COALESCE(SUM(amount_usd), 0)::float as volume,
        COUNT(*)::int as count
      FROM agent_transactions
      WHERE block_timestamp >= NOW() - INTERVAL '1 day' * ${days}
      GROUP BY DATE(block_timestamp)
      ORDER BY date ASC
    `);
    return ((result as any).rows ?? []).map((r: any) => ({
      date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date),
      volume: Number(r.volume),
      count: Number(r.count),
    }));
  }

  async getTransactionSyncState(address: string, chainId: number): Promise<{ lastSyncedBlock: number } | null> {
    const results = await db.select().from(transactionSyncState)
      .where(and(
        eq(transactionSyncState.paymentAddress, address.toLowerCase()),
        eq(transactionSyncState.chainId, chainId),
      ))
      .limit(1);
    return results[0] ? { lastSyncedBlock: results[0].lastSyncedBlock } : null;
  }

  async upsertTransactionSyncState(address: string, chainId: number, block: number): Promise<void> {
    await db.execute(sql`
      INSERT INTO transaction_sync_state (payment_address, chain_id, last_synced_block, last_synced_at)
      VALUES (${address.toLowerCase()}, ${chainId}, ${block}, NOW())
      ON CONFLICT (payment_address, chain_id) DO UPDATE SET last_synced_block = ${block}, last_synced_at = NOW()
    `);
  }

  async getMostRecentSyncTime(): Promise<Date | null> {
    const result = await db.execute(sql`SELECT MAX(last_synced_at) as max_time FROM transaction_sync_state`);
    const rows = (result as any).rows ?? [];
    return rows[0]?.max_time ? new Date(rows[0].max_time) : null;
  }

  async getKnownPaymentAddresses(): Promise<Array<{ address: string; chainId: number; agentId: string }>> {
    const probeAddrs = await db.execute(sql`
      SELECT DISTINCT p.payment_address as address, p.chain_id, p.agent_id
      FROM x402_probes p
      WHERE p.payment_address IS NOT NULL
    `);

    const walletAddrs = await db.execute(sql`
      SELECT a.id as agent_id, a.chain_id, elem->>'endpoint' as address
      FROM agents a, jsonb_array_elements(
        CASE WHEN jsonb_typeof(a.endpoints) = 'array' THEN a.endpoints ELSE '[]'::jsonb END
      ) elem
      WHERE LOWER(elem->>'name') IN ('wallet', 'agentwallet', 'payment')
        AND (elem->>'endpoint') ~ '^0x[a-fA-F0-9]{40}$'
    `);

    const seen = new Set<string>();
    const result: Array<{ address: string; chainId: number; agentId: string }> = [];

    for (const row of [...(probeAddrs as any).rows ?? [], ...(walletAddrs as any).rows ?? []]) {
      const key = `${(row.address || "").toLowerCase()}-${row.chain_id}`;
      if (!seen.has(key) && row.address) {
        seen.add(key);
        result.push({ address: row.address.toLowerCase(), chainId: Number(row.chain_id), agentId: row.agent_id });
      }
    }
    return result;
  }

  async getStatusSummary() {
    const [proberStats, txRows, agentDiscoveryRows, eventRows] = await Promise.all([
      this.getProbeStats(),
      db.execute(sql`
        SELECT
          COUNT(*) AS address_count,
          COUNT(*) FILTER (WHERE last_synced_at >= NOW() - INTERVAL '12 hours') AS synced_count,
          0 AS total_errors,
          MAX(last_synced_at) AS last_synced_at
        FROM transaction_sync_state
      `),
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::int AS today,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS this_week
        FROM agents
      `),
      db.execute(sql`
        SELECT chain_id, event_type, COUNT(*)::int AS cnt
        FROM indexer_events
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY chain_id, event_type
      `),
    ]);

    const txRow = ((txRows as any).rows ?? [])[0] ?? {};
    const agentRow = ((agentDiscoveryRows as any).rows ?? [])[0] ?? {};
    const eventCounts24h = ((eventRows as any).rows ?? []).map((r: any) => ({
      chainId: Number(r.chain_id),
      eventType: r.event_type,
      count: Number(r.cnt),
    }));

    return {
      proberStats,
      txSyncStats: {
        addressCount: Number(txRow.address_count ?? 0),
        syncedCount: Number(txRow.synced_count ?? 0),
        errorCount: Number(txRow.total_errors ?? 0),
        lastSyncedAt: txRow.last_synced_at ? new Date(txRow.last_synced_at) : null,
      },
      discoveryStats: {
        agentsToday: Number(agentRow.today ?? 0),
        agentsThisWeek: Number(agentRow.this_week ?? 0),
        totalAgents: Number(agentRow.total ?? 0),
      },
      eventCounts24h,
    };
  }

  async getQualitySummary() {
    const CHAIN_NAMES: Record<number, string> = {
      1: "Ethereum", 56: "BNB Chain", 137: "Polygon", 8453: "Base", 42161: "Arbitrum",
    };

    const [totalRow, verifiedRow, tierRows, flagRows, distRows, chainRows, lastUpdatedRow] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int as count FROM agents`),
      db.execute(sql`
        SELECT COUNT(*)::int as count FROM agents
        WHERE trust_score >= 20 AND quality_tier NOT IN ('spam','archived')
      `),
      db.execute(sql`
        SELECT quality_tier, COUNT(*)::int as count FROM agents
        GROUP BY quality_tier
      `),
      db.execute(sql`
        SELECT flag, COUNT(*)::int as count
        FROM agents, unnest(spam_flags) AS t(flag)
        GROUP BY flag
      `),
      db.execute(sql`
        SELECT
          CASE
            WHEN trust_score >= 50 THEN '50+'
            WHEN trust_score >= 40 THEN '40-49'
            WHEN trust_score >= 30 THEN '30-39'
            WHEN trust_score >= 20 THEN '20-29'
            WHEN trust_score >= 10 THEN '10-19'
            ELSE '0-9'
          END as bucket,
          COUNT(*)::int as count
        FROM agents
        WHERE trust_score IS NOT NULL
        GROUP BY bucket
        ORDER BY bucket ASC
      `),
      db.execute(sql`
        SELECT chain_id, quality_tier, COUNT(*)::int as count
        FROM agents
        GROUP BY chain_id, quality_tier
      `),
      db.execute(sql`SELECT MAX(last_quality_evaluated_at) as ts FROM agents`),
    ]);

    const totalAgents = Number(((totalRow as any).rows ?? [])[0]?.count ?? 0);
    const verifiedAgents = Number(((verifiedRow as any).rows ?? [])[0]?.count ?? 0);

    const tierCounts = { high: 0, medium: 0, low: 0, spam: 0, archived: 0, unclassified: 0 };
    for (const r of ((tierRows as any).rows ?? [])) {
      const tier = r.quality_tier as keyof typeof tierCounts;
      if (tier in tierCounts) tierCounts[tier] = Number(r.count);
    }

    const spamFlagCounts = { whitespace_name: 0, blank_uri: 0, spec_uri: 0, code_as_uri: 0, test_agent: 0, duplicate_template: 0 };
    for (const r of ((flagRows as any).rows ?? [])) {
      const flag = r.flag as keyof typeof spamFlagCounts;
      if (flag in spamFlagCounts) spamFlagCounts[flag] = Number(r.count);
    }

    const bucketOrder = ["0-9", "10-19", "20-29", "30-39", "40-49", "50+"];
    const distMap: Record<string, number> = {};
    for (const r of ((distRows as any).rows ?? [])) distMap[r.bucket] = Number(r.count);
    const trustDistribution = bucketOrder.map(b => ({ bucket: b, count: distMap[b] ?? 0 }));

    const chainMap: Record<number, { total: number; high: number; medium: number; low: number; spam: number }> = {};
    for (const r of ((chainRows as any).rows ?? [])) {
      const cid = Number(r.chain_id);
      if (!chainMap[cid]) chainMap[cid] = { total: 0, high: 0, medium: 0, low: 0, spam: 0 };
      const tier = r.quality_tier as string;
      const cnt = Number(r.count);
      chainMap[cid].total += cnt;
      if (tier === "high") chainMap[cid].high += cnt;
      else if (tier === "medium") chainMap[cid].medium += cnt;
      else if (tier === "low") chainMap[cid].low += cnt;
      else if (tier === "spam" || tier === "archived") chainMap[cid].spam += cnt;
    }
    const perChainQuality = Object.entries(chainMap).map(([cid, v]) => ({
      chainId: Number(cid),
      chainName: CHAIN_NAMES[Number(cid)] ?? `Chain ${cid}`,
      ...v,
    })).sort((a, b) => b.total - a.total);

    const lastTs = ((lastUpdatedRow as any).rows ?? [])[0]?.ts;
    const lastUpdated = lastTs ? new Date(lastTs).toISOString() : new Date().toISOString();

    return { totalAgents, verifiedAgents, tierCounts, spamFlagCounts, trustDistribution, perChainQuality, lastUpdated };
  }

  async getQualityOffenders() {
    const [spamCtrlRows, templateRows, multiChainRows, highCtrlRows, dailyRows, top20Row, totalSpamRow] = await Promise.all([
      db.execute(sql`
        SELECT
          controller_address,
          COUNT(*)::int AS agent_count,
          array_agg(DISTINCT chain_id) AS chains,
          (
            SELECT flag FROM (
              SELECT unnest(spam_flags) AS flag FROM agents a2
              WHERE a2.controller_address = a.controller_address AND a2.quality_tier IN ('spam','archived')
            ) flags GROUP BY flag ORDER BY COUNT(*) DESC LIMIT 1
          ) AS top_flag
        FROM agents a
        WHERE quality_tier IN ('spam','archived')
          AND controller_address IS NOT NULL AND controller_address != ''
        GROUP BY controller_address
        ORDER BY agent_count DESC
        LIMIT 15
      `),
      db.execute(sql`
        SELECT
          metadata_fingerprint,
          COUNT(*)::int AS agent_count,
          COUNT(DISTINCT controller_address)::int AS controller_count,
          MIN(metadata_uri) AS sample_uri,
          array_agg(DISTINCT chain_id) AS chains
        FROM agents
        WHERE quality_tier IN ('spam','archived')
          AND metadata_fingerprint IS NOT NULL
        GROUP BY metadata_fingerprint
        HAVING COUNT(*) > 30
        ORDER BY agent_count DESC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT
          controller_address,
          COUNT(DISTINCT chain_id)::int AS chain_count,
          COUNT(*)::int AS agent_count,
          array_agg(DISTINCT chain_id) AS chains
        FROM agents
        WHERE quality_tier IN ('spam','archived')
          AND controller_address IS NOT NULL AND controller_address != ''
        GROUP BY controller_address
        HAVING COUNT(DISTINCT chain_id) > 1
        ORDER BY agent_count DESC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT
          controller_address,
          COUNT(*)::int AS agent_count,
          array_agg(DISTINCT chain_id) AS chains,
          ROUND(AVG(trust_score))::int AS avg_trust,
          MAX(trust_score)::int AS max_trust
        FROM agents
        WHERE quality_tier = 'high'
          AND controller_address IS NOT NULL AND controller_address != ''
        GROUP BY controller_address
        ORDER BY agent_count DESC
        LIMIT 15
      `),
      db.execute(sql`
        SELECT
          DATE(created_at) AS day,
          quality_tier,
          COUNT(*)::int AS cnt
        FROM agents
        WHERE created_at >= NOW() - INTERVAL '30 days'
          AND quality_tier IN ('high','medium','low','spam')
        GROUP BY day, quality_tier
        ORDER BY day ASC
      `),
      db.execute(sql`
        WITH top20 AS (
          SELECT controller_address, COUNT(*)::int AS cnt
          FROM agents WHERE quality_tier IN ('spam','archived') AND controller_address IS NOT NULL
          GROUP BY controller_address ORDER BY cnt DESC LIMIT 20
        )
        SELECT SUM(cnt)::int AS total FROM top20
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM agents WHERE quality_tier IN ('spam','archived')
      `),
    ]);

    function classifyUri(uri: string | null): string {
      if (!uri || uri.trim() === '') return 'blank';
      if (uri.startsWith('ipfs://')) return 'ipfs';
      if (uri.startsWith('data:')) return 'data-uri';
      if (/const |require\(|async function|ethers\./.test(uri)) return 'code';
      if (uri.startsWith('http')) return 'http';
      return 'other';
    }

    function truncAddr(addr: string): string {
      if (!addr || addr.length < 12) return addr;
      return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
    }

    const topSpamControllers = ((spamCtrlRows as any).rows ?? []).map((r: any) => ({
      address: truncAddr(r.controller_address),
      fullAddress: r.controller_address,
      agentCount: Number(r.agent_count),
      chains: (r.chains ?? []).map(Number),
      topFlag: r.top_flag ?? 'unknown',
    }));

    const topSpamTemplates = ((templateRows as any).rows ?? []).map((r: any) => {
      const uri = r.sample_uri ?? '';
      return {
        fingerprint: r.metadata_fingerprint,
        agentCount: Number(r.agent_count),
        controllerCount: Number(r.controller_count),
        sampleUri: uri.length > 60 ? uri.slice(0, 60) + '…' : uri,
        uriType: classifyUri(uri),
        chains: (r.chains ?? []).map(Number),
      };
    });

    const multiChainSpammers = ((multiChainRows as any).rows ?? []).map((r: any) => ({
      address: truncAddr(r.controller_address),
      fullAddress: r.controller_address,
      chainCount: Number(r.chain_count),
      agentCount: Number(r.agent_count),
      chains: (r.chains ?? []).map(Number),
    }));

    const topHighQualityControllers = ((highCtrlRows as any).rows ?? []).map((r: any) => ({
      address: truncAddr(r.controller_address),
      fullAddress: r.controller_address,
      agentCount: Number(r.agent_count),
      chains: (r.chains ?? []).map(Number),
      avgTrustScore: Number(r.avg_trust),
      maxTrustScore: Number(r.max_trust),
    }));

    const dayMap: Record<string, { high: number; medium: number; low: number; spam: number }> = {};
    for (const r of ((dailyRows as any).rows ?? [])) {
      const day = typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { high: 0, medium: 0, low: 0, spam: 0 };
      const tier = r.quality_tier as string;
      if (tier in dayMap[day]) (dayMap[day] as any)[tier] = Number(r.cnt);
    }
    const dailyRegistrations = Object.entries(dayMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalSpam = Number(((totalSpamRow as any).rows ?? [])[0]?.cnt ?? 0);
    const top20Count = Number(((top20Row as any).rows ?? [])[0]?.total ?? 0);
    const top20Pct = totalSpam > 0 ? Math.round((top20Count / totalSpam) * 100) : 0;

    return {
      topSpamControllers,
      topSpamTemplates,
      multiChainSpammers,
      topHighQualityControllers,
      dailyRegistrations,
      spamConcentration: { top20Count, totalSpam, top20Pct },
    };
  }

  async getProtocolStats(): Promise<{
    totalAgents: number;
    withMetadata: number;
    totalEvents: number;
    chainCount: number;
    erc8004: { registered: number; withMetadata: number; totalEvents: number; chainBreakdown: Array<{ chainId: number; count: number }> };
    x402: { enabled: number; adoptionRate: number; chainBreakdown: Array<{ chainId: number; count: number }> };
    oasf: { withSkills: number; withDomains: number; topSkillCategories: string[] };
    mcp: { declaring: number; adoptionRate: number };
    a2a: { declaring: number; adoptionRate: number };
  }> {
    const [counts] = await db.select({
      totalAgents: sql<number>`count(*)::int`,
      withMetadata: sql<number>`count(*) filter (where ${agents.name} is not null)::int`,
      x402Enabled: sql<number>`count(*) filter (where ${agents.x402Support} = true)::int`,
      withOasfSkills: sql<number>`count(*) filter (where ${agents.oasfSkills} is not null and array_length(${agents.oasfSkills}, 1) > 0)::int`,
      withOasfDomains: sql<number>`count(*) filter (where ${agents.oasfDomains} is not null and array_length(${agents.oasfDomains}, 1) > 0)::int`,
      chainCount: sql<number>`count(distinct ${agents.chainId})::int`,
      mcpDeclaring: sql<number>`count(*) filter (where ${agents.supportedTrust} is not null and 'mcp' = any(${agents.supportedTrust}))::int`,
      a2aDeclaring: sql<number>`count(*) filter (where ${agents.supportedTrust} is not null and 'a2a' = any(${agents.supportedTrust}))::int`,
    }).from(agents);

    const [eventCount] = await db.select({
      cnt: sql<number>`count(*)::int`,
    }).from(agentMetadataEvents);

    const chainBreakdownRows = await db.select({
      chainId: agents.chainId,
      count: sql<number>`count(*)::int`,
    }).from(agents).groupBy(agents.chainId);

    const x402ChainRows = await db.select({
      chainId: agents.chainId,
      count: sql<number>`count(*)::int`,
    }).from(agents).where(eq(agents.x402Support, true)).groupBy(agents.chainId);

    const skillRows = await db.select({
      skill: sql<string>`unnest(${agents.oasfSkills})`,
    }).from(agents).where(
      sql`${agents.oasfSkills} is not null and array_length(${agents.oasfSkills}, 1) > 0`
    );
    const skillCounts: Record<string, number> = {};
    for (const row of skillRows) {
      const s = row.skill?.trim();
      if (s) skillCounts[s] = (skillCounts[s] || 0) + 1;
    }
    const topSkillCategories = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const totalAgents = counts.totalAgents;

    return {
      totalAgents,
      withMetadata: counts.withMetadata,
      totalEvents: eventCount?.cnt ?? 0,
      chainCount: counts.chainCount,
      erc8004: {
        registered: totalAgents,
        withMetadata: counts.withMetadata,
        totalEvents: eventCount?.cnt ?? 0,
        chainBreakdown: chainBreakdownRows.map(r => ({ chainId: r.chainId, count: r.count })),
      },
      x402: {
        enabled: counts.x402Enabled,
        adoptionRate: totalAgents > 0 ? Math.round((counts.x402Enabled / totalAgents) * 100) : 0,
        chainBreakdown: x402ChainRows.map(r => ({ chainId: r.chainId, count: r.count })),
      },
      oasf: {
        withSkills: counts.withOasfSkills,
        withDomains: counts.withOasfDomains,
        topSkillCategories,
      },
      mcp: {
        declaring: counts.mcpDeclaring,
        adoptionRate: totalAgents > 0 ? Math.round((counts.mcpDeclaring / totalAgents) * 100) : 0,
      },
      a2a: {
        declaring: counts.a2aDeclaring,
        adoptionRate: totalAgents > 0 ? Math.round((counts.a2aDeclaring / totalAgents) * 100) : 0,
      },
    };
  }
  async getSkillsSummary(): Promise<{
    totalNonSpam: number;
    withCapabilities: number;
    withTags: number;
    withOasfSkills: number;
    withOasfDomains: number;
    avgCapabilitiesPerAgent: number;
    avgTagsPerAgent: number;
  }> {
    const result = await db.execute(sql`
      SELECT
        count(*)::int AS total_non_spam,
        count(*) FILTER (WHERE capabilities IS NOT NULL AND array_length(capabilities, 1) > 0 AND capabilities::text NOT LIKE '%[object%')::int AS with_capabilities,
        count(*) FILTER (WHERE tags IS NOT NULL AND array_length(tags, 1) > 0)::int AS with_tags,
        count(*) FILTER (WHERE oasf_skills IS NOT NULL AND array_length(oasf_skills, 1) > 0)::int AS with_oasf_skills,
        count(*) FILTER (WHERE oasf_domains IS NOT NULL AND array_length(oasf_domains, 1) > 0)::int AS with_oasf_domains,
        COALESCE(ROUND(AVG(array_length(capabilities, 1)) FILTER (WHERE capabilities IS NOT NULL AND array_length(capabilities, 1) > 0 AND capabilities::text NOT LIKE '%[object%'), 1), 0) AS avg_capabilities,
        COALESCE(ROUND(AVG(array_length(tags, 1)) FILTER (WHERE tags IS NOT NULL AND array_length(tags, 1) > 0), 1), 0) AS avg_tags
      FROM agents
      WHERE (quality_tier IS NULL OR quality_tier NOT IN ('spam','archived'))
        AND (capabilities IS NULL OR capabilities::text NOT LIKE '%[object%')
    `);
    const r = result.rows[0] as any;
    return {
      totalNonSpam: Number(r.total_non_spam),
      withCapabilities: Number(r.with_capabilities),
      withTags: Number(r.with_tags),
      withOasfSkills: Number(r.with_oasf_skills),
      withOasfDomains: Number(r.with_oasf_domains),
      avgCapabilitiesPerAgent: Number(r.avg_capabilities),
      avgTagsPerAgent: Number(r.avg_tags),
    };
  }

  async getSkillsChainDistribution(): Promise<Array<{
    chainId: number;
    totalAgents: number;
    withSkills: number;
    coveragePct: number;
    shareOfAllSkilled: number;
  }>> {
    const result = await db.execute(sql`
      WITH base AS (
        SELECT chain_id,
          count(*)::int AS total_agents,
          count(*) FILTER (WHERE capabilities IS NOT NULL AND array_length(capabilities, 1) > 0 AND capabilities::text NOT LIKE '%[object%')::int AS with_skills
        FROM agents
        WHERE (quality_tier IS NULL OR quality_tier NOT IN ('spam','archived'))
          AND (capabilities IS NULL OR capabilities::text NOT LIKE '%[object%')
        GROUP BY chain_id
      ),
      totals AS (SELECT sum(with_skills)::int AS total_skilled FROM base)
      SELECT b.chain_id, b.total_agents, b.with_skills,
        CASE WHEN b.total_agents > 0 THEN ROUND(b.with_skills::numeric / b.total_agents * 100, 1) ELSE 0 END AS coverage_pct,
        CASE WHEN t.total_skilled > 0 THEN ROUND(b.with_skills::numeric / t.total_skilled * 100, 1) ELSE 0 END AS share_of_all
      FROM base b, totals t
      ORDER BY b.with_skills DESC
    `);
    return (result.rows as any[]).map(r => ({
      chainId: Number(r.chain_id),
      totalAgents: Number(r.total_agents),
      withSkills: Number(r.with_skills),
      coveragePct: Number(r.coverage_pct),
      shareOfAllSkilled: Number(r.share_of_all),
    }));
  }

  async getSkillsTopCapabilities(limit: number = 30): Promise<Array<{
    skill: string;
    agentCount: number;
    avgTrust: number;
  }>> {
    const result = await db.execute(sql`
      SELECT lower(trim(cap)) AS skill,
        count(DISTINCT a.id)::int AS agent_count,
        ROUND(AVG(a.trust_score))::int AS avg_trust
      FROM agents a, unnest(a.capabilities) AS cap
      WHERE (a.quality_tier IS NULL OR a.quality_tier NOT IN ('spam','archived'))
        AND array_length(a.capabilities, 1) > 0
        AND a.capabilities::text NOT LIKE '%[object%'
        AND length(trim(cap)) > 1 AND length(trim(cap)) < 40
      GROUP BY lower(trim(cap))
      HAVING count(DISTINCT a.id) >= 3
      ORDER BY agent_count DESC
      LIMIT ${limit}
    `);
    return (result.rows as any[]).map(r => ({
      skill: r.skill,
      agentCount: Number(r.agent_count),
      avgTrust: Number(r.avg_trust) || 0,
    }));
  }

  async getSkillsCategoryBreakdown(): Promise<Array<{
    category: string;
    agentCount: number;
    skillCount: number;
    avgTrust: number;
  }>> {
    const result = await db.execute(sql`
      WITH skill_cats AS (
        SELECT lower(trim(cap)) AS skill,
          a.id AS agent_id,
          a.trust_score,
          CASE
            WHEN lower(trim(cap)) IN ('follow','vote','post','comment','like','share','retweet','mention','reply','engage') THEN 'Social'
            WHEN lower(trim(cap)) IN ('content_creation','sentiment_analysis','curation','recommendation','nlp','text_generation','summarization','translation','image_generation','video_generation') THEN 'AI & Content'
            WHEN lower(trim(cap)) IN ('market_analysis','risk_assessment','trading','portfolio','yield','lending','borrowing','swap','liquidity','arbitrage','price_prediction') THEN 'DeFi & Trading'
            WHEN lower(trim(cap)) IN ('python','typescript','javascript','go','rust','solidity','css','html','react','node','backend','frontend','devops','infrastructure','ml','data_science','sql') THEN 'Programming'
            WHEN lower(trim(cap)) IN ('defi','smart-contracts','blockchain','cryptography','web3','nft','token','wallet','bridge','consensus','dao','governance') THEN 'Blockchain'
            WHEN lower(trim(cap)) IN ('data_collection','reporting','analytics','monitoring','auditing','compliance','security','testing','automation','orchestration') THEN 'Data & Ops'
            ELSE 'Other'
          END AS category
        FROM agents a, unnest(a.capabilities) AS cap
        WHERE (a.quality_tier IS NULL OR a.quality_tier NOT IN ('spam','archived'))
          AND array_length(a.capabilities, 1) > 0
          AND a.capabilities::text NOT LIKE '%[object%'
          AND length(trim(cap)) > 1 AND length(trim(cap)) < 40
      )
      SELECT category,
        count(DISTINCT agent_id)::int AS agent_count,
        count(DISTINCT skill)::int AS skill_count,
        ROUND(AVG(trust_score))::int AS avg_trust
      FROM skill_cats
      GROUP BY category
      ORDER BY agent_count DESC
    `);
    return (result.rows as any[]).map(r => ({
      category: r.category,
      agentCount: Number(r.agent_count),
      skillCount: Number(r.skill_count),
      avgTrust: Number(r.avg_trust) || 0,
    }));
  }

  async getSkillsTrustCorrelation(): Promise<Array<{
    skill: string;
    agentCount: number;
    avgTrust: number;
  }>> {
    const result = await db.execute(sql`
      SELECT lower(trim(cap)) AS skill,
        count(DISTINCT a.id)::int AS agent_count,
        ROUND(AVG(a.trust_score))::int AS avg_trust
      FROM agents a, unnest(a.capabilities) AS cap
      WHERE (a.quality_tier IS NULL OR a.quality_tier NOT IN ('spam','archived'))
        AND a.trust_score IS NOT NULL
        AND array_length(a.capabilities, 1) > 0
        AND a.capabilities::text NOT LIKE '%[object%'
        AND length(trim(cap)) > 1 AND length(trim(cap)) < 40
      GROUP BY lower(trim(cap))
      HAVING count(DISTINCT a.id) >= 10
      ORDER BY avg_trust DESC
      LIMIT 30
    `);
    return (result.rows as any[]).map(r => ({
      skill: r.skill,
      agentCount: Number(r.agent_count),
      avgTrust: Number(r.avg_trust) || 0,
    }));
  }

  async getSkillsOasfOverview(): Promise<{
    topSkills: Array<{ skill: string; agentCount: number }>;
    topDomains: Array<{ domain: string; agentCount: number }>;
    totalAgents: number;
  }> {
    const countResult = await db.execute(sql`
      SELECT count(DISTINCT id)::int AS cnt FROM agents
      WHERE (quality_tier IS NULL OR quality_tier NOT IN ('spam','archived'))
        AND (capabilities IS NULL OR capabilities::text NOT LIKE '%[object%')
        AND oasf_skills IS NOT NULL AND array_length(oasf_skills, 1) > 0
    `);

    const skillResult = await db.execute(sql`
      SELECT trim(s) AS skill, count(DISTINCT a.id)::int AS agent_count
      FROM agents a, unnest(a.oasf_skills) AS s
      WHERE (a.quality_tier IS NULL OR a.quality_tier NOT IN ('spam','archived'))
        AND (a.capabilities IS NULL OR a.capabilities::text NOT LIKE '%[object%')
        AND array_length(a.oasf_skills, 1) > 0
        AND length(trim(s)) > 1
      GROUP BY trim(s)
      HAVING count(DISTINCT a.id) >= 2
      ORDER BY agent_count DESC
      LIMIT 15
    `);

    const domainResult = await db.execute(sql`
      SELECT trim(d) AS domain, count(DISTINCT a.id)::int AS agent_count
      FROM agents a, unnest(a.oasf_domains) AS d
      WHERE (a.quality_tier IS NULL OR a.quality_tier NOT IN ('spam','archived'))
        AND (a.capabilities IS NULL OR a.capabilities::text NOT LIKE '%[object%')
        AND array_length(a.oasf_domains, 1) > 0
        AND length(trim(d)) > 1
      GROUP BY trim(d)
      HAVING count(DISTINCT a.id) >= 2
      ORDER BY agent_count DESC
      LIMIT 15
    `);

    return {
      topSkills: (skillResult.rows as any[]).map(r => ({ skill: r.skill, agentCount: Number(r.agent_count) })),
      topDomains: (domainResult.rows as any[]).map(r => ({ domain: r.domain, agentCount: Number(r.agent_count) })),
      totalAgents: Number((countResult.rows[0] as any).cnt),
    };
  }

  async getSkillsNotableAgents(limit: number = 20): Promise<Array<{
    id: string;
    name: string | null;
    slug: string | null;
    chainId: number;
    trustScore: number | null;
    imageUrl: string | null;
    skillCount: number;
    capabilities: string[];
  }>> {
    const result = await db.execute(sql`
      SELECT id, name, slug, chain_id, trust_score, image_url,
        array_length(capabilities, 1) AS skill_count,
        capabilities
      FROM agents
      WHERE (quality_tier IS NULL OR quality_tier NOT IN ('spam','archived'))
        AND capabilities IS NOT NULL
        AND array_length(capabilities, 1) > 0
        AND capabilities::text NOT LIKE '%[object%'
      ORDER BY array_length(capabilities, 1) DESC, trust_score DESC NULLS LAST
      LIMIT ${limit}
    `);
    return (result.rows as any[]).map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      chainId: Number(r.chain_id),
      trustScore: r.trust_score != null ? Number(r.trust_score) : null,
      imageUrl: r.image_url,
      skillCount: Number(r.skill_count),
      capabilities: r.capabilities || [],
    }));
  }
}

export const storage = new DatabaseStorage();
