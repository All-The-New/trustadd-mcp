import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const blockchainIndexerTask = schedules.task({
  id: "blockchain-indexer",
  cron: "*/2 * * * *",
  maxDuration: 120,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      // Step 0: DB connectivity test with detailed error reporting
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        logger.error("DATABASE_URL is not set in container");
        // Log all env var names (not values) for debugging
        const envKeys = Object.keys(process.env).filter(k => !k.startsWith("_")).sort();
        logger.info("Available env vars", { keys: envKeys.join(", ") });
        metadata.set("error", "DATABASE_URL not set");
        metadata.set("envKeys", envKeys.join(", "));
        return { error: "DATABASE_URL not set", envKeys };
      }

      logger.info("DATABASE_URL is set", {
        length: dbUrl.length,
        hasPooler: dbUrl.includes("pooler"),
        prefix: dbUrl.slice(0, 30),
      });

      // Try raw pg connection
      let dbConnected = false;
      try {
        const pg = await import("pg");
        const pool = new pg.default.Pool({
          connectionString: dbUrl,
          max: 1,
          connectionTimeoutMillis: 10000,
          ssl: { rejectUnauthorized: false },
        });
        const res = await pool.query("SELECT 1 as ok");
        dbConnected = res.rows[0]?.ok === 1;
        await pool.end();
        logger.info("Direct DB connection: OK");
      } catch (pgErr) {
        logger.error("Direct DB connection FAILED", { error: (pgErr as Error).message });
        metadata.set("dbError", (pgErr as Error).message);
        return { error: "DB connection failed", message: (pgErr as Error).message, dbUrl: dbUrl.slice(0, 30) + "..." };
      }

      metadata.set("dbConnected", dbConnected);

      // Step 1: Start indexer
      const { startIndexerImmediate, stopIndexer } = await import("../server/indexer");
      metadata.set("phase", "starting-indexers");
      const result = await startIndexerImmediate();
      metadata.set("chainsStarted", result.started);
      metadata.set("chainsFailed", result.failed);

      if (result.started === 0) {
        return { error: "No chains started", failed: result.failed };
      }

      // Step 2: Run for 90s
      metadata.set("phase", "indexing");
      await new Promise((resolve) => setTimeout(resolve, 90_000));

      // Step 3: Stop
      metadata.set("phase", "stopping");
      stopIndexer();

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.costInCents);
      metadata.set("durationMs", cost.durationMs);

      return { chainsIndexed: result.started, dbConnected, failed: result.failed };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("blockchain-indexer failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorAt", new Date().toISOString());
      return { error: error.message };
    }
  },
});
