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
