# Top Trusted Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore trust-based agent ranking on the homepage and directory, using verdict-only data (no score leakage).

**Architecture:** Unblock the existing `trust-score` sort in the `/api/agents` route handler (storage layer already supports it, redaction already strips scores). Switch the homepage "Top Trusted" section to the dedicated `/api/trust-scores/top` endpoint. Add "Top Trusted" sort option to directory UI.

**Tech Stack:** TypeScript, React, TanStack Query, Express, Drizzle ORM

**Spec:** `docs/superpowers/specs/2026-04-13-top-trusted-agents-design.md`

---

### Task 1: Unblock `trust-score` sort in API route

**Files:**
- Modify: `server/routes.ts:187-189`

- [ ] **Step 1: Remove the trust-score sort remap**

In `server/routes.ts`, replace the sort handling at lines 187-189:

```ts
// Before (lines 187-189):
// "trust-score" sort is no longer available on the free tier — fall back to "newest"
const rawSort = req.query.sort as string | undefined;
const sort = rawSort === "trust-score" ? "newest" as const : rawSort as "newest" | "oldest" | "name" | undefined;

// After:
const sort = req.query.sort as "newest" | "oldest" | "trust-score" | "name" | undefined;
```

- [ ] **Step 2: Verify redaction is intact**

Confirm that `redactAgentForPublic()` (defined earlier in the same file) still strips `trustScore`, `trustScoreBreakdown`, `trustScoreUpdatedAt`, `qualityTier`, `spamFlags`, and `lifecycleStatus`. No changes needed — just verify by reading `server/routes.ts:44-70`.

- [ ] **Step 3: Test manually**

Run: `npm run dev`

Then in a separate terminal:
```bash
curl -s "http://localhost:5000/api/agents?limit=3&sort=trust-score" | jq '.agents[] | {name, verdict, trustScore}'
```

Expected: Each agent shows `name`, `verdict` (string), and `trustScore: null` (stripped by redaction). Agents should be ordered by trust score descending (highest-verdict agents first).

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "feat: unblock trust-score sort on /api/agents endpoint"
```

---

### Task 2: Enrich `/api/trust-scores/top` endpoint with card-display fields

The `getTrustScoreLeaderboard` query in `server/storage.ts:1229-1247` only SELECTs `{id, name, imageUrl, chainId, trustScore, trustScoreBreakdown, slug}`. The `AgentCard` component needs `primaryContractAddress` (avatar color + address badge), `erc8004Id` (fallback name), `description`, `x402Support`, and `endpoints`. The verdict computation also needs `qualityTier`, `spamFlags`, and `lifecycleStatus`.

**Files:**
- Modify: `server/storage.ts:1229-1247`
- Modify: `server/routes.ts:862-877`

- [ ] **Step 1: Add columns to `getTrustScoreLeaderboard` in storage.ts**

In `server/storage.ts`, update the method signature and SELECT (lines 1229-1246):

```ts
// Before:
async getTrustScoreLeaderboard(limit = 20, chainId?: number): Promise<Array<{ id: string; name: string | null; imageUrl: string | null; chainId: number; trustScore: number; trustScoreBreakdown: any; slug: string | null }>> {
    const conditions = [isNotNull(agents.trustScore)];
    if (chainId) conditions.push(eq(agents.chainId, chainId));

    const rows = await db.select({
      id: agents.id,
      name: agents.name,
      imageUrl: agents.imageUrl,
      chainId: agents.chainId,
      trustScore: agents.trustScore,
      trustScoreBreakdown: agents.trustScoreBreakdown,
      slug: agents.slug,
    }).from(agents)
      .where(and(...conditions))
      .orderBy(sql`${agents.trustScore} DESC`)
      .limit(Math.min(limit, 100));

    return rows.map(r => ({ ...r, trustScore: r.trustScore! }));
  }

// After:
async getTrustScoreLeaderboard(limit = 20, chainId?: number): Promise<Array<{ id: string; name: string | null; imageUrl: string | null; chainId: number; trustScore: number; trustScoreBreakdown: any; slug: string | null; primaryContractAddress: string; erc8004Id: number; description: string | null; x402Support: boolean | null; endpoints: any; qualityTier: string | null; spamFlags: string[] | null; lifecycleStatus: string | null }>> {
    const conditions = [isNotNull(agents.trustScore)];
    if (chainId) conditions.push(eq(agents.chainId, chainId));

    const rows = await db.select({
      id: agents.id,
      name: agents.name,
      imageUrl: agents.imageUrl,
      chainId: agents.chainId,
      trustScore: agents.trustScore,
      trustScoreBreakdown: agents.trustScoreBreakdown,
      slug: agents.slug,
      primaryContractAddress: agents.primaryContractAddress,
      erc8004Id: agents.erc8004Id,
      description: agents.description,
      x402Support: agents.x402Support,
      endpoints: agents.endpoints,
      qualityTier: agents.qualityTier,
      spamFlags: agents.spamFlags,
      lifecycleStatus: agents.lifecycleStatus,
    }).from(agents)
      .where(and(...conditions))
      .orderBy(sql`${agents.trustScore} DESC`)
      .limit(Math.min(limit, 100));

    return rows.map(r => ({ ...r, trustScore: r.trustScore! }));
  }
```

Also update the matching interface declaration in `IStorage` (line 137) to match:

```ts
// Before:
getTrustScoreLeaderboard(limit?: number, chainId?: number): Promise<Array<{ id: string; name: string | null; imageUrl: string | null; chainId: number; trustScore: number; trustScoreBreakdown: any }>>;

// After:
getTrustScoreLeaderboard(limit?: number, chainId?: number): Promise<Array<{ id: string; name: string | null; imageUrl: string | null; chainId: number; trustScore: number; trustScoreBreakdown: any; slug: string | null; primaryContractAddress: string; erc8004Id: number; description: string | null; x402Support: boolean | null; endpoints: any; qualityTier: string | null; spamFlags: string[] | null; lifecycleStatus: string | null }>>;
```

- [ ] **Step 2: Update the route handler to include card-display fields**

In `server/routes.ts`, update the redacted mapping in the `/api/trust-scores/top` handler (around line 868):

```ts
// Before:
const redacted = (leaderboard as any[]).map((entry: any) => ({
  id: entry.id,
  name: entry.name,
  slug: entry.slug,
  chainId: entry.chainId,
  imageUrl: entry.imageUrl,
  verdict: verdictFor(entry.trustScore ?? null, entry.qualityTier ?? null, entry.spamFlags ?? null, entry.lifecycleStatus ?? null),
}));

// After:
const redacted = (leaderboard as any[]).map((entry: any) => ({
  id: entry.id,
  name: entry.name,
  slug: entry.slug,
  chainId: entry.chainId,
  imageUrl: entry.imageUrl,
  primaryContractAddress: entry.primaryContractAddress,
  erc8004Id: entry.erc8004Id,
  description: entry.description,
  x402Support: entry.x402Support,
  endpoints: entry.endpoints,
  verdict: verdictFor(entry.trustScore ?? null, entry.qualityTier ?? null, entry.spamFlags ?? null, entry.lifecycleStatus ?? null),
}));
```

- [ ] **Step 3: Test the enriched endpoint**

```bash
curl -s "http://localhost:5000/api/trust-scores/top?limit=2" | jq '.[0] | keys'
```

Expected keys: `chainId`, `description`, `endpoints`, `erc8004Id`, `id`, `imageUrl`, `name`, `primaryContractAddress`, `slug`, `verdict`, `x402Support`. Must NOT include `trustScore`, `trustScoreBreakdown`, `qualityTier`, `spamFlags`, `lifecycleStatus`.

- [ ] **Step 4: Commit**

```bash
git add server/storage.ts server/routes.ts
git commit -m "feat: enrich trust-scores/top endpoint with card-display fields"
```

---

### Task 3: Switch homepage "Top Trusted" to use `/api/trust-scores/top`

**Files:**
- Modify: `client/src/pages/landing.tsx:38-41, 56`

- [ ] **Step 1: Replace the top-agents query**

In `client/src/pages/landing.tsx`, replace the top-agents query (lines 38-41):

```ts
// Before:
const { data: topData, isLoading: topLoading } = useQuery<AgentsResponse>({
  queryKey: ["/api/agents", { limit: 10, sort: "newest" }],
  queryFn: () => fetch("/api/agents?limit=10&sort=newest").then((r) => r.json()),
});

// After:
const { data: topData, isLoading: topLoading } = useQuery<AgentWithVerdict[]>({
  queryKey: ["/api/trust-scores/top", { limit: 10 }],
  queryFn: () => fetch("/api/trust-scores/top?limit=10").then((r) => r.json()),
});
```

- [ ] **Step 2: Update the topAgents derivation**

Replace the `topAgents` derivation (line 56):

```ts
// Before:
const topAgents = topData?.agents ?? [];

// After:
const topAgents = topData ?? [];
```

- [ ] **Step 3: Test manually**

With `npm run dev` running, open `http://localhost:5000` in a browser. The "Top Trusted Agents" section should show agents ordered by trust ranking with TRUSTED verdict agents appearing first. Compare with "Recently Discovered" — the two lists should now show different agents and different ordering.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/landing.tsx
git commit -m "feat: homepage top trusted agents use trust-score ranking"
```

---

### Task 4: Add "Top Trusted" sort option to directory

**Files:**
- Modify: `client/src/pages/directory.tsx:23-24, 38-42, 47, 82-89, 107-111`

- [ ] **Step 1: Update `SortState` type and options**

In `client/src/pages/directory.tsx`, update the type and options:

```ts
// Before (line 24):
type SortState = "newest" | "oldest" | "name";

// After:
type SortState = "newest" | "oldest" | "name" | "trust-score";
```

```ts
// Before (lines 38-42):
const SORT_OPTIONS: { key: SortState; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "name", label: "Name" },
];

// After:
const SORT_OPTIONS: { key: SortState; label: string }[] = [
  { key: "trust-score", label: "Top Trusted" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "name", label: "Name" },
];
```

- [ ] **Step 2: Change default sort to `"trust-score"`**

```ts
// Before (line 47):
const [sort, setSort] = useState<SortState>("newest");

// After:
const [sort, setSort] = useState<SortState>("trust-score");
```

- [ ] **Step 3: Update `activeFilterCount` logic**

The active filter count checks `sort !== "newest"` — update it to use the new default:

```ts
// Before (in activeFilterCount useMemo, around line 87):
if (sort !== "newest") count++;

// After:
if (sort !== "trust-score") count++;
```

- [ ] **Step 4: Update `activeChipFilters` logic**

Same change in the chip filters useMemo (around line 108):

```ts
// Before:
if (sort !== "newest") {

// After:
if (sort !== "trust-score") {
```

- [ ] **Step 5: Test manually**

With `npm run dev` running, open `http://localhost:5000/agents`. The directory should:
- Default to "Top Trusted" sort (button should be active/selected)
- Show agents ordered by trust ranking (TRUSTED agents first)
- No filter badge showing by default
- Switching to "Newest" should show the filter badge and reorder agents

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/directory.tsx
git commit -m "feat: add top-trusted sort to agent directory, make it default"
```

---

### Task 5: Update content zones text

**Files:**
- Modify: `client/src/lib/content-zones.ts:78`

- [ ] **Step 1: Update the "View leaderboard" link text**

```ts
// Before (line 78):
viewAll: "View leaderboard",

// After:
viewAll: "View all agents",
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/content-zones.ts
git commit -m "fix: update top trusted CTA text from leaderboard to view all agents"
```

---

### Task 6: Final verification

- [ ] **Step 1: Verify homepage**

Open `http://localhost:5000`. Confirm:
- "Top Trusted Agents" shows agents with TRUSTED verdicts first
- "Recently Discovered" shows different agents sorted by newest
- "View all agents" link goes to `/agents`

- [ ] **Step 2: Verify directory**

Open `http://localhost:5000/agents`. Confirm:
- Default sort is "Top Trusted" (button highlighted)
- Agents ordered by trust ranking
- Switching sort options works
- Pagination works with trust-score sort

- [ ] **Step 3: Verify no score leakage**

```bash
curl -s "http://localhost:5000/api/agents?limit=1&sort=trust-score" | jq '.agents[0] | keys'
```

Confirm the response does NOT include: `trustScore`, `trustScoreBreakdown`, `trustScoreUpdatedAt`, `qualityTier`, `spamFlags`, `lifecycleStatus`.

Confirm it DOES include: `verdict`, `reportAvailable`.
