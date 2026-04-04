import { storage } from "../storage.js";
import type { FeedbackSourceAdapter, ScraperConfig } from "./types.js";
import { DEFAULT_SCRAPER_CONFIG } from "./types.js";
import { recalculateScore } from "../trust-score.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("community-feedback");

function log(message: string) {
  logger.info(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CommunityFeedbackScheduler {
  private adapters = new Map<string, FeedbackSourceAdapter>();
  private configs = new Map<string, ScraperConfig>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  registerAdapter(platform: string, adapter: FeedbackSourceAdapter, config?: Partial<ScraperConfig>) {
    this.adapters.set(platform, adapter);
    this.configs.set(platform, { ...DEFAULT_SCRAPER_CONFIG, ...config });
    log(`Registered adapter: ${platform}`);
  }

  async runPlatformScrape(platform: string, options?: { deadlineMs?: number }): Promise<{ scraped: number; errors: number; skippedDueToTimeout: number }> {
    const adapter = this.adapters.get(platform);
    const config = this.configs.get(platform);
    if (!adapter || !config) {
      log(`No adapter registered for platform: ${platform}`);
      return { scraped: 0, errors: 0, skippedDueToTimeout: 0 };
    }

    const staleSources = await storage.getStaleSourcesForPlatform(platform, config.intervalHours);
    if (staleSources.length === 0) {
      log(`${platform}: No stale sources to scrape`);
      return { scraped: 0, errors: 0, skippedDueToTimeout: 0 };
    }

    log(`${platform}: Starting scrape of ${staleSources.length} sources`);
    let scraped = 0;
    let errors = 0;
    let skippedDueToTimeout = 0;
    const deadline = options?.deadlineMs;
    const affectedAgents = new Set<string>();

    for (const source of staleSources) {
      if (deadline && Date.now() > deadline) {
        skippedDueToTimeout = staleSources.length - scraped - errors;
        log(`${platform}: Time budget exhausted — skipping ${skippedDueToTimeout} remaining sources`);
        break;
      }
      let attempt = 0;
      let success = false;

      while (attempt < config.retries && !success) {
        attempt++;
        try {
          const result = await adapter.scrapeSource(source);

          if (result.error) {
            log(`${platform}: Error scraping ${source.platformIdentifier}: ${result.error}`);
            await storage.updateCommunityFeedbackSource(source.id, {
              scrapeErrors: source.scrapeErrors + 1,
              lastScrapedAt: new Date(),
            });
            errors++;
            break;
          }

          for (const item of result.items) {
            await storage.createCommunityFeedbackItem({
              ...item,
              agentId: source.agentId,
              sourceId: source.id,
            });
          }

          if (Object.keys(result.summary).length > 0) {
            const sourceCount = (await storage.getCommunityFeedbackSources(source.agentId)).length;
            await storage.upsertCommunityFeedbackSummary(source.agentId, {
              ...result.summary,
              totalSources: sourceCount,
            });
          }

          await storage.updateCommunityFeedbackSource(source.id, {
            lastScrapedAt: new Date(),
            scrapeErrors: 0,
          });

          affectedAgents.add(source.agentId);
          scraped++;
          success = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log(`${platform}: Attempt ${attempt}/${config.retries} failed for ${source.platformIdentifier}: ${msg}`);
          if (attempt >= config.retries) {
            await storage.updateCommunityFeedbackSource(source.id, {
              scrapeErrors: source.scrapeErrors + 1,
              lastScrapedAt: new Date(),
            });
            errors++;
          }
          await sleep(config.delayMs * attempt);
        }
      }

      if (success) {
        await sleep(config.delayMs);
      }
    }

    log(`${platform}: Scrape complete — ${scraped} succeeded, ${errors} failed, ${affectedAgents.size} agents updated${skippedDueToTimeout > 0 ? `, ${skippedDueToTimeout} skipped (time budget)` : ""}`);

    for (const agentId of affectedAgents) {
      recalculateScore(agentId).catch(() => {});
    }

    return { scraped, errors, skippedDueToTimeout };
  }

  async runAllScrapes(options?: { deadlineMs?: number }): Promise<{ totalScraped: number; totalErrors: number; totalSkipped: number }> {
    if (this.running) {
      log("Scrape already in progress, skipping");
      return { totalScraped: 0, totalErrors: 0, totalSkipped: 0 };
    }
    this.running = true;
    let totalScraped = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    try {
      for (const platform of this.adapters.keys()) {
        if (options?.deadlineMs && Date.now() > options.deadlineMs) {
          log(`Time budget exhausted — skipping remaining platforms`);
          break;
        }
        const result = await this.runPlatformScrape(platform, options);
        totalScraped += result.scraped;
        totalErrors += result.errors;
        totalSkipped += result.skippedDueToTimeout;
      }
    } finally {
      this.running = false;
    }
    return { totalScraped, totalErrors, totalSkipped };
  }

  start() {
    const intervalMs = 24 * 60 * 60 * 1000;
    log(`Scheduler started (interval: 24h)`);

    const scheduleNext = () => {
      this.timer = setTimeout(async () => {
        await this.runAllScrapes();
        scheduleNext();
      }, intervalMs);
    };

    scheduleNext();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    log("Scheduler stopped");
  }

  isRunning() {
    return this.running;
  }

  getRegisteredPlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }
}
