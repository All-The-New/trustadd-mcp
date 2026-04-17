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
