import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const blockchainIndexerTask = schedules.task({
  id: "blockchain-indexer",
  cron: "*/2 * * * *",
  maxDuration: 120,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      // Step 0: Direct DB test — bypass all abstractions
      const dbUrl = process.env.DATABASE_URL;
      metadata.set("hasDbUrl", !!dbUrl);
      if (!dbUrl) {
        return { error: "DATABASE_URL not set" };
      }

      logger.info("Testing direct DB connection...");
      const pg = await import("pg");
      const testPool = new pg.default.Pool({
        connectionString: dbUrl,
        max: 1,
        connectionTimeoutMillis: 10000,
        ssl: { rejectUnauthorized: false },
      });

      try {
        const testResult = await testPool.query("SELECT NOW() as time, current_database() as db");
        const row = testResult.rows[0];
        metadata.set("dbConnected", true);
        metadata.set("dbTime", row.time);
        metadata.set("dbName", row.db);
        logger.info("DB connected", { time: row.time, db: row.db });

        // Test write to indexer_state
        const writeResult = await testPool.query(
          "UPDATE indexer_state SET updated_at = NOW() WHERE id = 'default' RETURNING updated_at"
        );
        metadata.set("dbWriteSuccess", writeResult.rowCount > 0);
        logger.info("DB write test", { rowCount: writeResult.rowCount, updatedAt: writeResult.rows[0]?.updated_at });
      } catch (dbErr) {
        metadata.set("dbConnected", false);
        metadata.set("dbError", (dbErr as Error).message);
        logger.error("DB connection FAILED", { error: (dbErr as Error).message });
        await testPool.end();
        return { error: "DB connection failed", message: (dbErr as Error).message };
      }
      await testPool.end();

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

      return { chainsIndexed: result.started, failed: result.failed };
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
