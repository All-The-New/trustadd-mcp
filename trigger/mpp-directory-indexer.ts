import { schedules, logger, metadata } from "@trigger.dev/sdk/v3";

export const mppDirectoryIndexerTask = schedules.task({
  id: "mpp-directory-indexer",
  cron: "30 4 * * *",
  maxDuration: 600,
  run: async (_payload) => {
    if (process.env.ENABLE_MPP_INDEXER !== "true") {
      logger.info("MPP directory indexer disabled");
      return { skipped: true };
    }

    metadata.set("status", "starting");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { storage } = await import("../server/storage");
      const { createDirectorySource } = await import("../server/mpp-directory");
      const mode = (process.env.MPP_DIRECTORY_SOURCE as "api" | "scrape" | "auto") || "auto";
      const source = createDirectorySource(mode);

      const runStartedAt = new Date();

      metadata.set("phase", "fetching");
      const services = await source.fetchServices();
      metadata.set("fetched", services.length);
      logger.info(`MPP directory fetch: ${services.length} services via ${mode}`);

      metadata.set("phase", "upserting");
      let upserted = 0;
      for (const s of services) {
        try {
          await storage.upsertMppDirectoryService({
            serviceUrl: s.serviceUrl,
            serviceName: s.serviceName,
            providerName: s.providerName,
            description: s.description,
            category: s.category,
            pricingModel: s.pricingModel,
            priceAmount: s.priceAmount,
            priceCurrency: s.priceCurrency,
            paymentMethods: s.paymentMethods as any,
            recipientAddress: s.recipientAddress,
            metadata: s.metadata,
          });
          upserted++;
        } catch (err) {
          logger.warn(`Failed to upsert ${s.serviceUrl}`, { error: (err as Error).message });
        }
      }
      metadata.set("upserted", upserted);

      if (upserted > 0) {
        const inactive = await storage.markMppServicesInactive(runStartedAt);
        metadata.set("markedInactive", inactive);
      }

      metadata.set("phase", "snapshot");
      const stats = await storage.getMppDirectoryStats();
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await storage.createMppSnapshot({
        snapshotDate: today.toISOString().slice(0, 10),
        totalServices: stats.totalServices,
        activeServices: stats.activeServices,
        categoryBreakdown: stats.categoryBreakdown,
        pricingModelBreakdown: stats.pricingModelBreakdown,
        paymentMethodBreakdown: stats.paymentMethodBreakdown,
        priceStats: stats.priceStats,
      });

      metadata.set("status", "completed");
      try {
        const { recordSuccess } = await import("../server/pipeline-health");
        await recordSuccess("mpp-directory-indexer", "MPP Directory Indexer");
      } catch {}
      return { fetched: services.length, upserted };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("mpp-directory-indexer failed", { error: error.message });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      try {
        const { notifyJobFailure } = await import("./alert");
        await notifyJobFailure("mpp-directory-indexer", error);
      } catch {}
      try {
        const { recordFailure } = await import("../server/pipeline-health");
        await recordFailure("mpp-directory-indexer", "MPP Directory Indexer", error.message);
      } catch {}
      return { error: error.message };
    }
  },
});
