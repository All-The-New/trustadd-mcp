import pg from "pg";

const { Pool } = pg;

const BATCH_SIZE = 500;

export interface SyncResult {
  agents: number;
  events: number;
  indexerStateRows: number;
  communityFeedbackSources: number;
  communityFeedbackItems: number;
  communityFeedbackSummaries: number;
}

async function getJsonbColumns(client: pg.PoolClient, table: string): Promise<Set<string>> {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND udt_name = 'jsonb'`,
    [table],
  );
  return new Set(result.rows.map((r: { column_name: string }) => r.column_name));
}

async function getDevColumns(client: pg.PoolClient, table: string): Promise<Set<string>> {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  return new Set(result.rows.map((r: { column_name: string }) => r.column_name));
}

function filterToDevColumns(
  prodColumns: string[],
  devColumns: Set<string>,
  rows: Record<string, unknown>[],
): { columns: string[]; rows: Record<string, unknown>[] } {
  const validCols = prodColumns.filter((c) => devColumns.has(c));
  if (validCols.length === prodColumns.length) return { columns: prodColumns, rows };
  return {
    columns: validCols,
    rows: rows.map((row) => {
      const filtered: Record<string, unknown> = {};
      for (const col of validCols) filtered[col] = row[col];
      return filtered;
    }),
  };
}

async function bulkInsert(
  client: pg.PoolClient,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
  batchSize: number,
  logger: (msg: string) => void,
) {
  const jsonbCols = await getJsonbColumns(client, table);
  const quotedCols = columns.map((c) => `"${c}"`).join(", ");

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
      const row = batch[rowIdx];
      const rowPlaceholders: string[] = [];
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        let val = row[columns[colIdx]];
        const isJsonb = jsonbCols.has(columns[colIdx]);
        if (isJsonb && val !== null) {
          val = JSON.stringify(val);
        } else if (val !== null && typeof val === "object" && !(val instanceof Date) && !Array.isArray(val)) {
          val = JSON.stringify(val);
        }
        values.push(val);
        const paramRef = `$${values.length}`;
        rowPlaceholders.push(isJsonb ? `${paramRef}::jsonb` : paramRef);
      }
      placeholders.push(`(${rowPlaceholders.join(", ")})`);
    }

    const query = `INSERT INTO "${table}" (${quotedCols}) VALUES ${placeholders.join(", ")}`;
    await client.query(query, values);

    const end = Math.min(i + batchSize, rows.length);
    if (rows.length > batchSize) {
      logger(`  ${table}: batch ${Math.floor(i / batchSize) + 1} (rows ${i + 1}-${end} of ${rows.length})`);
    }
  }
}

export async function runSync(
  prodUrl: string,
  devUrl: string,
  logger: (msg: string) => void = console.log,
): Promise<SyncResult> {
  if (prodUrl === devUrl) {
    throw new Error("PROD_DATABASE_URL and DATABASE_URL are the same. Aborting to prevent data loss.");
  }

  const prodPool = new Pool({ connectionString: prodUrl });
  const devPool = new Pool({ connectionString: devUrl });

  try {
    logger("Connecting to production database...");
    const prodClient = await prodPool.connect();
    logger("Connected to production database.");

    logger("Connecting to dev database...");
    const devClient = await devPool.connect();
    logger("Connected to dev database.");

    logger("Reading production data...");

    const agentsResult = await prodClient.query("SELECT * FROM agents ORDER BY created_at");
    const agents = agentsResult.rows;
    logger(`  agents: ${agents.length} rows`);

    const eventsResult = await prodClient.query("SELECT * FROM agent_metadata_events ORDER BY created_at");
    const events = eventsResult.rows;
    logger(`  agent_metadata_events: ${events.length} rows`);

    const stateResult = await prodClient.query("SELECT * FROM indexer_state");
    const states = stateResult.rows;
    logger(`  indexer_state: ${states.length} rows`);

    const cfSourcesExist = await prodClient.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'community_feedback_sources')"
    );
    let cfSources: Record<string, unknown>[] = [];
    let cfItems: Record<string, unknown>[] = [];
    let cfSummaries: Record<string, unknown>[] = [];

    if (cfSourcesExist.rows[0].exists) {
      const cfSourcesResult = await prodClient.query("SELECT * FROM community_feedback_sources ORDER BY id");
      cfSources = cfSourcesResult.rows;
      logger(`  community_feedback_sources: ${cfSources.length} rows`);

      const cfItemsResult = await prodClient.query("SELECT * FROM community_feedback_items ORDER BY id");
      cfItems = cfItemsResult.rows;
      logger(`  community_feedback_items: ${cfItems.length} rows`);

      const cfSummariesResult = await prodClient.query("SELECT * FROM community_feedback_summaries ORDER BY id");
      cfSummaries = cfSummariesResult.rows;
      logger(`  community_feedback_summaries: ${cfSummaries.length} rows`);
    } else {
      logger("  community_feedback tables do not exist in prod yet, skipping");
    }

    prodClient.release();

    logger("Truncating dev tables...");
    await devClient.query("BEGIN");

    try {
      await devClient.query("TRUNCATE community_feedback_items CASCADE");
      await devClient.query("TRUNCATE community_feedback_summaries CASCADE");
      await devClient.query("TRUNCATE community_feedback_sources CASCADE");
      await devClient.query("TRUNCATE agent_metadata_events CASCADE");
      await devClient.query("TRUNCATE agents CASCADE");
      await devClient.query("TRUNCATE indexer_state CASCADE");

      logger("Inserting data into dev...");

      if (agents.length > 0) {
        const devCols = await getDevColumns(devClient, "agents");
        const filtered = filterToDevColumns(Object.keys(agents[0]), devCols, agents);
        await bulkInsert(devClient, "agents", filtered.columns, filtered.rows, BATCH_SIZE, logger);
        logger(`  Inserted ${agents.length} agents`);
      }

      if (events.length > 0) {
        const devCols = await getDevColumns(devClient, "agent_metadata_events");
        const filtered = filterToDevColumns(Object.keys(events[0]), devCols, events);
        await bulkInsert(devClient, "agent_metadata_events", filtered.columns, filtered.rows, BATCH_SIZE, logger);
        logger(`  Inserted ${events.length} events`);
      }

      if (states.length > 0) {
        const devCols = await getDevColumns(devClient, "indexer_state");
        const filtered = filterToDevColumns(Object.keys(states[0]), devCols, states);
        await bulkInsert(devClient, "indexer_state", filtered.columns, filtered.rows, BATCH_SIZE, logger);
        logger(`  Inserted ${states.length} indexer_state rows`);
      }

      if (cfSources.length > 0) {
        const devCols = await getDevColumns(devClient, "community_feedback_sources");
        const filtered = filterToDevColumns(Object.keys(cfSources[0]), devCols, cfSources);
        await bulkInsert(devClient, "community_feedback_sources", filtered.columns, filtered.rows, BATCH_SIZE, logger);
        logger(`  Inserted ${cfSources.length} community_feedback_sources`);
      }

      if (cfItems.length > 0) {
        const devCols = await getDevColumns(devClient, "community_feedback_items");
        const filtered = filterToDevColumns(Object.keys(cfItems[0]), devCols, cfItems);
        await bulkInsert(devClient, "community_feedback_items", filtered.columns, filtered.rows, BATCH_SIZE, logger);
        logger(`  Inserted ${cfItems.length} community_feedback_items`);
      }

      if (cfSummaries.length > 0) {
        const devCols = await getDevColumns(devClient, "community_feedback_summaries");
        const filtered = filterToDevColumns(Object.keys(cfSummaries[0]), devCols, cfSummaries);
        await bulkInsert(devClient, "community_feedback_summaries", filtered.columns, filtered.rows, BATCH_SIZE, logger);
        logger(`  Inserted ${cfSummaries.length} community_feedback_summaries`);
      }

      await devClient.query("COMMIT");
      const result: SyncResult = {
        agents: agents.length,
        events: events.length,
        indexerStateRows: states.length,
        communityFeedbackSources: cfSources.length,
        communityFeedbackItems: cfItems.length,
        communityFeedbackSummaries: cfSummaries.length,
      };
      logger(`Sync complete: ${result.agents} agents, ${result.events} events, ${result.indexerStateRows} indexer_state, ${result.communityFeedbackSources} sources, ${result.communityFeedbackItems} items, ${result.communityFeedbackSummaries} summaries`);
      return result;
    } catch (err) {
      await devClient.query("ROLLBACK");
      throw err;
    } finally {
      devClient.release();
    }
  } finally {
    await prodPool.end();
    await devPool.end();
  }
}

if (process.argv[1]?.includes("sync-prod-to-dev")) {
  const prodUrl = process.env.PROD_DATABASE_URL;
  const devUrl = process.env.DATABASE_URL;

  if (!prodUrl) {
    console.error("PROD_DATABASE_URL environment variable is not set.");
    process.exit(1);
  }
  if (!devUrl) {
    console.error("DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  runSync(prodUrl, devUrl).catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
