import { describe, it, expect, vi, beforeEach } from "vitest";

// These tests run the MPP storage functions against a mocked `db` object,
// asserting the correct SQL shapes and argument bindings. They are smoke-level
// integration tests — full DB round-trip tests require a fixture DB which is
// out of scope for this phase.

describe("MPP storage query shapes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getMppAdoptionStats emits a 3-value result from mpp/x402 CTEs", async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      rows: [{ mpp: 5, x402: 12, both: 3 }],
    });
    vi.doMock("../server/db.js", () => ({ db: { execute: mockExecute }, pool: {} }));
    const { getMppAdoptionStats } = await import("../server/storage/mpp.js");
    const stats = await getMppAdoptionStats();
    expect(stats).toEqual({ mpp: 5, x402: 12, both: 3 });
    expect(mockExecute).toHaveBeenCalled();
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
