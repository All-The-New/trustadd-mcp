# ADR-1 Fortify: Routes Split, Storage Split, Migrations, Sentry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete ADR-1 items 4, 5, 7, and 9 — split the two god files (`routes.ts`, `storage.ts`), add versioned migrations, and wire Sentry into the Express error handler.

**Architecture:** Pure file-splitting refactor for routes and storage (no behavioral changes). Each route file exports a `register(app)` function; `routes.ts` becomes a thin orchestrator. Each storage sub-file exports standalone query functions; `DatabaseStorage` delegates to them. Drizzle-kit generates migration SQL snapshots. Sentry captures exceptions in the Express error middleware.

**Tech Stack:** Express 5, Drizzle ORM, drizzle-kit, @sentry/node 10, Vitest, TypeScript strict, ESM with `.js` extensions.

**CRITICAL:** All relative imports between server files MUST use `.js` extensions (e.g., `./routes/helpers.js`). This is required for Vercel serverless ESM compatibility.

---

## Task 0: Verify Deployment + Baseline Tests

**Files:**
- Read: `.vercel/project.json` (for team/project IDs)

- [ ] **Step 1: Verify Vercel deploy for commit c94f5b1**

Use the Vercel MCP `list_deployments` tool (teamId from `.vercel/project.json` `orgId`, projectId from `projectId`). Check that the most recent deployment has status `READY` and the git commit SHA starts with `c94f5b1`.

If the deploy failed, check build logs with `get_deployment_build_logs` and report the failure before proceeding.

- [ ] **Step 2: Run baseline tests**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npm test
```

Expected: 149 tests passing across 4 suites. Record the exact count — we'll compare after each split.

- [ ] **Step 3: Run type check**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

Expected: Clean (0 errors). If there are pre-existing errors, document them so we don't conflate them with regressions.

---

## Task 1: Create `server/routes/helpers.ts`

Shared utilities used by multiple route files. Extracted from `server/routes.ts` lines 36-92.

**Files:**
- Create: `server/routes/helpers.ts`

- [ ] **Step 1: Create the routes directory**

```bash
mkdir -p /Users/ethserver/CLAUDE/trustadd/server/routes
```

- [ ] **Step 2: Write `server/routes/helpers.ts`**

```ts
import { computeVerdict, type Verdict } from "../trust-report-compiler.js";

// ─── API Tiering ─────────────────────────────────────────────────
// Free tier: ecosystem analytics, agent discovery (redacted), verdict badges
// Paid tier (x402): trust scores, breakdowns, community signals, transactions
// See docs/api-tiering.md for the full classification.

/** Null-safe wrapper around computeVerdict — returns UNKNOWN for unscored agents. */
export function verdictFor(
  score: number | null,
  tier: string | null,
  flags: string[] | null,
  status: string | null,
): Verdict {
  return score == null ? "UNKNOWN" : computeVerdict(score, tier, flags, status);
}

/** Strip trust-intelligence fields from an agent object for public (free) responses. */
export function redactAgentForPublic(agent: Record<string, unknown>): Record<string, unknown> {
  const verdict = verdictFor(
    agent.trustScore as number | null,
    (agent.qualityTier as string) ?? null,
    (agent.spamFlags as string[]) ?? null,
    (agent.lifecycleStatus as string) ?? null,
  );
  const {
    trustScore: _ts,
    trustScoreBreakdown: _tsb,
    trustScoreUpdatedAt: _tsu,
    qualityTier: _qt,
    spamFlags: _sf,
    lifecycleStatus: _ls,
    ...publicFields
  } = agent;
  return {
    ...publicFields,
    verdict,
    reportAvailable: true,
  };
}

// Lightweight in-memory TTL cache for expensive query results.
// Serverless functions are ephemeral, so memory is naturally bounded.
const responseCache = new Map<string, { data: unknown; expiresAt: number }>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = responseCache.get(key);
  if (entry && entry.expiresAt > now) return entry.data as T;
  const data = await fn();
  responseCache.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

export function parseChainId(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const parsed = parseInt(raw as string, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Shared cache-control header for analytics endpoints (5 min CDN + 10 min stale). */
export const ANALYTICS_CACHE = "public, s-maxage=300, stale-while-revalidate=600";

/** Shared in-memory TTL for analytics endpoints (5 min). */
export const ANALYTICS_TTL = 300_000;
```

- [ ] **Step 3: Verify the file compiles**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

Expected: Clean.

---

## Task 2: Create `server/routes/status.ts`

Routes: `/sitemap-agents.xml`, `/api/chains`, `/api/events/recent`, `/api/reputation-sources`, `/api/health`, `/api/status/*` (overview, events, metrics, summary, tasks, alerts).

**Files:**
- Create: `server/routes/status.ts`
- Reference: `server/routes.ts` lines 98-115 (sitemap), 117-151 (chains), 213-224 (events/recent), 241-243 (reputation-sources), 499-703 (health + all status routes)

- [ ] **Step 1: Create `server/routes/status.ts`**

The file must:
1. `import type { Express } from "express";`
2. Import `createLogger` from `../lib/logger.js`
3. Import `storage` from `../storage.js`
4. Import `{ cached, parseChainId }` from `./helpers.js`
5. Import `{ getAllChains, getEnabledChains, getChain }` from `../../shared/chains.js`
6. Import `{ evaluateAlerts, deliverAlerts }` from `../alerts.js`
7. Import `{ getAllPipelineHealth }` from `../pipeline-health.js` (only if the `/api/status/tasks` route needs it — check; actually `/api/status/tasks` fetches from Trigger.dev API directly)
8. Export `function registerStatusRoutes(app: Express): void`

Move these route handlers from `server/routes.ts` into the `registerStatusRoutes` function body, preserving their exact implementation:
- `GET /sitemap-agents.xml` (lines 98-115)
- `GET /api/chains` (lines 117-151)
- `GET /api/events/recent` (lines 213-224)
- `GET /api/reputation-sources` (lines 241-243)
- `GET /api/health` (lines 499-547)
- `GET /api/status/overview` (lines 549-578)
- `GET /api/status/events` (lines 580-590)
- `GET /api/status/metrics` (lines 592-601)
- `GET /api/status/summary` (lines 603-610)
- `GET /api/status/tasks` (lines 612-693)
- `GET /api/status/alerts` (lines 695-703)

Do NOT modify any route handler logic. This is a pure move.

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

---

## Task 3: Create `server/routes/agents.ts`

Routes: `/api/agents/*`, `/api/stats`, `/api/agents/:id/trust-score`, `/api/agents/:id/feedback`, `/api/agents/:id/history`, `/api/agents/:id/community-feedback/*`, `/api/agents/:id/transactions/*`, `/api/trust-scores/*`, `/api/analytics/trust-scores`.

**Files:**
- Create: `server/routes/agents.ts`
- Reference: `server/routes.ts` lines 153-211 (agents list + detail + history), 226-256 (feedback + stats), 706-764 (community-feedback per-agent), 811-885 (trust-score + trust-scores), 1007-1041 (transactions per-agent)

- [ ] **Step 1: Create `server/routes/agents.ts`**

The file must:
1. `import type { Express } from "express";`
2. Import `createLogger` from `../lib/logger.js`
3. Import `storage` from `../storage.js`
4. Import `{ redactAgentForPublic, verdictFor, cached, parseChainId }` from `./helpers.js`
5. Import `{ computeVerdict }` from `../trust-report-compiler.js`
6. Export `function registerAgentRoutes(app: Express): void`

Move these route handlers (exact implementation, no changes):
- `GET /api/agents` (lines 153-175)
- `GET /api/agents/:id` (lines 177-190)
- `GET /api/agents/:id/history` (lines 193-211)
- `GET /api/agents/:id/feedback` (lines 226-238)
- `GET /api/stats` (lines 245-256)
- `GET /api/agents/:id/community-feedback` (lines 706-730)
- `GET /api/agents/:id/community-feedback/github` (lines 732-747)
- `GET /api/agents/:id/community-feedback/farcaster` (lines 749-764)
- `GET /api/agents/:id/trust-score` (lines 811-831)
- `GET /api/trust-scores/top` (lines 834-859)
- `GET /api/trust-scores/distribution` (lines 861-870)
- `GET /api/analytics/trust-scores` (lines 873-885)
- `GET /api/agents/:id/transactions` (lines 1007-1023)
- `GET /api/agents/:id/transactions/stats` (lines 1025-1041)

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

---

## Task 4: Create `server/routes/analytics.ts`

Routes: `/api/analytics/*` (minus trust-scores), `/api/economy/*`, `/api/skills/*`, `/api/quality/*`, `/api/bazaar/*`, `/api/community-feedback/stats`, `/api/community-feedback/leaderboard`.

**Files:**
- Create: `server/routes/analytics.ts`
- Reference: `server/routes.ts` lines 258-470 (analytics overview through api-usage), 766-808 (community-feedback stats/leaderboard + admin scrape), 887-1004 (economy), 1065-1084 (quality), 1108-1326 (skills + bazaar)

- [ ] **Step 1: Create `server/routes/analytics.ts`**

The file must:
1. `import type { Express } from "express";`
2. Import `createLogger` from `../lib/logger.js`
3. Import `storage` from `../storage.js`
4. Import `pool` from `../db.js`
5. Import `{ redactAgentForPublic, verdictFor, cached, parseChainId, ANALYTICS_CACHE, ANALYTICS_TTL }` from `./helpers.js`
6. Export `function registerAnalyticsRoutes(app: Express): void`

Move these route handlers (preserving the `ANALYTICS_CACHE`/`ANALYTICS_TTL` constant usage):
- All `GET /api/analytics/*` routes EXCEPT `/api/analytics/trust-scores` (that's in agents.ts) — lines 262-469
- `GET /api/community-feedback/stats` (lines 766-773)
- `GET /api/community-feedback/leaderboard` (lines 776-795)
- All `GET /api/economy/*` routes (lines 887-1004)
- `GET /api/quality/summary` (lines 1065-1073)
- `GET /api/quality/offenders` (lines 1076-1084)
- All `GET /api/skills/*` routes (lines 1108-1181)
- All `GET /api/bazaar/*` routes (lines 1185-1326)

Note: The `/api/analytics/api-usage` route (lines 407-469) and bazaar routes `/api/bazaar/price-distribution` (lines 1239-1279) and `/api/bazaar/crossref` (lines 1281-1326) use direct `pool.query()` or dynamic `import("../db.js")`. Preserve these patterns exactly.

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

---

## Task 5: Create `server/routes/admin.ts`

Routes: All `/api/admin/*` routes.

**Files:**
- Create: `server/routes/admin.ts`
- Reference: `server/routes.ts` lines 471-497 (sync), 797-808 (community scrape), 1043-1063 (transactions sync + probes), 1086-1106 (discover + audit-log), 1485-1498 (trust-product stats + login/session/logout), 1503-1734 (usage detailed + usage log + dashboard + audit-log detailed)

- [ ] **Step 1: Create `server/routes/admin.ts`**

The file must:
1. `import type { Express } from "express";`
2. Import `createLogger` from `../lib/logger.js`
3. Import `{ requireAdmin }` from `../lib/admin-audit.js`
4. Import `{ handleAdminLogin, handleAdminSession, handleAdminLogout, requireAdminSession }` from `../lib/admin-auth.js`
5. Import `pool` from `../db.js`
6. Import `storage` from `../storage.js`
7. Import `{ cached }` from `./helpers.js`
8. Import `{ runSync }` from `../../scripts/sync-prod-to-dev.js`
9. Import `{ getCommunityFeedbackScheduler, discoverAllSources }` from `../community-feedback/index.js`
10. Import `{ recalculateScore }` from `../trust-score.js`
11. Import `{ probeAllAgents }` from `../x402-prober.js`
12. Import `{ syncAllAgentTransactions }` from `../transaction-indexer.js`
13. Import `{ getReportUsageStats }` from `../trust-report-compiler.js`
14. Declare module-level `let syncInProgress = false;` (moved from routes.ts line 471)
15. Export `function registerAdminRoutes(app: Express): void`

Move ALL admin route handlers preserving exact implementation:
- `POST /api/admin/sync` (lines 473-497)
- `POST /api/admin/community-feedback/scrape` (lines 797-808)
- `POST /api/admin/transactions/sync` (lines 1043-1052)
- `POST /api/admin/probes/run` (lines 1054-1063)
- `POST /api/admin/community-feedback/discover` (lines 1086-1093)
- `GET /api/admin/audit-log` (lines 1095-1106)
- `GET /api/admin/trust-product/stats` (lines 1485-1493)
- `POST /api/admin/login` (line 1496)
- `GET /api/admin/session` (line 1497)
- `POST /api/admin/logout` (line 1498)
- `GET /api/admin/usage/detailed` (lines 1503-1594)
- `GET /api/admin/usage/log` (lines 1597-1649)
- `GET /api/admin/dashboard` (lines 1652-1693)
- `GET /api/admin/audit-log/detailed` (lines 1696-1734)

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

---

## Task 6: Create `server/routes/trust.ts`

Routes: Trust Data Product API v1 (`/api/v1/trust/*`).

**Files:**
- Create: `server/routes/trust.ts`
- Reference: `server/routes.ts` lines 1328-1482

- [ ] **Step 1: Create `server/routes/trust.ts`**

The file must:
1. `import type { Express } from "express";`
2. Import `createLogger` from `../lib/logger.js`
3. Import `{ createTrustProductGate }` from `../lib/x402-gate.js`
4. Import `{ resolveAgentByAddress, getOrCompileReport, incrementAccessCount, computeVerdict, type QuickCheckData, type FullReportData, type Verdict }` from `../trust-report-compiler.js`
5. Import `{ getMethodology }` from `../trust-methodology.js`
6. Import `{ getAllPipelineHealth }` from `../pipeline-health.js`
7. Import `{ parseChainId }` from `./helpers.js`
8. Declare module-level constants: `ADDRESS_REGEX`, `trustProductEnabled` (moved from lines 1330-1332)
9. Export `function registerTrustRoutes(app: Express): void`

Move these route handlers AND the x402 gate mounting logic:
- `GET /api/v1/trust/methodology` (lines 1335-1337)
- `GET /api/v1/trust/pipeline-health` (lines 1340-1357)
- `GET /api/v1/trust/:address/exists` (lines 1362-1407)
- x402 gate mount (lines 1411-1417) — MUST come after `/exists` and before `/:address`
- `GET /api/v1/trust/:address` (lines 1420-1450)
- `GET /api/v1/trust/:address/report` (lines 1453-1482)

**CRITICAL:** Route registration order matters. The `/exists` endpoint must be registered BEFORE the x402 gate middleware, which must be registered BEFORE `/:address` and `/:address/report`.

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

---

## Task 7: Rewrite `routes.ts` as Orchestrator + Tests + Commit

**Files:**
- Modify: `server/routes.ts` (replace entire content)
- Modify: `__tests__/free-tier.test.ts` line 9 (update import path)

- [ ] **Step 1: Replace `server/routes.ts` with the orchestrator**

```ts
import type { Express } from "express";
import { type Server } from "http";
import { registerStatusRoutes } from "./routes/status.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerTrustRoutes } from "./routes/trust.js";

// Re-export helpers used by tests and other modules
export { verdictFor, redactAgentForPublic } from "./routes/helpers.js";

export async function registerRoutes(
  app: Express,
  _httpServer?: Server,
): Promise<void> {
  registerStatusRoutes(app);
  registerAgentRoutes(app);
  registerAnalyticsRoutes(app);
  registerAdminRoutes(app);
  registerTrustRoutes(app);
}
```

Note: `verdictFor` and `redactAgentForPublic` are re-exported so that `__tests__/free-tier.test.ts` (which imports from `../server/routes.js`) continues to work. This also preserves the public API for any other consumers.

- [ ] **Step 2: Update test import (optional — re-export handles this)**

Check that `__tests__/free-tier.test.ts` line 9 still resolves:
```ts
import { redactAgentForPublic } from "../server/routes.js";
```

This works because the orchestrator re-exports `redactAgentForPublic`. No test change needed.

- [ ] **Step 3: Verify type check passes**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

Expected: Clean (0 errors).

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npm test
```

Expected: Same 149 tests passing as baseline. If any fail, investigate — the split should be purely structural with zero behavioral changes.

- [ ] **Step 5: Commit**

```bash
cd /Users/ethserver/CLAUDE/trustadd && git add server/routes.ts server/routes/ __tests__/ && git commit -m "refactor: split routes.ts into 5 domain route files (ADR-1 item 4)

routes.ts (1,736 LOC) → thin orchestrator + 5 domain files:
- routes/helpers.ts: shared utilities (verdictFor, redactAgentForPublic, cached, parseChainId)
- routes/status.ts: sitemap, chains, health, status endpoints
- routes/agents.ts: agent CRUD, trust-scores, per-agent community feedback
- routes/analytics.ts: analytics, economy, skills, bazaar, quality, community-feedback stats
- routes/admin.ts: all admin routes
- routes/trust.ts: Trust Data Product API v1 (x402-gated)

Pure file-splitting refactor — no behavioral changes.
149 tests passing before and after."
```

---

## Task 8: Create `server/storage/indexer.ts`

**Files:**
- Create: `server/storage/indexer.ts`
- Reference: `server/storage.ts` lines 500-535 (getIndexerStateId, getIndexerState, updateIndexerState), 1047-1123 (logIndexerEvent through pruneOldMetrics)

- [ ] **Step 1: Create the storage directory**

```bash
mkdir -p /Users/ethserver/CLAUDE/trustadd/server/storage
```

- [ ] **Step 2: Write `server/storage/indexer.ts`**

The file exports standalone async functions (not a class). Each function imports `db` from `../db.js` and the necessary schema tables/operators.

Structure:
```ts
import { db } from "../db.js";
import { indexerState, indexerEvents, indexerMetrics, type IndexerState, type IndexerEvent, type InsertIndexerEvent, type IndexerMetric, type InsertIndexerMetric } from "../../shared/schema.js";
import { eq, desc, sql, and, gt, lte } from "drizzle-orm";

function getIndexerStateId(chainId: number): string {
  // Move from storage.ts line 500-502
}

export async function getIndexerState(chainId: number): Promise<IndexerState> {
  // Move from storage.ts lines 504-515
  // Replace this.getIndexerStateId(chainId) with getIndexerStateId(chainId)
}

export async function updateIndexerState(chainId: number, updates: Partial<IndexerState>): Promise<void> {
  // Move from storage.ts lines 517-535
  // Replace this.getIndexerStateId(chainId) with getIndexerStateId(chainId)
}

export async function logIndexerEvent(event: InsertIndexerEvent): Promise<IndexerEvent> {
  // Move from storage.ts lines 1047-1050
}

export async function getSpamRanges(chainId: number, afterBlock: number): Promise<Array<{ from: number; to: number }>> {
  // Move from storage.ts lines 1052-1066
}

export async function getRecentIndexerEvents(limit?: number, chainId?: number, eventType?: string): Promise<IndexerEvent[]> {
  // Move from storage.ts lines 1068-1079
}

export async function getIndexerEventCounts(sinceMinutes?: number, chainId?: number): Promise<Array<{ eventType: string; count: number }>> {
  // Move from storage.ts lines 1081-1096
}

export async function recordMetricsPeriod(metrics: InsertIndexerMetric): Promise<IndexerMetric> {
  // Move from storage.ts lines 1098-1101
}

export async function getMetricsHistory(chainId?: number, hours?: number): Promise<IndexerMetric[]> {
  // Move from storage.ts lines 1103-1111
}

export async function pruneOldEvents(olderThanDays?: number): Promise<number> {
  // Move from storage.ts lines 1113-1117
}

export async function pruneOldMetrics(olderThanDays?: number): Promise<number> {
  // Move from storage.ts lines 1119-1123
}
```

Copy each method body EXACTLY from `storage.ts`, only changing `this.getIndexerStateId(...)` to `getIndexerStateId(...)`.

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

---

## Task 9: Create `server/storage/feedback.ts`

**Files:**
- Create: `server/storage/feedback.ts`
- Reference: `server/storage.ts` lines 1125-1243

- [ ] **Step 1: Write `server/storage/feedback.ts`**

```ts
import { db } from "../db.js";
import { communityFeedbackSources, communityFeedbackItems, communityFeedbackSummaries, type CommunityFeedbackSource, type InsertCommunityFeedbackSource, type CommunityFeedbackItem, type InsertCommunityFeedbackItem, type CommunityFeedbackSummary, type InsertCommunityFeedbackSummary } from "../../shared/schema.js";
import { eq, desc, sql, and, lte } from "drizzle-orm";
```

Export these 12 functions, moving the method bodies exactly from storage.ts:
- `getCommunityFeedbackSources` (lines 1125-1133)
- `createCommunityFeedbackSource` (lines 1135-1150)
- `updateCommunityFeedbackSource` (lines 1152-1156)
- `getStaleSourcesForPlatform` (lines 1158-1170)
- `createCommunityFeedbackItem` (lines 1172-1178)
- `getCommunityFeedbackItems` (lines 1180-1188)
- `pruneOldFeedbackItems` (lines 1190-1198)
- `getCommunityFeedbackSummary` (lines 1200-1204)
- `upsertCommunityFeedbackSummary` (lines 1206-1215)
- `getAgentsWithCommunityFeedback` (lines 1217-1222)
- `getCommunityFeedbackSummariesByAgentIds` (lines 1224-1228)
- `getCommunityFeedbackStats` (lines 1230-1243)

No `this` references in any of these methods — straight move.

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

---

## Task 10: Create `server/storage/analytics.ts`

Probes, transactions, bazaar, and `getStatusSummary`.

**Files:**
- Create: `server/storage/analytics.ts`
- Reference: `server/storage.ts` lines 1474-1795 (probes + transactions + status), 2375-2580 (bazaar)

- [ ] **Step 1: Write `server/storage/analytics.ts`**

```ts
import { db } from "../db.js";
import { x402Probes, agents, agentTransactions, transactionSyncState, bazaarServices, bazaarSnapshots, indexerEvents, type X402Probe, type InsertX402Probe, type AgentTransaction, type InsertAgentTransaction, type BazaarService, type InsertBazaarService, type BazaarSnapshot, type InsertBazaarSnapshot } from "../../shared/schema.js";
import { eq, desc, sql, and, isNotNull, gt, lt, lte, asc, inArray, isNull } from "drizzle-orm";
```

Export these functions, moving method bodies exactly:

**Probes (lines 1474-1564):**
- `createProbeResult`, `getProbeResults`, `getProbeStats`, `getAgentsWithPaymentAddresses`, `getStaleProbeAgentIds`, `getRecentProbeForEndpoint`

**Transactions (lines 1566-1744):**
- `createTransaction`, `getTransactions`, `getTransactionStats`, `getAgentTransactionStats`, `getTopEarningAgents`, `getTransactionVolume`, `getTransactionSyncState`, `upsertTransactionSyncState`, `getMostRecentSyncTime`, `getKnownPaymentAddresses`

**Status (lines 1746-1795):**
- `getStatusSummary` — this calls `this.getProbeStats()` internally (line 1748). Replace with `getProbeStats()` (direct function call within the same file).

**Bazaar (lines 2375-2580):**
- `upsertBazaarService`, `upsertBazaarServices`, `markBazaarServicesInactive`, `getBazaarServices`, `getBazaarStats`, `getBazaarSnapshots`, `createBazaarSnapshot`, `getBazaarTopServices`

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

---

## Task 11: Create `server/storage/agents.ts`

All remaining methods — core CRUD, events, stats, and all analytics/quality/skills/protocol methods that query the `agents` table.

**Files:**
- Create: `server/storage/agents.ts`
- Reference: `server/storage.ts` lines 245-704 (core agents + analytics overview methods), 706-1045 (getAnalytics* methods), 1244-1472 (trust scores + economy), 1797-2371 (quality + protocol + skills)

- [ ] **Step 1: Write `server/storage/agents.ts`**

```ts
import { db } from "../db.js";
import { agents, agentMetadataEvents, indexerState, communityFeedbackItems, communityFeedbackSummaries, communityFeedbackSources, type Agent, type InsertAgent, type AgentMetadataEvent, type InsertAgentMetadataEvent } from "../../shared/schema.js";
import { eq, desc, sql, ilike, or, and, isNotNull, count, gt, lt, isNull, lte, asc, inArray } from "drizzle-orm";
import { getIndexerState } from "./indexer.js";
```

Note the import of `getIndexerState` from `./indexer.js` — needed by `getStats()` which calls `this.getIndexerState(chainId)` at line 660. Replace with `getIndexerState(chainId)`.

Also note: `updateAgent` (line 429) calls `this.getAgent(id)`. Replace with `getAgent(id)` (same-file function call).

Also note: `deleteAgent` (line 447) cascades deletes across `communityFeedbackItems`, `communityFeedbackSummaries`, `communityFeedbackSources`, `agentMetadataEvents` — import those tables.

Re-export the query options types:
```ts
import type { AgentQueryOptions, PaginatedAgents } from "../storage.js";
```

Export ALL remaining methods as standalone functions. This is the largest sub-file (~1500 LOC). The methods to move:

**Core CRUD (lines 245-498):** `getAgents`, `getAgentIdsForSitemap`, `getAllAgents`, `getAgentsForReResolve`, `getAgent`, `getAgentByErc8004Id`, `getAgentByContractAddress`, `createAgent`, `updateAgent`, `deleteAgent`, `getAgentEvents`, `createAgentEvent`, `getEventByTxHash`, `getEventByAgentAndTxHash`

**Query methods (lines 537-704):** `getRecentEvents`, `getAgentFeedbackSummary`, `getStats`

**Analytics (lines 706-1045):** `getAnalyticsOverview`, `getAnalyticsChainDistribution`, `getAnalyticsRegistrations`, `getAnalyticsMetadataQuality`, `getAnalyticsX402ByChain`, `getAnalyticsControllerConcentration`, `getAnalyticsUriSchemes`, `getAnalyticsCategories`, `getAnalyticsImageDomains`, `getAnalyticsModels`, `getAnalyticsEndpointsCoverage`, `getAnalyticsTopAgents`

**Trust scores (lines 1244-1327):** `getTrustScoreLeaderboard`, `getTrustScoreDistribution`, `getTrustScoreStatsByChain`

**Economy (lines 1329-1472):** `getEconomyOverview`, `getTopX402Agents`, `getEndpointAnalysis`, `getX402AdoptionByChain`

**Quality (lines 1797-2046):** `getQualitySummary`, `getQualityOffenders`

**Protocol (lines 2048-2131):** `getProtocolStats`

**Skills (lines 2132-2371):** `getSkillsSummary`, `getSkillsChainDistribution`, `getSkillsTopCapabilities`, `getSkillsCategoryBreakdown`, `getSkillsTrustCorrelation`, `getSkillsOasfOverview`, `getSkillsNotableAgents`

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

---

## Task 12: Rewrite `storage.ts` as Delegator + Tests + Commit

**Files:**
- Modify: `server/storage.ts` (rewrite to thin delegator)

- [ ] **Step 1: Rewrite `server/storage.ts`**

Keep: imports for schema types, `AgentQueryOptions`, `PaginatedAgents`, and the full `IStorage` interface.

Replace: The `DatabaseStorage` class body with thin delegation to the 4 sub-files.

```ts
// ... existing imports for types (keep lines 1-40) ...
// ... existing AgentQueryOptions and PaginatedAgents interfaces (keep lines 42-58) ...
// ... existing IStorage interface (keep lines 60-242) ...

import * as agentQueries from "./storage/agents.js";
import * as indexerQueries from "./storage/indexer.js";
import * as feedbackQueries from "./storage/feedback.js";
import * as analyticsQueries from "./storage/analytics.js";

export class DatabaseStorage implements IStorage {
  // === Agents ===
  getAgents(options?: AgentQueryOptions) { return agentQueries.getAgents(options); }
  getAllAgents(chainId?: number) { return agentQueries.getAllAgents(chainId); }
  getAgentsForReResolve(chainId: number) { return agentQueries.getAgentsForReResolve(chainId); }
  getAgent(id: string) { return agentQueries.getAgent(id); }
  getAgentByErc8004Id(erc8004Id: string, chainId: number) { return agentQueries.getAgentByErc8004Id(erc8004Id, chainId); }
  getAgentByContractAddress(address: string, chainId: number) { return agentQueries.getAgentByContractAddress(address, chainId); }
  createAgent(agent: InsertAgent) { return agentQueries.createAgent(agent); }
  updateAgent(id: string, updates: Partial<InsertAgent>) { return agentQueries.updateAgent(id, updates); }
  deleteAgent(id: string) { return agentQueries.deleteAgent(id); }
  getAgentIdsForSitemap() { return agentQueries.getAgentIdsForSitemap(); }
  getAgentEvents(agentId: string) { return agentQueries.getAgentEvents(agentId); }
  createAgentEvent(event: InsertAgentMetadataEvent) { return agentQueries.createAgentEvent(event); }
  getEventByTxHash(txHash: string, eventType: string, chainId?: number) { return agentQueries.getEventByTxHash(txHash, eventType, chainId); }
  getEventByAgentAndTxHash(agentId: string, txHash: string, eventType: string) { return agentQueries.getEventByAgentAndTxHash(agentId, txHash, eventType); }
  getRecentEvents(limit?: number, chainId?: number) { return agentQueries.getRecentEvents(limit, chainId); }
  getAgentFeedbackSummary(agentId: string) { return agentQueries.getAgentFeedbackSummary(agentId); }
  getStats(chainId?: number) { return agentQueries.getStats(chainId); }

  // Analytics (agents table)
  getAnalyticsOverview() { return agentQueries.getAnalyticsOverview(); }
  getAnalyticsChainDistribution() { return agentQueries.getAnalyticsChainDistribution(); }
  getAnalyticsRegistrations() { return agentQueries.getAnalyticsRegistrations(); }
  getAnalyticsMetadataQuality() { return agentQueries.getAnalyticsMetadataQuality(); }
  getAnalyticsX402ByChain() { return agentQueries.getAnalyticsX402ByChain(); }
  getAnalyticsControllerConcentration() { return agentQueries.getAnalyticsControllerConcentration(); }
  getAnalyticsUriSchemes() { return agentQueries.getAnalyticsUriSchemes(); }
  getAnalyticsCategories() { return agentQueries.getAnalyticsCategories(); }
  getAnalyticsImageDomains() { return agentQueries.getAnalyticsImageDomains(); }
  getAnalyticsModels() { return agentQueries.getAnalyticsModels(); }
  getAnalyticsEndpointsCoverage() { return agentQueries.getAnalyticsEndpointsCoverage(); }
  getAnalyticsTopAgents() { return agentQueries.getAnalyticsTopAgents(); }

  // Trust scores
  getTrustScoreLeaderboard(limit?: number, chainId?: number) { return agentQueries.getTrustScoreLeaderboard(limit, chainId); }
  getTrustScoreDistribution(chainId?: number) { return agentQueries.getTrustScoreDistribution(chainId); }
  getTrustScoreStatsByChain() { return agentQueries.getTrustScoreStatsByChain(); }

  // Economy
  getEconomyOverview() { return agentQueries.getEconomyOverview(); }
  getTopX402Agents(limit?: number, chainId?: number) { return agentQueries.getTopX402Agents(limit, chainId); }
  getEndpointAnalysis() { return agentQueries.getEndpointAnalysis(); }
  getX402AdoptionByChain() { return agentQueries.getX402AdoptionByChain(); }

  // Quality + Protocol + Skills
  getQualitySummary() { return agentQueries.getQualitySummary(); }
  getQualityOffenders() { return agentQueries.getQualityOffenders(); }
  getProtocolStats() { return agentQueries.getProtocolStats(); }
  getSkillsSummary() { return agentQueries.getSkillsSummary(); }
  getSkillsChainDistribution() { return agentQueries.getSkillsChainDistribution(); }
  getSkillsTopCapabilities(limit?: number) { return agentQueries.getSkillsTopCapabilities(limit); }
  getSkillsCategoryBreakdown() { return agentQueries.getSkillsCategoryBreakdown(); }
  getSkillsTrustCorrelation() { return agentQueries.getSkillsTrustCorrelation(); }
  getSkillsOasfOverview() { return agentQueries.getSkillsOasfOverview(); }
  getSkillsNotableAgents(limit?: number) { return agentQueries.getSkillsNotableAgents(limit); }

  // === Indexer ===
  getIndexerState(chainId: number) { return indexerQueries.getIndexerState(chainId); }
  updateIndexerState(chainId: number, updates: Partial<IndexerState>) { return indexerQueries.updateIndexerState(chainId, updates); }
  logIndexerEvent(event: InsertIndexerEvent) { return indexerQueries.logIndexerEvent(event); }
  getSpamRanges(chainId: number, afterBlock: number) { return indexerQueries.getSpamRanges(chainId, afterBlock); }
  getRecentIndexerEvents(limit?: number, chainId?: number, eventType?: string) { return indexerQueries.getRecentIndexerEvents(limit, chainId, eventType); }
  getIndexerEventCounts(sinceMinutes?: number, chainId?: number) { return indexerQueries.getIndexerEventCounts(sinceMinutes, chainId); }
  recordMetricsPeriod(metrics: InsertIndexerMetric) { return indexerQueries.recordMetricsPeriod(metrics); }
  getMetricsHistory(chainId?: number, hours?: number) { return indexerQueries.getMetricsHistory(chainId, hours); }
  pruneOldEvents(olderThanDays?: number) { return indexerQueries.pruneOldEvents(olderThanDays); }
  pruneOldMetrics(olderThanDays?: number) { return indexerQueries.pruneOldMetrics(olderThanDays); }

  // === Feedback ===
  getCommunityFeedbackSources(agentId?: string, platform?: string) { return feedbackQueries.getCommunityFeedbackSources(agentId, platform); }
  createCommunityFeedbackSource(source: InsertCommunityFeedbackSource) { return feedbackQueries.createCommunityFeedbackSource(source); }
  updateCommunityFeedbackSource(id: number, updates: Partial<CommunityFeedbackSource>) { return feedbackQueries.updateCommunityFeedbackSource(id, updates); }
  getStaleSourcesForPlatform(platform: string, olderThanHours: number) { return feedbackQueries.getStaleSourcesForPlatform(platform, olderThanHours); }
  createCommunityFeedbackItem(item: InsertCommunityFeedbackItem) { return feedbackQueries.createCommunityFeedbackItem(item); }
  getCommunityFeedbackItems(agentId: string, platform?: string, itemType?: string, limit?: number) { return feedbackQueries.getCommunityFeedbackItems(agentId, platform, itemType, limit); }
  pruneOldFeedbackItems(olderThanDays: number, platform?: string) { return feedbackQueries.pruneOldFeedbackItems(olderThanDays, platform); }
  getCommunityFeedbackSummary(agentId: string) { return feedbackQueries.getCommunityFeedbackSummary(agentId); }
  upsertCommunityFeedbackSummary(agentId: string, data: Partial<InsertCommunityFeedbackSummary>) { return feedbackQueries.upsertCommunityFeedbackSummary(agentId, data); }
  getAgentsWithCommunityFeedback(limit?: number, offset?: number) { return feedbackQueries.getAgentsWithCommunityFeedback(limit, offset); }
  getCommunityFeedbackSummariesByAgentIds(agentIds: string[]) { return feedbackQueries.getCommunityFeedbackSummariesByAgentIds(agentIds); }
  getCommunityFeedbackStats() { return feedbackQueries.getCommunityFeedbackStats(); }

  // === Analytics (probes, transactions, bazaar, status) ===
  createProbeResult(probe: InsertX402Probe) { return analyticsQueries.createProbeResult(probe); }
  getProbeResults(agentId?: string, limit?: number) { return analyticsQueries.getProbeResults(agentId, limit); }
  getProbeStats() { return analyticsQueries.getProbeStats(); }
  getAgentsWithPaymentAddresses() { return analyticsQueries.getAgentsWithPaymentAddresses(); }
  getStaleProbeAgentIds(olderThanHours: number) { return analyticsQueries.getStaleProbeAgentIds(olderThanHours); }
  getRecentProbeForEndpoint(agentId: string, endpointUrl: string) { return analyticsQueries.getRecentProbeForEndpoint(agentId, endpointUrl); }
  createTransaction(tx: InsertAgentTransaction) { return analyticsQueries.createTransaction(tx); }
  getTransactions(options?: { agentId?: string; limit?: number; offset?: number }) { return analyticsQueries.getTransactions(options); }
  getTransactionStats() { return analyticsQueries.getTransactionStats(); }
  getAgentTransactionStats(agentId: string) { return analyticsQueries.getAgentTransactionStats(agentId); }
  getTopEarningAgents(limit?: number) { return analyticsQueries.getTopEarningAgents(limit); }
  getTransactionVolume(period: string) { return analyticsQueries.getTransactionVolume(period); }
  getTransactionSyncState(address: string, chainId: number) { return analyticsQueries.getTransactionSyncState(address, chainId); }
  upsertTransactionSyncState(address: string, chainId: number, block: number) { return analyticsQueries.upsertTransactionSyncState(address, chainId, block); }
  getMostRecentSyncTime() { return analyticsQueries.getMostRecentSyncTime(); }
  getKnownPaymentAddresses() { return analyticsQueries.getKnownPaymentAddresses(); }
  getStatusSummary() { return analyticsQueries.getStatusSummary(); }

  // Bazaar
  upsertBazaarService(data: InsertBazaarService) { return analyticsQueries.upsertBazaarService(data); }
  upsertBazaarServices(data: InsertBazaarService[]) { return analyticsQueries.upsertBazaarServices(data); }
  markBazaarServicesInactive(seenCutoff: Date) { return analyticsQueries.markBazaarServicesInactive(seenCutoff); }
  getBazaarServices(opts?: any) { return analyticsQueries.getBazaarServices(opts); }
  getBazaarStats() { return analyticsQueries.getBazaarStats(); }
  getBazaarSnapshots(limit?: number) { return analyticsQueries.getBazaarSnapshots(limit); }
  createBazaarSnapshot(data: InsertBazaarSnapshot) { return analyticsQueries.createBazaarSnapshot(data); }
  getBazaarTopServices(limit?: number) { return analyticsQueries.getBazaarTopServices(limit); }
}

export const storage = new DatabaseStorage();
```

- [ ] **Step 2: Verify type check**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

Expected: Clean. If there are type mismatches between IStorage and the delegated functions, fix the function signatures in the sub-files to match IStorage exactly.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npm test
```

Expected: Same 149 tests passing.

- [ ] **Step 4: Commit**

```bash
cd /Users/ethserver/CLAUDE/trustadd && git add server/storage.ts server/storage/ && git commit -m "refactor: split storage.ts into 4 domain query files (ADR-1 item 5)

storage.ts (2,584 LOC) → IStorage interface + thin delegator + 4 sub-files:
- storage/agents.ts: agent CRUD, events, analytics, quality, skills, protocol (~1500 LOC)
- storage/indexer.ts: indexer state, events, metrics (~100 LOC)
- storage/feedback.ts: community feedback sources, items, summaries (~110 LOC)
- storage/analytics.ts: probes, transactions, bazaar, status (~530 LOC)

agents.ts is larger than ADR-1 estimated (~600) because ~70% of queries
hit the agents table (analytics, quality, skills, protocol all query agents).
The split is table-aligned — each sub-file owns its table group.

IStorage interface unchanged. DatabaseStorage delegates to sub-file functions.
149 tests passing before and after."
```

---

## Task 13: Set Up Drizzle-Kit Versioned Migrations + Commit

**Files:**
- Read: `drizzle.config.ts` (already exists, outputs to `./migrations/`)
- Create: `migrations/` directory + generated SQL files

- [ ] **Step 1: Generate initial migration snapshot**

The `drizzle.config.ts` already exists and points to `./migrations/` output directory. Run the generate command with the DATABASE_URL from the environment:

`drizzle-kit generate` only reads the schema file — it does NOT connect to the DB. However, `drizzle.config.ts` unconditionally throws if `DATABASE_URL` is unset. Provide a dummy value:

```bash
cd /Users/ethserver/CLAUDE/trustadd && DATABASE_URL=postgresql://x:x@localhost/x npx drizzle-kit generate
```

If that fails (e.g., drizzle-kit tries to connect), use the real URL from Vercel:
```bash
cd /Users/ethserver/CLAUDE/trustadd && npx vercel env pull .env.local --environment production && source .env.local && npx drizzle-kit generate && rm .env.local
```

Expected: Creates `migrations/XXXX_*.sql` file(s) — a snapshot of the current schema as SQL DDL.

- [ ] **Step 2: Verify the generated migration file exists**

```bash
ls /Users/ethserver/CLAUDE/trustadd/migrations/
```

Expected: At least one `.sql` file and a `meta/` directory with journal metadata.

- [ ] **Step 3: Remove `db:push` script from package.json**

Edit `package.json` to remove the `"db:push": "drizzle-kit push"` script. Replace with:
```json
"db:generate": "drizzle-kit generate"
```

- [ ] **Step 4: Commit**

```bash
cd /Users/ethserver/CLAUDE/trustadd && git add migrations/ drizzle.config.ts package.json && git commit -m "chore: add drizzle-kit versioned migrations (ADR-1 item 7)

Generated initial migration snapshot from current schema.
Replaced db:push script with db:generate for reviewable migration files.
Migration SQL files are committed for PR review; application is via
Supabase MCP apply_migration or SQL editor (trustadd_app user can't
run DDL directly via drizzle-kit push)."
```

---

## Task 14: Add Sentry to Express Error Handler + Commit

**Files:**
- Modify: `api/[...path].ts` lines 104-112 (error handler middleware)

- [ ] **Step 1: Add Sentry import and capture to `api/[...path].ts`**

Add import at line 2 (after the existing imports):
```ts
import * as Sentry from "@sentry/node";
```

In the error handler middleware (line 104-112), add `Sentry.captureException(err)` right after the `errLog.error(...)` call:

Change this block:
```ts
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    errLog.error(`API Error: ${err.message}`, { status, stack: err.stack?.split("\n").slice(0, 3).join("\n") });
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
```

To:
```ts
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    errLog.error(`API Error: ${err.message}`, { status, stack: err.stack?.split("\n").slice(0, 3).join("\n") });
    Sentry.captureException(err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
```

Note: `@sentry/node` is already in `package.json` dependencies (`^10.47.0`). Sentry initializes itself via the `SENTRY_DSN` environment variable — no explicit `Sentry.init()` call is needed because `@sentry/node@10` auto-initializes from env vars.

- [ ] **Step 2: Verify type check**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npm test
```

Expected: 149 tests passing (Sentry change doesn't affect test behavior — no SENTRY_DSN in test env means Sentry is a no-op).

- [ ] **Step 4: Commit**

```bash
cd /Users/ethserver/CLAUDE/trustadd && git add api/\[...path\].ts && git commit -m "feat: add Sentry error capture to Express error handler (ADR-1 item 9)

Import @sentry/node and call Sentry.captureException(err) in the
Express error middleware in api/[...path].ts. @sentry/node@10 auto-
initializes from SENTRY_DSN env var (already set in Vercel production).
Previously Sentry only captured Trigger.dev task failures."
```

---

## Final Verification

After all tasks complete:

- [ ] **Run full test suite one final time**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npm test
```

Expected: 149 tests passing.

- [ ] **Type check**

```bash
cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit
```

Expected: Clean.

- [ ] **Verify git log shows 4 clean commits**

```bash
cd /Users/ethserver/CLAUDE/trustadd && git log --oneline -5
```

Expected commits (newest first):
1. `feat: add Sentry error capture...`
2. `chore: add drizzle-kit versioned migrations...`
3. `refactor: split storage.ts into 4 domain query files...`
4. `refactor: split routes.ts into 5 domain route files...`

- [ ] **Update ADR-1 spec to mark items complete**

Edit `docs/superpowers/specs/2026-04-13-architecture-adr1-fortify.md` and mark items 4, 5, 7, 9 as `[x]`.
