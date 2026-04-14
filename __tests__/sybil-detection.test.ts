import { describe, it, expect } from "vitest";
import {
  detectControllerCluster,
  detectFingerprintDuplicate,
  detectSelfReferentialPayment,
  detectTemporalBurst,
  computeSybilRiskScore,
  computeDampeningMultiplier,
  analyzeSybilSignals,
} from "../server/sybil-detection.js";
import type { SybilSignal, SybilLookups } from "../server/sybil-detection.js";
import { computeVerdict } from "../server/trust-report-compiler.js";
import { SYBIL_FARM_AGENT, SOLO_CONTROLLER_AGENT } from "./fixtures/agents.js";

describe("detectControllerCluster", () => {
  it("returns no signal for controller with <= 10 agents", () => {
    const signal = detectControllerCluster(10);
    expect(signal).toBeNull();
  });

  it("returns low severity for controller with 11-50 agents", () => {
    const signal = detectControllerCluster(25);
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe("controller_cluster");
    expect(signal!.severity).toBe("low");
    expect(signal!.value).toBe(25);
  });

  it("returns medium severity for controller with 51-500 agents", () => {
    const signal = detectControllerCluster(200);
    expect(signal).not.toBeNull();
    expect(signal!.severity).toBe("medium");
  });

  it("returns high severity for controller with >500 agents", () => {
    const signal = detectControllerCluster(6322);
    expect(signal).not.toBeNull();
    expect(signal!.severity).toBe("high");
    expect(signal!.value).toBe(6322);
  });
});

describe("detectFingerprintDuplicate", () => {
  it("returns null when fingerprint is null", () => {
    const signal = detectFingerprintDuplicate(null, new Map());
    expect(signal).toBeNull();
  });

  it("returns null when fingerprint is unique to one controller", () => {
    const map = new Map([["fp_abc", new Set(["0xcontroller1"])]]);
    const signal = detectFingerprintDuplicate("fp_abc", map);
    expect(signal).toBeNull();
  });

  it("returns low severity when 2-5 controllers share a fingerprint", () => {
    const map = new Map([["fp_abc", new Set(["0xc1", "0xc2", "0xc3"])]]);
    const signal = detectFingerprintDuplicate("fp_abc", map);
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe("fingerprint_duplicate");
    expect(signal!.severity).toBe("low");
    expect(signal!.value).toBe(3);
  });

  it("returns medium severity when 6-20 controllers share a fingerprint", () => {
    const controllers = new Set(Array.from({ length: 15 }, (_, i) => `0xc${i}`));
    const map = new Map([["fp_dup", controllers]]);
    const signal = detectFingerprintDuplicate("fp_dup", map);
    expect(signal!.severity).toBe("medium");
  });

  it("returns high severity when >20 controllers share a fingerprint", () => {
    const controllers = new Set(Array.from({ length: 50 }, (_, i) => `0xc${i}`));
    const map = new Map([["fp_mass", controllers]]);
    const signal = detectFingerprintDuplicate("fp_mass", map);
    expect(signal!.severity).toBe("high");
    expect(signal!.value).toBe(50);
  });

  it("returns null for fingerprint not in the map", () => {
    const map = new Map([["fp_other", new Set(["0xc1", "0xc2"])]]);
    const signal = detectFingerprintDuplicate("fp_missing", map);
    expect(signal).toBeNull();
  });
});

describe("detectSelfReferentialPayment", () => {
  it("returns null when agent has no transaction patterns", () => {
    const signal = detectSelfReferentialPayment("agent-1", new Map());
    expect(signal).toBeNull();
  });

  it("returns null when no self-referential transactions exist", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 0, totalCount: 10, recentRatio: 0.1 }]]);
    const signal = detectSelfReferentialPayment("agent-1", patterns);
    expect(signal).toBeNull();
  });

  it("returns medium severity when self-referential ratio is 10-50%", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 3, totalCount: 10, recentRatio: 0.1 }]]);
    const signal = detectSelfReferentialPayment("agent-1", patterns);
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe("self_referential_payment");
    expect(signal!.severity).toBe("medium");
  });

  it("returns high severity when self-referential ratio exceeds 50%", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 8, totalCount: 10, recentRatio: 0.1 }]]);
    const signal = detectSelfReferentialPayment("agent-1", patterns);
    expect(signal!.severity).toBe("high");
  });
});

describe("detectTemporalBurst", () => {
  it("returns null when agent has no transaction patterns", () => {
    const signal = detectTemporalBurst("agent-1", new Map());
    expect(signal).toBeNull();
  });

  it("returns null when recent ratio is below 50%", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 0, totalCount: 20, recentRatio: 0.3 }]]);
    const signal = detectTemporalBurst("agent-1", patterns);
    expect(signal).toBeNull();
  });

  it("returns medium severity when recent ratio is 50-80%", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 0, totalCount: 20, recentRatio: 0.6 }]]);
    const signal = detectTemporalBurst("agent-1", patterns);
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe("temporal_burst");
    expect(signal!.severity).toBe("medium");
  });

  it("returns high severity when recent ratio exceeds 80%", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 0, totalCount: 20, recentRatio: 0.9 }]]);
    const signal = detectTemporalBurst("agent-1", patterns);
    expect(signal!.severity).toBe("high");
  });

  it("returns null when total tx count is < 5 (insufficient data)", () => {
    const patterns = new Map([["agent-1", { selfRefCount: 0, totalCount: 3, recentRatio: 1.0 }]]);
    const signal = detectTemporalBurst("agent-1", patterns);
    expect(signal).toBeNull();
  });
});

describe("computeSybilRiskScore", () => {
  it("returns 0 for no signals", () => {
    expect(computeSybilRiskScore([])).toBe(0);
  });

  it("returns low risk for single low-severity signal", () => {
    const signals: SybilSignal[] = [
      { type: "controller_cluster", severity: "low", detail: "15 agents", value: 15 },
    ];
    const score = computeSybilRiskScore(signals);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(0.3);
  });

  it("returns high risk for multiple high-severity signals", () => {
    const signals: SybilSignal[] = [
      { type: "controller_cluster", severity: "high", detail: "6000 agents", value: 6000 },
      { type: "fingerprint_duplicate", severity: "high", detail: "50 controllers", value: 50 },
    ];
    const score = computeSybilRiskScore(signals);
    expect(score).toBeGreaterThanOrEqual(0.7);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("clamps to 1.0 maximum", () => {
    const signals: SybilSignal[] = [
      { type: "controller_cluster", severity: "high", detail: "", value: 6000 },
      { type: "fingerprint_duplicate", severity: "high", detail: "", value: 50 },
      { type: "self_referential_payment", severity: "high", detail: "", value: 10 },
      { type: "temporal_burst", severity: "high", detail: "", value: 95 },
    ];
    const score = computeSybilRiskScore(signals);
    expect(score).toBe(1.0);
  });
});

describe("analyzeSybilSignals", () => {
  const emptyLookups: SybilLookups = {
    controllerAgentCounts: new Map(),
    fingerprintControllers: new Map(),
    transactionPatterns: new Map(),
  };

  it("returns clean analysis for solo controller agent", () => {
    const lookups: SybilLookups = {
      controllerAgentCounts: new Map([["0xsolo", 1]]),
      fingerprintControllers: new Map(),
      transactionPatterns: new Map(),
    };
    const result = analyzeSybilSignals("agent-1", "0xsolo", null, lookups);
    expect(result.signals).toHaveLength(0);
    expect(result.riskScore).toBe(0);
    expect(result.dampeningMultiplier).toBe(1.0);
  });

  it("detects controller cluster signal", () => {
    const lookups: SybilLookups = {
      controllerAgentCounts: new Map([["0xfarm", 500]]),
      fingerprintControllers: new Map(),
      transactionPatterns: new Map(),
    };
    const result = analyzeSybilSignals("agent-1", "0xfarm", null, lookups);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].type).toBe("controller_cluster");
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.dampeningMultiplier).toBeLessThan(1.0);
  });

  it("combines multiple signals and increases risk", () => {
    const lookups: SybilLookups = {
      controllerAgentCounts: new Map([["0xfarm", 6000]]),
      fingerprintControllers: new Map([["fp_dup", new Set(["0xfarm", "0xother1", "0xother2"])]]),
      transactionPatterns: new Map([["agent-1", { selfRefCount: 5, totalCount: 10, recentRatio: 0.9 }]]),
    };
    const result = analyzeSybilSignals("agent-1", "0xfarm", "fp_dup", lookups);
    expect(result.signals.length).toBeGreaterThanOrEqual(3);
    expect(result.riskScore).toBeGreaterThanOrEqual(0.7);
    expect(result.dampeningMultiplier).toBeLessThanOrEqual(0.65);
  });

  it("handles missing controller address in lookups", () => {
    const result = analyzeSybilSignals("agent-1", "0xunknown", null, emptyLookups);
    expect(result.signals).toHaveLength(0);
    expect(result.riskScore).toBe(0);
    expect(result.dampeningMultiplier).toBe(1.0);
  });
});

describe("computeDampeningMultiplier", () => {
  it("returns 1.0 for risk score 0 (no dampening)", () => {
    expect(computeDampeningMultiplier(0)).toBe(1.0);
  });

  it("returns 0.5 for risk score 1.0 (maximum dampening)", () => {
    expect(computeDampeningMultiplier(1.0)).toBe(0.5);
  });

  it("returns value between 0.5 and 1.0 for intermediate risk", () => {
    const mult = computeDampeningMultiplier(0.5);
    expect(mult).toBeGreaterThanOrEqual(0.5);
    expect(mult).toBeLessThanOrEqual(1.0);
    expect(mult).toBe(0.75);
  });

  it("clamps risk score below 0 to no dampening", () => {
    expect(computeDampeningMultiplier(-0.5)).toBe(1.0);
  });
});

describe("sybil dampening integration", () => {
  it("dampened score can change verdict from CAUTION to UNTRUSTED", () => {
    // Agent with raw score 45 → CAUTION normally
    const rawVerdict = computeVerdict(45, "low", [], "active");
    expect(rawVerdict).toBe("CAUTION");

    // After 50% dampening (high sybil risk) → score 23 → UNTRUSTED
    const dampenedScore = Math.round(45 * 0.5);
    const dampenedVerdict = computeVerdict(dampenedScore, "low", [], "active");
    expect(dampenedVerdict).toBe("UNTRUSTED");
  });

  it("solo controller agent is not dampened", () => {
    const lookups: SybilLookups = {
      controllerAgentCounts: new Map([["0xsolocontroller00000000000000000000000001", 1]]),
      fingerprintControllers: new Map(),
      transactionPatterns: new Map(),
    };
    const result = analyzeSybilSignals(
      SOLO_CONTROLLER_AGENT.id,
      SOLO_CONTROLLER_AGENT.controllerAddress,
      SOLO_CONTROLLER_AGENT.metadataFingerprint,
      lookups,
    );
    expect(result.dampeningMultiplier).toBe(1.0);
  });

  it("high-severity farm agent gets significant dampening", () => {
    const lookups: SybilLookups = {
      controllerAgentCounts: new Map([["0xsybilcontroller000000000000000000000000001", 6000]]),
      fingerprintControllers: new Map([
        ["fp_duplicate_cluster_1", new Set(["0xsybilcontroller000000000000000000000000001", "0xother1", "0xother2"])],
      ]),
      transactionPatterns: new Map(),
    };
    const result = analyzeSybilSignals(
      SYBIL_FARM_AGENT.id,
      SYBIL_FARM_AGENT.controllerAddress,
      SYBIL_FARM_AGENT.metadataFingerprint,
      lookups,
    );
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
    expect(result.dampeningMultiplier).toBeLessThanOrEqual(0.7);
  });
});
