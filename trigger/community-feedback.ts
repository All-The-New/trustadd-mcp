import { schedules, logger } from "@trigger.dev/sdk/v3";

export const communityFeedbackTask = schedules.task({
  id: "community-feedback",
  // Run daily at 4:00 AM UTC
  cron: "0 4 * * *",
  run: async (payload) => {
    logger.info("Starting community feedback scraping", { timestamp: payload.timestamp });

    try {
      const { discoverAllSources, getCommunityFeedbackScheduler } = await import(
        "../server/community-feedback"
      );

      const discovered = await discoverAllSources();
      logger.info("Source discovery complete", { discovered });

      const scheduler = getCommunityFeedbackScheduler();
      if (scheduler) {
        await scheduler.runAllScrapes();
        logger.info("Community feedback scraping complete");
      } else {
        logger.warn("No community feedback scheduler available");
      }

      return { discovered };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("community-feedback failed", { error: error.message, stack: error.stack });
      return { error: error.message };
    }
  },
});
