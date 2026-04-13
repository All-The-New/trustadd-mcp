import { createHash } from "node:crypto";
import type { Agent, CommunityFeedbackSummary } from "../shared/schema.js";

/** Bump this when the scoring methodology changes to invalidate cached hashes. */
export const METHODOLOGY_VERSION = 1;

/**
 * Subset of Agent fields actually read by calculateTrustScore.
 * Using Pick ensures we only declare the fields we depend on.
 */
type AgentSignalFields = Pick<
  Agent,
  | "name"
  | "description"
  | "imageUrl"
  | "endpoints"
  | "tags"
  | "oasfSkills"
  | "oasfDomains"
  | "x402Support"
  | "metadataUri"
  | "supportedTrust"
  | "activeStatus"
  | "createdAt"
>;

/**
 * Canonical representation of all signals that feed into the trust score.
 * Field names are intentionally kept short/stable to avoid accidental hash
 * changes from refactoring. Keys are sorted alphabetically at serialization
 * time by JSON.stringify with a replacer that enforces key order.
 */
interface CanonicalSignals {
  // Identity
  hasName: boolean;
  descriptionLength: number;
  hasImage: boolean;
  hasEndpoints: boolean;
  hasTags: boolean;
  // Raw values used by scoring (captured for full auditability)
  name: string;
  imageUrl: string;
  // History
  ageDays: number;
  eventCount: number;
  crossChainCount: number;
  // Capability
  x402Support: boolean;
  skillCount: number;
  endpointCount: number;
  // Community (from feedback)
  githubHealthScore: number;
  farcasterScore: number;
  totalSources: number;
  // Transparency
  metadataUriScheme: string;
  trustProtocolCount: number;
  activeStatus: boolean;
  // Arrays (sorted for canonical ordering)
  tags: string[];
  skills: string[];
  // Versioning
  methodologyVersion: number;
}

/**
 * Serializes an object with deterministic (sorted) key order so that the
 * JSON output is identical regardless of property insertion order.
 */
function deterministicStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(deterministicStringify).join(",") + "]";
  if (typeof obj === "object") {
    const sorted = Object.keys(obj as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${deterministicStringify((obj as Record<string, unknown>)[k])}`);
    return "{" + sorted.join(",") + "}";
  }
  return JSON.stringify(obj);
}

/**
 * Resolves the URI scheme from a metadata URI string.
 * Returns an empty string if the URI is null/empty.
 */
function resolveUriScheme(uri: string | null | undefined): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return "ipfs";
  if (uri.startsWith("ar://")) return "ar";
  if (uri.startsWith("https://")) return "https";
  if (uri.startsWith("http://")) return "http";
  if (uri.startsWith("data:")) return "data";
  return "other";
}

/**
 * Counts endpoints from the agent's endpoints field (JSON blob).
 * Matches the logic in calculateTrustScore.
 */
function countEndpoints(endpoints: unknown): number {
  if (!endpoints) return 0;
  if (Array.isArray(endpoints)) return endpoints.length;
  if (typeof endpoints === "object") return Object.keys(endpoints as Record<string, unknown>).length;
  return 0;
}

/**
 * Compute a deterministic SHA-256 hash of all signals that feed into the
 * trust score. The hash changes whenever any scoring input changes, providing
 * an immutable audit trail for score updates.
 *
 * Array fields (tags, skills) are sorted before hashing so that insertion
 * order differences do not produce different hashes for equivalent data.
 *
 * @param agent    The agent record (only scoring-relevant fields are used)
 * @param feedback Optional community feedback summary
 * @param eventCount   Number of MetadataUpdated / AgentURISet events
 * @param crossChainCount Number of distinct chains for this controller address
 * @returns 64-character lowercase hex SHA-256 digest
 */
export function computeSignalHash(
  agent: AgentSignalFields,
  feedback: Pick<CommunityFeedbackSummary, "githubHealthScore" | "farcasterScore" | "totalSources"> | null | undefined,
  eventCount: number,
  crossChainCount: number,
): string {
  const endpoints = agent.endpoints;
  const hasEndpoints =
    endpoints !== null &&
    endpoints !== undefined &&
    (Array.isArray(endpoints)
      ? (endpoints as unknown[]).length > 0
      : Object.keys(endpoints as Record<string, unknown>).length > 0);

  const ageDays =
    (Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24);

  const skillCount =
    (agent.oasfSkills?.length ?? 0) + (agent.oasfDomains?.length ?? 0);

  // Sort arrays to ensure canonical ordering regardless of insertion order
  const sortedTags = [...(agent.tags ?? [])].sort();
  const sortedSkills = [
    ...(agent.oasfSkills ?? []),
    ...(agent.oasfDomains ?? []),
  ].sort();

  const signals: CanonicalSignals = {
    // Identity
    hasName: Boolean(agent.name && agent.name.trim().length > 0),
    descriptionLength: agent.description?.trim().length ?? 0,
    hasImage: Boolean(agent.imageUrl && agent.imageUrl.length > 0),
    hasEndpoints,
    hasTags: sortedTags.length > 0 || (agent.oasfSkills?.length ?? 0) > 0,
    // Raw values for full auditability
    name: agent.name?.trim() ?? "",
    imageUrl: agent.imageUrl ?? "",
    // History
    ageDays: Math.floor(ageDays),
    eventCount,
    crossChainCount,
    // Capability
    x402Support: agent.x402Support === true,
    skillCount,
    endpointCount: countEndpoints(endpoints),
    // Community
    githubHealthScore: feedback?.githubHealthScore ?? 0,
    farcasterScore: feedback?.farcasterScore ?? 0,
    totalSources: feedback?.totalSources ?? 0,
    // Transparency
    metadataUriScheme: resolveUriScheme(agent.metadataUri),
    trustProtocolCount: agent.supportedTrust?.length ?? 0,
    activeStatus: agent.activeStatus === true,
    // Arrays (sorted)
    tags: sortedTags,
    skills: sortedSkills,
    // Versioning
    methodologyVersion: METHODOLOGY_VERSION,
  };

  const serialized = deterministicStringify(signals);
  return createHash("sha256").update(serialized).digest("hex");
}
