import pg from "pg";

const CHAIN_PREFIXES: Record<number, string> = {
  1: "",
  8453: "base-",
  56: "bnb-",
  137: "polygon-",
  42161: "arb-",
};

function generateSlug(name: string | null, erc8004Id: string, chainId: number): string {
  const prefix = CHAIN_PREFIXES[chainId] ?? `chain${chainId}-`;
  if (name) {
    const base = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    if (base.length >= 2) return `${prefix}${base}-${erc8004Id}`;
  }
  return `${prefix}agent-${erc8004Id}`;
}

function looksLikeImageUrl(url: string): boolean {
  if (!url || url.length < 5) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:image/")) return true;
  const clean = lower.split("?")[0].split("#")[0];
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico", ".bmp"];
  if (imageExtensions.some(ext => clean.endsWith(ext))) return true;
  if (lower.includes("/image") || lower.includes("avatar") || lower.includes("logo")) return true;
  if (lower.includes("ipfs://") || lower.includes("arweave")) return true;
  const knownImageHosts = ["blob.8004scan.app", "r2-image-worker", "gateway.autonolas.tech", "meerkat.town", "cloudflare-ipfs"];
  if (knownImageHosts.some(h => lower.includes(h))) return true;
  return false;
}

function calculateScore(agent: any, feedback: any, eventCount: number, crossChainCount: number) {
  let identity = 0, history = 0, capability = 0, community = 0, transparency = 0;

  if (agent.name && agent.name.trim().length > 0) identity += 5;
  if (agent.description && agent.description.trim().length > 0) {
    const descLen = agent.description.trim().length;
    if (descLen >= 100) identity += 5;
    else if (descLen >= 30) identity += 3;
    else identity += 1;
  }
  if (agent.image_url && looksLikeImageUrl(agent.image_url)) identity += 5;

  const endpoints = agent.endpoints;
  const hasEndpoints = endpoints && (Array.isArray(endpoints) ? endpoints.length > 0 : typeof endpoints === "object" && Object.keys(endpoints).length > 0);
  if (hasEndpoints) identity += 5;

  const tags = agent.tags || [];
  const oasfSkills = agent.oasf_skills || [];
  if (tags.length > 0 || oasfSkills.length > 0) identity += 5;

  const ageDays = (Date.now() - new Date(agent.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays >= 30) history += 10;
  else if (ageDays >= 7) history += 5;
  else if (ageDays >= 1) history += 2;

  if (eventCount >= 2) history += 5;
  else if (eventCount >= 1) history += 2;

  if (crossChainCount >= 3) history += 5;
  else if (crossChainCount >= 2) history += 3;

  if (agent.x402_support === true) capability += 5;

  const oasfDomains = agent.oasf_domains || [];
  const skillCount = oasfSkills.length + oasfDomains.length;
  if (skillCount >= 3) capability += 5;
  else if (skillCount >= 1) capability += 3;

  let endpointCount = 0;
  if (endpoints) {
    if (Array.isArray(endpoints)) endpointCount = endpoints.length;
    else if (typeof endpoints === "object") endpointCount = Object.keys(endpoints).length;
  }
  if (endpointCount >= 3) capability += 5;
  else if (endpointCount >= 1) capability += 3;

  if (feedback) {
    const ghScore = feedback.github_health_score ?? 0;
    if (ghScore >= 70) community += 10;
    else if (ghScore >= 40) community += 6;
    else if (ghScore > 0) community += 3;

    const fcScore = feedback.farcaster_score ?? 0;
    if (fcScore >= 0.7) community += 5;
    else if (fcScore >= 0.4) community += 3;
    else if (fcScore > 0) community += 1;

    if (feedback.total_sources > 0) community += 5;
  }

  const uri = agent.metadata_uri ?? "";
  if (uri.startsWith("ipfs://")) transparency += 8;
  else if (uri.startsWith("ar://")) transparency += 8;
  else if (uri.startsWith("https://")) transparency += 5;
  else if (uri.startsWith("http://")) transparency += 3;
  else if (uri.startsWith("data:")) transparency += 2;

  const supportedTrust = agent.supported_trust || [];
  if (supportedTrust.length >= 3) transparency += 7;
  else if (supportedTrust.length >= 2) transparency += 5;
  else if (supportedTrust.length >= 1) transparency += 3;

  if (agent.active_status === true) transparency += 5;

  const total = identity + history + capability + community + transparency;
  return { total, identity, history, capability, community, transparency };
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.PROD_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  console.log("Connected to production database");

  const { rows: allAgents } = await pool.query("SELECT * FROM agents");
  console.log(`Loaded ${allAgents.length} agents`);

  const feedbackMap = new Map();
  try {
    const { rows: summaries } = await pool.query("SELECT * FROM community_feedback_summaries");
    for (const s of summaries) feedbackMap.set(s.agent_id, s);
    console.log(`Loaded ${summaries.length} community feedback summaries`);
  } catch (e) {
    console.log("No community feedback summaries table or empty");
  }

  const controllerChains = new Map();
  try {
    const { rows } = await pool.query("SELECT controller_address, COUNT(DISTINCT chain_id)::int as cnt FROM agents GROUP BY controller_address HAVING COUNT(DISTINCT chain_id) > 1");
    for (const r of rows) controllerChains.set(r.controller_address, r.cnt);
    console.log(`Found ${rows.length} cross-chain controllers`);
  } catch {}

  const eventCounts = new Map();
  try {
    const { rows } = await pool.query("SELECT agent_id, COUNT(*)::int as cnt FROM agent_metadata_events WHERE event_type IN ('MetadataUpdated', 'AgentURISet') GROUP BY agent_id");
    for (const r of rows) eventCounts.set(r.agent_id, r.cnt);
    console.log(`Found ${rows.length} agents with metadata events`);
  } catch {}

  let updated = 0;
  const now = new Date().toISOString();
  const BATCH = 200;

  for (let i = 0; i < allAgents.length; i += BATCH) {
    const batch = allAgents.slice(i, i + BATCH);
    const cases_score: string[] = [];
    const cases_breakdown: string[] = [];
    const cases_slug: string[] = [];
    const ids: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const agent of batch) {
      const feedback = feedbackMap.get(agent.id) ?? null;
      const evtCount = eventCounts.get(agent.id) ?? 0;
      const crossChain = controllerChains.get(agent.controller_address) ?? 0;
      const breakdown = calculateScore(agent, feedback, evtCount, crossChain);
      const slug = generateSlug(agent.name, agent.erc8004_id, agent.chain_id);

      cases_score.push(`WHEN id = $${paramIdx} THEN ${breakdown.total}`);
      cases_breakdown.push(`WHEN id = $${paramIdx} THEN $${paramIdx + 1}::jsonb`);
      cases_slug.push(`WHEN id = $${paramIdx} THEN $${paramIdx + 2}`);
      ids.push(`$${paramIdx}`);
      params.push(agent.id, JSON.stringify(breakdown), slug);
      paramIdx += 3;
    }

    const sql = `
      UPDATE agents SET
        trust_score = CASE ${cases_score.join(" ")} END,
        trust_score_breakdown = CASE ${cases_breakdown.join(" ")} END,
        trust_score_updated_at = '${now}',
        slug = CASE ${cases_slug.join(" ")} END
      WHERE id IN (${ids.join(",")})
    `;

    await pool.query(sql, params);
    updated += batch.length;

    if (updated % 2000 === 0 || updated === allAgents.length) {
      console.log(`Progress: ${updated}/${allAgents.length}`);
    }
  }

  console.log(`Done! Updated ${updated} agents`);

  const { rows: top } = await pool.query("SELECT name, trust_score, slug FROM agents WHERE trust_score IS NOT NULL ORDER BY trust_score DESC LIMIT 10");
  console.log("\nTop 10 agents:");
  top.forEach((r, i) => console.log(`  #${i + 1}: ${r.name} — score ${r.trust_score}, slug: ${r.slug}`));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
