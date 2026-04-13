import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const recalculateTask = schedules.task({
  id: "recalculate-scores",
  cron: "0 5 * * *",
  maxDuration: 600,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { ensureScoresCalculated } = await import("../server/trust-score");
      const { ensureSlugsGenerated } = await import("../server/slugs");
      const { classifyAgent } = await import("../server/quality-classifier");
      const { db } = await import("../server/db");
      const { agents } = await import("../shared/schema");
      const { eq, inArray, sql } = await import("drizzle-orm");
      const { TimeBudget } = await import("../server/lib/time-budget");

      const budget = new TimeBudget(540_000); // 540s = 600s maxDuration minus 60s buffer

      const phaseStart = Date.now();
      metadata.set("phase", "recalculating-scores");
      await ensureScoresCalculated();
      metadata.set("phaseScoresMs", Date.now() - phaseStart);
      logger.info("Trust scores recalculated");

      if (!budget.hasTime(120_000)) {
        logger.warn("Time budget low after scores — skipping slugs and classification");
        metadata.set("skippedPhases", "slugs,classification");
      } else {
        const slugStart = Date.now();
        metadata.set("phase", "generating-slugs");
        await ensureSlugsGenerated();
        metadata.set("phaseSlugsMs", Date.now() - slugStart);
        logger.info("Slugs generated");
      }

      // Batch-classify unclassified agents
      let classified = 0;
      if (budget.hasTime(60_000)) {
        const classifyStart = Date.now();
        metadata.set("phase", "classifying");
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

            // Batch update per-agent fields (fingerprint, nextEnrichmentAt) via unnest
            if (results.length > 0) {
              const ids = results.map(r => r.id);
              const fingerprints = results.map(r => r.metadataFingerprint ?? null);
              const enrichments = results.map(r => r.nextEnrichmentAt?.toISOString() ?? null);

              await db.execute(sql`
                UPDATE agents SET
                  metadata_fingerprint = batch.fp,
                  next_enrichment_at = batch.enrich::timestamptz
                FROM (
                  SELECT unnest(${ids}::text[]) AS id,
                         unnest(${fingerprints}::text[]) AS fp,
                         unnest(${enrichments}::text[]) AS enrich
                ) AS batch
                WHERE agents.id = batch.id
              `);
            }

            logger.info(`Classified ${classified} agents`);
          }
        } catch (err) {
          logger.error("Failed to auto-classify agents", { error: (err as Error).message });
        }
        metadata.set("phaseClassifyMs", Date.now() - classifyStart);
      } else {
        metadata.set("skippedClassification", true);
        logger.warn("Time budget low — skipping classification phase");
      }

      // Recompile stale trust reports so cached verdicts reflect new scores
      let recompiled = 0;
      if (budget.hasTime(60_000)) {
        const recompileStart = Date.now();
        metadata.set("phase", "recompiling-reports");
        try {
          const { batchRecompileReports } = await import("../server/trust-report-compiler");
          const result = await batchRecompileReports({ limit: 200 });
          recompiled = result.recompiled;
          logger.info(`Recompiled ${recompiled} stale trust reports`);
        } catch (err) {
          logger.error("Failed to recompile reports", { error: (err as Error).message });
        }
        metadata.set("phaseRecompileMs", Date.now() - recompileStart);
      } else {
        metadata.set("skippedRecompile", true);
        logger.warn("Time budget low — skipping report recompilation phase");
      }

      const cost = usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("classified", classified);
      metadata.set("recompiled", recompiled);
      metadata.set("computeCostCents", cost.totalCostInCents);
      metadata.set("durationMs", cost.compute.total.durationMs);

      return { success: true, classified, recompiled };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("recalculate-scores failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorAt", new Date().toISOString());
      try {
        const { notifyJobFailure } = await import("./alert");
        await notifyJobFailure("recalculate-scores", error);
      } catch {}
      return { error: error.message };
    }
  },
});
