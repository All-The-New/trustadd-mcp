import { schedules, logger } from "@trigger.dev/sdk/v3";
import { notifyJobFailure } from "./alert";

export const communityFeedbackTask = schedules.task({
  id: "community-feedback",
  // Run daily at 4:00 AM UTC
  cron: "0 4 * * *",
  run: async (payload) => {
    try {
      logger.info("Starting community feedback scraping", {
        timestamp: payload.timestamp,
      });

      const { discoverAllSources, getCommunityFeedbackScheduler } = await import(
        "../server/community-feedback"
      );

      // Discover new sources (GitHub repos, Farcaster profiles)
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
      await notifyJobFailure("community-feedback", err as Error);
      throw err;
    }
  },
});
