import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";
import { communityScrapeTask } from "./community-feedback-scraper.js";

export const communityFeedbackTask = schedules.task({
  id: "community-feedback",
  cron: "0 4 * * *",
  maxDuration: 600,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { discoverAllSources } = await import("../server/community-feedback");

      metadata.set("phase", "discovering");
      const discovered = await discoverAllSources();
      metadata.set("discovered", discovered);
      logger.info("Source discovery complete", { discovered });

      // Dispatch parallel child tasks for each platform
      metadata.set("phase", "dispatching");
      const results = await communityScrapeTask.batchTriggerAndWait([
        { payload: { platform: "github" } },
        { payload: { platform: "farcaster" } },
      ]);

      let totalScraped = 0;
      let totalErrors = 0;
      let totalSkipped = 0;
      const failures: string[] = [];

      for (const run of results.runs) {
        if (run.ok) {
          const output = run.output as {
            platform: string;
            totalScraped: number;
            totalErrors: number;
            totalSkipped: number;
          } | null;
          totalScraped += output?.totalScraped ?? 0;
          totalErrors += output?.totalErrors ?? 0;
          totalSkipped += output?.totalSkipped ?? 0;
        } else {
          failures.push(String(run.error));
        }
      }

      metadata.set("scrapesCompleted", true);
      metadata.set("totalScraped", totalScraped);
      metadata.set("totalErrors", totalErrors);
      metadata.set("totalSkipped", totalSkipped);
      if (failures.length > 0) metadata.set("failures", failures);
      logger.info("Community feedback scraping complete", {
        totalScraped,
        totalErrors,
        totalSkipped,
        failures,
      });

      const cost = usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.totalCostInCents);
      metadata.set("durationMs", cost.compute.total.durationMs);

      return { discovered, totalScraped, totalErrors, totalSkipped };
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
