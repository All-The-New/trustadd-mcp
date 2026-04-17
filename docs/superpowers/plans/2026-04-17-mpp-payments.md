# Dual-Payment (x402 + MPP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let callers of the Trust Data Product API pay with either x402 (USDC on Base, existing) or MPP (pathUSD on Tempo, new) for the same two endpoints (`/api/v1/trust/:address` at $0.01, `/api/v1/trust/:address/report` at $0.05), with a modular payment-gate module that composes both protocols.

**Architecture:** Refactor `server/lib/x402-gate.ts` into a `server/lib/payment-gate.ts` module built around a `PaymentAdapter` interface. Two adapters: `X402Adapter` (wraps existing `@x402/express` middleware + CDP facilitator) and `MppAdapter` (emits `WWW-Authenticate: Payment` challenges and verifies Tempo pathUSD transfers via direct JSON-RPC). A composed middleware checks each incoming request against all active adapters: if any accepts the request (payment valid), pass through; otherwise return `HTTP 402` with a combined challenge set. Replay protection for MPP uses an in-memory LRU keyed on `(txHash, logIndex)` with 1-hour TTL — no new DB tables. Each adapter activates only when its env vars are set, so the system silently degrades to whichever protocols are configured.

**Tech Stack:** TypeScript (strict), Express, `@x402/express`, `@x402/core`, `@coinbase/x402`, native `fetch` for Tempo JSON-RPC, Vitest.

---

## File Structure

**Create:**
- `server/lib/payment-gate/index.ts` — exported `createPaymentGate()` + `PaymentAdapter` interface + `PaymentRoute` type.
- `server/lib/payment-gate/types.ts` — shared types (`PaymentRoute`, `PaymentAdapter`, `PaymentChallenge`, `VerificationResult`).
- `server/lib/payment-gate/routes.ts` — canonical Trust product route table (shared across adapters).
- `server/lib/payment-gate/x402-adapter.ts` — wraps existing CDP/x402 middleware as a `PaymentAdapter`.
- `server/lib/payment-gate/mpp-adapter.ts` — MPP challenge emission + verification (replay cache + Tempo RPC).
- `server/lib/payment-gate/mpp-challenge.ts` — pure functions: build `WWW-Authenticate: Payment …` header, parse `Authorization: MPP <tx>` payment payload.
- `server/lib/payment-gate/tempo-verifier.ts` — pure(ish) function: given `txHash`, call Tempo RPC, decode pathUSD Transfer log, validate `to`, `asset`, `amount`. Reuses helpers from `server/tempo-transaction-indexer.ts`.
- `server/lib/payment-gate/replay-cache.ts` — in-memory LRU with TTL for used `(txHash, logIndex)` keys.
- `server/lib/payment-gate/__tests__/mpp-challenge.test.ts`
- `server/lib/payment-gate/__tests__/tempo-verifier.test.ts`
- `server/lib/payment-gate/__tests__/replay-cache.test.ts`
- `server/lib/payment-gate/__tests__/payment-gate.test.ts` (composition/fallback tests)
- `docs/mpp-service-entry.json` — `mpp.dev` directory registration artifact (for user to submit).

**Modify:**
- `server/routes/trust.ts` — swap `createTrustProductGate()` import to `createPaymentGate()`; update `/exists` response to advertise MPP when enabled.
- `client/src/pages/trust-api.tsx` — add MPP payment option UI (card + flow diagram).
- `docs/trust-product.md` — document both rails.

**Delete (after cutover in Task 10):**
- `server/lib/x402-gate.ts` — superseded by new module.

---

## Task 1: Scaffold `payment-gate` module with types and route table

**Files:**
- Create: `server/lib/payment-gate/types.ts`
- Create: `server/lib/payment-gate/routes.ts`

- [ ] **Step 1: Write shared types**

Create `server/lib/payment-gate/types.ts`:

```ts
import type { Request, Response, NextFunction, RequestHandler } from "express";

/** One priced endpoint in the Trust Data Product. */
export interface PaymentRoute {
  method: "GET" | "POST";
  /** Express-style path, e.g. "/api/v1/trust/:address". */
  path: string;
  /** Canonical price string ("$0.01"). Adapters interpret into their own token units. */
  price: string;
  /** Price in pathUSD base units (6-decimal, bigint string). Mirrors `price`. */
  priceBaseUnits: string;
  description: string;
}

/** A payment protocol (x402, MPP, future). */
export interface PaymentAdapter {
  /** Short id used in logs. */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /**
   * If this adapter can verify the request's attached payment, verify it
   * and return `{ verified: true }`. If the request carries no payment
   * payload for this adapter, return `{ verified: false }` (no error) so
   * other adapters get a chance. Only throw on internal errors.
   */
  tryVerify(req: Request, route: PaymentRoute): Promise<VerificationResult>;
  /**
   * Produce the challenge this adapter wants to include in the combined
   * 402 response, or `null` if this adapter has no challenge for this route.
   */
  challenge(route: PaymentRoute): PaymentChallenge | null;
}

export type VerificationResult =
  | { verified: true }
  | { verified: false; reason?: string };

export interface PaymentChallenge {
  /** Value to append to the `WWW-Authenticate` header. */
  wwwAuthenticate: string;
  /** Structured description for the JSON 402 body. */
  body: Record<string, unknown>;
}

export type PaymentMiddleware = RequestHandler;
```

- [ ] **Step 2: Write canonical route table**

Create `server/lib/payment-gate/routes.ts`:

```ts
import type { PaymentRoute } from "./types.js";

/** Single source of truth for every priced Trust API endpoint. */
export const TRUST_PRODUCT_ROUTES: readonly PaymentRoute[] = [
  {
    method: "GET",
    path: "/api/v1/trust/:address",
    price: "$0.01",
    priceBaseUnits: "10000", // 0.01 * 10^6
    description: "Agent trust quick check",
  },
  {
    method: "GET",
    path: "/api/v1/trust/:address/report",
    price: "$0.05",
    priceBaseUnits: "50000", // 0.05 * 10^6
    description: "Full agent trust report with evidence",
  },
] as const;

/** Match an Express `req.method` + `req.path` against the route table. */
export function matchRoute(method: string, path: string): PaymentRoute | null {
  for (const r of TRUST_PRODUCT_ROUTES) {
    if (r.method !== method) continue;
    const regex = new RegExp(
      "^" + r.path.replace(/:[^/]+/g, "[^/]+") + "$",
    );
    if (regex.test(path)) return r;
  }
  return null;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/lib/payment-gate/types.ts server/lib/payment-gate/routes.ts
git commit -m "feat(payment-gate): scaffold shared types and route table"
```

---

## Task 2: Replay-protection LRU cache

**Files:**
- Create: `server/lib/payment-gate/replay-cache.ts`
- Test: `server/lib/payment-gate/__tests__/replay-cache.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/lib/payment-gate/__tests__/replay-cache.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ReplayCache } from "../replay-cache.js";

describe("ReplayCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("records a key and reports it as used", () => {
    const cache = new ReplayCache({ ttlMs: 1000, maxSize: 10 });
    expect(cache.has("k1")).toBe(false);
    cache.add("k1");
    expect(cache.has("k1")).toBe(true);
  });

  it("expires entries after TTL", () => {
    const cache = new ReplayCache({ ttlMs: 1000, maxSize: 10 });
    cache.add("k1");
    vi.advanceTimersByTime(1001);
    expect(cache.has("k1")).toBe(false);
  });

  it("evicts oldest entries when size exceeds max", () => {
    const cache = new ReplayCache({ ttlMs: 1_000_000, maxSize: 2 });
    cache.add("a");
    cache.add("b");
    cache.add("c");
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/lib/payment-gate/__tests__/replay-cache.test.ts`
Expected: FAIL — `ReplayCache` not found.

- [ ] **Step 3: Implement cache**

Create `server/lib/payment-gate/replay-cache.ts`:

```ts
interface Entry { key: string; expiresAt: number; }

export interface ReplayCacheOptions {
  ttlMs: number;
  maxSize: number;
}

/**
 * Small LRU with per-entry TTL. Insertion order preserved via Map iteration.
 * Single-process only — acceptable for Vercel serverless because replay is
 * also prevented by the underlying tx being a real on-chain transfer: the
 * window of risk is one warm-container lifetime (minutes).
 */
export class ReplayCache {
  private map = new Map<string, Entry>();
  private ttlMs: number;
  private maxSize: number;

  constructor(opts: ReplayCacheOptions) {
    this.ttlMs = opts.ttlMs;
    this.maxSize = opts.maxSize;
  }

  has(key: string): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  add(key: string): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { key, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.maxSize) {
      const first = this.map.keys().next().value;
      if (first === undefined) break;
      this.map.delete(first);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/lib/payment-gate/__tests__/replay-cache.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/payment-gate/replay-cache.ts server/lib/payment-gate/__tests__/replay-cache.test.ts
git commit -m "feat(payment-gate): add replay LRU cache for MPP tx hashes"
```

---

## Task 3: MPP challenge header + payment-payload parsing

**Files:**
- Create: `server/lib/payment-gate/mpp-challenge.ts`
- Test: `server/lib/payment-gate/__tests__/mpp-challenge.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/lib/payment-gate/__tests__/mpp-challenge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildMppChallenge, parseMppPaymentHeader } from "../mpp-challenge.js";

describe("buildMppChallenge", () => {
  it("emits a Payment-scheme WWW-Authenticate header with base64url request", () => {
    const header = buildMppChallenge({
      id: "chk_123",
      realm: "trustadd.com",
      recipient: "0x0000000000000000000000000000000000000001",
      asset: "0x20c000000000000000000000b9537d11c60e8b50",
      amountBaseUnits: "10000",
      chainId: 4217,
    });
    expect(header).toMatch(/^Payment id="chk_123"/);
    expect(header).toContain('method="tempo"');
    expect(header).toContain('intent="charge"');
    expect(header).toMatch(/request="[A-Za-z0-9_-]+"/);
  });
});

describe("parseMppPaymentHeader", () => {
  it("parses 'MPP <txHash>' payload", () => {
    const parsed = parseMppPaymentHeader("MPP 0xabc");
    expect(parsed).toEqual({ txHash: "0xabc" });
  });

  it("parses 'MPP tx=<hash> logIndex=<n>' payload", () => {
    const parsed = parseMppPaymentHeader('MPP tx="0xabc" logIndex="3"');
    expect(parsed).toEqual({ txHash: "0xabc", logIndex: 3 });
  });

  it("returns null for unrelated schemes", () => {
    expect(parseMppPaymentHeader("Bearer xyz")).toBeNull();
    expect(parseMppPaymentHeader("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npx vitest run server/lib/payment-gate/__tests__/mpp-challenge.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `server/lib/payment-gate/mpp-challenge.ts`:

```ts
export interface MppChallengeInput {
  id: string;
  realm: string;
  recipient: string;
  asset: string;
  amountBaseUnits: string;
  chainId: number;
}

/**
 * Build a WWW-Authenticate: Payment header per IETF draft-ryan-httpauth-payment-00.
 * Mirrors the format the `mpp-prober` already parses.
 */
export function buildMppChallenge(input: MppChallengeInput): string {
  const requestPayload = {
    recipient: input.recipient.toLowerCase(),
    asset: input.asset.toLowerCase(),
    amount: input.amountBaseUnits,
    chainId: input.chainId,
  };
  const json = JSON.stringify(requestPayload);
  const b64url = Buffer.from(json, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return (
    `Payment id="${input.id}", realm="${input.realm}", method="tempo", ` +
    `intent="charge", request="${b64url}"`
  );
}

export interface ParsedMppPayment {
  txHash: string;
  logIndex?: number;
}

/**
 * Parse an `Authorization` (or `X-Payment`) header carrying an MPP proof.
 * Accepts either `MPP <txHash>` or `MPP tx="0x.." logIndex="N"` forms.
 */
export function parseMppPaymentHeader(value: string | undefined): ParsedMppPayment | null {
  if (!value) return null;
  const m = /^MPP\s+(.+)$/i.exec(value.trim());
  if (!m) return null;
  const body = m[1].trim();

  // Simple form: raw tx hash
  const simple = /^(0x[0-9a-fA-F]{64})$/.exec(body);
  if (simple) return { txHash: simple[1].toLowerCase() };

  // Parameterized form
  const params: Record<string, string> = {};
  const re = /(\w+)\s*=\s*"((?:\\.|[^"\\])*)"/g;
  let hit;
  while ((hit = re.exec(body)) !== null) params[hit[1]] = hit[2];
  if (!params.tx) return null;
  const out: ParsedMppPayment = { txHash: params.tx.toLowerCase() };
  if (params.logIndex) out.logIndex = Number.parseInt(params.logIndex, 10);
  return out;
}
```

- [ ] **Step 4: Run it to confirm success**

Run: `npx vitest run server/lib/payment-gate/__tests__/mpp-challenge.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/payment-gate/mpp-challenge.ts server/lib/payment-gate/__tests__/mpp-challenge.test.ts
git commit -m "feat(payment-gate): MPP challenge + payment-header codec"
```

---

## Task 4: Tempo RPC verifier (pathUSD Transfer decoding)

**Files:**
- Create: `server/lib/payment-gate/tempo-verifier.ts`
- Test: `server/lib/payment-gate/__tests__/tempo-verifier.test.ts`

**Approach:** Given a tx hash, call `eth_getTransactionReceipt` on the Tempo RPC, find a pathUSD `Transfer` log where `to == MPP_PAY_TO_ADDRESS` and `value >= priceBaseUnits`. Reuse `decodeTransferLog` from `server/tempo-transaction-indexer.ts` (already exported).

- [ ] **Step 1: Write failing test**

Create `server/lib/payment-gate/__tests__/tempo-verifier.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyTempoPayment } from "../tempo-verifier.js";

const PATHUSD = "0x20c000000000000000000000b9537d11c60e8b50";
const RECIPIENT = "0x000000000000000000000000000000000000beef";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function receipt(logs: any[]) {
  return { jsonrpc: "2.0", id: 1, result: { status: "0x1", logs } };
}

function makeLog(opts: { to: string; value: bigint; address?: string; logIndex?: number }) {
  return {
    address: opts.address ?? PATHUSD,
    topics: [
      TRANSFER_TOPIC,
      "0x" + "aa".padStart(64, "0"),
      "0x" + opts.to.toLowerCase().replace(/^0x/, "").padStart(64, "0"),
    ],
    data: "0x" + opts.value.toString(16).padStart(64, "0"),
    blockNumber: "0x1",
    transactionHash: "0xabc",
    logIndex: "0x" + (opts.logIndex ?? 0).toString(16),
  };
}

describe("verifyTempoPayment", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("accepts a receipt with a matching Transfer log at or above the price", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => receipt([makeLog({ to: RECIPIENT, value: BigInt(10000) })]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyTempoPayment({
      txHash: "0xabc",
      recipient: RECIPIENT,
      asset: PATHUSD,
      minAmountBaseUnits: "10000",
      rpcUrl: "https://rpc.tempo.xyz",
    });
    expect(result.verified).toBe(true);
  });

  it("rejects when amount is below price", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => receipt([makeLog({ to: RECIPIENT, value: BigInt(5000) })]),
    }));
    const r = await verifyTempoPayment({
      txHash: "0xabc",
      recipient: RECIPIENT,
      asset: PATHUSD,
      minAmountBaseUnits: "10000",
      rpcUrl: "https://rpc.tempo.xyz",
    });
    expect(r.verified).toBe(false);
  });

  it("rejects when recipient does not match", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => receipt([makeLog({
        to: "0x000000000000000000000000000000000000dead",
        value: BigInt(10000),
      })]),
    }));
    const r = await verifyTempoPayment({
      txHash: "0xabc",
      recipient: RECIPIENT,
      asset: PATHUSD,
      minAmountBaseUnits: "10000",
      rpcUrl: "https://rpc.tempo.xyz",
    });
    expect(r.verified).toBe(false);
  });

  it("rejects when receipt missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: null }),
    }));
    const r = await verifyTempoPayment({
      txHash: "0xabc",
      recipient: RECIPIENT,
      asset: PATHUSD,
      minAmountBaseUnits: "10000",
      rpcUrl: "https://rpc.tempo.xyz",
    });
    expect(r.verified).toBe(false);
  });

  it("rejects when status is not success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: { status: "0x0", logs: [makeLog({ to: RECIPIENT, value: BigInt(10000) })] },
      }),
    }));
    const r = await verifyTempoPayment({
      txHash: "0xabc",
      recipient: RECIPIENT,
      asset: PATHUSD,
      minAmountBaseUnits: "10000",
      rpcUrl: "https://rpc.tempo.xyz",
    });
    expect(r.verified).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run server/lib/payment-gate/__tests__/tempo-verifier.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement verifier**

Create `server/lib/payment-gate/tempo-verifier.ts`:

```ts
import { decodeTransferLog } from "../../tempo-transaction-indexer.js";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface TempoVerifyInput {
  txHash: string;
  recipient: string;        // lowercase 0x…
  asset: string;            // pathUSD contract address, lowercase
  minAmountBaseUnits: string;
  rpcUrl: string;
}

export interface TempoVerifyResult {
  verified: boolean;
  reason?: string;
  logIndex?: number;
}

interface RpcReceipt {
  status: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    logIndex: string;
  }>;
}

export async function verifyTempoPayment(input: TempoVerifyInput): Promise<TempoVerifyResult> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getTransactionReceipt",
    params: [input.txHash],
  };
  let resp: Response;
  try {
    resp = await fetch(input.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { verified: false, reason: `rpc-error: ${(err as Error).message}` };
  }
  if (!resp.ok) return { verified: false, reason: `rpc-http-${resp.status}` };

  const json = (await resp.json()) as { result: RpcReceipt | null; error?: unknown };
  const receipt = json.result;
  if (!receipt) return { verified: false, reason: "receipt-not-found" };
  if (receipt.status !== "0x1") return { verified: false, reason: "tx-reverted" };

  const recipient = input.recipient.toLowerCase();
  const asset = input.asset.toLowerCase();
  const minAmount = BigInt(input.minAmountBaseUnits);

  for (const logEntry of receipt.logs) {
    if (logEntry.address.toLowerCase() !== asset) continue;
    if (logEntry.topics[0] !== TRANSFER_TOPIC) continue;

    const decoded = decodeTransferLog(logEntry);
    if (decoded.to !== recipient) continue;
    if (BigInt(decoded.amountRaw) < minAmount) continue;
    return { verified: true, logIndex: decoded.logIndex };
  }
  return { verified: false, reason: "no-matching-transfer" };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/lib/payment-gate/__tests__/tempo-verifier.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/payment-gate/tempo-verifier.ts server/lib/payment-gate/__tests__/tempo-verifier.test.ts
git commit -m "feat(payment-gate): Tempo pathUSD transfer receipt verifier"
```

---

## Task 5: `MppAdapter` — compose challenge + verifier + replay cache

**Files:**
- Create: `server/lib/payment-gate/mpp-adapter.ts`

- [ ] **Step 1: Implement adapter**

Create `server/lib/payment-gate/mpp-adapter.ts`:

```ts
import type { Request } from "express";
import type { PaymentAdapter, PaymentChallenge, PaymentRoute, VerificationResult } from "./types.js";
import { TEMPO_CHAIN_CONFIG, TEMPO_CHAIN_ID } from "../../../shared/chains.js";
import { buildMppChallenge, parseMppPaymentHeader } from "./mpp-challenge.js";
import { verifyTempoPayment } from "./tempo-verifier.js";
import { ReplayCache } from "./replay-cache.js";
import { log } from "../log.js";

export interface MppAdapterConfig {
  recipient: string;
  rpcUrl: string;
  realm: string;
}

const REPLAY_TTL_MS = 60 * 60 * 1000; // 1h
const REPLAY_MAX = 10_000;

/**
 * MPP (pathUSD on Tempo) payment adapter.
 * Returns null from factory if required env is missing.
 */
export function createMppAdapter(): PaymentAdapter | null {
  const recipient = process.env.MPP_PAY_TO_ADDRESS?.toLowerCase();
  const rpcUrl = process.env.TEMPO_RPC_URL || TEMPO_CHAIN_CONFIG.rpcUrl;

  if (!recipient || !/^0x[0-9a-f]{40}$/.test(recipient)) {
    log("mpp adapter disabled: MPP_PAY_TO_ADDRESS unset or malformed", "payment-gate");
    return null;
  }
  if (!rpcUrl) {
    log("mpp adapter disabled: no Tempo RPC URL", "payment-gate");
    return null;
  }

  const replay = new ReplayCache({ ttlMs: REPLAY_TTL_MS, maxSize: REPLAY_MAX });
  const cfg: MppAdapterConfig = { recipient, rpcUrl, realm: "trustadd.com" };

  log(`mpp adapter enabled: recipient=${recipient} rpc=${rpcUrl}`, "payment-gate");

  return {
    id: "mpp",
    label: "MPP (pathUSD on Tempo)",
    challenge(route: PaymentRoute): PaymentChallenge {
      const id = `trust-${route.path.replace(/[^a-z0-9]/gi, "-")}-${route.priceBaseUnits}`;
      const header = buildMppChallenge({
        id,
        realm: cfg.realm,
        recipient: cfg.recipient,
        asset: TEMPO_CHAIN_CONFIG.tokens.pathUSD.address,
        amountBaseUnits: route.priceBaseUnits,
        chainId: TEMPO_CHAIN_ID,
      });
      return {
        wwwAuthenticate: header,
        body: {
          scheme: "mpp",
          method: "tempo",
          intent: "charge",
          chainId: TEMPO_CHAIN_ID,
          recipient: cfg.recipient,
          asset: TEMPO_CHAIN_CONFIG.tokens.pathUSD.address,
          assetSymbol: "pathUSD",
          amount: route.priceBaseUnits,
          price: route.price,
        },
      };
    },
    async tryVerify(req: Request, route: PaymentRoute): Promise<VerificationResult> {
      const raw = req.header("x-payment") ?? req.header("authorization");
      const parsed = parseMppPaymentHeader(raw ?? undefined);
      if (!parsed) return { verified: false }; // not an MPP payment → defer

      const replayKey = `${parsed.txHash}:${parsed.logIndex ?? "*"}`;
      if (replay.has(replayKey)) {
        return { verified: false, reason: "replay" };
      }

      const result = await verifyTempoPayment({
        txHash: parsed.txHash,
        recipient: cfg.recipient,
        asset: TEMPO_CHAIN_CONFIG.tokens.pathUSD.address,
        minAmountBaseUnits: route.priceBaseUnits,
        rpcUrl: cfg.rpcUrl,
      });
      if (!result.verified) return { verified: false, reason: result.reason };

      replay.add(`${parsed.txHash}:${result.logIndex ?? "*"}`);
      replay.add(replayKey); // defensive
      return { verified: true };
    },
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/lib/payment-gate/mpp-adapter.ts
git commit -m "feat(payment-gate): MppAdapter composing challenge, verifier, replay cache"
```

---

## Task 6: `X402Adapter` — wrap existing middleware as an adapter

**Files:**
- Create: `server/lib/payment-gate/x402-adapter.ts`

**Approach:** The `@x402/express` middleware already does full verify-or-challenge behavior. We wrap it so the composed gate can delegate when the request advertises x402 intent, while still contributing a challenge to the combined 402 response when no payment is present.

Strategy: run the upstream middleware in "capture" mode. If it calls `next()`, payment was verified → mark adapter verified. If it calls `res.status(402)...`, payment was not present or invalid → let the composed gate own the 402 response, and inject the x402 JSON body as the x402 challenge.

- [ ] **Step 1: Implement adapter**

Create `server/lib/payment-gate/x402-adapter.ts`:

```ts
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { RoutesConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createFacilitatorConfig } from "@coinbase/x402";

import type { PaymentAdapter, PaymentChallenge, PaymentRoute, VerificationResult } from "./types.js";
import { TRUST_PRODUCT_ROUTES } from "./routes.js";
import { log } from "../log.js";

const BASE_NETWORK = "eip155:8453" as const;
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base mainnet USDC

export function createX402Adapter(): PaymentAdapter | null {
  const payTo = process.env.TRUST_PRODUCT_PAY_TO;
  const cdpKeyId = process.env.CDP_API_KEY_ID;
  const cdpPrivateKey = process.env.CDP_PRIVATE_KEY;

  if (!payTo || !cdpKeyId || !cdpPrivateKey) {
    log("x402 adapter disabled: missing TRUST_PRODUCT_PAY_TO / CDP_API_KEY_ID / CDP_PRIVATE_KEY", "payment-gate");
    return null;
  }

  let middleware: RequestHandler;
  try {
    const facilitatorConfig = createFacilitatorConfig(cdpKeyId, cdpPrivateKey);
    const facilitatorClient = new HTTPFacilitatorClient(facilitatorConfig);
    const server = new x402ResourceServer(facilitatorClient).register(BASE_NETWORK, new ExactEvmScheme());

    const routes: RoutesConfig = {};
    for (const r of TRUST_PRODUCT_ROUTES) {
      routes[`${r.method} ${r.path}`] = {
        accepts: [{ scheme: "exact", price: r.price, network: BASE_NETWORK, payTo }],
        description: r.description,
        mimeType: "application/json",
      };
    }
    middleware = paymentMiddleware(routes, server);
  } catch (err) {
    log(`x402 adapter construction failed: ${(err as Error).message}`, "payment-gate");
    return null;
  }

  log(`x402 adapter enabled: payTo=${payTo}, network=${BASE_NETWORK}`, "payment-gate");

  return {
    id: "x402",
    label: "x402 (USDC on Base)",
    challenge(route: PaymentRoute): PaymentChallenge {
      // Static description — the composed gate renders the combined body,
      // we just provide the x402-shaped entry.
      return {
        wwwAuthenticate: `x402 scheme="exact", network="${BASE_NETWORK}", asset="USDC", amount="${route.price}"`,
        body: {
          scheme: "exact",
          network: BASE_NETWORK,
          asset: "USDC",
          assetAddress: USDC_BASE,
          payTo,
          price: route.price,
        },
      };
    },
    async tryVerify(req: Request, _route: PaymentRoute): Promise<VerificationResult> {
      // Delegate to upstream middleware with a captured next/res. If it calls
      // next(), payment is valid. If it returns a 402, we treat as "not
      // presented" so the composed gate can emit the combined challenge.
      return new Promise<VerificationResult>((resolve) => {
        // Intercept res.status()/res.json() just enough to detect the 402
        // without polluting the real response.
        let decided = false;
        const originalStatus = req.res?.status.bind(req.res);
        const fakeRes: Partial<Response> = {
          status(code: number) {
            if (code === 402 && !decided) {
              decided = true;
              resolve({ verified: false });
            }
            return this as Response;
          },
          json(_body: unknown) { return this as Response; },
          set() { return this as Response; },
          setHeader() { return this as Response; },
          end() { return this as Response; },
          send() { return this as Response; },
        };
        const next: NextFunction = (err?: unknown) => {
          if (decided) return;
          decided = true;
          if (err) resolve({ verified: false, reason: String(err) });
          else resolve({ verified: true });
        };
        try {
          middleware(req, fakeRes as Response, next);
        } catch (err) {
          if (!decided) {
            decided = true;
            resolve({ verified: false, reason: (err as Error).message });
          }
        }
      });
    },
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/lib/payment-gate/x402-adapter.ts
git commit -m "feat(payment-gate): X402Adapter wrapping upstream middleware"
```

---

## Task 7: Compose adapters into a single middleware + test composition

**Files:**
- Create: `server/lib/payment-gate/index.ts`
- Test: `server/lib/payment-gate/__tests__/payment-gate.test.ts`

- [ ] **Step 1: Write failing composition test**

Create `server/lib/payment-gate/__tests__/payment-gate.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import express from "express";
import { composePaymentGate } from "../index.js";
import type { PaymentAdapter } from "../types.js";

function mockAdapter(id: string, verifies: boolean, challenge = `Scheme realm="${id}"`): PaymentAdapter {
  return {
    id,
    label: id,
    challenge: () => ({ wwwAuthenticate: challenge, body: { id } }),
    tryVerify: vi.fn().mockResolvedValue(verifies ? { verified: true } : { verified: false }),
  };
}

async function request(app: express.Express, path: string) {
  return new Promise<{ status: number; headers: Record<string, string[]>; body: any }>((resolve) => {
    const req: any = { method: "GET", path, url: path, headers: {}, header: () => undefined };
    const chunks: Buffer[] = [];
    const headers: Record<string, string[]> = {};
    let status = 200;
    const res: any = {
      status(c: number) { status = c; return this; },
      setHeader(k: string, v: string | string[]) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v : [v];
      },
      getHeader(k: string) { return headers[k.toLowerCase()]; },
      appendHeader(k: string, v: string) {
        const key = k.toLowerCase();
        headers[key] = headers[key] ? [...headers[key], v] : [v];
      },
      set(k: string, v: string) { this.setHeader(k, v); return this; },
      write(c: Buffer) { chunks.push(c); },
      end(c?: any) {
        if (c) chunks.push(Buffer.from(c));
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf-8")) : null;
        resolve({ status, headers, body });
      },
      json(b: any) { this.end(JSON.stringify(b)); return this; },
    };
    app(req, res);
  });
}

describe("composePaymentGate", () => {
  it("passes through when a route is not priced", async () => {
    const gate = composePaymentGate([mockAdapter("x402", false)]);
    const app = express();
    app.use(gate);
    app.get("/free", (_req, res) => res.json({ ok: true }));
    const r = await request(app, "/free");
    expect(r.status).toBe(200);
  });

  it("returns 402 with all adapter challenges when no payment present", async () => {
    const gate = composePaymentGate([
      mockAdapter("x402", false, 'x402 scheme="exact"'),
      mockAdapter("mpp", false, 'Payment method="tempo"'),
    ]);
    const app = express();
    app.use(gate);
    app.get("/api/v1/trust/:address", (_req, res) => res.json({ ok: true }));
    const r = await request(app, "/api/v1/trust/0xabc");
    expect(r.status).toBe(402);
    expect(r.headers["www-authenticate"]).toEqual([
      'x402 scheme="exact"',
      'Payment method="tempo"',
    ]);
    expect(r.body.accepts).toHaveLength(2);
  });

  it("lets through when any adapter verifies", async () => {
    const gate = composePaymentGate([
      mockAdapter("x402", false),
      mockAdapter("mpp", true),
    ]);
    const app = express();
    app.use(gate);
    app.get("/api/v1/trust/:address", (_req, res) => res.json({ ok: true }));
    const r = await request(app, "/api/v1/trust/0xabc");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run server/lib/payment-gate/__tests__/payment-gate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement composer**

Create `server/lib/payment-gate/index.ts`:

```ts
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { PaymentAdapter, PaymentMiddleware, PaymentRoute } from "./types.js";
import { TRUST_PRODUCT_ROUTES, matchRoute } from "./routes.js";
import { createX402Adapter } from "./x402-adapter.js";
import { createMppAdapter } from "./mpp-adapter.js";
import { log } from "../log.js";

export type { PaymentAdapter, PaymentRoute } from "./types.js";
export { TRUST_PRODUCT_ROUTES } from "./routes.js";

/**
 * Build the payment gate middleware from the adapters configured by env.
 * Returns null only if NO adapter is configured — callers decide whether
 * that's fatal or acceptable.
 */
export function createPaymentGate(): PaymentMiddleware | null {
  const adapters: PaymentAdapter[] = [];
  const x402 = createX402Adapter();
  if (x402) adapters.push(x402);
  const mpp = createMppAdapter();
  if (mpp) adapters.push(mpp);

  if (adapters.length === 0) {
    log("payment gate disabled: no adapters configured", "payment-gate");
    return null;
  }
  log(`payment gate active with adapters: ${adapters.map(a => a.id).join(", ")}`, "payment-gate");
  return composePaymentGate(adapters);
}

/**
 * Exported for tests — compose an explicit adapter list.
 */
export function composePaymentGate(adapters: PaymentAdapter[]): RequestHandler {
  return async function paymentGate(req: Request, res: Response, next: NextFunction) {
    const route = matchRoute(req.method, req.path);
    if (!route) return next();

    for (const adapter of adapters) {
      try {
        const result = await adapter.tryVerify(req, route);
        if (result.verified) return next();
      } catch (err) {
        log(`adapter ${adapter.id} verification error: ${(err as Error).message}`, "payment-gate");
      }
    }

    // No adapter verified → emit combined 402.
    const challenges = adapters
      .map((a) => ({ id: a.id, label: a.label, challenge: a.challenge(route) }))
      .filter((c): c is { id: string; label: string; challenge: NonNullable<ReturnType<PaymentAdapter["challenge"]>> } => c.challenge !== null);

    for (const c of challenges) {
      res.appendHeader("WWW-Authenticate", c.challenge.wwwAuthenticate);
    }
    res.status(402).json({
      error: "Payment Required",
      price: route.price,
      description: route.description,
      accepts: challenges.map((c) => ({
        adapter: c.id,
        label: c.label,
        ...c.challenge.body,
      })),
    });
  };
}
```

> Note on `res.appendHeader`: Node 18+ supports it. If the project targets an older Node, fall back to `res.setHeader("WWW-Authenticate", existing ? [existing, next].flat() : next)`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/lib/payment-gate/__tests__/payment-gate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/payment-gate/index.ts server/lib/payment-gate/__tests__/payment-gate.test.ts
git commit -m "feat(payment-gate): compose adapters into combined 402 middleware"
```

---

## Task 8: Swap `trust.ts` to the new gate + update `/exists` advertisement

**Files:**
- Modify: `server/routes/trust.ts`

- [ ] **Step 1: Replace import and mount**

Edit `server/routes/trust.ts`:

1. Replace:
```ts
import { createTrustProductGate } from "../lib/x402-gate.js";
```
with:
```ts
import { createPaymentGate } from "../lib/payment-gate/index.js";
```

2. Replace the gate mounting block (lines ~100-106) with:
```ts
if (trustProductEnabled) {
  const gate = createPaymentGate();
  if (gate) {
    app.use(gate);
    logger.info("Trust Data Product payment gate active");
  }
}
```

3. Update the `/exists` response (two places — found and not-found branches) to advertise both rails. Replace the two response bodies with a shared helper at top of `registerTrustRoutes`:

```ts
function buildPaymentAdvertisement() {
  const methods: Array<Record<string, unknown>> = [];
  if (process.env.CDP_API_KEY_ID && process.env.CDP_PRIVATE_KEY && process.env.TRUST_PRODUCT_PAY_TO) {
    methods.push({
      scheme: "x402",
      network: "eip155:8453",
      asset: "USDC",
      payTo: process.env.TRUST_PRODUCT_PAY_TO,
    });
  }
  if (process.env.MPP_PAY_TO_ADDRESS) {
    methods.push({
      scheme: "mpp",
      method: "tempo",
      chainId: 4217,
      asset: "pathUSD",
      assetAddress: "0x20c000000000000000000000b9537d11c60e8b50",
      payTo: process.env.MPP_PAY_TO_ADDRESS.toLowerCase(),
    });
  }
  return {
    quickCheckPrice: "$0.01",
    fullReportPrice: "$0.05",
    paymentMethods: methods,
  };
}
```

Then in each `/exists` response body, replace the four `x402Required / quickCheckPrice / fullReportPrice / paymentNetwork / paymentToken` fields with:

```ts
paymentRequired: true,
...buildPaymentAdvertisement(),
```

- [ ] **Step 2: Type-check + full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: both green. Existing tests unaffected; new tests from Tasks 2-7 pass.

- [ ] **Step 3: Delete legacy file**

```bash
git rm server/lib/x402-gate.ts
```

Confirm no other imports remain:

Run: `grep -r "x402-gate" server/ client/ api/ shared/`
Expected: no results.

- [ ] **Step 4: Commit**

```bash
git add server/routes/trust.ts
git commit -m "feat(trust): mount unified payment gate; advertise x402+mpp on /exists"
```

---

## Task 9: Update Trust API product page with dual-payment UI

**Files:**
- Modify: `client/src/pages/trust-api.tsx`

- [ ] **Step 1: Open the file and identify sections to update**

Run: `grep -n "x402 Micropayment\|How x402 Payment Works\|REST API + x402\|USDC on Base" client/src/pages/trust-api.tsx`

- [ ] **Step 2: Edit heading and subcopy**

Change the hero "x402 Micropayment" tag to "Micropayments — x402 or MPP". Update the subtitle explaining both rails are supported: "Pay per query via x402 (USDC on Base) or MPP (pathUSD on Tempo) — no API keys, no subscriptions."

Update the two pricing card captions from `per query · USDC on Base` to `per query · x402 or MPP` (for both $0.01 Quick Check and $0.05 Full Report).

- [ ] **Step 3: Add an MPP section beside the x402 section**

After the existing "How x402 Payment Works" section, add a parallel "How MPP Payment Works" section using the same step structure:

```tsx
<section className="space-y-6">
  <h2 className="text-2xl font-bold text-center">How MPP Payment Works</h2>
  <div className="grid md:grid-cols-4 gap-4">
    {[
      { step: "1", title: "Request", desc: "Agent calls the Trust endpoint" },
      { step: "2", title: "402 Response", desc: "Server returns WWW-Authenticate: Payment challenge" },
      { step: "3", title: "Pay", desc: "Agent sends pathUSD on Tempo (chain 4217) to listed recipient" },
      { step: "4", title: "Retry", desc: 'Agent retries with `Authorization: MPP 0x<txHash>`' },
    ].map((s) => (
      <Card key={s.step}>{/* same pattern as the x402 block */}</Card>
    ))}
  </div>
</section>
```

Reuse the existing `Card` component structure from the x402 flow — copy that block and retarget the copy. Keep both sections side-by-side or stacked.

- [ ] **Step 4: Update the "Integration" card**

Change the title from "REST API + x402" to "REST API + x402 / MPP" and update the body:

```
Direct HTTP integration. Pay with x402 (EIP-3009 USDC on Base, facilitator-settled)
or MPP (pathUSD on Tempo chain 4217, direct transfer + tx-hash proof).
```

- [ ] **Step 5: Build and spot-check**

Run: `npm run build`
Expected: production build succeeds. Then run `npm run dev` and browse `/trust-api` to eyeball the new sections.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/trust-api.tsx
git commit -m "feat(trust-api-page): document MPP payment option alongside x402"
```

---

## Task 10: mpp.dev service registration entry

**Files:**
- Create: `docs/mpp-service-entry.json`

- [ ] **Step 1: Write registration JSON**

Create `docs/mpp-service-entry.json`:

```json
{
  "name": "TrustAdd Trust API",
  "description": "Agent trust oracle — query a machine-readable trust verdict for any ERC-8004 agent across 9 EVM chains. Pay per query with pathUSD on Tempo.",
  "category": "data",
  "tags": ["trust", "reputation", "agents", "erc-8004", "oracle"],
  "website": "https://trustadd.com",
  "documentation": "https://trustadd.com/trust-api",
  "endpoints": [
    {
      "url": "https://trustadd.com/api/v1/trust/{address}",
      "method": "GET",
      "description": "Quick trust check",
      "price": { "amount": "0.01", "currency": "USD", "asset": "pathUSD" }
    },
    {
      "url": "https://trustadd.com/api/v1/trust/{address}/report",
      "method": "GET",
      "description": "Full trust report",
      "price": { "amount": "0.05", "currency": "USD", "asset": "pathUSD" }
    }
  ],
  "payment": {
    "method": "tempo",
    "chainId": 4217,
    "asset": "0x20c000000000000000000000b9537d11c60e8b50",
    "recipient": "<MPP_PAY_TO_ADDRESS — fill in after creating Tempo wallet>"
  },
  "contact": "admin@allthenew.com"
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/mpp-service-entry.json
git commit -m "docs: mpp.dev directory registration entry for TrustAdd Trust API"
```

---

## Task 11: Update `docs/trust-product.md` with dual-payment spec

**Files:**
- Modify: `docs/trust-product.md`

- [ ] **Step 1: Edit payment protocol section**

Replace the single-protocol description at the top of the doc with:

```markdown
**Payment protocols:**
- **x402** — USDC on Base (chain 8453), settled by the Coinbase CDP facilitator. EIP-3009 authorization — gasless for the payer.
- **MPP** — pathUSD on Tempo (chain 4217). Direct transfer; client submits the tx hash on retry (`Authorization: MPP 0x<hash>`). TrustAdd verifies on-chain via the Tempo RPC and replay-guards for 1h.

Both rails price the same: $0.01 Quick Check, $0.05 Full Report. The 402 response advertises every configured rail in a single `WWW-Authenticate` header set.
```

- [ ] **Step 2: Add an MPP request/response example**

Below the existing x402 example, document the MPP flow:

- Request → `GET /api/v1/trust/0xabc...`
- 402 response with `WWW-Authenticate: Payment id="…", realm="trustadd.com", method="tempo", intent="charge", request="<b64url>"`
- Client sends pathUSD on Tempo to `MPP_PAY_TO_ADDRESS`.
- Client retries with `Authorization: MPP 0x<txHash>`.
- Server verifies receipt, serves JSON.

- [ ] **Step 3: Commit**

```bash
git add docs/trust-product.md
git commit -m "docs(trust-product): document dual x402 + MPP payment support"
```

---

## Task 12: Final smoke test + deploy checks

- [ ] **Step 1: Run full test + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all green. New tests: replay-cache (3), mpp-challenge (4), tempo-verifier (5), payment-gate composition (3). Total new: 15.

- [ ] **Step 2: Verify env-var sync script**

Run: `grep -n "MPP_PAY_TO_ADDRESS\|TEMPO_RPC_URL" script/sync-trigger-env.ts` — add `MPP_PAY_TO_ADDRESS` to the list if that script enumerates env vars to sync (it likely does; check first).

If the list is explicit, edit it to include `MPP_PAY_TO_ADDRESS`. Commit separately.

- [ ] **Step 3: Preview deploy**

```bash
npx vercel deploy
```

Smoke-test:
- `curl -i https://<preview>/api/v1/trust/0x0000000000000000000000000000000000000000` → expect 402 with two `WWW-Authenticate` lines and `accepts` array of length 2 in body.
- `curl -i https://<preview>/api/v1/trust/0x0000000000000000000000000000000000000000/exists` → expect 200 with `paymentMethods[0].scheme === "x402"` and `paymentMethods[1].scheme === "mpp"`.

- [ ] **Step 4: Production deploy**

Only after user tasks below are complete (wallet created, env vars set).

```bash
npx vercel deploy --prod
```

---

## User Task Checklist (outside the codebase)

These steps can only be done by the human operator; each one must be completed before MPP payments will actually work in production. x402 continues to work throughout.

- [ ] **1. Generate a Tempo wallet.** Create a fresh EVM-compatible wallet (any standard tool: `cast wallet new`, MetaMask, Rabby). Store the private key in a password manager. Record the public address — this is `MPP_PAY_TO_ADDRESS`.

- [ ] **2. Fund the wallet with a small pathUSD balance.** Tempo has no native gas token — transfers are gas-free for the sender of pathUSD, so no funding is strictly required for *receiving*. But acquire ~$1 of pathUSD for any future outbound operational use (refunds, sweeps). Source pathUSD via the Tempo bridge or a supported exchange (consult `mpp.dev` docs).

- [ ] **3. Set env vars on Vercel prod.**

  ```bash
  printf '0x<your-tempo-wallet-address-lowercase>' | npx vercel env add MPP_PAY_TO_ADDRESS production
  # TEMPO_RPC_URL is already set per memory (2026-04-17) — confirm:
  npx vercel env ls | grep TEMPO_RPC_URL
  ```

- [ ] **4. Set env vars on Trigger.dev prod.** Not strictly required for payment verification (gate runs on Vercel), but useful for parity if any background task ever inspects `MPP_PAY_TO_ADDRESS`. Add via Trigger.dev dashboard → Settings → Environment Variables → Production:
  - `MPP_PAY_TO_ADDRESS=<address>` (lowercase)

- [ ] **5. Update `docs/mpp-service-entry.json` with the real recipient.** Replace the `"<MPP_PAY_TO_ADDRESS — fill in…>"` placeholder with the actual address, commit, push.

- [ ] **6. Register TrustAdd on mpp.dev.** Submit `docs/mpp-service-entry.json` to the MPP directory. Check `mpp.dev/services` for the submission form or equivalent GitHub PR flow (AgentMail did this — check their entry for format/path). Confirm TrustAdd appears in `https://mpp.dev/api/services` within 24h.

- [ ] **7. End-to-end test with a real MPP payment.**
  1. `curl -i https://trustadd.com/api/v1/trust/<some-known-agent>` → capture the 402 challenge.
  2. Extract `recipient`, `amount`, `asset` from the base64url-decoded `request=` field of the `WWW-Authenticate: Payment method="tempo" …` header.
  3. Send a pathUSD transfer on Tempo from any funded wallet: `to=<recipient>`, `amount=10000` (base units = $0.01), `asset=pathUSD`.
  4. Once confirmed (Tempo is BFT-final, 1 block), retry the curl with `-H "Authorization: MPP 0x<txHash>"`. Expect `200` and a valid Quick Check JSON.
  5. Replay the same request within 1h → expect `402` again (replay cache working).

- [ ] **8. Update MEMORY** — after successful e2e, note in `memory/project_mpp_launch.md` that dual-payment is live in prod, with the recipient address.

---

## Notes / Risks

- **Single-process replay cache.** Vercel serverless spins multiple instances; a tx hash replayed against a different cold container will not be caught by the cache but *will* fail at verification time if used against a fresh price request — because an honest client sending a single-use payment will only re-send to a different container if the first response was lost, which is acceptable duplicate billing protection at this price point. If stricter cross-instance replay protection is required later, swap `ReplayCache` for a Supabase-backed store (simple `payment_receipts` table with `(tx_hash, log_index)` primary key).
- **x402 adapter fake-response approach.** We invoke the upstream middleware with a no-op `Response` to detect whether it would verify. If `@x402/express` ever starts writing headers synchronously we care about, revisit by directly calling the facilitator client. For now, `paymentMiddleware` is side-effect-free on the `Response` until it either passes control to `next()` or emits 402 — both of which we intercept.
- **Header spec drift.** The IETF draft for `WWW-Authenticate: Payment` is still evolving. Our format mirrors what `server/mpp-prober.ts` parses; if `mpp.dev` updates canonical conventions, update both sides together.
- **Exists endpoint remains free.** No regression — `matchRoute()` doesn't match `/exists`.
