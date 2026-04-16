# MPP Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unblock the MPP integration shipped on `feat/mpp-integration` for production launch under Path A (MPP invisible to scoring), build out the `/mpp` analytics page from its current stub into a production-grade dashboard, and execute a gated rollout that turns each flag on only after observing the previous flag's effect.

**Architecture:** This plan is *not* introducing new infrastructure — 3 Trigger.dev tasks, 3 DB tables, 10 public + 3 admin API endpoints, and the Tempo chain indexer already exist on branch `feat/mpp-integration` (19 commits ahead of `feat/methodology-v2-backend`, all feature-flagged off, 279/279 tests green). The plan is split into three phases: (A) fix three pre-launch correctness blockers — primarily a placeholder pathUSD address that would cause the Tempo indexer to silently scan an empty contract — then (B) expand the `/mpp` page stub into a real analytics dashboard mirroring `/bazaar`'s patterns (hero, KPIs, charts, filterable directory table, multi-protocol callout), then (C) sequence production env vars + flag flips so each stage is observable and reversible. Scoring engine, `METHODOLOGY_VERSION`, trust-report schema, agent-profile MPP badges, and Phase 3 sybil cross-referencing are explicitly out of scope per `docs/roadmap-mpp.md` §1.

**Tech Stack:** TypeScript strict, Drizzle ORM, Express + Vite, Trigger.dev v4 (`@trigger.dev/sdk/v3` imports), Vitest, TanStack Query v5, Shadcn UI + Recharts, wouter. Git author must be `All The New <admin@allthenew.com>` (Vercel Hobby requirement). Trigger.dev task files must use dynamic `import()` for every `../server/` and `../shared/` module inside `run`. All relative ESM imports use `.js` extensions.

**Spec:** `docs/superpowers/specs/2026-04-15-mpp-integration-design.md`
**Roadmap:** `docs/roadmap-mpp.md`
**Predecessor plan (shipped):** `docs/superpowers/plans/2026-04-15-mpp-integration.md`

---

## File Structure

This plan produces **no new backend files**. All new content is in the frontend dashboard, a small set of fixes to existing files, and one launch runbook.

### Modified

Backend / shared / fixtures:
- `shared/chains.ts` — replace placeholder pathUSD address with real deployed address
- `__tests__/fixtures/tempo-logs.ts` — update `address` field in 2 fixtures to match
- `__tests__/fixtures/mpp-challenges.ts` — fix malformed currency address + re-encode base64url `request` field

Frontend:
- `client/src/pages/mpp.tsx` — expand from stub (~110 lines) to full analytics page (~500 lines mirroring `bazaar.tsx`)
- `client/src/components/header.tsx` — add `/mpp` link to the Analytics dropdown (gated by `VITE_ENABLE_MPP_UI`)
- `client/src/lib/content-zones.ts` — add `MPP.dashboard.*` copy keys; add launch sentence to `METHODOLOGY.ecosystemNotice` (one-line addition after v2 launch)

### New

Launch doc:
- `docs/superpowers/runbooks/2026-04-16-mpp-launch.md` — step-by-step flag-flip runbook with verification commands (so launch is reproducible and reviewable independently of this plan)

### NOT modified

- `server/trust-score.ts`, `server/trust-provenance.ts`, `server/trust-report-compiler.ts` — **DO NOT TOUCH** (Path A = scoring unchanged)
- `server/trust-methodology.ts`, `METHODOLOGY_VERSION` — **DO NOT BUMP** (provenance hashes must remain valid)
- `client/src/pages/methodology.tsx`, `client/src/pages/agent-profile.tsx` — **DO NOT ADD MPP SIGNALS** (Phase 3 only)
- `shared/schema.ts` — schema already shipped; no additions for launch
- No new Trigger.dev tasks — the 3 existing MPP tasks are sufficient for Phase 1+2
- No new API endpoints — the 10 public + 3 admin endpoints are sufficient; the dashboard consumes what exists

---

## Critical Constraints (read before every task)

1. **Git author:** Every commit must use `All The New <admin@allthenew.com>`. Configure once with `git config user.name "All The New" && git config user.email "admin@allthenew.com"` inside the worktree if not already set.
2. **Dynamic imports in `trigger/`:** No touching any `trigger/*.ts` in this plan — if a new task ever becomes necessary, `import()` every `../server/` and `../shared/` module inside `run`.
3. **ESM `.js` extensions:** All relative imports in server + shared + tests must end with `.js`, even when the source file is `.ts`.
4. **`trustadd_app` DB user:** Has DML only, not DDL. Schema migration already applied to Supabase project `agfyfdhvgekekliujoxc` on the prior plan — do not re-run it.
5. **Worktree:** `/Users/ethserver/CLAUDE/trustadd/.worktrees/mpp-integration`. Run all commands from there. Branch `feat/mpp-integration` is the target; PR base should be `main` (rationale in Task 18 below).
6. **No new migrations in this plan.** `migrations/0002_mpp_integration.sql` already landed.
7. **Feature flags remain OFF** for all UI-layer tasks (Tasks 3–14). The dashboard must render correctly when every endpoint returns 404 because `ENABLE_MPP_UI=false` in production. Test empty/loading states explicitly.
8. **Verification cadence:** After every task touching code, run `npm test` and `npx tsc --noEmit` (latter scoped to MPP/Tempo files where noted). Both must stay green.

---

## Phase A — Pre-launch blockers (Tasks 1–3)

### Task 1: Fix placeholder pathUSD contract address

**Why this matters:** `shared/chains.ts:272` declares `TEMPO_CHAIN_CONFIG.tokens.pathUSD.address = "0x20c0000000000000000000000000000000000000"` (40 zero bytes after `20c0` = 20-byte placeholder). The Tempo indexer calls `eth_getLogs` filtered by this address, so every query matches zero logs. Without this fix, turning on `ENABLE_MPP_INDEXER=true` would produce silent no-op runs with no errors for hours. The real mainnet address per the research report (`~/Desktop/TrustAdd Misc/trustadd-mpp-research-report.md` line 64) is `0x20c000000000000000000000b9537d11c60e8b50`.

**Files:**
- Modify: `shared/chains.ts:272`
- Modify: `__tests__/fixtures/tempo-logs.ts:8` (`TEMPO_TRANSFER_LOG.address`)
- Modify: `__tests__/fixtures/tempo-logs.ts:26` (`TEMPO_TRANSFER_WITH_MEMO_LOG.address`)
- Modify: `__tests__/fixtures/mpp-challenges.ts:13` (currency inside `SINGLE_TEMPO_CHARGE.expected.request`) — the existing value `0x20c0000000000000000000000000000000000000000` has 41 trailing chars after `20c0` (total 43 hex chars + `0x` = invalid, not 40). Replace both the `expected.request.currency` string AND re-encode the base64url `request` field in `SINGLE_TEMPO_CHARGE.header`.

- [ ] **Step 1: Verify the real address against current Tempo docs before patching**

The research report was generated from docs snapshotted weeks ago. Verify the address hasn't changed:

```bash
# Option A: curl the public RPC for code at the address; non-"0x" response = deployed
curl -s https://rpc.tempo.xyz \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["0x20c000000000000000000000b9537d11c60e8b50","latest"]}'
# Expected: "result" field is a long hex string starting with 0x60 (bytecode), not "0x"

# Option B: hit explore.mainnet.tempo.xyz in a browser and search for pathUSD
```

If the address differs from what the report shows, STOP and ask the user before proceeding — this is a data-correctness decision, not a code-style decision.

- [ ] **Step 2: Update `shared/chains.ts:272`**

Replace:

```ts
    pathUSD: {
      address: "0x20c0000000000000000000000000000000000000",
      symbol: "pathUSD",
      decimals: 6,
    },
```

with:

```ts
    pathUSD: {
      address: "0x20c000000000000000000000b9537d11c60e8b50",
      symbol: "pathUSD",
      decimals: 6,
    },
```

- [ ] **Step 3: Update the two fixture `address` fields in `__tests__/fixtures/tempo-logs.ts`**

Both lines 8 and 26 currently read:

```ts
  address: "0x20c0000000000000000000000000000000000000",
```

Change both to:

```ts
  address: "0x20c000000000000000000000b9537d11c60e8b50",
```

The `decodeTransferLog` implementation ignores the `address` field (it uses topics + data only), so test assertions are unchanged — but the fixture should describe real Tempo log shape.

- [ ] **Step 4: Fix the `mpp-challenges.ts` fixture — decode, update, re-encode**

Open `__tests__/fixtures/mpp-challenges.ts`. The `SINGLE_TEMPO_CHARGE` fixture has two problems:

1. Line 13: `currency: "0x20c0000000000000000000000000000000000000000"` has **43 characters** after `0x` — an invalid 21.5-byte address.
2. Line 5: the base64url `request="eyJhbW91..."` payload encodes this same broken address.

First, decode the current base64 to confirm:

```bash
node -e 'console.log(Buffer.from("eyJhbW91bnQiOiIwLjAxIiwiY3VycmVuY3kiOiIweDIwYzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCJyZWNpcGllbnQiOiIweDEyMzRhYmNkMTIzNGFiY2QxMjM0YWJjZDEyMzRhYmNkMTIzNGFiY2QifQ", "base64url").toString())'
# Expected: {"amount":"0.01","currency":"0x20c00000000000000000000000000000000000000","recipient":"0x1234abcd1234abcd1234abcd1234abcd1234abcd"}
```

Then generate the corrected base64url for the real address:

```bash
node -e '
const obj = {
  amount: "0.01",
  currency: "0x20c000000000000000000000b9537d11c60e8b50",
  recipient: "0x1234abcd1234abcd1234abcd1234abcd1234abcd"
};
console.log(Buffer.from(JSON.stringify(obj)).toString("base64url"));
'
# Copy the resulting base64url string
```

Replace lines 5–16 in `__tests__/fixtures/mpp-challenges.ts`:

```ts
export const SINGLE_TEMPO_CHARGE = {
  header: `Payment id="abc123", realm="api.example.com", method="tempo", intent="charge", request="<PASTE_NEW_BASE64URL_HERE>"`,
  expected: {
    id: "abc123",
    realm: "api.example.com",
    method: "tempo",
    intent: "charge",
    request: {
      amount: "0.01",
      currency: "0x20c000000000000000000000b9537d11c60e8b50",
      recipient: "0x1234abcd1234abcd1234abcd1234abcd1234abcd",
    },
  },
};
```

- [ ] **Step 5: Run tests to verify nothing regressed**

```bash
npm test -- __tests__/mpp-auth-header.test.ts __tests__/tempo-log-decoder.test.ts
```

Expected: all pass. If the `mpp-auth-header.test.ts` parser test fails with a currency mismatch, the base64url payload wasn't re-encoded correctly — re-run Step 4's node command and paste again.

- [ ] **Step 6: Run full test suite + type-check**

```bash
npm test
npx tsc --noEmit
```

Expected: 279/279 tests pass, zero TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add shared/chains.ts __tests__/fixtures/tempo-logs.ts __tests__/fixtures/mpp-challenges.ts
git commit -m "fix(mpp): use real pathUSD mainnet contract address

The placeholder 0x20c0...0000 (40 zeros) was a design-spec stand-in that
would have caused eth_getLogs to silently match zero transfers on
production Tempo. Replace with the deployed mainnet address
0x20c000000000000000000000b9537d11c60e8b50 in both the chain config
and the two log fixtures that reference it, and fix a related
malformed address in mpp-challenges.ts (re-encoding the base64url
request payload to match)."
```

---

### Task 2: Resolve `TEMPO_PATHUSD_DEPLOYMENT_BLOCK` and document as launch prerequisite

**Why this matters:** `TEMPO_CHAIN_CONFIG.deploymentBlock` defaults to 0 when `TEMPO_PATHUSD_DEPLOYMENT_BLOCK` is unset (`shared/chains.ts:277`). `syncAllTempoTransactions` uses `Math.max(state.lastSyncedBlock + 1, deploymentBlock)` as the starting block — so the first run for every tracked address will scan from block 0 to head, paginated in 10K-block windows. For a fast chain with sub-second finality that's launched weeks ago, this is potentially hundreds of thousands of RPC calls. We want to set `TEMPO_PATHUSD_DEPLOYMENT_BLOCK` as a Trigger.dev env var before flipping `ENABLE_MPP_INDEXER=true`.

This task is **discovery + documentation**, not code changes. The resolved block number goes into the Task 16 env-var list and the runbook.

**Files:**
- Modify: `docs/superpowers/runbooks/2026-04-16-mpp-launch.md` (new file — see Task 15)

- [ ] **Step 1: Binary-search via the Tempo explorer first**

Open `https://explore.mainnet.tempo.xyz` in a browser, search for the contract `0x20c000000000000000000000b9537d11c60e8b50`, and read the "Contract Creation" row or earliest-tx row — that block is the answer. Record it.

If the explorer doesn't expose creation block directly, fall back to Step 2.

- [ ] **Step 2: RPC-based binary search fallback**

Run a shrinking-window `eth_getLogs` probe. This must be done via `curl` — not via the running app — so it doesn't require flipping flags:

```bash
# Get current head block
curl -s https://rpc.tempo.xyz \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
  | jq -r '.result' | python3 -c 'import sys; print(int(sys.stdin.read().strip(), 16))'
# e.g. 5_234_712

# Probe from an assumed lower bound (say block 0) up to the known Transfer topic.
# For speed, try halving windows and check if ANY logs exist.
# Repeat this curl with fromBlock/toBlock set to shrinking ranges until you find the first Transfer log:
curl -s https://rpc.tempo.xyz \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{
      "address":"0x20c000000000000000000000b9537d11c60e8b50",
      "topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
      "fromBlock":"0x0","toBlock":"0x2710"
    }]
  }' | jq '.result | length'
```

Start with windows of 10_000 blocks, halve until you find the window containing the first log, then inspect `blockNumber` of the earliest entry.

- [ ] **Step 3: Record the block number in the runbook**

Open `docs/superpowers/runbooks/2026-04-16-mpp-launch.md` (created in Task 15). Under "Trigger.dev environment variables", replace the placeholder `<RESOLVE_IN_TASK_2>` with the resolved block number, prefixed with a one-line comment `# Resolved 2026-04-16 via <method>: <url or command>`.

- [ ] **Step 4: Commit the runbook update**

Defer to Task 15's commit — the runbook is created there, and Task 2's output is a value to paste into it, not a standalone commit. Note the resolved value in your scratchpad and move on.

---

### Task 3: Verify `TRANSFER_WITH_MEMO_TOPIC` and Tempo RPC reachability

**Why this matters:** Two remaining launch-gating unknowns.
1. `server/tempo-transaction-indexer.ts:26` falls back to `null` when `TEMPO_TRANSFER_WITH_MEMO_TOPIC` is unset, and the indexer skips memo decoding in that case. Launch is acceptable with memo decoding disabled (no user-facing memo copy yet) — but we should confirm this is an intentional defer, not a silently-missing feature.
2. We've never called Tempo RPC from Vercel serverless or Trigger.dev workers. Egress networking differs from local dev (e.g. IPv6-only endpoints, geographic restrictions on some public RPCs).

**Files:** None modified. This task is verification-only.

- [ ] **Step 1: Confirm Tempo RPC reachability from a Trigger.dev worker**

Use the admin endpoint already in place (`POST /api/admin/mpp/index-tempo`) as a manual smoke test — BUT this requires `ENABLE_MPP_UI=true` on Vercel, which we don't flip yet. So instead, verify from the deployed Vercel serverless runtime via an ad-hoc probe at a URL we will not ship:

```bash
# On your dev machine, run a one-shot RPC reachability test — does NOT exercise Trigger.dev
curl -s -o /dev/null -w 'HTTP %{http_code} | %{time_total}s\n' \
  -X POST https://rpc.tempo.xyz \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
# Expected: HTTP 200 | < 2s. Body should decode as {"result":"0x1089"} (0x1089 = 4217).
```

If this succeeds from dev, assume Vercel + Trigger.dev can reach it (both are standard outbound HTTPS). If it fails or is slow, document in the runbook and plan to set `TEMPO_RPC_URL_FALLBACK` to QuickNode (research report §Managed RPC providers).

- [ ] **Step 2: Decide memo topic policy**

For launch: **leave `TEMPO_TRANSFER_WITH_MEMO_TOPIC` unset.** The indexer will skip `TransferWithMemo` events but continue decoding standard `Transfer` events. This is fine for Phase 1+2 since no UI element currently surfaces memos. Record this decision in the runbook under "Known launch-scope deferrals".

If a specific topic hash is discovered during Step 1 (e.g. from Tempo's published ABI), record it in the runbook as an optional env var to set later. Do not add it to Trigger.dev for this launch.

- [ ] **Step 3: Note in scratchpad for runbook inclusion (Task 15)**

No commit here — results feed into the Task 15 runbook commit.

---

## Phase B — MPP Analytics page build-out (Tasks 4–14)

All tasks in this phase produce frontend-only changes. Feature flags stay OFF. Each task assumes `/api/mpp/*` endpoints return 404 in production AND the dev server (since local dev also defaults to `ENABLE_MPP_UI=false` unless you set it). Two ways to exercise locally:

```bash
# One-off dev server with MPP on
ENABLE_MPP_UI=true VITE_ENABLE_MPP_UI=true npm run dev
```

Every task verifies both the "with data" path AND the "no data / flag off" empty state.

---

### Task 4: Extract shared MPP page primitives into file structure

**Why this matters:** The stub `mpp.tsx` has a single default-export function with inline layout. The `/bazaar` page uses small, focused helpers (`KpiCard`, `SectionTitle`, `ChartSkeleton`, `ChartError`, `CategoryBadge`, `HealthBadge`) colocated at the top of the file. We'll mirror that pattern so Tasks 5–12 can add sections without fighting layout glue.

**Files:**
- Modify: `client/src/pages/mpp.tsx` (replace entire contents with a scaffold)

- [ ] **Step 1: Replace `mpp.tsx` with a scaffold that keeps the existing hero stats working**

Full replacement file:

```tsx
import { useDeferredValue, useState } from "react";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { MPP } from "@/lib/content-zones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
  AreaChart, Area, ResponsiveContainer, Tooltip, LineChart, Line,
} from "recharts";
import {
  Store, DollarSign, Users, TrendingUp, AlertTriangle,
  Search, ChevronLeft, ChevronRight, Network, Coins,
} from "lucide-react";
import { Link } from "wouter";

// --- Category + payment method color tables ---

const CATEGORY_COLORS: Record<string, string> = {
  "ai-model": "#8b5cf6",
  "dev-infra": "#3b82f6",
  compute: "#f59e0b",
  data: "#22c55e",
  commerce: "#ec4899",
  other: "#6b7280",
};
const CATEGORY_LABELS: Record<string, string> = {
  "ai-model": "AI Models",
  "dev-infra": "Dev Infra",
  compute: "Compute",
  data: "Data",
  commerce: "Commerce",
  other: "Other",
};
const PAYMENT_METHOD_COLORS: Record<string, string> = {
  tempo: "#14b8a6",
  stripe: "#635bff",
  lightning: "#f7931a",
  other: "#6b7280",
};

// --- Primitives ---

function KpiCard({ label, value, icon: Icon, subtitle, iconColor }: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  subtitle?: string;
  iconColor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight mt-0.5">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Icon className={`w-10 h-10 ${iconColor ?? "text-muted-foreground"}`} strokeWidth={1.5} />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function ChartSkeleton() {
  return <Skeleton className="w-full h-[280px] rounded-lg" />;
}

function ChartError({ message }: { message?: string }) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{message ?? "Failed to load data"}</AlertDescription>
    </Alert>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{message}</div>
  );
}

// --- Page ---

export default function MppPage() {
  return (
    <Layout>
      <SEO title={MPP.seo.title} description={MPP.seo.description} path="/mpp" />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{MPP.overview.title}</h1>
          <p className="text-muted-foreground mt-1">{MPP.overview.description}</p>
        </header>
        {/* Sections added in Tasks 5-12 */}
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Verify `VITE_ENABLE_MPP_UI=true npm run dev` renders the new scaffold without errors**

```bash
VITE_ENABLE_MPP_UI=true ENABLE_MPP_UI=true npm run dev
# Open http://localhost:5001/mpp
# Expected: hero text renders; browser console is clean; no network errors (we're not calling any APIs yet).
```

Kill the dev server after verifying.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/mpp.tsx
git commit -m "refactor(mpp): scaffold analytics page with shared primitives

Replace the 110-line MPP stub with a /bazaar-style scaffold:
KpiCard, SectionTitle, ChartSkeleton, ChartError, EmptyState
helpers plus category and payment-method color tables. Sections
added in follow-up commits."
```

---

### Task 5: Add hero KPI row driven by directory + chain stats

**Why this matters:** Spec §8.2 calls for a hero with services indexed, categories, pathUSD volume, and multi-protocol agent count. All four values come from endpoints that already exist.

**Files:**
- Modify: `client/src/pages/mpp.tsx` (add `HeroStats` subcomponent, mount it under the header)

- [ ] **Step 1: Add `HeroStats` inside `mpp.tsx` above `export default function MppPage`**

```tsx
interface MppDirectoryStats {
  totalServices: number;
  activeServices: number;
  categoryBreakdown: Record<string, number>;
  pricingModelBreakdown: Record<string, number>;
  paymentMethodBreakdown: Record<string, number>;
  priceStats: { median: number; mean: number; min: number; max: number } | null;
  snapshotDate: string | null;
}

interface MppChainStats {
  volume: number;
  txCount: number;
  uniquePayers: number;
  activeRecipients: number;
}

interface MppAdoptionStats {
  mpp: number;
  x402: number;
  both: number;
}

function HeroStats() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<MppDirectoryStats>({
    queryKey: ["/api/mpp/directory/stats"],
  });
  const { data: chain } = useQuery<MppChainStats>({
    queryKey: ["/api/mpp/chain/stats"],
  });
  const { data: adoption } = useQuery<MppAdoptionStats>({
    queryKey: ["/api/mpp/adoption"],
  });

  if (statsLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (statsError) {
    return (
      <Alert className="my-2">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          MPP analytics coming online — first snapshot pending. Check back once the indexer runs.
        </AlertDescription>
      </Alert>
    );
  }

  const categoryCount = stats ? Object.keys(stats.categoryBreakdown).length : 0;
  const snapshotLabel = stats?.snapshotDate
    ? `Snapshot: ${new Date(stats.snapshotDate).toLocaleDateString()}`
    : "Awaiting first snapshot";

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Services Indexed"
          value={stats?.activeServices ?? 0}
          subtitle={`${stats?.totalServices ?? 0} all-time`}
          icon={Store}
          iconColor="text-teal-500"
        />
        <KpiCard
          label="Categories"
          value={categoryCount}
          subtitle={snapshotLabel}
          icon={TrendingUp}
          iconColor="text-blue-500"
        />
        <KpiCard
          label="Tempo pathUSD Volume"
          value={chain?.volume != null ? `$${chain.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
          subtitle={chain?.txCount != null ? `${chain.txCount.toLocaleString()} transfers` : undefined}
          icon={Coins}
          iconColor="text-emerald-500"
        />
        <KpiCard
          label="Multi-Protocol Agents"
          value={adoption?.both ?? 0}
          subtitle={`${adoption?.mpp ?? 0} MPP · ${adoption?.x402 ?? 0} x402`}
          icon={Network}
          iconColor="text-purple-500"
        />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Mount `HeroStats` below the header**

Inside `MppPage()`, add `<HeroStats />` directly after the closing `</header>`:

```tsx
</header>
<HeroStats />
{/* Sections added in Tasks 6-12 */}
```

- [ ] **Step 3: Verify empty state by hitting the page with MPP flag off**

```bash
# Default dev server — ENABLE_MPP_UI is NOT set, so /api/mpp/* routes don't register
npm run dev
# Open http://localhost:5001/mpp
```

Expected: the 4 KPI cards render briefly as skeletons, then the page shows the `Alert` empty state ("MPP analytics coming online..."). No console errors.

Kill dev server.

- [ ] **Step 4: Verify populated state**

```bash
ENABLE_MPP_UI=true VITE_ENABLE_MPP_UI=true npm run dev
# Open http://localhost:5001/mpp
```

Expected: routes register, stats endpoints return `{ totalServices: 0, activeServices: 0, ... }` (no data yet because indexer hasn't run locally). KPI cards render with `0` values and the "Awaiting first snapshot" subtitle.

Kill dev server.

- [ ] **Step 5: `npm test` + `npx tsc --noEmit`**

Both must remain green.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/mpp.tsx
git commit -m "feat(mpp): add hero KPI row to /mpp page

Four KPIs driven by /api/mpp/directory/stats, /api/mpp/chain/stats,
and /api/mpp/adoption — services indexed, categories, pathUSD
volume, multi-protocol agent count. Loading skeletons + empty
state copy for pre-indexer state."
```

---

### Task 6: Add category and payment-method breakdown charts

**Why this matters:** Spec §8.2 — "category distribution" and "payment methods" charts. Reuse Recharts `PieChart` pattern from `bazaar.tsx:367-398`.

**Files:**
- Modify: `client/src/pages/mpp.tsx` (add `BreakdownCharts` section)

- [ ] **Step 1: Add `BreakdownCharts` subcomponent above `export default function MppPage`**

```tsx
function BreakdownCharts() {
  const { data: stats, isLoading, isError } = useQuery<MppDirectoryStats>({
    queryKey: ["/api/mpp/directory/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }
  if (isError) return <ChartError message="Failed to load MPP breakdown" />;
  if (!stats) return null;

  const categoryPieData = Object.entries(stats.categoryBreakdown).map(([category, count]) => ({
    name: CATEGORY_LABELS[category] ?? category,
    value: count,
    category,
  }));
  const paymentMethodData = Object.entries(stats.paymentMethodBreakdown).map(([method, count]) => ({
    name: method,
    value: count,
  }));

  const categoryConfig: ChartConfig = Object.fromEntries(
    Object.entries(CATEGORY_COLORS).map(([k, v]) => [k, { label: CATEGORY_LABELS[k] ?? k, color: v }])
  );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Service Categories</CardTitle></CardHeader>
        <CardContent>
          {categoryPieData.length > 0 ? (
            <ChartContainer config={categoryConfig} className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryPieData.map((entry) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <EmptyState message="No categorized services yet." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Payment Methods</CardTitle></CardHeader>
        <CardContent>
          {paymentMethodData.length > 0 ? (
            <ChartContainer config={{ value: { label: "Services", color: "#14b8a6" } }} className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentMethodData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {paymentMethodData.map((entry) => (
                      <Cell key={entry.name} fill={PAYMENT_METHOD_COLORS[entry.name] ?? PAYMENT_METHOD_COLORS.other} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <EmptyState message="No payment methods indexed yet." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Mount `BreakdownCharts` in `MppPage` after `HeroStats`**

```tsx
<HeroStats />
<BreakdownCharts />
```

- [ ] **Step 3: Verify empty + populated states**

```bash
ENABLE_MPP_UI=true VITE_ENABLE_MPP_UI=true npm run dev
# Open /mpp — expect "No categorized services yet" + "No payment methods indexed yet" empty states
```

- [ ] **Step 4: `npm test` + `npx tsc --noEmit`**

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/mpp.tsx
git commit -m "feat(mpp): add category + payment-method breakdown charts

Donut chart for service categories (ai-model/dev-infra/compute/
data/commerce/other) and a bar chart for payment methods
(tempo/stripe/lightning/other). Both consume
/api/mpp/directory/stats. Empty states for pre-indexer data."
```

---

### Task 7: Add service count + Tempo volume time-series charts

**Why this matters:** Spec §8.2 — "trends chart: service count + category shifts over time" and "Tempo chain stats: pathUSD volume". Use the existing `/api/mpp/directory/trends` and `/api/mpp/chain/volume-trend` endpoints.

**Files:**
- Modify: `client/src/pages/mpp.tsx` (add `TrendCharts` section)

- [ ] **Step 1: Add `TrendCharts` subcomponent**

```tsx
interface MppDirectorySnapshotRow {
  snapshotDate: string;
  totalServices: number;
  activeServices: number;
  categoryBreakdown?: Record<string, number>;
}

interface VolumeTrendPoint {
  day: string;
  volume: number;
  tx_count: number;
}

function TrendCharts() {
  const { data: dirTrends, isLoading: dirLoading, isError: dirError } = useQuery<MppDirectorySnapshotRow[]>({
    queryKey: ["/api/mpp/directory/trends"],
  });
  const { data: volumeTrend, isLoading: volLoading, isError: volError } = useQuery<VolumeTrendPoint[]>({
    queryKey: ["/api/mpp/chain/volume-trend"],
  });

  const dirChartData = (dirTrends ?? []).map((s) => ({
    date: new Date(s.snapshotDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    total: s.totalServices,
    active: s.activeServices,
  }));
  const volChartData = (volumeTrend ?? []).map((p) => ({
    date: new Date(p.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    volume: p.volume,
    tx: p.tx_count,
  }));

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Directory Growth</CardTitle></CardHeader>
        <CardContent>
          {dirLoading ? <ChartSkeleton />
            : dirError ? <ChartError message="Failed to load growth data" />
            : dirChartData.length > 1 ? (
              <ChartContainer config={{
                total: { label: "Total", color: "#3b82f6" },
                active: { label: "Active", color: "#22c55e" },
              }} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dirChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Total" />
                    <Area type="monotone" dataKey="active" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} name="Active" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <EmptyState message="Growth trends appear after several days of snapshots." />
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Tempo pathUSD Daily Volume</CardTitle></CardHeader>
        <CardContent>
          {volLoading ? <ChartSkeleton />
            : volError ? <ChartError message="Failed to load volume data" />
            : volChartData.length > 1 ? (
              <ChartContainer config={{ volume: { label: "Volume (USD)", color: "#14b8a6" } }} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Volume"]} />
                    <Bar dataKey="volume" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <EmptyState message="Volume data appears after the Tempo indexer runs." />
            )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Mount `<TrendCharts />` after `<BreakdownCharts />` in `MppPage`**

- [ ] **Step 3: Verify both empty and populated paths**

```bash
ENABLE_MPP_UI=true VITE_ENABLE_MPP_UI=true npm run dev
# /mpp should show two cards with empty-state copy
```

- [ ] **Step 4: `npm test` + `npx tsc --noEmit`**

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/mpp.tsx
git commit -m "feat(mpp): add directory growth + Tempo volume trend charts

Two time-series charts driven by /api/mpp/directory/trends
(area chart: total + active services over time) and
/api/mpp/chain/volume-trend (bar chart: daily pathUSD volume).
Empty states when history < 2 points."
```

---

### Task 8: Add directory table with search, category filter, payment-method filter, pagination

**Why this matters:** Spec §8.2 — "Directory table: filterable/searchable, columns: name, category, payment methods, price". Mirror `bazaar.tsx` filter patterns (search `useDeferredValue`, dropdown category filter, offset-based pagination).

**Files:**
- Modify: `client/src/pages/mpp.tsx` (add `DirectoryTable` section)

- [ ] **Step 1: Add `DirectoryTable` subcomponent**

```tsx
interface MppServiceRow {
  id: number;
  serviceUrl: string;
  serviceName: string | null;
  providerName: string | null;
  description: string | null;
  category: string;
  pricingModel: string | null;
  priceAmount: string | null;
  priceCurrency: string | null;
  paymentMethods: Array<{ method: string; currency?: string; recipient?: string }>;
  recipientAddress: string | null;
  isActive: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface MppServicesResponse {
  services: MppServiceRow[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 25;

function formatPrice(amount: string | null): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function DirectoryTable() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDeferredValue(searchInput);
  const [category, setCategory] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<MppServicesResponse>({
    queryKey: ["/api/mpp/directory/services", { category, paymentMethod, search, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      return fetch(`/api/mpp/directory/services?${params}`).then((r) => r.json());
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">MPP Directory</CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search services…"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              className="pl-8 h-9"
            />
          </div>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            data-testid="filter-mpp-category"
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={paymentMethod}
            onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            data-testid="filter-mpp-payment"
          >
            <option value="">Any payment</option>
            <option value="tempo">Tempo</option>
            <option value="stripe">Stripe</option>
            <option value="lightning">Lightning</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : isError ? (
          <ChartError message="Failed to load services" />
        ) : !data?.services.length ? (
          <EmptyState message={search || category || paymentMethod ? "No services match your filters." : "No services indexed yet."} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="py-2 pr-3 font-medium">Service</th>
                    <th className="py-2 px-3 font-medium">Provider</th>
                    <th className="py-2 px-3 font-medium">Category</th>
                    <th className="py-2 px-3 font-medium">Payment</th>
                    <th className="py-2 px-3 font-medium text-right">Price</th>
                    <th className="py-2 pl-3 font-medium text-right">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-3">
                        <a href={s.serviceUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                          {s.serviceName ?? s.serviceUrl}
                        </a>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{s.providerName ?? "—"}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-xs" style={{ borderColor: CATEGORY_COLORS[s.category], color: CATEGORY_COLORS[s.category] }}>
                          {CATEGORY_LABELS[s.category] ?? s.category}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 space-x-1">
                        {s.paymentMethods.map((p, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{p.method}</Badge>
                        ))}
                      </td>
                      <td className="py-2 px-3 text-right">{formatPrice(s.priceAmount)}</td>
                      <td className="py-2 pl-3 text-right text-muted-foreground">
                        {new Date(s.lastSeenAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages} · {data.total} total
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Mount `<DirectoryTable />` after `<TrendCharts />` in `MppPage`**

- [ ] **Step 3: Verify loading → empty → pagination states**

```bash
ENABLE_MPP_UI=true VITE_ENABLE_MPP_UI=true npm run dev
# /mpp should render table header + filters + "No services indexed yet" body
# Type in search — should NOT error, should re-render with "No services match your filters"
```

- [ ] **Step 4: `npm test` + `npx tsc --noEmit`**

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/mpp.tsx
git commit -m "feat(mpp): add filterable MPP directory table

Columns: service, provider, category, payment methods, price,
last seen. Filters: full-text search (deferred), category dropdown,
payment-method dropdown. 25-row pagination via /api/mpp/directory/
services query params. Empty-state copy distinguishes no-data vs
no-match."
```

---

### Task 9: Add top providers list

**Why this matters:** Spec §8.2 — "Top providers section". `/api/mpp/directory/top-providers` returns `{ provider_name, service_count }[]` rows.

**Files:**
- Modify: `client/src/pages/mpp.tsx` (add `TopProviders` section)

- [ ] **Step 1: Add `TopProviders` subcomponent**

```tsx
interface TopProviderRow {
  provider_name: string;
  service_count: number;
}

function TopProviders() {
  const { data, isLoading, isError } = useQuery<TopProviderRow[]>({
    queryKey: ["/api/mpp/directory/top-providers"],
  });

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Top Providers</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : isError ? (
          <ChartError message="Failed to load top providers" />
        ) : !data?.length ? (
          <EmptyState message="No provider data yet." />
        ) : (
          <ol className="space-y-2">
            {data.slice(0, 10).map((p, idx) => (
              <li key={p.provider_name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right text-muted-foreground tabular-nums">{idx + 1}.</span>
                  <span className="font-medium">{p.provider_name}</span>
                </span>
                <Badge variant="secondary">{p.service_count} services</Badge>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Mount `<TopProviders />` after `<DirectoryTable />` in `MppPage`**

- [ ] **Step 3: Verify empty state renders when indexer hasn't run**

```bash
ENABLE_MPP_UI=true VITE_ENABLE_MPP_UI=true npm run dev
# /mpp should show "No provider data yet."
```

- [ ] **Step 4: `npm test` + `npx tsc --noEmit`**

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/mpp.tsx
git commit -m "feat(mpp): add top providers list

Top 10 providers by service count from /api/mpp/directory/
top-providers. Ranked list with service-count badge."
```

---

### Task 10: Add multi-protocol agents callout

**Why this matters:** Spec §8.2 — "Multi-protocol agents callout: links to agent profiles (redacted)". The `/api/ecosystem/multi-protocol-agents` endpoint already applies `redactAgentForPublic` server-side (routes/mpp.ts:215) — no client-side redaction logic needed, just render the result.

**Files:**
- Modify: `client/src/pages/mpp.tsx` (add `MultiProtocolAgents` section)

- [ ] **Step 1: Add `MultiProtocolAgents` subcomponent**

```tsx
interface PublicAgent {
  id: string;
  name?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
  chainId?: number | null;
  verdict?: string | null;
}

interface MultiProtocolResponse {
  total: number;
  agents: PublicAgent[];
}

function MultiProtocolAgents() {
  const { data, isLoading, isError } = useQuery<MultiProtocolResponse>({
    queryKey: ["/api/ecosystem/multi-protocol-agents"],
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Multi-Protocol Agents</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {MPP.methodology.crossProtocol}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : isError ? (
          <ChartError message="Failed to load multi-protocol agents" />
        ) : !data?.agents.length ? (
          <EmptyState message="No agents yet detected on both MPP and x402." />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {data.agents.slice(0, 16).map((a) => (
                <Link key={a.id} href={a.slug ? `/agent/${a.slug}` : `/agent/${a.id}`}>
                  <div className="border rounded-md px-3 py-2 hover:bg-muted/40 transition cursor-pointer">
                    <div className="text-sm font-medium truncate">{a.name ?? "Unnamed agent"}</div>
                    {a.verdict && <Badge variant="outline" className="text-xs mt-1">{a.verdict}</Badge>}
                  </div>
                </Link>
              ))}
            </div>
            {data.total > 16 && (
              <p className="text-xs text-muted-foreground mt-3">
                Showing 16 of {data.total} multi-protocol agents.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Mount `<MultiProtocolAgents />` below `<TopProviders />` in `MppPage`**

- [ ] **Step 3: Verify empty state + link behavior**

```bash
ENABLE_MPP_UI=true VITE_ENABLE_MPP_UI=true npm run dev
# /mpp should show "No agents yet detected on both MPP and x402."
```

- [ ] **Step 4: `npm test` + `npx tsc --noEmit`**

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/mpp.tsx
git commit -m "feat(mpp): add multi-protocol agents callout

Grid of up to 16 redacted agent cards linking to agent profiles,
sourced from /api/ecosystem/multi-protocol-agents (server-side
redactAgentForPublic already applied). Includes cross-protocol
presence explainer from content-zones."
```

---

### Task 11: Polish page copy + SEO via content-zones

**Why this matters:** Spec §8.3 — "All copy in content-zones.ts". Task 4's scaffold already pulls `MPP.seo` and `MPP.overview` from `content-zones.ts`, but the dashboard sections need additional copy keys for section titles and the cross-protocol callout explainer. Copy should live in `content-zones.ts` so non-engineers can edit it.

**Files:**
- Modify: `client/src/lib/content-zones.ts`
- Modify: `client/src/pages/mpp.tsx` (swap a few hardcoded strings for `MPP.dashboard.*` references)

- [ ] **Step 1: Extend the `MPP` constant in `content-zones.ts`**

Replace the current `MPP` block (lines 299–319) with:

```ts
export const MPP = {
  seo: {
    title: "Machine Payments Protocol",
    description:
      "Stripe + Tempo Labs standard for agent-native payments. Launched March 2026 with Visa, Anthropic, Shopify, and 10+ partners. Track MPP adoption and cross-protocol presence alongside x402.",
  },
  overview: {
    title: "Machine Payments Protocol",
    description:
      "Stripe + Tempo Labs standard for agent-native payments. Launched March 2026 with Visa, Anthropic, Shopify, and 10+ partners.",
  },
  methodology: {
    crossProtocol:
      "Agents present on both MPP and x402 show broader ecosystem engagement — a strong trust signal that is harder to fake than single-protocol presence.",
  },
  economySection: {
    headline: "Cross-Protocol Payment Ecosystem",
    subhead: "x402 (Base) and MPP (Tempo) — the two major agent payment standards",
    adoptionLabel: "Agents on both protocols",
  },
  dashboard: {
    preIndexerEmpty:
      "MPP analytics coming online — first snapshot pending. Check back once the indexer runs.",
    categoriesTitle: "Service Categories",
    paymentMethodsTitle: "Payment Methods",
    directoryGrowthTitle: "Directory Growth",
    volumeTitle: "Tempo pathUSD Daily Volume",
    directoryTitle: "MPP Directory",
    topProvidersTitle: "Top Providers",
    multiProtocolTitle: "Multi-Protocol Agents",
  },
};
```

- [ ] **Step 2: Swap the hardcoded titles + the pre-indexer empty-state string in `mpp.tsx`**

In each section component, replace the inline strings with `MPP.dashboard.*` references:
- `HeroStats` → the `AlertDescription` text becomes `{MPP.dashboard.preIndexerEmpty}`
- `BreakdownCharts` → `<CardTitle>{MPP.dashboard.categoriesTitle}</CardTitle>` and `{MPP.dashboard.paymentMethodsTitle}`
- `TrendCharts` → `{MPP.dashboard.directoryGrowthTitle}` and `{MPP.dashboard.volumeTitle}`
- `DirectoryTable` → `{MPP.dashboard.directoryTitle}`
- `TopProviders` → `{MPP.dashboard.topProvidersTitle}`
- `MultiProtocolAgents` → `{MPP.dashboard.multiProtocolTitle}`

- [ ] **Step 3: Verify page still renders**

```bash
ENABLE_MPP_UI=true VITE_ENABLE_MPP_UI=true npm run dev
# /mpp — titles should render identically to before
```

- [ ] **Step 4: `npm test` + `npx tsc --noEmit`**

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/content-zones.ts client/src/pages/mpp.tsx
git commit -m "refactor(mpp): move dashboard copy into content-zones

Adds MPP.dashboard.* keys for all section titles and the
pre-indexer empty-state message. No behavior change."
```

---

### Task 12: Add `/mpp` link to the header Analytics dropdown, gated by `VITE_ENABLE_MPP_UI`

**Why this matters:** Spec §8.2 ends with a dedicated page; the page should be reachable from the site nav once launched. Gate the link behind `VITE_ENABLE_MPP_UI` so the nav stays clean in production until Step 10 of the rollout.

**Files:**
- Modify: `client/src/components/header.tsx`

- [ ] **Step 1: Add `/mpp` to `analyticsRoutes` and inject the dropdown item**

Edit `client/src/components/header.tsx`:

Line 12 — include `/mpp` in the active-state array so the Analytics dropdown stays highlighted when the user is on `/mpp`:

```ts
const analyticsRoutes = ["/analytics", "/economy", "/skills", "/bazaar", "/mpp", "/status"];
```

Inside the Analytics `DropdownMenuContent`, after the `/bazaar` item (line 87–92) and before the `/status` item, insert a conditional MPP entry. Import `Network` icon from lucide-react (already partially imported; add to the existing destructure in line 2):

```ts
// Line 2 — extend the import
import { Shield, Bot, BarChart3, ChevronDown, Zap, Info, BookOpen, Layers, Activity, ShieldCheck, Sparkles, Store, Coins, FlaskConical, Scale, Network } from "lucide-react";
```

Then inside the Analytics DropdownMenuContent, after the `/bazaar` Link:

```tsx
              {import.meta.env.VITE_ENABLE_MPP_UI === "true" && (
                <Link href="/mpp">
                  <DropdownMenuItem className="gap-2 cursor-pointer">
                    <Network className="w-4 h-4" />
                    MPP
                  </DropdownMenuItem>
                </Link>
              )}
```

- [ ] **Step 2: Verify the link is hidden without the flag**

```bash
npm run dev
# open / — click "Analytics" dropdown — MPP entry should NOT appear
```

- [ ] **Step 3: Verify it appears with the flag**

```bash
VITE_ENABLE_MPP_UI=true npm run dev
# open / — Analytics dropdown — MPP entry should appear, and clicking it navigates to /mpp
```

- [ ] **Step 4: `npm test` + `npx tsc --noEmit`**

- [ ] **Step 5: Commit**

```bash
git add client/src/components/header.tsx
git commit -m "feat(nav): add /mpp to Analytics dropdown when flag enabled

Gated by VITE_ENABLE_MPP_UI so the link is hidden in
production until the rollout's final step."
```

---

### Task 13: Update `/economy` MPP section empty-state copy

**Why this matters:** The existing `MppSection` on `/economy` (client/src/pages/economy.tsx:735–774) shows raw `"—"` for missing data. That's acceptable, but when every value is `"—"` the section looks broken. Add a single-line fallback message matching the `/mpp` page pre-indexer state.

**Files:**
- Modify: `client/src/pages/economy.tsx` (add null-state copy, small diff — ~6 lines)

- [ ] **Step 1: Compute a `preIndexer` boolean in `MppSection`**

Inside `MppSection()` (around line 735), after the two `useQuery` calls, add:

```ts
  const preIndexer =
    (comparison?.mpp.activeServices ?? 0) === 0 &&
    (adoption?.both ?? 0) === 0;
```

Then inside the card body, above the `<a href="/mpp">` line (around line 768), add:

```tsx
        {preIndexer && (
          <p className="text-xs text-muted-foreground mb-3">
            MPP indexer is coming online — first snapshot pending.
          </p>
        )}
```

- [ ] **Step 2: Verify `/economy` with flag on**

```bash
ENABLE_MPP_UI=true VITE_ENABLE_MPP_UI=true npm run dev
# /economy — MPP section at bottom should show the pre-indexer line above the "Explore the MPP ecosystem →" link
```

- [ ] **Step 3: `npm test` + `npx tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/economy.tsx
git commit -m "feat(economy): add pre-indexer copy to MPP cross-protocol card

When both MPP service count and multi-protocol agent count are
zero, show a one-line explainer above the 'Explore the MPP
ecosystem →' link."
```

---

### Task 14: Full-page walkthrough + accessibility sanity check

**Why this matters:** Before pushing a PR, confirm the finished page renders correctly across both empty and (simulated) populated states, and that keyboard nav through filters works.

**Files:** None modified — this is verification only.

- [ ] **Step 1: Empty-state walkthrough**

```bash
ENABLE_MPP_UI=true VITE_ENABLE_MPP_UI=true npm run dev
# Visit /mpp
# Expected, top to bottom:
#  - Hero: 4 KPI cards all showing 0 or "—", "Awaiting first snapshot" subtitle
#  - BreakdownCharts: two cards, both empty-state messages
#  - TrendCharts: two cards, both empty-state messages
#  - DirectoryTable: filters visible, table body "No services indexed yet."
#  - TopProviders: "No provider data yet."
#  - MultiProtocolAgents: "No agents yet detected on both MPP and x402."
```

- [ ] **Step 2: Populated-state simulation via DB insert**

Use Supabase MCP to insert a handful of `mpp_directory_services` rows manually, then refresh the page:

```sql
INSERT INTO mpp_directory_services
  (service_url, service_name, provider_name, category, pricing_model, price_amount, payment_methods, is_active, first_seen_at, last_seen_at)
VALUES
  ('https://example.com/a', 'Example Service A', 'Provider X', 'ai-model', 'charge', '0.05', '[{"method":"tempo","currency":"0x20c000000000000000000000b9537d11c60e8b50"}]'::jsonb, true, now(), now()),
  ('https://example.com/b', 'Example Service B', 'Provider Y', 'compute', 'session', '1.50', '[{"method":"stripe"},{"method":"tempo"}]'::jsonb, true, now(), now()),
  ('https://example.com/c', 'Example Service C', 'Provider X', 'dev-infra', 'stream', '0.001', '[{"method":"tempo"}]'::jsonb, true, now(), now());

INSERT INTO mpp_directory_snapshots
  (snapshot_date, total_services, active_services, category_breakdown, pricing_model_breakdown, payment_method_breakdown, price_stats)
VALUES
  (current_date, 3, 3, '{"ai-model":1,"compute":1,"dev-infra":1}'::jsonb, '{"charge":1,"session":1,"stream":1}'::jsonb, '{"tempo":3,"stripe":1}'::jsonb, '{"median":0.05,"mean":0.517,"min":0.001,"max":1.5}'::jsonb);
```

Reload `/mpp` — the hero, breakdown charts, directory table, and top-providers list should populate. The trend and volume charts stay empty (1 snapshot ≥ 2 points required).

Clean up after verification:

```sql
DELETE FROM mpp_directory_snapshots WHERE snapshot_date = current_date AND total_services = 3;
DELETE FROM mpp_directory_services WHERE service_url LIKE 'https://example.com/%';
```

- [ ] **Step 3: Keyboard navigation check**

Tab through the filters (search input → category select → payment-method select → pagination buttons → table row links). All elements must be reachable; search input must receive focus on page load when tabbed to.

- [ ] **Step 4: `npm test` + `npx tsc --noEmit`** — both green.

No commit — verification only.

---

## Phase C — Launch sequence (Tasks 15–20)

### Task 15: Write the launch runbook

**Why this matters:** The flag-flip sequence has many steps spread across Vercel and Trigger.dev dashboards. A runbook turns this from an ad-hoc operator task into a reviewable artifact that is run by a human (or Claude with explicit confirmations) and is re-runnable if we need to toggle flags later.

**Files:**
- Create: `docs/superpowers/runbooks/2026-04-16-mpp-launch.md`

- [ ] **Step 1: Create the runbook**

```bash
mkdir -p docs/superpowers/runbooks
```

Then write the file with this content:

```markdown
# MPP Launch Runbook

**Date:** 2026-04-16
**Target branch:** main (via PR from feat/mpp-integration)
**Owner:** <operator>
**Est. time:** 45 min active + 24–48 h observation
**Rollback:** Every step is individually reversible via the same flag flip in reverse.

## Preconditions

- [ ] PR from `feat/mpp-integration` merged to `main`
- [ ] `npm test` green on `main` (279+ passing)
- [ ] Supabase migration `0002_mpp_integration.sql` already applied (verify with `\d mpp_directory_services` in Supabase SQL editor)
- [ ] Git author is `All The New <admin@allthenew.com>`

## Step 1 — Set Vercel environment variables (flags still OFF)

```bash
# From the project root (.vercel/project.json must exist)
printf 'https://rpc.tempo.xyz' | npx vercel env add TEMPO_RPC_URL production
# Optional — skip if no fallback RPC is provisioned
# printf 'https://<quicknode-or-chainstack-endpoint>' | npx vercel env add TEMPO_RPC_URL_FALLBACK production
printf 'auto' | npx vercel env add MPP_DIRECTORY_SOURCE production
# Leave these two OFF for now
# ENABLE_MPP_UI and VITE_ENABLE_MPP_UI remain UNSET (or set to 'false')
```

Verify:

```bash
npx vercel env ls production | grep -E 'TEMPO_RPC_URL|MPP_DIRECTORY_SOURCE|ENABLE_MPP_UI'
```

Redeploy so env vars take effect:

```bash
npx vercel deploy --prod
```

## Step 2 — Set Trigger.dev environment variables (flag still OFF)

Via Trigger.dev dashboard: **Settings → Environment Variables → Production**. Add:

| Var | Value | Notes |
|---|---|---|
| `ENABLE_MPP_INDEXER` | `false` | Keep OFF until Step 5 |
| `TEMPO_RPC_URL` | `https://rpc.tempo.xyz` | |
| `TEMPO_RPC_URL_FALLBACK` | (optional) | QuickNode/Chainstack |
| `MPP_DIRECTORY_SOURCE` | `auto` | |
| `TEMPO_PATHUSD_DEPLOYMENT_BLOCK` | `<RESOLVED_VALUE>` | Resolved 2026-04-16 via <method> (paste value resolved in Task 2 of plan 2026-04-16-mpp-launch.md) |

`TEMPO_TRANSFER_WITH_MEMO_TOPIC` is intentionally left unset for launch — memo decoding is deferred (decision recorded in plan Task 3). Re-deploy is not needed here because Trigger.dev reads env vars at run time; the next deploy will consume them.

## Step 3 — Push Trigger.dev code (flag still OFF)

GitHub Actions auto-deploys on push to paths `trigger/`, `server/`, `shared/`, `package.json`, `package-lock.json`, `.npmrc`. Confirm the deploy workflow ran green in the Actions tab after the merge to main.

Verify in Trigger.dev dashboard that the three tasks appear in the task list:
- `mpp-prober`
- `mpp-directory-indexer`
- `tempo-transaction-indexer`

Their runs list should be empty or show `skipped: true` (the early return when `ENABLE_MPP_INDEXER !== "true"`).

## Step 4 — Smoke-test RPC reachability and admin endpoints

Verify RPC from the deployed environment via an admin manual-trigger (requires `ENABLE_MPP_UI=true` — turn it on briefly or use an IP-allowlisted admin session):

Temporarily enable `ENABLE_MPP_UI=true` in Vercel, redeploy, then:

```bash
# Requires admin cookie set — see /admin/login
curl -X POST https://trustadd.com/api/admin/mpp/index-tempo \
  -H "Cookie: <admin-session-cookie>"
# Expected: {"message":"Tempo sync started","status":"running"} — the task is fire-and-forget
```

Check Trigger.dev run logs for the corresponding one-shot run. If RPC fails, set `TEMPO_RPC_URL_FALLBACK` in Vercel AND Trigger.dev before proceeding.

Then flip `ENABLE_MPP_UI=false` back OFF and redeploy (public should still not see the page).

## Step 5 — Enable the indexer and accumulate 24–48 h of data

In Trigger.dev dashboard, change `ENABLE_MPP_INDEXER` to `true`. The next scheduled runs will execute:
- 03:30 UTC daily — `mpp-prober`
- 04:30 UTC daily — `mpp-directory-indexer`
- every 6 h — `tempo-transaction-indexer`

Watch Sentry for new errors from these tasks over the next 24–48 h. Check `/admin/status` for SLA compliance.

## Step 6 — Review data directly in Supabase

Expected population after one full day:

```sql
SELECT count(*), min(first_seen_at), max(last_seen_at) FROM mpp_directory_services;
SELECT snapshot_date, total_services, active_services FROM mpp_directory_snapshots ORDER BY snapshot_date DESC LIMIT 5;
SELECT count(*), count(distinct agent_id) FROM mpp_probes;
SELECT count(*), sum(amount_usd) FROM agent_transactions WHERE chain_id = 4217;
```

If directory rows are absent, inspect Sentry and Trigger.dev logs for the directory-indexer task. A zero-row result is expected if the directory is still empty or format has drifted; Sentry should surface the parse error with an HTML snippet.

## Step 7 — Turn server-side `ENABLE_MPP_UI` on (API live, page still hidden)

```bash
printf 'true' | npx vercel env add ENABLE_MPP_UI production
npx vercel deploy --prod
```

At this point `/api/mpp/*` returns real data (not 404). `/mpp` still renders as an empty page to end users because `VITE_ENABLE_MPP_UI` is still false (the Vite build embeds that flag at compile time).

Verify:

```bash
curl -s https://trustadd.com/api/mpp/directory/stats | jq .
# Expected: a populated JSON object with non-zero totalServices after the indexer ran
```

## Step 8 — Turn client-side `VITE_ENABLE_MPP_UI` on (page + economy section go live)

```bash
printf 'true' | npx vercel env add VITE_ENABLE_MPP_UI production
npx vercel deploy --prod
```

This triggers a new frontend bundle. Once deploy completes:

- `/mpp` renders the full dashboard with data
- `/economy` shows the Cross-Protocol Payment Ecosystem card

Header nav still does NOT show the MPP link yet (it's behind the same `VITE_ENABLE_MPP_UI` flag — actually YES, Task 12 wired it to the same flag, so it DOES show after this step. Confirm by visiting `/` and opening the Analytics dropdown.)

## Step 9 — Final smoke test

- [ ] `https://trustadd.com/mpp` loads
- [ ] Hero KPIs show non-zero values
- [ ] Category pie renders
- [ ] Directory table has rows; search + filters work
- [ ] Multi-protocol agents section — if >0, click through to an agent profile
- [ ] Nav `/` → Analytics dropdown → MPP → `/mpp`

## Step 10 — Announce in `content-zones.METHODOLOGY.ecosystemNotice`

See plan Task 20. Separate PR.

## Rollback

Any step can be reverted by reversing the flag flip:
- Step 5 → set `ENABLE_MPP_INDEXER=false` in Trigger.dev (data stops accumulating; existing data remains)
- Step 7 → `npx vercel env rm ENABLE_MPP_UI production && npx vercel deploy --prod` (API routes unregistered)
- Step 8 → `npx vercel env rm VITE_ENABLE_MPP_UI production && npx vercel deploy --prod` (page + nav link hidden)

## Known launch-scope deferrals

- MPP invisible to trust scoring (Path A — roadmap §1)
- `METHODOLOGY_VERSION` not bumped
- `TransferWithMemo` event decoding disabled (memo column empty)
- No Stripe/Bitquery/Tempo explorer integrations (roadmap §4)
```

**IMPORTANT:** When you write this file, replace `<RESOLVED_VALUE>` with the number you resolved in Task 2, and replace `<method>` with the resolution method (either "explore.mainnet.tempo.xyz creation row" or "binary-search eth_getLogs"). If Task 2 did not resolve a block, leave the row as-is with a comment noting that the indexer will default to block 0 for the first run and self-resolve.

- [ ] **Step 2: `npm test`** (no code changes, but cheap sanity check)

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/runbooks/2026-04-16-mpp-launch.md
git commit -m "docs: add MPP launch runbook

Step-by-step flag-flip sequence with verification commands.
Covers env vars, smoke tests, data review, rollback. References
resolved TEMPO_PATHUSD_DEPLOYMENT_BLOCK captured during plan
Task 2."
```

---

### Task 16: Verify observability — Sentry + pipeline health SLAs

**Why this matters:** Section D of the request — verify Sentry captures failures from the 3 Trigger.dev tasks (via the existing `onFailure` hook configured in `trigger.config.ts`) and that `/admin/status` shows SLA data for the 3 new tasks. This is a verification task, no code changes.

**Files:** None modified.

- [ ] **Step 1: Confirm Sentry wiring**

Read `trigger.config.ts` (if needed) and confirm `onFailure` is registered and calls `Sentry.captureException` / `notifyJobFailure`. The three new task files (`trigger/mpp-prober.ts`, `trigger/mpp-directory-indexer.ts`, `trigger/tempo-transaction-indexer.ts`) already call `notifyJobFailure` from their catch blocks — that plus `onFailure` at the global level is enough.

No code change needed. Just record the finding in the runbook's "Step 4" observation comments if it turns out a task file is missing the local `notifyJobFailure` call.

- [ ] **Step 2: Confirm pipeline health SLAs are registered**

```bash
grep -n "mpp-prober\|mpp-directory-indexer\|tempo-transaction-indexer" server/pipeline-health.ts
```

Expected output includes lines 17–20 with `warningMinutes` and `criticalMinutes`. This was shipped in commit `ebbe126` — verified in the plan context. If missing (defensive check), STOP and fix before Step 5 of the runbook.

- [ ] **Step 3: After the runbook's Step 5 is executed (ENABLE_MPP_INDEXER=true)**

Defer this step to actual launch day. Document in the runbook:

> After 6 hours: confirm `/admin/status-details` shows `tempo-transaction-indexer` with a recent success timestamp. After 24 hours: same for `mpp-prober` and `mpp-directory-indexer`.

No commit — no files touched.

---

### Task 17: Pre-PR polish — lint, test, typecheck pass

**Files:** None modified — verification.

- [ ] **Step 1: Run the full suite**

```bash
npm test
# Expected: 279+ tests pass (Tasks 1–13 did not add tests, so count should be identical)
```

- [ ] **Step 2: Type-check the whole project**

```bash
npx tsc --noEmit
# Expected: zero errors
```

- [ ] **Step 3: Build the frontend**

```bash
npm run build
# Expected: clean build, no TypeScript or Vite errors
```

- [ ] **Step 4: Git status should be clean**

```bash
git status
# Expected: "nothing to commit, working tree clean"
# If dirty, you're missing a commit from Tasks 1-15.
```

---

### Task 18: Open PR from `feat/mpp-integration` to `main`

**Why this matters:** The user asked whether to PR into `feat/methodology-v2-backend` or directly to `main`. **Recommendation: directly to `main`.** Rationale:

- The integration is feature-flagged OFF by default, so merging cannot affect production behavior.
- `feat/methodology-v2-backend` is a separate work stream (Path A commits to shipping v2 *without* MPP). Chaining PRs delays ship and couples unrelated reviews.
- The MPP code does not touch trust scoring, so it's orthogonal to methodology v2.
- Hotfixes to the indexer post-launch are easier to land on `main` than on a long-lived feature branch.

The user should confirm, but this is the default in the plan.

**Files:** None modified — PR action.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/mpp-integration
```

- [ ] **Step 2: Create the PR**

```bash
gh pr create --base main --head feat/mpp-integration --title "feat(mpp): MPP integration launch (Path A, flag-gated)" --body "$(cat <<'EOF'
## Summary

Completes Phase 1 + Phase 2 of MPP integration under Path A per [docs/roadmap-mpp.md](docs/roadmap-mpp.md):

- 3 Trigger.dev tasks (mpp-prober, mpp-directory-indexer, tempo-transaction-indexer) — all gated by ENABLE_MPP_INDEXER
- 3 DB tables (already applied to Supabase via migrations/0002_mpp_integration.sql)
- 10 public + 3 admin API endpoints — all gated by ENABLE_MPP_UI
- Full /mpp analytics page (hero, breakdowns, trends, directory table, top providers, multi-protocol agents)
- /economy cross-protocol card
- Header nav entry under Analytics dropdown — all gated by VITE_ENABLE_MPP_UI

## Path A decision

Scoring engine unchanged. METHODOLOGY_VERSION unchanged. Agent profiles unchanged. Trust report schema unchanged. MPP data accumulates for 4–6 weeks before v3 integrates it.

## Pre-launch fixes in this PR

- fix(mpp): placeholder pathUSD contract address replaced with real mainnet address (0x20c000000000000000000000b9537d11c60e8b50)
- refactor/feat(mpp): /mpp page expanded from 110-line stub to full analytics dashboard
- docs: launch runbook at docs/superpowers/runbooks/2026-04-16-mpp-launch.md

## Rollout plan

See the runbook. Summary:
1. Merge with flags OFF
2. Set Vercel + Trigger.dev env vars (flags still OFF)
3. Smoke-test via admin endpoints
4. ENABLE_MPP_INDEXER=true — accumulate 24–48 h
5. ENABLE_MPP_UI=true (API live, page still client-hidden)
6. VITE_ENABLE_MPP_UI=true (page + nav link live)

## Tests

- npm test: passing (unchanged count vs pre-plan)
- npx tsc --noEmit: clean
- npm run build: clean

## Out of scope (explicit non-goals)

- Scoring changes (Phase 3 / Methodology v3)
- METHODOLOGY_VERSION bump
- Trust report / agent profile MPP surfaces
- Stripe, Tempo block explorer, or Bitquery integrations (roadmap §4)
- Unified probe table refactor (premature)
EOF
)"
```

- [ ] **Step 3: Request review**

Manually assign a reviewer or tag in Slack. Do not auto-merge.

No commit — PR creation only.

---

### Task 19: Execute the runbook (live launch)

**Why this matters:** Turns the plan into production behavior.

**Files:** None modified — operational.

- [ ] **Step 1: After PR merges, follow `docs/superpowers/runbooks/2026-04-16-mpp-launch.md` top to bottom.**

Each step in the runbook has its own verification command. Do not skip ahead. Between Step 5 and Step 7, wait **at least 24 hours** to observe task runs before proceeding.

- [ ] **Step 2: Update the runbook in place if any step surfaces a surprise**

The runbook is a living document for future launches. If Step 4's RPC smoke test needs tweaking, commit a small follow-up to the runbook after the launch is stable.

---

### Task 20: Post-launch — announce MPP coverage in methodology page

**Why this matters:** Section D.3 of the request — add a one-line ecosystem-expansion note to the methodology page. This is a **separate post-launch PR**, not part of the launch PR, because it's cosmetic and non-blocking.

**Files:**
- Modify: `client/src/lib/content-zones.ts` — append to `METHODOLOGY.ecosystemNotice`

- [ ] **Step 1: Extend `METHODOLOGY.ecosystemNotice`**

In `client/src/lib/content-zones.ts:378`, replace the single string with a two-sentence version:

```ts
  ecosystemNotice:
    "The AI agent economy is in its earliest stages. Most agents have limited or no transaction history, which means most Trust Ratings reflect profile data rather than verified behavioral evidence. As x402 payments and ERC-8004 attestations grow, Trust Ratings will become increasingly meaningful. TrustAdd is building the measurement infrastructure now so it's ready when the data arrives. Ecosystem expansion: MPP directory coverage and Tempo transaction data are now tracked separately on the MPP page — scoring integration is planned for methodology v3.",
```

- [ ] **Step 2: Verify**

```bash
npm run dev
# Visit /methodology — the ecosystem notice should now end with the MPP sentence.
```

- [ ] **Step 3: `npm test` + `npx tsc --noEmit`**

- [ ] **Step 4: Commit + push as a follow-up PR**

```bash
git checkout -b feat/mpp-launch-announcement
git add client/src/lib/content-zones.ts
git commit -m "docs: announce MPP coverage on methodology page

One-sentence addition noting that MPP directory + Tempo
transaction data are now tracked, with scoring integration
deferred to methodology v3."
git push -u origin feat/mpp-launch-announcement
gh pr create --base main --head feat/mpp-launch-announcement --title "docs: announce MPP coverage on methodology page" --body "Single-sentence ecosystem-notice addition. Non-blocking, can merge anytime after the main MPP PR lands."
```

---

## Self-Review Findings

Ran the plan against the brief checklist in section F and against the seven sub-sections of the task.

1. **Spec coverage (request sections A–E):**
   - **A.1** placeholder pathUSD address — Task 1 ✓
   - **A.2** `TEMPO_PATHUSD_DEPLOYMENT_BLOCK` — Task 2 ✓ (captured into runbook via Task 15)
   - **A.3** `TRANSFER_WITH_MEMO_TOPIC` — Task 3 ✓ (decision: leave unset for launch)
   - **A.4** Tempo RPC reachability — Task 3 ✓
   - **B** all 10 bullets — Hero (Task 5), breakdown charts (Task 6), trend chart (Task 7), volume chart (Task 7), directory table (Task 8), top providers (Task 9), multi-protocol agents (Task 10), empty/loading states (present in every task), SEO/content-zones (Task 11), nav link (Task 12) ✓
   - **C** all 11 rollout bullets — Task 15 runbook covers all 11 steps sequentially ✓
   - **D** observability — Task 16 ✓; launch announcement — Task 20 ✓
   - **E** non-goals — called out in "NOT modified" file structure section and in Critical Constraints ✓

2. **Placeholder scan:**
   - No "TBD" / "TODO" / "implement later" / "handle edge cases" strings.
   - One `<RESOLVED_VALUE>` placeholder exists intentionally in the Task 15 runbook template, with a clear instruction that it must be replaced with the Task 2 output. This is a *value* placeholder, not a content-generation placeholder — acceptable.

3. **Type consistency:**
   - `MppDirectoryStats`, `MppChainStats`, `MppAdoptionStats`, `MppServiceRow`, `MppServicesResponse`, `TopProviderRow`, `MultiProtocolResponse`, `MppDirectorySnapshotRow`, `VolumeTrendPoint`, `PublicAgent` — all defined once in `mpp.tsx` and consumed consistently.
   - Constants `CATEGORY_COLORS`, `CATEGORY_LABELS`, `PAYMENT_METHOD_COLORS`, `PAGE_SIZE` — defined once, referenced by name in every subsequent task.
   - `MPP.dashboard.*` copy keys — defined in Task 11 and consumed in Task 11. Tasks 5–10 use inline strings which Task 11 migrates (intentional ordering so each section is reviewable standalone before copy centralization).

Minor issue spotted + fixed inline: Task 11's migration list explicitly names every section component that needs updating, and Task 12's `/mpp` nav link is gated by the same `VITE_ENABLE_MPP_UI` flag as the `/mpp` page body in `App.tsx` — but the page is *always* routed (not gated in App.tsx), so deep-linking to `/mpp` pre-launch shows an empty hero. That's acceptable (and explicitly verified in Task 5 Step 3).

4. **Task count summary:**
   - Phase A: 3 tasks (pre-launch fixes)
   - Phase B: 11 tasks (page build-out — 4 scaffold, 5 sections, 1 copy, 1 nav, 1 economy, 1 walkthrough)
   - Phase C: 6 tasks (runbook, observability, pre-PR, PR open, launch execution, announcement)
   - **Total: 20 tasks producing 16 commits:**
     1. Task 1 — `fix(mpp): use real pathUSD mainnet contract address`
     2. Task 4 — `refactor(mpp): scaffold analytics page with shared primitives`
     3. Task 5 — `feat(mpp): add hero KPI row to /mpp page`
     4. Task 6 — `feat(mpp): add category + payment-method breakdown charts`
     5. Task 7 — `feat(mpp): add directory growth + Tempo volume trend charts`
     6. Task 8 — `feat(mpp): add filterable MPP directory table`
     7. Task 9 — `feat(mpp): add top providers list`
     8. Task 10 — `feat(mpp): add multi-protocol agents callout`
     9. Task 11 — `refactor(mpp): move dashboard copy into content-zones`
     10. Task 12 — `feat(nav): add /mpp to Analytics dropdown when flag enabled`
     11. Task 13 — `feat(economy): add pre-indexer copy to MPP cross-protocol card`
     12. Task 15 — `docs: add MPP launch runbook`
     13. Task 20 — `docs: announce MPP coverage on methodology page` (follow-up PR/commit)

     Tasks 2, 3, 14, 16, 17, 18, 19 produce no commits (discovery / verification / operational).
