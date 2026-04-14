import {
  indexerState,
  indexerEvents,
  indexerMetrics,
  type IndexerState,
  type IndexerEvent,
  type InsertIndexerEvent,
  type IndexerMetric,
  type InsertIndexerMetric,
} from "../../shared/schema.js";
import { db } from "../db.js";
import { eq, desc, sql, and, gt, lt, count } from "drizzle-orm";

function getIndexerStateId(chainId: number): string {
  return chainId === 1 ? "default" : `chain-${chainId}`;
}

export async function getIndexerState(chainId: number = 1): Promise<IndexerState> {
  const stateId = getIndexerStateId(chainId);
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

export async function updateIndexerState(chainId: number = 1, updates: Partial<IndexerState>): Promise<void> {
  const stateId = getIndexerStateId(chainId);
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

export async function logIndexerEvent(event: InsertIndexerEvent): Promise<IndexerEvent> {
  const [result] = await db.insert(indexerEvents).values(event).returning();
  return result;
}

export async function getSpamRanges(chainId: number, afterBlock: number): Promise<Array<{ from: number; to: number }>> {
  const rows = await db.select({
    from: sql<number>`(metadata->>'fromBlock')::int`,
    to: sql<number>`(metadata->>'toBlock')::int`,
  })
    .from(indexerEvents)
    .where(and(
      eq(indexerEvents.chainId, chainId),
      eq(indexerEvents.eventType, "spam_skip"),
      gt(sql`(metadata->>'toBlock')::int`, afterBlock),
    ))
    .orderBy(sql`(metadata->>'fromBlock')::int`)
    .limit(5000);
  return rows;
}

export async function getRecentIndexerEvents(limit = 50, chainId?: number, eventType?: string): Promise<IndexerEvent[]> {
  const conditions = [];
  if (chainId !== undefined) conditions.push(eq(indexerEvents.chainId, chainId));
  if (eventType) conditions.push(eq(indexerEvents.eventType, eventType));

  const query = db.select().from(indexerEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(indexerEvents.createdAt))
    .limit(Math.min(limit, 200));

  return await query;
}

export async function getIndexerEventCounts(sinceMinutes = 60, chainId?: number): Promise<Array<{ eventType: string; count: number }>> {
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

export async function recordMetricsPeriod(metrics: InsertIndexerMetric): Promise<IndexerMetric> {
  const [result] = await db.insert(indexerMetrics).values(metrics).returning();
  return result;
}

export async function getMetricsHistory(chainId?: number, hours = 24): Promise<IndexerMetric[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const conditions = [gt(indexerMetrics.periodStart, since)];
  if (chainId !== undefined) conditions.push(eq(indexerMetrics.chainId, chainId));

  return await db.select().from(indexerMetrics)
    .where(and(...conditions))
    .orderBy(desc(indexerMetrics.periodStart));
}

export async function pruneOldEvents(olderThanDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await db.delete(indexerEvents).where(lt(indexerEvents.createdAt, cutoff)).returning({ id: indexerEvents.id });
  return result.length;
}

export async function pruneOldMetrics(olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await db.delete(indexerMetrics).where(lt(indexerMetrics.createdAt, cutoff)).returning({ id: indexerMetrics.id });
  return result.length;
}
