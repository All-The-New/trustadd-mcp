import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../server/db.js";
import { agents, agentMetadataEvents } from "../shared/schema.js";
import { sql, desc } from "drizzle-orm";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const results: Record<string, any> = {};

  // Test 1: Simple count (works)
  try {
    const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(agents);
    results.test1_count = { ok: true, count: r.count };
  } catch (err: any) {
    results.test1_count = { ok: false, error: err.message };
  }

  // Test 2: Complex analytics query (the one that fails)
  try {
    const [r] = await db.select({
      totalAgents: sql<number>`count(*)::int`,
      withMetadata: sql<number>`count(*) filter (where ${agents.name} is not null)::int`,
      x402Enabled: sql<number>`count(*) filter (where ${agents.x402Support} = true)::int`,
    }).from(agents);
    results.test2_analytics = { ok: true, data: r };
  } catch (err: any) {
    results.test2_analytics = { ok: false, error: err.message, code: err.code };
  }

  // Test 3: Subquery (crossChainControllers)
  try {
    const [r] = await db.select({
      cnt: sql<number>`count(*)::int`,
    }).from(
      sql`(select ${agents.controllerAddress} from ${agents} group by ${agents.controllerAddress} having count(distinct ${agents.chainId}) > 1) sub`
    );
    results.test3_subquery = { ok: true, count: r.cnt };
  } catch (err: any) {
    results.test3_subquery = { ok: false, error: err.message, code: err.code };
  }

  // Test 4: Events query
  try {
    const [r] = await db.select({
      cnt: sql<number>`count(*)::int`,
    }).from(agentMetadataEvents);
    results.test4_events = { ok: true, count: r.cnt };
  } catch (err: any) {
    results.test4_events = { ok: false, error: err.message, code: err.code };
  }

  // Test 5: Raw query (bypasses Drizzle prepared statements)
  try {
    const { getDbPool } = await import("../server/db.js");
    const pool = getDbPool();
    const r = await pool.query("SELECT count(*)::int as cnt FROM agents WHERE x402_support = true");
    results.test5_raw = { ok: true, count: r.rows[0].cnt };
  } catch (err: any) {
    results.test5_raw = { ok: false, error: err.message, code: err.code };
  }

  res.status(200).json(results);
}
