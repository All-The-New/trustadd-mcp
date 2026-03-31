export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts) break;

      const jitter = Math.random() * 0.3 + 0.85;
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1) * jitter, maxDelayMs);

      if (onRetry) onRetry(attempt, lastError, delay);
      await sleep(delay);
    }
  }

  throw lastError;
}

export async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  maxConcurrent: number,
  options?: { interItemDelayMs?: number; abortSignal?: AbortSignal },
): Promise<void> {
  const { interItemDelayMs = 0, abortSignal } = options ?? {};
  let index = 0;

  const workers = Array.from({ length: Math.min(maxConcurrent, items.length) }, async () => {
    while (index < items.length) {
      if (abortSignal?.aborted) return;
      const i = index++;
      await fn(items[i], i);
      if (interItemDelayMs > 0 && index < items.length) {
        await sleep(interItemDelayMs);
      }
    }
  });

  await Promise.all(workers);
}

export function createLogger(prefix: string) {
  const fmt = () =>
    new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

  return {
    info: (msg: string) => console.log(`${fmt()} [${prefix}] ${msg}`),
    warn: (msg: string) => console.warn(`${fmt()} [${prefix}] WARN: ${msg}`),
    error: (msg: string, err?: unknown) => {
      const errMsg = err instanceof Error ? err.message : err ? String(err) : "";
      console.error(`${fmt()} [${prefix}] ERROR: ${msg}${errMsg ? ` — ${errMsg}` : ""}`);
    },
  };
}

export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  );
}
