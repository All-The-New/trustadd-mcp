import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const communityFeedbackTask = schedules.task({
  id: "community-feedback",
  cron: "0 4 * * *",
  maxDuration: 600,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { discoverAllSources } = await import("../server/community-feedback");
      const { CommunityFeedbackScheduler } = await import(
        "../server/community-feedback/scheduler"
      );
      const { GitHubAdapter } = await import(
        "../server/community-feedback/adapters/github"
      );
      const { FarcasterAdapter } = await import(
        "../server/community-feedback/adapters/farcaster"
      );

      metadata.set("phase", "discovering");
      const discovered = await discoverAllSources();
      metadata.set("discovered", discovered);
      logger.info("Source discovery complete", { discovered });

      metadata.set("phase", "scraping");
      // Instantiate scheduler directly — getCommunityFeedbackScheduler() returns null
      // in Trigger.dev container because initCommunityFeedback() only runs in Express server
      const scheduler = new CommunityFeedbackScheduler();
      scheduler.registerAdapter("github", new GitHubAdapter(), {
        concurrency: 1,
        delayMs: 1500,
        retries: 2,
        intervalHours: 24,
      });
      scheduler.registerAdapter("farcaster", new FarcasterAdapter(), {
        concurrency: 1,
        delayMs: 2000,
        retries: 2,
        intervalHours: 24,
      });

      // 540s budget = 600s maxDuration minus 60s buffer
      const scrapeResult = await scheduler.runAllScrapes({ deadlineMs: Date.now() + 540_000 });
      metadata.set("scrapesCompleted", true);
      metadata.set("totalScraped", scrapeResult.totalScraped);
      metadata.set("totalErrors", scrapeResult.totalErrors);
      metadata.set("totalSkipped", scrapeResult.totalSkipped);
      logger.info("Community feedback scraping complete", { scrapeResult });

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.costInCents);
      metadata.set("durationMs", cost.durationMs);

      return { discovered, ...scrapeResult };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("community-feedback failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorAt", new Date().toISOString());
      try {
        const { notifyJobFailure } = await import("./alert");
        await notifyJobFailure("community-feedback", error);
      } catch {}
      return { error: error.message };
    }
  },
});
