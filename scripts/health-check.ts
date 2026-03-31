import pg from "pg";

const connString = process.env.PROD_DATABASE_URL;
if (!connString) {
  console.error("PROD_DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });

interface HealthIssue {
  severity: "CRITICAL" | "WARNING" | "INFO";
  component: string;
  message: string;
}

async function query(sql: string) {
  const r = await pool.query(sql);
  return r.rows;
}

async function checkAgentIndex(): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  const [stats] = await query(`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE trust_score IS NOT NULL) as scored,
           ROUND(AVG(trust_score)::numeric, 1) as avg_score,
           MAX(created_at) as newest
    FROM agents
  `);

  const chains = await query(`
    SELECT chain_id, COUNT(*) as cnt, MAX(created_at) as newest
    FROM agents GROUP BY chain_id ORDER BY cnt DESC
  `);

  const recent = await query(`
    SELECT name, chain_id, created_at FROM agents ORDER BY created_at DESC LIMIT 5
  `);

  const growth = await query(`
    SELECT DATE(created_at) as date, COUNT(*) as n
    FROM agents WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at) ORDER BY date DESC
  `);

  const scoreRange = await query(`
    SELECT MIN(trust_score) as min_score, MAX(trust_score) as max_score,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY trust_score) as median
    FROM agents WHERE trust_score IS NOT NULL
  `);

  console.log("\n--- AGENT INDEX ---");

  if (Number(stats.total) === 0) {
    console.log("  No agents in database");
    issues.push({ severity: "CRITICAL", component: "Blockchain Indexer", message: "No agents found in database" });
    return issues;
  }

  console.log(`Total agents:      ${stats.total}`);
  console.log(`With trust score:  ${stats.scored}`);
  console.log(`Avg trust score:   ${stats.avg_score}`);
  console.log(`Score range:       ${scoreRange[0].min_score} - ${scoreRange[0].max_score} (median: ${Math.round(scoreRange[0].median)})`);
  console.log(`Newest agent:      ${new Date(stats.newest).toISOString()}`);

  const chainNames: Record<number, string> = { 1: "Ethereum", 8453: "Base", 137: "Polygon", 42161: "Arbitrum", 56: "BNB" };
  console.log("\n  Chain breakdown:");
  for (const c of chains) {
    const age = Math.round((Date.now() - new Date(c.newest).getTime()) / 60000);
    console.log(`    ${chainNames[c.chain_id] || c.chain_id}: ${c.cnt} agents (newest ${age}min ago)`);
  }

  console.log("\n  Recent discoveries:");
  for (const r of recent) {
    const age = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000);
    console.log(`    ${r.name || "unnamed"} (chain ${r.chain_id}, ${age}min ago)`);
  }

  console.log("\n  Growth (7 days):");
  for (const g of growth) {
    console.log(`    ${g.date.toISOString().slice(0, 10)}: +${g.n}`);
  }

  const newestAge = Math.round((Date.now() - new Date(stats.newest).getTime()) / 60000);
  if (newestAge > 120) {
    issues.push({ severity: "CRITICAL", component: "Blockchain Indexer", message: `No new agents discovered in ${newestAge} minutes` });
  } else if (newestAge > 60) {
    issues.push({ severity: "WARNING", component: "Blockchain Indexer", message: `No new agents discovered in ${newestAge} minutes` });
  }

  const scorePct = Math.round((Number(stats.scored) / Number(stats.total)) * 100);
  if (scorePct < 90) {
    issues.push({ severity: "WARNING", component: "Trust Score", message: `Only ${scorePct}% of agents have trust scores` });
  }

  return issues;
}

async function checkTransactionIndexer(): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  const [txStats] = await query(`
    SELECT COUNT(*) as total,
           COALESCE(SUM(amount_usd),0)::float as volume,
           COUNT(DISTINCT from_address) as buyers,
           COUNT(DISTINCT agent_id) as agents_with_tx
    FROM agent_transactions
  `);

  const tokens = await query(`
    SELECT token_symbol, COUNT(*) as cnt, COALESCE(SUM(amount_usd),0)::float as vol
    FROM agent_transactions GROUP BY token_symbol ORDER BY cnt DESC
  `);

  const syncs = await query(`
    SELECT payment_address, chain_id, last_synced_block, last_synced_at
    FROM transaction_sync_state ORDER BY last_synced_at DESC
  `);

  console.log("\n--- TRANSACTION INDEXER ---");
  console.log(`Total transactions: ${txStats.total}`);
  console.log(`Stablecoin volume:  $${Number(txStats.volume).toFixed(2)}`);
  console.log(`Unique buyers:      ${txStats.buyers}`);
  console.log(`Agents with txns:   ${txStats.agents_with_tx}`);

  console.log("\n  Token breakdown:");
  for (const t of tokens) {
    console.log(`    ${t.token_symbol}: ${t.cnt} txns, $${Number(t.vol).toFixed(2)}`);
  }

  if (syncs.length === 0) {
    console.log("\n  No sync state entries — transaction indexer may not have run yet");
    issues.push({ severity: "WARNING", component: "TX Indexer", message: "No sync state entries found" });
    return issues;
  }

  console.log("\n  Sync state:");
  let staleCount = 0;
  let veryStaleCount = 0;
  for (const s of syncs) {
    const age = Math.round((Date.now() - new Date(s.last_synced_at).getTime()) / 60000);
    let status = "OK";
    if (age > 780) { status = "VERY STALE"; veryStaleCount++; }   // >13h = two missed 6h cycles
    else if (age > 480) { status = "STALE"; staleCount++; }        // >8h = one missed 6h cycle + buffer
    console.log(`    ${s.payment_address.slice(0, 12)}... chain ${s.chain_id} block ${s.last_synced_block} (${age}min ago) [${status}]`);
  }

  if (veryStaleCount > syncs.length * 0.5) {
    issues.push({ severity: "CRITICAL", component: "TX Indexer", message: `${veryStaleCount}/${syncs.length} addresses very stale (>13h) — sync may be failing` });
  } else if (staleCount > syncs.length * 0.5) {
    issues.push({ severity: "WARNING", component: "TX Indexer", message: `${staleCount}/${syncs.length} addresses stale (>8h)` });
  }

  const dustCount = await query(`SELECT COUNT(*) as cnt FROM agent_transactions WHERE token_symbol = 'ETH' AND CAST(amount AS FLOAT) < 0.001`);
  if (Number(dustCount[0].cnt) > 0) {
    issues.push({ severity: "INFO", component: "TX Indexer", message: `${dustCount[0].cnt} dust ETH transactions still in DB` });
  }

  return issues;
}

async function checkProber(): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  const [stats] = await query(`
    SELECT COUNT(*) as total, COUNT(DISTINCT agent_id) as agents_probed,
           COUNT(DISTINCT payment_address) FILTER (WHERE payment_address IS NOT NULL) as payment_addrs,
           MAX(probed_at) as last_probe
    FROM x402_probes
  `);

  console.log("\n--- X402 PROBER ---");
  console.log(`Total probes:       ${stats.total}`);
  console.log(`Agents probed:      ${stats.agents_probed}`);
  console.log(`Payment addresses:  ${stats.payment_addrs}`);
  console.log(`Last probe:         ${stats.last_probe ? new Date(stats.last_probe).toISOString() : "never"}`);

  if (stats.last_probe) {
    const probeAge = Math.round((Date.now() - new Date(stats.last_probe).getTime()) / 60000);
    if (probeAge > 1500) {
      issues.push({ severity: "WARNING", component: "x402 Prober", message: `Last probe was ${Math.round(probeAge / 60)}h ago (expected every 24h)` });
    }
  } else {
    issues.push({ severity: "WARNING", component: "x402 Prober", message: "Prober has never run" });
  }

  return issues;
}

async function checkChainStatus(): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  const chainNames: Record<number, string> = { 1: "Ethereum", 8453: "Base", 137: "Polygon", 42161: "Arbitrum", 56: "BNB" };
  const enabledChains = [1, 8453, 137, 42161, 56];

  const states = await query(`
    SELECT chain_id, is_running, last_error, last_processed_block, updated_at
    FROM indexer_state
    WHERE chain_id = ANY(ARRAY[1, 8453, 137, 42161, 56])
    ORDER BY chain_id
  `);

  console.log("\n--- CHAIN STATUS ---");

  for (const chainId of enabledChains) {
    const name = chainNames[chainId] || `chain-${chainId}`;
    const state = states.find((s: any) => s.chain_id === chainId);

    if (!state) {
      console.log(`  ${name}: no state record`);
      issues.push({ severity: "WARNING", component: `Chain:${name}`, message: `${name} has no indexer state record` });
      continue;
    }

    const ageMin = Math.round((Date.now() - new Date(state.updated_at).getTime()) / 60000);
    const running = state.is_running ? "running" : "NOT RUNNING";
    const lastErr = state.last_error ? ` | last error: ${state.last_error.slice(0, 60)}` : "";
    console.log(`  ${name}: ${running}, block ${state.last_processed_block}, updated ${ageMin}min ago${lastErr}`);

    if (!state.is_running) {
      if (ageMin > 60) {
        issues.push({ severity: "CRITICAL", component: `Chain:${name}`, message: `${name} indexer not running, last updated ${ageMin}min ago` });
      } else {
        issues.push({ severity: "WARNING", component: `Chain:${name}`, message: `${name} indexer not running (may be recovering, last updated ${ageMin}min ago)` });
      }
    } else if (ageMin > 45) {
      issues.push({ severity: "WARNING", component: `Chain:${name}`, message: `${name} indexer state stale — last updated ${ageMin}min ago` });
    }
  }

  return issues;
}

async function checkCommunityFeedback(): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  const [stats] = await query(`
    SELECT (SELECT COUNT(*) FROM community_feedback_sources) as sources,
           (SELECT COUNT(*) FROM community_feedback_items) as items,
           (SELECT COUNT(*) FROM community_feedback_summaries) as summaries
  `);

  console.log("\n--- COMMUNITY FEEDBACK ---");
  console.log(`Sources:     ${stats.sources}`);
  console.log(`Items:       ${stats.items}`);
  console.log(`Summaries:   ${stats.summaries}`);

  return issues;
}

async function checkStorage(): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  const [sizes] = await query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size,
           pg_size_pretty(pg_total_relation_size('agents')) as agents_size,
           pg_size_pretty(pg_total_relation_size('agent_metadata_events')) as events_size,
           pg_size_pretty(pg_total_relation_size('agent_transactions')) as tx_size,
           pg_size_pretty(pg_total_relation_size('x402_probes')) as probes_size,
           pg_database_size(current_database()) as db_bytes
  `);

  console.log("\n--- STORAGE ---");
  console.log(`Database total: ${sizes.db_size}`);
  console.log(`  Agents:       ${sizes.agents_size}`);
  console.log(`  Events:       ${sizes.events_size}`);
  console.log(`  Transactions: ${sizes.tx_size}`);
  console.log(`  Probes:       ${sizes.probes_size}`);

  const dbMB = Number(sizes.db_bytes) / 1024 / 1024;
  if (dbMB > 400) {
    issues.push({ severity: "WARNING", component: "Storage", message: `Database is ${Math.round(dbMB)}MB — approaching Neon free tier limits` });
  }

  return issues;
}

async function checkQualityTiers(): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  const tiers = await query(`
    SELECT
      COALESCE(quality_tier, 'unclassified') as tier,
      COUNT(*) as cnt
    FROM agents
    GROUP BY quality_tier
    ORDER BY cnt DESC
  `);

  const total = tiers.reduce((sum: number, r: { cnt: string }) => sum + parseInt(r.cnt, 10), 0);
  const unclassified = tiers.find((r: { tier: string }) => r.tier === "unclassified");
  const unclassifiedCount = unclassified ? parseInt(unclassified.cnt, 10) : 0;

  console.log("\n--- QUALITY TIERS ---");
  for (const r of tiers) {
    const pct = total > 0 ? ((parseInt(r.cnt, 10) / total) * 100).toFixed(1) : "0.0";
    console.log(`  ${r.tier.padEnd(12)} ${String(r.cnt).padStart(6)} (${pct}%)`);
  }

  const dueRows = await query(
    "SELECT COUNT(*) as cnt FROM agents WHERE next_enrichment_at IS NULL OR next_enrichment_at <= NOW()"
  );
  console.log(`  Due for re-enrichment: ${dueRows[0].cnt}`);

  const flagRows = await query(`
    SELECT flag, COUNT(*) as cnt
    FROM agents, unnest(spam_flags) as flag
    WHERE spam_flags IS NOT NULL AND array_length(spam_flags, 1) > 0
    GROUP BY flag
    ORDER BY cnt DESC
  `);
  if (flagRows.length > 0) {
    console.log("\n  Top spam flags:");
    for (const r of flagRows) {
      console.log(`    ${r.flag.padEnd(20)} ${r.cnt}`);
    }
  }

  if (unclassifiedCount > 1000) {
    issues.push({ severity: "WARNING", component: "Quality", message: `${unclassifiedCount} agents unclassified — run classify-agents.ts` });
  }

  return issues;
}

async function run() {
  console.log("========================================");
  console.log("  TRUSTADD PRODUCTION HEALTH CHECK");
  console.log(`  ${new Date().toISOString()}`);
  console.log("========================================");

  const allIssues: HealthIssue[] = [];

  allIssues.push(...await checkAgentIndex());
  allIssues.push(...await checkQualityTiers());
  allIssues.push(...await checkChainStatus());
  allIssues.push(...await checkTransactionIndexer());
  allIssues.push(...await checkProber());
  allIssues.push(...await checkCommunityFeedback());
  allIssues.push(...await checkStorage());

  console.log("\n========================================");
  console.log("  HEALTH SUMMARY");
  console.log("========================================");

  const critical = allIssues.filter(i => i.severity === "CRITICAL");
  const warnings = allIssues.filter(i => i.severity === "WARNING");
  const info = allIssues.filter(i => i.severity === "INFO");

  if (critical.length === 0 && warnings.length === 0) {
    console.log("\n  ✅ ALL SYSTEMS HEALTHY\n");
  }

  if (critical.length > 0) {
    console.log("\n  🔴 CRITICAL:");
    for (const i of critical) console.log(`     [${i.component}] ${i.message}`);
  }
  if (warnings.length > 0) {
    console.log("\n  🟡 WARNINGS:");
    for (const i of warnings) console.log(`     [${i.component}] ${i.message}`);
  }
  if (info.length > 0) {
    console.log("\n  🔵 INFO:");
    for (const i of info) console.log(`     [${i.component}] ${i.message}`);
  }

  console.log("");
  await pool.end();
  process.exit(critical.length > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Health check failed:", e.message);
  process.exit(1);
});
