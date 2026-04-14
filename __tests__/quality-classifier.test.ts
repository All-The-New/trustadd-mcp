/**
 * Quality Classifier Tests
 *
 * Covers classifyAgent() output shapes and the data preparation path that feeds
 * the batch DB update in trigger/recalculate.ts.
 *
 * Regression: the batch update uses json_to_recordset instead of unnest() because
 * unnest(${nullableArray}::text[]) fails when ALL elements are null. pg cannot infer
 * the element type from a homogeneous null array and emits
 * "cannot cast type record to text[]". The tests below lock in the null-producing
 * code paths so that any regression would surface here before hitting the DB.
 */
import { describe, it, expect } from "vitest";
import { classifyAgent, computeFingerprint } from "../server/quality-classifier.js";

const BASE_AGENT = {
  name: "Test Agent",
  description: "A well-described agent with enough text to qualify for points.",
  metadataUri: "https://example.com/agent.json",
  trustScore: 50,
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
};

// ── computeFingerprint ────────────────────────────────────────────────────────

describe("computeFingerprint", () => {
  it("returns null for null metadataUri", () => {
    expect(computeFingerprint(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(computeFingerprint("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(computeFingerprint("   ")).toBeNull();
  });

  it("returns a 16-char hex string for a valid URI", () => {
    const fp = computeFingerprint("https://example.com/agent.json");
    expect(fp).not.toBeNull();
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic — same URI always produces same fingerprint", () => {
    const uri = "https://example.com/agent.json";
    expect(computeFingerprint(uri)).toBe(computeFingerprint(uri));
  });

  it("produces different fingerprints for different URIs", () => {
    const a = computeFingerprint("https://example.com/a.json");
    const b = computeFingerprint("https://example.com/b.json");
    expect(a).not.toBe(b);
  });
});

// ── classifyAgent — metadataFingerprint null paths ────────────────────────────

describe("classifyAgent — metadataFingerprint null paths", () => {
  it("produces null metadataFingerprint when metadataUri is null", () => {
    const result = classifyAgent({ ...BASE_AGENT, metadataUri: null });
    // REGRESSION: this null propagates to the classification batch update.
    // A batch where all agents have null metadataUri would produce an all-null
    // fingerprints array. The old unnest(${array}::text[]) pattern failed in this
    // case; json_to_recordset handles it correctly.
    expect(result.metadataFingerprint).toBeNull();
  });

  it("produces null metadataFingerprint when metadataUri is empty string", () => {
    const result = classifyAgent({ ...BASE_AGENT, metadataUri: "" });
    expect(result.metadataFingerprint).toBeNull();
  });

  it("always produces a non-null nextEnrichmentAt Date", () => {
    const result = classifyAgent({ ...BASE_AGENT, metadataUri: null });
    expect(result.nextEnrichmentAt).toBeInstanceOf(Date);
    expect(result.nextEnrichmentAt.getTime()).toBeGreaterThan(Date.now());
  });
});

// ── Batch update payload serialization ───────────────────────────────────────

describe("batch update JSON payload — null field handling", () => {
  it("serialises a batch of all-null fingerprints to valid JSON", () => {
    // Simulate a batch of spam agents that all have null metadataUri → null fingerprint.
    // This replicates the exact data shape built in trigger/recalculate.ts before the
    // json_to_recordset DB call. If this round-trips cleanly, the SQL layer gets valid input.
    const agents = [
      { ...BASE_AGENT, metadataUri: null, name: null },
      { ...BASE_AGENT, metadataUri: "",   name: null },
      { ...BASE_AGENT, metadataUri: "   ", name: null },
    ];

    const results = agents.map((a, i) => ({
      id: `0xagent${i}`,
      ...classifyAgent(a),
    }));

    // Every fingerprint must be null (the all-null array edge case)
    results.forEach(r => expect(r.metadataFingerprint).toBeNull());

    // Replicate the json_to_recordset payload built in trigger/recalculate.ts
    const rowData = JSON.stringify(results.map(r => ({
      id: r.id,
      fp: r.metadataFingerprint ?? null,
      enrich: r.nextEnrichmentAt?.toISOString() ?? null,
    })));

    const parsed: Array<{ id: string; fp: string | null; enrich: string | null }> =
      JSON.parse(rowData);

    expect(parsed).toHaveLength(3);
    // All fingerprints null — the exact condition that broke unnest()
    parsed.forEach(row => {
      expect(row.fp).toBeNull();
      // enrich is never null because nextEnrichmentAt is always a Date
      expect(typeof row.enrich).toBe("string");
      expect(new Date(row.enrich!).getTime()).toBeGreaterThan(0);
    });
  });

  it("serialises a mixed batch (some null, some non-null fingerprints)", () => {
    const agents = [
      { ...BASE_AGENT, metadataUri: null },
      { ...BASE_AGENT, metadataUri: "https://example.com/agent.json" },
    ];

    const results = agents.map((a, i) => ({
      id: `0xagent${i}`,
      ...classifyAgent(a),
    }));

    const rowData = JSON.stringify(results.map(r => ({
      id: r.id,
      fp: r.metadataFingerprint ?? null,
      enrich: r.nextEnrichmentAt?.toISOString() ?? null,
    })));

    const parsed: Array<{ fp: string | null }> = JSON.parse(rowData);
    expect(parsed[0].fp).toBeNull();
    expect(parsed[1].fp).not.toBeNull();
    expect(typeof parsed[1].fp).toBe("string");
  });
});
