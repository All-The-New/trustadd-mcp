# Trust Oracle Phase 2: Sybil Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect Sybil operators (controllers running large agent farms) and dampen their trust scores, making the scoring system resistant to gaming via mass-registration.

**Architecture:** A new `server/sybil-detection.ts` module computes per-agent Sybil signals (controller clustering, metadata fingerprint duplication, self-referential payments, temporal bursts) and returns a dampening multiplier. The existing `recalculateAllScores()` pipeline in `server/trust-score.ts` calls this module during batch scoring and applies the multiplier to the raw score before writing to DB. Two new columns on `agents` (`sybil_signals`, `sybil_risk_score`) store the results. A new API endpoint exposes Sybil data in trust reports.

**Tech Stack:** PostgreSQL (Drizzle ORM), Vitest, TypeScript

**Data context (from production DB):**
- 102k agents, 463 controllers with >10 agents (top: 6,322 agents)
- 4,119 metadata fingerprint clusters (shared fingerprints across controllers)
- 26 agents with transactions (self-referential detection has limited data today)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `server/sybil-detection.ts` (CREATE) | Pure functions: `detectSybilSignals()`, `computeSybilRiskScore()`, `computeDampeningMultiplier()` |
| `shared/schema.ts` (MODIFY) | Add `sybilSignals` and `sybilRiskScore` columns to `agents` table |
| `server/trust-score.ts` (MODIFY) | Call sybil detection during `recalculateAllScores()`, apply dampening |
| `server/trust-report-compiler.ts` (MODIFY) | Include sybil signals in full report data |
| `__tests__/sybil-detection.test.ts` (CREATE) | Unit tests for all sybil detection functions |
| `__tests__/fixtures/agents.ts` (MODIFY) | Add sybil-related agent fixtures |

---

### Task 1: Schema Migration — Add Sybil Columns

**Files:**
- Modify: `shared/schema.ts:7-50` (agents table definition)

- [ ] **Step 1: Add sybil columns to agents table in schema.ts**

In `shared/schema.ts`, add two columns to the `agents` pgTable definition, after the `confidenceLevel` column (line 41):

```ts
  sybilSignals: jsonb("sybil_signals"),
  sybilRiskScore: real("sybil_risk_score"),
```

- [ ] **Step 2: Run the schema migration via Supabase SQL**

Run this SQL via the Supabase MCP `apply_migration` tool:

```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS sybil_signals jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS sybil_risk_score real;
CREATE INDEX IF NOT EXISTS idx_agents_sybil_risk ON agents (sybil_risk_score) WHERE sybil_risk_score IS NOT NULL;
```

Migration name: `add_sybil_columns`

- [ ] **Step 3: Verify migration applied**

Run via Supabase MCP `execute_sql`:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'agents' AND column_name IN ('sybil_signals', 'sybil_risk_score');
```

Expected: 2 rows returned.

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(schema): add sybil_signals and sybil_risk_score columns to agents"
```

---

### Task 2: Sybil Signal Type Definitions and Fixtures

**Files:**
- Create: `server/sybil-detection.ts` (types only initially)
- Modify: `__tests__/fixtures/agents.ts`

- [ ] **Step 1: Create sybil-detection.ts with type definitions**

Create `server/sybil-detection.ts`:

```ts
/**
 * Sybil Detection Module
 *
 * Detects Sybil operators via four signal types:
 * 1. Controller clustering — controllers with >10 agents
 * 2. Metadata fingerprint duplication — agents sharing fingerprints across controllers
 * 3. Self-referential payments — tx cycles between controlled wallets
 * 4. Temporal burst — >50% of tx volume in last 24h
 */

export interface SybilSignal {
  type: "controller_cluster" | "fingerprint_duplicate" | "self_referential_payment" | "temporal_burst";
  severity: "low" | "medium" | "high";
  detail: string;
  /** Numeric value driving severity (e.g. agent count, duplicate count) */
  value: number;
}

export interface SybilAnalysis {
  signals: SybilSignal[];
  riskScore: number;       // 0–1 (0 = no risk, 1 = certain Sybil)
  dampeningMultiplier: number; // 0.5–1.0 (applied to raw trust score)
}

/** Lookup maps pre-fetched for batch sybil detection. */
export interface SybilLookups {
  /** controller_address → count of agents they control */
  controllerAgentCounts: Map<string, number>;
  /** metadata_fingerprint → set of distinct controller_addresses sharing it */
  fingerprintControllers: Map<string, Set<string>>;
  /** agent_id → { selfReferentialCount, totalTxCount, recentTxRatio } */
  transactionPatterns: Map<string, { selfRefCount: number; totalCount: number; recentRatio: number }>;
}
```

- [ ] **Step 2: Add sybil agent fixtures**

In `__tests__/fixtures/agents.ts`, add these fixtures after `BOUNDARY_UNTRUSTED`:

```ts
/** Agent from a large Sybil farm (controller has 500+ agents). */
export const SYBIL_FARM_AGENT = baseAgent({
  id: "sybil-farm-1",
  controllerAddress: "0xsybilcontroller000000000000000000000000001",
  name: "FarmAgent #347",
  description: "Automated agent from a large farm",
  metadataFingerprint: "fp_duplicate_cluster_1",
  trustScore: 45,
  qualityTier: "low",
  spamFlags: [],
  lifecycleStatus: "active",
});

/** Agent from a small multi-agent controller (15 agents — borderline). */
export const SMALL_CLUSTER_AGENT = baseAgent({
  id: "small-cluster-1",
  controllerAddress: "0xsmallcluster0000000000000000000000000001",
  name: "ClusterBot",
  description: "Agent from a small but legitimate multi-agent operator with decent metadata quality.",
  metadataFingerprint: "fp_unique_1",
  trustScore: 52,
  qualityTier: "medium",
  spamFlags: [],
  lifecycleStatus: "active",
});

/** Legitimate single-agent controller — should not be flagged. */
export const SOLO_CONTROLLER_AGENT = baseAgent({
  id: "solo-controller-1",
  controllerAddress: "0xsolocontroller00000000000000000000000001",
  name: "IndependentBot",
  description: "A well-maintained agent by an independent operator with unique metadata and strong community presence.",
  metadataFingerprint: "fp_unique_solo",
  trustScore: 70,
  qualityTier: "high",
  spamFlags: [],
  lifecycleStatus: "active",
});
```

- [ ] **Step 3: Commit**

```bash
git add server/sybil-detection.ts __tests__/fixtures/agents.ts
git commit -m "feat(sybil): add type definitions and test fixtures"
```

---

### Task 3: Controller Clustering Detection (TDD)

**Files:**
- Test: `__tests__/sybil-detection.test.ts`
- Modify: `server/sybil-detection.ts`

- [ ] **Step 1: Write failing tests for controller clustering**

Create `__tests__/sybil-detection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  detectControllerCluster,
  computeSybilRiskScore,
  computeDampeningMultiplier,
} from "../server/sybil-detection.js";

describe("detectControllerCluster", () => {
  it("returns no signal for controller with <= 10 agents", () => {
    const signal = detectControllerCluster(10);
    expect(signal).toBeNull();
  });

  it("returns low severity for controller with 11-50 agents", () => {
    const signal = detectControllerCluster(25);
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe("controller_cluster");
    expect(signal!.severity).toBe("low");
    expect(signal!.value).toBe(25);
  });

  it("returns medium severity for controller with 51-500 agents", () => {
    const signal = detectControllerCluster(200);
    expect(signal).not.toBeNull();
    expect(signal!.severity).toBe("medium");
  });

  it("returns high severity for controller with >500 agents", () => {
    const signal = detectControllerCluster(6322);
    expect(signal).not.toBeNull();
    expect(signal!.severity).toBe("high");
    expect(signal!.value).toBe(6322);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/sybil-detection.test.ts`
Expected: FAIL — `detectControllerCluster` not exported.

- [ ] **Step 3: Implement detectControllerCluster**

Add to `server/sybil-detection.ts`:

```ts
/**
 * Detect controller clustering signal.
 * Threshold: >10 agents per controller.
 * Severity: low (11-50), medium (51-500), high (>500).
 */
export function detectControllerCluster(agentCount: number): SybilSignal | null {
  if (agentCount <= 10) return null;

  let severity: SybilSignal["severity"];
  if (agentCount > 500) severity = "high";
  else if (agentCount > 50) severity = "medium";
  else severity = "low";

  return {
    type: "controller_cluster",
    severity,
    detail: `Controller operates ${agentCount} agents`,
    value: agentCount,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/sybil-detection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add __tests__/sybil-detection.test.ts server/sybil-detection.ts
git commit -m "feat(sybil): controller clustering detection with tests"
```

---

### Task 4: Metadata Fingerprint Duplication Detection (TDD)

**Files:**
- Modify: `__tests__/sybil-detection.test.ts`
- Modify: `server/sybil-detection.ts`

- [ ] **Step 1: Write failing tests for fingerprint duplication**

Add to `__tests__/sybil-detection.test.ts`:

```ts
import { detectFingerprintDuplicate } from "../server/sybil-detection.js";

describe("detectFingerprintDuplicate", () => {
  it("returns null when fingerprint is null", () => {
    const signal = detectFingerprintDuplicate(null, new Map());
    expect(signal).toBeNull();
  });

  it("returns null when fingerprint is unique to one controller", () => {
    const map = new Map([["fp_abc", new Set(["0xcontroller1"])]]);
    const signal = detectFingerprintDuplicate("fp_abc", map);
    expect(signal).toBeNull();
  });

  it("returns low severity when 2-5 controllers share a fingerprint", () => {
    const map = new Map([["fp_abc", new Set(["0xc1", "0xc2", "0xc3"])]]);
    const signal = detectFingerprintDuplicate("fp_abc", map);
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe("fingerprint_duplicate");
    expect(signal!.severity).toBe("low");
    expect(signal!.value).toBe(3);
  });

  it("returns medium severity when 6-20 controllers share a fingerprint", () => {
    const controllers = new Set(Array.from({ length: 15 }, (_, i) => `0xc${i}`));
    const map = new Map([["fp_dup", controllers]]);
    const signal = detectFingerprintDuplicate("fp_dup", map);
    expect(signal!.severity).toBe("medium");
  });

  it("returns high severity when >20 controllers share a fingerprint", () => {
    const controllers = new Set(Array.from({ length: 50 }, (_, i) => `0xc${i}`));
    const map = new Map([["fp_mass", controllers]]);
    const signal = detectFingerprintDuplicate("fp_mass", map);
    expect(signal!.severity).toBe("high");
    expect(signal!.value).toBe(50);
  });

  it("returns null for fingerprint not in the map", () => {
    const map = new Map([["fp_other", new Set(["0xc1", "0xc2"])]]);
    const signal = detectFingerprintDuplicate("fp_missing", map);
    expect(signal).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/sybil-detection.test.ts`
Expected: FAIL — `detectFingerprintDuplicate` not exported.

- [ ] **Step 3: Implement detectFingerprintDuplicate**

Add to `server/sybil-detection.ts`:

```ts
/**
 * Detect metadata fingerprint duplication across different controllers.
 * Multiple controllers sharing the same fingerprint suggests template farms.
 * Threshold: >1 controller sharing the same fingerprint.
 */
export function detectFingerprintDuplicate(
  fingerprint: string | null,
  fingerprintControllers: Map<string, Set<string>>,
): SybilSignal | null {
  if (!fingerprint) return null;

  const controllers = fingerprintControllers.get(fingerprint);
  if (!controllers || controllers.size <= 1) return null;

  const count = controllers.size;
  let severity: SybilSignal["severity"];
  if (count > 20) severity = "high";
  else if (count > 5) severity = "medium";
  else severity = "low";

  return {
    type: "fingerprint_duplicate",
    severity,
    detail: `Metadata fingerprint shared by ${count} different controllers`,
    value: count,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/sybil-detection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add __tests__/sybil-detection.test.ts server/sybil-detection.ts
git commit -m "feat(sybil): metadata fingerprint duplication detection"
```

---

### Task 5: Self-Referential Payment & Temporal Burst Detection (TDD)

**Files:**
- Modify: `__tests__/sybil-detection.test.ts`
- Modify: `server/sybil-detection.ts`

- [ ] **Step 1: Write failing tests for self-referential payments**

Add to `__tests__/sybil-detection.test.ts`:

```ts
import { detectSelfReferentialPayment, detectTemporalBurst } from "../server/sybil-detection.js";

describe("detectSelfReferentialPayment", () => {
  it("returns null when agent has no transaction patterns", () => {
    const patterns = new Map();
    const signal = detectSelfReferentialPayment("agent-1", patterns);
    expect(signal).toBeNull();
  });

  it("returns null when no self-referential transactions exist", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 0, totalCount: 10, recentRatio: 0.1 }]]);
    const signal = detectSelfReferentialPayment("agent-1", patterns);
    expect(signal).toBeNull();
  });

  it("returns medium severity when self-referential ratio is 10-50%", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 3, totalCount: 10, recentRatio: 0.1 }]]);
    const signal = detectSelfReferentialPayment("agent-1", patterns);
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe("self_referential_payment");
    expect(signal!.severity).toBe("medium");
  });

  it("returns high severity when self-referential ratio exceeds 50%", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 8, totalCount: 10, recentRatio: 0.1 }]]);
    const signal = detectSelfReferentialPayment("agent-1", patterns);
    expect(signal!.severity).toBe("high");
  });
});

describe("detectTemporalBurst", () => {
  it("returns null when agent has no transaction patterns", () => {
    const patterns = new Map();
    const signal = detectTemporalBurst("agent-1", patterns);
    expect(signal).toBeNull();
  });

  it("returns null when recent ratio is below 50%", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 0, totalCount: 20, recentRatio: 0.3 }]]);
    const signal = detectTemporalBurst("agent-1", patterns);
    expect(signal).toBeNull();
  });

  it("returns medium severity when recent ratio is 50-80%", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 0, totalCount: 20, recentRatio: 0.6 }]]);
    const signal = detectTemporalBurst("agent-1", patterns);
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe("temporal_burst");
    expect(signal!.severity).toBe("medium");
  });

  it("returns high severity when recent ratio exceeds 80%", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 0, totalCount: 20, recentRatio: 0.9 }]]);
    const signal = detectTemporalBurst("agent-1", patterns);
    expect(signal!.severity).toBe("high");
  });

  it("returns null when total tx count is < 5 (insufficient data)", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 0, totalCount: 3, recentRatio: 1.0 }]]);
    const signal = detectTemporalBurst("agent-1", patterns);
    expect(signal).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/sybil-detection.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement both detectors**

Add to `server/sybil-detection.ts`:

```ts
/**
 * Detect self-referential payment patterns.
 * Flags agents where from/to addresses form cycles between controlled wallets.
 * Requires at least 1 self-referential tx to trigger.
 */
export function detectSelfReferentialPayment(
  agentId: string,
  transactionPatterns: Map<string, { selfRefCount: number; totalCount: number; recentRatio: number }>,
): SybilSignal | null {
  const pattern = transactionPatterns.get(agentId);
  if (!pattern || pattern.selfRefCount === 0) return null;

  const ratio = pattern.selfRefCount / pattern.totalCount;
  let severity: SybilSignal["severity"];
  if (ratio > 0.5) severity = "high";
  else if (ratio >= 0.1) severity = "medium";
  else severity = "low";

  return {
    type: "self_referential_payment",
    severity,
    detail: `${pattern.selfRefCount}/${pattern.totalCount} transactions (${Math.round(ratio * 100)}%) are between controlled wallets`,
    value: pattern.selfRefCount,
  };
}

/**
 * Detect temporal burst patterns.
 * Flags agents where >50% of total tx volume arrived recently (pump-before-recalculation).
 * Requires at least 5 total transactions to be meaningful.
 */
export function detectTemporalBurst(
  agentId: string,
  transactionPatterns: Map<string, { selfRefCount: number; totalCount: number; recentRatio: number }>,
): SybilSignal | null {
  const pattern = transactionPatterns.get(agentId);
  if (!pattern || pattern.totalCount < 5) return null;
  if (pattern.recentRatio < 0.5) return null;

  let severity: SybilSignal["severity"];
  if (pattern.recentRatio > 0.8) severity = "high";
  else severity = "medium";

  return {
    type: "temporal_burst",
    severity,
    detail: `${Math.round(pattern.recentRatio * 100)}% of transaction volume arrived in the last 24 hours`,
    value: Math.round(pattern.recentRatio * 100),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/sybil-detection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add __tests__/sybil-detection.test.ts server/sybil-detection.ts
git commit -m "feat(sybil): self-referential payment and temporal burst detection"
```

---

### Task 6: Risk Score and Dampening Multiplier (TDD)

**Files:**
- Modify: `__tests__/sybil-detection.test.ts`
- Modify: `server/sybil-detection.ts`

- [ ] **Step 1: Write failing tests for risk score and dampening**

Add to `__tests__/sybil-detection.test.ts`:

```ts
import type { SybilSignal } from "../server/sybil-detection.js";

describe("computeSybilRiskScore", () => {
  it("returns 0 for no signals", () => {
    expect(computeSybilRiskScore([])).toBe(0);
  });

  it("returns low risk for single low-severity signal", () => {
    const signals: SybilSignal[] = [
      { type: "controller_cluster", severity: "low", detail: "15 agents", value: 15 },
    ];
    const score = computeSybilRiskScore(signals);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(0.3);
  });

  it("returns high risk for multiple high-severity signals", () => {
    const signals: SybilSignal[] = [
      { type: "controller_cluster", severity: "high", detail: "6000 agents", value: 6000 },
      { type: "fingerprint_duplicate", severity: "high", detail: "50 controllers", value: 50 },
    ];
    const score = computeSybilRiskScore(signals);
    expect(score).toBeGreaterThanOrEqual(0.7);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("clamps to 1.0 maximum", () => {
    const signals: SybilSignal[] = [
      { type: "controller_cluster", severity: "high", detail: "", value: 6000 },
      { type: "fingerprint_duplicate", severity: "high", detail: "", value: 50 },
      { type: "self_referential_payment", severity: "high", detail: "", value: 10 },
      { type: "temporal_burst", severity: "high", detail: "", value: 95 },
    ];
    const score = computeSybilRiskScore(signals);
    expect(score).toBe(1.0);
  });
});

describe("computeDampeningMultiplier", () => {
  it("returns 1.0 for risk score 0 (no dampening)", () => {
    expect(computeDampeningMultiplier(0)).toBe(1.0);
  });

  it("returns 0.5 for risk score 1.0 (maximum dampening)", () => {
    expect(computeDampeningMultiplier(1.0)).toBe(0.5);
  });

  it("returns value between 0.5 and 1.0 for intermediate risk", () => {
    const mult = computeDampeningMultiplier(0.5);
    expect(mult).toBeGreaterThanOrEqual(0.5);
    expect(mult).toBeLessThanOrEqual(1.0);
    expect(mult).toBe(0.75);
  });

  it("clamps risk score below 0 to no dampening", () => {
    expect(computeDampeningMultiplier(-0.5)).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/sybil-detection.test.ts`
Expected: FAIL — functions have no implementations yet.

- [ ] **Step 3: Implement risk score and dampening**

Add to `server/sybil-detection.ts`:

```ts
const SEVERITY_WEIGHTS: Record<SybilSignal["severity"], number> = {
  low: 0.15,
  medium: 0.3,
  high: 0.5,
};

/**
 * Compute aggregate Sybil risk score from individual signals.
 * Returns 0–1 where 0 = no risk, 1 = certain Sybil.
 * Uses additive severity weights, clamped to [0, 1].
 */
export function computeSybilRiskScore(signals: SybilSignal[]): number {
  if (signals.length === 0) return 0;

  let score = 0;
  for (const signal of signals) {
    score += SEVERITY_WEIGHTS[signal.severity];
  }

  return Math.min(1.0, Math.round(score * 100) / 100);
}

/**
 * Convert risk score to trust score dampening multiplier.
 * Linear interpolation: risk 0 → multiplier 1.0, risk 1 → multiplier 0.5.
 * Resulting trust score = rawScore * multiplier.
 */
export function computeDampeningMultiplier(riskScore: number): number {
  const clamped = Math.max(0, Math.min(1, riskScore));
  return 1.0 - (clamped * 0.5);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/sybil-detection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add __tests__/sybil-detection.test.ts server/sybil-detection.ts
git commit -m "feat(sybil): risk score computation and dampening multiplier"
```

---

### Task 7: Orchestrator Function — analyzeSybilSignals (TDD)

**Files:**
- Modify: `__tests__/sybil-detection.test.ts`
- Modify: `server/sybil-detection.ts`

- [ ] **Step 1: Write failing tests for the orchestrator**

Add to `__tests__/sybil-detection.test.ts`:

```ts
import { analyzeSybilSignals } from "../server/sybil-detection.js";
import type { SybilLookups } from "../server/sybil-detection.js";

describe("analyzeSybilSignals", () => {
  const emptyLookups: SybilLookups = {
    controllerAgentCounts: new Map(),
    fingerprintControllers: new Map(),
    transactionPatterns: new Map(),
  };

  it("returns clean analysis for solo controller agent", () => {
    const lookups: SybilLookups = {
      controllerAgentCounts: new Map([["0xsolo", 1]]),
      fingerprintControllers: new Map(),
      transactionPatterns: new Map(),
    };
    const result = analyzeSybilSignals("agent-1", "0xsolo", null, lookups);
    expect(result.signals).toHaveLength(0);
    expect(result.riskScore).toBe(0);
    expect(result.dampeningMultiplier).toBe(1.0);
  });

  it("detects controller cluster signal", () => {
    const lookups: SybilLookups = {
      controllerAgentCounts: new Map([["0xfarm", 500]]),
      fingerprintControllers: new Map(),
      transactionPatterns: new Map(),
    };
    const result = analyzeSybilSignals("agent-1", "0xfarm", null, lookups);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].type).toBe("controller_cluster");
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.dampeningMultiplier).toBeLessThan(1.0);
  });

  it("combines multiple signals and increases risk", () => {
    const lookups: SybilLookups = {
      controllerAgentCounts: new Map([["0xfarm", 6000]]),
      fingerprintControllers: new Map([["fp_dup", new Set(["0xfarm", "0xother1", "0xother2"])]]),
      transactionPatterns: new Map([["agent-1", { selfRefCount: 5, totalCount: 10, recentRatio: 0.9 }]]),
    };
    const result = analyzeSybilSignals("agent-1", "0xfarm", "fp_dup", lookups);
    expect(result.signals.length).toBeGreaterThanOrEqual(3);
    expect(result.riskScore).toBeGreaterThanOrEqual(0.7);
    expect(result.dampeningMultiplier).toBeLessThanOrEqual(0.65);
  });

  it("handles missing controller address in lookups", () => {
    const result = analyzeSybilSignals("agent-1", "0xunknown", null, emptyLookups);
    expect(result.signals).toHaveLength(0);
    expect(result.riskScore).toBe(0);
    expect(result.dampeningMultiplier).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/sybil-detection.test.ts`
Expected: FAIL — `analyzeSybilSignals` not exported.

- [ ] **Step 3: Implement analyzeSybilSignals**

Add to `server/sybil-detection.ts`:

```ts
/**
 * Orchestrate all sybil signal detectors for a single agent.
 * Pure function — requires pre-fetched lookups (no DB access).
 */
export function analyzeSybilSignals(
  agentId: string,
  controllerAddress: string,
  metadataFingerprint: string | null,
  lookups: SybilLookups,
): SybilAnalysis {
  const signals: SybilSignal[] = [];

  // 1. Controller clustering
  const agentCount = lookups.controllerAgentCounts.get(controllerAddress) ?? 0;
  const clusterSignal = detectControllerCluster(agentCount);
  if (clusterSignal) signals.push(clusterSignal);

  // 2. Fingerprint duplication
  const fpSignal = detectFingerprintDuplicate(metadataFingerprint, lookups.fingerprintControllers);
  if (fpSignal) signals.push(fpSignal);

  // 3. Self-referential payments
  const selfRefSignal = detectSelfReferentialPayment(agentId, lookups.transactionPatterns);
  if (selfRefSignal) signals.push(selfRefSignal);

  // 4. Temporal burst
  const burstSignal = detectTemporalBurst(agentId, lookups.transactionPatterns);
  if (burstSignal) signals.push(burstSignal);

  const riskScore = computeSybilRiskScore(signals);
  const dampeningMultiplier = computeDampeningMultiplier(riskScore);

  return { signals, riskScore, dampeningMultiplier };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/sybil-detection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add __tests__/sybil-detection.test.ts server/sybil-detection.ts
git commit -m "feat(sybil): analyzeSybilSignals orchestrator function"
```

---

### Task 8: Sybil Lookup Prefetcher (SQL Queries)

**Files:**
- Modify: `server/sybil-detection.ts`

This task adds the database-dependent `prefetchSybilLookups()` function that queries controller counts, fingerprint clusters, and transaction patterns in bulk.

- [ ] **Step 1: Add prefetchSybilLookups function**

Add to the bottom of `server/sybil-detection.ts`:

```ts
import { sql } from "drizzle-orm";

/**
 * Prefetch all lookup maps needed for batch sybil detection.
 * Runs 3 SQL queries — must be called with an active DB connection.
 */
export async function prefetchSybilLookups(db: any): Promise<SybilLookups> {
  // 1. Controller agent counts
  const controllerAgentCounts = new Map<string, number>();
  try {
    const result = await db.execute(sql`
      SELECT controller_address, COUNT(*)::int AS cnt
      FROM agents
      WHERE controller_address IS NOT NULL AND controller_address != ''
      GROUP BY controller_address
      HAVING COUNT(*) > 10
    `);
    for (const row of (result as any).rows ?? []) {
      controllerAgentCounts.set(row.controller_address, row.cnt);
    }
  } catch {}

  // 2. Fingerprint → set of controllers sharing it
  const fingerprintControllers = new Map<string, Set<string>>();
  try {
    const result = await db.execute(sql`
      SELECT metadata_fingerprint, controller_address
      FROM agents
      WHERE metadata_fingerprint IS NOT NULL AND metadata_fingerprint != ''
        AND controller_address IS NOT NULL AND controller_address != ''
      GROUP BY metadata_fingerprint, controller_address
    `);
    for (const row of (result as any).rows ?? []) {
      const fp = row.metadata_fingerprint;
      if (!fingerprintControllers.has(fp)) {
        fingerprintControllers.set(fp, new Set());
      }
      fingerprintControllers.get(fp)!.add(row.controller_address);
    }
    // Remove entries with only 1 controller (not duplicated)
    for (const [fp, controllers] of fingerprintControllers) {
      if (controllers.size <= 1) fingerprintControllers.delete(fp);
    }
  } catch {}

  // 3. Transaction patterns per agent (self-referential + temporal burst)
  const transactionPatterns = new Map<string, { selfRefCount: number; totalCount: number; recentRatio: number }>();
  try {
    const result = await db.execute(sql`
      WITH agent_controllers AS (
        SELECT id AS agent_id, controller_address FROM agents
        WHERE controller_address IS NOT NULL
      ),
      tx_stats AS (
        SELECT
          t.agent_id,
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (
            WHERE t.from_address IN (
              SELECT a2.controller_address FROM agents a2
              WHERE a2.controller_address = ac.controller_address
                AND a2.id != t.agent_id
            )
            OR t.to_address IN (
              SELECT a2.controller_address FROM agents a2
              WHERE a2.controller_address = ac.controller_address
                AND a2.id != t.agent_id
            )
          )::int AS self_ref_count,
          COUNT(*) FILTER (
            WHERE t.block_timestamp > NOW() - INTERVAL '24 hours'
          )::int AS recent_count
        FROM agent_transactions t
        JOIN agent_controllers ac ON ac.agent_id = t.agent_id
        GROUP BY t.agent_id, ac.controller_address
      )
      SELECT agent_id, total_count, self_ref_count,
             CASE WHEN total_count > 0
               THEN ROUND(recent_count::numeric / total_count, 2)
               ELSE 0
             END AS recent_ratio
      FROM tx_stats
      WHERE total_count > 0
    `);
    for (const row of (result as any).rows ?? []) {
      transactionPatterns.set(row.agent_id, {
        selfRefCount: Number(row.self_ref_count),
        totalCount: Number(row.total_count),
        recentRatio: Number(row.recent_ratio),
      });
    }
  } catch {}

  return { controllerAgentCounts, fingerprintControllers, transactionPatterns };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/sybil-detection.ts
git commit -m "feat(sybil): prefetchSybilLookups SQL queries for batch analysis"
```

---

### Task 9: Integrate Sybil Detection into recalculateAllScores

**Files:**
- Modify: `server/trust-score.ts:454-495`

- [ ] **Step 1: Add sybil import and prefetch to recalculateAllScores**

In `server/trust-score.ts`, modify the `recalculateAllScores` function. Add the sybil import at the top of the function body and prefetch sybil lookups alongside existing lookups:

```ts
export async function recalculateAllScores(): Promise<{ updated: number; elapsed: number }> {
  const start = Date.now();
  log("Starting batch trust score recalculation...", "trust-score");

  const allAgents = await storage.getAllAgents();
  const { feedbackMap, controllerChains, eventCounts } = await prefetchScoreLookups();

  // Sybil detection lookups
  const { analyzeSybilSignals, prefetchSybilLookups } = await import("./sybil-detection.js");
  const sybilLookups = await prefetchSybilLookups(db);
  log(`Sybil lookups: ${sybilLookups.controllerAgentCounts.size} flagged controllers, ${sybilLookups.fingerprintControllers.size} fingerprint clusters`, "trust-score");

  let updated = 0;
  const BATCH_SIZE = 500;

  for (let i = 0; i < allAgents.length; i += BATCH_SIZE) {
    const batch = allAgents.slice(i, i + BATCH_SIZE);
    const updates: Array<{ id: string; score: number; breakdown: TrustScoreBreakdown; signalHash: string; confidenceScore: number; confidenceLevel: string; sybilSignals: any; sybilRiskScore: number }> = [];

    for (const agent of batch) {
      const feedback = feedbackMap.get(agent.id) ?? null;
      const evtCount = eventCounts.get(agent.id) ?? 0;
      const crossChain = controllerChains.get(agent.controllerAddress) ?? 0;
      const breakdown = calculateTrustScore(agent, feedback, evtCount, crossChain);

      // Sybil analysis and dampening
      const sybil = analyzeSybilSignals(
        agent.id,
        agent.controllerAddress,
        agent.metadataFingerprint,
        sybilLookups,
      );
      const dampenedScore = Math.round(breakdown.total * sybil.dampeningMultiplier);

      const signalHash = computeSignalHash(agent, feedback, evtCount, crossChain);
      const confidence = computeConfidence({
        hasIdentity: !!(agent.name && agent.name.trim().length > 0),
        hasProbes: agent.x402Support === true,
        hasTransactions: false,
        hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
        hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
      });

      updates.push({
        id: agent.id,
        score: dampenedScore,
        breakdown: { ...breakdown, total: dampenedScore },
        signalHash,
        confidenceScore: confidence.score,
        confidenceLevel: confidence.level,
        sybilSignals: sybil.signals.length > 0 ? sybil.signals : null,
        sybilRiskScore: sybil.riskScore,
      });
    }

    await batchUpdateScoresWithSybil(updates);

    updated += updates.length;
    if (i % 5000 === 0 && i > 0) {
      log(`Trust score progress: ${updated}/${allAgents.length} agents`, "trust-score");
    }
  }

  const elapsed = Date.now() - start;
  log(`Trust score recalculation complete: ${updated} agents in ${(elapsed / 1000).toFixed(1)}s`, "trust-score");
  return { updated, elapsed };
}
```

- [ ] **Step 2: Add batchUpdateScoresWithSybil function**

Add after the existing `batchUpdateScores` function in `server/trust-score.ts`:

```ts
/** Batch-update trust scores including sybil columns. */
async function batchUpdateScoresWithSybil(updates: Array<{
  id: string; score: number; breakdown: TrustScoreBreakdown;
  signalHash: string; confidenceScore: number; confidenceLevel: string;
  sybilSignals: any; sybilRiskScore: number;
}>) {
  if (updates.length === 0) return;
  const now = new Date();
  const ids = updates.map(u => u.id);
  const scores = updates.map(u => u.score);
  const breakdowns = updates.map(u => JSON.stringify(u.breakdown));
  const hashes = updates.map(u => u.signalHash);
  const confScores = updates.map(u => u.confidenceScore);
  const confLevels = updates.map(u => u.confidenceLevel);
  const sybilSigs = updates.map(u => u.sybilSignals ? JSON.stringify(u.sybilSignals) : null);
  const sybilRisks = updates.map(u => u.sybilRiskScore);

  await db.execute(sql`
    UPDATE agents SET
      trust_score = batch.score,
      trust_score_breakdown = batch.breakdown::jsonb,
      trust_score_updated_at = ${now},
      trust_signal_hash = batch.hash,
      trust_methodology_version = ${METHODOLOGY_VERSION},
      confidence_score = batch.conf_score,
      confidence_level = batch.conf_level,
      sybil_signals = batch.sybil_sig::jsonb,
      sybil_risk_score = batch.sybil_risk
    FROM (
      SELECT unnest(${ids}::text[]) AS id,
             unnest(${scores}::int[]) AS score,
             unnest(${breakdowns}::text[]) AS breakdown,
             unnest(${hashes}::text[]) AS hash,
             unnest(${confScores}::real[]) AS conf_score,
             unnest(${confLevels}::text[]) AS conf_level,
             unnest(${sybilSigs}::text[]) AS sybil_sig,
             unnest(${sybilRisks}::real[]) AS sybil_risk
    ) AS batch
    WHERE agents.id = batch.id
  `);
}
```

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: All 149+ tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/trust-score.ts
git commit -m "feat(sybil): integrate sybil dampening into recalculateAllScores pipeline"
```

---

### Task 10: Expose Sybil Signals in Trust Reports

**Files:**
- Modify: `server/trust-report-compiler.ts`

- [ ] **Step 1: Add sybil data to FullReportData type**

In `server/trust-report-compiler.ts`, find the `FullReportData` interface and add after the `confidence` block:

```ts
  sybil: {
    signals: Array<{ type: string; severity: string; detail: string; value: number }>;
    riskScore: number;
    dampeningApplied: boolean;
    rawScoreBeforeDampening: number | null;
  } | null;
```

- [ ] **Step 2: Populate sybil data in report compilation**

Find the section where `fullReportData` is constructed (search for `fullReportData:` or `const fullReport`). Add sybil data sourced from the agent's stored `sybilSignals` and `sybilRiskScore` columns:

```ts
    sybil: agent.sybilSignals ? {
      signals: agent.sybilSignals as any[],
      riskScore: agent.sybilRiskScore ?? 0,
      dampeningApplied: (agent.sybilRiskScore ?? 0) > 0,
      rawScoreBeforeDampening: (agent.sybilRiskScore ?? 0) > 0
        ? Math.round(score / (1.0 - ((agent.sybilRiskScore ?? 0) * 0.5)))
        : null,
    } : null,
```

Note: The `rawScoreBeforeDampening` is reverse-calculated from the dampened score. This is `score / dampeningMultiplier` where `dampeningMultiplier = 1 - (riskScore * 0.5)`.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/trust-report-compiler.ts
git commit -m "feat(sybil): expose sybil signals in full trust reports"
```

---

### Task 11: Sybil Integration Tests

**Files:**
- Modify: `__tests__/sybil-detection.test.ts`

- [ ] **Step 1: Add integration-style tests combining score dampening with verdicts**

Add to `__tests__/sybil-detection.test.ts`:

```ts
import { calculateTrustScore } from "../server/trust-score.js";
import { computeVerdict } from "../server/trust-report-compiler.js";
import { SYBIL_FARM_AGENT, SOLO_CONTROLLER_AGENT } from "./fixtures/agents.js";

describe("sybil dampening integration", () => {
  it("dampened score can change verdict from CAUTION to UNTRUSTED", () => {
    // Agent with raw score 45 → CAUTION normally
    const rawVerdict = computeVerdict(45, "low", [], "active");
    expect(rawVerdict).toBe("CAUTION");

    // After 50% dampening (high sybil risk) → score 23 → UNTRUSTED
    const dampenedScore = Math.round(45 * 0.5);
    const dampenedVerdict = computeVerdict(dampenedScore, "low", [], "active");
    expect(dampenedVerdict).toBe("UNTRUSTED");
  });

  it("solo controller agent is not dampened", () => {
    const lookups: SybilLookups = {
      controllerAgentCounts: new Map([["0xsolocontroller00000000000000000000000001", 1]]),
      fingerprintControllers: new Map(),
      transactionPatterns: new Map(),
    };
    const result = analyzeSybilSignals(
      SOLO_CONTROLLER_AGENT.id,
      SOLO_CONTROLLER_AGENT.controllerAddress,
      SOLO_CONTROLLER_AGENT.metadataFingerprint,
      lookups,
    );
    expect(result.dampeningMultiplier).toBe(1.0);
  });

  it("high-severity farm agent gets significant dampening", () => {
    const lookups: SybilLookups = {
      controllerAgentCounts: new Map([["0xsybilcontroller000000000000000000000000001", 6000]]),
      fingerprintControllers: new Map([
        ["fp_duplicate_cluster_1", new Set(["0xsybilcontroller000000000000000000000000001", "0xother1", "0xother2"])],
      ]),
      transactionPatterns: new Map(),
    };
    const result = analyzeSybilSignals(
      SYBIL_FARM_AGENT.id,
      SYBIL_FARM_AGENT.controllerAddress,
      SYBIL_FARM_AGENT.metadataFingerprint,
      lookups,
    );
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
    expect(result.dampeningMultiplier).toBeLessThanOrEqual(0.7);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass, including the new sybil integration tests.

- [ ] **Step 3: Commit**

```bash
git add __tests__/sybil-detection.test.ts
git commit -m "test(sybil): integration tests for dampening + verdict interaction"
```

---

### Task 12: Update Future Phases Doc and Session Context

**Files:**
- Modify: `docs/principles/future-phases.md`

- [ ] **Step 1: Update Phase 2 status in future-phases.md**

Change Phase 2's status and add implementation notes:

```markdown
## Phase 2: Anti-Gaming & Sybil Resistance (Principle 5)

**Status:** Complete
**Completed:** 2026-04-13
**Dependencies:** Phase 1 complete ✓

### What was built:
1. **Controller clustering detection** — Controllers with >10 agents flagged. Severity: low (11-50), medium (51-500), high (>500). In production: 463 controllers flagged.
2. **Metadata fingerprint clustering** — Agents sharing identical fingerprints across different controllers. 4,119 clusters detected.
3. **Self-referential payment detection** — Cycles between controlled wallets in `agent_transactions`. Limited data (26 agents with txs) but detection ready.
4. **Temporal burst detection** — >50% of tx volume in last 24h flagged. Minimum 5 transactions required.
5. **Score dampening** — Risk score (0-1) converts to multiplier (0.5-1.0) applied to raw trust score during `recalculateAllScores()`.

### Schema additions:
- `sybil_signals jsonb` column on agents table
- `sybil_risk_score real` column on agents table

### Integration:
- `server/sybil-detection.ts` — Pure detection functions + SQL prefetcher
- Called during `recalculateAllScores()` in `server/trust-score.ts`
- Sybil block included in full trust reports via `server/trust-report-compiler.ts`
```

- [ ] **Step 2: Commit**

```bash
git add docs/principles/future-phases.md
git commit -m "docs: update Phase 2 status to complete"
```

---

## Self-Review Checklist

1. **Spec coverage:** All 4 signal types from `future-phases.md` are covered (controller clustering, self-referential payment, temporal burst, metadata fingerprint). Schema additions match spec. Integration point (`recalculateAllScores`) matches spec.
2. **Placeholder scan:** No TBDs, TODOs, or "implement later" in any task. All code blocks are complete.
3. **Type consistency:** `SybilSignal`, `SybilAnalysis`, `SybilLookups` types used consistently across all tasks. Function signatures match between test imports and implementations.
