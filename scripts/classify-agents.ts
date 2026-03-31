import pg from "pg";
import { classifyAgent, computeFingerprint } from "../server/quality-classifier.js";

const connString = process.env.PROD_DATABASE_URL;
if (!connString) {
  console.error("PROD_DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });

async function query(sql: string, params?: unknown[]) {
  const r = await pool.query(sql, params);
  return r.rows;
}

async function main() {
  console.log("========================================");
  console.log("  TRUSTADD AGENT QUALITY CLASSIFIER");
  console.log(`  ${new Date().toISOString()}`);
  console.log("========================================\n");

  const [totalRow] = await query("SELECT COUNT(*) as cnt FROM agents");
  const total = parseInt(totalRow.cnt, 10);
  console.log(`Total agents to classify: ${total}\n`);

  console.log("Step 1: Finding duplicate template fingerprints (>50 controllers sharing same URI)...");
  const dupRows = await query(`
    SELECT
      md5(metadata_uri) as fingerprint_check,
      encode(sha256(convert_to(metadata_uri, 'UTF8')), 'hex') as full_hash,
      substring(encode(sha256(convert_to(metadata_uri, 'UTF8')), 'hex'), 1, 16) as fingerprint,
      COUNT(DISTINCT controller_address) as controller_count,
      COUNT(*) as agent_count
    FROM agents
    WHERE metadata_uri IS NOT NULL AND metadata_uri != ''
    GROUP BY metadata_uri
    HAVING COUNT(DISTINCT controller_address) > 50
    ORDER BY controller_count DESC
  `);

  const duplicateFingerprints = new Set<string>();
  if (dupRows.length > 0) {
    console.log(`Found ${dupRows.length} duplicate templates (shared by >50 controllers):`);
    for (const row of dupRows) {
      duplicateFingerprints.add(row.fingerprint);
      console.log(`  fingerprint ${row.fingerprint} — ${row.controller_count} controllers, ${row.agent_count} agents`);
    }
  } else {
    console.log("  No duplicate templates found.");
  }
  console.log();

  console.log("Step 2: Classifying all agents in batches of 1000...");

  const tierCounts: Record<string, number> = { high: 0, medium: 0, low: 0, spam: 0, archived: 0, unclassified: 0 };
  const flagCounts: Record<string, number> = {};
  let processed = 0;
  let batchOffset = 0;
  const BATCH_SIZE = 1000;

  while (batchOffset < total) {
    const rows = await query(
      `SELECT id, name, description, metadata_uri, trust_score, created_at
       FROM agents
       ORDER BY created_at
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, batchOffset]
    );

    if (rows.length === 0) break;

    const updates: Array<{
      id: string;
      qualityTier: string;
      spamFlags: string[];
      lifecycleStatus: string;
      metadataFingerprint: string | null;
      nextEnrichmentAt: Date;
    }> = [];

    for (const row of rows) {
      const agent = {
        name: row.name,
        description: row.description,
        metadataUri: row.metadata_uri,
        trustScore: row.trust_score ? parseInt(row.trust_score, 10) : 0,
        createdAt: new Date(row.created_at),
      };

      const result = classifyAgent(agent, duplicateFingerprints);
      tierCounts[result.qualityTier] = (tierCounts[result.qualityTier] ?? 0) + 1;
      for (const flag of result.spamFlags) {
        flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
      }

      updates.push({ id: row.id, ...result });
    }

    if (updates.length > 0) {
      const values: unknown[] = [];
      const placeholders = updates.map((u, i) => {
        const base = i * 6;
        values.push(u.id, u.qualityTier, u.spamFlags, u.lifecycleStatus, u.metadataFingerprint, u.nextEnrichmentAt);
        return `($${base + 1}, $${base + 2}, $${base + 3}::text[], $${base + 4}, $${base + 5}, $${base + 6}::timestamp)`;
      });
      await query(
        `UPDATE agents SET
          quality_tier = v.quality_tier,
          spam_flags = v.spam_flags,
          lifecycle_status = v.lifecycle_status,
          metadata_fingerprint = v.metadata_fingerprint,
          next_enrichment_at = v.next_enrichment_at,
          last_quality_evaluated_at = NOW()
         FROM (VALUES ${placeholders.join(", ")}) AS v(id, quality_tier, spam_flags, lifecycle_status, metadata_fingerprint, next_enrichment_at)
         WHERE agents.id = v.id`,
        values
      );
    }

    processed += rows.length;
    batchOffset += BATCH_SIZE;

    if (processed % 5000 === 0 || processed >= total) {
      console.log(`  Classified ${processed}/${total} agents...`);
    }
  }

  console.log("\n========================================");
  console.log("  CLASSIFICATION SUMMARY");
  console.log("========================================\n");

  console.log("Quality tiers:");
  const tierOrder = ["high", "medium", "low", "spam", "archived", "unclassified"];
  for (const tier of tierOrder) {
    const count = tierCounts[tier] ?? 0;
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
    console.log(`  ${tier.padEnd(12)} ${String(count).padStart(6)} (${pct}%)`);
  }

  if (Object.keys(flagCounts).length > 0) {
    console.log("\nSpam flags:");
    for (const [flag, count] of Object.entries(flagCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${flag.padEnd(20)} ${String(count).padStart(6)}`);
    }
  }

  const dueRows = await query(
    "SELECT COUNT(*) as cnt FROM agents WHERE next_enrichment_at <= NOW() OR next_enrichment_at IS NULL"
  );
  console.log(`\nAgents due for re-enrichment now: ${dueRows[0].cnt}`);

  await pool.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
