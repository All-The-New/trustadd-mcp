import { describe, it, expect } from "vitest";
import {
  detectControllerCluster,
  detectFingerprintDuplicate,
} from "../server/sybil-detection.js";

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
