import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const recalculateTask = schedules.task({
  id: "recalculate-scores",
  cron: "0 5 * * *",
  maxDuration: 300,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { ensureScoresCalculated } = await import("../server/trust-score");
      const { ensureSlugsGenerated } = await import("../server/slugs");
      const { classifyAgent } = await import("../server/quality-classifier");
      const { db } = await import("../server/db");
      const { agents } = await import("../shared/schema");
      const { eq, inArray } = await import("drizzle-orm");

      metadata.set("phase", "recalculating-scores");
      await ensureScoresCalculated();
      logger.info("Trust scores recalculated");

      metadata.set("phase", "generating-slugs");
      await ensureSlugsGenerated();
      logger.info("Slugs generated");

      // Batch-classify unclassified agents
      metadata.set("phase", "classifying");
      let classified = 0;
      try {
        const unclassified = await db.select()
          .from(agents)
          .where(eq(agents.qualityTier, "unclassified"))
          .limit(1000);

        metadata.set("unclassifiedCount", unclassified.length);

        if (unclassified.length > 0) {
          // Classify all in memory first
          const results = unclassified.map((agent) => ({
            id: agent.id,
            ...classifyAgent(agent),
          }));

          // Group by qualityTier for batch updates
          const grouped = new Map<string, typeof results>();
          for (const r of results) {
            const tier = r.qualityTier;
            if (!grouped.has(tier)) grouped.set(tier, []);
            grouped.get(tier)!.push(r);
          }

          for (const [tier, group] of grouped) {
            const ids = group.map((g) => g.id);
            // Use first item's fields as representative (same tier = same flags pattern)
            const sample = group[0];
            await db.update(agents)
              .set({
                qualityTier: sample.qualityTier,
                spamFlags: sample.spamFlags,
                lifecycleStatus: sample.lifecycleStatus,
                lastQualityEvaluatedAt: new Date(),
              })
              .where(inArray(agents.id, ids));
            classified += group.length;
            metadata.set("classifiedSoFar", classified);
          }

          // Individual updates for per-agent fields (fingerprint, nextEnrichmentAt)
          for (const r of results) {
            await db.update(agents)
              .set({
                metadataFingerprint: r.metadataFingerprint,
                nextEnrichmentAt: r.nextEnrichmentAt,
              })
              .where(eq(agents.id, r.id));
          }

          logger.info(`Classified ${classified} agents`);
        }
      } catch (err) {
        logger.error("Failed to auto-classify agents", { error: (err as Error).message });
      }

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("classified", classified);
      metadata.set("computeCostCents", cost.costInCents);
      metadata.set("durationMs", cost.durationMs);

      return { success: true, classified };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("recalculate-scores failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorAt", new Date().toISOString());
      return { error: error.message };
    }
  },
});
