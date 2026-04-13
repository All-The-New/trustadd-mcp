import type { VercelRequest, VercelResponse } from "@vercel/node";

const BASE_URL = "https://trustadd.com";
const DEFAULT_TITLE = "TrustAdd \u2014 The Trust Oracle for the Agent Economy";
const DEFAULT_DESC =
  "TrustAdd is the trust oracle for AI agents. We index identity, payments, and reputation across 9 EVM chains into queryable trust verdicts \u2014 from $0.01 per query via x402.";

// Cache the HTML template in module scope (warm serverless instances reuse it)
let htmlTemplate: string | null = null;

async function getTemplate(host: string): Promise<string> {
  if (htmlTemplate) return htmlTemplate;
  // Fetch the static index.html from our own deployment.
  // The /_seo_base path hits the SPA catch-all which serves index.html.
  const protocol = host.includes("localhost") ? "http" : "https";
  const resp = await fetch(`${protocol}://${host}/index.html`);
  if (!resp.ok) throw new Error(`Failed to fetch template: ${resp.status}`);
  htmlTemplate = await resp.text();
  return htmlTemplate;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}

interface AgentRow {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  erc8004Id: string;
  chainId: number;
  trustScore: number | null;
  qualityTier: string | null;
  spamFlags: string[] | null;
  lifecycleStatus: string | null;
  imageUrl: string | null;
  primaryContractAddress: string | null;
}

type Verdict = "TRUSTED" | "CAUTION" | "UNTRUSTED" | "UNKNOWN";

// Aligned with server/trust-report-compiler.ts computeVerdict
function computeVerdict(agent: AgentRow): Verdict {
  const { trustScore, qualityTier, spamFlags, lifecycleStatus } = agent;
  const flags = spamFlags ?? [];
  const status = lifecycleStatus ?? "active";

  if (trustScore == null) return "UNKNOWN";
  if (qualityTier === "spam" || qualityTier === "archived") return "UNTRUSTED";
  if (status === "archived") return "UNTRUSTED";
  if (trustScore < 30) return "UNTRUSTED";
  if (trustScore >= 60 && (qualityTier === "high" || qualityTier === "medium") && flags.length === 0) {
    return "TRUSTED";
  }
  return "CAUTION";
}

async function fetchAgent(idOrSlug: string): Promise<AgentRow | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  const pg = await import("pg");
  const pool = new pg.default.Pool({
    connectionString: dbUrl,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Try UUID first, then slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const cols = `id, name, slug, description, erc8004_id as "erc8004Id", chain_id as "chainId", trust_score as "trustScore", quality_tier as "qualityTier", spam_flags as "spamFlags", lifecycle_status as "lifecycleStatus", image_url as "imageUrl", primary_contract_address as "primaryContractAddress"`;
    const query = isUuid
      ? `SELECT ${cols} FROM agents WHERE id = $1 LIMIT 1`
      : `SELECT ${cols} FROM agents WHERE slug = $1 LIMIT 1`;

    const result = await pool.query(query, [idOrSlug]);
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

// Minimal chain name lookup (avoids importing full shared/chains.ts with all its deps)
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  10: "Optimism",
  137: "Polygon",
  100: "Gnosis",
  42220: "Celo",
  43114: "Avalanche",
  56: "BNB Chain",
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function injectAgentMeta(html: string, agent: AgentRow): string {
  const chainName = CHAIN_NAMES[agent.chainId] ?? "EVM";
  const agentName = agent.name ?? `Agent #${agent.erc8004Id}`;
  const title = escapeHtml(`${agentName} \u2014 Agent Profile | TrustAdd`);
  const verdict = computeVerdict(agent);
  const verdictSuffix = verdict !== "UNKNOWN" ? ` Verdict: ${verdict}.` : "";
  const baseDesc = agent.description ?? `AI agent #${agent.erc8004Id} on ${chainName}. Trust verdict, score breakdown, and on-chain history from TrustAdd.`;
  const description = escapeHtml(truncate(baseDesc + verdictSuffix, 160));
  const canonicalSlug = agent.slug ?? agent.id;
  const rawCanonicalUrl = `${BASE_URL}/agent/${canonicalSlug}`;
  const canonicalUrl = escapeHtml(rawCanonicalUrl);

  // Replace title
  html = html.replace(
    `<title>${DEFAULT_TITLE}</title>`,
    `<title>${title}</title>`,
  );

  // Replace meta descriptions (all instances)
  html = html.replace(
    new RegExp(escapeRegExp(DEFAULT_DESC), "g"),
    description,
  );

  // Replace og:title
  html = html.replace(
    `<meta property="og:title" content="${DEFAULT_TITLE}" />`,
    `<meta property="og:title" content="${title}" />`,
  );

  // Replace og:url
  html = html.replace(
    `<meta property="og:url" content="${BASE_URL}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
  );

  // Replace og:image if agent has a custom one
  if (agent.imageUrl) {
    const safeImage = escapeHtml(agent.imageUrl);
    html = html.replace(
      `<meta property="og:image" content="${BASE_URL}/og-image.png" />`,
      `<meta property="og:image" content="${safeImage}" />`,
    );
    html = html.replace(
      `<meta name="twitter:image" content="${BASE_URL}/og-image.png" />`,
      `<meta name="twitter:image" content="${safeImage}" />`,
    );
  }

  // Replace twitter:title
  html = html.replace(
    `<meta name="twitter:title" content="${DEFAULT_TITLE}" />`,
    `<meta name="twitter:title" content="${title}" />`,
  );

  // Build JSON-LD structured data
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: agentName,
    description: agent.description ?? `An AI agent on ${chainName} indexed by the TrustAdd oracle.`,
    url: rawCanonicalUrl,
    applicationCategory: "AI Agent",
    operatingSystem: chainName,
  };
  if (agent.primaryContractAddress) {
    jsonLd.identifier = agent.primaryContractAddress;
  }

  // Inject canonical link + JSON-LD before </head>
  const extraHead = [
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
  ].join("\n    ");

  html = html.replace("</head>", `    ${extraHead}\n  </head>`);

  return html;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security headers
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "trustadd.com";
  const idOrSlug = req.query.id as string;

  let html: string;
  try {
    html = await getTemplate(host);
  } catch (err) {
    console.error("Failed to load HTML template:", (err as Error).message);
    return res.status(500).send("Internal Server Error");
  }

  if (!idOrSlug) {
    return res.status(200).send(html);
  }

  try {
    const agent = await fetchAgent(idOrSlug);
    if (agent) {
      html = injectAgentMeta(html, agent);
    }
    // If agent not found, serve with homepage defaults — SPA will render 404
  } catch (err) {
    // On DB error, serve unmodified template — SPA will handle rendering
    console.error("SSR meta injection failed:", (err as Error).message);
  }

  return res.status(200).send(html);
}
