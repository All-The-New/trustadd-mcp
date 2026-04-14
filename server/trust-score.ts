import { type Agent, type CommunityFeedbackSummary, agents } from "../shared/schema.js";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { eq, isNull, sql } from "drizzle-orm";
import { log } from "./lib/log.js";
import { computeSignalHash, METHODOLOGY_VERSION } from "./trust-provenance.js";
import { computeConfidence } from "./trust-confidence.js";

export function looksLikeImageUrl(url: string): boolean {
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

export interface TrustSignal {
  dimension: "identity" | "history" | "capability" | "community" | "transparency";
  name: string;
  points: number;
  maxPoints: number;
  earned: boolean;
  detail?: string;
}

export interface TrustOpportunity {
  signal: string;
  dimension: string;
  maxPoints: number;
  hint: string;
}

export interface TrustScoreBreakdown {
  total: number;
  identity: number;
  history: number;
  capability: number;
  community: number;
  transparency: number;
  signals: TrustSignal[];
  opportunities: TrustOpportunity[];
}

function getOpportunityHint(signalName: string): string {
  const hints: Record<string, string> = {
    agent_name: "Set a descriptive agent name in your ERC-8004 metadata",
    description_quality: "Add a description of at least 100 characters explaining what your agent does",
    image_url: "Add an image URL (PNG, SVG, or IPFS-hosted) to your agent metadata",
    endpoints_declared: "Declare at least one API endpoint in your agent metadata",
    tags_or_skills: "Add tags or OASF skills to help users discover your agent",
    agent_age: "Trust accumulates over time — agents gain full age points after 30 days",
    metadata_updates: "Update your agent metadata at least twice to demonstrate active maintenance",
    cross_chain_presence: "Deploy or register your agent on 2+ chains to earn cross-chain points",
    x402_payment: "Enable x402 payment headers on at least one endpoint",
    oasf_skills: "Register at least 1 OASF skill or domain (3+ for maximum points)",
    endpoint_count: "Declare at least 3 endpoints to reach the maximum capability score",
    github_health: "Connect a healthy GitHub repository with recent activity and good engagement",
    farcaster_presence: "Establish a Farcaster presence with a score above 0.4",
    community_sources: "Get listed in at least one community data source",
    metadata_storage: "Store metadata on IPFS or Arweave for immutability (8 points vs 5 for HTTPS)",
    trust_protocols: "Support at least 2 trust protocols (e.g. eip712, erc7710) for 5 points; 3+ for 7",
    active_status: "Set activeStatus to true in your agent metadata",
  };
  return hints[signalName] ?? `Improve the ${signalName.replace(/_/g, " ")} signal`;
}

export function calculateTrustScore(
  agent: Agent,
  feedback?: CommunityFeedbackSummary | null,
  eventCount?: number,
  crossChainCount?: number,
): TrustScoreBreakdown {
  const signals: TrustSignal[] = [];

  // ── Identity ─────────────────────────────────────────────────────────────
  const hasName = Boolean(agent.name && agent.name.trim().length > 0);
  signals.push({
    dimension: "identity",
    name: "agent_name",
    points: hasName ? 5 : 0,
    maxPoints: 5,
    earned: hasName,
    detail: hasName ? agent.name!.trim() : undefined,
  });

  let descPoints = 0;
  let descDetail: string | undefined;
  if (agent.description && agent.description.trim().length > 0) {
    const descLen = agent.description.trim().length;
    descDetail = `${descLen} chars`;
    if (descLen >= 100) descPoints = 5;
    else if (descLen >= 30) descPoints = 3;
    else descPoints = 1;
  }
  signals.push({
    dimension: "identity",
    name: "description_quality",
    points: descPoints,
    maxPoints: 5,
    earned: descPoints > 0,
    detail: descDetail,
  });

  const hasImage = Boolean(agent.imageUrl && looksLikeImageUrl(agent.imageUrl));
  signals.push({
    dimension: "identity",
    name: "image_url",
    points: hasImage ? 5 : 0,
    maxPoints: 5,
    earned: hasImage,
    detail: hasImage ? agent.imageUrl! : undefined,
  });

  const endpoints = agent.endpoints as any;
  const hasEndpoints = Boolean(
    endpoints && (Array.isArray(endpoints) ? endpoints.length > 0 : Object.keys(endpoints).length > 0)
  );
  signals.push({
    dimension: "identity",
    name: "endpoints_declared",
    points: hasEndpoints ? 5 : 0,
    maxPoints: 5,
    earned: hasEndpoints,
  });

  const hasTagsOrSkills = Boolean(
    (agent.tags && agent.tags.length > 0) || (agent.oasfSkills && agent.oasfSkills.length > 0)
  );
  signals.push({
    dimension: "identity",
    name: "tags_or_skills",
    points: hasTagsOrSkills ? 5 : 0,
    maxPoints: 5,
    earned: hasTagsOrSkills,
    detail: hasTagsOrSkills
      ? `${agent.tags?.length ?? 0} tags, ${agent.oasfSkills?.length ?? 0} skills`
      : undefined,
  });

  // ── History ───────────────────────────────────────────────────────────────
  const ageDays = (Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  let agePoints = 0;
  if (ageDays >= 30) agePoints = 10;
  else if (ageDays >= 7) agePoints = 5;
  else if (ageDays >= 1) agePoints = 2;
  signals.push({
    dimension: "history",
    name: "agent_age",
    points: agePoints,
    maxPoints: 10,
    earned: agePoints > 0,
    detail: `${Math.floor(ageDays)} days`,
  });

  const updates = eventCount ?? 0;
  let updatesPoints = 0;
  if (updates >= 2) updatesPoints = 5;
  else if (updates >= 1) updatesPoints = 2;
  signals.push({
    dimension: "history",
    name: "metadata_updates",
    points: updatesPoints,
    maxPoints: 5,
    earned: updatesPoints > 0,
    detail: updates > 0 ? `${updates} updates` : undefined,
  });

  const crossChain = crossChainCount ?? 0;
  let crossChainPoints = 0;
  if (crossChain >= 3) crossChainPoints = 5;
  else if (crossChain >= 2) crossChainPoints = 3;
  signals.push({
    dimension: "history",
    name: "cross_chain_presence",
    points: crossChainPoints,
    maxPoints: 5,
    earned: crossChainPoints > 0,
    detail: crossChain > 0 ? `${crossChain} chains` : undefined,
  });

  // ── Capability ────────────────────────────────────────────────────────────
  const hasX402 = agent.x402Support === true;
  signals.push({
    dimension: "capability",
    name: "x402_payment",
    points: hasX402 ? 5 : 0,
    maxPoints: 5,
    earned: hasX402,
  });

  const skillCount = (agent.oasfSkills?.length ?? 0) + (agent.oasfDomains?.length ?? 0);
  let skillPoints = 0;
  if (skillCount >= 3) skillPoints = 5;
  else if (skillCount >= 1) skillPoints = 3;
  signals.push({
    dimension: "capability",
    name: "oasf_skills",
    points: skillPoints,
    maxPoints: 5,
    earned: skillPoints > 0,
    detail: skillCount > 0 ? `${skillCount} skills/domains` : undefined,
  });

  let endpointCount = 0;
  if (endpoints) {
    if (Array.isArray(endpoints)) endpointCount = endpoints.length;
    else if (typeof endpoints === "object") endpointCount = Object.keys(endpoints).length;
  }
  let endpointPoints = 0;
  if (endpointCount >= 3) endpointPoints = 5;
  else if (endpointCount >= 1) endpointPoints = 3;
  signals.push({
    dimension: "capability",
    name: "endpoint_count",
    points: endpointPoints,
    maxPoints: 5,
    earned: endpointPoints > 0,
    detail: endpointCount > 0 ? `${endpointCount} endpoints` : undefined,
  });

  // ── Community ─────────────────────────────────────────────────────────────
  if (feedback) {
    const ghScore = feedback.githubHealthScore ?? 0;
    let ghPoints = 0;
    if (ghScore >= 70) ghPoints = 10;
    else if (ghScore >= 40) ghPoints = 6;
    else if (ghScore > 0) ghPoints = 3;
    signals.push({
      dimension: "community",
      name: "github_health",
      points: ghPoints,
      maxPoints: 10,
      earned: ghPoints > 0,
      detail: ghScore > 0 ? `score ${ghScore}` : undefined,
    });

    const fcScore = feedback.farcasterScore ?? 0;
    let fcPoints = 0;
    if (fcScore >= 0.7) fcPoints = 5;
    else if (fcScore >= 0.4) fcPoints = 3;
    else if (fcScore > 0) fcPoints = 1;
    signals.push({
      dimension: "community",
      name: "farcaster_presence",
      points: fcPoints,
      maxPoints: 5,
      earned: fcPoints > 0,
      detail: fcScore > 0 ? `score ${fcScore}` : undefined,
    });

    const hasSources = feedback.totalSources > 0;
    signals.push({
      dimension: "community",
      name: "community_sources",
      points: hasSources ? 5 : 0,
      maxPoints: 5,
      earned: hasSources,
      detail: hasSources ? `${feedback.totalSources} sources` : undefined,
    });
  } else {
    signals.push({ dimension: "community", name: "github_health", points: 0, maxPoints: 10, earned: false });
    signals.push({ dimension: "community", name: "farcaster_presence", points: 0, maxPoints: 5, earned: false });
    signals.push({ dimension: "community", name: "community_sources", points: 0, maxPoints: 5, earned: false });
  }

  // ── Transparency ──────────────────────────────────────────────────────────
  const uri = agent.metadataUri ?? "";
  let storagePoints = 0;
  let storageDetail: string | undefined;
  if (uri.startsWith("ipfs://")) { storagePoints = 8; storageDetail = "ipfs"; }
  else if (uri.startsWith("ar://")) { storagePoints = 8; storageDetail = "arweave"; }
  else if (uri.startsWith("https://")) { storagePoints = 5; storageDetail = "https"; }
  else if (uri.startsWith("http://")) { storagePoints = 3; storageDetail = "http"; }
  else if (uri.startsWith("data:")) { storagePoints = 2; storageDetail = "data-uri"; }
  signals.push({
    dimension: "transparency",
    name: "metadata_storage",
    points: storagePoints,
    maxPoints: 8,
    earned: storagePoints > 0,
    detail: storageDetail,
  });

  let trustPoints = 0;
  let trustDetail: string | undefined;
  if (agent.supportedTrust && agent.supportedTrust.length > 0) {
    const trustCount = agent.supportedTrust.length;
    trustDetail = `${trustCount} protocols`;
    if (trustCount >= 3) trustPoints = 7;
    else if (trustCount >= 2) trustPoints = 5;
    else trustPoints = 3;
  }
  signals.push({
    dimension: "transparency",
    name: "trust_protocols",
    points: trustPoints,
    maxPoints: 7,
    earned: trustPoints > 0,
    detail: trustDetail,
  });

  const isActive = agent.activeStatus === true;
  signals.push({
    dimension: "transparency",
    name: "active_status",
    points: isActive ? 5 : 0,
    maxPoints: 5,
    earned: isActive,
  });

  // ── Tally dimension totals from signals ───────────────────────────────────
  const identity = signals.filter(s => s.dimension === "identity").reduce((a, s) => a + s.points, 0);
  const history = signals.filter(s => s.dimension === "history").reduce((a, s) => a + s.points, 0);
  const capability = signals.filter(s => s.dimension === "capability").reduce((a, s) => a + s.points, 0);
  const community = signals.filter(s => s.dimension === "community").reduce((a, s) => a + s.points, 0);
  const transparency = signals.filter(s => s.dimension === "transparency").reduce((a, s) => a + s.points, 0);
  const total = identity + history + capability + community + transparency;

  // ── Opportunities: unearned signals with maxPoints >= 3 ──────────────────
  const opportunities: TrustOpportunity[] = signals
    .filter(s => !s.earned && s.maxPoints >= 3)
    .map(s => ({
      signal: s.name,
      dimension: s.dimension,
      maxPoints: s.maxPoints,
      hint: getOpportunityHint(s.name),
    }));

  return { total, identity, history, capability, community, transparency, signals, opportunities };
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
    feedback = (await storage.getCommunityFeedbackSummary(agentId)) ?? null;
  } catch {}

  const breakdown = calculateTrustScore(agent, feedback, eventCount, crossChainCount);
  const signalHash = computeSignalHash(agent, feedback, eventCount, crossChainCount);
  const confidence = computeConfidence({
    hasIdentity: !!(agent.name && agent.name.trim().length > 0),
    hasProbes: agent.x402Support === true,
    hasTransactions: false, // Known gap: single-agent path doesn't prefetch tx counts
    hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
    hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
  });

  await db.update(agents).set({
    trustScore: breakdown.total,
    trustScoreBreakdown: breakdown,
    trustScoreUpdatedAt: new Date(),
    trustSignalHash: signalHash,
    trustMethodologyVersion: METHODOLOGY_VERSION,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
  }).where(eq(agents.id, agentId));

  return breakdown;
}

/** Pre-fetch all lookup maps needed for trust score calculation. */
async function prefetchScoreLookups() {
  const feedbackMap = new Map<string, CommunityFeedbackSummary>();
  try {
    const summaries = await db.select().from(
      (await import("../shared/schema.js")).communityFeedbackSummaries
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

  return { feedbackMap, controllerChains, eventCounts };
}

/** Batch-update trust scores for a set of agents in a single SQL statement. */
async function batchUpdateScores(updates: Array<{ id: string; score: number; breakdown: TrustScoreBreakdown; signalHash: string; confidenceScore: number; confidenceLevel: string }>) {
  if (updates.length === 0) return;
  const now = new Date();
  const ids = updates.map(u => u.id);
  const scores = updates.map(u => u.score);
  const breakdowns = updates.map(u => JSON.stringify(u.breakdown));
  const hashes = updates.map(u => u.signalHash);
  const confScores = updates.map(u => u.confidenceScore);
  const confLevels = updates.map(u => u.confidenceLevel);

  await db.execute(sql`
    UPDATE agents SET
      trust_score = batch.score,
      trust_score_breakdown = batch.breakdown::jsonb,
      trust_score_updated_at = ${now},
      trust_signal_hash = batch.hash,
      trust_methodology_version = ${METHODOLOGY_VERSION},
      confidence_score = batch.conf_score,
      confidence_level = batch.conf_level
    FROM (
      SELECT unnest(${ids}::text[]) AS id,
             unnest(${scores}::int[]) AS score,
             unnest(${breakdowns}::text[]) AS breakdown,
             unnest(${hashes}::text[]) AS hash,
             unnest(${confScores}::real[]) AS conf_score,
             unnest(${confLevels}::text[]) AS conf_level
    ) AS batch
    WHERE agents.id = batch.id
  `);
}

export async function recalculateAllScores(): Promise<{ updated: number; elapsed: number }> {
  const start = Date.now();
  log("Starting batch trust score recalculation...", "trust-score");

  const allAgents = await storage.getAllAgents();
  const { feedbackMap, controllerChains, eventCounts } = await prefetchScoreLookups();

  let updated = 0;
  const BATCH_SIZE = 500;

  for (let i = 0; i < allAgents.length; i += BATCH_SIZE) {
    const batch = allAgents.slice(i, i + BATCH_SIZE);
    const updates: Array<{ id: string; score: number; breakdown: TrustScoreBreakdown; signalHash: string; confidenceScore: number; confidenceLevel: string }> = [];

    for (const agent of batch) {
      const feedback = feedbackMap.get(agent.id) ?? null;
      const evtCount = eventCounts.get(agent.id) ?? 0;
      const crossChain = controllerChains.get(agent.controllerAddress) ?? 0;
      const breakdown = calculateTrustScore(agent, feedback, evtCount, crossChain);
      const signalHash = computeSignalHash(agent, feedback, evtCount, crossChain);
      const confidence = computeConfidence({
        hasIdentity: !!(agent.name && agent.name.trim().length > 0),
        hasProbes: agent.x402Support === true,
        hasTransactions: false, // Known gap: batch prefetch doesn't include per-agent tx counts
        hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
        hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
      });
      updates.push({ id: agent.id, score: breakdown.total, breakdown, signalHash, confidenceScore: confidence.score, confidenceLevel: confidence.level });
    }

    await batchUpdateScores(updates);

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
      const { feedbackMap, controllerChains, eventCounts } = await prefetchScoreLookups();
      let scored = 0;
      while (true) {
        const batch = await db.select().from(agents).where(isNull(agents.trustScore)).limit(500);
        if (batch.length === 0) break;

        const updates: Array<{ id: string; score: number; breakdown: TrustScoreBreakdown; signalHash: string; confidenceScore: number; confidenceLevel: string }> = [];
        for (const agent of batch) {
          const feedback = feedbackMap.get(agent.id) ?? null;
          const evtCount = eventCounts.get(agent.id) ?? 0;
          const crossChain = controllerChains.get(agent.controllerAddress) ?? 0;
          const breakdown = calculateTrustScore(agent, feedback, evtCount, crossChain);
          const signalHash = computeSignalHash(agent, feedback, evtCount, crossChain);
          const confidence = computeConfidence({
            hasIdentity: !!(agent.name && agent.name.trim().length > 0),
            hasProbes: agent.x402Support === true,
            hasTransactions: false, // Known gap: batch prefetch doesn't include per-agent tx counts
            hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
            hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
          });
          updates.push({ id: agent.id, score: breakdown.total, breakdown, signalHash, confidenceScore: confidence.score, confidenceLevel: confidence.level });
        }

        await batchUpdateScores(updates);
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
