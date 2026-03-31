import type { CommunityFeedbackSource } from "../../../shared/schema";
import type { FeedbackSourceAdapter, ScrapeResult } from "../types";

function log(message: string) {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${time} [github-adapter] ${message}`);
}

interface GitHubRepoData {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  description: string | null;
  language: string | null;
  html_url: string;
  default_branch: string;
  updated_at: string;
  has_issues: boolean;
  archived: boolean;
  fork: boolean;
}

interface GitHubCommit {
  sha: string;
  commit: {
    author: { date: string; name: string };
    message: string;
  };
  html_url: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: { login: string } | null;
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
}

interface GitHubContributor {
  login: string;
  contributions: number;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "TrustAdd-CommunityFeedback/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubFetch<T>(url: string): Promise<{ data: T | null; status: number; rateLimitRemaining: number }> {
  const response = await fetch(url, { headers: buildHeaders() });
  const rateLimitRemaining = parseInt(response.headers.get("x-ratelimit-remaining") || "999", 10);

  if (rateLimitRemaining < 10) {
    log(`Rate limit warning: ${rateLimitRemaining} requests remaining`);
  }

  if (!response.ok) {
    return { data: null, status: response.status, rateLimitRemaining };
  }

  const data = (await response.json()) as T;
  return { data, status: response.status, rateLimitRemaining };
}

function parseLinkHeader(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  const lastMatch = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return lastMatch ? parseInt(lastMatch[1], 10) : null;
}

export function computeGitHubHealthScore(data: {
  stars: number;
  forks: number;
  openIssues: number;
  contributors: number;
  lastCommitDaysAgo: number;
  hasDescription: boolean;
}): number {
  let score = 0;

  if (data.stars >= 100) score += 20;
  else if (data.stars >= 21) score += 15;
  else if (data.stars >= 6) score += 10;
  else if (data.stars >= 1) score += 5;

  if (data.lastCommitDaysAgo < 7) score += 25;
  else if (data.lastCommitDaysAgo < 30) score += 20;
  else if (data.lastCommitDaysAgo < 90) score += 10;
  else if (data.lastCommitDaysAgo < 365) score += 5;

  if (data.stars > 0) {
    const ratio = data.openIssues / data.stars;
    if (ratio < 0.1) score += 15;
    else if (ratio < 0.3) score += 10;
    else if (ratio < 0.5) score += 5;
  } else {
    if (data.openIssues === 0) score += 10;
    else if (data.openIssues <= 3) score += 5;
  }

  if (data.contributors >= 10) score += 20;
  else if (data.contributors >= 4) score += 15;
  else if (data.contributors >= 2) score += 10;
  else if (data.contributors >= 1) score += 5;

  if (data.forks >= 5) score += 10;
  else if (data.forks >= 1) score += 5;

  if (data.hasDescription) score += 5;

  score += 5;

  return Math.min(score, 100);
}

export class GitHubAdapter implements FeedbackSourceAdapter {
  platform = "github";

  async scrapeSource(source: CommunityFeedbackSource): Promise<ScrapeResult> {
    const identifier = source.platformIdentifier;
    const parts = identifier.split("/");

    if (parts.length < 2) {
      return {
        items: [],
        summary: {},
        error: `Invalid GitHub identifier: ${identifier} (expected owner/repo)`,
      };
    }

    const owner = parts[0];
    const repo = parts[1];
    const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

    const repoResult = await githubFetch<GitHubRepoData>(baseUrl);

    if (repoResult.status === 404) {
      return { items: [], summary: {}, error: "Repository not found (404)" };
    }

    if (repoResult.status === 403) {
      throw new Error("GitHub API rate limit exceeded (403)");
    }

    if (!repoResult.data) {
      return { items: [], summary: {}, error: `GitHub API error: HTTP ${repoResult.status}` };
    }

    const repoData = repoResult.data;

    const contributorsResult = await githubFetch<GitHubContributor[]>(`${baseUrl}/contributors?per_page=1&anon=true`);
    let contributorCount = 1;
    if (contributorsResult.data) {
      const response = await fetch(`${baseUrl}/contributors?per_page=1&anon=true`, { headers: buildHeaders() });
      const lastPage = parseLinkHeader(response.headers.get("link"));
      contributorCount = lastPage || contributorsResult.data.length;
    }

    const commitsResult = await githubFetch<GitHubCommit[]>(`${baseUrl}/commits?per_page=1`);
    let lastCommitDate: Date | null = null;
    if (commitsResult.data && commitsResult.data.length > 0) {
      lastCommitDate = new Date(commitsResult.data[0].commit.author.date);
    }

    const issuesResult = await githubFetch<GitHubIssue[]>(`${baseUrl}/issues?state=open&per_page=5&sort=updated&direction=desc`);
    const issues = issuesResult.data || [];
    const filteredIssues = issues.filter((i) => !("pull_request" in i));

    const lastCommitDaysAgo = lastCommitDate
      ? Math.floor((Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24))
      : 9999;

    const healthScore = computeGitHubHealthScore({
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      contributors: contributorCount,
      lastCommitDaysAgo,
      hasDescription: !!repoData.description,
    });

    const items: ScrapeResult["items"] = [];

    items.push({
      platform: "github",
      itemType: "repo_stats",
      externalId: `repo-stats-${owner}/${repo}`,
      externalUrl: repoData.html_url,
      title: `${owner}/${repo}`,
      contentSnippet: repoData.description || undefined,
      engagementScore: repoData.stargazers_count,
      rawData: {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        language: repoData.language,
        contributors: contributorCount,
        lastCommitDate: lastCommitDate?.toISOString(),
        archived: repoData.archived,
        fork: repoData.fork,
        healthScore,
      },
      postedAt: lastCommitDate || undefined,
    });

    for (const issue of filteredIssues.slice(0, 5)) {
      items.push({
        platform: "github",
        itemType: "issue",
        externalId: `issue-${owner}/${repo}-${issue.number}`,
        externalUrl: issue.html_url,
        author: issue.user?.login || undefined,
        title: issue.title,
        contentSnippet: `#${issue.number}: ${issue.title}`,
        engagementScore: 0,
        rawData: {
          number: issue.number,
          state: issue.state,
          labels: issue.labels.map((l) => l.name),
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
        },
        postedAt: new Date(issue.created_at),
      });
    }

    log(`Scraped ${owner}/${repo}: ⭐${repoData.stargazers_count} 🍴${repoData.forks_count} health=${healthScore}`);

    return {
      items,
      summary: {
        githubStars: repoData.stargazers_count,
        githubForks: repoData.forks_count,
        githubOpenIssues: repoData.open_issues_count,
        githubLastCommitAt: lastCommitDate || undefined,
        githubContributors: contributorCount,
        githubLanguage: repoData.language || undefined,
        githubDescription: repoData.description || undefined,
        githubHealthScore: healthScore,
      },
    };
  }
}
