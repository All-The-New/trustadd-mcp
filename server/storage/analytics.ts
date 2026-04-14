import {
  x402Probes,
  agentTransactions,
  transactionSyncState,
  bazaarServices,
  bazaarSnapshots,
  type X402Probe,
  type InsertX402Probe,
  type AgentTransaction,
  type InsertAgentTransaction,
  type BazaarService,
  type InsertBazaarService,
  type BazaarSnapshot,
  type InsertBazaarSnapshot,
} from "../../shared/schema.js";
import { db } from "../db.js";
import { eq, desc, sql, and, isNotNull, count, asc, ilike, or } from "drizzle-orm";

// --- Probes ---

export async function createProbeResult(probe: InsertX402Probe): Promise<X402Probe> {
  const [result] = await db.insert(x402Probes).values(probe).returning();
  return result;
}

export async function getProbeResults(agentId?: string, limit = 100): Promise<X402Probe[]> {
  if (agentId) {
    return db.select().from(x402Probes).where(eq(x402Probes.agentId, agentId)).orderBy(desc(x402Probes.probedAt)).limit(limit);
  }
  return db.select().from(x402Probes).orderBy(desc(x402Probes.probedAt)).limit(limit);
}

export async function getProbeStats(): Promise<{ totalProbed: number; found402: number; uniquePaymentAddresses: number; lastProbeAt: Date | null }> {
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

export async function getAgentsWithPaymentAddresses(): Promise<Array<{
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

export async function getStaleProbeAgentIds(olderThanHours: number): Promise<string[]> {
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

export async function getRecentProbeForEndpoint(agentId: string, endpointUrl: string): Promise<X402Probe | undefined> {
  const results = await db.select().from(x402Probes)
    .where(and(eq(x402Probes.agentId, agentId), eq(x402Probes.endpointUrl, endpointUrl)))
    .orderBy(desc(x402Probes.probedAt))
    .limit(1);
  return results[0];
}

// --- Transactions ---

export async function createTransaction(tx: InsertAgentTransaction): Promise<AgentTransaction> {
  const result = await db.execute(sql`
    INSERT INTO agent_transactions (agent_id, chain_id, tx_hash, transfer_id, from_address, to_address, token_address, token_symbol, amount, amount_usd, block_number, block_timestamp, category, metadata)
    VALUES (${tx.agentId}, ${tx.chainId}, ${tx.txHash}, ${tx.transferId}, ${tx.fromAddress}, ${tx.toAddress}, ${tx.tokenAddress}, ${tx.tokenSymbol}, ${tx.amount}, ${tx.amountUsd ?? null}, ${tx.blockNumber}, ${tx.blockTimestamp}, ${tx.category}, ${tx.metadata ? JSON.stringify(tx.metadata) : null}::jsonb)
    ON CONFLICT (transfer_id, chain_id) DO NOTHING
    RETURNING *
  `);
  return ((result as any).rows ?? [])[0] ?? tx as any;
}

export async function getTransactions(options?: { agentId?: string; limit?: number; offset?: number }): Promise<AgentTransaction[]> {
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

export async function getTransactionStats(): Promise<{
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

export async function getAgentTransactionStats(agentId: string): Promise<{
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

export async function getTopEarningAgents(limit: number = 20): Promise<Array<{
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

export async function getTransactionVolume(period: string): Promise<Array<{ date: string; volume: number; count: number }>> {
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

export async function getTransactionSyncState(address: string, chainId: number): Promise<{ lastSyncedBlock: number } | null> {
  const results = await db.select().from(transactionSyncState)
    .where(and(
      eq(transactionSyncState.paymentAddress, address.toLowerCase()),
      eq(transactionSyncState.chainId, chainId),
    ))
    .limit(1);
  return results[0] ? { lastSyncedBlock: results[0].lastSyncedBlock } : null;
}

export async function upsertTransactionSyncState(address: string, chainId: number, block: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO transaction_sync_state (payment_address, chain_id, last_synced_block, last_synced_at)
    VALUES (${address.toLowerCase()}, ${chainId}, ${block}, NOW())
    ON CONFLICT (payment_address, chain_id) DO UPDATE SET last_synced_block = ${block}, last_synced_at = NOW()
  `);
}

export async function getMostRecentSyncTime(): Promise<Date | null> {
  const result = await db.execute(sql`SELECT MAX(last_synced_at) as max_time FROM transaction_sync_state`);
  const rows = (result as any).rows ?? [];
  return rows[0]?.max_time ? new Date(rows[0].max_time) : null;
}

export async function getKnownPaymentAddresses(): Promise<Array<{ address: string; chainId: number; agentId: string }>> {
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

// --- Status ---

export async function getStatusSummary() {
  const [proberStats, txRows, agentDiscoveryRows, eventRows] = await Promise.all([
    getProbeStats(),
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

// --- Bazaar ---

export async function upsertBazaarService(data: InsertBazaarService): Promise<BazaarService> {
  const [result] = await db.insert(bazaarServices).values(data)
    .onConflictDoUpdate({
      target: bazaarServices.resourceUrl,
      set: {
        name: data.name,
        description: data.description,
        category: data.category,
        network: data.network,
        asset: data.asset,
        assetName: data.assetName,
        priceRaw: data.priceRaw,
        priceUsd: data.priceUsd,
        payTo: data.payTo,
        scheme: data.scheme,
        x402Version: data.x402Version,
        method: data.method,
        healthStatus: data.healthStatus,
        uptimePct: data.uptimePct,
        avgLatencyMs: data.avgLatencyMs,
        trustScore: data.trustScore,
        lastHealthCheck: data.lastHealthCheck,
        lastSeenAt: sql`NOW()`,
        isActive: true,
        metadata: data.metadata,
        scoutData: data.scoutData,
      },
    })
    .returning();
  return result;
}

export async function upsertBazaarServices(data: InsertBazaarService[]): Promise<number> {
  if (data.length === 0) return 0;
  // Batch in chunks of 100
  let total = 0;
  for (let i = 0; i < data.length; i += 100) {
    const chunk = data.slice(i, i + 100);
    await db.insert(bazaarServices).values(chunk)
      .onConflictDoUpdate({
        target: bazaarServices.resourceUrl,
        set: {
          name: sql`EXCLUDED.name`,
          description: sql`EXCLUDED.description`,
          category: sql`EXCLUDED.category`,
          network: sql`EXCLUDED.network`,
          asset: sql`EXCLUDED.asset`,
          assetName: sql`EXCLUDED.asset_name`,
          priceRaw: sql`EXCLUDED.price_raw`,
          priceUsd: sql`EXCLUDED.price_usd`,
          payTo: sql`EXCLUDED.pay_to`,
          scheme: sql`EXCLUDED.scheme`,
          x402Version: sql`EXCLUDED.x402_version`,
          method: sql`EXCLUDED.method`,
          lastSeenAt: sql`NOW()`,
          isActive: sql`TRUE`,
          metadata: sql`EXCLUDED.metadata`,
        },
      });
    total += chunk.length;
  }
  return total;
}

export async function markBazaarServicesInactive(seenCutoff: Date): Promise<number> {
  // Mark as inactive any active service whose last_seen_at is older than the cutoff.
  // The indexer sets last_seen_at = NOW() on every upsert, so anything not touched
  // in this run will have an older timestamp.
  await db.execute(sql`
    UPDATE bazaar_services SET is_active = FALSE
    WHERE is_active = TRUE AND last_seen_at < ${seenCutoff}
  `);
  return 0;
}

export async function getBazaarServices(opts: { category?: string; network?: string; search?: string; sortBy?: string; limit?: number; offset?: number } = {}): Promise<{ services: BazaarService[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const conditions = [eq(bazaarServices.isActive, true)];
  if (opts.category) conditions.push(eq(bazaarServices.category, opts.category));
  if (opts.network) conditions.push(eq(bazaarServices.network, opts.network));
  if (opts.search) {
    // Escape SQL LIKE special characters to prevent pattern injection
    const safeSearch = opts.search.replace(/[%_\\]/g, "\\$&");
    conditions.push(
      or(
        ilike(bazaarServices.name, `%${safeSearch}%`),
        ilike(bazaarServices.description, `%${safeSearch}%`),
      )!
    );
  }

  const where = and(...conditions);

  let orderBy;
  switch (opts.sortBy) {
    case "price_asc": orderBy = asc(bazaarServices.priceUsd); break;
    case "price_desc": orderBy = desc(bazaarServices.priceUsd); break;
    case "trust": orderBy = desc(bazaarServices.trustScore); break;
    case "latency": orderBy = asc(bazaarServices.avgLatencyMs); break;
    case "newest": orderBy = desc(bazaarServices.firstSeenAt); break;
    default: orderBy = desc(bazaarServices.lastSeenAt);
  }

  const [services, countResult] = await Promise.all([
    db.select().from(bazaarServices).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ count: count() }).from(bazaarServices).where(where),
  ]);

  return { services, total: Number(countResult[0]?.count ?? 0) };
}

export async function getBazaarStats(): Promise<{
  totalServices: number;
  activeServices: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  networkBreakdown: Array<{ network: string; count: number }>;
  priceStats: { median: number | null; mean: number | null; min: number | null; max: number | null };
  totalPayToWallets: number;
}> {
  const [totals, categories, networks, prices, wallets] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_active) AS active
      FROM bazaar_services
    `),
    db.execute(sql`
      SELECT category, COUNT(*)::int AS count
      FROM bazaar_services WHERE is_active = TRUE
      GROUP BY category ORDER BY count DESC
    `),
    db.execute(sql`
      SELECT network, COUNT(*)::int AS count
      FROM bazaar_services WHERE is_active = TRUE
      GROUP BY network ORDER BY count DESC
    `),
    db.execute(sql`
      SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd) AS median,
        AVG(price_usd) AS mean,
        MIN(price_usd) AS min,
        MAX(price_usd) AS max
      FROM bazaar_services
      WHERE is_active = TRUE AND price_usd IS NOT NULL AND price_usd > 0
    `),
    db.execute(sql`
      SELECT COUNT(DISTINCT pay_to)::int AS count
      FROM bazaar_services WHERE is_active = TRUE AND pay_to IS NOT NULL
    `),
  ]);

  const t = totals.rows[0] as any;
  const p = prices.rows[0] as any;

  return {
    totalServices: Number(t.total),
    activeServices: Number(t.active),
    categoryBreakdown: (categories.rows as any[]).map(r => ({ category: r.category, count: Number(r.count) })),
    networkBreakdown: (networks.rows as any[]).map(r => ({ network: r.network, count: Number(r.count) })),
    priceStats: {
      median: p.median != null ? Number(p.median) : null,
      mean: p.mean != null ? Number(p.mean) : null,
      min: p.min != null ? Number(p.min) : null,
      max: p.max != null ? Number(p.max) : null,
    },
    totalPayToWallets: Number((wallets.rows[0] as any).count),
  };
}

export async function getBazaarSnapshots(limit = 90): Promise<BazaarSnapshot[]> {
  return db.select().from(bazaarSnapshots)
    .orderBy(desc(bazaarSnapshots.snapshotDate))
    .limit(limit);
}

export async function createBazaarSnapshot(data: InsertBazaarSnapshot): Promise<BazaarSnapshot> {
  const [result] = await db.insert(bazaarSnapshots).values(data)
    .onConflictDoUpdate({
      target: bazaarSnapshots.snapshotDate,
      set: {
        totalServices: data.totalServices,
        activeServices: data.activeServices,
        newServicesCount: data.newServicesCount,
        categoryBreakdown: data.categoryBreakdown,
        networkBreakdown: data.networkBreakdown,
        priceStats: data.priceStats,
        priceByCategoryStats: data.priceByCategoryStats,
        totalPayToWallets: data.totalPayToWallets,
        topServices: data.topServices,
      },
    })
    .returning();
  return result;
}

export async function getBazaarTopServices(limit = 20): Promise<BazaarService[]> {
  return db.select().from(bazaarServices)
    .where(and(
      eq(bazaarServices.isActive, true),
      isNotNull(bazaarServices.trustScore),
    ))
    .orderBy(desc(bazaarServices.trustScore), asc(bazaarServices.avgLatencyMs))
    .limit(limit);
}
