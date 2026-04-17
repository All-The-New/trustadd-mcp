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
