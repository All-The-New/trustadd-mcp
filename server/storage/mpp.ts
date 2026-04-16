import { db } from "../db.js";
import { sql, eq, desc, and } from "drizzle-orm";
import {
  mppDirectoryServices,
  mppDirectorySnapshots,
  mppProbes,
  agentTransactions,
  transactionSyncState,
  agents,
  type InsertMppDirectoryService,
  type InsertMppDirectorySnapshot,
  type InsertMppProbe,
  type MppDirectoryService,
  type MppProbe,
  type TransactionSyncState,
  type InsertAgentTransaction,
  type Agent,
} from "../../shared/schema.js";

// --- Directory services ---

export async function upsertMppDirectoryService(record: InsertMppDirectoryService): Promise<void> {
  await db.insert(mppDirectoryServices)
    .values(record)
    .onConflictDoUpdate({
      target: mppDirectoryServices.serviceUrl,
      set: {
        serviceName: record.serviceName,
        providerName: record.providerName,
        description: record.description,
        category: record.category,
        pricingModel: record.pricingModel,
        priceAmount: record.priceAmount,
        priceCurrency: record.priceCurrency,
        paymentMethods: record.paymentMethods,
        recipientAddress: record.recipientAddress,
        isActive: true,
        lastSeenAt: new Date(),
        metadata: record.metadata,
        updatedAt: new Date(),
      },
    });
}

export async function markMppServicesInactive(beforeDate: Date): Promise<number> {
  const result = await db.execute(sql`
    UPDATE mpp_directory_services
    SET is_active = false, updated_at = now()
    WHERE last_seen_at < ${beforeDate} AND is_active = true
  `);
  return (result as any).rowCount ?? 0;
}

export async function listMppServices(options: {
  limit?: number;
  offset?: number;
  category?: string;
  paymentMethod?: string;
  search?: string;
} = {}): Promise<{ services: MppDirectoryService[]; total: number }> {
  const conds: any[] = [eq(mppDirectoryServices.isActive, true)];
  if (options.category) conds.push(eq(mppDirectoryServices.category, options.category));
  if (options.search) conds.push(sql`${mppDirectoryServices.serviceName} ILIKE ${"%" + options.search + "%"}`);
  if (options.paymentMethod) {
    conds.push(sql`${mppDirectoryServices.paymentMethods} @> ${JSON.stringify([{ method: options.paymentMethod }])}::jsonb`);
  }

  const where = and(...conds);
  const rows = await db.select().from(mppDirectoryServices)
    .where(where)
    .orderBy(desc(mppDirectoryServices.lastSeenAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM mpp_directory_services WHERE is_active = true
    ${options.category ? sql`AND category = ${options.category}` : sql``}
  `);
  const total = Number((countResult.rows[0] as any).n);
  return { services: rows, total };
}

export async function getMppDirectoryStats(): Promise<{
  totalServices: number;
  activeServices: number;
  categoryBreakdown: Record<string, number>;
  pricingModelBreakdown: Record<string, number>;
  paymentMethodBreakdown: Record<string, number>;
  priceStats: { median: number; mean: number; min: number; max: number } | null;
  snapshotDate: string | null;
}> {
  const catRes = await db.execute(sql`
    SELECT category, COUNT(*)::int AS n FROM mpp_directory_services WHERE is_active = true GROUP BY category
  `);
  const categoryBreakdown: Record<string, number> = {};
  for (const row of catRes.rows as any[]) categoryBreakdown[row.category] = Number(row.n);

  const pmRes = await db.execute(sql`
    SELECT pricing_model, COUNT(*)::int AS n FROM mpp_directory_services
    WHERE is_active = true AND pricing_model IS NOT NULL GROUP BY pricing_model
  `);
  const pricingModelBreakdown: Record<string, number> = {};
  for (const row of pmRes.rows as any[]) pricingModelBreakdown[row.pricing_model] = Number(row.n);

  const methodRes = await db.execute(sql`
    SELECT jsonb_array_elements(payment_methods)->>'method' AS method, COUNT(*)::int AS n
    FROM mpp_directory_services
    WHERE is_active = true AND jsonb_array_length(payment_methods) > 0
    GROUP BY method
  `);
  const paymentMethodBreakdown: Record<string, number> = {};
  for (const row of methodRes.rows as any[]) paymentMethodBreakdown[row.method] = Number(row.n);

  const priceRes = await db.execute(sql`
    SELECT
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (price_amount)::numeric) AS median,
      AVG((price_amount)::numeric) AS mean,
      MIN((price_amount)::numeric) AS min,
      MAX((price_amount)::numeric) AS max
    FROM mpp_directory_services
    WHERE is_active = true AND price_amount ~ '^[0-9.]+$'
  `);
  const priceRow = priceRes.rows[0] as any;
  const priceStats = priceRow?.median != null
    ? { median: Number(priceRow.median), mean: Number(priceRow.mean), min: Number(priceRow.min), max: Number(priceRow.max) }
    : null;

  const counts = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_active)::int AS active
    FROM mpp_directory_services
  `);
  const crow = counts.rows[0] as any;

  const snap = await db.execute(sql`SELECT snapshot_date FROM mpp_directory_snapshots ORDER BY snapshot_date DESC LIMIT 1`);
  const snapDate = (snap.rows[0] as any)?.snapshot_date ?? null;

  return {
    totalServices: Number(crow.total),
    activeServices: Number(crow.active),
    categoryBreakdown,
    pricingModelBreakdown,
    paymentMethodBreakdown,
    priceStats,
    snapshotDate: snapDate,
  };
}

// --- Snapshots ---

export async function createMppSnapshot(record: InsertMppDirectorySnapshot): Promise<void> {
  await db.insert(mppDirectorySnapshots).values(record).onConflictDoNothing();
}

export async function getMppDirectoryTrends(days: number = 30): Promise<any[]> {
  const rows = await db.select().from(mppDirectorySnapshots)
    .orderBy(desc(mppDirectorySnapshots.snapshotDate))
    .limit(days);
  return rows.reverse();
}

// --- Probes ---

export async function createMppProbe(record: InsertMppProbe): Promise<void> {
  await db.insert(mppProbes).values(record);
}

export async function getRecentMppProbeForEndpoint(agentId: string, endpointUrl: string): Promise<MppProbe | undefined> {
  const rows = await db.select().from(mppProbes)
    .where(and(eq(mppProbes.agentId, agentId), eq(mppProbes.endpointUrl, endpointUrl)))
    .orderBy(desc(mppProbes.probedAt)).limit(1);
  return rows[0];
}

export async function getStaleMppProbeAgentIds(staleHours: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000);
  const res = await db.execute(sql`
    SELECT a.id FROM agents a
    WHERE a.endpoints IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM mpp_probes p
      WHERE p.agent_id = a.id AND p.probed_at > ${cutoff}
    )
    LIMIT 2000
  `);
  return (res.rows as any[]).map((r) => r.id);
}

export async function getMppProbeStats(): Promise<{ foundMpp: number; tempoAddresses: number }> {
  const res = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE has_mpp)::int AS found,
      COUNT(DISTINCT tempo_address) FILTER (WHERE tempo_address IS NOT NULL)::int AS addrs
    FROM mpp_probes
  `);
  const row = res.rows[0] as any;
  return { foundMpp: Number(row.found), tempoAddresses: Number(row.addrs) };
}

// --- Tempo-specific views on reused tables ---

export async function getTransactionSyncStatesForChain(chainId: number): Promise<TransactionSyncState[]> {
  return await db.select().from(transactionSyncState).where(eq(transactionSyncState.chainId, chainId));
}

export async function updateTransactionSyncState(paymentAddress: string, chainId: number, lastSyncedBlock: number): Promise<void> {
  await db.update(transactionSyncState)
    .set({ lastSyncedBlock, lastSyncedAt: new Date() })
    .where(and(eq(transactionSyncState.paymentAddress, paymentAddress), eq(transactionSyncState.chainId, chainId)));
}

export async function upsertAgentTransaction(record: InsertAgentTransaction): Promise<void> {
  await db.insert(agentTransactions)
    .values(record)
    .onConflictDoNothing({ target: [agentTransactions.transferId, agentTransactions.chainId] });
}

export async function getAgentByTempoAddress(address: string): Promise<Agent | undefined> {
  // Look up by recent MPP probe that wrote this address
  const res = await db.select({ agentId: mppProbes.agentId }).from(mppProbes)
    .where(eq(mppProbes.tempoAddress, address)).limit(1);
  if (res.length === 0) return undefined;
  const rows = await db.select().from(agents).where(eq(agents.id, res[0].agentId)).limit(1);
  return rows[0];
}

// --- Cross-protocol analytics ---

export async function getMultiProtocolAgentIds(): Promise<string[]> {
  const res = await db.execute(sql`
    WITH x402_agents AS (
      SELECT DISTINCT agent_id FROM x402_probes
      WHERE probe_status = 'success' AND payment_address IS NOT NULL
    ),
    mpp_agents AS (
      SELECT DISTINCT agent_id FROM mpp_probes WHERE has_mpp = true
    )
    SELECT a.id
    FROM agents a
    JOIN x402_agents x ON x.agent_id = a.id
    JOIN mpp_agents m ON m.agent_id = a.id
  `);
  return (res.rows as any[]).map((r) => r.id);
}

export async function getMppAdoptionStats(): Promise<{ mpp: number; x402: number; both: number }> {
  const res = await db.execute(sql`
    WITH mpp_a AS (SELECT DISTINCT agent_id FROM mpp_probes WHERE has_mpp = true),
         x402_a AS (SELECT DISTINCT agent_id FROM x402_probes WHERE probe_status='success' AND payment_address IS NOT NULL)
    SELECT
      (SELECT COUNT(*) FROM mpp_a)::int  AS mpp,
      (SELECT COUNT(*) FROM x402_a)::int AS x402,
      (SELECT COUNT(*) FROM mpp_a INNER JOIN x402_a USING (agent_id))::int AS both
  `);
  const row = res.rows[0] as any;
  return { mpp: Number(row.mpp), x402: Number(row.x402), both: Number(row.both) };
}

export async function getMppTempoChainStats(): Promise<{ volume: number; txCount: number; uniquePayers: number; activeRecipients: number }> {
  const res = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount_usd), 0)::float AS volume,
      COUNT(*)::int AS tx,
      COUNT(DISTINCT from_address)::int AS payers,
      COUNT(DISTINCT to_address)::int AS recipients
    FROM agent_transactions
    WHERE chain_id = 4217 AND category = 'mpp_payment'
  `);
  const row = res.rows[0] as any;
  return {
    volume: Number(row.volume),
    txCount: Number(row.tx),
    uniquePayers: Number(row.payers),
    activeRecipients: Number(row.recipients),
  };
}
