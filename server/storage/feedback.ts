import {
  communityFeedbackSources,
  communityFeedbackItems,
  communityFeedbackSummaries,
  type CommunityFeedbackSource,
  type InsertCommunityFeedbackSource,
  type CommunityFeedbackItem,
  type InsertCommunityFeedbackItem,
  type CommunityFeedbackSummary,
  type InsertCommunityFeedbackSummary,
} from "../../shared/schema.js";
import { db } from "../db.js";
import { eq, desc, and, or, isNull, lte, asc, lt, count, inArray } from "drizzle-orm";

export async function getCommunityFeedbackSources(agentId?: string, platform?: string): Promise<CommunityFeedbackSource[]> {
  const conditions = [];
  if (agentId) conditions.push(eq(communityFeedbackSources.agentId, agentId));
  if (platform) conditions.push(eq(communityFeedbackSources.platform, platform));
  conditions.push(eq(communityFeedbackSources.isActive, true));
  return db.select().from(communityFeedbackSources)
    .where(and(...conditions))
    .orderBy(desc(communityFeedbackSources.createdAt));
}

export async function createCommunityFeedbackSource(source: InsertCommunityFeedbackSource): Promise<CommunityFeedbackSource> {
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

export async function updateCommunityFeedbackSource(id: number, updates: Partial<CommunityFeedbackSource>): Promise<void> {
  await db.update(communityFeedbackSources)
    .set(updates)
    .where(eq(communityFeedbackSources.id, id));
}

export async function getStaleSourcesForPlatform(platform: string, olderThanHours: number): Promise<CommunityFeedbackSource[]> {
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

export async function createCommunityFeedbackItem(item: InsertCommunityFeedbackItem): Promise<CommunityFeedbackItem | null> {
  const [result] = await db.insert(communityFeedbackItems)
    .values(item)
    .onConflictDoNothing()
    .returning();
  return result || null;
}

export async function getCommunityFeedbackItems(agentId: string, platform?: string, itemType?: string, limit = 20): Promise<CommunityFeedbackItem[]> {
  const conditions = [eq(communityFeedbackItems.agentId, agentId)];
  if (platform) conditions.push(eq(communityFeedbackItems.platform, platform));
  if (itemType) conditions.push(eq(communityFeedbackItems.itemType, itemType));
  return db.select().from(communityFeedbackItems)
    .where(and(...conditions))
    .orderBy(desc(communityFeedbackItems.indexedAt))
    .limit(limit);
}

export async function pruneOldFeedbackItems(olderThanDays: number, platform?: string): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const conditions = [lt(communityFeedbackItems.indexedAt, cutoff)];
  if (platform) conditions.push(eq(communityFeedbackItems.platform, platform));
  const result = await db.delete(communityFeedbackItems)
    .where(and(...conditions))
    .returning({ id: communityFeedbackItems.id });
  return result.length;
}

export async function getCommunityFeedbackSummary(agentId: string): Promise<CommunityFeedbackSummary | undefined> {
  const [result] = await db.select().from(communityFeedbackSummaries)
    .where(eq(communityFeedbackSummaries.agentId, agentId));
  return result || undefined;
}

export async function upsertCommunityFeedbackSummary(agentId: string, data: Partial<InsertCommunityFeedbackSummary>): Promise<CommunityFeedbackSummary> {
  const [result] = await db.insert(communityFeedbackSummaries)
    .values({ agentId, ...data })
    .onConflictDoUpdate({
      target: communityFeedbackSummaries.agentId,
      set: { ...data, lastUpdatedAt: new Date() },
    })
    .returning();
  return result;
}

export async function getAgentsWithCommunityFeedback(limit = 50, offset = 0): Promise<CommunityFeedbackSummary[]> {
  return db.select().from(communityFeedbackSummaries)
    .orderBy(desc(communityFeedbackSummaries.githubStars))
    .limit(limit)
    .offset(offset);
}

export async function getCommunityFeedbackSummariesByAgentIds(agentIds: string[]): Promise<CommunityFeedbackSummary[]> {
  if (agentIds.length === 0) return [];
  return db.select().from(communityFeedbackSummaries)
    .where(inArray(communityFeedbackSummaries.agentId, agentIds));
}

export async function getCommunityFeedbackStats(): Promise<{ totalAgentsWithFeedback: number; totalItems: number; platformBreakdown: Array<{ platform: string; count: number }> }> {
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
