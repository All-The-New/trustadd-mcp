import type { CommunityFeedbackSource, InsertCommunityFeedbackItem, InsertCommunityFeedbackSummary } from "../../shared/schema";

export interface ScrapeResult {
  items: Omit<InsertCommunityFeedbackItem, "agentId" | "sourceId">[];
  summary: Partial<Omit<InsertCommunityFeedbackSummary, "agentId">>;
  error?: string;
}

export interface FeedbackSourceAdapter {
  platform: string;
  scrapeSource(source: CommunityFeedbackSource): Promise<ScrapeResult>;
  buildHealthScore?(data: Record<string, any>): number;
}

export interface ScraperConfig {
  concurrency: number;
  delayMs: number;
  retries: number;
  intervalHours: number;
}

export const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  concurrency: 1,
  delayMs: 1000,
  retries: 2,
  intervalHours: 24,
};
