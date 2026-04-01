import { schedules, logger } from "@trigger.dev/sdk/v3";
import { ensureScoresCalculated } from "../server/trust-score";
import { ensureSlugsGenerated } from "../server/slugs";
import { classifyAgent, computeFingerprint } from "../server/quality-classifier";
import { db } from "../server/db";
import { agents } from "../shared/schema";
import { eq } from "drizzle-orm";
import { notifyJobFailure } from "./alert";

export const recalculateTask = schedules.task({
  id: "recalculate-scores",
  // Run daily at 5:00 AM UTC
  cron: "0 5 * * *",
  run: async (payload) => {
    try {
      logger.info("Starting trust score recalculation", {
        timestamp: payload.timestamp,
      });

      await ensureScoresCalculated();
      logger.info("Trust scores recalculated");

      await ensureSlugsGenerated();
      logger.info("Slugs generated");

      // Auto-classify unclassified agents
      try {
        const unclassified = await db.select()
          .from(agents)
          .where(eq(agents.qualityTier, "unclassified"))
          .limit(1000);

        if (unclassified.length > 0) {
          let classified = 0;
          for (const agent of unclassified) {
            const result = classifyAgent(agent);
            await db.update(agents)
              .set({
                qualityTier: result.qualityTier,
                spamFlags: result.spamFlags,
                lifecycleStatus: result.lifecycleStatus,
                metadataFingerprint: result.metadataFingerprint,
                nextEnrichmentAt: result.nextEnrichmentAt,
                lastQualityEvaluatedAt: new Date(),
              })
              .where(eq(agents.id, agent.id));
            classified++;
          }
          logger.info(`Classified ${classified} previously unclassified agents`);
        }
      } catch (err) {
        logger.error("Failed to auto-classify agents", { error: (err as Error).message });
      }

      return { success: true };
    } catch (err) {
      await notifyJobFailure("recalculate-scores", err as Error);
      throw err;
    }
  },
});
