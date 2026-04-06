import { task, logger, metadata } from "@trigger.dev/sdk/v3";

export const communityScrapeTask = task({
  id: "community-scrape",
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  queue: { concurrencyLimit: 10 },
  run: async (payload: { platform: "github" | "farcaster" }) => {
    const { CommunityFeedbackScheduler } = await import(
      "../server/community-feedback/scheduler"
    );
    const { GitHubAdapter } = await import(
      "../server/community-feedback/adapters/github"
    );
    const { FarcasterAdapter } = await import(
      "../server/community-feedback/adapters/farcaster"
    );

    metadata.set("status", "scraping");
    metadata.set("platform", payload.platform);
    metadata.set("startedAt", new Date().toISOString());

    const scheduler = new CommunityFeedbackScheduler();

    if (payload.platform === "github") {
      scheduler.registerAdapter("github", new GitHubAdapter(), {
        concurrency: 1,
        delayMs: 1500,
        retries: 2,
        intervalHours: 24,
      });
    } else {
      scheduler.registerAdapter("farcaster", new FarcasterAdapter(), {
        concurrency: 1,
        delayMs: 2000,
        retries: 2,
        intervalHours: 24,
      });
    }

    // 240s budget = 300s maxDuration minus 60s buffer
    const result = await scheduler.runPlatformScrape(payload.platform, {
      deadlineMs: Date.now() + 240_000,
    });

    metadata.set("status", "completed");
    metadata.set("completedAt", new Date().toISOString());
    metadata.set("scraped", result.scraped);
    metadata.set("errors", result.errors);
    metadata.set("skippedDueToTimeout", result.skippedDueToTimeout);

    logger.info(`${payload.platform} scrape complete`, { result });

    return {
      platform: payload.platform,
      totalScraped: result.scraped,
      totalErrors: result.errors,
      totalSkipped: result.skippedDueToTimeout,
    };
  },
});
