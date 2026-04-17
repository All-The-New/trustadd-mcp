import { describe, it, expect, vi } from "vitest";
import express from "express";
import { composePaymentGate } from "../index.js";
import type { PaymentAdapter } from "../types.js";

function mockAdapter(id: string, verifies: boolean, challenge = `Scheme realm="${id}"`): PaymentAdapter {
  return {
    id,
    label: id,
    challenge: () => ({ wwwAuthenticate: challenge, body: { id } }),
    tryVerify: vi.fn().mockResolvedValue(verifies ? { verified: true } : { verified: false }),
  };
}

async function request(app: express.Express, path: string) {
  return new Promise<{ status: number; headers: Record<string, string[]>; body: any }>((resolve) => {
    const req: any = { method: "GET", path, url: path, headers: {}, header: () => undefined };
    const chunks: Buffer[] = [];
    const headers: Record<string, string[]> = {};
    let status = 200;
    const res: any = {
      status(c: number) { status = c; return this; },
      setHeader(k: string, v: string | string[]) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v : [v];
      },
      getHeader(k: string) { return headers[k.toLowerCase()]; },
      appendHeader(k: string, v: string) {
        const key = k.toLowerCase();
        headers[key] = headers[key] ? [...headers[key], v] : [v];
      },
      set(k: string, v: string) { this.setHeader(k, v); return this; },
      write(c: Buffer) { chunks.push(c); },
      end(c?: any) {
        if (c) chunks.push(Buffer.from(c));
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf-8")) : null;
        resolve({ status, headers, body });
      },
      json(b: any) { this.end(JSON.stringify(b)); return this; },
    };
    app(req, res);
  });
}

describe("composePaymentGate", () => {
  it("passes through when a route is not priced", async () => {
    const gate = composePaymentGate([mockAdapter("x402", false)]);
    const app = express();
    app.use(gate);
    app.get("/free", (_req, res) => res.json({ ok: true }));
    const r = await request(app, "/free");
    expect(r.status).toBe(200);
  });

  it("returns 402 with all adapter challenges when no payment present", async () => {
    const gate = composePaymentGate([
      mockAdapter("x402", false, 'x402 scheme="exact"'),
      mockAdapter("mpp", false, 'Payment method="tempo"'),
    ]);
    const app = express();
    app.use(gate);
    app.get("/api/v1/trust/:address", (_req, res) => res.json({ ok: true }));
    const r = await request(app, "/api/v1/trust/0xabc");
    expect(r.status).toBe(402);
    expect(r.headers["www-authenticate"]).toEqual([
      'x402 scheme="exact"',
      'Payment method="tempo"',
    ]);
    expect(r.body.accepts).toHaveLength(2);
  });

  it("lets through when any adapter verifies", async () => {
    const gate = composePaymentGate([
      mockAdapter("x402", false),
      mockAdapter("mpp", true),
    ]);
    const app = express();
    app.use(gate);
    app.get("/api/v1/trust/:address", (_req, res) => res.json({ ok: true }));
    const r = await request(app, "/api/v1/trust/0xabc");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});
