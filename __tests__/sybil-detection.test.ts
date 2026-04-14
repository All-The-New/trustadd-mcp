import { describe, it, expect } from "vitest";
import { detectControllerCluster } from "../server/sybil-detection.js";

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
