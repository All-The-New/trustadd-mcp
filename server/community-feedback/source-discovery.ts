import { storage } from "../storage.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("source-discovery");

function log(message: string) {
  logger.info(message);
}

const GITHUB_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?)/gi;
const EXCLUDED_GITHUB_REPOS = ["agntcy/oasf", "anthropics/claude"];

function extractGitHubIdentifiers(endpoints: any): string[] {
  if (!endpoints || !Array.isArray(endpoints)) return [];

  const identifiers = new Set<string>();

  for (const ep of endpoints) {
    const urls: string[] = [];
    if (ep.endpoint) urls.push(ep.endpoint);
    if (ep.url) urls.push(ep.url);

    for (const url of urls) {
      if (typeof url !== "string") continue;
      const matches = url.matchAll(GITHUB_URL_REGEX);
      for (const match of matches) {
        const path = match[1];
        if (!path) continue;

        const parts = path.split("/").filter(Boolean);
        if (parts.length === 0) continue;

        let identifier: string;
        if (parts.length >= 2) {
          identifier = `${parts[0]}/${parts[1]}`;
        } else {
          identifier = parts[0];
        }

        const lowerIdentifier = identifier.toLowerCase();
        const isExcluded = EXCLUDED_GITHUB_REPOS.some(
          (excluded) => lowerIdentifier === excluded.toLowerCase()
        );
        if (!isExcluded) {
          identifiers.add(identifier);
        }
      }
    }
  }

  return Array.from(identifiers);
}

function extractTwitterHandles(endpoints: any): string[] {
  if (!endpoints || !Array.isArray(endpoints)) return [];
  const handles = new Set<string>();
  const TWITTER_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/gi;

  for (const ep of endpoints) {
    const urls: string[] = [];
    if (ep.endpoint) urls.push(ep.endpoint);
    if (ep.url) urls.push(ep.url);

    for (const url of urls) {
      if (typeof url !== "string") continue;
      const matches = url.matchAll(TWITTER_REGEX);
      for (const match of matches) {
        const handle = match[1];
        if (handle && !["home", "search", "explore", "settings", "i"].includes(handle.toLowerCase())) {
          handles.add(`@${handle}`);
        }
      }
    }
  }

  return Array.from(handles);
}

export async function discoverGitHubSources(): Promise<number> {
  log("Discovering GitHub sources from agent endpoints...");
  const allAgents = await storage.getAllAgents();
  let discovered = 0;

  for (const agent of allAgents) {
    const identifiers = extractGitHubIdentifiers(agent.endpoints);
    for (const identifier of identifiers) {
      await storage.createCommunityFeedbackSource({
        agentId: agent.id,
        platform: "github",
        platformIdentifier: identifier,
        matchTier: "tier1_direct",
        isActive: true,
        scrapeErrors: 0,
      });
      discovered++;
    }
  }

  log(`GitHub discovery complete: ${discovered} sources found`);
  return discovered;
}

export async function discoverTwitterSources(): Promise<number> {
  log("Discovering Twitter sources from agent endpoints...");
  const allAgents = await storage.getAllAgents();
  let discovered = 0;

  for (const agent of allAgents) {
    const handles = extractTwitterHandles(agent.endpoints);
    for (const handle of handles) {
      await storage.createCommunityFeedbackSource({
        agentId: agent.id,
        platform: "twitter",
        platformIdentifier: handle,
        matchTier: "tier1_direct",
        isActive: true,
        scrapeErrors: 0,
      });
      discovered++;
    }
  }

  log(`Twitter discovery complete: ${discovered} sources found (adapter not yet implemented)`);
  return discovered;
}

const FARCASTER_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:farcaster\.xyz|warpcast\.com)\/(@?[a-zA-Z0-9_.-]+)/gi;
const FARCASTER_EXCLUDED_PATHS = ["miniapps", "channels", "settings", "~/", "api", "developers"];

function extractFarcasterUsernames(endpoints: any): string[] {
  if (!endpoints || !Array.isArray(endpoints)) return [];
  const usernames = new Set<string>();

  for (const ep of endpoints) {
    const urls: string[] = [];
    if (ep.endpoint) urls.push(ep.endpoint);
    if (ep.url) urls.push(ep.url);

    for (const url of urls) {
      if (typeof url !== "string") continue;
      const matches = url.matchAll(FARCASTER_URL_REGEX);
      for (const match of matches) {
        let username = match[1];
        if (!username) continue;

        username = username.replace(/^@/, "");

        const isExcluded = FARCASTER_EXCLUDED_PATHS.some(
          (excluded) => username.toLowerCase() === excluded.toLowerCase()
        );
        if (!isExcluded && username.length > 0) {
          usernames.add(username.toLowerCase());
        }
      }
    }
  }

  return Array.from(usernames);
}

export async function discoverFarcasterSources(): Promise<number> {
  log("Discovering Farcaster sources from agent endpoints...");
  const allAgents = await storage.getAllAgents();
  let discovered = 0;

  for (const agent of allAgents) {
    const usernames = extractFarcasterUsernames(agent.endpoints);
    for (const username of usernames) {
      await storage.createCommunityFeedbackSource({
        agentId: agent.id,
        platform: "farcaster",
        platformIdentifier: username,
        matchTier: "tier1_direct",
        isActive: true,
        scrapeErrors: 0,
      });
      discovered++;
    }
  }

  log(`Farcaster discovery complete: ${discovered} sources found`);
  return discovered;
}

export async function discoverAllSources(): Promise<{ github: number; twitter: number; farcaster: number }> {
  const github = await discoverGitHubSources();
  const twitter = await discoverTwitterSources();
  const farcaster = await discoverFarcasterSources();
  return { github, twitter, farcaster };
}
