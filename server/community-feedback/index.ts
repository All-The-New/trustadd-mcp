import { CommunityFeedbackScheduler } from "./scheduler.js";
import { GitHubAdapter } from "./adapters/github.js";
import { FarcasterAdapter } from "./adapters/farcaster.js";
import { discoverAllSources } from "./source-discovery.js";
import { storage } from "../storage.js";

const RETRY_DELAY_MS = 5 * 60 * 1000;

function log(message: string) {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${time} [community-feedback] ${message}`);
}

let scheduler: CommunityFeedbackScheduler | null = null;

export async function initCommunityFeedback(attempt = 1): Promise<CommunityFeedbackScheduler | null> {
  log(`Initializing community feedback system${attempt > 1 ? ` (attempt ${attempt})` : ""}...`);

  try {
    const discovery = await discoverAllSources();
    log(`Source discovery: ${discovery.github} GitHub, ${discovery.twitter} Twitter, ${discovery.farcaster} Farcaster`);

    scheduler = new CommunityFeedbackScheduler();

    const githubAdapter = new GitHubAdapter();
    scheduler.registerAdapter("github", githubAdapter, {
      concurrency: 1,
      delayMs: 1500,
      retries: 2,
      intervalHours: 24,
    });

    const farcasterAdapter = new FarcasterAdapter();
    scheduler.registerAdapter("farcaster", farcasterAdapter, {
      concurrency: 1,
      delayMs: 2000,
      retries: 2,
      intervalHours: 24,
    });

    scheduler.start();

    const stats = await storage.getCommunityFeedbackStats();
    if (stats.totalItems === 0) {
      log("No existing feedback data — running initial GitHub scrape...");
      setTimeout(async () => {
        try {
          await scheduler!.runPlatformScrape("github");
        } catch (err) {
          log(`Initial scrape failed: ${(err as Error).message}`);
        }
      }, 5000);
    } else {
      log(`Existing data: ${stats.totalAgentsWithFeedback} agents, ${stats.totalItems} items`);
    }

    return scheduler;
  } catch (err) {
    const msg = (err as Error).message ?? "";
    const isTableMissing = msg.includes("does not exist") || msg.includes("relation") || msg.includes("undefined table");
    if (isTableMissing) {
      log(`Failed to initialize: tables missing — run db:push to create them.`);
      return null;
    }
    const retryInMin = Math.round(RETRY_DELAY_MS / 60_000);
    log(`Failed to initialize: ${msg} — retrying in ${retryInMin}min (attempt ${attempt})`);
    setTimeout(() => {
      initCommunityFeedback(attempt + 1).catch(() => {});
    }, RETRY_DELAY_MS);
    return null;
  }
}

export function getCommunityFeedbackScheduler(): CommunityFeedbackScheduler | null {
  return scheduler;
}

export { discoverAllSources } from "./source-discovery.js";
