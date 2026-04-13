import { schedules, logger, metadata } from "@trigger.dev/sdk/v3";

const CDP_BASE_URL = "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";
const SCOUT_CATALOG_URL = "https://x402scout.com/catalog";
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 500;

interface CdpResource {
  resource: string;
  type: string;
  x402Version: number;
  lastUpdated: string;
  accepts: Array<{
    resource: string;
    payTo: string;
    asset: string;
    network: string;
    maxAmountRequired: string;
    maxTimeoutSeconds: number;
    scheme: string;
    description: string;
    mimeType: string;
    extra?: { name?: string; version?: string };
    outputSchema?: {
      input?: { method?: string; discoverable?: boolean };
      output?: Record<string, unknown>;
    };
  }>;
}

interface CdpResponse {
  items: CdpResource[];
  pagination: { limit: number; offset: number; total: number };
  x402Version: number;
}

interface ScoutService {
  id?: string;
  name?: string;
  description?: string;
  url?: string;
  category?: string;
  price_usd?: number;
  network?: string;
  health_status?: string;
  uptime_pct?: number;
  avg_latency_ms?: number;
  trust_score?: number;
  last_health_check?: string;
  [key: string]: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const bazaarIndexerTask = schedules.task({
  id: "bazaar-indexer",
  cron: "0 */6 * * *",
  maxDuration: 600,
  run: async (_payload) => {
    metadata.set("status", "starting");
    metadata.set("startedAt", new Date().toISOString());

    const { storage } = await import("../server/storage.js");
    const { classifyService, extractServiceName, rawAmountToUsd } = await import("../server/bazaar-classify.js");

    // Step 1: Fetch all Base mainnet resources from CDP Bazaar
    metadata.set("status", "fetching-cdp");
    logger.info("Starting CDP Bazaar fetch (Base mainnet only)");

    const allResources: CdpResource[] = [];
    let offset = 0;
    let total = 0;
    let pageCount = 0;

    try {
      // First request to get total count
      const firstUrl = `${CDP_BASE_URL}?limit=${PAGE_SIZE}&offset=0`;
      const firstResp = await fetch(firstUrl);
      if (!firstResp.ok) {
        throw new Error(`CDP API returned ${firstResp.status}: ${firstResp.statusText}`);
      }
      const firstData: CdpResponse = await firstResp.json();
      total = firstData.pagination.total;

      // Filter for Base mainnet only
      const baseItems = firstData.items.filter((item) =>
        item.accepts.some((a) => a.network === "base")
      );
      allResources.push(...baseItems);
      pageCount++;
      offset += PAGE_SIZE;

      metadata.set("cdpTotal", total);
      metadata.set("cdpPagesFetched", pageCount);
      metadata.set("cdpBaseItemsSoFar", allResources.length);

      logger.info(`CDP total resources: ${total}. First page: ${firstData.items.length} items, ${baseItems.length} Base mainnet`);

      // Paginate through remaining resources
      while (offset < total) {
        await sleep(REQUEST_DELAY_MS);
        const url = `${CDP_BASE_URL}?limit=${PAGE_SIZE}&offset=${offset}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          logger.warn(`CDP API error at offset ${offset}: ${resp.status}`);
          offset += PAGE_SIZE;
          continue;
        }
        const data: CdpResponse = await resp.json();
        const items = data.items.filter((item) =>
          item.accepts.some((a) => a.network === "base")
        );
        allResources.push(...items);
        pageCount++;
        offset += PAGE_SIZE;

        if (pageCount % 10 === 0) {
          metadata.set("cdpPagesFetched", pageCount);
          metadata.set("cdpBaseItemsSoFar", allResources.length);
          logger.info(`CDP fetch progress: ${pageCount} pages, ${allResources.length} Base items, offset ${offset}/${total}`);
        }
      }
    } catch (err) {
      logger.error("CDP Bazaar fetch failed", { error: (err as Error).message });
      metadata.set("cdpError", (err as Error).message);
    }

    metadata.set("cdpTotalBaseItems", allResources.length);
    logger.info(`CDP fetch complete: ${allResources.length} Base mainnet resources from ${pageCount} pages`);

    // Step 2: Fetch x402Scout catalog for health/quality enrichment
    metadata.set("status", "fetching-scout");
    let scoutServices: ScoutService[] = [];

    try {
      const scoutResp = await fetch(`${SCOUT_CATALOG_URL}?limit=500`);
      if (scoutResp.ok) {
        const scoutData = await scoutResp.json();
        scoutServices = Array.isArray(scoutData) ? scoutData : (scoutData.items || scoutData.services || []);
        logger.info(`x402Scout catalog: ${scoutServices.length} services`);
      } else {
        logger.warn(`x402Scout returned ${scoutResp.status}`);
      }
    } catch (err) {
      logger.warn("x402Scout fetch failed", { error: (err as Error).message });
    }

    metadata.set("scoutServicesCount", scoutServices.length);

    // Build scout lookup map by URL
    const scoutByUrl = new Map<string, ScoutService>();
    for (const s of scoutServices) {
      if (s.url) scoutByUrl.set(s.url, s);
    }

    // Step 3: Transform CDP resources into bazaar_services records
    metadata.set("status", "upserting");
    const runStartedAt = new Date(); // Used to mark stale services inactive
    const batch: any[] = [];

    for (const resource of allResources) {
      // Use the first Base mainnet accept entry
      const accept = resource.accepts.find((a) => a.network === "base");
      if (!accept) continue;

      const resourceUrl = accept.resource || resource.resource;

      const description = accept.description || null;
      const assetName = accept.extra?.name || null;
      const category = classifyService(description, resourceUrl);
      const name = extractServiceName(description, resourceUrl);
      const priceUsd = rawAmountToUsd(accept.maxAmountRequired, assetName);
      const method = accept.outputSchema?.input?.method || null;

      // Check for scout enrichment
      const scout = scoutByUrl.get(resourceUrl);

      const record: any = {
        resourceUrl,
        name,
        description,
        category,
        network: accept.network,
        asset: accept.asset,
        assetName,
        priceRaw: accept.maxAmountRequired,
        priceUsd,
        payTo: accept.payTo,
        scheme: accept.scheme,
        x402Version: resource.x402Version,
        method,
        lastSeenAt: new Date(),
        isActive: true,
        metadata: resource,
      };

      // Enrich with scout data if available
      if (scout) {
        record.healthStatus = scout.health_status || null;
        record.uptimePct = scout.uptime_pct ?? null;
        record.avgLatencyMs = scout.avg_latency_ms ?? null;
        record.trustScore = scout.trust_score ?? null;
        record.lastHealthCheck = scout.last_health_check ? new Date(scout.last_health_check) : null;
        record.scoutData = scout;
        // Prefer scout category if available
        if (scout.category) record.category = scout.category;
        if (scout.name) record.name = scout.name;
      }

      batch.push(record);
    }

    // Upsert in bulk
    let upserted = 0;
    for (let i = 0; i < batch.length; i += 100) {
      const chunk = batch.slice(i, i + 100);
      for (const record of chunk) {
        try {
          await storage.upsertBazaarService(record);
          upserted++;
        } catch (err) {
          logger.warn(`Failed to upsert ${record.resourceUrl}`, { error: (err as Error).message });
        }
      }
      if ((i + 100) % 500 === 0) {
        metadata.set("upsertedCount", upserted);
        logger.info(`Upserted ${upserted}/${batch.length} services`);
      }
    }

    metadata.set("upsertedCount", upserted);
    logger.info(`Upserted ${upserted} services total`);

    // Mark services not touched in this run as inactive
    // (upsert sets last_seen_at = NOW(); anything older than runStartedAt was not seen)
    if (upserted > 0) {
      await storage.markBazaarServicesInactive(runStartedAt);
    }

    // Step 4: Compute and store daily snapshot
    metadata.set("status", "snapshotting");
    try {
      const stats = await storage.getBazaarStats();
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Count new services (first_seen_at today)
      const { db } = await import("../server/db.js");
      const { sql } = await import("drizzle-orm");
      const newResult = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM bazaar_services
        WHERE first_seen_at >= ${today} AND is_active = TRUE
      `);
      const newCount = Number((newResult.rows[0] as any).count);

      // Price stats by category
      const priceByCatResult = await db.execute(sql`
        SELECT category,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd) AS median,
          AVG(price_usd) AS mean,
          MIN(price_usd) AS min,
          MAX(price_usd) AS max,
          COUNT(*)::int AS count
        FROM bazaar_services
        WHERE is_active = TRUE AND price_usd IS NOT NULL AND price_usd > 0
        GROUP BY category
      `);
      const priceByCat: Record<string, any> = {};
      for (const row of priceByCatResult.rows as any[]) {
        priceByCat[row.category] = {
          median: Number(row.median),
          mean: Number(row.mean),
          min: Number(row.min),
          max: Number(row.max),
          count: Number(row.count),
        };
      }

      await storage.createBazaarSnapshot({
        snapshotDate: today,
        totalServices: stats.totalServices,
        activeServices: stats.activeServices,
        newServicesCount: newCount,
        categoryBreakdown: stats.categoryBreakdown,
        networkBreakdown: stats.networkBreakdown,
        priceStats: stats.priceStats,
        priceByCategoryStats: priceByCat,
        totalPayToWallets: stats.totalPayToWallets,
        topServices: null,
      });

      logger.info("Daily snapshot created", {
        total: stats.totalServices,
        active: stats.activeServices,
        newToday: newCount,
      });
    } catch (err) {
      logger.error("Failed to create snapshot", { error: (err as Error).message });
      metadata.set("snapshotError", (err as Error).message);
    }

    metadata.set("status", "completed");
    metadata.set("completedAt", new Date().toISOString());

    return {
      totalFetched: allResources.length,
      upserted,
      scoutEnriched: scoutServices.length,
    };
  },
});
