# Community Feedback — Adapter Developer Guide

This guide explains how to add a new platform adapter to the TrustAdd Community Feedback system.

---

## Overview

The Community Feedback system uses a pluggable adapter pattern. Each platform (GitHub, Twitter, Reddit, etc.) is implemented as an independent adapter that conforms to the `FeedbackSourceAdapter` interface. The scheduler orchestrates scraping across all registered adapters.

### File Structure

```
server/community-feedback/
  types.ts                    # Shared types and interfaces
  scheduler.ts                # Orchestrator that runs adapters
  source-discovery.ts         # Scans agents for platform links
  index.ts                    # Entry point, wires everything together
  adapters/
    github.ts                 # GitHub adapter (reference implementation)
    farcaster.ts              # Farcaster adapter (Neynar API)
    twitter.ts                # (future) Twitter/X adapter
```

---

## Step 1: Implement the Adapter Interface

Create a new file at `server/community-feedback/adapters/{platform}.ts`.

Your adapter must implement the `FeedbackSourceAdapter` interface defined in `types.ts`:

```typescript
export interface FeedbackSourceAdapter {
  platform: string;
  scrapeSource(source: CommunityFeedbackSource): Promise<ScrapeResult>;
  buildHealthScore?(data: Record<string, unknown>): number;
}

export interface ScrapeResult {
  items: Partial<InsertCommunityFeedbackItem>[];
  summary: Partial<InsertCommunityFeedbackSummary>;
  error?: string;
}
```

### Example Adapter Skeleton

```typescript
import type { FeedbackSourceAdapter, ScrapeResult } from "../types";
import type { CommunityFeedbackSource } from "@shared/schema";

export class MyPlatformAdapter implements FeedbackSourceAdapter {
  platform = "myplatform";

  async scrapeSource(source: CommunityFeedbackSource): Promise<ScrapeResult> {
    const identifier = source.platformIdentifier;

    try {
      // 1. Fetch data from the platform API
      const data = await this.fetchPlatformData(identifier);

      // 2. Transform into feedback items
      const items = this.transformToItems(data, source);

      // 3. Build summary fields
      const summary = this.buildSummaryFields(data);

      return { items, summary };
    } catch (error: any) {
      // Handle platform-specific errors
      if (error.status === 404) {
        return {
          items: [],
          summary: {},
          error: `Resource not found: ${identifier}`,
        };
      }
      throw error; // Let scheduler handle retries
    }
  }

  private async fetchPlatformData(identifier: string) {
    // Platform API calls go here
  }

  private transformToItems(data: any, source: CommunityFeedbackSource) {
    // Transform platform data into InsertCommunityFeedbackItem objects
    return [
      {
        agentId: source.agentId,
        sourceId: source.id,
        platform: this.platform,
        itemType: "post",              // "repo_stats", "issue", "mention", "post", "review"
        externalId: data.id,           // Platform-specific ID for dedup
        externalUrl: data.url,
        author: data.author,
        title: data.title,
        contentSnippet: data.text?.substring(0, 500),
        sentiment: null,               // Set if you do sentiment analysis
        sentimentScore: null,
        engagementScore: data.likes,
        rawData: data,
        postedAt: new Date(data.created_at),
      },
    ];
  }

  private buildSummaryFields(data: any) {
    // Return fields that map to community_feedback_summaries columns
    return {
      // Use platform-specific summary columns
      // e.g., twitterMentions, redditMentions, etc.
    };
  }
}
```

---

## Step 2: Add Source Discovery

In `server/community-feedback/source-discovery.ts`, add a discovery function that scans the agents table for links to your platform.

```typescript
export async function discoverMyPlatformSources(): Promise<number> {
  const allAgents = await storage.getAllAgents();
  let discovered = 0;

  for (const agent of allAgents) {
    // Parse agent metadata for platform links
    const endpoints = agent.endpoints as Record<string, string> | null;
    if (!endpoints) continue;

    // Look for platform-specific URLs
    const platformUrl = findPlatformUrl(endpoints);
    if (!platformUrl) continue;

    // Extract platform identifier (e.g., username, repo path)
    const identifier = extractIdentifier(platformUrl);
    if (!identifier) continue;

    // Upsert into community_feedback_sources
    try {
      await storage.createCommunityFeedbackSource({
        agentId: agent.id,
        platform: "myplatform",
        platformIdentifier: identifier,
        matchTier: "tier1_direct",
        isActive: true,
        scrapeErrors: 0,
      });
      discovered++;
    } catch (e) {
      // Unique constraint violation = already exists, skip
    }
  }

  return discovered;
}
```

Then add your discovery function to `discoverAllSources()` in the same file:

```typescript
export async function discoverAllSources(): Promise<void> {
  await discoverGitHubSources();
  await discoverMyPlatformSources(); // Add your discoverer
}
```

---

## Step 3: Register the Adapter

In `server/community-feedback/index.ts`, register your adapter with the scheduler:

```typescript
import { MyPlatformAdapter } from "./adapters/myplatform";

export async function initCommunityFeedback(): Promise<void> {
  // ... existing setup ...

  // Register adapters
  scheduler.registerAdapter("github", new GitHubAdapter());
  scheduler.registerAdapter("myplatform", new MyPlatformAdapter()); // Add yours

  // ... rest of initialization ...
}
```

---

## Step 4: Add Summary Columns (if needed)

If your platform needs dedicated summary columns (like `githubStars` for GitHub), add them to the `community_feedback_summaries` table in `shared/schema.ts`:

```typescript
export const communityFeedbackSummaries = pgTable("community_feedback_summaries", {
  // ... existing columns ...
  myplatformMetric: integer("myplatform_metric"),     // Add new columns
  myplatformScore: integer("myplatform_score"),
});
```

Then run `npm run db:push` to apply the schema change.

Update the insert schema and types at the bottom of `shared/schema.ts` if needed.

---

## Step 5: Add API Endpoint (optional)

If your platform needs a dedicated detail endpoint, add it to `server/routes.ts`:

```typescript
app.get("/api/agents/:id/community-feedback/myplatform", async (req, res) => {
  try {
    const items = await storage.getCommunityFeedbackItems(
      req.params.id,
      "myplatform"
    );
    const sources = await storage.getCommunityFeedbackSources(
      req.params.id,
      "myplatform"
    );
    res.json({ items, source: sources[0] || null });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch platform data" });
  }
});
```

The general `/api/agents/:id/community-feedback` endpoint automatically includes all platforms.

---

## Step 6: Add Frontend Display

In `client/src/pages/agent-profile.tsx`, the Community tab already has placeholder sections for future platforms. Replace the "Coming Soon" placeholder with your platform's data display.

The frontend fetches `/api/agents/:id/community-feedback` which returns data organized by platform:

```json
{
  "summary": { ... },
  "github": { "items": [...], "source": {...} },
  "twitter": null,
  "reddit": null,
  "myplatform": { "items": [...], "source": {...} }
}
```

---

## Key Design Decisions

### Error Handling
- If a source returns 404 (deleted/private), mark it as `isActive: false`
- If a source returns 403 (rate limited), throw the error so the scheduler can retry
- Increment `scrapeErrors` on each failure; the scheduler uses this for monitoring
- Never let one source failure stop the entire scrape cycle

### Dedup
- Each item must have a unique `externalId` per source
- The storage layer uses `ON CONFLICT DO NOTHING` on `(sourceId, externalId)`
- This means re-scraping the same data is safe and idempotent

### Rate Limiting
- Each adapter is responsible for checking platform rate limit headers
- The scheduler adds configurable delays between requests (`delayMs` in `ScraperConfig`)
- If rate limited, throw an error and let the scheduler handle backoff

### Sentiment Analysis
- For factual data (like GitHub stats), leave `sentiment` and `sentimentScore` as null
- For text-based platforms (Twitter, Reddit), implement sentiment classification
- Use the two-stage pipeline: relevance filter then sentiment classification
- Minimum mention threshold (3+) before displaying sentiment aggregates

### Summary Recomputation
- After scraping all sources for a platform, the scheduler recomputes the summary for each affected agent
- The summary is a materialized view — it's updated after each scrape, not computed on read
- This keeps API response times fast

---

## Environment Variables

| Variable | Required For | Description |
|----------|-------------|-------------|
| `GITHUB_TOKEN` | GitHub adapter | Personal access token with read-only scope (5,000 req/hr) |
| `NEYNAR_API_KEY` or `API_KEY_NEYNAR` | Farcaster adapter | Neynar API key (free tier at neynar.com). Falls back to `NEYNAR_API_DOCS` for local dev |
| `TWITTER_BEARER_TOKEN` | Twitter adapter (future) | X/Twitter API Bearer Token ($200/month Basic tier) |
| `OPENAI_API_KEY` | Twitter sentiment (future) | For GPT-based sentiment classification |

---

## Testing Your Adapter

1. Create a test source manually in the database or via the storage layer
2. Call `adapter.scrapeSource(source)` directly and inspect the result
3. Verify items have correct `externalId` for dedup
4. Verify summary fields map to the correct columns
5. Test error cases: 404, 403, network timeout, malformed response
6. Run source discovery and verify it finds the expected agents
7. Trigger a manual scrape via `POST /api/admin/community-feedback/scrape` (requires `ADMIN_SECRET`)
