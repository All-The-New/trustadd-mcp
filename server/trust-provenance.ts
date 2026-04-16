import { createHash } from "node:crypto";
import type { TrustScoreInput } from "./trust-score.js";
import { looksLikeImageUrl, VOLUME_THRESHOLDS_USD } from "./trust-score.js";

/** Bump this when the scoring methodology changes to invalidate cached hashes. */
export const METHODOLOGY_VERSION = 2;

/**
 * Canonical representation of all signals that feed into the trust score (v2).
 *
 * v2 adds behavioral fields (transactions, attestations, probes) to the v1
 * profile/longevity fields. Field names are intentionally kept short and
 * stable; they are sorted alphabetically at serialization time by
 * `deterministicStringify` so the SHA-256 hash is invariant to property
 * insertion order.
 *
 * `volumeUsdBucket` is an integer bucket (0..n) derived from
 * `VOLUME_THRESHOLDS_USD` so small USD-price drift does not churn the hash.
 */
interface CanonicalSignals {
  // Identity / profile
  hasName: boolean;
  descriptionLength: number;
  hasImage: boolean;
  hasEndpoints: boolean;
  hasTags: boolean;
  name: string;
  imageUrl: string;

  // Longevity
  ageDays: number;
  eventCount: number;
  crossChainCount: number;

  // Capability / profile
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

  // Arrays (sorted)
  tags: string[];
  skills: string[];

  // ── v2 behavioral fields ────────────────────────────────────────────────
  /** Bucketed per VOLUME_THRESHOLDS_USD (e.g. 0 if <100, 1 if <1000, 2 if ≥1000). */
  volumeUsdBucket: number;
  txCount: number;
  uniquePayers: number;
  hasLive402: boolean;
  paymentAddressVerified: boolean;
  attestationCount: number;
  uniqueAttestors: number;
  /** Unix timestamp (seconds) of firstTxAt, null if no tx. */
  firstTxAtEpoch: number | null;

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

/** Resolves the URI scheme from a metadata URI string. */
function resolveUriScheme(uri: string | null | undefined): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return "ipfs";
  if (uri.startsWith("ar://")) return "ar";
  if (uri.startsWith("https://")) return "https";
  if (uri.startsWith("http://")) return "http";
  if (uri.startsWith("data:")) return "data";
  return "other";
}

/** Counts endpoints from the agent's endpoints field (JSON blob). */
function countEndpoints(endpoints: unknown): number {
  if (!endpoints) return 0;
  if (Array.isArray(endpoints)) return endpoints.length;
  if (typeof endpoints === "object") return Object.keys(endpoints as Record<string, unknown>).length;
  return 0;
}

/** Map a USD volume to its bucket index in VOLUME_THRESHOLDS_USD. */
function volumeBucket(volumeUsd: number): number {
  let bucket = 0;
  // Thresholds are ascending entry points [0, 100, 1000]. The "entry" tier (0)
  // only counts when there IS any inbound volume; zero volume stays bucket -1.
  if (volumeUsd <= 0) return -1;
  for (let i = 0; i < VOLUME_THRESHOLDS_USD.length; i++) {
    if (volumeUsd >= VOLUME_THRESHOLDS_USD[i]) bucket = i;
    else break;
  }
  return bucket;
}

/**
 * Compute a deterministic SHA-256 hash of all v2 scoring inputs.
 *
 * The hash changes whenever any scoring input changes, providing an immutable
 * audit trail for score updates. Array fields are sorted before hashing so
 * that insertion order differences do not produce different hashes for
 * equivalent data.
 *
 * @param input Full TrustScoreInput (agent + txStats + attestationStats +
 *              probeStats + feedback + metadataEventCount + chainPresence).
 * @returns 64-character lowercase hex SHA-256 digest.
 */
export function computeSignalHash(input: TrustScoreInput): string {
  const {
    agent,
    txStats,
    attestationStats,
    probeStats,
    feedback,
    metadataEventCount,
    chainPresence,
  } = input;

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

  const sortedTags = [...(agent.tags ?? [])].sort();
  const sortedSkills = [
    ...(agent.oasfSkills ?? []),
    ...(agent.oasfDomains ?? []),
  ].sort();

  const signals: CanonicalSignals = {
    // Identity / profile
    hasName: Boolean(agent.name && agent.name.trim().length > 0),
    descriptionLength: agent.description?.trim().length ?? 0,
    hasImage: Boolean(agent.imageUrl && looksLikeImageUrl(agent.imageUrl)),
    hasEndpoints,
    hasTags: sortedTags.length > 0 || (agent.oasfSkills?.length ?? 0) > 0,
    name: agent.name?.trim() ?? "",
    imageUrl: agent.imageUrl ?? "",

    // Longevity
    ageDays: Math.floor(ageDays),
    eventCount: metadataEventCount,
    crossChainCount: chainPresence,

    // Capability / profile
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

    tags: sortedTags,
    skills: sortedSkills,

    // v2 behavioral
    volumeUsdBucket: volumeBucket(txStats.volumeUsd),
    txCount: txStats.txCount,
    uniquePayers: txStats.uniquePayers,
    hasLive402: probeStats.hasLive402,
    paymentAddressVerified: probeStats.paymentAddressVerified,
    attestationCount: attestationStats.received,
    uniqueAttestors: attestationStats.uniqueAttestors,
    firstTxAtEpoch: txStats.firstTxAt ? Math.floor(new Date(txStats.firstTxAt).getTime() / 1000) : null,

    methodologyVersion: METHODOLOGY_VERSION,
  };

  const serialized = deterministicStringify(signals);
  return createHash("sha256").update(serialized).digest("hex");
}
