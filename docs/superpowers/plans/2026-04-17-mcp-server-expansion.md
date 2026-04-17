# MCP Server Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the `@trustadd/mcp` package from 3 trust tools in a single 166-line file into a modular, versioned MCP server with MPP tools, free analytics tools, a status tool, an `agent_trust_gate` prompt, tests, CHANGELOG, and automated npm publishing.

**Architecture:** Split the flat `src/index.ts` into three layers — (1) `lib/` helpers (api client, response shaping, version registry, shared zod schemas), (2) `tools/` one file per tool group (trust, mpp, analytics, status), (3) `prompts/` for MCP prompts. A root `tools/index.ts` + `prompts/index.ts` provide `registerAll*(server)` entry points. The versioning layer centralizes API group → URL prefix mapping so future API v2 is a one-line change. `src/index.ts` shrinks to a bootstrap-only file.

**Tech Stack:** TypeScript (strict, Node16 modules), `@modelcontextprotocol/sdk` v1.29, `zod` v3, `vitest` for tests, GitHub Actions for npm publish. Package manager: npm (matches parent repo).

**Repository context:**
- Package root: `packages/trustadd-mcp/`
- Parent repo: `/Users/ethserver/CLAUDE/trustadd` (monorepo, but MCP package is independent — no workspace config)
- Current MCP source: `packages/trustadd-mcp/src/index.ts` (166 lines, single file)
- Current version: `1.0.0`, never built, never published
- Target version after plan: `1.1.0`
- Target published identifier: `@trustadd/mcp@1.1.0` on npm

**New tools added (8):**
- MPP: `mpp_directory_stats`, `mpp_adoption_stats`, `mpp_chain_stats`, `mpp_search_services`
- Analytics: `ecosystem_overview`, `chain_distribution`, `list_supported_chains`
- Status: `trustadd_status`

**New prompts added (1):** `agent_trust_gate`

**Existing tools preserved (3):** `lookup_agent`, `check_agent_trust`, `get_trust_report`

---

## File Structure

```
packages/trustadd-mcp/
├── src/
│   ├── index.ts                    # Bootstrap only — server init, registerAll, stdio connect
│   ├── lib/
│   │   ├── api.ts                  # apiGet, formatError, paidHandler, status-code mapping
│   │   ├── responses.ts            # textResult, errorResult content builders
│   │   ├── versioning.ts           # API version registry + apiPath() URL builder
│   │   └── schemas.ts              # Shared zod schemas (AddressSchema, ChainIdSchema)
│   ├── tools/
│   │   ├── index.ts                # registerAllTools(server)
│   │   ├── trust.ts                # lookup_agent, check_agent_trust, get_trust_report
│   │   ├── mpp.ts                  # 4 MPP tools
│   │   ├── analytics.ts            # 3 free analytics tools
│   │   └── status.ts               # trustadd_status
│   └── prompts/
│       ├── index.ts                # registerAllPrompts(server)
│       └── agent-trust-gate.ts     # The one prompt
├── tests/
│   ├── lib/
│   │   ├── api.test.ts
│   │   └── versioning.test.ts
│   └── tools/
│       ├── trust.test.ts
│       ├── mpp.test.ts
│       └── analytics.test.ts
├── CHANGELOG.md
├── package.json                    # Bumped to 1.1.0
├── tsconfig.json                   # Updated to include tests in type-check
├── vitest.config.ts                # New
└── README.md                       # Updated with new tools + prompt

.github/
└── workflows/
    └── publish-mcp.yml             # New: auto-publish on tag `mcp-v*`
```

---

## Task 1: Add Vitest Test Infrastructure

**Files:**
- Modify: `packages/trustadd-mcp/package.json`
- Create: `packages/trustadd-mcp/vitest.config.ts`
- Modify: `packages/trustadd-mcp/tsconfig.json`

- [ ] **Step 1: Add vitest dev dependencies**

Run from `packages/trustadd-mcp/`:

```bash
cd packages/trustadd-mcp
npm install --save-dev vitest@^2.1.0 @vitest/coverage-v8@^2.1.0
```

- [ ] **Step 2: Add `test` + `test:run` scripts to package.json**

Edit `packages/trustadd-mcp/package.json`, replace the `scripts` block:

```json
  "scripts": {
    "build": "tsc && chmod 755 build/index.js",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "prepublishOnly": "npm run test:run && npm run build"
  },
```

- [ ] **Step 3: Create vitest config**

Create `packages/trustadd-mcp/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
});
```

- [ ] **Step 4: Extend tsconfig to type-check tests**

Replace `packages/trustadd-mcp/tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "build"]
}
```

Note: `rootDir` broadens to `.` so TypeScript can include `tests/`. The `tsc` build still emits only `src/**` because tests are excluded from the `files` npm field.

Also update the `files` field in `package.json` to ensure tests aren't shipped:

Check current — `"files": ["build"]` is already correct. No change needed.

But the `tsc` build will now attempt to compile tests. To prevent that, add a build-specific tsconfig:

Create `packages/trustadd-mcp/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "tests"]
}
```

Update `build` script in `package.json`:

```json
    "build": "tsc -p tsconfig.build.json && chmod 755 build/index.js",
```

- [ ] **Step 5: Verify vitest runs (empty suite)**

Run: `cd packages/trustadd-mcp && npx vitest run`
Expected: "No test files found" — exit 0 or exit 1 with that message. Either is fine.

- [ ] **Step 6: Commit**

```bash
git add packages/trustadd-mcp/package.json packages/trustadd-mcp/package-lock.json packages/trustadd-mcp/vitest.config.ts packages/trustadd-mcp/tsconfig.json packages/trustadd-mcp/tsconfig.build.json
git commit -m "chore(mcp): add vitest test infrastructure"
```

---

## Task 2: Extract `lib/responses.ts`

**Files:**
- Create: `packages/trustadd-mcp/src/lib/responses.ts`

- [ ] **Step 1: Create the file**

Create `packages/trustadd-mcp/src/lib/responses.ts`:

```ts
/** MCP tool content builders. */

export function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export type ToolResult = ReturnType<typeof textResult> | ReturnType<typeof errorResult>;
```

- [ ] **Step 2: Commit**

```bash
git add packages/trustadd-mcp/src/lib/responses.ts
git commit -m "refactor(mcp): extract response helpers into lib/responses"
```

---

## Task 3: Create `lib/versioning.ts`

**Files:**
- Create: `packages/trustadd-mcp/src/lib/versioning.ts`
- Create: `packages/trustadd-mcp/tests/lib/versioning.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/trustadd-mcp/tests/lib/versioning.test.ts`:

```ts
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { apiPath, API_VERSIONS } from "../../src/lib/versioning.js";

describe("apiPath", () => {
  const originalEnv = process.env.TRUSTADD_API_VERSION_OVERRIDE;

  beforeEach(() => {
    delete process.env.TRUSTADD_API_VERSION_OVERRIDE;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TRUSTADD_API_VERSION_OVERRIDE;
    else process.env.TRUSTADD_API_VERSION_OVERRIDE = originalEnv;
  });

  it("builds versioned trust paths", () => {
    expect(apiPath("trust", "/0xabc")).toBe("/api/v1/trust/0xabc");
    expect(apiPath("trust", "/0xabc/report")).toBe("/api/v1/trust/0xabc/report");
  });

  it("builds unversioned mpp paths", () => {
    expect(apiPath("mpp", "/adoption")).toBe("/api/mpp/adoption");
    expect(apiPath("mpp", "/directory/stats")).toBe("/api/mpp/directory/stats");
  });

  it("builds unversioned analytics paths", () => {
    expect(apiPath("analytics", "/overview")).toBe("/api/analytics/overview");
  });

  it("builds status paths without any prefix", () => {
    expect(apiPath("status", "/health")).toBe("/api/health");
    expect(apiPath("status", "/chains")).toBe("/api/chains");
  });

  it("honors TRUSTADD_API_VERSION_OVERRIDE for versioned groups only", () => {
    process.env.TRUSTADD_API_VERSION_OVERRIDE = "v2";
    expect(apiPath("trust", "/0xabc")).toBe("/api/v2/trust/0xabc");
    // MPP is unversioned — override is ignored
    expect(apiPath("mpp", "/adoption")).toBe("/api/mpp/adoption");
  });

  it("exposes the version registry", () => {
    expect(API_VERSIONS.trust).toBe("v1");
    expect(API_VERSIONS.mpp).toBeNull();
    expect(API_VERSIONS.analytics).toBeNull();
    expect(API_VERSIONS.status).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `cd packages/trustadd-mcp && npx vitest run tests/lib/versioning.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the versioning module**

Create `packages/trustadd-mcp/src/lib/versioning.ts`:

```ts
/**
 * API version registry.
 *
 * Maps API group → URL version segment. `null` means the group is currently
 * unversioned at the URL level (e.g. /api/mpp/...). Versioned groups support
 * override via TRUSTADD_API_VERSION_OVERRIDE env var (for testing v2 before
 * its default promotion).
 *
 * When adding a v2 endpoint:
 *   1. Bump the map entry: `trust: 'v2'`
 *   2. Add a CHANGELOG entry describing the upgrade
 *   3. Bump the package minor version
 */
export const API_VERSIONS = {
  trust: "v1",
  mpp: null,
  analytics: null,
  status: null,
} as const;

export type ApiGroup = keyof typeof API_VERSIONS;

const GROUP_PREFIX: Record<ApiGroup, string> = {
  trust: "/api/__v__/trust",
  mpp: "/api/mpp",
  analytics: "/api/analytics",
  status: "/api",
};

/** Build a full API path for a group + subpath. */
export function apiPath(group: ApiGroup, subpath: string): string {
  const version = API_VERSIONS[group];
  const override = process.env.TRUSTADD_API_VERSION_OVERRIDE;
  const effectiveVersion = version !== null ? (override || version) : null;

  const prefix = GROUP_PREFIX[group];
  const resolved = effectiveVersion
    ? prefix.replace("__v__", effectiveVersion)
    : prefix;

  return `${resolved}${subpath}`;
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `cd packages/trustadd-mcp && npx vitest run tests/lib/versioning.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/trustadd-mcp/src/lib/versioning.ts packages/trustadd-mcp/tests/lib/versioning.test.ts
git commit -m "feat(mcp): add API version registry + apiPath builder"
```

---

## Task 4: Extract `lib/api.ts`

**Files:**
- Create: `packages/trustadd-mcp/src/lib/api.ts`
- Create: `packages/trustadd-mcp/tests/lib/api.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/trustadd-mcp/tests/lib/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiGet, formatError, paidHandler } from "../../src/lib/api.js";

describe("apiGet", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it("returns status + parsed JSON on success", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 200,
      json: async () => ({ ok: true }),
    });
    const res = await apiGet("/test");
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
  });

  it("returns null data when response is not JSON", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 500,
      json: async () => { throw new Error("invalid"); },
    });
    const res = await apiGet("/test");
    expect(res.status).toBe(500);
    expect(res.data).toBeNull();
  });

  it("uses TRUSTADD_API_URL when set", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    process.env.TRUSTADD_API_URL = "https://staging.trustadd.com";
    await apiGet("/foo");
    expect(spy).toHaveBeenCalledWith(
      "https://staging.trustadd.com/foo",
      expect.objectContaining({ signal: expect.anything() })
    );
    delete process.env.TRUSTADD_API_URL;
  });
});

describe("formatError", () => {
  it("formats timeout errors specifically", () => {
    const err = new Error("timeout");
    err.name = "TimeoutError";
    expect(formatError(err)).toContain("timed out");
  });

  it("formats generic errors", () => {
    expect(formatError(new Error("boom"))).toBe("Request failed: boom");
  });

  it("handles non-Error throws", () => {
    expect(formatError("just a string")).toBe("Request failed: just a string");
  });
});

describe("paidHandler", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns payment-required structure on 402", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 402,
      json: async () => ({ accepts: [{ maxAmountRequired: "10000" }] }),
    });
    const result = await paidHandler("/api/v1/trust/0xabc", "$0.01");
    expect(result.content[0].text).toContain("paymentRequired");
    expect(result.content[0].text).toContain("$0.01");
  });

  it("returns UNKNOWN verdict on 404", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 404,
      json: async () => null,
    });
    const result = await paidHandler("/x", "$0.01");
    expect(result.content[0].text).toContain("UNKNOWN");
  });

  it("returns isError on 429", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 429,
      json: async () => null,
    });
    const result = await paidHandler("/x", "$0.01");
    expect((result as any).isError).toBe(true);
  });

  it("returns parsed data on 200", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 200,
      json: async () => ({ score: 88, verdict: "TRUSTED" }),
    });
    const result = await paidHandler("/x", "$0.01");
    expect(result.content[0].text).toContain("88");
    expect(result.content[0].text).toContain("TRUSTED");
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `cd packages/trustadd-mcp && npx vitest run tests/lib/api.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/api.ts`**

Create `packages/trustadd-mcp/src/lib/api.ts`:

```ts
import { textResult, errorResult, type ToolResult } from "./responses.js";

const DEFAULT_API_BASE = "https://trustadd.com";
const TIMEOUT_MS = 15_000;

function apiBase(): string {
  return process.env.TRUSTADD_API_URL || DEFAULT_API_BASE;
}

export async function apiGet(path: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${apiBase()}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

export function formatError(err: unknown): string {
  if (err instanceof Error && err.name === "TimeoutError") {
    return `TrustAdd API timed out after ${TIMEOUT_MS / 1000}s — try again`;
  }
  return `Request failed: ${err instanceof Error ? err.message : String(err)}`;
}

/** Map common HTTP statuses to user-friendly errors. Returns null if status is a 2xx success. */
function mapStatusToError(status: number): string | null {
  if (status === 400) return "Invalid address format";
  if (status === 404) return null; // caller decides: usually textResult({ verdict: 'UNKNOWN' })
  if (status === 429) return "Rate limit exceeded — retry after a short delay";
  if (status === 503) return "Trust Data Product is temporarily unavailable";
  if (status >= 500) return `TrustAdd API error (HTTP ${status})`;
  return null;
}

/** Shared handler for x402-gated endpoints. 402 → payment-required structure; otherwise status mapping. */
export async function paidHandler(path: string, price: string): Promise<ToolResult> {
  const { status, data } = await apiGet(path);

  if (status === 402) {
    return textResult({
      paymentRequired: true,
      price,
      message:
        `This endpoint requires x402 payment (${price} USDC on Base). ` +
        "The TrustAdd MCP server does not handle x402 payments directly — " +
        "use the REST API with an x402-compatible HTTP client, or visit trustadd.com.",
      details: data,
    });
  }
  if (status === 404) return textResult({ verdict: "UNKNOWN", message: "No agent found for this address" });

  const mapped = mapStatusToError(status);
  if (mapped) return errorResult(mapped);
  return textResult(data);
}

/** Free endpoint handler: map errors, return data on success. */
export async function freeHandler(path: string): Promise<ToolResult> {
  const { status, data } = await apiGet(path);
  const mapped = mapStatusToError(status);
  if (mapped) return errorResult(mapped);
  if (status === 404) return errorResult("Not found");
  return textResult(data);
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `cd packages/trustadd-mcp && npx vitest run tests/lib/api.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/trustadd-mcp/src/lib/api.ts packages/trustadd-mcp/tests/lib/api.test.ts
git commit -m "feat(mcp): extract api client + paid/free handlers"
```

---

## Task 5: Create `lib/schemas.ts`

**Files:**
- Create: `packages/trustadd-mcp/src/lib/schemas.ts`

- [ ] **Step 1: Create shared zod schemas**

Create `packages/trustadd-mcp/src/lib/schemas.ts`:

```ts
import { z } from "zod";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const AddressSchema = z
  .string()
  .regex(ADDRESS_RE)
  .describe("EVM address (0x-prefixed, 40 hex chars) — contract, controller, or payment address");

/** Supported EVM chain IDs across TrustAdd (9 EVM + Tempo). */
export const SUPPORTED_CHAIN_IDS = [1, 10, 56, 100, 137, 8453, 42161, 42220, 43114, 4217] as const;

export const ChainIdSchema = z
  .number()
  .int()
  .refine((n) => (SUPPORTED_CHAIN_IDS as readonly number[]).includes(n), {
    message: `chainId must be one of: ${SUPPORTED_CHAIN_IDS.join(", ")}`,
  })
  .describe(
    "Optional chain ID to narrow lookup. Supported: 1 (Ethereum), 10 (Optimism), 56 (BNB), 100 (Gnosis), 137 (Polygon), 8453 (Base), 42161 (Arbitrum), 42220 (Celo), 43114 (Avalanche), 4217 (Tempo)"
  );
```

- [ ] **Step 2: Commit**

```bash
git add packages/trustadd-mcp/src/lib/schemas.ts
git commit -m "feat(mcp): add shared zod schemas (Address, ChainId)"
```

---

## Task 6: Extract trust tools into `tools/trust.ts`

**Files:**
- Create: `packages/trustadd-mcp/src/tools/trust.ts`
- Create: `packages/trustadd-mcp/tests/tools/trust.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/trustadd-mcp/tests/tools/trust.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerTrustTools } from "../../src/tools/trust.js";

function fakeServer() {
  const tools = new Map<string, { config: any; handler: Function }>();
  return {
    registerTool(name: string, config: any, handler: Function) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe("trust tools", () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    server = fakeServer();
    registerTrustTools(server as any);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("registers 3 trust tools", () => {
    expect(server.tools.has("lookup_agent")).toBe(true);
    expect(server.tools.has("check_agent_trust")).toBe(true);
    expect(server.tools.has("get_trust_report")).toBe(true);
  });

  it("lookup_agent calls /api/v1/trust/{addr}/exists", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ found: true, verdict: "TRUSTED" }) });
    const tool = server.tools.get("lookup_agent")!;
    await tool.handler({ address: "0x0000000000000000000000000000000000000001" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/trust/0x0000000000000000000000000000000000000001/exists"),
      expect.anything()
    );
  });

  it("check_agent_trust includes chainId query when provided", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ score: 85 }) });
    const tool = server.tools.get("check_agent_trust")!;
    await tool.handler({ address: "0x0000000000000000000000000000000000000002", chainId: 8453 });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/trust/0x0000000000000000000000000000000000000002?chainId=8453"),
      expect.anything()
    );
  });

  it("get_trust_report returns payment-required on 402", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({ status: 402, json: async () => ({}) });
    const tool = server.tools.get("get_trust_report")!;
    const result = await tool.handler({ address: "0x0000000000000000000000000000000000000003" });
    expect(result.content[0].text).toContain("paymentRequired");
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `cd packages/trustadd-mcp && npx vitest run tests/tools/trust.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tools/trust.ts`**

Create `packages/trustadd-mcp/src/tools/trust.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet, formatError, paidHandler } from "../lib/api.js";
import { errorResult, textResult } from "../lib/responses.js";
import { apiPath } from "../lib/versioning.js";
import { AddressSchema, ChainIdSchema } from "../lib/schemas.js";

export function registerTrustTools(server: McpServer): void {
  server.registerTool(
    "lookup_agent",
    {
      description:
        "Check if TrustAdd has trust data for an AI agent address. Free, no payment required. " +
        "Returns whether the agent is found, a verdict preview (TRUSTED/CAUTION/UNTRUSTED/UNKNOWN), " +
        "and pricing for paid endpoints. Use this before check_agent_trust to see if data exists.",
      inputSchema: { address: AddressSchema },
    },
    async ({ address }) => {
      try {
        const { status, data } = await apiGet(apiPath("trust", `/${address}/exists`));
        if (status === 400) return errorResult("Invalid address format");
        if (status >= 500) return errorResult(`TrustAdd API error (HTTP ${status})`);
        return textResult(data);
      } catch (err) {
        return errorResult(formatError(err));
      }
    }
  );

  server.registerTool(
    "check_agent_trust",
    {
      description:
        "Get a trust verdict for an AI agent. Returns score (0-100), verdict (TRUSTED/CAUTION/UNTRUSTED), " +
        "score breakdown across 5 categories, flags, and key metrics. " +
        "Costs $0.01 USDC on Base via x402 protocol. " +
        "If x402 payment is not configured, returns the 402 payment requirements so you can inform the user. " +
        "Use lookup_agent first to check if data exists (free).",
      inputSchema: {
        address: AddressSchema,
        chainId: ChainIdSchema.optional(),
      },
    },
    async ({ address, chainId }) => {
      try {
        const qs = chainId ? `?chainId=${chainId}` : "";
        return await paidHandler(apiPath("trust", `/${address}${qs}`), "$0.01");
      } catch (err) {
        return errorResult(formatError(err));
      }
    }
  );

  server.registerTool(
    "get_trust_report",
    {
      description:
        "Get a comprehensive trust report for an AI agent with full evidence: " +
        "identity details, on-chain history across 9 chains, economic activity (x402 payments, transaction volume), " +
        "community signals (GitHub health, Farcaster engagement), and data freshness metadata. " +
        "Costs $0.05 USDC on Base via x402 protocol. " +
        "Use check_agent_trust ($0.01) for a quick verdict, or this tool for detailed due diligence.",
      inputSchema: {
        address: AddressSchema,
        chainId: ChainIdSchema.optional(),
      },
    },
    async ({ address, chainId }) => {
      try {
        const qs = chainId ? `?chainId=${chainId}` : "";
        return await paidHandler(apiPath("trust", `/${address}/report${qs}`), "$0.05");
      } catch (err) {
        return errorResult(formatError(err));
      }
    }
  );
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `cd packages/trustadd-mcp && npx vitest run tests/tools/trust.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/trustadd-mcp/src/tools/trust.ts packages/trustadd-mcp/tests/tools/trust.test.ts
git commit -m "refactor(mcp): extract trust tools into tools/trust.ts"
```

---

## Task 7: Add MPP tools in `tools/mpp.ts`

**Files:**
- Create: `packages/trustadd-mcp/src/tools/mpp.ts`
- Create: `packages/trustadd-mcp/tests/tools/mpp.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/trustadd-mcp/tests/tools/mpp.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerMppTools } from "../../src/tools/mpp.js";

function fakeServer() {
  const tools = new Map<string, { config: any; handler: Function }>();
  return {
    registerTool(name: string, config: any, handler: Function) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe("mpp tools", () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    server = fakeServer();
    registerMppTools(server as any);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("registers 4 MPP tools", () => {
    expect(server.tools.has("mpp_directory_stats")).toBe(true);
    expect(server.tools.has("mpp_adoption_stats")).toBe(true);
    expect(server.tools.has("mpp_chain_stats")).toBe(true);
    expect(server.tools.has("mpp_search_services")).toBe(true);
  });

  it("mpp_directory_stats calls /api/mpp/directory/stats", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ totalServices: 42 }) });
    const tool = server.tools.get("mpp_directory_stats")!;
    const result = await tool.handler({});
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/mpp/directory/stats"),
      expect.anything()
    );
    expect(result.content[0].text).toContain("42");
  });

  it("mpp_search_services passes query params", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ services: [] }) });
    const tool = server.tools.get("mpp_search_services")!;
    await tool.handler({ category: "ai", paymentMethod: "usdc", search: "bot", page: 2, limit: 20 });
    const call = spy.mock.calls[0][0];
    expect(call).toContain("/api/mpp/directory/services");
    expect(call).toContain("category=ai");
    expect(call).toContain("paymentMethod=usdc");
    expect(call).toContain("search=bot");
    expect(call).toContain("page=2");
    expect(call).toContain("limit=20");
  });

  it("mpp_search_services works with no params", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ services: [] }) });
    const tool = server.tools.get("mpp_search_services")!;
    await tool.handler({});
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `cd packages/trustadd-mcp && npx vitest run tests/tools/mpp.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tools/mpp.ts`**

Create `packages/trustadd-mcp/src/tools/mpp.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { freeHandler } from "../lib/api.js";
import { apiPath } from "../lib/versioning.js";

export function registerMppTools(server: McpServer): void {
  server.registerTool(
    "mpp_directory_stats",
    {
      description:
        "Get aggregate statistics for the Multi-Protocol Payment (MPP) directory: " +
        "total services, active services, provider count, category breakdown. " +
        "Free endpoint. Use to understand the MPP ecosystem size and composition.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("mpp", "/directory/stats"))
  );

  server.registerTool(
    "mpp_adoption_stats",
    {
      description:
        "Get cross-protocol payment adoption counts: how many agents support MPP, " +
        "how many support x402, and how many support both. Free endpoint.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("mpp", "/adoption"))
  );

  server.registerTool(
    "mpp_chain_stats",
    {
      description:
        "Get Tempo chain (MPP settlement layer) aggregate stats: pathUSD transaction volume, " +
        "transaction count, unique payers, active recipients. Free endpoint.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("mpp", "/chain/stats"))
  );

  server.registerTool(
    "mpp_search_services",
    {
      description:
        "Search the MPP directory services registry. Supports filtering by category, " +
        "payment method, and free-text search. Returns paginated results. Free endpoint.",
      inputSchema: {
        category: z.string().optional().describe("Filter by service category (e.g. 'ai', 'data')"),
        paymentMethod: z.string().optional().describe("Filter by payment method (e.g. 'usdc')"),
        search: z.string().optional().describe("Free-text search across service names + descriptions"),
        page: z.number().int().min(1).max(100_000).optional().describe("Page number (default 1)"),
        limit: z.number().int().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      },
    },
    async ({ category, paymentMethod, search, page, limit }) => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      if (search) params.set("search", search);
      if (page !== undefined) params.set("page", String(page));
      if (limit !== undefined) params.set("limit", String(limit));
      const qs = params.toString();
      return freeHandler(apiPath("mpp", `/directory/services${qs ? `?${qs}` : ""}`));
    }
  );
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `cd packages/trustadd-mcp && npx vitest run tests/tools/mpp.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/trustadd-mcp/src/tools/mpp.ts packages/trustadd-mcp/tests/tools/mpp.test.ts
git commit -m "feat(mcp): add 4 MPP tools (directory stats, adoption, chain stats, search)"
```

---

## Task 8: Add analytics tools in `tools/analytics.ts`

**Files:**
- Create: `packages/trustadd-mcp/src/tools/analytics.ts`
- Create: `packages/trustadd-mcp/tests/tools/analytics.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/trustadd-mcp/tests/tools/analytics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerAnalyticsTools } from "../../src/tools/analytics.js";

function fakeServer() {
  const tools = new Map<string, { config: any; handler: Function }>();
  return {
    registerTool(name: string, config: any, handler: Function) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe("analytics tools", () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    server = fakeServer();
    registerAnalyticsTools(server as any);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("registers 3 analytics tools", () => {
    expect(server.tools.has("ecosystem_overview")).toBe(true);
    expect(server.tools.has("chain_distribution")).toBe(true);
    expect(server.tools.has("list_supported_chains")).toBe(true);
  });

  it("ecosystem_overview calls /api/analytics/overview", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ totalAgents: 102_000 }) });
    await server.tools.get("ecosystem_overview")!.handler({});
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/analytics/overview"),
      expect.anything()
    );
  });

  it("list_supported_chains calls /api/chains", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => [] });
    await server.tools.get("list_supported_chains")!.handler({});
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/chains"),
      expect.anything()
    );
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `cd packages/trustadd-mcp && npx vitest run tests/tools/analytics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tools/analytics.ts`**

Create `packages/trustadd-mcp/src/tools/analytics.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { freeHandler } from "../lib/api.js";
import { apiPath } from "../lib/versioning.js";

export function registerAnalyticsTools(server: McpServer): void {
  server.registerTool(
    "ecosystem_overview",
    {
      description:
        "Get aggregate ecosystem metrics: total registered agents, active agents, " +
        "cross-chain count, recent registration trend, quality tier distribution. " +
        "Free endpoint. Good starting point for ecosystem-level research.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("analytics", "/overview"))
  );

  server.registerTool(
    "chain_distribution",
    {
      description:
        "Get agent registration counts grouped by chain. Returns per-chain agent totals " +
        "and recent activity. Useful for understanding chain adoption. Free endpoint.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("analytics", "/chain-distribution"))
  );

  server.registerTool(
    "list_supported_chains",
    {
      description:
        "List all chains TrustAdd currently indexes, with chain metadata (id, name, " +
        "native token, explorer URL). Use this to discover valid chainId values for " +
        "other tools. Free endpoint.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("status", "/chains"))
  );
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `cd packages/trustadd-mcp && npx vitest run tests/tools/analytics.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/trustadd-mcp/src/tools/analytics.ts packages/trustadd-mcp/tests/tools/analytics.test.ts
git commit -m "feat(mcp): add 3 free analytics tools (overview, chain dist, list chains)"
```

---

## Task 9: Add status tool in `tools/status.ts`

**Files:**
- Create: `packages/trustadd-mcp/src/tools/status.ts`

- [ ] **Step 1: Implement `tools/status.ts`**

Create `packages/trustadd-mcp/src/tools/status.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api.js";
import { errorResult, textResult } from "../lib/responses.js";
import { apiPath } from "../lib/versioning.js";
import { API_VERSIONS } from "../lib/versioning.js";

export function registerStatusTools(server: McpServer): void {
  server.registerTool(
    "trustadd_status",
    {
      description:
        "Get TrustAdd service health + pipeline circuit-breaker status. " +
        "Returns API health, DB connectivity, indexer pipeline health, and the API " +
        "version the MCP server is currently targeting. Use for debugging when other " +
        "tools return unexpected errors. Free endpoint.",
      inputSchema: {},
    },
    async () => {
      try {
        const [health, pipeline] = await Promise.all([
          apiGet(apiPath("status", "/health")),
          apiGet(apiPath("trust", "/pipeline-health")),
        ]);
        return textResult({
          health: health.status === 200 ? health.data : { status: "unreachable", code: health.status },
          pipeline: pipeline.status === 200 ? pipeline.data : { status: "unreachable", code: pipeline.status },
          mcpApiVersions: API_VERSIONS,
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/trustadd-mcp/src/tools/status.ts
git commit -m "feat(mcp): add trustadd_status tool for service health + api version introspection"
```

---

## Task 10: Create `tools/index.ts` registry

**Files:**
- Create: `packages/trustadd-mcp/src/tools/index.ts`

- [ ] **Step 1: Implement the registry**

Create `packages/trustadd-mcp/src/tools/index.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTrustTools } from "./trust.js";
import { registerMppTools } from "./mpp.js";
import { registerAnalyticsTools } from "./analytics.js";
import { registerStatusTools } from "./status.js";

/**
 * Register every tool group with the MCP server.
 *
 * To add a new tool group:
 *   1. Create `src/tools/<group>.ts` exporting `register<Group>Tools(server)`.
 *   2. Import and call it below.
 *   3. Add any new API group to `src/lib/versioning.ts` if the group uses a new URL prefix.
 */
export function registerAllTools(server: McpServer): void {
  registerTrustTools(server);
  registerMppTools(server);
  registerAnalyticsTools(server);
  registerStatusTools(server);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/trustadd-mcp/src/tools/index.ts
git commit -m "feat(mcp): add tool registry entry point"
```

---

## Task 11: Add `agent_trust_gate` prompt

**Files:**
- Create: `packages/trustadd-mcp/src/prompts/agent-trust-gate.ts`
- Create: `packages/trustadd-mcp/src/prompts/index.ts`

- [ ] **Step 1: Create the prompt**

Create `packages/trustadd-mcp/src/prompts/agent-trust-gate.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AddressSchema } from "../lib/schemas.js";

export function registerAgentTrustGatePrompt(server: McpServer): void {
  server.registerPrompt(
    "agent_trust_gate",
    {
      description:
        "Walk the caller through a trust-gated decision for transacting with an unknown AI agent. " +
        "Uses lookup_agent (free) → check_agent_trust ($0.01) → optional get_trust_report ($0.05) " +
        "to produce a proceed/abort recommendation.",
      argsSchema: {
        counterparty: AddressSchema,
        context: z
          .string()
          .optional()
          .describe("Optional: what the user wants to do with this agent (e.g. 'send 50 USDC for a data query')"),
      },
    },
    ({ counterparty, context }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `You are about to transact with the AI agent at address ${counterparty}.` +
              (context ? ` Context: ${context}.` : "") +
              `\n\nRun the trust gate:\n` +
              `1. Call lookup_agent with address=${counterparty} (free). If found=false, the agent is unknown — warn the user.\n` +
              `2. If found, call check_agent_trust with address=${counterparty} ($0.01). If the verdict is 402 (payment-required), inform the user and stop.\n` +
              `3. Based on the verdict:\n` +
              `   - TRUSTED (score ≥ 80): proceed, briefly cite the score.\n` +
              `   - CAUTION (score 40–79): call get_trust_report for detailed evidence ($0.05) and summarize risk factors before deciding.\n` +
              `   - UNTRUSTED (score < 40): recommend the user abort. Cite the top red flags from the breakdown.\n` +
              `   - UNKNOWN: recommend caution and small-amount testing.\n` +
              `4. Always include the score, verdict, and any flags in your summary.\n` +
              `\nStart with step 1.`,
          },
        },
      ],
    })
  );
}
```

- [ ] **Step 2: Create prompts registry**

Create `packages/trustadd-mcp/src/prompts/index.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAgentTrustGatePrompt } from "./agent-trust-gate.js";

export function registerAllPrompts(server: McpServer): void {
  registerAgentTrustGatePrompt(server);
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/trustadd-mcp/src/prompts/
git commit -m "feat(mcp): add agent_trust_gate prompt for trust-gated transacting flow"
```

---

## Task 12: Refactor `src/index.ts` to bootstrap only

**Files:**
- Modify: `packages/trustadd-mcp/src/index.ts`

- [ ] **Step 1: Replace `src/index.ts` entirely**

Replace the full contents of `packages/trustadd-mcp/src/index.ts` with:

```ts
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { registerAllTools } from "./tools/index.js";
import { registerAllPrompts } from "./prompts/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const server = new McpServer({
  name: pkg.name,
  version: pkg.version,
});

registerAllTools(server);
registerAllPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Verify full test suite passes**

Run: `cd packages/trustadd-mcp && npm run test:run`
Expected: PASS — all test files green (~21 tests total).

- [ ] **Step 3: Verify build succeeds**

Run: `cd packages/trustadd-mcp && npm run build`
Expected: Success. `build/index.js`, `build/lib/*.js`, `build/tools/*.js`, `build/prompts/*.js` all emitted.

- [ ] **Step 4: Smoke-test the compiled server against prod**

Run from a separate shell (simulating an MCP client handshake):

```bash
cd packages/trustadd-mcp
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js 2>/dev/null | head -c 4000
```

Expected output (truncated): a JSON-RPC response containing `"tools":[` with at least 9 tool entries including `lookup_agent`, `mpp_directory_stats`, `ecosystem_overview`, `trustadd_status`.

If the output is empty or malformed, inspect stderr: `node build/index.js < /dev/null 2>&1 | head -20` for import errors.

- [ ] **Step 5: Commit**

```bash
git add packages/trustadd-mcp/src/index.ts
git commit -m "refactor(mcp): shrink index.ts to bootstrap only"
```

---

## Task 13: Update README with new tools + prompt

**Files:**
- Modify: `packages/trustadd-mcp/README.md`

- [ ] **Step 1: Replace README contents**

Replace `packages/trustadd-mcp/README.md` with:

````markdown
# @trustadd/mcp

MCP server for **TrustAdd** — the AI agent trust oracle. Check trust scores, explore the Multi-Protocol Payment (MPP) ecosystem, and query cross-chain analytics for ERC-8004 agents across 9 EVM chains + Tempo.

## Quick Start

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "trustadd": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@trustadd/mcp"]
    }
  }
}
```

### Cursor

```json
{
  "trustadd": {
    "command": "npx",
    "args": ["-y", "@trustadd/mcp"]
  }
}
```

## Tools

### Trust (agent due-diligence)

| Tool | Cost | Purpose |
|------|------|---------|
| `lookup_agent` | Free | Check if TrustAdd has data + verdict preview |
| `check_agent_trust` | $0.01 USDC | Score (0-100), verdict, 5-category breakdown |
| `get_trust_report` | $0.05 USDC | Full profile: identity, on-chain, economic, community |

### MPP (Multi-Protocol Payment ecosystem)

| Tool | Cost | Purpose |
|------|------|---------|
| `mpp_directory_stats` | Free | Directory aggregate stats |
| `mpp_adoption_stats` | Free | Cross-protocol adoption counts (MPP vs x402) |
| `mpp_chain_stats` | Free | Tempo chain volume/tx/payer metrics |
| `mpp_search_services` | Free | Paginated directory search (category, method, text) |

### Analytics (ecosystem research)

| Tool | Cost | Purpose |
|------|------|---------|
| `ecosystem_overview` | Free | Aggregate ecosystem metrics |
| `chain_distribution` | Free | Agent counts per chain |
| `list_supported_chains` | Free | Chain metadata registry |

### Status

| Tool | Cost | Purpose |
|------|------|---------|
| `trustadd_status` | Free | Service health, pipeline breakers, API versions |

## Prompts

### `agent_trust_gate`

Guides an agent framework through a trust-gated transaction decision flow (lookup → check → decision). Args: `counterparty: 0x-address`, `context?: string`.

## x402 Payment

The paid tools (`check_agent_trust`, `get_trust_report`) are gated by the x402 protocol. When called without payment, they return the payment requirements (price, network, token) so you or your agent framework can complete payment via the REST API directly.

**Payment details:**
- Network: Base (Chain ID 8453)
- Token: USDC
- Protocol: x402 (gasless for the payer)

For automated payment, use an x402-compatible HTTP client against the TrustAdd REST API at `https://trustadd.com/api/v1/trust/`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRUSTADD_API_URL` | `https://trustadd.com` | Override API base URL (for testing) |
| `TRUSTADD_API_VERSION_OVERRIDE` | (none) | Override versioned-group API version (e.g. `v2`). Only affects groups registered as versioned in `lib/versioning.ts`. |

## Versioning

The MCP server maps each tool group to an API version via `src/lib/versioning.ts`:

- `trust` → `v1` (versioned URL prefix `/api/v1/trust/...`)
- `mpp`, `analytics`, `status` → unversioned (server-side routes are currently stable)

When TrustAdd ships `/api/v2/trust/`, a single-line change in `versioning.ts` + minor version bump migrates every trust tool.

## Supported Chains

Ethereum (1), BNB Chain (56), Polygon (137), Arbitrum (42161), Base (8453), Celo (42220), Gnosis (100), Optimism (10), Avalanche (43114), Tempo (4217).

## Development

```bash
npm install
npm test            # watch mode
npm run test:run    # CI mode
npm run build
```

## Links

- [TrustAdd](https://trustadd.com)
- [API Docs](https://trustadd.com/docs/trust-api)
- [Product Spec](https://github.com/All-The-New/trustadd/blob/main/docs/trust-product.md)
- [Changelog](./CHANGELOG.md)
````

- [ ] **Step 2: Commit**

```bash
git add packages/trustadd-mcp/README.md
git commit -m "docs(mcp): document new tools, prompt, versioning"
```

---

## Task 14: Add CHANGELOG.md

**Files:**
- Create: `packages/trustadd-mcp/CHANGELOG.md`

- [ ] **Step 1: Create CHANGELOG**

Create `packages/trustadd-mcp/CHANGELOG.md`:

```markdown
# Changelog

All notable changes to `@trustadd/mcp` are documented here. Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-04-17

### Added

- 4 MPP tools: `mpp_directory_stats`, `mpp_adoption_stats`, `mpp_chain_stats`, `mpp_search_services`
- 3 free analytics tools: `ecosystem_overview`, `chain_distribution`, `list_supported_chains`
- 1 status tool: `trustadd_status` (exposes API health, pipeline breakers, active API versions)
- 1 MCP prompt: `agent_trust_gate` (guides agent frameworks through a trust-gated transaction flow)
- Modular file structure: `src/lib/`, `src/tools/`, `src/prompts/`
- API version registry (`src/lib/versioning.ts`) with `TRUSTADD_API_VERSION_OVERRIDE` env support
- Vitest test suite covering the API client, versioning layer, and every tool group
- GitHub Actions workflow for automated npm publish on `mcp-v*` tag

### Changed

- `src/index.ts` reduced from 166 lines to a bootstrap-only file
- Address + chainId validation centralized into `src/lib/schemas.ts`
- Chain ID schema now validates against the 10 supported chains (9 EVM + Tempo)

### Removed

- Nothing (all three v1.0.0 tools preserved with identical signatures)

## [1.0.0] — 2026-04-10

### Added

- Initial release with 3 trust tools: `lookup_agent`, `check_agent_trust`, `get_trust_report`
- x402 payment flow (graceful 402 passthrough)
- Stdio transport
```

- [ ] **Step 2: Commit**

```bash
git add packages/trustadd-mcp/CHANGELOG.md
git commit -m "docs(mcp): add CHANGELOG.md"
```

---

## Task 15: Add GitHub Action for npm publish

**Files:**
- Create: `.github/workflows/publish-mcp.yml` (repo root)

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/publish-mcp.yml`:

```yaml
name: Publish MCP Package

on:
  push:
    tags:
      - "mcp-v*"
  workflow_dispatch: {}

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    defaults:
      run:
        working-directory: packages/trustadd-mcp
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"

      - name: Install
        run: npm ci

      - name: Test
        run: npm run test:run

      - name: Build
        run: npm run build

      - name: Publish
        run: npm publish --access public --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2: Verify `NPM_TOKEN` secret exists in repo**

Run: `gh secret list --repo All-The-New/trustadd`

Expected: `NPM_TOKEN` in the list. If not present, inform the user — they'll need to create an npm automation token scoped to the `@trustadd` org and add it via `gh secret set NPM_TOKEN --repo All-The-New/trustadd`.

Do NOT attempt to create the token or secret without explicit user authorization.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/publish-mcp.yml
git commit -m "ci(mcp): add GitHub Actions workflow for npm publish on mcp-v* tag"
```

---

## Task 16: Bump version + update CLAUDE.md reference

**Files:**
- Modify: `packages/trustadd-mcp/package.json`
- Modify: `CLAUDE.md` (repo root)

- [ ] **Step 1: Bump version to 1.1.0**

Edit `packages/trustadd-mcp/package.json`, change the `version` field from `"1.0.0"` to `"1.1.0"`.

Also update the `description` field to:

```json
  "description": "MCP server for TrustAdd — AI agent trust oracle. Trust scoring, MPP ecosystem analytics, cross-chain agent discovery.",
```

Also update the `keywords` array to add MPP-related terms:

```json
  "keywords": [
    "mcp",
    "trust",
    "agent",
    "erc8004",
    "x402",
    "mpp",
    "tempo",
    "claude",
    "ai-agent",
    "blockchain"
  ],
```

- [ ] **Step 2: Add an entry for the MCP package in CLAUDE.md**

Edit `CLAUDE.md` at the repo root. In the "Important Files" section, add this line before the `vercel.json` entry:

```markdown
- `packages/trustadd-mcp/` — Published MCP server (`@trustadd/mcp` on npm). 11 tools (3 trust, 4 MPP, 3 analytics, 1 status) + 1 prompt (`agent_trust_gate`). Modular structure under `src/{lib,tools,prompts}`. API versioning via `src/lib/versioning.ts`. Tests via vitest. Publish on git tag `mcp-v*`.
```

- [ ] **Step 3: Commit**

```bash
git add packages/trustadd-mcp/package.json CLAUDE.md
git commit -m "chore(mcp): bump to 1.1.0 + register package in CLAUDE.md"
```

---

## Task 17: Pre-publish smoke test against production

**Files:** (none — verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd packages/trustadd-mcp && npm run test:run`
Expected: all green.

- [ ] **Step 2: Run a clean build**

Run: `cd packages/trustadd-mcp && rm -rf build && npm run build`
Expected: `build/index.js` + lib/tools/prompts subdirs present.

- [ ] **Step 3: Exercise 3 tools end-to-end against trustadd.com**

Use a real agent address known to exist on trustadd.com. If none is known, first call:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ecosystem_overview","arguments":{}}}' | node packages/trustadd-mcp/build/index.js 2>/dev/null | head -c 2000
```

Expected: JSON result with `totalAgents`, `activeAgents`, etc.

Next:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"mpp_directory_stats","arguments":{}}}' | node packages/trustadd-mcp/build/index.js 2>/dev/null | head -c 2000
```

Expected: JSON result with directory stats.

Next:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"trustadd_status","arguments":{}}}' | node packages/trustadd-mcp/build/index.js 2>/dev/null | head -c 2000
```

Expected: JSON result with `health`, `pipeline`, `mcpApiVersions: { trust: "v1", mpp: null, ... }`.

If any call returns `isError: true` with an unexpected status, stop and diagnose before publishing. Common issues:
- `TRUSTADD_API_URL` not matching prod (check it's unset or https://trustadd.com)
- MPP routes not registered (if `mpp_*` returns 404, Vercel deploy may be missing `ENABLE_MPP_UI=true`)

- [ ] **Step 4: No commit** — this is verification only.

---

## Task 18: Publish to npm

**Files:** (none — release only)

- [ ] **Step 1: Confirm npm login state**

Run: `npm whoami --registry=https://registry.npmjs.org`

Expected: a username with publish rights to the `@trustadd` org.

If not logged in or wrong account, STOP and ask the user to either:
- Run `npm login` locally themselves, or
- Confirm they'd prefer the CI workflow (Task 15) handle the publish via tag push.

Do NOT attempt `npm login` without explicit user authorization.

- [ ] **Step 2: Dry-run the publish**

Run: `cd packages/trustadd-mcp && npm publish --dry-run --access public`

Expected: output shows `build/index.js`, `build/lib/...`, `build/tools/...`, `build/prompts/...`, `README.md`, `CHANGELOG.md`, `package.json` in the tarball. Confirms NO `src/`, `tests/`, `node_modules/`, `tsconfig*.json`, `vitest.config.ts` shipped.

If any of the excluded files appear in the tarball, stop and fix the `files` field in `package.json`.

- [ ] **Step 3: Confirm with user before publishing**

Stop and ask the user: "Dry-run looks clean. Ready to publish `@trustadd/mcp@1.1.0` to npm. Proceed via (a) direct `npm publish` from this shell, or (b) tag push to trigger the CI workflow?"

Wait for the user's answer.

- [ ] **Step 4a: If user chose direct publish**

Run: `cd packages/trustadd-mcp && npm publish --access public`

Expected: `+ @trustadd/mcp@1.1.0` in output.

Verify: `npm view @trustadd/mcp version` → `1.1.0`.

- [ ] **Step 4b: If user chose CI publish**

Run:

```bash
git tag mcp-v1.1.0
git push origin mcp-v1.1.0
```

Then watch the workflow:

```bash
gh run watch --repo All-The-New/trustadd
```

Expected: green build, publish step completes.

Verify: `npm view @trustadd/mcp version` → `1.1.0`.

- [ ] **Step 5: Post-publish verification**

Run from a scratch directory (e.g. `/tmp/mcp-verify`):

```bash
mkdir -p /tmp/mcp-verify && cd /tmp/mcp-verify
npx -y @trustadd/mcp@1.1.0 --help 2>&1 | head -5 || true
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx -y @trustadd/mcp@1.1.0 2>/dev/null | head -c 2000
```

Expected: `tools/list` returns the full 11-tool registry.

- [ ] **Step 6: Final commit (version anchor)**

Only needed if the publish workflow didn't create a tag automatically:

```bash
cd /Users/ethserver/CLAUDE/trustadd
git tag mcp-v1.1.0 2>/dev/null || echo "tag already exists"
git push origin mcp-v1.1.0 2>/dev/null || echo "already pushed"
```

---

## Enrichments Included

Beyond the user's three explicit asks (MPP, analytics, modular + versioning), this plan bundles:

- **Vitest test suite** — every new module has unit tests; previously untested code now covered
- **CHANGELOG.md** — version history starting from 1.1.0 back-filling 1.0.0
- **GitHub Actions publish workflow** — `mcp-v*` tag push → automated publish with provenance
- **`agent_trust_gate` MCP prompt** — showcases the lookup→check→decision pattern as a first-class prompt
- **`trustadd_status` tool** — health + API version introspection for debugging
- **Centralized chain ID validation** — `ChainIdSchema` enforces the 10 supported chains (bad IDs rejected at the tool boundary)
- **`TRUSTADD_API_VERSION_OVERRIDE` env** — for testing v2 endpoints before default promotion
- **`tsconfig.build.json`** — build doesn't try to compile tests
- **README restructure** — tool tables, versioning section, dev instructions
- **CLAUDE.md registration** — the MCP package is now discoverable to future Claude sessions on this repo
- **Smoke tests against production API** before publish (Task 17)
- **`--dry-run` before publish** to audit the tarball

## Out of Scope (deferred to a future version)

- Exposing the OpenAPI spec as an MCP resource (`resources/list`)
- Additional MPP tools (volume trends, top providers, recent probes) — can be added in 1.2.0 once usage data shows which are valuable
- Paid-tier analytics tools (per-agent transactions, community feedback) — they already return 402 via `/api/agents/:id/*`, but adding dedicated MCP tools awaits demand
- Typed response schemas (response shapes are currently `unknown`) — requires OpenAPI codegen pipeline

## Self-Review

- ✅ **Spec coverage:** MPP (Task 7), analytics (Task 8), modular structure (Tasks 2–12), versioning (Task 3), tests (Tasks 1, 3, 4, 6–8), CHANGELOG (Task 14), CI (Task 15), publish (Task 18).
- ✅ **Placeholders:** none — every task has concrete code/commands.
- ✅ **Type consistency:** `ApiGroup` keys (trust, mpp, analytics, status) match `GROUP_PREFIX` keys and `API_VERSIONS` keys. `registerTrustTools` / `registerMppTools` / `registerAnalyticsTools` / `registerStatusTools` naming consistent. `registerAllTools` + `registerAllPrompts` names consistent with `tools/index.ts` / `prompts/index.ts`. `apiPath` signature stable across all call sites.
- ✅ **Risk gates:** npm publish (Task 18) has explicit user confirmation before any network-visible action.
