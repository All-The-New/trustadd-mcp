import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const dbUrl = process.env.DATABASE_URL;
  let dbStatus = "not configured";

  if (dbUrl) {
    try {
      const pg = await import("pg");
      const pool = new pg.default.Pool({
        connectionString: dbUrl,
        max: 1,
        ssl: { rejectUnauthorized: false },
      });
      const result = await pool.query("SELECT count(*)::int as cnt FROM agents");
      dbStatus = `ok, ${result.rows[0].cnt} agents`;
      await pool.end();
    } catch (err: any) {
      dbStatus = `error: ${err.message}`;
    }
  }

  const isHealthy = dbStatus.startsWith("ok");
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "unhealthy",
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
}
