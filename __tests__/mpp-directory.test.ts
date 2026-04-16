import { describe, it, expect } from "vitest";
import { MppScrapeSource, MppApiSource, classifyMppService } from "../server/mpp-directory.js";

describe("MppScrapeSource", () => {
  it("parses HTML service listing into RawMppService records", async () => {
    const html = `<html><body>
      <div class="service" data-url="https://browserbase.com/api/v1/sessions">
        <h3>Browserbase</h3>
        <p>Headless browsers, pay per session</p>
        <span class="price">$0.02 pathUSD</span>
      </div>
      <div class="service" data-url="https://example.com/api">
        <h3>Example API</h3>
        <p>Data service</p>
      </div>
    </body></html>`;
    const src = new MppScrapeSource({ fetchImpl: async () => new Response(html) });
    const services = await src.fetchServices();
    expect(services.length).toBeGreaterThanOrEqual(1);
    expect(services[0].serviceUrl).toContain("browserbase.com");
  });

  it("returns empty array when directory is unreachable", async () => {
    const src = new MppScrapeSource({ fetchImpl: async () => { throw new Error("Network down"); } });
    await expect(src.fetchServices()).resolves.toEqual([]);
  });
});

describe("MppApiSource", () => {
  it("parses JSON response into RawMppService records", async () => {
    const body = JSON.stringify({
      services: [
        { url: "https://fal.ai/api", name: "fal.ai", category: "ai-model", price: "0.01" },
      ],
    });
    const src = new MppApiSource({ fetchImpl: async () => new Response(body, { status: 200 }) });
    const services = await src.fetchServices();
    expect(services).toHaveLength(1);
    expect(services[0].serviceName).toBe("fal.ai");
  });
});

describe("classifyMppService", () => {
  it("classifies an AI model service", () => {
    expect(classifyMppService("GPT-4 inference API", "https://openai.com/v1/chat")).toBe("ai-model");
  });

  it("classifies a dev-infra service", () => {
    expect(classifyMppService("Blockchain RPC provider", "https://quicknode.com/rpc")).toBe("dev-infra");
  });

  it("defaults to 'other' for unknown service", () => {
    expect(classifyMppService("Random service", "https://example.com")).toBe("other");
  });
});
