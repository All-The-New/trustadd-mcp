import { schedules, logger } from "@trigger.dev/sdk/v3";
import { ensureScoresCalculated } from "../server/trust-score";
import { ensureSlugsGenerated } from "../server/slugs";

export const recalculateTask = schedules.task({
  id: "recalculate-scores",
  // Run daily at 5:00 AM UTC
  cron: "0 5 * * *",
  run: async (payload) => {
    logger.info("Starting trust score recalculation", {
      timestamp: payload.timestamp,
    });

    await ensureScoresCalculated();
    logger.info("Trust scores recalculated");

    await ensureSlugsGenerated();
    logger.info("Slugs generated");

    return { success: true };
  },
});
