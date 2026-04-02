import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const communityFeedbackTask = schedules.task({
  id: "community-feedback",
  cron: "0 4 * * *",
  maxDuration: 300,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { discoverAllSources, getCommunityFeedbackScheduler } = await import(
        "../server/community-feedback"
      );

      metadata.set("phase", "discovering");
      const discovered = await discoverAllSources();
      metadata.set("discovered", discovered);
      logger.info("Source discovery complete", { discovered });

      metadata.set("phase", "scraping");
      const scheduler = getCommunityFeedbackScheduler();
      if (scheduler) {
        await scheduler.runAllScrapes();
        metadata.set("scrapesCompleted", true);
        logger.info("Community feedback scraping complete");
      } else {
        metadata.set("scrapesCompleted", false);
        logger.warn("No community feedback scheduler available");
      }

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.costInCents);
      metadata.set("durationMs", cost.durationMs);

      return { discovered };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("community-feedback failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorAt", new Date().toISOString());
      return { error: error.message };
    }
  },
});
