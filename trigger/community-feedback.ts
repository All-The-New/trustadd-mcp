import { schedules, logger } from "@trigger.dev/sdk/v3";
import { discoverAllSources } from "../server/community-feedback";

export const communityFeedbackTask = schedules.task({
  id: "community-feedback",
  // Run daily at 4:00 AM UTC
  cron: "0 4 * * *",
  run: async (payload) => {
    logger.info("Starting community feedback scraping", {
      timestamp: payload.timestamp,
    });

    // Discover new sources (GitHub repos, Farcaster profiles)
    const discovered = await discoverAllSources();
    logger.info("Source discovery complete", { discovered });

    // Import the scheduler dynamically to avoid circular deps
    const { getCommunityFeedbackScheduler } = await import(
      "../server/community-feedback"
    );
    const scheduler = getCommunityFeedbackScheduler();
    if (scheduler) {
      await scheduler.runAllScrapes();
      logger.info("Community feedback scraping complete");
    } else {
      logger.warn("No community feedback scheduler available");
    }

    return { discovered };
  },
});
