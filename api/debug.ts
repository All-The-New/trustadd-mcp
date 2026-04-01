import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../server/db.js";
import { agents } from "../shared/schema.js";
import { sql, desc } from "drizzle-orm";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Test 1: Simple count
    const countResult = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(agents);

    // Test 2: Fetch agents with limit (what the API does)
    const agentList = await db.select().from(agents).limit(2).orderBy(desc(agents.createdAt));

    res.status(200).json({
      status: "ok",
      count: countResult[0].count,
      sampleAgents: agentList.map(a => ({ id: a.id, name: a.name, chainId: a.chainId })),
    });
  } catch (err: any) {
    res.status(500).json({
      error: err.message,
      code: err.code,
      stack: err.stack?.split("\n").slice(0, 5),
    });
  }
}
