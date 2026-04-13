/**
 * Keyword-based categorization for x402 Bazaar services.
 * Classifies services based on description, URL path segments, and domain.
 *
 * Two-pass approach:
 * 1. Score against keyword lists using description + URL text
 * 2. If still "other", try URL path segment matching as a fallback
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  ai: [
    "ai", "llm", "gpt", "inference", "model", "neural", "embedding",
    "chat", "completion", "openai", "anthropic", "gemini", "mistral",
    "summarize", "classify", "sentiment", "translate", "prompt",
    "agent", "copilot", "assistant", "reasoning", "rag",
  ],
  data: [
    "data", "market", "price", "weather", "news", "search", "twitter",
    "social", "feed", "stock", "crypto", "analytics", "intelligence",
    "mention", "trend", "monitor", "track", "scrape", "crawl", "extract",
    "query", "lookup", "fetch", "report", "insight", "signal",
    "earnings", "portfolio", "holdings", "finance",
  ],
  compute: [
    "compute", "gpu", "render", "process", "execute", "sandbox",
    "code", "compile", "runtime", "function", "lambda", "worker",
    "container", "docker", "wasm",
  ],
  blockchain: [
    "blockchain", "token", "swap", "defi", "nft", "wallet", "chain",
    "bridge", "transaction", "contract", "solidity", "evm", "onchain",
    "on-chain", "web3", "mint", "dex", "airdrop", "staking", "yield",
    "lending", "vault", "liquidity", "erc20", "erc-20", "usdc",
  ],
  content: [
    "content", "image", "video", "audio", "generate", "create",
    "media", "photo", "music", "voice", "tts", "speech", "ocr",
    "article", "post", "blog", "write", "story", "poem",
  ],
  utility: [
    "routing", "discovery", "health", "scan", "validate", "monitor",
    "dns", "proxy", "gateway", "webhook", "notification", "email",
    "sms", "storage", "file", "upload", "ping", "status", "check",
    "verify", "test", "debug", "log",
  ],
  finance: [
    "payment", "invoice", "billing", "subscription", "charge",
    "transfer", "wire", "ach", "stripe", "payroll", "salary",
    "accounting", "tax", "expense", "budget", "revenue",
    "customer", "order", "cart", "checkout", "receipt",
    "aml", "kyc", "compliance", "fraud",
  ],
};

// URL path segments that strongly indicate a category
const PATH_KEYWORDS: Record<string, string[]> = {
  finance: [
    "salary", "payment", "charge", "transfer", "wire", "ach",
    "invoice", "billing", "subscription", "stripe", "customer",
    "order", "cart", "checkout", "employee", "payroll", "expense",
    "aml", "kyc", "hipaa", "ehr", "medical",
  ],
  data: [
    "earnings", "portfolio", "holdings", "finance", "product",
    "trade", "report", "feed", "search", "query", "record",
  ],
  blockchain: [
    "swap", "mint", "token", "nft", "bridge", "dex", "stake",
    "vault", "liquidity",
  ],
  ai: [
    "agent", "chat", "completion", "inference", "model", "prompt",
    "embedding",
  ],
  content: [
    "article", "post", "blog", "image", "video", "media",
    "gated",
  ],
  utility: [
    "ping", "health", "status", "scan", "validate", "discover",
  ],
};

export function classifyService(description: string | null | undefined, resourceUrl: string): string {
  const text = `${description ?? ""} ${resourceUrl}`.toLowerCase();

  // Pass 1: keyword scoring on full text
  let bestCategory = "other";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // If we got a match, return it
  if (bestScore > 0) return bestCategory;

  // Pass 2: URL path segment matching for services with generic/empty descriptions
  try {
    const url = new URL(resourceUrl);
    const pathLower = url.pathname.toLowerCase();
    for (const [category, segments] of Object.entries(PATH_KEYWORDS)) {
      for (const seg of segments) {
        if (pathLower.includes(seg)) {
          return category;
        }
      }
    }
  } catch {
    // Invalid URL, skip
  }

  return "other";
}

/**
 * Extract a human-readable name from a service description or URL.
 */
export function extractServiceName(description: string | null | undefined, resourceUrl: string): string {
  // Try to extract from description — take first sentence or phrase before "|"
  if (description) {
    const cleaned = description.split("|")[0].trim();
    if (cleaned.length > 0 && cleaned.length <= 120) {
      return cleaned;
    }
    if (cleaned.length > 120) {
      return cleaned.slice(0, 117) + "...";
    }
  }

  // Fall back to URL path extraction
  try {
    const url = new URL(resourceUrl);
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1].replace(/[-_]/g, " ");
    }
    return url.hostname;
  } catch {
    return resourceUrl.slice(0, 80);
  }
}

/**
 * Convert raw maxAmountRequired to USD price.
 * USDC and most stablecoins on Base use 6 decimals.
 */
export function rawAmountToUsd(rawAmount: string | null | undefined, _assetName: string | null | undefined): number | null {
  if (!rawAmount) return null;
  const amount = Number(rawAmount);
  if (isNaN(amount) || amount <= 0) return null;
  return amount / 1e6;
}
