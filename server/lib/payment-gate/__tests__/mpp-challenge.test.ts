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
