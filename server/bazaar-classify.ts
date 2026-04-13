/**
 * Simple keyword-based categorization for x402 Bazaar services.
 * Classifies services based on their description and resource URL.
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  ai: [
    "ai", "llm", "gpt", "inference", "model", "neural", "embedding",
    "chat", "completion", "openai", "anthropic", "gemini", "mistral",
    "summarize", "classify", "sentiment", "translate", "prompt",
  ],
  data: [
    "data", "market", "price", "weather", "news", "search", "twitter",
    "social", "feed", "stock", "crypto", "analytics", "intelligence",
    "mention", "trend", "monitor", "track", "scrape", "crawl", "extract",
  ],
  compute: [
    "compute", "gpu", "render", "process", "execute", "sandbox",
    "code", "compile", "runtime", "function", "lambda", "worker",
  ],
  blockchain: [
    "blockchain", "token", "swap", "defi", "nft", "wallet", "chain",
    "bridge", "transaction", "contract", "solidity", "evm", "onchain",
    "on-chain", "web3",
  ],
  content: [
    "content", "image", "video", "audio", "generate", "create",
    "media", "photo", "music", "voice", "tts", "speech", "ocr",
  ],
  utility: [
    "routing", "discovery", "health", "scan", "validate", "monitor",
    "dns", "proxy", "gateway", "webhook", "notification", "email",
    "sms", "storage", "file", "upload",
  ],
};

export function classifyService(description: string | null | undefined, resourceUrl: string): string {
  const text = `${description ?? ""} ${resourceUrl}`.toLowerCase();

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

  return bestCategory;
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
    // Take first 120 chars
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
 * USDC has 6 decimals, so divide by 1e6.
 */
export function rawAmountToUsd(rawAmount: string | null | undefined, assetName: string | null | undefined): number | null {
  if (!rawAmount) return null;
  const amount = Number(rawAmount);
  if (isNaN(amount) || amount <= 0) return null;

  // USDC and most stablecoins on Base use 6 decimals
  return amount / 1e6;
}
