import { schedules, logger } from "@trigger.dev/sdk/v3";

export const recalculateTask = schedules.task({
  id: "recalculate-scores",
  // Run daily at 5:00 AM UTC
  cron: "0 5 * * *",
  run: async (payload) => {
    logger.info("Starting trust score recalculation", { timestamp: payload.timestamp });

    try {
      const { ensureScoresCalculated } = await import("../server/trust-score");
      const { ensureSlugsGenerated } = await import("../server/slugs");
      const { classifyAgent } = await import("../server/quality-classifier");
      const { db } = await import("../server/db");
      const { agents } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");

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
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("recalculate-scores failed", { error: error.message, stack: error.stack });
      return { error: error.message };
    }
  },
});
