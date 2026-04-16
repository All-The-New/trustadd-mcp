# MPP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Machine Payments Protocol (MPP) tracking alongside existing x402/ERC-8004 coverage — Phase 1 (directory intelligence) + Phase 2 (Tempo on-chain analytics). Defer Phase 3 (cross-protocol trust scoring).

**Architecture:** Parallel infrastructure mirroring existing x402/bazaar patterns. 3 new DB tables, 3 new Trigger.dev tasks, new routes + storage modules, feature-flagged via `ENABLE_MPP_INDEXER` and `ENABLE_MPP_UI`. Tempo chain config lives separately from the 9-chain ERC-8004 array.

**Tech Stack:** TypeScript strict, Drizzle ORM, Express + Vite, Trigger.dev v4 (`@trigger.dev/sdk/v3` imports — existing codebase convention), ethers.js/viem, Vitest, TanStack Query, Shadcn UI, wouter.

**Spec:** `docs/superpowers/specs/2026-04-15-mpp-integration-design.md`

---

## File Structure

**New files:**

Backend
- `shared/mpp-schema.ts` — new Drizzle tables (`mpp_directory_services`, `mpp_directory_snapshots`, `mpp_probes`) + insert schemas + types
- `migrations/0002_mpp_integration.sql` — SQL migration for new tables
- `server/mpp-prober.ts` — MPP endpoint probe logic + payment challenge parser (parallels `server/x402-prober.ts`)
- `server/mpp-directory.ts` — Directory source abstraction + scrape/API implementations + classifier
- `server/tempo-transaction-indexer.ts` — Tempo pathUSD log indexer
- `server/storage/mpp.ts` — Storage layer for MPP tables (CRUD + analytics queries)
- `server/routes/mpp.ts` — Express route handlers for `/api/mpp/*` and `/api/ecosystem/*`
- `trigger/mpp-prober.ts` — Trigger.dev task wrapper
- `trigger/mpp-directory-indexer.ts` — Trigger.dev task wrapper
- `trigger/tempo-transaction-indexer.ts` — Trigger.dev task wrapper
- `client/src/pages/mpp.tsx` — Dedicated MPP ecosystem page

Tests
- `__tests__/mpp-auth-header.test.ts` — `WWW-Authenticate: Payment` parser tests
- `__tests__/mpp-directory.test.ts` — Directory source interface tests
- `__tests__/mpp-storage.test.ts` — Storage layer integration tests (mock DB via in-memory fixture)
- `__tests__/tempo-log-decoder.test.ts` — Tempo event log parser tests
- `__tests__/fixtures/mpp-challenges.ts` — Fixture challenge headers
- `__tests__/fixtures/tempo-logs.ts` — Fixture Tempo RPC responses

**Modified files:**

- `shared/chains.ts` — add `TEMPO_CHAIN_CONFIG` export
- `shared/schema.ts` — re-export MPP tables from `mpp-schema.ts`
- `server/storage.ts` — re-export MPP storage delegators
- `server/routes.ts` — register MPP routes
- `server/routes/admin.ts` — add 3 manual-trigger endpoints
- `server/pipeline-health.ts` — add SLAs for 3 new tasks
- `client/src/pages/economy.tsx` — add MPP section
- `client/src/App.tsx` — register `/mpp` route
- `client/src/lib/content-zones.ts` — new copy keys

---

## Task 1: Create database schema file and migration

**Files:**
- Create: `shared/mpp-schema.ts`
- Create: `migrations/0002_mpp_integration.sql`
- Modify: `shared/schema.ts` (add re-exports at end of file)

- [ ] **Step 1: Create the Drizzle schema file**

Create `shared/mpp-schema.ts`:

```ts
import { sql } from "drizzle-orm";
import { pgTable, text, boolean, integer, jsonb, timestamp, serial, real, uniqueIndex, index, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { agents } from "./schema.js";

export const mppDirectoryServices = pgTable("mpp_directory_services", {
  id: serial("id").primaryKey(),
  serviceUrl: text("service_url").notNull(),
  serviceName: text("service_name"),
  providerName: text("provider_name"),
  description: text("description"),
  category: text("category").notNull().default("other"),
  pricingModel: text("pricing_model"),          // charge | stream | session
  priceAmount: text("price_amount"),
  priceCurrency: text("price_currency"),
  paymentMethods: jsonb("payment_methods"),     // [{method, currency, ...}]
  recipientAddress: text("recipient_address"),
  isActive: boolean("is_active").notNull().default(true),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_mpp_service_url").on(table.serviceUrl),
  index("idx_mpp_service_category").on(table.category),
  index("idx_mpp_service_is_active").on(table.isActive),
  index("idx_mpp_service_last_seen").on(table.lastSeenAt),
]);

export const mppDirectorySnapshots = pgTable("mpp_directory_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),
  totalServices: integer("total_services").notNull().default(0),
  activeServices: integer("active_services").notNull().default(0),
  categoryBreakdown: jsonb("category_breakdown"),
  pricingModelBreakdown: jsonb("pricing_model_breakdown"),
  paymentMethodBreakdown: jsonb("payment_method_breakdown"),
  priceStats: jsonb("price_stats"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_mpp_snapshot_date").on(table.snapshotDate),
]);

export const mppProbes = pgTable("mpp_probes", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  endpointUrl: text("endpoint_url").notNull(),
  probeStatus: text("probe_status").notNull(),  // success | no_mpp | error | timeout | unreachable
  httpStatus: integer("http_status"),
  hasMpp: boolean("has_mpp").notNull().default(false),
  paymentMethods: jsonb("payment_methods"),     // parsed from WWW-Authenticate: Payment headers
  tempoAddress: text("tempo_address"),
  challengeData: jsonb("challenge_data"),
  responseHeaders: jsonb("response_headers"),
  probedAt: timestamp("probed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_mpp_probes_agent").on(table.agentId),
  index("idx_mpp_probes_has_mpp").on(table.hasMpp),
  index("idx_mpp_probes_tempo_addr").on(table.tempoAddress),
  index("idx_mpp_probes_probed_at").on(table.probedAt),
]);

export const insertMppDirectoryServiceSchema = createInsertSchema(mppDirectoryServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMppDirectorySnapshotSchema = createInsertSchema(mppDirectorySnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertMppProbeSchema = createInsertSchema(mppProbes).omit({
  id: true,
  probedAt: true,
  createdAt: true,
});

export type MppDirectoryService = typeof mppDirectoryServices.$inferSelect;
export type InsertMppDirectoryService = z.infer<typeof insertMppDirectoryServiceSchema>;
export type MppDirectorySnapshot = typeof mppDirectorySnapshots.$inferSelect;
export type InsertMppDirectorySnapshot = z.infer<typeof insertMppDirectorySnapshotSchema>;
export type MppProbe = typeof mppProbes.$inferSelect;
export type InsertMppProbe = z.infer<typeof insertMppProbeSchema>;
```

- [ ] **Step 2: Re-export from `shared/schema.ts`**

Append to the end of `shared/schema.ts`:

```ts
// --- MPP (Machine Payments Protocol) ---
export {
  mppDirectoryServices,
  mppDirectorySnapshots,
  mppProbes,
  insertMppDirectoryServiceSchema,
  insertMppDirectorySnapshotSchema,
  insertMppProbeSchema,
  type MppDirectoryService,
  type InsertMppDirectoryService,
  type MppDirectorySnapshot,
  type InsertMppDirectorySnapshot,
  type MppProbe,
  type InsertMppProbe,
} from "./mpp-schema.js";
// --- End MPP ---
```

- [ ] **Step 3: Generate the migration SQL**

Run: `npm run db:generate`

Expected: creates `migrations/0002_<name>.sql` or similar. Rename to `migrations/0002_mpp_integration.sql` if needed.

If generation fails (schema drift), write the migration manually:

```sql
CREATE TABLE "mpp_directory_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_url" text NOT NULL,
	"service_name" text,
	"provider_name" text,
	"description" text,
	"category" text DEFAULT 'other' NOT NULL,
	"pricing_model" text,
	"price_amount" text,
	"price_currency" text,
	"payment_methods" jsonb,
	"recipient_address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mpp_service_url" ON "mpp_directory_services" USING btree ("service_url");--> statement-breakpoint
CREATE INDEX "idx_mpp_service_category" ON "mpp_directory_services" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_mpp_service_is_active" ON "mpp_directory_services" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_mpp_service_last_seen" ON "mpp_directory_services" USING btree ("last_seen_at");--> statement-breakpoint

CREATE TABLE "mpp_directory_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"total_services" integer DEFAULT 0 NOT NULL,
	"active_services" integer DEFAULT 0 NOT NULL,
	"category_breakdown" jsonb,
	"pricing_model_breakdown" jsonb,
	"payment_method_breakdown" jsonb,
	"price_stats" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mpp_snapshot_date" ON "mpp_directory_snapshots" USING btree ("snapshot_date");--> statement-breakpoint

CREATE TABLE "mpp_probes" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"endpoint_url" text NOT NULL,
	"probe_status" text NOT NULL,
	"http_status" integer,
	"has_mpp" boolean DEFAULT false NOT NULL,
	"payment_methods" jsonb,
	"tempo_address" text,
	"challenge_data" jsonb,
	"response_headers" jsonb,
	"probed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mpp_probes" ADD CONSTRAINT "mpp_probes_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mpp_probes_agent" ON "mpp_probes" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_mpp_probes_has_mpp" ON "mpp_probes" USING btree ("has_mpp");--> statement-breakpoint
CREATE INDEX "idx_mpp_probes_tempo_addr" ON "mpp_probes" USING btree ("tempo_address");--> statement-breakpoint
CREATE INDEX "idx_mpp_probes_probed_at" ON "mpp_probes" USING btree ("probed_at");
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). Schema is a leaf file; no downstream references yet.

- [ ] **Step 5: Commit**

```bash
git add shared/mpp-schema.ts shared/schema.ts migrations/0002_mpp_integration.sql
git commit -m "feat(schema): add MPP integration tables

Adds mpp_directory_services, mpp_directory_snapshots, and mpp_probes
tables. Re-exported from shared/schema.ts for consumer imports.
Migration file included — apply to Supabase via SQL editor per
existing schema-owner conventions (trustadd_app DB user cannot
create tables)."
```

> **Note on applying:** Do not run `drizzle-kit push`. Per `CLAUDE.md`, the `trustadd_app` DB user lacks ownership. Apply SQL manually via Supabase SQL editor after merge to main.

---

## Task 2: Add Tempo chain configuration

**Files:**
- Modify: `shared/chains.ts`

- [ ] **Step 1: Inspect existing file**

Read `shared/chains.ts` to confirm naming conventions (e.g. camelCase vs snake_case in config objects).

- [ ] **Step 2: Append Tempo config export**

Add at the end of `shared/chains.ts` (do NOT add to `CHAIN_CONFIGS` array — Tempo is not an ERC-8004 chain):

```ts
// --- Tempo Chain (MPP) ---
// Tempo is a purpose-built L1 for MPP payments. Not in CHAIN_CONFIGS
// because the ERC-8004 indexer loop does not apply here.
export const TEMPO_CHAIN_CONFIG = {
  chainId: 4217,
  name: "Tempo",
  shortName: "tempo",
  rpcUrl: process.env.TEMPO_RPC_URL || "https://rpc.tempo.xyz",
  rpcUrlFallback: process.env.TEMPO_RPC_URL_FALLBACK,
  explorer: "https://explore.mainnet.tempo.xyz",
  // Tempo has no native gas token; native currency is a placeholder.
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 6 },
  tokens: {
    pathUSD: {
      address: "0x20c0000000000000000000000000000000000000",
      symbol: "pathUSD",
      decimals: 6,
    },
  },
  deploymentBlock: parseInt(process.env.TEMPO_PATHUSD_DEPLOYMENT_BLOCK || "0", 10),
} as const;

export const TEMPO_CHAIN_ID = 4217;
// --- End Tempo Chain ---
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add shared/chains.ts
git commit -m "feat(chains): add Tempo chain config (chain ID 4217)

Exported separately from CHAIN_CONFIGS so the existing ERC-8004
blockchain-indexer loop is untouched. Supports primary + fallback
RPC via TEMPO_RPC_URL / TEMPO_RPC_URL_FALLBACK env vars."
```

---

## Task 3: Write WWW-Authenticate: Payment header parser tests

**Files:**
- Create: `__tests__/fixtures/mpp-challenges.ts`
- Create: `__tests__/mpp-auth-header.test.ts`

- [ ] **Step 1: Create fixture file**

Create `__tests__/fixtures/mpp-challenges.ts`:

```ts
// Sample WWW-Authenticate: Payment headers from MPP spec (IETF draft-ryan-httpauth-payment-00)
// Note: request is base64url-encoded JSON; use Buffer to decode in tests.

export const SINGLE_TEMPO_CHARGE = {
  header: `Payment id="abc123", realm="api.example.com", method="tempo", intent="charge", request="eyJhbW91bnQiOiIwLjAxIiwiY3VycmVuY3kiOiIweDIwYzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCJyZWNpcGllbnQiOiIweDEyMzRhYmNkMTIzNGFiY2QxMjM0YWJjZDEyMzRhYmNkMTIzNGFiY2QifQ"`,
  expected: {
    id: "abc123",
    realm: "api.example.com",
    method: "tempo",
    intent: "charge",
    request: {
      amount: "0.01",
      currency: "0x20c0000000000000000000000000000000000000",
      recipient: "0x1234abcd1234abcd1234abcd1234abcd1234abcd",
    },
  },
};

export const MULTI_METHOD = {
  headers: [
    `Payment id="tmp1", realm="api.example.com", method="tempo", intent="charge", request="eyJhbW91bnQiOiIwLjAxIn0"`,
    `Payment id="str1", realm="api.example.com", method="stripe", intent="charge", request="eyJhbW91bnQiOiIwLjAxIn0"`,
  ],
  expectedMethods: ["tempo", "stripe"],
};

export const MALFORMED_HEADER = {
  header: `Payment id="x`,
  expected: null,
};

export const NON_PAYMENT_AUTH = {
  header: `Bearer realm="api.example.com"`,
  expected: null,
};
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/mpp-auth-header.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parsePaymentAuthHeader, parseAllPaymentAuthHeaders } from "../server/mpp-prober.js";
import {
  SINGLE_TEMPO_CHARGE,
  MULTI_METHOD,
  MALFORMED_HEADER,
  NON_PAYMENT_AUTH,
} from "./fixtures/mpp-challenges.js";

describe("parsePaymentAuthHeader", () => {
  it("parses a single Tempo charge challenge with base64url-decoded request", () => {
    const parsed = parsePaymentAuthHeader(SINGLE_TEMPO_CHARGE.header);
    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe(SINGLE_TEMPO_CHARGE.expected.id);
    expect(parsed?.realm).toBe(SINGLE_TEMPO_CHARGE.expected.realm);
    expect(parsed?.method).toBe(SINGLE_TEMPO_CHARGE.expected.method);
    expect(parsed?.intent).toBe(SINGLE_TEMPO_CHARGE.expected.intent);
    expect(parsed?.request).toEqual(SINGLE_TEMPO_CHARGE.expected.request);
  });

  it("returns null for a malformed header", () => {
    expect(parsePaymentAuthHeader(MALFORMED_HEADER.header)).toBeNull();
  });

  it("returns null for a non-Payment auth scheme", () => {
    expect(parsePaymentAuthHeader(NON_PAYMENT_AUTH.header)).toBeNull();
  });
});

describe("parseAllPaymentAuthHeaders", () => {
  it("parses multiple methods advertised on one endpoint", () => {
    const parsed = parseAllPaymentAuthHeaders(MULTI_METHOD.headers);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((p) => p.method)).toEqual(MULTI_METHOD.expectedMethods);
  });

  it("filters out malformed entries", () => {
    const parsed = parseAllPaymentAuthHeaders([MULTI_METHOD.headers[0], MALFORMED_HEADER.header]);
    expect(parsed).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `npx vitest run __tests__/mpp-auth-header.test.ts`
Expected: FAIL — module `../server/mpp-prober.js` does not exist.

---

## Task 4: Implement MPP payment challenge parser

**Files:**
- Create: `server/mpp-prober.ts` (parser functions only for now; full prober in later task)

- [ ] **Step 1: Implement parser functions**

Create `server/mpp-prober.ts`:

```ts
/**
 * MPP endpoint prober and WWW-Authenticate: Payment header parser.
 *
 * MPP challenge format (IETF draft-ryan-httpauth-payment-00):
 *   WWW-Authenticate: Payment id="<id>", realm="<domain>", method="<method>",
 *     intent="<intent>", request="<base64url-encoded JSON>"
 *
 * Multiple Payment headers can coexist on one response; the client picks one.
 */

export interface ParsedPaymentChallenge {
  id: string;
  realm: string;
  method: string;      // tempo | stripe | lightning | ...
  intent: string;      // charge | stream | session
  request: Record<string, unknown> | null;
  raw: string;
}

/**
 * Parse a single WWW-Authenticate: Payment header value.
 * Returns null if the header is not a valid Payment challenge.
 */
export function parsePaymentAuthHeader(header: string): ParsedPaymentChallenge | null {
  if (!header) return null;

  // Strip optional leading "Payment " scheme token
  const trimmed = header.trim();
  const match = /^Payment\s+(.*)$/i.exec(trimmed);
  if (!match) return null;

  const params = parseAuthParams(match[1]);
  if (!params.id || !params.method) return null;

  let decodedRequest: Record<string, unknown> | null = null;
  if (params.request) {
    try {
      const json = base64UrlDecode(params.request);
      decodedRequest = JSON.parse(json);
    } catch {
      // Preserve raw challenge even if request payload is unreadable
      decodedRequest = null;
    }
  }

  return {
    id: params.id,
    realm: params.realm ?? "",
    method: params.method,
    intent: params.intent ?? "charge",
    request: decodedRequest,
    raw: header,
  };
}

/**
 * Parse multiple WWW-Authenticate header values (multi-method endpoints).
 * Non-Payment and malformed entries are filtered out.
 */
export function parseAllPaymentAuthHeaders(headers: string[]): ParsedPaymentChallenge[] {
  const out: ParsedPaymentChallenge[] = [];
  for (const h of headers) {
    const parsed = parsePaymentAuthHeader(h);
    if (parsed) out.push(parsed);
  }
  return out;
}

// --- internals ---

function parseAuthParams(input: string): Record<string, string> {
  // Parses comma-separated `key="value"` pairs, respecting quoted strings.
  const result: Record<string, string> = {};
  const re = /(\w+)\s*=\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    result[m[1]] = m[2].replace(/\\(.)/g, "$1");
  }
  return result;
}

function base64UrlDecode(input: string): string {
  // base64url -> base64
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run __tests__/mpp-auth-header.test.ts`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add server/mpp-prober.ts __tests__/mpp-auth-header.test.ts __tests__/fixtures/mpp-challenges.ts
git commit -m "feat(mpp): add WWW-Authenticate: Payment header parser

Implements parsePaymentAuthHeader and parseAllPaymentAuthHeaders
per IETF draft-ryan-httpauth-payment-00. Decodes base64url
request payloads. Handles multiple methods per endpoint."
```

---

## Task 5: Implement MPP prober (endpoint probing + payment extraction)

**Files:**
- Modify: `server/mpp-prober.ts` (extend with probe logic)
- Modify: `server/storage.ts` (add MPP prober storage stubs — see Task 10 for full impl)

- [ ] **Step 1: Add probe logic to `server/mpp-prober.ts`**

Append to `server/mpp-prober.ts`:

```ts
// --- Probing ---

import type { InsertMppProbe } from "../shared/schema.js";
import { sleep, createLogger } from "./lib/indexer-utils.js";
import { TEMPO_CHAIN_ID } from "../shared/chains.js";

const log = createLogger("mpp-prober");

const PROBE_TIMEOUT_MS = 5_000;
const MAX_CONCURRENT = 2;
const STALE_HOURS = 24;
const INTER_PROBE_DELAY_MS = 200;

const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^169\.254\.\d+\.\d+$/,
  /^\[::1?\]$/,
  /^metadata\.google/i,
  /^metadata\.aws/i,
];

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (BLOCKED_HOSTS.some((p) => p.test(parsed.hostname))) return false;
    return true;
  } catch {
    return false;
  }
}

export interface MppProbeResult {
  probeStatus: "success" | "no_mpp" | "error" | "timeout" | "unreachable";
  httpStatus: number | null;
  hasMpp: boolean;
  paymentMethods: ParsedPaymentChallenge[] | null;
  tempoAddress: string | null;
  challengeData: Record<string, unknown> | null;
  responseHeaders: Record<string, string> | null;
}

/**
 * Extract all WWW-Authenticate header values from a Headers object.
 * fetch() combines duplicates into a comma-separated string, so we split carefully.
 */
function getWwwAuthenticateValues(headers: Headers): string[] {
  const raw = headers.get("www-authenticate");
  if (!raw) return [];
  // Split on commas that sit between two Payment/Bearer/... scheme names, not inside quotes.
  // Simple heuristic: split on ", Scheme " boundaries.
  const parts: string[] = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') depth = depth === 0 ? 1 : 0;
    if (ch === "," && depth === 0 && /\s+[A-Z]\w*\s/.test(raw.slice(i, i + 30))) {
      parts.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/**
 * Pick a Tempo recipient address from a parsed payment method, if available.
 * The address may live in the decoded `request` payload under various keys.
 */
function extractTempoAddress(challenges: ParsedPaymentChallenge[]): string | null {
  for (const c of challenges) {
    if (c.method !== "tempo") continue;
    const req = c.request ?? {};
    const keys = ["recipient", "payTo", "pay_to", "address", "to"];
    for (const k of keys) {
      const v = (req as Record<string, unknown>)[k];
      if (typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v)) return v;
    }
  }
  return null;
}

export async function probeMppEndpoint(url: string): Promise<MppProbeResult> {
  const empty: MppProbeResult = {
    probeStatus: "error",
    httpStatus: null,
    hasMpp: false,
    paymentMethods: null,
    tempoAddress: null,
    challengeData: null,
    responseHeaders: null,
  };

  if (!isSafeUrl(url)) return empty;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "TrustAdd/1.0 (mpp-prober; https://trustadd.com)",
        "Accept": "application/json, */*",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    if (response.status !== 402) {
      return { ...empty, probeStatus: "no_mpp", httpStatus: response.status, responseHeaders: headers };
    }

    const authValues = getWwwAuthenticateValues(response.headers);
    const challenges = parseAllPaymentAuthHeaders(authValues);

    if (challenges.length === 0) {
      return { ...empty, probeStatus: "no_mpp", httpStatus: 402, responseHeaders: headers };
    }

    const tempoAddress = extractTempoAddress(challenges);

    return {
      probeStatus: "success",
      httpStatus: 402,
      hasMpp: true,
      paymentMethods: challenges,
      tempoAddress,
      challengeData: { challenges: challenges.map((c) => ({ method: c.method, intent: c.intent, request: c.request })) },
      responseHeaders: headers,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") return { ...empty, probeStatus: "timeout" };
    return { ...empty, probeStatus: err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" ? "unreachable" : "error" };
  }
}

/**
 * Probe all HTTP endpoints for the given agent. Writes probe results to the
 * mpp_probes table and upserts any discovered Tempo recipients into
 * transaction_sync_state so the tempo indexer picks them up.
 */
export async function probeAgentForMpp(agentId: string): Promise<number> {
  const { storage } = await import("./storage.js");
  const agent = await storage.getAgent(agentId);
  if (!agent || !agent.endpoints || !Array.isArray(agent.endpoints)) return 0;

  const httpEndpoints = (agent.endpoints as any[]).filter(
    (ep) => ep.endpoint && typeof ep.endpoint === "string" && ep.endpoint.startsWith("http"),
  );

  let probed = 0;
  for (const ep of httpEndpoints) {
    const recent = await storage.getRecentMppProbeForEndpoint(agentId, ep.endpoint);
    if (recent && (Date.now() - new Date(recent.probedAt).getTime()) < STALE_HOURS * 60 * 60 * 1000) {
      continue;
    }

    const result = await probeMppEndpoint(ep.endpoint);

    const insert: InsertMppProbe = {
      agentId,
      endpointUrl: ep.endpoint,
      probeStatus: result.probeStatus,
      httpStatus: result.httpStatus,
      hasMpp: result.hasMpp,
      paymentMethods: result.paymentMethods as unknown as any,
      tempoAddress: result.tempoAddress,
      challengeData: result.challengeData as unknown as any,
      responseHeaders: result.responseHeaders as unknown as any,
    };
    await storage.createMppProbe(insert);
    probed++;

    if (result.hasMpp && result.tempoAddress) {
      await storage.upsertTransactionSyncState({
        paymentAddress: result.tempoAddress,
        chainId: TEMPO_CHAIN_ID,
        lastSyncedBlock: 0,
      });
      log.info(`MPP endpoint for ${agent.name || agentId}: tempo=${result.tempoAddress}`);
    }

    if (probed < httpEndpoints.length) await sleep(INTER_PROBE_DELAY_MS);
  }

  return probed;
}

export async function probeAllAgentsForMpp(options?: { deadlineMs?: number }): Promise<{
  total: number; probed: number; foundMpp: number; tempoAddresses: number; errors: number; skippedDueToTimeout: number;
}> {
  const { storage } = await import("./storage.js");
  const { runWithConcurrency } = await import("./lib/indexer-utils.js");

  const ids = await storage.getStaleMppProbeAgentIds(STALE_HOURS);
  log.info(`Found ${ids.length} agents to MPP-probe`);

  let totalProbed = 0;
  let errors = 0;
  let skippedDueToTimeout = 0;
  const deadline = options?.deadlineMs;

  await runWithConcurrency(
    ids,
    async (agentId) => {
      if (deadline && Date.now() > deadline) { skippedDueToTimeout++; return; }
      try {
        totalProbed += await probeAgentForMpp(agentId);
      } catch (err) {
        errors++;
        log.error(`MPP probe failed for ${agentId}`, { error: (err as Error).message });
      }
    },
    MAX_CONCURRENT,
    { interItemDelayMs: INTER_PROBE_DELAY_MS },
  );

  const stats = await storage.getMppProbeStats();
  log.info(`MPP probe cycle complete: probed=${totalProbed} foundMpp=${stats.foundMpp} tempoAddresses=${stats.tempoAddresses}`);

  return {
    total: ids.length,
    probed: totalProbed,
    foundMpp: stats.foundMpp,
    tempoAddresses: stats.tempoAddresses,
    errors,
    skippedDueToTimeout,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: FAIL — `storage.getRecentMppProbeForEndpoint`, `storage.createMppProbe`, `storage.getStaleMppProbeAgentIds`, `storage.getMppProbeStats` don't exist yet. This is expected; we'll add them in Task 10.

- [ ] **Step 3: Commit (WIP — TypeScript errors will be resolved in Task 10)**

```bash
git add server/mpp-prober.ts
git commit -m "feat(mpp): add MPP endpoint prober (extends parser module)

probeMppEndpoint handles 402 challenges, parses all
WWW-Authenticate: Payment headers, extracts Tempo recipient
addresses, and writes to mpp_probes. Multi-method support
per IETF draft. Uses 5s timeout + SSRF blocklist identical
to x402-prober.

NOTE: storage methods are stubbed and will be filled in Task 10."
```

---

## Task 6: Write directory source interface tests

**Files:**
- Create: `__tests__/mpp-directory.test.ts`

- [ ] **Step 1: Write failing tests for directory source**

```ts
import { describe, it, expect } from "vitest";
import { MppScrapeSource, MppApiSource, classifyMppService } from "../server/mpp-directory.js";

describe("MppScrapeSource", () => {
  it("parses HTML service listing into RawMppService records", async () => {
    const html = `<html><body>
      <div class="service" data-url="https://browserbase.com/api/v1/sessions">
        <h3>Browserbase</h3>
        <p>Headless browsers, pay per session</p>
        <span class="price">$0.02 pathUSD</span>
      </div>
      <div class="service" data-url="https://example.com/api">
        <h3>Example API</h3>
        <p>Data service</p>
      </div>
    </body></html>`;
    const src = new MppScrapeSource({ fetchImpl: async () => new Response(html) });
    const services = await src.fetchServices();
    expect(services.length).toBeGreaterThanOrEqual(1);
    expect(services[0].serviceUrl).toContain("browserbase.com");
  });

  it("returns empty array when directory is unreachable", async () => {
    const src = new MppScrapeSource({ fetchImpl: async () => { throw new Error("Network down"); } });
    await expect(src.fetchServices()).resolves.toEqual([]);
  });
});

describe("MppApiSource", () => {
  it("parses JSON response into RawMppService records", async () => {
    const body = JSON.stringify({
      services: [
        { url: "https://fal.ai/api", name: "fal.ai", category: "ai-model", price: "0.01" },
      ],
    });
    const src = new MppApiSource({ fetchImpl: async () => new Response(body, { status: 200 }) });
    const services = await src.fetchServices();
    expect(services).toHaveLength(1);
    expect(services[0].serviceName).toBe("fal.ai");
  });
});

describe("classifyMppService", () => {
  it("classifies an AI model service", () => {
    expect(classifyMppService("GPT-4 inference API", "https://openai.com/v1/chat")).toBe("ai-model");
  });

  it("classifies a dev-infra service", () => {
    expect(classifyMppService("Blockchain RPC provider", "https://quicknode.com/rpc")).toBe("dev-infra");
  });

  it("defaults to 'other' for unknown service", () => {
    expect(classifyMppService("Random service", "https://example.com")).toBe("other");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run __tests__/mpp-directory.test.ts`
Expected: FAIL — `server/mpp-directory.js` does not exist.

---

## Task 7: Implement MPP directory source module

**Files:**
- Create: `server/mpp-directory.ts`

- [ ] **Step 1: Create directory source abstraction**

```ts
/**
 * MPP Payments Directory source abstraction.
 *
 * MPP is 4 weeks old; the directory format may change. This module
 * offers two pluggable sources (API or HTML scrape) behind a common
 * interface so implementations can swap without touching the indexer.
 */

import { createLogger } from "./lib/indexer-utils.js";

const log = createLogger("mpp-directory");

const DIRECTORY_URL = "https://mpp.dev/services";
const DIRECTORY_API_URL = "https://mpp.dev/api/services";

export interface RawMppService {
  serviceUrl: string;
  serviceName: string | null;
  providerName: string | null;
  description: string | null;
  category: string;
  pricingModel: string | null;   // charge | stream | session | null
  priceAmount: string | null;
  priceCurrency: string | null;
  paymentMethods: Array<{ method: string; currency?: string; recipient?: string }>;
  recipientAddress: string | null;
  metadata: Record<string, unknown> | null;
}

export interface MppDirectorySource {
  fetchServices(): Promise<RawMppService[]>;
  healthCheck(): Promise<boolean>;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

// --- API source ---

export class MppApiSource implements MppDirectorySource {
  private fetchImpl: FetchFn;

  constructor(options: { fetchImpl?: FetchFn } = {}) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchFn);
  }

  async fetchServices(): Promise<RawMppService[]> {
    try {
      const resp = await this.fetchImpl(DIRECTORY_API_URL);
      if (!resp.ok) {
        log.warn(`Directory API returned ${resp.status}`);
        return [];
      }
      const data = await resp.json();
      const raw = Array.isArray(data) ? data : (data.services || data.items || []);
      return raw.map(this.normalize).filter(Boolean) as RawMppService[];
    } catch (err) {
      log.error("Directory API fetch failed", { error: (err as Error).message });
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await this.fetchImpl(DIRECTORY_API_URL, { method: "HEAD" });
      return resp.ok;
    } catch {
      return false;
    }
  }

  private normalize = (entry: any): RawMppService | null => {
    if (!entry?.url && !entry?.serviceUrl) return null;
    const url = entry.url || entry.serviceUrl;
    const name = entry.name || entry.serviceName || null;
    const description = entry.description ?? null;
    return {
      serviceUrl: url,
      serviceName: name,
      providerName: entry.provider || null,
      description,
      category: typeof entry.category === "string" ? entry.category : classifyMppService(description, url),
      pricingModel: entry.pricingModel || entry.intent || null,
      priceAmount: entry.price != null ? String(entry.price) : (entry.amount != null ? String(entry.amount) : null),
      priceCurrency: entry.currency || entry.priceCurrency || null,
      paymentMethods: Array.isArray(entry.paymentMethods) ? entry.paymentMethods : [],
      recipientAddress: entry.recipient || entry.payTo || null,
      metadata: entry,
    };
  };
}

// --- Scrape source ---

export class MppScrapeSource implements MppDirectorySource {
  private fetchImpl: FetchFn;

  constructor(options: { fetchImpl?: FetchFn } = {}) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchFn);
  }

  async fetchServices(): Promise<RawMppService[]> {
    try {
      const resp = await this.fetchImpl(DIRECTORY_URL);
      if (!resp.ok) {
        log.warn(`Directory page returned ${resp.status}`);
        return [];
      }
      const html = await resp.text();
      return parseDirectoryHtml(html);
    } catch (err) {
      log.error("Directory scrape failed", { error: (err as Error).message });
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await this.fetchImpl(DIRECTORY_URL, { method: "HEAD" });
      return resp.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Defensive HTML parser. Extracts service entries from the mpp.dev/services
 * page using robust heuristics. Uses minimal regex parsing — if the page
 * structure changes we emit a Sentry alert via onFailure and keep the
 * last-successful snapshot.
 */
export function parseDirectoryHtml(html: string): RawMppService[] {
  const services: RawMppService[] = [];
  // Heuristic: look for data-url attributes or anchor tags with service URLs.
  // Pattern: <div class="service" data-url="..."> or <a href="..." class="service-link">
  const urlPattern = /data-url\s*=\s*"([^"]+)"/g;
  const namePattern = /<h[23][^>]*>([^<]+)<\/h[23]>/g;
  const descPattern = /<p[^>]*>([^<]+)<\/p>/g;

  let urlMatch;
  while ((urlMatch = urlPattern.exec(html)) !== null) {
    const url = urlMatch[1];
    if (!url.startsWith("http")) continue;

    // Look for nearby name + description within ~2KB after the match
    const windowStart = urlMatch.index;
    const windowEnd = Math.min(html.length, windowStart + 2048);
    const window = html.slice(windowStart, windowEnd);

    const nameMatches = [...window.matchAll(namePattern)];
    const descMatches = [...window.matchAll(descPattern)];
    const name = nameMatches[0]?.[1]?.trim() ?? null;
    const description = descMatches[0]?.[1]?.trim() ?? null;

    services.push({
      serviceUrl: url,
      serviceName: name,
      providerName: null,
      description,
      category: classifyMppService(description, url),
      pricingModel: null,
      priceAmount: null,
      priceCurrency: null,
      paymentMethods: [],
      recipientAddress: null,
      metadata: { source: "scrape", scrapedAt: new Date().toISOString() },
    });
  }
  return services;
}

// --- Classifier ---

/**
 * Lightweight classifier for MPP services. Mirrors server/bazaar-classify.ts
 * but tuned for MPP categories (payment model differences).
 */
export function classifyMppService(description: string | null, url: string | null): string {
  const text = `${description ?? ""} ${url ?? ""}`.toLowerCase();
  if (/\b(gpt|llm|claude|openai|anthropic|model|inference|ai|ml|embedding)\b/.test(text)) return "ai-model";
  if (/\b(rpc|node|blockchain|alchemy|quicknode|infura|dune|explorer)\b/.test(text)) return "dev-infra";
  if (/\b(compute|gpu|sandbox|vm|browser|crawl|scrape|browserbase)\b/.test(text)) return "compute";
  if (/\b(data|database|analytics|feed|oracle)\b/.test(text)) return "data";
  if (/\b(shop|buy|order|product|commerce|store|food|merchant)\b/.test(text)) return "commerce";
  return "other";
}

// --- Factory ---

export function createDirectorySource(mode: "api" | "scrape" | "auto" = "auto"): MppDirectorySource {
  if (mode === "api") return new MppApiSource();
  if (mode === "scrape") return new MppScrapeSource();
  // auto: default to scrape (safer initial bet per the spec)
  return new MppScrapeSource();
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run __tests__/mpp-directory.test.ts`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add server/mpp-directory.ts __tests__/mpp-directory.test.ts
git commit -m "feat(mpp): add directory source abstraction (API + scrape)

MppDirectorySource interface with two implementations
(MppApiSource, MppScrapeSource). Starts with scrape per spec
since mpp.dev API shape is unknown; swap to API when Tempo
ships a formal directory endpoint. Includes MPP-specific
category classifier."
```

---

## Task 8: Write Tempo log decoder tests

**Files:**
- Create: `__tests__/fixtures/tempo-logs.ts`
- Create: `__tests__/tempo-log-decoder.test.ts`

- [ ] **Step 1: Create fixture**

```ts
// __tests__/fixtures/tempo-logs.ts
// Realistic log entries returned by eth_getLogs on Tempo pathUSD contract.

// Transfer(address indexed from, address indexed to, uint256 value)
// topic0 = keccak("Transfer(address,address,uint256)")
//        = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
export const TEMPO_TRANSFER_LOG = {
  address: "0x20c0000000000000000000000000000000000000",
  topics: [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x0000000000000000000000001111111111111111111111111111111111111111", // from (padded)
    "0x0000000000000000000000002222222222222222222222222222222222222222", // to (padded)
  ],
  data: "0x00000000000000000000000000000000000000000000000000000000000f4240", // 1_000_000 = 1 pathUSD (6 decimals)
  blockNumber: "0x1234",
  blockHash: "0xabc",
  transactionHash: "0xdeadbeef",
  transactionIndex: "0x0",
  logIndex: "0x0",
  removed: false,
};

// TransferWithMemo(address indexed from, address indexed to, uint256 value, bytes32 indexed memo)
// topic0 = placeholder hash (to be confirmed against Tempo spec during impl; use fixture for tests)
export const TEMPO_TRANSFER_WITH_MEMO_LOG = {
  address: "0x20c0000000000000000000000000000000000000",
  topics: [
    "0x" + "a".repeat(64), // placeholder event sig
    "0x0000000000000000000000001111111111111111111111111111111111111111",
    "0x0000000000000000000000002222222222222222222222222222222222222222",
    "0x6d656d6f31323300000000000000000000000000000000000000000000000000", // memo "memo123"
  ],
  data: "0x00000000000000000000000000000000000000000000000000000000001e8480", // 2_000_000 = 2 pathUSD
  blockNumber: "0x1235",
  blockHash: "0xdef",
  transactionHash: "0xfeedface",
  transactionIndex: "0x1",
  logIndex: "0x0",
  removed: false,
};

export const EXPECTED_TRANSFER = {
  from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222",
  amount: "1.0", // 1 pathUSD
  amountRaw: "1000000",
  txHash: "0xdeadbeef",
  blockNumber: 0x1234,
};
```

- [ ] **Step 2: Write failing decoder tests**

Create `__tests__/tempo-log-decoder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decodeTransferLog, decodeTransferWithMemoLog } from "../server/tempo-transaction-indexer.js";
import { TEMPO_TRANSFER_LOG, TEMPO_TRANSFER_WITH_MEMO_LOG, EXPECTED_TRANSFER } from "./fixtures/tempo-logs.js";

describe("decodeTransferLog", () => {
  it("decodes a pathUSD Transfer event with 6-decimal amount parsing", () => {
    const result = decodeTransferLog(TEMPO_TRANSFER_LOG);
    expect(result.from).toBe(EXPECTED_TRANSFER.from);
    expect(result.to).toBe(EXPECTED_TRANSFER.to);
    expect(result.amountRaw).toBe(EXPECTED_TRANSFER.amountRaw);
    expect(result.amount).toBe(EXPECTED_TRANSFER.amount);
    expect(result.txHash).toBe(EXPECTED_TRANSFER.txHash);
    expect(result.blockNumber).toBe(EXPECTED_TRANSFER.blockNumber);
    expect(result.memo).toBeNull();
  });
});

describe("decodeTransferWithMemoLog", () => {
  it("decodes memo as hex-decoded ASCII string", () => {
    const result = decodeTransferWithMemoLog(TEMPO_TRANSFER_WITH_MEMO_LOG);
    expect(result.memo).toContain("memo123");
    expect(result.amountRaw).toBe("2000000");
    expect(result.amount).toBe("2.0");
  });
});
```

- [ ] **Step 3: Verify test fails**

Run: `npx vitest run __tests__/tempo-log-decoder.test.ts`
Expected: FAIL — module does not exist.

---

## Task 9: Implement Tempo transaction indexer (decoder + indexing loop)

**Files:**
- Create: `server/tempo-transaction-indexer.ts`

- [ ] **Step 1: Create module with log decoders + indexing loop**

```ts
/**
 * Tempo chain (ID 4217) transaction indexer for MPP payments.
 *
 * Queries pathUSD Transfer + TransferWithMemo events via eth_getLogs,
 * writes matches against known tracked payment addresses into
 * agent_transactions with category="mpp_payment".
 *
 * Tempo quirks handled:
 * - No native gas token: we never query eth_getBalance
 * - Tx type 0x76: we only read event logs, which are standard eth_getLogs
 * - Simplex BFT finality: no reorgs, safe to index up to head
 */

import { createLogger, sleep, retryWithBackoff } from "./lib/indexer-utils.js";
import { TEMPO_CHAIN_CONFIG, TEMPO_CHAIN_ID } from "../shared/chains.js";
import type { InsertAgentTransaction } from "../shared/schema.js";

const log = createLogger("tempo-tx-indexer");

const BLOCK_WINDOW = 10_000;
const MAX_CONCURRENT_ADDRESSES = 2;
const RPC_RETRY_ATTEMPTS = 3;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// Placeholder topic for TransferWithMemo. Confirm during impl via Tempo source;
// until then, fall back to standard Transfer only and skip memo decoding.
const TRANSFER_WITH_MEMO_TOPIC = process.env.TEMPO_TRANSFER_WITH_MEMO_TOPIC ?? null;

// --- Decoders (pure functions for testability) ---

export interface DecodedTransfer {
  from: string;
  to: string;
  amountRaw: string;
  amount: string;       // human-readable, 6-decimal
  txHash: string;
  blockNumber: number;
  logIndex: number;
  memo: string | null;
}

function topicToAddress(topic: string): string {
  // Topic is 32 bytes, address is last 20 bytes
  return "0x" + topic.slice(-40).toLowerCase();
}

function formatAmount(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === 0n) return `${whole}.0`;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

export function decodeTransferLog(logEntry: {
  address: string; topics: string[]; data: string;
  blockNumber: string; transactionHash: string; logIndex: string;
}): DecodedTransfer {
  const amountRaw = BigInt(logEntry.data);
  return {
    from: topicToAddress(logEntry.topics[1]),
    to: topicToAddress(logEntry.topics[2]),
    amountRaw: amountRaw.toString(),
    amount: formatAmount(amountRaw, TEMPO_CHAIN_CONFIG.tokens.pathUSD.decimals),
    txHash: logEntry.transactionHash,
    blockNumber: parseInt(logEntry.blockNumber, 16),
    logIndex: parseInt(logEntry.logIndex, 16),
    memo: null,
  };
}

export function decodeTransferWithMemoLog(logEntry: {
  address: string; topics: string[]; data: string;
  blockNumber: string; transactionHash: string; logIndex: string;
}): DecodedTransfer {
  const base = decodeTransferLog(logEntry);
  // topics[3] is bytes32 memo — hex-decode, trim null bytes
  const memoHex = logEntry.topics[3] || "";
  let memo: string | null = null;
  if (memoHex && memoHex.length === 66) {
    const bytes = Buffer.from(memoHex.slice(2), "hex");
    memo = bytes.toString("utf-8").replace(/\0+$/, "");
    if (!memo) memo = memoHex;
  }
  return { ...base, memo };
}

// --- RPC helper ---

interface EthGetLogsFilter {
  address: string;
  topics: (string | null | string[])[];
  fromBlock: string;
  toBlock: string;
}

async function rpcCall<T = unknown>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!resp.ok) throw new Error(`RPC ${method} failed: ${resp.status}`);
  const json = await resp.json() as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`RPC ${method} error: ${json.error.message}`);
  return json.result as T;
}

async function getLogsWithFallback(filter: EthGetLogsFilter): Promise<any[]> {
  const primary = TEMPO_CHAIN_CONFIG.rpcUrl;
  const fallback = TEMPO_CHAIN_CONFIG.rpcUrlFallback;

  try {
    return await retryWithBackoff(() => rpcCall<any[]>(primary, "eth_getLogs", [filter]), {
      maxAttempts: RPC_RETRY_ATTEMPTS,
      baseDelayMs: 1000,
    });
  } catch (err) {
    if (!fallback) throw err;
    log.warn("Primary RPC failed, trying fallback", { error: (err as Error).message });
    return await retryWithBackoff(() => rpcCall<any[]>(fallback, "eth_getLogs", [filter]), {
      maxAttempts: RPC_RETRY_ATTEMPTS,
      baseDelayMs: 1000,
    });
  }
}

async function getLatestBlock(): Promise<number> {
  const hex = await retryWithBackoff(
    () => rpcCall<string>(TEMPO_CHAIN_CONFIG.rpcUrl, "eth_blockNumber", []),
    { maxAttempts: RPC_RETRY_ATTEMPTS, baseDelayMs: 1000 },
  );
  return parseInt(hex, 16);
}

// --- Indexing loop ---

export async function indexAddressInboundTransfers(
  address: string,
  fromBlock: number,
  toBlock: number,
): Promise<DecodedTransfer[]> {
  const paddedAddress = "0x" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const pathUsdAddress = TEMPO_CHAIN_CONFIG.tokens.pathUSD.address;

  const results: DecodedTransfer[] = [];
  let cursor = fromBlock;

  while (cursor <= toBlock) {
    const windowEnd = Math.min(cursor + BLOCK_WINDOW - 1, toBlock);
    const filter: EthGetLogsFilter = {
      address: pathUsdAddress,
      topics: [TRANSFER_TOPIC, null, paddedAddress],
      fromBlock: `0x${cursor.toString(16)}`,
      toBlock: `0x${windowEnd.toString(16)}`,
    };
    const logs = await getLogsWithFallback(filter);
    for (const entry of logs) results.push(decodeTransferLog(entry));

    if (TRANSFER_WITH_MEMO_TOPIC) {
      const memoFilter: EthGetLogsFilter = { ...filter, topics: [TRANSFER_WITH_MEMO_TOPIC, null, paddedAddress] };
      const memoLogs = await getLogsWithFallback(memoFilter);
      for (const entry of memoLogs) results.push(decodeTransferWithMemoLog(entry));
    }

    cursor = windowEnd + 1;
  }
  return results;
}

export async function syncAllTempoTransactions(): Promise<{ addresses: number; transfers: number; errors: number; }> {
  const { storage } = await import("./storage.js");
  const { runWithConcurrency } = await import("./lib/indexer-utils.js");

  const syncStates = await storage.getTransactionSyncStatesForChain(TEMPO_CHAIN_ID);
  log.info(`Tempo sync: ${syncStates.length} tracked addresses`);

  const latestBlock = await getLatestBlock();
  let totalTransfers = 0;
  let errors = 0;

  await runWithConcurrency(
    syncStates,
    async (state) => {
      const fromBlock = Math.max(state.lastSyncedBlock + 1, TEMPO_CHAIN_CONFIG.deploymentBlock || 0);
      if (fromBlock > latestBlock) return;
      try {
        const transfers = await indexAddressInboundTransfers(state.paymentAddress, fromBlock, latestBlock);

        for (const t of transfers) {
          const agent = await storage.getAgentByTempoAddress(t.to);
          if (!agent) continue;
          const record: InsertAgentTransaction = {
            agentId: agent.id,
            chainId: TEMPO_CHAIN_ID,
            txHash: t.txHash,
            transferId: `tempo-${t.txHash}-${t.logIndex}`,
            fromAddress: t.from,
            toAddress: t.to,
            tokenAddress: TEMPO_CHAIN_CONFIG.tokens.pathUSD.address,
            tokenSymbol: "pathUSD",
            amount: t.amount,
            amountUsd: parseFloat(t.amount),
            blockNumber: t.blockNumber,
            blockTimestamp: new Date(), // Populated by BlockTimestamp lookup below; default now for fallback
            category: "mpp_payment",
            metadata: t.memo ? { memo: t.memo } : null,
          };
          await storage.upsertAgentTransaction(record);
          totalTransfers++;
        }

        await storage.updateTransactionSyncState(state.paymentAddress, TEMPO_CHAIN_ID, latestBlock);
      } catch (err) {
        errors++;
        log.error(`Tempo sync failed for ${state.paymentAddress}`, { error: (err as Error).message });
      }
    },
    MAX_CONCURRENT_ADDRESSES,
    { interItemDelayMs: 250 },
  );

  return { addresses: syncStates.length, transfers: totalTransfers, errors };
}
```

- [ ] **Step 2: Run decoder tests**

Run: `npx vitest run __tests__/tempo-log-decoder.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: FAIL — `storage.getTransactionSyncStatesForChain`, `storage.getAgentByTempoAddress`, `storage.upsertAgentTransaction`, `storage.updateTransactionSyncState` not all defined yet. Expected; resolved in Task 10.

- [ ] **Step 4: Commit**

```bash
git add server/tempo-transaction-indexer.ts __tests__/tempo-log-decoder.test.ts __tests__/fixtures/tempo-logs.ts
git commit -m "feat(mpp): add Tempo chain transaction indexer

Decodes pathUSD Transfer events (6-decimal amounts) via
eth_getLogs. Handles optional TransferWithMemo events if
TEMPO_TRANSFER_WITH_MEMO_TOPIC env var is set. Paginated
by 10K-block windows with retry + RPC fallback. Writes to
agent_transactions with chainId=4217 and category='mpp_payment'."
```

---

## Task 10: Implement storage layer for MPP

**Files:**
- Create: `server/storage/mpp.ts`
- Modify: `server/storage.ts` (add MPP methods to `IStorage` + delegate)

- [ ] **Step 1: Create `server/storage/mpp.ts`**

```ts
import { db } from "../db.js";
import { sql, eq, desc, and, gt, isNotNull, inArray } from "drizzle-orm";
import {
  mppDirectoryServices,
  mppDirectorySnapshots,
  mppProbes,
  agentTransactions,
  transactionSyncState,
  agents,
  x402Probes,
  type InsertMppDirectoryService,
  type InsertMppDirectorySnapshot,
  type InsertMppProbe,
  type MppDirectoryService,
  type MppProbe,
  type InsertTransactionSyncState,
  type TransactionSyncState,
  type InsertAgentTransaction,
  type Agent,
} from "../../shared/schema.js";

// --- Directory services ---

export async function upsertMppDirectoryService(record: InsertMppDirectoryService): Promise<void> {
  await db.insert(mppDirectoryServices)
    .values(record)
    .onConflictDoUpdate({
      target: mppDirectoryServices.serviceUrl,
      set: {
        serviceName: record.serviceName,
        providerName: record.providerName,
        description: record.description,
        category: record.category,
        pricingModel: record.pricingModel,
        priceAmount: record.priceAmount,
        priceCurrency: record.priceCurrency,
        paymentMethods: record.paymentMethods,
        recipientAddress: record.recipientAddress,
        isActive: true,
        lastSeenAt: new Date(),
        metadata: record.metadata,
        updatedAt: new Date(),
      },
    });
}

export async function markMppServicesInactive(beforeDate: Date): Promise<number> {
  const result = await db.execute(sql`
    UPDATE mpp_directory_services
    SET is_active = false, updated_at = now()
    WHERE last_seen_at < ${beforeDate} AND is_active = true
  `);
  return (result as any).rowCount ?? 0;
}

export async function listMppServices(options: {
  limit?: number;
  offset?: number;
  category?: string;
  paymentMethod?: string;
  search?: string;
} = {}): Promise<{ services: MppDirectoryService[]; total: number }> {
  const conds: any[] = [eq(mppDirectoryServices.isActive, true)];
  if (options.category) conds.push(eq(mppDirectoryServices.category, options.category));
  if (options.search) conds.push(sql`${mppDirectoryServices.serviceName} ILIKE ${"%" + options.search + "%"}`);
  // paymentMethod requires jsonb array contains check:
  if (options.paymentMethod) {
    conds.push(sql`${mppDirectoryServices.paymentMethods} @> ${JSON.stringify([{ method: options.paymentMethod }])}::jsonb`);
  }

  const where = and(...conds);
  const rows = await db.select().from(mppDirectoryServices)
    .where(where)
    .orderBy(desc(mppDirectoryServices.lastSeenAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM mpp_directory_services WHERE is_active = true
    ${options.category ? sql`AND category = ${options.category}` : sql``}
  `);
  const total = Number((countResult.rows[0] as any).n);
  return { services: rows, total };
}

export async function getMppDirectoryStats(): Promise<{
  totalServices: number;
  activeServices: number;
  categoryBreakdown: Record<string, number>;
  pricingModelBreakdown: Record<string, number>;
  paymentMethodBreakdown: Record<string, number>;
  priceStats: { median: number; mean: number; min: number; max: number } | null;
  snapshotDate: string | null;
}> {
  const catRes = await db.execute(sql`
    SELECT category, COUNT(*)::int AS n FROM mpp_directory_services WHERE is_active = true GROUP BY category
  `);
  const categoryBreakdown: Record<string, number> = {};
  for (const row of catRes.rows as any[]) categoryBreakdown[row.category] = Number(row.n);

  const pmRes = await db.execute(sql`
    SELECT pricing_model, COUNT(*)::int AS n FROM mpp_directory_services
    WHERE is_active = true AND pricing_model IS NOT NULL GROUP BY pricing_model
  `);
  const pricingModelBreakdown: Record<string, number> = {};
  for (const row of pmRes.rows as any[]) pricingModelBreakdown[row.pricing_model] = Number(row.n);

  const methodRes = await db.execute(sql`
    SELECT jsonb_array_elements(payment_methods)->>'method' AS method, COUNT(*)::int AS n
    FROM mpp_directory_services
    WHERE is_active = true AND jsonb_array_length(payment_methods) > 0
    GROUP BY method
  `);
  const paymentMethodBreakdown: Record<string, number> = {};
  for (const row of methodRes.rows as any[]) paymentMethodBreakdown[row.method] = Number(row.n);

  const priceRes = await db.execute(sql`
    SELECT
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (price_amount)::numeric) AS median,
      AVG((price_amount)::numeric) AS mean,
      MIN((price_amount)::numeric) AS min,
      MAX((price_amount)::numeric) AS max
    FROM mpp_directory_services
    WHERE is_active = true AND price_amount ~ '^[0-9.]+$'
  `);
  const priceRow = priceRes.rows[0] as any;
  const priceStats = priceRow?.median != null
    ? { median: Number(priceRow.median), mean: Number(priceRow.mean), min: Number(priceRow.min), max: Number(priceRow.max) }
    : null;

  const counts = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_active)::int AS active
    FROM mpp_directory_services
  `);
  const crow = counts.rows[0] as any;

  const snap = await db.execute(sql`SELECT snapshot_date FROM mpp_directory_snapshots ORDER BY snapshot_date DESC LIMIT 1`);
  const snapDate = (snap.rows[0] as any)?.snapshot_date ?? null;

  return {
    totalServices: Number(crow.total),
    activeServices: Number(crow.active),
    categoryBreakdown,
    pricingModelBreakdown,
    paymentMethodBreakdown,
    priceStats,
    snapshotDate: snapDate,
  };
}

// --- Snapshots ---

export async function createMppSnapshot(record: InsertMppDirectorySnapshot): Promise<void> {
  await db.insert(mppDirectorySnapshots).values(record).onConflictDoNothing();
}

export async function getMppDirectoryTrends(days: number = 30): Promise<any[]> {
  const rows = await db.select().from(mppDirectorySnapshots)
    .orderBy(desc(mppDirectorySnapshots.snapshotDate))
    .limit(days);
  return rows.reverse();
}

// --- Probes ---

export async function createMppProbe(record: InsertMppProbe): Promise<void> {
  await db.insert(mppProbes).values(record);
}

export async function getRecentMppProbeForEndpoint(agentId: string, endpointUrl: string): Promise<MppProbe | undefined> {
  const rows = await db.select().from(mppProbes)
    .where(and(eq(mppProbes.agentId, agentId), eq(mppProbes.endpointUrl, endpointUrl)))
    .orderBy(desc(mppProbes.probedAt)).limit(1);
  return rows[0];
}

export async function getStaleMppProbeAgentIds(staleHours: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000);
  // Agents with endpoints whose last MPP probe is stale OR never probed
  const res = await db.execute(sql`
    SELECT a.id FROM agents a
    WHERE a.endpoints IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM mpp_probes p
      WHERE p.agent_id = a.id AND p.probed_at > ${cutoff}
    )
    LIMIT 2000
  `);
  return (res.rows as any[]).map((r) => r.id);
}

export async function getMppProbeStats(): Promise<{ foundMpp: number; tempoAddresses: number }> {
  const res = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE has_mpp)::int AS found,
      COUNT(DISTINCT tempo_address) FILTER (WHERE tempo_address IS NOT NULL)::int AS addrs
    FROM mpp_probes
  `);
  const row = res.rows[0] as any;
  return { foundMpp: Number(row.found), tempoAddresses: Number(row.addrs) };
}

// --- Reused-table helpers (Tempo-specific views of transaction_sync_state + agents + agent_transactions) ---

export async function getTransactionSyncStatesForChain(chainId: number): Promise<TransactionSyncState[]> {
  return await db.select().from(transactionSyncState).where(eq(transactionSyncState.chainId, chainId));
}

export async function upsertTransactionSyncState(record: InsertTransactionSyncState): Promise<void> {
  await db.insert(transactionSyncState)
    .values(record)
    .onConflictDoUpdate({
      target: [transactionSyncState.paymentAddress, transactionSyncState.chainId],
      set: { lastSyncedAt: new Date() },
    });
}

export async function updateTransactionSyncState(paymentAddress: string, chainId: number, lastSyncedBlock: number): Promise<void> {
  await db.update(transactionSyncState)
    .set({ lastSyncedBlock, lastSyncedAt: new Date() })
    .where(and(eq(transactionSyncState.paymentAddress, paymentAddress), eq(transactionSyncState.chainId, chainId)));
}

export async function upsertAgentTransaction(record: InsertAgentTransaction): Promise<void> {
  await db.insert(agentTransactions)
    .values(record)
    .onConflictDoNothing({ target: [agentTransactions.transferId, agentTransactions.chainId] });
}

export async function getAgentByTempoAddress(address: string): Promise<Agent | undefined> {
  // Look up by recent MPP probe that wrote this address
  const res = await db.select({ agentId: mppProbes.agentId }).from(mppProbes)
    .where(eq(mppProbes.tempoAddress, address)).limit(1);
  if (res.length === 0) return undefined;
  const rows = await db.select().from(agents).where(eq(agents.id, res[0].agentId)).limit(1);
  return rows[0];
}

// --- Cross-protocol analytics ---

export async function getMultiProtocolAgentIds(): Promise<string[]> {
  const res = await db.execute(sql`
    WITH x402_agents AS (
      SELECT DISTINCT agent_id FROM x402_probes
      WHERE probe_status = 'success' AND payment_address IS NOT NULL
    ),
    mpp_agents AS (
      SELECT DISTINCT agent_id FROM mpp_probes WHERE has_mpp = true
    )
    SELECT a.id
    FROM agents a
    JOIN x402_agents x ON x.agent_id = a.id
    JOIN mpp_agents m ON m.agent_id = a.id
  `);
  return (res.rows as any[]).map((r) => r.id);
}

export async function getMppAdoptionStats(): Promise<{ mpp: number; x402: number; both: number }> {
  const res = await db.execute(sql`
    WITH mpp_a AS (SELECT DISTINCT agent_id FROM mpp_probes WHERE has_mpp = true),
         x402_a AS (SELECT DISTINCT agent_id FROM x402_probes WHERE probe_status='success' AND payment_address IS NOT NULL)
    SELECT
      (SELECT COUNT(*) FROM mpp_a)::int  AS mpp,
      (SELECT COUNT(*) FROM x402_a)::int AS x402,
      (SELECT COUNT(*) FROM mpp_a INNER JOIN x402_a USING (agent_id))::int AS both
  `);
  const row = res.rows[0] as any;
  return { mpp: Number(row.mpp), x402: Number(row.x402), both: Number(row.both) };
}

export async function getMppTempoChainStats(): Promise<{ volume: number; txCount: number; uniquePayers: number; activeRecipients: number }> {
  const res = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount_usd), 0)::float AS volume,
      COUNT(*)::int AS tx,
      COUNT(DISTINCT from_address)::int AS payers,
      COUNT(DISTINCT to_address)::int AS recipients
    FROM agent_transactions
    WHERE chain_id = 4217 AND category = 'mpp_payment'
  `);
  const row = res.rows[0] as any;
  return {
    volume: Number(row.volume),
    txCount: Number(row.tx),
    uniquePayers: Number(row.payers),
    activeRecipients: Number(row.recipients),
  };
}
```

- [ ] **Step 2: Wire into `server/storage.ts`**

Add to the `IStorage` interface in `server/storage.ts` (after existing x402/bazaar methods):

```ts
  // --- MPP ---
  upsertMppDirectoryService(record: import("../shared/schema.js").InsertMppDirectoryService): Promise<void>;
  markMppServicesInactive(beforeDate: Date): Promise<number>;
  listMppServices(options?: { limit?: number; offset?: number; category?: string; paymentMethod?: string; search?: string }): Promise<{ services: import("../shared/schema.js").MppDirectoryService[]; total: number }>;
  getMppDirectoryStats(): Promise<Awaited<ReturnType<typeof import("./storage/mpp.js").getMppDirectoryStats>>>;
  createMppSnapshot(record: import("../shared/schema.js").InsertMppDirectorySnapshot): Promise<void>;
  getMppDirectoryTrends(days?: number): Promise<any[]>;
  createMppProbe(record: import("../shared/schema.js").InsertMppProbe): Promise<void>;
  getRecentMppProbeForEndpoint(agentId: string, endpointUrl: string): Promise<import("../shared/schema.js").MppProbe | undefined>;
  getStaleMppProbeAgentIds(staleHours: number): Promise<string[]>;
  getMppProbeStats(): Promise<{ foundMpp: number; tempoAddresses: number }>;
  getTransactionSyncStatesForChain(chainId: number): Promise<import("../shared/schema.js").TransactionSyncState[]>;
  upsertTransactionSyncState(record: import("../shared/schema.js").InsertTransactionSyncState): Promise<void>;
  updateTransactionSyncState(paymentAddress: string, chainId: number, lastSyncedBlock: number): Promise<void>;
  upsertAgentTransaction(record: import("../shared/schema.js").InsertAgentTransaction): Promise<void>;
  getAgentByTempoAddress(address: string): Promise<import("../shared/schema.js").Agent | undefined>;
  getMultiProtocolAgentIds(): Promise<string[]>;
  getMppAdoptionStats(): Promise<{ mpp: number; x402: number; both: number }>;
  getMppTempoChainStats(): Promise<{ volume: number; txCount: number; uniquePayers: number; activeRecipients: number }>;
```

Add an import at the top:

```ts
import * as mppQueries from "./storage/mpp.js";
```

Add delegator methods in the `DatabaseStorage` class (follows existing pattern — one line per method):

```ts
  upsertMppDirectoryService = mppQueries.upsertMppDirectoryService;
  markMppServicesInactive = mppQueries.markMppServicesInactive;
  listMppServices = mppQueries.listMppServices;
  getMppDirectoryStats = mppQueries.getMppDirectoryStats;
  createMppSnapshot = mppQueries.createMppSnapshot;
  getMppDirectoryTrends = mppQueries.getMppDirectoryTrends;
  createMppProbe = mppQueries.createMppProbe;
  getRecentMppProbeForEndpoint = mppQueries.getRecentMppProbeForEndpoint;
  getStaleMppProbeAgentIds = mppQueries.getStaleMppProbeAgentIds;
  getMppProbeStats = mppQueries.getMppProbeStats;
  getTransactionSyncStatesForChain = mppQueries.getTransactionSyncStatesForChain;
  upsertTransactionSyncState = mppQueries.upsertTransactionSyncState;
  updateTransactionSyncState = mppQueries.updateTransactionSyncState;
  upsertAgentTransaction = mppQueries.upsertAgentTransaction;
  getAgentByTempoAddress = mppQueries.getAgentByTempoAddress;
  getMultiProtocolAgentIds = mppQueries.getMultiProtocolAgentIds;
  getMppAdoptionStats = mppQueries.getMppAdoptionStats;
  getMppTempoChainStats = mppQueries.getMppTempoChainStats;
```

- [ ] **Step 3: Run the full TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS. All references from Tasks 5 and 9 now resolve.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: PASS. Existing 184 tests still pass; new parser/directory/decoder tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/storage/mpp.ts server/storage.ts
git commit -m "feat(mpp): add storage layer for MPP integration

Adds server/storage/mpp.ts with directory/probe/snapshot queries,
cross-protocol analytics, and Tempo-specific transaction_sync_state
helpers. Wired into IStorage interface + DatabaseStorage delegators
following the existing one-line-per-method pattern."
```

---

## Task 11: Write storage integration tests

**Files:**
- Create: `__tests__/mpp-storage.test.ts`

- [ ] **Step 1: Write integration tests against an in-memory/mocked storage**

Since the codebase currently doesn't include full DB integration tests, we mirror the existing `__tests__/sybil-detection.test.ts` style — validate query shapes rather than DB round-trip. Focus on the SQL-heavy functions.

```ts
import { describe, it, expect, vi } from "vitest";

// These tests run the MPP storage functions against a mocked `db` object,
// asserting the correct SQL shapes and argument bindings. They are smoke-level
// integration tests — full DB round-trip tests require a fixture DB which is
// out of scope for this phase.

describe("MPP storage query shapes", () => {
  it("getMppAdoptionStats emits a 3-value result from mpp/x402 CTEs", async () => {
    // Setup: mock db.execute
    const mockExecute = vi.fn().mockResolvedValue({
      rows: [{ mpp: 5, x402: 12, both: 3 }],
    });
    vi.doMock("../server/db.js", () => ({ db: { execute: mockExecute }, pool: {} }));
    const { getMppAdoptionStats } = await import("../server/storage/mpp.js");
    const stats = await getMppAdoptionStats();
    expect(stats).toEqual({ mpp: 5, x402: 12, both: 3 });
    expect(mockExecute).toHaveBeenCalledOnce();
    // Verify the SQL contains key predicates
    const call = mockExecute.mock.calls[0][0];
    const sqlText = JSON.stringify(call);
    expect(sqlText).toContain("mpp_probes");
    expect(sqlText).toContain("x402_probes");
    vi.doUnmock("../server/db.js");
  });

  it("getMultiProtocolAgentIds returns array of agent IDs", async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      rows: [{ id: "agent-1" }, { id: "agent-2" }],
    });
    vi.doMock("../server/db.js", () => ({ db: { execute: mockExecute }, pool: {} }));
    const { getMultiProtocolAgentIds } = await import("../server/storage/mpp.js");
    const ids = await getMultiProtocolAgentIds();
    expect(ids).toEqual(["agent-1", "agent-2"]);
    vi.doUnmock("../server/db.js");
  });

  it("getMppTempoChainStats filters by chain_id=4217 and category=mpp_payment", async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      rows: [{ volume: 12.34, tx: 5, payers: 3, recipients: 2 }],
    });
    vi.doMock("../server/db.js", () => ({ db: { execute: mockExecute }, pool: {} }));
    const { getMppTempoChainStats } = await import("../server/storage/mpp.js");
    const stats = await getMppTempoChainStats();
    expect(stats.volume).toBe(12.34);
    expect(stats.txCount).toBe(5);
    const sqlText = JSON.stringify(mockExecute.mock.calls[0][0]);
    expect(sqlText).toContain("4217");
    expect(sqlText).toContain("mpp_payment");
    vi.doUnmock("../server/db.js");
  });
});
```

- [ ] **Step 2: Run and verify**

Run: `npx vitest run __tests__/mpp-storage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add __tests__/mpp-storage.test.ts
git commit -m "test(mpp): add storage layer query-shape tests

Smoke tests for getMppAdoptionStats, getMultiProtocolAgentIds,
and getMppTempoChainStats — validates SQL predicates without
requiring a fixture DB."
```

---

## Task 12: Add MPP API routes

**Files:**
- Create: `server/routes/mpp.ts`
- Modify: `server/routes.ts` (register router)

- [ ] **Step 1: Create routes module**

```ts
import type { Express } from "express";
import { createLogger } from "../lib/logger.js";
import { storage } from "../storage.js";
import { cached, ANALYTICS_CACHE, ANALYTICS_TTL, redactAgentForPublic } from "./helpers.js";

const logger = createLogger("routes:mpp");

// Feature flag: skip entirely if MPP UI is not enabled
const ENABLE_MPP = process.env.ENABLE_MPP_UI === "true";

export function registerMppRoutes(app: Express): void {
  if (!ENABLE_MPP) {
    logger.info("MPP routes not registered (ENABLE_MPP_UI!=true)");
    return;
  }

  // --- Directory ---

  app.get("/api/mpp/directory/stats", async (_req, res) => {
    try {
      const data = await cached("mpp:directory:stats", ANALYTICS_TTL, () => storage.getMppDirectoryStats());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("mpp directory stats failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch MPP directory stats" });
    }
  });

  app.get("/api/mpp/directory/services", async (req, res) => {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
      const offset = (page - 1) * limit;

      const result = await storage.listMppServices({
        limit,
        offset,
        category: req.query.category as string | undefined,
        paymentMethod: req.query.paymentMethod as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.set("Cache-Control", "public, s-maxage=60");
      res.json({ ...result, page, limit });
    } catch (err) {
      logger.error("mpp services list failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to list MPP services" });
    }
  });

  app.get("/api/mpp/directory/trends", async (req, res) => {
    try {
      const days = Math.min(parseInt((req.query.days as string) || "30", 10), 180);
      const data = await cached(`mpp:directory:trends:${days}`, 60 * 60 * 1000, () => storage.getMppDirectoryTrends(days));
      res.set("Cache-Control", "public, s-maxage=3600");
      res.json(data);
    } catch (err) {
      logger.error("mpp trends failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch MPP trends" });
    }
  });

  app.get("/api/mpp/directory/top-providers", async (_req, res) => {
    try {
      const data = await cached("mpp:directory:top-providers", ANALYTICS_TTL, async () => {
        const { db } = await import("../db.js");
        const { sql } = await import("drizzle-orm");
        const res = await db.execute(sql`
          SELECT provider_name, COUNT(*)::int AS service_count
          FROM mpp_directory_services
          WHERE is_active = true AND provider_name IS NOT NULL
          GROUP BY provider_name
          ORDER BY service_count DESC
          LIMIT 20
        `);
        return res.rows;
      });
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("mpp top providers failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch top providers" });
    }
  });

  // --- Adoption ---

  app.get("/api/mpp/adoption", async (_req, res) => {
    try {
      const data = await cached("mpp:adoption", ANALYTICS_TTL, () => storage.getMppAdoptionStats());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("mpp adoption failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch MPP adoption stats" });
    }
  });

  app.get("/api/mpp/probes/recent", async (req, res) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 100);
      const { db } = await import("../db.js");
      const { mppProbes } = await import("../../shared/schema.js");
      const { desc, eq } = await import("drizzle-orm");
      const rows = await db.select().from(mppProbes)
        .where(eq(mppProbes.hasMpp, true))
        .orderBy(desc(mppProbes.probedAt))
        .limit(limit);
      res.set("Cache-Control", "public, s-maxage=60");
      res.json(rows);
    } catch (err) {
      logger.error("mpp recent probes failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch recent probes" });
    }
  });

  // --- Chain analytics ---

  app.get("/api/mpp/chain/stats", async (_req, res) => {
    try {
      const data = await cached("mpp:chain:stats", ANALYTICS_TTL, () => storage.getMppTempoChainStats());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("mpp chain stats failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch Tempo chain stats" });
    }
  });

  app.get("/api/mpp/chain/volume-trend", async (req, res) => {
    try {
      const days = Math.min(parseInt((req.query.days as string) || "30", 10), 180);
      const data = await cached(`mpp:chain:volume-trend:${days}`, 60 * 60 * 1000, async () => {
        const { db } = await import("../db.js");
        const { sql } = await import("drizzle-orm");
        const res = await db.execute(sql`
          SELECT date_trunc('day', block_timestamp)::date AS day,
                 SUM(amount_usd)::float AS volume,
                 COUNT(*)::int AS tx_count
          FROM agent_transactions
          WHERE chain_id = 4217 AND category = 'mpp_payment'
            AND block_timestamp >= now() - (${days} * interval '1 day')
          GROUP BY day ORDER BY day
        `);
        return res.rows;
      });
      res.set("Cache-Control", "public, s-maxage=3600");
      res.json(data);
    } catch (err) {
      logger.error("mpp volume-trend failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch volume trend" });
    }
  });

  // --- Cross-protocol ---

  app.get("/api/ecosystem/protocol-comparison", async (_req, res) => {
    try {
      const data = await cached("ecosystem:protocol-comparison", ANALYTICS_TTL, async () => {
        const mpp = await storage.getMppTempoChainStats();
        const mppDir = await storage.getMppDirectoryStats();
        // x402 bazaar stats
        const { db } = await import("../db.js");
        const { sql } = await import("drizzle-orm");
        const bazaarRes = await db.execute(sql`
          SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active
          FROM bazaar_services
        `);
        const bazaar = bazaarRes.rows[0] as any;

        const adoption = await storage.getMppAdoptionStats();

        return {
          x402: {
            directoryServices: Number(bazaar.total),
            activeServices: Number(bazaar.active),
          },
          mpp: {
            directoryServices: mppDir.totalServices,
            activeServices: mppDir.activeServices,
            volume: mpp.volume,
            txCount: mpp.txCount,
          },
          adoption,
        };
      });
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("protocol comparison failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch protocol comparison" });
    }
  });

  app.get("/api/ecosystem/multi-protocol-agents", async (_req, res) => {
    try {
      const data = await cached("ecosystem:multi-protocol-agents", ANALYTICS_TTL, async () => {
        const ids = await storage.getMultiProtocolAgentIds();
        const limited = ids.slice(0, 100);
        const agentList = [];
        for (const id of limited) {
          const agent = await storage.getAgent(id);
          if (agent) agentList.push(redactAgentForPublic(agent as unknown as Record<string, unknown>));
        }
        return { total: ids.length, agents: agentList };
      });
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("multi-protocol agents failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch multi-protocol agents" });
    }
  });
}
```

- [ ] **Step 2: Register in `server/routes.ts`**

Replace the file contents with:

```ts
import type { Express } from "express";
import { type Server } from "http";
import { registerStatusRoutes } from "./routes/status.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerTrustRoutes } from "./routes/trust.js";
import { registerMppRoutes } from "./routes/mpp.js";

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
  registerMppRoutes(app);
}
```

- [ ] **Step 3: Verify TypeScript + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routes/mpp.ts server/routes.ts
git commit -m "feat(mpp): add /api/mpp and /api/ecosystem routes

10 new public endpoints:
- /api/mpp/directory/{stats,services,trends,top-providers}
- /api/mpp/adoption, /api/mpp/probes/recent
- /api/mpp/chain/{stats,volume-trend}
- /api/ecosystem/{protocol-comparison,multi-protocol-agents}

Gated by ENABLE_MPP_UI=true. Routes only register when flag is set.
Multi-protocol agents go through redactAgentForPublic per free-tier rules."
```

---

## Task 13: Add admin manual-trigger endpoints

**Files:**
- Modify: `server/routes/admin.ts`

- [ ] **Step 1: Add 3 endpoints at the end of `registerAdminRoutes`**

Add before the closing `}` of `registerAdminRoutes`:

```ts
  app.post("/api/admin/mpp/probe-all", requireAdmin(), async (_req, res) => {
    try {
      res.json({ message: "MPP probe started", status: "running" });
      const { probeAllAgentsForMpp } = await import("../mpp-prober.js");
      probeAllAgentsForMpp().catch((err) =>
        logger.error("Manual MPP probe failed", { error: (err as Error).message }),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to start MPP probe" });
    }
  });

  app.post("/api/admin/mpp/index-directory", requireAdmin(), async (_req, res) => {
    try {
      res.json({ message: "MPP directory index started", status: "running" });
      (async () => {
        const { createDirectorySource } = await import("../mpp-directory.js");
        const mode = (process.env.MPP_DIRECTORY_SOURCE as "api" | "scrape" | "auto") || "auto";
        const source = createDirectorySource(mode);
        const services = await source.fetchServices();
        for (const s of services) {
          await storage.upsertMppDirectoryService({
            serviceUrl: s.serviceUrl,
            serviceName: s.serviceName,
            providerName: s.providerName,
            description: s.description,
            category: s.category,
            pricingModel: s.pricingModel,
            priceAmount: s.priceAmount,
            priceCurrency: s.priceCurrency,
            paymentMethods: s.paymentMethods,
            recipientAddress: s.recipientAddress,
            metadata: s.metadata,
          });
        }
      })().catch((err) => logger.error("Manual directory index failed", { error: (err as Error).message }));
    } catch (err) {
      res.status(500).json({ error: "Failed to start directory index" });
    }
  });

  app.post("/api/admin/mpp/index-tempo", requireAdmin(), async (_req, res) => {
    try {
      res.json({ message: "Tempo sync started", status: "running" });
      const { syncAllTempoTransactions } = await import("../tempo-transaction-indexer.js");
      syncAllTempoTransactions().catch((err) =>
        logger.error("Manual Tempo sync failed", { error: (err as Error).message }),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to start Tempo sync" });
    }
  });
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/routes/admin.ts
git commit -m "feat(mpp): add admin manual-trigger endpoints

POST /api/admin/mpp/probe-all, /api/admin/mpp/index-directory,
and /api/admin/mpp/index-tempo. Gated by existing cookie-based
admin auth. Useful for initial bootstrap and debugging."
```

---

## Task 14: Add Trigger.dev task — MPP prober

**Files:**
- Create: `trigger/mpp-prober.ts`

- [ ] **Step 1: Create task file**

```ts
import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const mppProberTask = schedules.task({
  id: "mpp-prober",
  cron: "30 3 * * *",
  maxDuration: 600,
  run: async (_payload) => {
    if (process.env.ENABLE_MPP_INDEXER !== "true") {
      logger.info("MPP prober disabled (ENABLE_MPP_INDEXER!=true)");
      return { skipped: true };
    }

    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      metadata.set("phase", "probing");
      const { probeAllAgentsForMpp } = await import("../server/mpp-prober");
      const result = await probeAllAgentsForMpp({ deadlineMs: Date.now() + 540_000 });

      metadata.set("totalAgents", result.total);
      metadata.set("probed", result.probed);
      metadata.set("foundMpp", result.foundMpp);
      metadata.set("tempoAddresses", result.tempoAddresses);
      metadata.set("errors", result.errors);
      metadata.set("skippedDueToTimeout", result.skippedDueToTimeout);
      logger.info("MPP probe cycle complete", { result });

      const cost = usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("computeCostCents", cost.totalCostInCents);

      try {
        const { recordSuccess } = await import("../server/pipeline-health");
        await recordSuccess("mpp-prober", "MPP Endpoint Prober");
      } catch {}
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("mpp-prober failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      try {
        const { notifyJobFailure } = await import("./alert");
        await notifyJobFailure("mpp-prober", error);
      } catch {}
      try {
        const { recordFailure } = await import("../server/pipeline-health");
        await recordFailure("mpp-prober", "MPP Endpoint Prober", error.message);
      } catch {}
      return { error: error.message };
    }
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add trigger/mpp-prober.ts
git commit -m "feat(trigger): add mpp-prober task (daily 3:30 AM UTC)

Wraps server/mpp-prober.probeAllAgentsForMpp with 540s time
budget inside a 600s maxDuration window. Feature-flagged by
ENABLE_MPP_INDEXER. Pipeline health reporting mirrors x402-prober."
```

---

## Task 15: Add Trigger.dev task — MPP directory indexer

**Files:**
- Create: `trigger/mpp-directory-indexer.ts`

- [ ] **Step 1: Create task file**

```ts
import { schedules, logger, metadata } from "@trigger.dev/sdk/v3";

export const mppDirectoryIndexerTask = schedules.task({
  id: "mpp-directory-indexer",
  cron: "30 4 * * *",
  maxDuration: 600,
  run: async (_payload) => {
    if (process.env.ENABLE_MPP_INDEXER !== "true") {
      logger.info("MPP directory indexer disabled");
      return { skipped: true };
    }

    metadata.set("status", "starting");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { storage } = await import("../server/storage.js");
      const { createDirectorySource } = await import("../server/mpp-directory.js");
      const mode = (process.env.MPP_DIRECTORY_SOURCE as "api" | "scrape" | "auto") || "auto";
      const source = createDirectorySource(mode);

      const runStartedAt = new Date();

      metadata.set("phase", "fetching");
      const services = await source.fetchServices();
      metadata.set("fetched", services.length);
      logger.info(`MPP directory fetch: ${services.length} services via ${mode}`);

      metadata.set("phase", "upserting");
      let upserted = 0;
      for (const s of services) {
        try {
          await storage.upsertMppDirectoryService({
            serviceUrl: s.serviceUrl,
            serviceName: s.serviceName,
            providerName: s.providerName,
            description: s.description,
            category: s.category,
            pricingModel: s.pricingModel,
            priceAmount: s.priceAmount,
            priceCurrency: s.priceCurrency,
            paymentMethods: s.paymentMethods,
            recipientAddress: s.recipientAddress,
            metadata: s.metadata,
          });
          upserted++;
        } catch (err) {
          logger.warn(`Failed to upsert ${s.serviceUrl}`, { error: (err as Error).message });
        }
      }
      metadata.set("upserted", upserted);

      if (upserted > 0) {
        const inactive = await storage.markMppServicesInactive(runStartedAt);
        metadata.set("markedInactive", inactive);
      }

      metadata.set("phase", "snapshot");
      const stats = await storage.getMppDirectoryStats();
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await storage.createMppSnapshot({
        snapshotDate: today.toISOString().slice(0, 10),
        totalServices: stats.totalServices,
        activeServices: stats.activeServices,
        categoryBreakdown: stats.categoryBreakdown,
        pricingModelBreakdown: stats.pricingModelBreakdown,
        paymentMethodBreakdown: stats.paymentMethodBreakdown,
        priceStats: stats.priceStats,
      });

      metadata.set("status", "completed");
      try {
        const { recordSuccess } = await import("../server/pipeline-health");
        await recordSuccess("mpp-directory-indexer", "MPP Directory Indexer");
      } catch {}
      return { fetched: services.length, upserted };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("mpp-directory-indexer failed", { error: error.message });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      try {
        const { notifyJobFailure } = await import("./alert");
        await notifyJobFailure("mpp-directory-indexer", error);
      } catch {}
      try {
        const { recordFailure } = await import("../server/pipeline-health");
        await recordFailure("mpp-directory-indexer", "MPP Directory Indexer", error.message);
      } catch {}
      return { error: error.message };
    }
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add trigger/mpp-directory-indexer.ts
git commit -m "feat(trigger): add mpp-directory-indexer task (daily 4:30 UTC)

Fetches MPP Payments Directory via configurable source
(MPP_DIRECTORY_SOURCE=api|scrape|auto). Upserts into
mpp_directory_services, marks stale services inactive,
writes daily snapshot. Feature-flagged by ENABLE_MPP_INDEXER."
```

---

## Task 16: Add Trigger.dev task — Tempo transaction indexer

**Files:**
- Create: `trigger/tempo-transaction-indexer.ts`

- [ ] **Step 1: Create task file**

```ts
import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const tempoTransactionIndexerTask = schedules.task({
  id: "tempo-transaction-indexer",
  cron: "0 */6 * * *",
  maxDuration: 600,
  run: async (_payload) => {
    if (process.env.ENABLE_MPP_INDEXER !== "true") {
      logger.info("Tempo indexer disabled");
      return { skipped: true };
    }

    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { syncAllTempoTransactions } = await import("../server/tempo-transaction-indexer");
      const result = await syncAllTempoTransactions();
      metadata.set("addresses", result.addresses);
      metadata.set("transfers", result.transfers);
      metadata.set("errors", result.errors);
      logger.info("Tempo indexer complete", { result });

      const cost = usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("computeCostCents", cost.totalCostInCents);

      try {
        const { recordSuccess } = await import("../server/pipeline-health");
        await recordSuccess("tempo-transaction-indexer", "Tempo Transaction Indexer");
      } catch {}
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("tempo-transaction-indexer failed", { error: error.message });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      try {
        const { notifyJobFailure } = await import("./alert");
        await notifyJobFailure("tempo-transaction-indexer", error);
      } catch {}
      try {
        const { recordFailure } = await import("../server/pipeline-health");
        await recordFailure("tempo-transaction-indexer", "Tempo Transaction Indexer", error.message);
      } catch {}
      return { error: error.message };
    }
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add trigger/tempo-transaction-indexer.ts
git commit -m "feat(trigger): add tempo-transaction-indexer (every 6 hours)

Wraps server/tempo-transaction-indexer.syncAllTempoTransactions.
Indexes pathUSD inbound transfers to tracked Tempo addresses.
Feature-flagged by ENABLE_MPP_INDEXER. Pipeline health tracked."
```

---

## Task 17: Add pipeline health SLAs for new tasks

**Files:**
- Modify: `server/pipeline-health.ts`

- [ ] **Step 1: Extend `STALENESS_SLAS`**

Edit `server/pipeline-health.ts` — add three entries to the existing `STALENESS_SLAS` object:

```ts
export const STALENESS_SLAS: Record<string, { warningMinutes: number; criticalMinutes: number }> = {
  "blockchain-indexer":  { warningMinutes: 15,   criticalMinutes: 30 },
  "recalculate-scores":  { warningMinutes: 1560,  criticalMinutes: 1800 },
  "x402-prober":         { warningMinutes: 1500,  criticalMinutes: 2160 },
  "community-feedback":  { warningMinutes: 1800,  criticalMinutes: 2880 },
  "transaction-indexer": { warningMinutes: 480,   criticalMinutes: 780 },
  "watchdog":            { warningMinutes: 30,    criticalMinutes: 60 },
  "bazaar-indexer":      { warningMinutes: 1560,  criticalMinutes: 1800 },
  // MPP
  "mpp-prober":              { warningMinutes: 1500, criticalMinutes: 2160 },
  "mpp-directory-indexer":   { warningMinutes: 1560, criticalMinutes: 1800 },
  "tempo-transaction-indexer": { warningMinutes: 480, criticalMinutes: 780 },
};
```

- [ ] **Step 2: Commit**

```bash
git add server/pipeline-health.ts
git commit -m "feat(health): add SLAs for 3 MPP pipeline tasks

mpp-prober and mpp-directory-indexer inherit daily-cadence SLAs
from their x402/bazaar counterparts. tempo-transaction-indexer
uses the 6-hour transaction-indexer SLA."
```

---

## Task 18: Add MPP route to client App

**Files:**
- Modify: `client/src/App.tsx`
- Create: `client/src/pages/mpp.tsx`

- [ ] **Step 1: Create the MPP page skeleton**

Create `client/src/pages/mpp.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";

interface MppDirectoryStats {
  totalServices: number;
  activeServices: number;
  categoryBreakdown: Record<string, number>;
  pricingModelBreakdown: Record<string, number>;
  paymentMethodBreakdown: Record<string, number>;
  priceStats: { median: number; mean: number; min: number; max: number } | null;
  snapshotDate: string | null;
}

interface MppAdoptionStats {
  mpp: number;
  x402: number;
  both: number;
}

interface MppChainStats {
  volume: number;
  txCount: number;
  uniquePayers: number;
  activeRecipients: number;
}

export default function MppPage() {
  const { data: stats } = useQuery<MppDirectoryStats>({
    queryKey: ["/api/mpp/directory/stats"],
  });
  const { data: adoption } = useQuery<MppAdoptionStats>({
    queryKey: ["/api/mpp/adoption"],
  });
  const { data: chain } = useQuery<MppChainStats>({
    queryKey: ["/api/mpp/chain/stats"],
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">MPP Ecosystem Overview</h1>
        <p className="text-muted-foreground mt-2">
          Machine Payments Protocol — Stripe + Tempo Labs agent payment standard
        </p>
        {stats?.snapshotDate && (
          <p className="text-sm text-muted-foreground mt-1">Latest snapshot: {stats.snapshotDate}</p>
        )}
      </header>

      {/* Hero stats */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Services Indexed</div>
          <div className="text-2xl font-semibold">{stats?.totalServices ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-semibold">{stats?.activeServices ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Tempo pathUSD Volume</div>
          <div className="text-2xl font-semibold">${chain?.volume?.toFixed(2) ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Multi-Protocol Agents</div>
          <div className="text-2xl font-semibold">{adoption?.both ?? "—"}</div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Category Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats && Object.entries(stats.categoryBreakdown).map(([cat, n]) => (
            <div key={cat} className="border rounded p-3">
              <div className="text-xs text-muted-foreground">{cat}</div>
              <div className="text-lg font-medium">{n}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Payment Methods</h2>
        <div className="flex flex-wrap gap-3">
          {stats && Object.entries(stats.paymentMethodBreakdown).map(([method, n]) => (
            <div key={method} className="px-3 py-2 border rounded bg-muted">
              <span className="font-medium">{method}</span>
              <span className="text-muted-foreground ml-2">{n} services</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Cross-Protocol Adoption</h2>
        <div className="border rounded-lg p-4">
          <p>
            <strong>{adoption?.mpp ?? 0}</strong> agents on MPP · <strong>{adoption?.x402 ?? 0}</strong> agents on x402
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>{adoption?.both ?? 0}</strong> agents present on both protocols — the strongest multi-protocol trust signal.
          </p>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Register `/mpp` route**

Edit `client/src/App.tsx` — add import and route. Find the existing `<Switch>` block and add:

```tsx
import MppPage from "@/pages/mpp";
```

Then within the `<Switch>` block add (position next to `/economy` or `/bazaar`):

```tsx
<Route path="/mpp" component={MppPage} />
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS. No type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/mpp.tsx client/src/App.tsx
git commit -m "feat(ui): add /mpp ecosystem page

Displays directory stats (total/active, categories, payment
methods), Tempo chain volume, and cross-protocol adoption.
Uses existing Shadcn styling and TanStack Query conventions."
```

---

## Task 19: Add MPP section to economy page + copy

**Files:**
- Modify: `client/src/pages/economy.tsx`
- Modify: `client/src/lib/content-zones.ts`

- [ ] **Step 1: Add copy keys to `content-zones.ts`**

Add at the appropriate section in `client/src/lib/content-zones.ts` (nest under existing structure, matching the format of adjacent entries):

```ts
  mpp: {
    overview: {
      title: "Machine Payments Protocol",
      description: "Stripe + Tempo Labs standard for agent-native payments. Launched March 2026 with Visa, Anthropic, Shopify, and 10+ partners.",
    },
    methodology: {
      crossProtocol: "Agents present on both MPP and x402 show broader ecosystem engagement — a strong trust signal that is harder to fake than single-protocol presence.",
    },
  },
  economy: {
    mppSection: {
      headline: "Cross-Protocol Payment Ecosystem",
      subhead: "x402 (Base) and MPP (Tempo) — the two major agent payment standards",
      adoptionLabel: "Agents on both protocols",
    },
  },
```

(Match whatever object-nesting style the existing file uses — read it first.)

- [ ] **Step 2: Add MPP section to economy page**

Edit `client/src/pages/economy.tsx`. Add after the existing x402/ecosystem cards block:

```tsx
{/* MPP cross-protocol section */}
{import.meta.env.VITE_ENABLE_MPP_UI === "true" && <MppSection />}
```

Define `MppSection` component at the bottom of the same file:

```tsx
function MppSection() {
  const { data: adoption } = useQuery<{ mpp: number; x402: number; both: number }>({
    queryKey: ["/api/mpp/adoption"],
  });
  const { data: comparison } = useQuery<{
    x402: { directoryServices: number; activeServices: number };
    mpp: { directoryServices: number; activeServices: number; volume: number; txCount: number };
  }>({
    queryKey: ["/api/ecosystem/protocol-comparison"],
  });

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-2">Cross-Protocol Payment Ecosystem</h2>
      <p className="text-muted-foreground mb-4">x402 (Base) and MPP (Tempo) — the two major agent payment standards</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">x402 Services</div>
          <div className="text-2xl font-semibold">{comparison?.x402.activeServices ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">MPP Services</div>
          <div className="text-2xl font-semibold">{comparison?.mpp.activeServices ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Multi-Protocol Agents</div>
          <div className="text-2xl font-semibold">{adoption?.both ?? "—"}</div>
        </div>
      </div>

      <a href="/mpp" className="text-primary hover:underline">Explore the MPP ecosystem →</a>
    </section>
  );
}
```

(Ensure `useQuery` is already imported at the top of the file; otherwise add the import.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/economy.tsx client/src/lib/content-zones.ts
git commit -m "feat(ui): add MPP section to /economy + link to /mpp page

New Cross-Protocol Payment Ecosystem card showing x402 vs MPP
service counts and multi-protocol agent count. Gated by
VITE_ENABLE_MPP_UI=true env var (Vite reads these at build time)."
```

---

## Task 20: Add Trigger.dev env var reminder + rollout docs

**Files:**
- Modify: `CLAUDE.md` (append section)

- [ ] **Step 1: Add MPP rollout section to `CLAUDE.md`**

Append at the end of `CLAUDE.md`:

```markdown
## MPP Integration (2026-04-15)

MPP integration is feature-flagged. To enable:

**Vercel env vars:**
```bash
printf 'true' | npx vercel env add ENABLE_MPP_UI production        # enables /api/mpp/* routes + /mpp page
printf 'true' | npx vercel env add VITE_ENABLE_MPP_UI production   # shows MPP UI on /economy page
printf 'https://rpc.tempo.xyz' | npx vercel env add TEMPO_RPC_URL production
```

**Trigger.dev env vars (dashboard → Settings → Environment Variables → Production):**
```
ENABLE_MPP_INDEXER=true
TEMPO_RPC_URL=https://rpc.tempo.xyz
TEMPO_RPC_URL_FALLBACK=<optional QuickNode/Chainstack URL>
MPP_DIRECTORY_SOURCE=auto            # or api, scrape
TEMPO_PATHUSD_DEPLOYMENT_BLOCK=0     # set after bootstrap resolves
TEMPO_TRANSFER_WITH_MEMO_TOPIC=<topic hash if known>
```

**Schema migration:** Run the SQL in `migrations/0002_mpp_integration.sql`
via Supabase SQL editor before enabling the flags (trustadd_app
lacks ownership for direct `drizzle-kit push`).

**Pipeline tasks:**
- `mpp-prober` — daily 3:30 AM UTC
- `mpp-directory-indexer` — daily 4:30 AM UTC
- `tempo-transaction-indexer` — every 6 hours

See `docs/superpowers/specs/2026-04-15-mpp-integration-design.md`
and `docs/superpowers/plans/2026-04-15-mpp-integration.md`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add MPP rollout notes to CLAUDE.md

Documents the Vercel + Trigger.dev env vars required to
enable MPP integration, plus pointers to the spec and plan."
```

---

## Task 21: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: 184 existing tests + ~15 new MPP tests all pass.

- [ ] **Step 2: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 3: Run frontend build**

Run: `npm run build`
Expected: PASS. Bundles succeed without warnings beyond existing baseline.

- [ ] **Step 4: Sanity-check task registration**

Run: `git grep -l "mppProberTask\|mppDirectoryIndexerTask\|tempoTransactionIndexerTask" trigger/`
Expected: Lists the 3 new trigger files. No missing exports.

- [ ] **Step 5: Sanity-check route registration**

Run: `git grep "registerMppRoutes" server/`
Expected: 2 hits — definition in `server/routes/mpp.ts`, call in `server/routes.ts`.

- [ ] **Step 6: Summary commit (if needed)**

If any lint or typing issues surfaced, fix + commit. Otherwise no additional commit needed.

---

## Self-Review Checklist (executed after plan was written)

- [x] **Spec coverage** — every spec section maps to a task: schema (T1), Tempo config (T2), prober (T3-5), directory (T6-7), chain indexer (T8-9), storage (T10-11), API (T12-13), tasks (T14-16), observability (T17), frontend (T18-19), rollout (T20), verification (T21).
- [x] **No placeholders** — all code blocks are complete.
- [x] **Type consistency** — `ParsedPaymentChallenge`, `DecodedTransfer`, `RawMppService`, storage methods referenced with consistent names across tasks.
- [x] **Known caveats documented inline:**
  - Migration must be run manually via Supabase SQL editor (trustadd_app lacks DDL privs).
  - `TEMPO_TRANSFER_WITH_MEMO_TOPIC` is env-var-gated because its event signature needs confirmation from Tempo docs at implementation time.
  - `classifyMppService` is extracted into `server/mpp-directory.ts` and exported so it can be reused by `MppApiSource.normalize`.
  - Tests use vitest mocking for DB-touching queries rather than a fixture DB (matches existing `__tests__/` patterns).
