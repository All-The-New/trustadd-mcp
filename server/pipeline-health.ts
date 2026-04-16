/**
 * Pipeline health tracking for Trigger.dev tasks.
 *
 * All database imports MUST use dynamic import() because this module is
 * consumed from Trigger.dev task files where static server imports crash
 * during container module initialization.
 */

export const STALENESS_SLAS: Record<string, { warningMinutes: number; criticalMinutes: number }> = {
  "blockchain-indexer":  { warningMinutes: 15,   criticalMinutes: 30 },
  "recalculate-scores":  { warningMinutes: 1560,  criticalMinutes: 1800 },
  "x402-prober":         { warningMinutes: 1500,  criticalMinutes: 2160 },
  "community-feedback":  { warningMinutes: 1800,  criticalMinutes: 2880 },
  "transaction-indexer": { warningMinutes: 480,   criticalMinutes: 780 },
  "watchdog":            { warningMinutes: 30,    criticalMinutes: 60 },
  "bazaar-indexer":      { warningMinutes: 1560,  criticalMinutes: 1800 },
  // MPP
  "mpp-prober":              { warningMinutes: 1500, criticalMinutes: 2160 },
  "mpp-directory-indexer":   { warningMinutes: 1560, criticalMinutes: 1800 },
  "tempo-transaction-indexer": { warningMinutes: 480, criticalMinutes: 780 },
};

export async function recordSuccess(taskId: string, taskName: string): Promise<void> {
  const { db } = await import("./db.js");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    INSERT INTO pipeline_health (task_id, task_name, last_success_at, last_run_at, consecutive_failures, circuit_state, updated_at)
    VALUES (${taskId}, ${taskName}, now(), now(), 0, 'closed', now())
    ON CONFLICT (task_id) DO UPDATE SET
      task_name             = EXCLUDED.task_name,
      last_success_at       = now(),
      last_run_at           = now(),
      consecutive_failures  = 0,
      circuit_state         = 'closed',
      updated_at            = now()
  `);
}

export async function recordFailure(taskId: string, taskName: string, error: string): Promise<void> {
  const { db } = await import("./db.js");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    INSERT INTO pipeline_health (task_id, task_name, last_run_at, last_error, consecutive_failures, circuit_state, updated_at)
    VALUES (${taskId}, ${taskName}, now(), ${error}, 1, 'closed', now())
    ON CONFLICT (task_id) DO UPDATE SET
      task_name             = EXCLUDED.task_name,
      last_run_at           = now(),
      last_error            = ${error},
      consecutive_failures  = pipeline_health.consecutive_failures + 1,
      circuit_state         = CASE
        WHEN pipeline_health.consecutive_failures + 1 >= 3 THEN 'open'
        ELSE pipeline_health.circuit_state
      END,
      opened_at             = CASE
        WHEN pipeline_health.consecutive_failures + 1 >= 3
          AND pipeline_health.circuit_state <> 'open'
          THEN now()
        ELSE pipeline_health.opened_at
      END,
      updated_at            = now()
  `);
}

export async function getAllPipelineHealth(): Promise<import("../shared/schema.js").PipelineHealth[]> {
  const { db } = await import("./db.js");
  const { pipelineHealth } = await import("../shared/schema.js");

  const result = await db.select().from(pipelineHealth).orderBy(pipelineHealth.taskId);
  return result;
}

export async function hasOpenCircuit(): Promise<boolean> {
  const { db } = await import("./db.js");
  const { sql } = await import("drizzle-orm");

  const result = await db.execute(sql`
    SELECT 1 FROM pipeline_health WHERE circuit_state = 'open' LIMIT 1
  `);
  return (result.rows?.length ?? 0) > 0;
}
