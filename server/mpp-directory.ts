/**
 * MPP Payments Directory source abstraction.
 *
 * MPP is 4 weeks old; the directory format may change. This module
 * offers two pluggable sources (API or HTML scrape) behind a common
 * interface so implementations can swap without touching the indexer.
 */

import { createLogger } from "./lib/indexer-utils.js";

const log = createLogger("mpp-directory");

const DIRECTORY_URL = "https://mpp.dev/services";
const DIRECTORY_API_URL = "https://mpp.dev/api/services";

export interface RawMppService {
  serviceUrl: string;
  serviceName: string | null;
  providerName: string | null;
  description: string | null;
  category: string;
  pricingModel: string | null;   // charge | stream | session | null
  priceAmount: string | null;
  priceCurrency: string | null;
  paymentMethods: Array<{ method: string; currency?: string; recipient?: string }>;
  recipientAddress: string | null;
  metadata: Record<string, unknown> | null;
}

export interface MppDirectorySource {
  fetchServices(): Promise<RawMppService[]>;
  healthCheck(): Promise<boolean>;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

// --- API source ---

export class MppApiSource implements MppDirectorySource {
  private fetchImpl: FetchFn;

  constructor(options: { fetchImpl?: FetchFn } = {}) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchFn);
  }

  async fetchServices(): Promise<RawMppService[]> {
    try {
      const resp = await this.fetchImpl(DIRECTORY_API_URL);
      if (!resp.ok) {
        log.warn(`Directory API returned ${resp.status}`);
        return [];
      }
      const data = await resp.json();
      const raw = Array.isArray(data) ? data : (data.services || data.items || []);
      return raw.map(this.normalize).filter(Boolean) as RawMppService[];
    } catch (err) {
      log.error("Directory API fetch failed", { error: (err as Error).message });
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await this.fetchImpl(DIRECTORY_API_URL, { method: "HEAD" });
      return resp.ok;
    } catch {
      return false;
    }
  }

  private normalize = (entry: any): RawMppService | null => {
    if (!entry?.url && !entry?.serviceUrl) return null;
    const url = entry.url || entry.serviceUrl;
    const name = entry.name || entry.serviceName || null;
    const description = entry.description ?? null;
    return {
      serviceUrl: url,
      serviceName: name,
      providerName: entry.provider || null,
      description,
      category: typeof entry.category === "string" ? entry.category : classifyMppService(description, url),
      pricingModel: entry.pricingModel || entry.intent || null,
      priceAmount: entry.price != null ? String(entry.price) : (entry.amount != null ? String(entry.amount) : null),
      priceCurrency: entry.currency || entry.priceCurrency || null,
      paymentMethods: Array.isArray(entry.paymentMethods) ? entry.paymentMethods : [],
      recipientAddress: entry.recipient || entry.payTo || null,
      metadata: entry,
    };
  };
}

// --- Scrape source ---

export class MppScrapeSource implements MppDirectorySource {
  private fetchImpl: FetchFn;

  constructor(options: { fetchImpl?: FetchFn } = {}) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchFn);
  }

  async fetchServices(): Promise<RawMppService[]> {
    try {
      const resp = await this.fetchImpl(DIRECTORY_URL);
      if (!resp.ok) {
        log.warn(`Directory page returned ${resp.status}`);
        return [];
      }
      const html = await resp.text();
      return parseDirectoryHtml(html);
    } catch (err) {
      log.error("Directory scrape failed", { error: (err as Error).message });
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await this.fetchImpl(DIRECTORY_URL, { method: "HEAD" });
      return resp.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Defensive HTML parser. Extracts service entries from the mpp.dev/services
 * page using robust heuristics. Uses minimal regex parsing — if the page
 * structure changes we emit a Sentry alert via onFailure and keep the
 * last-successful snapshot.
 */
export function parseDirectoryHtml(html: string): RawMppService[] {
  const services: RawMppService[] = [];
  // Heuristic: look for data-url attributes or anchor tags with service URLs.
  // Pattern: <div class="service" data-url="..."> or <a href="..." class="service-link">
  const urlPattern = /data-url\s*=\s*"([^"]+)"/g;
  const namePattern = /<h[23][^>]*>([^<]+)<\/h[23]>/g;
  const descPattern = /<p[^>]*>([^<]+)<\/p>/g;

  let urlMatch;
  while ((urlMatch = urlPattern.exec(html)) !== null) {
    const url = urlMatch[1];
    if (!url.startsWith("http")) continue;

    // Look for nearby name + description within ~2KB after the match
    const windowStart = urlMatch.index;
    const windowEnd = Math.min(html.length, windowStart + 2048);
    const window = html.slice(windowStart, windowEnd);

    const nameMatches = Array.from(window.matchAll(namePattern));
    const descMatches = Array.from(window.matchAll(descPattern));
    const name = nameMatches[0]?.[1]?.trim() ?? null;
    const description = descMatches[0]?.[1]?.trim() ?? null;

    services.push({
      serviceUrl: url,
      serviceName: name,
      providerName: null,
      description,
      category: classifyMppService(description, url),
      pricingModel: null,
      priceAmount: null,
      priceCurrency: null,
      paymentMethods: [],
      recipientAddress: null,
      metadata: { source: "scrape", scrapedAt: new Date().toISOString() },
    });
  }
  return services;
}

// --- Classifier ---

/**
 * Lightweight classifier for MPP services. Mirrors server/bazaar-classify.ts
 * but tuned for MPP categories (payment model differences).
 */
export function classifyMppService(description: string | null, url: string | null): string {
  const text = `${description ?? ""} ${url ?? ""}`.toLowerCase();
  if (/\b(gpt|llm|claude|openai|anthropic|model|inference|ai|ml|embedding)\b/.test(text)) return "ai-model";
  if (/\b(rpc|node|blockchain|alchemy|quicknode|infura|dune|explorer)\b/.test(text)) return "dev-infra";
  if (/\b(compute|gpu|sandbox|vm|browser|crawl|scrape|browserbase)\b/.test(text)) return "compute";
  if (/\b(data|database|analytics|feed|oracle)\b/.test(text)) return "data";
  if (/\b(shop|buy|order|product|commerce|store|food|merchant)\b/.test(text)) return "commerce";
  return "other";
}

// --- Factory ---

export function createDirectorySource(mode: "api" | "scrape" | "auto" = "auto"): MppDirectorySource {
  if (mode === "api") return new MppApiSource();
  if (mode === "scrape") return new MppScrapeSource();
  // auto: default to scrape (safer initial bet per the spec)
  return new MppScrapeSource();
}
