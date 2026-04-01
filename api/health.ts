import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const dbUrl = process.env.DATABASE_URL;
  const hasDb = !!dbUrl;
  const dbHost = dbUrl ? new URL(dbUrl).hostname : "not set";
  const dbPort = dbUrl ? new URL(dbUrl).port : "not set";
  const dbUser = dbUrl ? new URL(dbUrl).username : "not set";

  let dbStatus = "not tested";
  if (hasDb) {
    try {
      const pg = await import("pg");
      const pool = new pg.default.Pool({ connectionString: dbUrl, max: 1, ssl: { rejectUnauthorized: false } });
      const result = await pool.query("SELECT count(*)::int as cnt FROM agents");
      dbStatus = `connected, ${result.rows[0].cnt} agents`;
      await pool.end();
    } catch (err: any) {
      dbStatus = `error: ${err.message}`;
    }
  }

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: { hasUrl: hasDb, host: dbHost, port: dbPort, user: dbUser, status: dbStatus },
  });
}
