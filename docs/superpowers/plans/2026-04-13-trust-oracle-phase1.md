# Trust Oracle Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TrustAdd's scoring system verifiable, explainable, and self-monitoring by implementing signal provenance hashing, score explainability, confidence levels, and pipeline health circuit breakers.

**Architecture:** Four independent capabilities layered onto the existing `trust-score.ts` → `trust-report-compiler.ts` → `routes.ts` pipeline. New pure functions are unit-tested with Vitest. Schema changes applied via Supabase MCP. All new data surfaces in both the API and the cached trust reports (REPORT_VERSION bumped to 2).

**Tech Stack:** TypeScript, Vitest (new), Node.js crypto (SHA-256), Supabase PostgreSQL (Drizzle ORM), Trigger.dev scheduled tasks, Express API routes.

**Principles doc:** `docs/principles/trust-oracle-design-principles.md` — every task maps to specific principles from this document.

---

## Task 1: Test Framework Setup

**Files:**
- Create: `vitest.config.ts`
- Create: `server/__tests__/trust-score.test.ts`
- Modify: `package.json` (add vitest dev dep + test script)

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/__tests__/**/*.test.ts", "shared/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create smoke test to verify setup**

Create `server/__tests__/trust-score.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateTrustScore } from "../trust-score";

describe("calculateTrustScore", () => {
  it("returns zero for empty agent", () => {
    const agent = {
      id: "test-1",
      erc8004Id: "1",
      primaryContractAddress: "0x0",
      controllerAddress: "0x0",
      chainId: 8453,
      claimed: false,
      firstSeenBlock: 0,
      lastUpdatedBlock: 0,
      name: null,
      description: null,
      capabilities: null,
      metadataUri: null,
      tags: null,
      oasfSkills: null,
      oasfDomains: null,
      endpoints: null,
      x402Support: null,
      supportedTrust: null,
      imageUrl: null,
      activeStatus: null,
      slug: null,
      trustScore: null,
      trustScoreBreakdown: null,
      trustScoreUpdatedAt: null,
      qualityTier: "unclassified",
      spamFlags: [],
      lifecycleStatus: "active",
      metadataFingerprint: null,
      nextEnrichmentAt: null,
      lastQualityEvaluatedAt: null,
      createdAt: new Date(),
    };
    const result = calculateTrustScore(agent);
    expect(result.total).toBe(0);
    expect(result.identity).toBe(0);
  });

  it("awards identity points for name and description", () => {
    const agent = {
      id: "test-2",
      erc8004Id: "2",
      primaryContractAddress: "0x1",
      controllerAddress: "0x1",
      chainId: 8453,
      claimed: false,
      firstSeenBlock: 0,
      lastUpdatedBlock: 0,
      name: "TestAgent",
      description: "A comprehensive test agent with a description that is over one hundred characters long for the full five points in the scoring rubric.",
      capabilities: null,
      metadataUri: null,
      tags: ["test"],
      oasfSkills: null,
      oasfDomains: null,
      endpoints: null,
      x402Support: null,
      supportedTrust: null,
      imageUrl: null,
      activeStatus: null,
      slug: null,
      trustScore: null,
      trustScoreBreakdown: null,
      trustScoreUpdatedAt: null,
      qualityTier: "unclassified",
      spamFlags: [],
      lifecycleStatus: "active",
      metadataFingerprint: null,
      nextEnrichmentAt: null,
      lastQualityEvaluatedAt: null,
      createdAt: new Date(),
    };
    const result = calculateTrustScore(agent);
    expect(result.identity).toBe(15); // name=5 + desc=5 + tags=5
  });
});
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
npx vitest run
```

Expected: 2 tests passing. Fix any import resolution issues with `.js` extensions — vitest should resolve `.ts` files directly.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts server/__tests__/ package.json package-lock.json
git commit -m "chore: add vitest test framework with trust-score smoke tests"
```

---

## Task 2: Schema Migration

**Files:**
- Modify: `shared/schema.ts` (add columns + new table)

All DDL runs via Supabase MCP (`apply_migration`). The `trustadd_app` user doesn't own tables, so drizzle-kit push won't work.

- [ ] **Step 1: Apply migration — add provenance columns to agents**

Use Supabase MCP `apply_migration` with project `agfyfdhvgekekliujoxc`:

```sql
-- Provenance tracking (Principle 3: Immutable Audit Trail, Principle 6: Data Provenance)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS trust_signal_hash text,
  ADD COLUMN IF NOT EXISTS trust_methodology_version integer DEFAULT 1;
```

- [ ] **Step 2: Apply migration — add confidence columns to agents**

```sql
-- Confidence levels (Principle 1: Epistemic Honesty, Principle 11: Multi-Source Verification)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS confidence_score real,
  ADD COLUMN IF NOT EXISTS confidence_level text DEFAULT 'unknown';
```

- [ ] **Step 3: Apply migration — create pipeline_health table**

```sql
-- Pipeline health tracking (Principle 4: Graceful Degradation, Principle 13: Circuit Breakers)
CREATE TABLE IF NOT EXISTS pipeline_health (
  task_id text PRIMARY KEY,
  task_name text NOT NULL,
  last_success_at timestamptz,
  last_run_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  circuit_state text NOT NULL DEFAULT 'closed',
  opened_at timestamptz,
  expected_interval_minutes integer NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grant access to app user
GRANT ALL ON pipeline_health TO trustadd_app;
```

- [ ] **Step 4: Update shared/schema.ts — add new columns to agents table**

Add after `lastQualityEvaluatedAt` in the agents table definition:

```ts
trustSignalHash: text("trust_signal_hash"),
trustMethodologyVersion: integer("trust_methodology_version").default(1),
confidenceScore: real("confidence_score"),
confidenceLevel: text("confidence_level").default("unknown"),
```

- [ ] **Step 5: Update shared/schema.ts — add pipeline_health table**

Add after the `alertDeliveries` table:

```ts
export const pipelineHealth = pgTable("pipeline_health", {
  taskId: text("task_id").primaryKey(),
  taskName: text("task_name").notNull(),
  lastSuccessAt: timestamp("last_success_at"),
  lastRunAt: timestamp("last_run_at"),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  circuitState: text("circuit_state").notNull().default("closed"),
  openedAt: timestamp("opened_at"),
  expectedIntervalMinutes: integer("expected_interval_minutes").notNull().default(60),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PipelineHealth = typeof pipelineHealth.$inferSelect;
```

- [ ] **Step 6: Commit**

```bash
git add shared/schema.ts
git commit -m "feat: schema additions for provenance, confidence, and pipeline health"
```

---

## Task 3: Signal Provenance Hashing

**Implements:** Principle 3 (Immutable Audit Trail), Principle 6 (Data Provenance)

**Files:**
- Create: `server/trust-provenance.ts`
- Create: `server/__tests__/trust-provenance.test.ts`
- Modify: `server/trust-score.ts` (add hash computation + storage)

- [ ] **Step 1: Write failing tests for computeSignalHash**

Create `server/__tests__/trust-provenance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeSignalHash, METHODOLOGY_VERSION } from "../trust-provenance";

const baseAgent = {
  name: "TestAgent",
  description: "A test agent",
  imageUrl: "https://example.com/img.png",
  endpoints: [{ url: "https://api.test.com" }],
  tags: ["b-tag", "a-tag"],
  oasfSkills: ["skill-b", "skill-a"],
  oasfDomains: ["domain-a"],
  x402Support: true,
  metadataUri: "ipfs://QmTest",
  supportedTrust: ["erc8004"],
  activeStatus: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  controllerAddress: "0xabc",
};

describe("computeSignalHash", () => {
  it("returns a 64-character hex SHA-256 hash", () => {
    const hash = computeSignalHash(baseAgent, null, 0, 0);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same inputs produce same hash", () => {
    const h1 = computeSignalHash(baseAgent, null, 5, 2);
    const h2 = computeSignalHash(baseAgent, null, 5, 2);
    expect(h1).toBe(h2);
  });

  it("sorts arrays for canonical ordering", () => {
    const agent1 = { ...baseAgent, tags: ["a-tag", "b-tag"] };
    const agent2 = { ...baseAgent, tags: ["b-tag", "a-tag"] };
    expect(computeSignalHash(agent1, null, 0, 0))
      .toBe(computeSignalHash(agent2, null, 0, 0));
  });

  it("changes when a signal changes", () => {
    const h1 = computeSignalHash(baseAgent, null, 0, 0);
    const changed = { ...baseAgent, name: "DifferentAgent" };
    const h2 = computeSignalHash(changed, null, 0, 0);
    expect(h1).not.toBe(h2);
  });

  it("includes feedback in hash when provided", () => {
    const noFeedback = computeSignalHash(baseAgent, null, 0, 0);
    const withFeedback = computeSignalHash(baseAgent, {
      githubHealthScore: 80,
      farcasterScore: 0.6,
      totalSources: 2,
    } as any, 0, 0);
    expect(noFeedback).not.toBe(withFeedback);
  });

  it("METHODOLOGY_VERSION is a positive integer", () => {
    expect(METHODOLOGY_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(METHODOLOGY_VERSION)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run server/__tests__/trust-provenance.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement computeSignalHash**

Create `server/trust-provenance.ts`:

```ts
import { createHash } from "node:crypto";
import type { Agent, CommunityFeedbackSummary } from "../shared/schema.js";

/**
 * Current scoring methodology version. Bump when the scoring formula changes.
 * Stored alongside scores so we know which algorithm produced which result.
 */
export const METHODOLOGY_VERSION = 1;

/**
 * Canonical input signal structure for hashing.
 * Every field that influences the trust score must appear here.
 */
interface CanonicalSignals {
  // Identity signals
  hasName: boolean;
  descriptionLength: number;
  hasImage: boolean;
  hasEndpoints: boolean;
  hasTags: boolean;
  // History signals
  ageDays: number;
  eventCount: number;
  crossChainCount: number;
  // Capability signals
  x402Support: boolean;
  skillCount: number;
  endpointCount: number;
  // Community signals
  githubHealthScore: number;
  farcasterScore: number;
  totalSources: number;
  // Transparency signals
  metadataUriScheme: string;
  trustProtocolCount: number;
  activeStatus: boolean;
  // Metadata for reproducibility
  methodologyVersion: number;
}

function getUriScheme(uri: string | null): string {
  if (!uri) return "none";
  if (uri.startsWith("ipfs://")) return "ipfs";
  if (uri.startsWith("ar://")) return "arweave";
  if (uri.startsWith("https://")) return "https";
  if (uri.startsWith("http://")) return "http";
  if (uri.startsWith("data:")) return "data";
  return "other";
}

function countEndpoints(endpoints: unknown): number {
  if (!endpoints) return 0;
  if (Array.isArray(endpoints)) return endpoints.length;
  if (typeof endpoints === "object") return Object.keys(endpoints as object).length;
  return 0;
}

/**
 * Compute a SHA-256 hash of the canonical input signals used for trust scoring.
 * This proves what data was available when a score was computed.
 *
 * The hash covers every field that influences calculateTrustScore().
 * If a field is added to the scoring formula, it must be added here too,
 * and METHODOLOGY_VERSION must be bumped.
 */
export function computeSignalHash(
  agent: Pick<Agent, "name" | "description" | "imageUrl" | "endpoints" | "tags" |
    "oasfSkills" | "oasfDomains" | "x402Support" | "metadataUri" |
    "supportedTrust" | "activeStatus" | "createdAt" | "controllerAddress">,
  feedback: Pick<CommunityFeedbackSummary, "githubHealthScore" | "farcasterScore" | "totalSources"> | null | undefined,
  eventCount: number,
  crossChainCount: number,
): string {
  const ageDays = Math.floor(
    (Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  const signals: CanonicalSignals = {
    hasName: !!(agent.name && agent.name.trim().length > 0),
    descriptionLength: agent.description?.trim().length ?? 0,
    hasImage: !!(agent.imageUrl && agent.imageUrl.length >= 5),
    hasEndpoints: countEndpoints(agent.endpoints) > 0,
    hasTags: !!((agent.tags && agent.tags.length > 0) || (agent.oasfSkills && agent.oasfSkills.length > 0)),
    ageDays,
    eventCount,
    crossChainCount,
    x402Support: agent.x402Support === true,
    skillCount: (agent.oasfSkills?.length ?? 0) + (agent.oasfDomains?.length ?? 0),
    endpointCount: countEndpoints(agent.endpoints),
    githubHealthScore: feedback?.githubHealthScore ?? 0,
    farcasterScore: feedback?.farcasterScore ?? 0,
    totalSources: feedback?.totalSources ?? 0,
    metadataUriScheme: getUriScheme(agent.metadataUri ?? null),
    trustProtocolCount: agent.supportedTrust?.length ?? 0,
    activeStatus: agent.activeStatus === true,
    methodologyVersion: METHODOLOGY_VERSION,
  };

  // Deterministic JSON serialization (keys sorted)
  const canonical = JSON.stringify(signals, Object.keys(signals).sort());
  return createHash("sha256").update(canonical).digest("hex");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run server/__tests__/trust-provenance.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 5: Integrate hash into batch scoring**

In `server/trust-score.ts`, add imports and modify `recalculateAllScores`:

After line 4, add:
```ts
import { computeSignalHash, METHODOLOGY_VERSION } from "./trust-provenance.js";
```

Change `batchUpdateScores` to also update hash and methodology version. Replace the existing `batchUpdateScores` function:

```ts
async function batchUpdateScores(updates: Array<{
  id: string;
  score: number;
  breakdown: TrustScoreBreakdown;
  signalHash: string;
}>) {
  if (updates.length === 0) return;
  const now = new Date();
  const ids = updates.map(u => u.id);
  const scores = updates.map(u => u.score);
  const breakdowns = updates.map(u => JSON.stringify(u.breakdown));
  const hashes = updates.map(u => u.signalHash);

  await db.execute(sql`
    UPDATE agents SET
      trust_score = batch.score,
      trust_score_breakdown = batch.breakdown::jsonb,
      trust_score_updated_at = ${now},
      trust_signal_hash = batch.hash,
      trust_methodology_version = ${METHODOLOGY_VERSION}
    FROM (
      SELECT unnest(${ids}::text[]) AS id,
             unnest(${scores}::int[]) AS score,
             unnest(${breakdowns}::text[]) AS breakdown,
             unnest(${hashes}::text[]) AS hash
    ) AS batch
    WHERE agents.id = batch.id
  `);
}
```

In the `recalculateAllScores` loop (and `ensureScoresCalculated` loop), add hash computation after the `calculateTrustScore` call:

```ts
const breakdown = calculateTrustScore(agent, feedback, evtCount, crossChain);
const signalHash = computeSignalHash(agent, feedback, evtCount, crossChain);
updates.push({ id: agent.id, score: breakdown.total, breakdown, signalHash });
```

Also update `recalculateScore` (single-agent):

```ts
const signalHash = computeSignalHash(agent, feedback, eventCount, crossChainCount);

await db.update(agents).set({
  trustScore: breakdown.total,
  trustScoreBreakdown: breakdown,
  trustScoreUpdatedAt: new Date(),
  trustSignalHash: signalHash,
  trustMethodologyVersion: METHODOLOGY_VERSION,
}).where(eq(agents.id, agentId));
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (existing trust-score tests + new provenance tests).

- [ ] **Step 7: Commit**

```bash
git add server/trust-provenance.ts server/__tests__/trust-provenance.test.ts server/trust-score.ts
git commit -m "feat: signal provenance hashing — SHA-256 of scoring inputs (Principle 3, 6)"
```

---

## Task 4: Score Explainability

**Implements:** Principle 1 (Epistemic Honesty), Principle 2 (Separate Facts from Judgments), Principle 7 (Open Methodology)

**Files:**
- Modify: `server/trust-score.ts` (extend return type)
- Create: `server/__tests__/trust-explainability.test.ts`

- [ ] **Step 1: Write failing tests for explainable scoring**

Create `server/__tests__/trust-explainability.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateTrustScore } from "../trust-score";

describe("calculateTrustScore explainability", () => {
  const emptyAgent = {
    id: "test-1",
    erc8004Id: "1",
    primaryContractAddress: "0x0",
    controllerAddress: "0x0",
    chainId: 8453,
    claimed: false,
    firstSeenBlock: 0,
    lastUpdatedBlock: 0,
    name: null,
    description: null,
    capabilities: null,
    metadataUri: null,
    tags: null,
    oasfSkills: null,
    oasfDomains: null,
    endpoints: null,
    x402Support: null,
    supportedTrust: null,
    imageUrl: null,
    activeStatus: null,
    slug: null,
    trustScore: null,
    trustScoreBreakdown: null,
    trustScoreUpdatedAt: null,
    qualityTier: "unclassified",
    spamFlags: [],
    lifecycleStatus: "active",
    metadataFingerprint: null,
    nextEnrichmentAt: null,
    lastQualityEvaluatedAt: null,
    createdAt: new Date(),
  };

  it("returns a signals array", () => {
    const result = calculateTrustScore(emptyAgent);
    expect(result.signals).toBeDefined();
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it("every signal has dimension, name, points, earned, and maxPoints", () => {
    const rich = {
      ...emptyAgent,
      name: "TestAgent",
      description: "A test agent with a long description over one hundred characters for full points in our trust rubric.",
      imageUrl: "https://example.com/logo.png",
      tags: ["ai"],
      metadataUri: "ipfs://QmTest",
      activeStatus: true,
    };
    const result = calculateTrustScore(rich);
    for (const signal of result.signals) {
      expect(signal).toHaveProperty("dimension");
      expect(signal).toHaveProperty("name");
      expect(signal).toHaveProperty("points");
      expect(signal).toHaveProperty("earned");
      expect(signal).toHaveProperty("maxPoints");
      expect(typeof signal.earned).toBe("boolean");
    }
  });

  it("signals sum matches dimension totals", () => {
    const result = calculateTrustScore(emptyAgent);
    const byDimension = new Map<string, number>();
    for (const s of result.signals) {
      byDimension.set(s.dimension, (byDimension.get(s.dimension) ?? 0) + s.points);
    }
    expect(byDimension.get("identity") ?? 0).toBe(result.identity);
    expect(byDimension.get("history") ?? 0).toBe(result.history);
    expect(byDimension.get("capability") ?? 0).toBe(result.capability);
    expect(byDimension.get("community") ?? 0).toBe(result.community);
    expect(byDimension.get("transparency") ?? 0).toBe(result.transparency);
  });

  it("returns opportunities array for unearned signals", () => {
    const result = calculateTrustScore(emptyAgent);
    expect(result.opportunities).toBeDefined();
    expect(result.opportunities.length).toBeGreaterThan(0);
    for (const opp of result.opportunities) {
      expect(opp).toHaveProperty("signal");
      expect(opp).toHaveProperty("maxPoints");
      expect(opp).toHaveProperty("hint");
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run server/__tests__/trust-explainability.test.ts
```

Expected: FAIL — `signals` property undefined.

- [ ] **Step 3: Extend TrustScoreBreakdown type and refactor calculateTrustScore**

In `server/trust-score.ts`, replace the `TrustScoreBreakdown` interface and `calculateTrustScore` function:

```ts
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
```

Then refactor `calculateTrustScore` to build signals:

```ts
export function calculateTrustScore(
  agent: Agent,
  feedback?: CommunityFeedbackSummary | null,
  eventCount?: number,
  crossChainCount?: number,
): TrustScoreBreakdown {
  const signals: TrustSignal[] = [];

  // --- Identity ---
  let identity = 0;

  const hasName = !!(agent.name && agent.name.trim().length > 0);
  const namePoints = hasName ? 5 : 0;
  identity += namePoints;
  signals.push({ dimension: "identity", name: "agent_name", points: namePoints, maxPoints: 5, earned: hasName, detail: hasName ? agent.name! : undefined });

  let descPoints = 0;
  const descLen = agent.description?.trim().length ?? 0;
  if (descLen >= 100) descPoints = 5;
  else if (descLen >= 30) descPoints = 3;
  else if (descLen > 0) descPoints = 1;
  identity += descPoints;
  signals.push({ dimension: "identity", name: "description_quality", points: descPoints, maxPoints: 5, earned: descPoints > 0, detail: descLen > 0 ? `${descLen} chars` : undefined });

  const hasImage = !!(agent.imageUrl && looksLikeImageUrl(agent.imageUrl));
  const imagePoints = hasImage ? 5 : 0;
  identity += imagePoints;
  signals.push({ dimension: "identity", name: "image_url", points: imagePoints, maxPoints: 5, earned: hasImage });

  const endpoints = agent.endpoints as any;
  const hasEndpoints = endpoints && (Array.isArray(endpoints) ? endpoints.length > 0 : Object.keys(endpoints).length > 0);
  const endpointPresencePoints = hasEndpoints ? 5 : 0;
  identity += endpointPresencePoints;
  signals.push({ dimension: "identity", name: "endpoints_declared", points: endpointPresencePoints, maxPoints: 5, earned: !!hasEndpoints });

  const hasTags = !!((agent.tags && agent.tags.length > 0) || (agent.oasfSkills && agent.oasfSkills.length > 0));
  const tagPoints = hasTags ? 5 : 0;
  identity += tagPoints;
  signals.push({ dimension: "identity", name: "tags_or_skills", points: tagPoints, maxPoints: 5, earned: hasTags });

  // --- History ---
  let history = 0;

  const ageDays = (Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  let agePoints = 0;
  if (ageDays >= 30) agePoints = 10;
  else if (ageDays >= 7) agePoints = 5;
  else if (ageDays >= 1) agePoints = 2;
  history += agePoints;
  signals.push({ dimension: "history", name: "agent_age", points: agePoints, maxPoints: 10, earned: agePoints > 0, detail: `${Math.floor(ageDays)} days` });

  const updates = eventCount ?? 0;
  let updatePoints = 0;
  if (updates >= 2) updatePoints = 5;
  else if (updates >= 1) updatePoints = 2;
  history += updatePoints;
  signals.push({ dimension: "history", name: "metadata_updates", points: updatePoints, maxPoints: 5, earned: updatePoints > 0, detail: `${updates} events` });

  const crossChain = crossChainCount ?? 0;
  let crossChainPoints = 0;
  if (crossChain >= 3) crossChainPoints = 5;
  else if (crossChain >= 2) crossChainPoints = 3;
  history += crossChainPoints;
  signals.push({ dimension: "history", name: "cross_chain_presence", points: crossChainPoints, maxPoints: 5, earned: crossChainPoints > 0, detail: `${crossChain} chains` });

  // --- Capability ---
  let capability = 0;

  const x402Points = agent.x402Support === true ? 5 : 0;
  capability += x402Points;
  signals.push({ dimension: "capability", name: "x402_payment", points: x402Points, maxPoints: 5, earned: agent.x402Support === true });

  const skillCount = (agent.oasfSkills?.length ?? 0) + (agent.oasfDomains?.length ?? 0);
  let skillPoints = 0;
  if (skillCount >= 3) skillPoints = 5;
  else if (skillCount >= 1) skillPoints = 3;
  capability += skillPoints;
  signals.push({ dimension: "capability", name: "oasf_skills", points: skillPoints, maxPoints: 5, earned: skillPoints > 0, detail: `${skillCount} skills` });

  let endpointCount = 0;
  if (endpoints) {
    if (Array.isArray(endpoints)) endpointCount = endpoints.length;
    else if (typeof endpoints === "object") endpointCount = Object.keys(endpoints).length;
  }
  let epCountPoints = 0;
  if (endpointCount >= 3) epCountPoints = 5;
  else if (endpointCount >= 1) epCountPoints = 3;
  capability += epCountPoints;
  signals.push({ dimension: "capability", name: "endpoint_count", points: epCountPoints, maxPoints: 5, earned: epCountPoints > 0, detail: `${endpointCount} endpoints` });

  // --- Community ---
  let community = 0;

  const ghScore = feedback?.githubHealthScore ?? 0;
  let ghPoints = 0;
  if (ghScore >= 70) ghPoints = 10;
  else if (ghScore >= 40) ghPoints = 6;
  else if (ghScore > 0) ghPoints = 3;
  community += ghPoints;
  signals.push({ dimension: "community", name: "github_health", points: ghPoints, maxPoints: 10, earned: ghPoints > 0, detail: ghScore > 0 ? `score ${ghScore}` : undefined });

  const fcScore = feedback?.farcasterScore ?? 0;
  let fcPoints = 0;
  if (fcScore >= 0.7) fcPoints = 5;
  else if (fcScore >= 0.4) fcPoints = 3;
  else if (fcScore > 0) fcPoints = 1;
  community += fcPoints;
  signals.push({ dimension: "community", name: "farcaster_presence", points: fcPoints, maxPoints: 5, earned: fcPoints > 0, detail: fcScore > 0 ? `score ${fcScore}` : undefined });

  const hasSources = (feedback?.totalSources ?? 0) > 0;
  const sourcePoints = hasSources ? 5 : 0;
  community += sourcePoints;
  signals.push({ dimension: "community", name: "community_sources", points: sourcePoints, maxPoints: 5, earned: hasSources, detail: hasSources ? `${feedback!.totalSources} sources` : undefined });

  // --- Transparency ---
  let transparency = 0;

  const uri = agent.metadataUri ?? "";
  let uriPoints = 0;
  let uriDetail: string | undefined;
  if (uri.startsWith("ipfs://") || uri.startsWith("ar://")) { uriPoints = 8; uriDetail = "immutable storage"; }
  else if (uri.startsWith("https://")) { uriPoints = 5; uriDetail = "HTTPS"; }
  else if (uri.startsWith("http://")) { uriPoints = 3; uriDetail = "HTTP (insecure)"; }
  else if (uri.startsWith("data:")) { uriPoints = 2; uriDetail = "inline data URI"; }
  transparency += uriPoints;
  signals.push({ dimension: "transparency", name: "metadata_storage", points: uriPoints, maxPoints: 8, earned: uriPoints > 0, detail: uriDetail });

  const trustCount = agent.supportedTrust?.length ?? 0;
  let trustProtocolPoints = 0;
  if (trustCount >= 3) trustProtocolPoints = 7;
  else if (trustCount >= 2) trustProtocolPoints = 5;
  else if (trustCount >= 1) trustProtocolPoints = 3;
  transparency += trustProtocolPoints;
  signals.push({ dimension: "transparency", name: "trust_protocols", points: trustProtocolPoints, maxPoints: 7, earned: trustProtocolPoints > 0, detail: trustCount > 0 ? `${trustCount} protocols` : undefined });

  const isActive = agent.activeStatus === true;
  const activePoints = isActive ? 5 : 0;
  transparency += activePoints;
  signals.push({ dimension: "transparency", name: "active_status", points: activePoints, maxPoints: 5, earned: isActive });

  // --- Totals ---
  const total = identity + history + capability + community + transparency;

  // --- Opportunities (unearned signals worth 3+ points) ---
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

function getOpportunityHint(signalName: string): string {
  const hints: Record<string, string> = {
    agent_name: "Set a descriptive agent name in your ERC-8004 metadata",
    description_quality: "Add a description of at least 100 characters explaining what your agent does",
    image_url: "Add a logo or avatar image URL to your agent metadata",
    endpoints_declared: "Declare at least one API endpoint in your agent metadata",
    tags_or_skills: "Add tags or OASF skill declarations to your metadata",
    agent_age: "Score improves automatically as your agent ages (30+ days for full points)",
    metadata_updates: "Update your metadata at least twice to show active maintenance",
    cross_chain_presence: "Register your agent on 2+ chains for cross-chain presence points",
    x402_payment: "Enable x402 payment headers on at least one endpoint",
    oasf_skills: "Declare 3+ OASF skills or domains in your metadata",
    endpoint_count: "Register 3+ API endpoints to demonstrate capability breadth",
    github_health: "Link a GitHub repository with active commits and community engagement",
    farcaster_presence: "Build a Farcaster presence with a score of 0.4+ for social verification",
    community_sources: "Get listed on at least one community platform (GitHub, Farcaster)",
    metadata_storage: "Store metadata on IPFS or Arweave for immutability (8 points vs 5 for HTTPS)",
    trust_protocols: "Declare support for 2+ trust protocols (ERC-8004, OASF, MCP, etc.)",
    active_status: "Set activeStatus to true in your agent metadata",
  };
  return hints[signalName] ?? "Improve this signal to increase your trust score";
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run
```

Expected: All tests pass. The old `TrustScoreBreakdown` type is backward-compatible (still has `total`, `identity`, etc.), but now includes `signals` and `opportunities`.

- [ ] **Step 5: Verify JSONB serialization compatibility**

The `trustScoreBreakdown` column stores JSONB. The new `signals` and `opportunities` arrays will be included. Verify the existing `batchUpdateScores` SQL handles the larger payload — it already does `JSON.stringify(u.breakdown)` which will include the new fields.

No code change needed, but verify by reading a breakdown from the DB after next recalculation.

- [ ] **Step 6: Commit**

```bash
git add server/trust-score.ts server/__tests__/trust-explainability.test.ts
git commit -m "feat: score explainability — signals array with earned/missed detail + opportunities (Principle 1, 2, 7)"
```

---

## Task 5: Methodology Endpoint

**Implements:** Principle 7 (Open Methodology, Proprietary Data)

**Files:**
- Create: `server/trust-methodology.ts`
- Modify: `server/routes.ts` (add endpoint)

- [ ] **Step 1: Create methodology definition**

Create `server/trust-methodology.ts`:

```ts
import { METHODOLOGY_VERSION } from "./trust-provenance.js";

export interface MethodologyDimension {
  name: string;
  maxPoints: number;
  signals: Array<{
    name: string;
    maxPoints: number;
    description: string;
    thresholds: Array<{ condition: string; points: number }>;
  }>;
}

export interface Methodology {
  version: number;
  lastUpdated: string;
  maxScore: number;
  verdictThresholds: {
    trusted: string;
    caution: string;
    untrusted: string;
    unknown: string;
  };
  dimensions: MethodologyDimension[];
  changelog: Array<{ version: number; date: string; summary: string }>;
  disclaimer: string;
}

export function getMethodology(): Methodology {
  return {
    version: METHODOLOGY_VERSION,
    lastUpdated: "2026-04-13",
    maxScore: 100,
    verdictThresholds: {
      trusted: "score >= 60 AND tier in (high, medium) AND no spam flags",
      caution: "All agents not meeting trusted or untrusted criteria",
      untrusted: "score < 30 OR tier in (spam, archived) OR status = archived",
      unknown: "Score has not yet been calculated",
    },
    dimensions: [
      {
        name: "identity",
        maxPoints: 25,
        signals: [
          { name: "agent_name", maxPoints: 5, description: "Agent has a non-empty name", thresholds: [{ condition: "name present and non-empty", points: 5 }] },
          { name: "description_quality", maxPoints: 5, description: "Quality of agent description", thresholds: [{ condition: ">= 100 chars", points: 5 }, { condition: ">= 30 chars", points: 3 }, { condition: "> 0 chars", points: 1 }] },
          { name: "image_url", maxPoints: 5, description: "Valid image URL present", thresholds: [{ condition: "valid image URL detected", points: 5 }] },
          { name: "endpoints_declared", maxPoints: 5, description: "At least one API endpoint declared", thresholds: [{ condition: ">= 1 endpoint", points: 5 }] },
          { name: "tags_or_skills", maxPoints: 5, description: "Tags or OASF skills present", thresholds: [{ condition: "tags or skills array non-empty", points: 5 }] },
        ],
      },
      {
        name: "history",
        maxPoints: 20,
        signals: [
          { name: "agent_age", maxPoints: 10, description: "Age since first on-chain registration", thresholds: [{ condition: ">= 30 days", points: 10 }, { condition: ">= 7 days", points: 5 }, { condition: ">= 1 day", points: 2 }] },
          { name: "metadata_updates", maxPoints: 5, description: "Number of MetadataUpdated/AgentURISet events", thresholds: [{ condition: ">= 2 events", points: 5 }, { condition: ">= 1 event", points: 2 }] },
          { name: "cross_chain_presence", maxPoints: 5, description: "Presence on multiple EVM chains", thresholds: [{ condition: ">= 3 chains", points: 5 }, { condition: ">= 2 chains", points: 3 }] },
        ],
      },
      {
        name: "capability",
        maxPoints: 15,
        signals: [
          { name: "x402_payment", maxPoints: 5, description: "x402 payment support verified via endpoint probing", thresholds: [{ condition: "x402 support confirmed", points: 5 }] },
          { name: "oasf_skills", maxPoints: 5, description: "OASF skill and domain declarations", thresholds: [{ condition: ">= 3 skills/domains", points: 5 }, { condition: ">= 1 skill/domain", points: 3 }] },
          { name: "endpoint_count", maxPoints: 5, description: "Number of API endpoints", thresholds: [{ condition: ">= 3 endpoints", points: 5 }, { condition: ">= 1 endpoint", points: 3 }] },
        ],
      },
      {
        name: "community",
        maxPoints: 20,
        signals: [
          { name: "github_health", maxPoints: 10, description: "GitHub repository health score", thresholds: [{ condition: "health >= 70", points: 10 }, { condition: "health >= 40", points: 6 }, { condition: "health > 0", points: 3 }] },
          { name: "farcaster_presence", maxPoints: 5, description: "Farcaster social score", thresholds: [{ condition: "score >= 0.7", points: 5 }, { condition: "score >= 0.4", points: 3 }, { condition: "score > 0", points: 1 }] },
          { name: "community_sources", maxPoints: 5, description: "Number of active community feedback sources", thresholds: [{ condition: ">= 1 source", points: 5 }] },
        ],
      },
      {
        name: "transparency",
        maxPoints: 20,
        signals: [
          { name: "metadata_storage", maxPoints: 8, description: "Metadata URI storage type", thresholds: [{ condition: "IPFS or Arweave", points: 8 }, { condition: "HTTPS", points: 5 }, { condition: "HTTP", points: 3 }, { condition: "data: URI", points: 2 }] },
          { name: "trust_protocols", maxPoints: 7, description: "Supported trust protocols declared", thresholds: [{ condition: ">= 3 protocols", points: 7 }, { condition: ">= 2 protocols", points: 5 }, { condition: ">= 1 protocol", points: 3 }] },
          { name: "active_status", maxPoints: 5, description: "Agent reports active status", thresholds: [{ condition: "activeStatus is true", points: 5 }] },
        ],
      },
    ],
    changelog: [
      { version: 1, date: "2026-04-13", summary: "Initial methodology with 5 dimensions, 16 signals, provenance hashing, and confidence levels" },
    ],
    disclaimer: "TrustAdd scores reflect available evidence as of the assessment timestamp. They are not guarantees of safety. Verify independently for high-value decisions.",
  };
}
```

- [ ] **Step 2: Add route in server/routes.ts**

Add the methodology endpoint in the public routes section (after the existing trust API routes). Find an appropriate location and add:

```ts
import { getMethodology } from "./trust-methodology.js";

// Public: Trust methodology (Principle 7 — Open Methodology)
app.get("/api/v1/trust/methodology", (_req, res) => {
  res.json(getMethodology());
});
```

- [ ] **Step 3: Test locally**

```bash
curl http://localhost:5000/api/v1/trust/methodology | jq '.version, .dimensions | length'
```

Expected: `1` and `5`.

- [ ] **Step 4: Commit**

```bash
git add server/trust-methodology.ts server/routes.ts
git commit -m "feat: public methodology endpoint — GET /api/v1/trust/methodology (Principle 7)"
```

---

## Task 6: Confidence Levels

**Implements:** Principle 1 (Epistemic Honesty), Principle 11 (Multi-Source Verification)

**Files:**
- Create: `server/trust-confidence.ts`
- Create: `server/__tests__/trust-confidence.test.ts`
- Modify: `server/trust-score.ts` (integrate confidence into batch scoring)

- [ ] **Step 1: Write failing tests for computeConfidence**

Create `server/__tests__/trust-confidence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeConfidence, type ConfidenceResult } from "../trust-confidence";

describe("computeConfidence", () => {
  it("returns minimal confidence with no data sources", () => {
    const result = computeConfidence({
      hasIdentity: false,
      hasProbes: false,
      hasTransactions: false,
      hasGithub: false,
      hasFarcaster: false,
    });
    expect(result.level).toBe("minimal");
    expect(result.score).toBeLessThan(0.3);
    expect(result.sourcesActive).toBe(0);
    expect(result.sourcesTotal).toBe(5);
  });

  it("returns high confidence when all sources are active", () => {
    const result = computeConfidence({
      hasIdentity: true,
      hasProbes: true,
      hasTransactions: true,
      hasGithub: true,
      hasFarcaster: true,
    });
    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.sourcesActive).toBe(5);
  });

  it("returns medium with 3 sources", () => {
    const result = computeConfidence({
      hasIdentity: true,
      hasProbes: true,
      hasTransactions: true,
      hasGithub: false,
      hasFarcaster: false,
    });
    expect(result.level).toBe("medium");
    expect(result.sourcesActive).toBe(3);
  });

  it("lists missing sources", () => {
    const result = computeConfidence({
      hasIdentity: true,
      hasProbes: false,
      hasTransactions: true,
      hasGithub: false,
      hasFarcaster: true,
    });
    expect(result.missing).toContain("x402_probes");
    expect(result.missing).toContain("github");
    expect(result.missing).not.toContain("identity");
  });

  it("includes consistency flags when provided", () => {
    const result = computeConfidence({
      hasIdentity: true,
      hasProbes: true,
      hasTransactions: false,
      hasGithub: false,
      hasFarcaster: false,
    }, {
      x402ActiveButNoTransactions: true,
    });
    expect(result.flags).toContain("x402_claimed_no_transactions");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run server/__tests__/trust-confidence.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement computeConfidence**

Create `server/trust-confidence.ts`:

```ts
export interface ConfidenceInput {
  hasIdentity: boolean;     // ERC-8004 registration exists
  hasProbes: boolean;       // x402 endpoint probes exist
  hasTransactions: boolean; // Payment transactions recorded
  hasGithub: boolean;       // GitHub feedback available
  hasFarcaster: boolean;    // Farcaster feedback available
}

export interface ConsistencyFlags {
  x402ActiveButNoTransactions?: boolean;  // Claims x402 but zero txs
  endpointsDeclaredButAllFail?: boolean;  // Endpoints listed but probes fail
}

export interface ConfidenceResult {
  level: "high" | "medium" | "low" | "minimal";
  score: number;         // 0.0 to 1.0
  sourcesActive: number;
  sourcesTotal: number;
  missing: string[];
  flags: string[];
}

/**
 * Source weights — reflect how much each data source contributes
 * to our confidence in the trust assessment.
 */
const SOURCE_WEIGHTS: Array<{ key: keyof ConfidenceInput; label: string; weight: number }> = [
  { key: "hasIdentity",     label: "identity",     weight: 0.30 },
  { key: "hasTransactions",  label: "transactions", weight: 0.20 },
  { key: "hasGithub",       label: "github",       weight: 0.20 },
  { key: "hasProbes",       label: "x402_probes",  weight: 0.15 },
  { key: "hasFarcaster",    label: "farcaster",    weight: 0.15 },
];

/**
 * Compute confidence level based on which data sources have recent data
 * for a given agent. Confidence reflects how much evidence backs the score,
 * not how high the score is.
 *
 * Principle 1: "Every trust assessment must communicate what was checked,
 * what wasn't checked, and how confident we are."
 */
export function computeConfidence(
  input: ConfidenceInput,
  consistency?: ConsistencyFlags,
): ConfidenceResult {
  let weightedScore = 0;
  let sourcesActive = 0;
  const missing: string[] = [];

  for (const { key, label, weight } of SOURCE_WEIGHTS) {
    if (input[key]) {
      weightedScore += weight;
      sourcesActive++;
    } else {
      missing.push(label);
    }
  }

  // Consistency flags reduce confidence
  const flags: string[] = [];
  if (consistency?.x402ActiveButNoTransactions) {
    flags.push("x402_claimed_no_transactions");
    weightedScore = Math.max(0, weightedScore - 0.05);
  }
  if (consistency?.endpointsDeclaredButAllFail) {
    flags.push("endpoints_unreachable");
    weightedScore = Math.max(0, weightedScore - 0.05);
  }

  const score = Math.round(weightedScore * 100) / 100;

  let level: ConfidenceResult["level"];
  if (score >= 0.7) level = "high";
  else if (score >= 0.45) level = "medium";
  else if (score >= 0.2) level = "low";
  else level = "minimal";

  return {
    level,
    score,
    sourcesActive,
    sourcesTotal: SOURCE_WEIGHTS.length,
    missing,
    flags,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run server/__tests__/trust-confidence.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Integrate confidence into batch scoring**

In `server/trust-score.ts`, add imports:

```ts
import { computeConfidence, type ConfidenceResult } from "./trust-confidence.js";
```

Update `batchUpdateScores` to also persist confidence:

```ts
async function batchUpdateScores(updates: Array<{
  id: string;
  score: number;
  breakdown: TrustScoreBreakdown;
  signalHash: string;
  confidenceScore: number;
  confidenceLevel: string;
}>) {
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
```

In the `recalculateAllScores` and `ensureScoresCalculated` loops, add confidence computation after hash computation. The confidence inputs require checking if feedback/probes/transactions exist, which we can derive from the prefetched data:

```ts
const breakdown = calculateTrustScore(agent, feedback, evtCount, crossChain);
const signalHash = computeSignalHash(agent, feedback, evtCount, crossChain);

const confidence = computeConfidence({
  hasIdentity: !!(agent.name && agent.name.trim().length > 0),
  hasProbes: agent.x402Support === true,
  hasTransactions: false, // Known gap: batch prefetch doesn't include per-agent tx counts (expensive for 106k agents). Trust reports compute this correctly per-agent via compileFullReport. Acceptable tradeoff for Phase 1.
  hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
  hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
});

updates.push({
  id: agent.id,
  score: breakdown.total,
  breakdown,
  signalHash,
  confidenceScore: confidence.score,
  confidenceLevel: confidence.level,
});
```

Also update `recalculateScore` (single-agent) similarly.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/trust-confidence.ts server/__tests__/trust-confidence.test.ts server/trust-score.ts
git commit -m "feat: confidence levels — source coverage scoring (Principle 1, 11)"
```

---

## Task 7: Pipeline Health Tracking

**Implements:** Principle 4 (Graceful Degradation), Principle 13 (Circuit Breakers)

**Files:**
- Create: `server/pipeline-health.ts`
- Modify: `trigger/recalculate.ts` (report health)
- Modify: `trigger/watchdog.ts` (report health)
- Modify: `trigger/blockchain-indexer.ts` (report health)
- Modify: `trigger/x402-prober.ts` (report health)
- Modify: `trigger/community-feedback.ts` (report health)

- [ ] **Step 1: Create pipeline health module**

Create `server/pipeline-health.ts`:

```ts
import type { PipelineHealth } from "../shared/schema.js";

/**
 * Staleness SLA definitions — how long each source can go without
 * refreshing before we consider its data stale.
 */
export const STALENESS_SLAS: Record<string, { warningMinutes: number; criticalMinutes: number }> = {
  "blockchain-indexer":   { warningMinutes: 15,   criticalMinutes: 30 },
  "recalculate-scores":  { warningMinutes: 1560,  criticalMinutes: 1800 },  // 26h warn, 30h critical
  "x402-prober":         { warningMinutes: 1500,  criticalMinutes: 2160 },  // 25h warn, 36h critical
  "community-feedback":  { warningMinutes: 1800,  criticalMinutes: 2880 },  // 30h warn, 48h critical
  "transaction-indexer": { warningMinutes: 480,   criticalMinutes: 780 },   // 8h warn, 13h critical
  "watchdog":            { warningMinutes: 30,    criticalMinutes: 60 },
  "bazaar-indexer":      { warningMinutes: 1560,  criticalMinutes: 1800 },
};

/**
 * Record a successful task run. Resets consecutive failures and closes circuit.
 */
export async function recordSuccess(taskId: string, taskName: string): Promise<void> {
  // Dynamic import to avoid top-level DB dependency (Trigger.dev container compatibility)
  const { db } = await import("./db.js");
  const { pipelineHealth } = await import("../shared/schema.js");
  const { sql } = await import("drizzle-orm");

  const now = new Date();
  const expectedInterval = STALENESS_SLAS[taskId]?.warningMinutes ?? 60;

  await db.execute(sql`
    INSERT INTO pipeline_health (task_id, task_name, last_success_at, last_run_at, consecutive_failures, circuit_state, expected_interval_minutes, updated_at)
    VALUES (${taskId}, ${taskName}, ${now}, ${now}, 0, 'closed', ${expectedInterval}, ${now})
    ON CONFLICT (task_id) DO UPDATE SET
      last_success_at = ${now},
      last_run_at = ${now},
      last_error = NULL,
      consecutive_failures = 0,
      circuit_state = 'closed',
      opened_at = NULL,
      updated_at = ${now}
  `);
}

/**
 * Record a task failure. Increments consecutive failures and opens circuit after 3.
 */
export async function recordFailure(taskId: string, taskName: string, error: string): Promise<void> {
  const { db } = await import("./db.js");
  const { sql } = await import("drizzle-orm");

  const now = new Date();
  const expectedInterval = STALENESS_SLAS[taskId]?.warningMinutes ?? 60;
  const CIRCUIT_OPEN_THRESHOLD = 3;

  await db.execute(sql`
    INSERT INTO pipeline_health (task_id, task_name, last_run_at, last_error, consecutive_failures, circuit_state, expected_interval_minutes, updated_at)
    VALUES (${taskId}, ${taskName}, ${now}, ${error}, 1, 'closed', ${expectedInterval}, ${now})
    ON CONFLICT (task_id) DO UPDATE SET
      last_run_at = ${now},
      last_error = ${error},
      consecutive_failures = pipeline_health.consecutive_failures + 1,
      circuit_state = CASE
        WHEN pipeline_health.consecutive_failures + 1 >= ${CIRCUIT_OPEN_THRESHOLD} THEN 'open'
        ELSE pipeline_health.circuit_state
      END,
      opened_at = CASE
        WHEN pipeline_health.consecutive_failures + 1 >= ${CIRCUIT_OPEN_THRESHOLD}
          AND pipeline_health.circuit_state = 'closed' THEN ${now}
        ELSE pipeline_health.opened_at
      END,
      updated_at = ${now}
  `);
}

/**
 * Get all pipeline health statuses. Used by watchdog and status API.
 */
export async function getAllPipelineHealth(): Promise<PipelineHealth[]> {
  const { db } = await import("./db.js");
  const { pipelineHealth } = await import("../shared/schema.js");
  return await db.select().from(pipelineHealth);
}

/**
 * Check if any circuit is open.
 */
export async function hasOpenCircuit(): Promise<boolean> {
  const { db } = await import("./db.js");
  const { sql } = await import("drizzle-orm");
  const result = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM pipeline_health WHERE circuit_state = 'open'
  `);
  return Number((result as any).rows?.[0]?.cnt ?? 0) > 0;
}
```

- [ ] **Step 2: Instrument recalculate task**

In `trigger/recalculate.ts`, add health reporting. After the existing `try` block's success path (before `return { success: true, classified }`):

```ts
try {
  const { recordSuccess } = await import("../server/pipeline-health");
  await recordSuccess("recalculate-scores", "Trust Score Recalculation");
} catch {}
```

In the `catch` block (before `return { error: error.message }`):

```ts
try {
  const { recordFailure } = await import("../server/pipeline-health");
  await recordFailure("recalculate-scores", "Trust Score Recalculation", error.message);
} catch {}
```

- [ ] **Step 3: Instrument watchdog task**

Same pattern in `trigger/watchdog.ts` — add `recordSuccess`/`recordFailure` calls.

- [ ] **Step 4: Instrument blockchain-indexer task**

In `trigger/blockchain-indexer.ts`, add health reporting at task completion (success path) and error handler. Use `recordSuccess("blockchain-indexer", "Blockchain Indexer")` and `recordFailure(...)`.

- [ ] **Step 5: Instrument x402-prober task**

Same pattern in `trigger/x402-prober.ts`.

- [ ] **Step 6: Instrument community-feedback task**

Same pattern in `trigger/community-feedback.ts`.

- [ ] **Step 7: Commit**

```bash
git add server/pipeline-health.ts trigger/recalculate.ts trigger/watchdog.ts trigger/blockchain-indexer.ts trigger/x402-prober.ts trigger/community-feedback.ts
git commit -m "feat: pipeline health tracking — record success/failure for all Trigger tasks (Principle 4, 13)"
```

---

## Task 8: Circuit Breaker Alerts & API Integration

**Implements:** Principle 4 (Graceful Degradation), Principle 13 (Circuit Breakers)

**Files:**
- Modify: `server/alerts.ts` (add pipeline health alerts)
- Modify: `server/trust-report-compiler.ts` (add provenance, confidence, freshness warnings)
- Modify: `server/routes.ts` (add pipeline health to status endpoint)

- [ ] **Step 1: Add pipeline health checks to evaluateAlerts**

In `server/alerts.ts`, add after the transaction indexer staleness check (before `return alerts;`):

```ts
// Pipeline health circuit breaker checks
try {
  const { getAllPipelineHealth, STALENESS_SLAS } = await import("./pipeline-health.js");
  const healthStatuses = await getAllPipelineHealth();
  for (const h of healthStatuses) {
    if (h.circuitState === "open") {
      alerts.push({
        id: `circuit_open_${h.taskId}`,
        severity: "critical",
        chainId: null,
        title: "Circuit Breaker Open",
        message: `${h.taskName} has failed ${h.consecutiveFailures} consecutive times. Last error: ${(h.lastError ?? "unknown").slice(0, 200)}`,
        firstSeen: h.openedAt ?? now,
        lastSeen: now,
      });
    } else if (h.lastSuccessAt) {
      const sla = STALENESS_SLAS[h.taskId];
      if (sla) {
        const ageMinutes = (now.getTime() - h.lastSuccessAt.getTime()) / (60 * 1000);
        if (ageMinutes > sla.criticalMinutes) {
          alerts.push({
            id: `stale_critical_${h.taskId}`,
            severity: "critical",
            chainId: null,
            title: `${h.taskName} Critically Stale`,
            message: `Last successful run was ${Math.round(ageMinutes / 60)}h ago (SLA: ${Math.round(sla.criticalMinutes / 60)}h)`,
            firstSeen: h.lastSuccessAt,
            lastSeen: now,
          });
        } else if (ageMinutes > sla.warningMinutes) {
          alerts.push({
            id: `stale_warning_${h.taskId}`,
            severity: "warning",
            chainId: null,
            title: `${h.taskName} Stale`,
            message: `Last successful run was ${Math.round(ageMinutes / 60)}h ago (SLA: ${Math.round(sla.warningMinutes / 60)}h)`,
            firstSeen: h.lastSuccessAt,
            lastSeen: now,
          });
        }
      }
    }
  }
} catch {
  // pipeline_health table may not exist yet — non-blocking
}
```

- [ ] **Step 2: Update FullReportData to include new fields**

In `server/trust-report-compiler.ts`, extend the `FullReportData` interface. Add to the `trust` block:

```ts
signalHash: string | null;
methodologyVersion: number;
confidence: {
  level: string;
  score: number;
  sourcesActive: number;
  sourcesTotal: number;
  missing: string[];
  flags: string[];
};
```

Add a new `provenance` block to `FullReportData`:

```ts
provenance: {
  signalHash: string | null;
  methodologyVersion: number;
  scoredAt: string | null;
  disclaimer: string;
};
```

- [ ] **Step 3: Update compileFullReport to populate new fields**

In the `compileFullReport` function, add confidence and provenance data. Import `computeConfidence`:

```ts
import { computeConfidence } from "./trust-confidence.js";
```

Add to the function parameters: `probeCount: number` and `txCount: number` (pass from `compileAndCacheReport`).

In the return object, add the new fields after `meta`:

```ts
trust: {
  ...existingTrustFields,
  signalHash: agent.trustSignalHash ?? null,
  methodologyVersion: agent.trustMethodologyVersion ?? 1,
  confidence: computeConfidence({
    hasIdentity: !!(agent.name && agent.name.trim().length > 0),
    hasProbes: probes.length > 0,
    hasTransactions: txStats.count > 0,
    hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
    hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
  }, {
    x402ActiveButNoTransactions: agent.x402Support === true && txStats.count === 0,
    endpointsDeclaredButAllFail: hasEndpoints && probes.length > 0 && probes.every(p => p.probeStatus !== "success"),
  }),
},
provenance: {
  signalHash: agent.trustSignalHash ?? null,
  methodologyVersion: agent.trustMethodologyVersion ?? 1,
  scoredAt: agent.trustScoreUpdatedAt?.toISOString() ?? null,
  disclaimer: "TrustAdd scores reflect available evidence as of the assessment timestamp. They are not guarantees of safety. Verify independently for high-value decisions.",
},
```

- [ ] **Step 4: Bump REPORT_VERSION**

In `server/trust-report-compiler.ts`, change:

```ts
const REPORT_VERSION = 2;
```

- [ ] **Step 5: Add pipeline health to public status API**

In `server/routes.ts`, find the existing status/health endpoint and add pipeline health data. Import and use:

```ts
import { getAllPipelineHealth } from "./pipeline-health.js";
```

Add a new endpoint or extend the existing one:

```ts
app.get("/api/v1/trust/pipeline-health", async (_req, res) => {
  try {
    const health = await getAllPipelineHealth();
    const hasOpen = health.some(h => h.circuitState === "open");
    res.json({
      status: hasOpen ? "degraded" : "healthy",
      pipelines: health.map(h => ({
        taskId: h.taskId,
        name: h.taskName,
        lastSuccessAt: h.lastSuccessAt?.toISOString() ?? null,
        consecutiveFailures: h.consecutiveFailures,
        circuitState: h.circuitState,
      })),
    });
  } catch (err) {
    res.json({ status: "unknown", pipelines: [] });
  }
});
```

- [ ] **Step 6: Test endpoints locally**

```bash
npm run dev &
sleep 3
curl http://localhost:5000/api/v1/trust/methodology | jq '.version'
curl http://localhost:5000/api/v1/trust/pipeline-health | jq '.status'
```

Expected: `2` and `"unknown"` (no health data yet until tasks run).

- [ ] **Step 7: Commit**

```bash
git add server/alerts.ts server/trust-report-compiler.ts server/routes.ts
git commit -m "feat: circuit breakers, report v2 with provenance + confidence (Principle 4, 13)"
```

---

## Task 9: Save Principles Document & Future Phases Documentation

**Files:**
- Create: `docs/principles/trust-oracle-design-principles.md`
- Create: `docs/principles/future-phases.md`

- [ ] **Step 1: Save the Trust Oracle Principles document**

Copy the principles document from `~/Desktop/trustadd-trust-oracle-principles-v2.md` to `docs/principles/trust-oracle-design-principles.md` (the canonical location referenced in the document itself).

- [ ] **Step 2: Create future phases documentation**

Create `docs/principles/future-phases.md`:

```markdown
# Trust Oracle — Future Implementation Phases

## Phase 2: Anti-Gaming & Sybil Resistance (Principle 5)

**Status:** Planned  
**Estimated effort:** 3-5 days  
**Dependencies:** Phase 1 complete

### What to build:
1. **Controller clustering detection** — SQL query grouping agents by `controller_address`, flag controllers with >10 agents as potential Sybil operators. Apply score dampening multiplier (0-50% reduction).
2. **Self-referential payment detection** — Join on `agent_transactions` where from/to addresses form cycles between controlled wallets.
3. **Temporal burst detection** — Flag agents where >50% of total transaction volume arrived in last 24 hours (pump-before-recalculation pattern).
4. **Metadata fingerprint clustering** — Detect agents sharing identical `metadata_fingerprint` values across different controllers.

### Schema additions needed:
- `sybil_signals jsonb` column on agents table
- `sybil_risk_score real` column on agents table

### Integration point:
Add a `detectSybilSignals()` function called during `recalculateAllScores()`.

---

## Phase 3: On-Chain Score Anchoring (Principles 3, 14)

**Status:** Planned  
**Estimated effort:** 3-5 days  
**Dependencies:** Phase 1 complete, funded oracle wallet on Base

### What to build:
1. **Merkle root publishing** — After each daily `recalculate` task, generate a `StandardMerkleTree` from all scored agents (leaves: `[address, chainId, score, methodologyVersion, timestamp]`). Publish root to a `TrustRoot.sol` contract on Base.
2. **Proof storage** — Store each agent's Merkle proof in a `trust_proofs` table.
3. **Proof in API response** — Include Merkle proof in Full Report `provenance` block.

### Libraries:
- `@openzeppelin/merkle-tree` (JS tree generation)
- `viem` (already in project — contract interaction)
- OpenZeppelin `MerkleTree.sol` (on-chain verification, ~20 lines)

### Cost: ~$0.01/day on Base (22k gas per root publication).

### Infrastructure:
- Deploy `TrustRoot.sol` on Base mainnet
- Fund oracle wallet with ~0.01 ETH on Base (lasts months)
- Store `ORACLE_PRIVATE_KEY` in Trigger.dev env vars

---

## Phase 4: ERC-8004 / EAS Attestations (Principle 14)

**Status:** Planned  
**Estimated effort:** 3-5 days  
**Dependencies:** Phase 3 complete (shares oracle wallet)

### What to build:
1. **EAS attestation task** — New Trigger.dev task (`erc8004-attester`) that runs post-recalculate. For high-quality agents, submit attestations to Ethereum Attestation Service on Base.
2. **ERC-8004 Reputation Registry writes** — Use `giveFeedback()` on the deployed Reputation Registry at `0x8004B663056A597Dffe9eCcC1965A193B7388713`.

### Approach:
- Start with EAS (lower friction, no self-feedback restriction)
- Add ERC-8004 Reputation Registry writes as step two
- Attest weekly rather than daily to limit gas spend

### Libraries:
- `@ethereum-attestation-service/eas-sdk`
- ERC-8004 contract ABI from `erc-8004/erc-8004-contracts` GitHub

---

*Last updated: 2026-04-13*
```

- [ ] **Step 3: Commit**

```bash
git add docs/principles/
git commit -m "docs: trust oracle principles + future phases roadmap"
```

---

## Verification

After all tasks are complete:

1. **Run test suite:** `npx vitest run` — all tests pass
2. **Local dev server:** `npm run dev` — verify no startup errors
3. **Methodology endpoint:** `curl localhost:5000/api/v1/trust/methodology` — returns version 1 with 5 dimensions
4. **Pipeline health endpoint:** `curl localhost:5000/api/v1/trust/pipeline-health` — returns status
5. **Deploy to Vercel:** `npx vercel deploy --prod` — verify endpoints work in production
6. **Deploy Trigger.dev tasks:** Push to main branch to trigger GitHub Actions deploy, verify pipeline health records appear after first task cycle
7. **Verify report v2:** Call the trust API for a known agent and confirm the response includes `provenance`, `confidence`, `trust.signalHash`, and `trust.methodologyVersion` fields
