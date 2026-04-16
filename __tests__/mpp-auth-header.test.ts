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
