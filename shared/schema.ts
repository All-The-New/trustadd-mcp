import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, bigserial, jsonb, timestamp, serial, real, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  erc8004Id: text("erc8004_id").notNull(),
  primaryContractAddress: text("primary_contract_address").notNull(),
  controllerAddress: text("controller_address").notNull(),
  chainId: integer("chain_id").notNull().default(1),
  name: text("name"),
  description: text("description"),
  claimed: boolean("claimed").notNull().default(false),
  firstSeenBlock: integer("first_seen_block").notNull(),
  lastUpdatedBlock: integer("last_updated_block").notNull(),
  capabilities: text("capabilities").array(),
  metadataUri: text("metadata_uri"),
  tags: text("tags").array(),
  oasfSkills: text("oasf_skills").array(),
  oasfDomains: text("oasf_domains").array(),
  endpoints: jsonb("endpoints"),
  x402Support: boolean("x402_support"),
  supportedTrust: text("supported_trust").array(),
  imageUrl: text("image_url"),
  activeStatus: boolean("active_status"),
  slug: text("slug"),
  trustScore: integer("trust_score"),
  trustScoreBreakdown: jsonb("trust_score_breakdown"),
  trustScoreUpdatedAt: timestamp("trust_score_updated_at"),
  qualityTier: text("quality_tier").default("unclassified"),
  spamFlags: text("spam_flags").array().default(sql`'{}'`),
  lifecycleStatus: text("lifecycle_status").default("active"),
  metadataFingerprint: text("metadata_fingerprint"),
  nextEnrichmentAt: timestamp("next_enrichment_at"),
  lastQualityEvaluatedAt: timestamp("last_quality_evaluated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_agents_chain_id").on(table.chainId),
  index("idx_agents_chain_erc8004").on(table.chainId, table.erc8004Id),
  index("idx_agents_slug").on(table.slug),
  index("idx_agents_quality_tier").on(table.qualityTier),
  index("idx_agents_trust_score").on(table.trustScore),
  index("idx_agents_lifecycle_status").on(table.lifecycleStatus),
]);

export const agentMetadataEvents = pgTable("agent_metadata_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  txHash: text("tx_hash").notNull(),
  blockNumber: integer("block_number").notNull(),
  eventType: text("event_type").notNull(),
  chainId: integer("chain_id").notNull().default(1),
  rawData: jsonb("raw_data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_events_agent_id").on(table.agentId),
  index("idx_events_chain_date").on(table.chainId, table.createdAt),
]);

export const indexerState = pgTable("indexer_state", {
  id: varchar("id").primaryKey().default("default"),
  chainId: integer("chain_id").notNull().default(1),
  lastProcessedBlock: integer("last_processed_block").notNull().default(0),
  isRunning: boolean("is_running").notNull().default(false),
  lastError: text("last_error"),
  lastSyncedAt: timestamp("last_synced_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const agentsRelations = relations(agents, ({ many }) => ({
  events: many(agentMetadataEvents),
}));

export const agentMetadataEventsRelations = relations(agentMetadataEvents, ({ one }) => ({
  agent: one(agents, {
    fields: [agentMetadataEvents.agentId],
    references: [agents.id],
  }),
}));

export const indexerEvents = pgTable("indexer_events", {
  id: serial("id").primaryKey(),
  chainId: integer("chain_id").notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  source: varchar("source", { length: 50 }),
  message: text("message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_indexer_events_chain_date").on(table.chainId, table.createdAt),
]);

export const indexerMetrics = pgTable("indexer_metrics", {
  id: serial("id").primaryKey(),
  chainId: integer("chain_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodMinutes: integer("period_minutes").notNull().default(60),
  blocksIndexed: integer("blocks_indexed").notNull().default(0),
  cyclesCompleted: integer("cycles_completed").notNull().default(0),
  cyclesFailed: integer("cycles_failed").notNull().default(0),
  rpcRequests: integer("rpc_requests").notNull().default(0),
  rpcErrors: integer("rpc_errors").notNull().default(0),
  avgCycleMs: integer("avg_cycle_ms").notNull().default(0),
  agentsDiscovered: integer("agents_discovered").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityFeedbackSources = pgTable("community_feedback_sources", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  platform: varchar("platform", { length: 30 }).notNull(),
  platformIdentifier: text("platform_identifier").notNull(),
  matchTier: varchar("match_tier", { length: 20 }),
  isActive: boolean("is_active").notNull().default(true),
  lastScrapedAt: timestamp("last_scraped_at"),
  scrapeErrors: integer("scrape_errors").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_source_agent_platform_id").on(table.agentId, table.platform, table.platformIdentifier),
]);

export const communityFeedbackItems = pgTable("community_feedback_items", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  sourceId: integer("source_id").notNull().references(() => communityFeedbackSources.id),
  platform: varchar("platform", { length: 30 }).notNull(),
  itemType: varchar("item_type", { length: 30 }).notNull(),
  externalId: text("external_id"),
  externalUrl: text("external_url"),
  author: text("author"),
  title: text("title"),
  contentSnippet: text("content_snippet"),
  sentiment: varchar("sentiment", { length: 20 }),
  sentimentScore: real("sentiment_score"),
  engagementScore: integer("engagement_score"),
  rawData: jsonb("raw_data"),
  postedAt: timestamp("posted_at"),
  indexedAt: timestamp("indexed_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_feedback_source_external").on(table.sourceId, table.externalId),
  index("idx_community_feedback_items_agent_id").on(table.agentId),
]);

export const communityFeedbackSummaries = pgTable("community_feedback_summaries", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  totalSources: integer("total_sources").notNull().default(0),
  githubStars: integer("github_stars"),
  githubForks: integer("github_forks"),
  githubOpenIssues: integer("github_open_issues"),
  githubLastCommitAt: timestamp("github_last_commit_at"),
  githubContributors: integer("github_contributors"),
  githubLanguage: text("github_language"),
  githubDescription: text("github_description"),
  githubHealthScore: integer("github_health_score"),
  twitterMentions: integer("twitter_mentions"),
  twitterSentimentPct: integer("twitter_sentiment_pct"),
  redditMentions: integer("reddit_mentions"),
  farcasterFollowers: integer("farcaster_followers"),
  farcasterFollowing: integer("farcaster_following"),
  farcasterScore: real("farcaster_score"),
  farcasterFid: integer("farcaster_fid"),
  farcasterLastCastAt: timestamp("farcaster_last_cast_at"),
  farcasterTotalCasts: integer("farcaster_total_casts"),
  farcasterEngagementAvg: real("farcaster_engagement_avg"),
  overallScore: integer("overall_score"),
  lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_summary_agent").on(table.agentId),
]);

export const x402Probes = pgTable("x402_probes", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  endpointUrl: text("endpoint_url").notNull(),
  endpointName: text("endpoint_name"),
  probeStatus: text("probe_status").notNull(),
  httpStatus: integer("http_status"),
  paymentAddress: text("payment_address"),
  paymentNetwork: text("payment_network"),
  paymentToken: text("payment_token"),
  paymentAmount: text("payment_amount"),
  responseHeaders: jsonb("response_headers"),
  chainId: integer("chain_id").notNull(),
  probedAt: timestamp("probed_at").notNull().defaultNow(),
}, (table) => [
  index("idx_probes_agent_id").on(table.agentId),
  index("idx_probes_probed_at").on(table.probedAt),
  index("idx_probes_agent_probed").on(table.agentId, table.probedAt),
]);

export const agentTransactions = pgTable("agent_transactions", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  chainId: integer("chain_id").notNull(),
  txHash: text("tx_hash").notNull(),
  transferId: text("transfer_id").notNull(),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  amount: text("amount").notNull(),
  amountUsd: real("amount_usd"),
  blockNumber: integer("block_number").notNull(),
  blockTimestamp: timestamp("block_timestamp").notNull(),
  category: text("category").notNull(),
  metadata: jsonb("metadata"),
}, (table) => [
  uniqueIndex("uq_transfer_id_chain").on(table.transferId, table.chainId),
  index("idx_agent_transactions_agent_id").on(table.agentId),
]);

export const transactionSyncState = pgTable("transaction_sync_state", {
  id: serial("id").primaryKey(),
  paymentAddress: text("payment_address").notNull(),
  chainId: integer("chain_id").notNull(),
  lastSyncedBlock: integer("last_synced_block").notNull(),
  lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_sync_addr_chain").on(table.paymentAddress, table.chainId),
]);

// Admin audit trail
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  endpoint: text("endpoint").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  parameters: jsonb("parameters"),
  durationMs: integer("duration_ms"),
  requestId: text("request_id"),
}, (table) => [
  index("idx_audit_log_timestamp").on(table.timestamp),
]);

// Alert delivery deduplication (for stateless watchdog)
export const alertDeliveries = pgTable("alert_deliveries", {
  alertId: text("alert_id").primaryKey(),
  lastDeliveredAt: timestamp("last_delivered_at").notNull().defaultNow(),
});

// Rate limit sliding window entries
export const rateLimitEntries = pgTable("rate_limit_entries", {
  key: text("key").notNull(),
  windowStart: timestamp("window_start").notNull(),
  hitCount: integer("hit_count").notNull().default(1),
}, (table) => [
  uniqueIndex("uq_rate_limit_key_window").on(table.key, table.windowStart),
]);

// API request log for usage analytics
export const apiRequestLog = pgTable("api_request_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ts: timestamp("ts").notNull().defaultNow(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: integer("status_code"),
  durationMs: integer("duration_ms"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  referer: text("referer"),
  country: text("country"),
}, (table) => [
  index("idx_api_request_log_ts").on(table.ts),
  index("idx_api_request_log_ip").on(table.ip, table.ts),
  index("idx_api_request_log_path").on(table.path, table.ts),
]);

// --- Bazaar (x402 marketplace) ---

export const bazaarServices = pgTable("bazaar_services", {
  id: serial("id").primaryKey(),
  resourceUrl: text("resource_url").notNull(),
  name: text("name"),
  description: text("description"),
  category: text("category").notNull().default("other"),
  network: text("network").notNull(),
  asset: text("asset"),
  assetName: text("asset_name"),
  priceRaw: text("price_raw"),
  priceUsd: real("price_usd"),
  payTo: text("pay_to"),
  scheme: text("scheme"),
  x402Version: integer("x402_version"),
  method: text("method"),
  healthStatus: text("health_status"),
  uptimePct: real("uptime_pct"),
  avgLatencyMs: real("avg_latency_ms"),
  trustScore: integer("trust_score"),
  lastHealthCheck: timestamp("last_health_check"),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata"),
  scoutData: jsonb("scout_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_bazaar_resource_url").on(table.resourceUrl),
  index("idx_bazaar_category").on(table.category),
  index("idx_bazaar_network").on(table.network),
  index("idx_bazaar_pay_to").on(table.payTo),
  index("idx_bazaar_price_usd").on(table.priceUsd),
  index("idx_bazaar_is_active").on(table.isActive),
]);

export const bazaarSnapshots = pgTable("bazaar_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  totalServices: integer("total_services").notNull().default(0),
  activeServices: integer("active_services").notNull().default(0),
  newServicesCount: integer("new_services_count").notNull().default(0),
  categoryBreakdown: jsonb("category_breakdown"),
  networkBreakdown: jsonb("network_breakdown"),
  priceStats: jsonb("price_stats"),
  priceByCategoryStats: jsonb("price_by_category_stats"),
  totalPayToWallets: integer("total_pay_to_wallets").notNull().default(0),
  topServices: jsonb("top_services"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_bazaar_snapshot_date").on(table.snapshotDate),
]);

export const insertBazaarServiceSchema = createInsertSchema(bazaarServices).omit({
  id: true,
  createdAt: true,
});

export const insertBazaarSnapshotSchema = createInsertSchema(bazaarSnapshots).omit({
  id: true,
  createdAt: true,
});

export type BazaarService = typeof bazaarServices.$inferSelect;
export type InsertBazaarService = z.infer<typeof insertBazaarServiceSchema>;
export type BazaarSnapshot = typeof bazaarSnapshots.$inferSelect;
export type InsertBazaarSnapshot = z.infer<typeof insertBazaarSnapshotSchema>;

// --- End Bazaar ---

// --- Trust Data Product (x402-gated trust reports) ---

export const trustReports = pgTable("trust_reports", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  lookupAddress: text("lookup_address").notNull(),
  lookupChainId: integer("lookup_chain_id"),
  verdict: text("verdict").notNull(), // trusted, caution, untrusted, unknown
  score: integer("score").notNull().default(0),
  tier: text("tier").notNull().default("unclassified"),
  quickCheckData: jsonb("quick_check_data").notNull(),
  fullReportData: jsonb("full_report_data").notNull(),
  reportVersion: integer("report_version").notNull().default(1),
  compiledAt: timestamp("compiled_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  quickCheckAccessCount: integer("quick_check_access_count").notNull().default(0),
  fullReportAccessCount: integer("full_report_access_count").notNull().default(0),
}, (table) => [
  index("idx_trust_reports_lookup_address").on(table.lookupAddress),
  index("idx_trust_reports_agent_id").on(table.agentId),
  index("idx_trust_reports_expires_at").on(table.expiresAt),
  uniqueIndex("uq_trust_reports_agent").on(table.agentId),
]);

export const insertTrustReportSchema = createInsertSchema(trustReports).omit({
  id: true,
  quickCheckAccessCount: true,
  fullReportAccessCount: true,
});

export type TrustReport = typeof trustReports.$inferSelect;
export type InsertTrustReport = z.infer<typeof insertTrustReportSchema>;

// --- End Trust Data Product ---

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
});

export const insertAgentMetadataEventSchema = createInsertSchema(agentMetadataEvents).omit({
  id: true,
  createdAt: true,
});

export const insertIndexerEventSchema = createInsertSchema(indexerEvents).omit({
  id: true,
  createdAt: true,
});

export const insertIndexerMetricsSchema = createInsertSchema(indexerMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertCommunityFeedbackSourceSchema = createInsertSchema(communityFeedbackSources).omit({
  id: true,
  createdAt: true,
});

export const insertCommunityFeedbackItemSchema = createInsertSchema(communityFeedbackItems).omit({
  id: true,
  indexedAt: true,
});

export const insertCommunityFeedbackSummarySchema = createInsertSchema(communityFeedbackSummaries).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertX402ProbeSchema = createInsertSchema(x402Probes).omit({
  id: true,
  probedAt: true,
});

export const insertAgentTransactionSchema = createInsertSchema(agentTransactions).omit({
  id: true,
});

export const insertTransactionSyncStateSchema = createInsertSchema(transactionSyncState).omit({
  id: true,
  lastSyncedAt: true,
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type AgentMetadataEvent = typeof agentMetadataEvents.$inferSelect;
export type InsertAgentMetadataEvent = z.infer<typeof insertAgentMetadataEventSchema>;
export type IndexerState = typeof indexerState.$inferSelect;
export type IndexerEvent = typeof indexerEvents.$inferSelect;
export type InsertIndexerEvent = z.infer<typeof insertIndexerEventSchema>;
export type IndexerMetric = typeof indexerMetrics.$inferSelect;
export type InsertIndexerMetric = z.infer<typeof insertIndexerMetricsSchema>;
export type CommunityFeedbackSource = typeof communityFeedbackSources.$inferSelect;
export type InsertCommunityFeedbackSource = z.infer<typeof insertCommunityFeedbackSourceSchema>;
export type CommunityFeedbackItem = typeof communityFeedbackItems.$inferSelect;
export type InsertCommunityFeedbackItem = z.infer<typeof insertCommunityFeedbackItemSchema>;
export type CommunityFeedbackSummary = typeof communityFeedbackSummaries.$inferSelect;
export type InsertCommunityFeedbackSummary = z.infer<typeof insertCommunityFeedbackSummarySchema>;
export type X402Probe = typeof x402Probes.$inferSelect;
export type InsertX402Probe = z.infer<typeof insertX402ProbeSchema>;
export type AgentTransaction = typeof agentTransactions.$inferSelect;
export type InsertAgentTransaction = z.infer<typeof insertAgentTransactionSchema>;
export type TransactionSyncState = typeof transactionSyncState.$inferSelect;
export type InsertTransactionSyncState = z.infer<typeof insertTransactionSyncStateSchema>;
