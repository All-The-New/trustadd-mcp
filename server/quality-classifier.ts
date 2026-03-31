import crypto from "crypto";
import type { Agent } from "../shared/schema";

export type QualityTier = "high" | "medium" | "low" | "spam" | "archived" | "unclassified";
export type LifecycleStatus = "active" | "dormant" | "archived";

export interface ClassificationResult {
  qualityTier: QualityTier;
  spamFlags: string[];
  lifecycleStatus: LifecycleStatus;
  metadataFingerprint: string | null;
  nextEnrichmentAt: Date;
}

const TEST_NAMES = new Set(["test", "ai-only test", "testing", "test agent", "demo", "demo agent"]);
const SPEC_URI_PATTERNS = [
  "eips.ethereum.org",
  "eips.ethereum.org/EIPS/eip-8004",
];
const CODE_URI_PATTERNS = ["const ", "require(", "async function", "ethers.", "new ethers.", "function mint"];

export function computeFingerprint(metadataUri: string | null | undefined): string | null {
  if (!metadataUri || metadataUri.trim() === "") return null;
  return crypto.createHash("sha256").update(metadataUri.trim()).digest("hex").slice(0, 16);
}

export function classifyAgent(
  agent: Pick<Agent, "name" | "description" | "metadataUri" | "trustScore" | "createdAt">,
  duplicateFingerprints?: Set<string>
): ClassificationResult {
  const spamFlags: string[] = [];
  const name = agent.name?.trim() ?? null;
  const description = agent.description?.trim() ?? null;
  const uri = agent.metadataUri?.trim() ?? null;
  const trust = agent.trustScore ?? 0;

  const isNamed = name !== null && name !== "" && name !== "unnamed" && !/^\s+$/.test(name);
  const hasDescription = description !== null && description !== "";

  if (!isNamed) {
    spamFlags.push("whitespace_name");
  }

  if (!uri || uri === "") {
    spamFlags.push("blank_uri");
  } else {
    if (SPEC_URI_PATTERNS.some((p) => uri.includes(p))) {
      spamFlags.push("spec_uri");
    }
    if (CODE_URI_PATTERNS.some((p) => uri.includes(p))) {
      spamFlags.push("code_as_uri");
    }
  }

  if (isNamed && name && TEST_NAMES.has(name.toLowerCase())) {
    spamFlags.push("test_agent");
  }
  if (description && (description.toLowerCase().includes("please do not disturb") || description.toLowerCase().includes("only test"))) {
    spamFlags.push("test_agent");
  }

  const fingerprint = computeFingerprint(uri);
  if (fingerprint && duplicateFingerprints && duplicateFingerprints.has(fingerprint)) {
    spamFlags.push("duplicate_template");
  }

  const uniqueFlags = Array.from(new Set(spamFlags));

  let qualityTier: QualityTier;
  const isSpam = uniqueFlags.some((f) =>
    ["whitespace_name", "spec_uri", "code_as_uri", "test_agent", "blank_uri"].includes(f)
  ) || (trust === 0 && !isNamed && !hasDescription);

  if (isSpam) {
    qualityTier = "spam";
  } else if (trust >= 30) {
    qualityTier = "high";
  } else if (trust >= 15 && isNamed && hasDescription) {
    qualityTier = "medium";
  } else {
    qualityTier = "low";
  }

  const ageMs = Date.now() - new Date(agent.createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  let lifecycleStatus: LifecycleStatus;
  if (qualityTier === "spam" && ageDays > 60) {
    lifecycleStatus = "archived";
    qualityTier = "archived";
  } else if (qualityTier === "low" && ageDays > 30) {
    lifecycleStatus = "dormant";
  } else {
    lifecycleStatus = "active";
  }

  const now = Date.now();
  let nextEnrichmentMs: number;
  switch (qualityTier) {
    case "high":
      nextEnrichmentMs = 6 * 60 * 60 * 1000;
      break;
    case "medium":
      nextEnrichmentMs = 24 * 60 * 60 * 1000;
      break;
    case "low":
      nextEnrichmentMs = 7 * 24 * 60 * 60 * 1000;
      break;
    case "spam":
    case "archived":
    default:
      nextEnrichmentMs = 30 * 24 * 60 * 60 * 1000;
      break;
  }

  return {
    qualityTier,
    spamFlags: uniqueFlags,
    lifecycleStatus,
    metadataFingerprint: fingerprint,
    nextEnrichmentAt: new Date(now + nextEnrichmentMs),
  };
}
