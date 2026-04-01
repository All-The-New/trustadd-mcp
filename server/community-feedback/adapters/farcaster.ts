import type { CommunityFeedbackSource } from "../../../shared/schema.js";
import type { FeedbackSourceAdapter, ScrapeResult } from "../types.js";
import { createLogger } from "../../lib/logger.js";

const logger = createLogger("farcaster-adapter");

function log(message: string) {
  logger.info(message);
}

interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  custody_address: string;
  profile: {
    bio: { text: string };
  };
  follower_count: number;
  following_count: number;
  verifications: string[];
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
  active_status: string;
  power_badge: boolean;
  experimental?: {
    neynar_user_score?: number;
  };
}

interface NeynarCast {
  hash: string;
  text: string;
  timestamp: string;
  author: { fid: number; username: string; display_name: string };
  reactions: {
    likes_count: number;
    recasts_count: number;
    likes: Array<{ fid: number }>;
    recasts: Array<{ fid: number }>;
  };
  replies: { count: number };
  thread_hash: string;
}

interface NeynarUserResponse {
  user: NeynarUser;
}

interface NeynarFeedResponse {
  casts: NeynarCast[];
  next?: { cursor: string };
}

const NEYNAR_BASE = "https://api.neynar.com";

function getApiKey(): string {
  return process.env.NEYNAR_API_KEY || process.env.API_KEY_NEYNAR || "NEYNAR_API_DOCS";
}

async function neynarFetch<T>(path: string): Promise<{ data: T | null; status: number }> {
  const url = `${NEYNAR_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-api-key": getApiKey(),
      "x-neynar-experimental": "true",
    },
  });

  if (!response.ok) {
    return { data: null, status: response.status };
  }

  const data = (await response.json()) as T;
  return { data, status: response.status };
}

export class FarcasterAdapter implements FeedbackSourceAdapter {
  platform = "farcaster";

  async scrapeSource(source: CommunityFeedbackSource): Promise<ScrapeResult> {
    const username = source.platformIdentifier.toLowerCase().replace(/^@/, "");

    if (!username || username.length === 0) {
      return {
        items: [],
        summary: {},
        error: `Invalid Farcaster username: ${source.platformIdentifier}`,
      };
    }

    log(`Scraping Farcaster profile: @${username}`);

    const { data: userData, status: userStatus } = await neynarFetch<NeynarUserResponse>(
      `/v2/farcaster/user/by_username?username=${encodeURIComponent(username)}`
    );

    if (userStatus === 404 || (!userData?.user && userStatus === 200)) {
      log(`User not found: @${username}`);
      return {
        items: [],
        summary: {},
        error: `Farcaster user not found: @${username}`,
      };
    }

    if (userStatus === 429) {
      log(`Rate limited while fetching @${username}`);
      return {
        items: [],
        summary: {},
        error: `Rate limited by Neynar API — will retry later`,
      };
    }

    if (userStatus !== 200 || !userData?.user) {
      log(`API error for @${username}: status ${userStatus}`);
      return {
        items: [],
        summary: {},
        error: `Neynar API error: status ${userStatus}`,
      };
    }

    const user = userData.user;
    const neynarScore = (user as any).score ?? user.experimental?.neynar_user_score ?? null;

    const profileItem = {
      platform: "farcaster" as const,
      itemType: "profile_snapshot",
      externalId: `farcaster-profile-${user.fid}`,
      externalUrl: `https://warpcast.com/${username}`,
      author: username,
      title: user.display_name || username,
      contentSnippet: user.profile?.bio?.text || null,
      sentiment: null,
      sentimentScore: neynarScore,
      engagementScore: user.follower_count,
      rawData: {
        fid: user.fid,
        followers: user.follower_count,
        following: user.following_count,
        neynarScore,
        powerBadge: user.power_badge,
        activeStatus: user.active_status,
        verifiedEthAddresses: user.verified_addresses?.eth_addresses || [],
        verifiedSolAddresses: user.verified_addresses?.sol_addresses || [],
        pfpUrl: user.pfp_url,
        custodyAddress: user.custody_address,
      },
      postedAt: null,
    };

    const items: ScrapeResult["items"] = [profileItem];

    let totalEngagement = 0;
    let castCount = 0;
    let lastCastAt: Date | null = null;

    const { data: feedData, status: feedStatus } = await neynarFetch<NeynarFeedResponse>(
      `/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${user.fid}&limit=25`
    );

    if (feedStatus === 402) {
      log(`Feed endpoint requires paid plan — skipping cast data for @${username}`);
    } else if (feedStatus === 429) {
      log(`Rate limited on feed endpoint for @${username} — skipping cast data`);
    } else if (feedStatus !== 200 && feedStatus !== 0) {
      log(`Feed endpoint returned ${feedStatus} for @${username} — skipping cast data`);
    } else if (feedData?.casts && feedData.casts.length > 0) {
      for (const cast of feedData.casts) {
        const likes = cast.reactions?.likes_count || 0;
        const recasts = cast.reactions?.recasts_count || 0;
        const replies = cast.replies?.count || 0;
        const engagement = likes + recasts + replies;
        totalEngagement += engagement;
        castCount++;

        const castDate = new Date(cast.timestamp);
        if (!lastCastAt || castDate > lastCastAt) {
          lastCastAt = castDate;
        }

        items.push({
          platform: "farcaster",
          itemType: "cast",
          externalId: cast.hash,
          externalUrl: `https://warpcast.com/${username}/${cast.hash.slice(0, 10)}`,
          author: username,
          title: null,
          contentSnippet: cast.text?.slice(0, 280) || null,
          sentiment: null,
          sentimentScore: null,
          engagementScore: engagement,
          rawData: {
            likes,
            recasts,
            replies,
            threadHash: cast.thread_hash,
          },
          postedAt: castDate,
        });
      }
    }

    const engagementAvg = castCount > 0 ? totalEngagement / castCount : 0;

    log(`@${username}: ${user.follower_count} followers, score=${neynarScore?.toFixed(3) ?? "n/a"}, ${castCount} casts scraped, avg engagement=${engagementAvg.toFixed(1)}`);

    return {
      items,
      summary: {
        farcasterFollowers: user.follower_count,
        farcasterFollowing: user.following_count,
        farcasterScore: neynarScore,
        farcasterFid: user.fid,
        farcasterLastCastAt: lastCastAt,
        farcasterTotalCasts: castCount,
        farcasterEngagementAvg: Math.round(engagementAvg * 10) / 10,
      },
    };
  }
}
