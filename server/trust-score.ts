import { type Agent, type CommunityFeedbackSummary, agents } from "../shared/schema";
import { storage } from "./storage";
import { db } from "./db";
import { eq, isNull, sql } from "drizzle-orm";
import { log } from "./lib/log";

function looksLikeImageUrl(url: string): boolean {
  if (!url || url.length < 5) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:image/")) return true;
  const clean = lower.split("?")[0].split("#")[0];
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico", ".bmp"];
  if (imageExtensions.some(ext => clean.endsWith(ext))) return true;
  if (lower.includes("/image") || lower.includes("avatar") || lower.includes("logo")) return true;
  if (lower.includes("ipfs://") || lower.includes("arweave")) return true;
  const knownImageHosts = ["blob.8004scan.app", "r2-image-worker", "gateway.autonolas.tech", "meerkat.town", "cloudflare-ipfs"];
  if (knownImageHosts.some(h => lower.includes(h))) return true;
  return false;
}

export interface TrustScoreBreakdown {
  total: number;
  identity: number;
  history: number;
  capability: number;
  community: number;
  transparency: number;
}

export function calculateTrustScore(
  agent: Agent,
  feedback?: CommunityFeedbackSummary | null,
  eventCount?: number,
  crossChainCount?: number,
): TrustScoreBreakdown {
  let identity = 0;
  let history = 0;
  let capability = 0;
  let community = 0;
  let transparency = 0;

  if (agent.name && agent.name.trim().length > 0) identity += 5;
  if (agent.description && agent.description.trim().length > 0) {
    const descLen = agent.description.trim().length;
    if (descLen >= 100) identity += 5;
    else if (descLen >= 30) identity += 3;
    else identity += 1;
  }
  if (agent.imageUrl && looksLikeImageUrl(agent.imageUrl)) identity += 5;
  const endpoints = agent.endpoints as any;
  const hasEndpoints = endpoints && (Array.isArray(endpoints) ? endpoints.length > 0 : Object.keys(endpoints).length > 0);
  if (hasEndpoints) identity += 5;
  if ((agent.tags && agent.tags.length > 0) || (agent.oasfSkills && agent.oasfSkills.length > 0)) identity += 5;

  const ageDays = (Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays >= 30) history += 10;
  else if (ageDays >= 7) history += 5;
  else if (ageDays >= 1) history += 2;

  const updates = eventCount ?? 0;
  if (updates >= 2) history += 5;
  else if (updates >= 1) history += 2;

  const crossChain = crossChainCount ?? 0;
  if (crossChain >= 3) history += 5;
  else if (crossChain >= 2) history += 3;

  if (agent.x402Support === true) capability += 5;

  const skillCount = (agent.oasfSkills?.length ?? 0) + (agent.oasfDomains?.length ?? 0);
  if (skillCount >= 3) capability += 5;
  else if (skillCount >= 1) capability += 3;

  let endpointCount = 0;
  if (endpoints) {
    if (Array.isArray(endpoints)) endpointCount = endpoints.length;
    else if (typeof endpoints === "object") endpointCount = Object.keys(endpoints).length;
  }
  if (endpointCount >= 3) capability += 5;
  else if (endpointCount >= 1) capability += 3;

  if (feedback) {
    const ghScore = feedback.githubHealthScore ?? 0;
    if (ghScore >= 70) community += 10;
    else if (ghScore >= 40) community += 6;
    else if (ghScore > 0) community += 3;

    const fcScore = feedback.farcasterScore ?? 0;
    if (fcScore >= 0.7) community += 5;
    else if (fcScore >= 0.4) community += 3;
    else if (fcScore > 0) community += 1;

    if (feedback.totalSources > 0) community += 5;
  }

  const uri = agent.metadataUri ?? "";
  if (uri.startsWith("ipfs://")) transparency += 8;
  else if (uri.startsWith("ar://")) transparency += 8;
  else if (uri.startsWith("https://")) transparency += 5;
  else if (uri.startsWith("http://")) transparency += 3;
  else if (uri.startsWith("data:")) transparency += 2;

  if (agent.supportedTrust && agent.supportedTrust.length > 0) {
    const trustCount = agent.supportedTrust.length;
    if (trustCount >= 3) transparency += 7;
    else if (trustCount >= 2) transparency += 5;
    else transparency += 3;
  }

  if (agent.activeStatus === true) transparency += 5;

  const total = identity + history + capability + community + transparency;

  return { total, identity, history, capability, community, transparency };
}

export async function recalculateScore(agentId: string): Promise<TrustScoreBreakdown | null> {
  const agent = await storage.getAgent(agentId);
  if (!agent) return null;

  const events = await storage.getAgentEvents(agentId);
  const eventCount = events.filter(e => e.eventType === "MetadataUpdated" || e.eventType === "AgentURISet").length;

  let crossChainCount = 0;
  try {
    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT chain_id) as cnt FROM agents 
      WHERE controller_address = ${agent.controllerAddress}
    `);
    crossChainCount = Number((result as any).rows?.[0]?.cnt ?? 0);
  } catch {}

  let feedback: CommunityFeedbackSummary | null = null;
  try {
    feedback = await storage.getCommunityFeedbackSummary(agentId);
  } catch {}

  const breakdown = calculateTrustScore(agent, feedback, eventCount, crossChainCount);

  await db.update(agents).set({
    trustScore: breakdown.total,
    trustScoreBreakdown: breakdown,
    trustScoreUpdatedAt: new Date(),
  }).where(eq(agents.id, agentId));

  return breakdown;
}

export async function recalculateAllScores(): Promise<{ updated: number; elapsed: number }> {
  const start = Date.now();
  log("Starting batch trust score recalculation...", "trust-score");

  const allAgents = await storage.getAllAgents();

  const feedbackMap = new Map<string, CommunityFeedbackSummary>();
  try {
    const summaries = await db.select().from(
      (await import("@shared/schema")).communityFeedbackSummaries
    );
    for (const s of summaries) {
      feedbackMap.set(s.agentId, s);
    }
  } catch {}

  const controllerChains = new Map<string, number>();
  try {
    const result = await db.execute(sql`
      SELECT controller_address, COUNT(DISTINCT chain_id)::int as cnt 
      FROM agents 
      GROUP BY controller_address 
      HAVING COUNT(DISTINCT chain_id) > 1
    `);
    for (const row of (result as any).rows ?? []) {
      controllerChains.set(row.controller_address, row.cnt);
    }
  } catch {}

  const eventCounts = new Map<string, number>();
  try {
    const result = await db.execute(sql`
      SELECT agent_id, COUNT(*)::int as cnt FROM agent_metadata_events 
      WHERE event_type IN ('MetadataUpdated', 'AgentURISet')
      GROUP BY agent_id
    `);
    for (const row of (result as any).rows ?? []) {
      eventCounts.set(row.agent_id, row.cnt);
    }
  } catch {}

  let updated = 0;
  const BATCH_SIZE = 500;

  for (let i = 0; i < allAgents.length; i += BATCH_SIZE) {
    const batch = allAgents.slice(i, i + BATCH_SIZE);
    const updates: Array<{ id: string; score: number; breakdown: TrustScoreBreakdown }> = [];

    for (const agent of batch) {
      const feedback = feedbackMap.get(agent.id) ?? null;
      const evtCount = eventCounts.get(agent.id) ?? 0;
      const crossChain = controllerChains.get(agent.controllerAddress) ?? 0;
      const breakdown = calculateTrustScore(agent, feedback, evtCount, crossChain);
      updates.push({ id: agent.id, score: breakdown.total, breakdown });
    }

    for (const u of updates) {
      await db.update(agents).set({
        trustScore: u.score,
        trustScoreBreakdown: u.breakdown,
        trustScoreUpdatedAt: new Date(),
      }).where(eq(agents.id, u.id));
    }

    updated += updates.length;
    if (i % 5000 === 0 && i > 0) {
      log(`Trust score progress: ${updated}/${allAgents.length} agents`, "trust-score");
    }
  }

  const elapsed = Date.now() - start;
  log(`Trust score recalculation complete: ${updated} agents in ${(elapsed / 1000).toFixed(1)}s`, "trust-score");
  return { updated, elapsed };
}

export async function ensureScoresCalculated(): Promise<void> {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE trust_score IS NULL) as unscored,
        COUNT(*) as total
      FROM agents
    `);
    const row = (result as any).rows?.[0];
    const unscored = Number(row?.unscored ?? 0);
    const total = Number(row?.total ?? 0);

    if (total > 0 && unscored / total > 0.5) {
      log(`${unscored}/${total} agents unscored (${Math.round(unscored / total * 100)}%), running batch recalculation`, "trust-score");
      await recalculateAllScores();
    } else if (unscored > 0) {
      log(`${unscored} agents unscored, running incremental recalculation`, "trust-score");
      let scored = 0;
      while (true) {
        const batch = await db.select({ id: agents.id }).from(agents).where(isNull(agents.trustScore)).limit(500);
        if (batch.length === 0) break;
        for (const a of batch) {
          await recalculateScore(a.id);
        }
        scored += batch.length;
      }
      log(`Incremental recalculation complete: ${scored} agents scored`, "trust-score");
    } else {
      log(`All ${total} agents have trust scores`, "trust-score");
    }
  } catch (err) {
    log(`Trust score initialization error: ${(err as Error).message}`, "trust-score");
  }
}
