import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { Agent, AgentMetadataEvent, CommunityFeedbackSummary, CommunityFeedbackItem, CommunityFeedbackSource } from "@shared/schema";
import { getExplorerAddressUrl, getExplorerTxUrl, getChain } from "@shared/chains";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { PROFILE } from "@/lib/content-zones";
import { EventTimeline } from "@/components/event-timeline";
import { ChainBadge } from "@/components/chain-badge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Shield,
  Clock,
  Hash,
  User,
  FileText,
  Blocks,
  Zap,
  Globe,
  Tag,
  Brain,
  Building,
  CreditCard,
  Lock,
  Star,
  MessageSquare,
  Users,
  CalendarDays,
  Award,
  ArrowRight,
  Layers,
  GitBranch,
  AlertCircle,
  Activity,
  Code,
  Heart,
} from "lucide-react";
import { SiGithub, SiFarcaster } from "react-icons/si";
import { useState, useEffect } from "react";

interface ReputationSourceInfo {
  id: string;
  name: string;
  shortName: string;
  description: string;
  url: string;
  color: string;
  type: string;
  trustLevel: string;
}

interface SybilFlag {
  type: string;
  description: string;
  severity: "warning" | "critical";
}

interface FeedbackSummary {
  feedbackCount: number;
  uniqueReviewers: number;
  firstFeedbackBlock: number | null;
  lastFeedbackBlock: number | null;
  events: AgentMetadataEvent[];
  sources: Record<string, ReputationSourceInfo>;
  sybilFlags: SybilFlag[];
}

interface CommunityFeedbackResponse {
  summary: CommunityFeedbackSummary | null;
  github: {
    source: CommunityFeedbackSource;
    items: CommunityFeedbackItem[];
  } | null;
  farcaster: {
    source: CommunityFeedbackSource;
    items: CommunityFeedbackItem[];
  } | null;
  twitter: null;
}

function addressToColor(address: string): string {
  const hash = address.slice(2, 8);
  const hue = parseInt(hash, 16) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

function getInitials(name: string | null, address: string): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return address.slice(2, 4).toUpperCase();
}

function toTitleCase(str: string): string {
  return str
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSkillLabel(skill: string): string {
  const parts = skill.split("/");
  const lastPart = parts[parts.length - 1];
  return toTitleCase(lastPart);
}

function calculateCompleteness(agent: Agent): number {
  const fields = [
    agent.name,
    agent.description,
    agent.capabilities && agent.capabilities.length > 0 ? agent.capabilities : null,
    agent.tags && agent.tags.length > 0 ? agent.tags : null,
    agent.oasfSkills && agent.oasfSkills.length > 0 ? agent.oasfSkills : null,
    agent.oasfDomains && agent.oasfDomains.length > 0 ? agent.oasfDomains : null,
    agent.endpoints,
    agent.x402Support !== null && agent.x402Support !== undefined ? true : null,
    agent.supportedTrust && agent.supportedTrust.length > 0 ? agent.supportedTrust : null,
    agent.imageUrl,
    agent.metadataUri,
  ];
  const filled = fields.filter((f) => f !== null && f !== undefined && f !== "").length;
  return Math.round((filled / fields.length) * 100);
}

function CompletenessIndicator({ percentage }: { percentage: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-1.5" data-testid="indicator-completeness">
      <svg width="36" height="36" viewBox="0 0 40 40" className="flex-shrink-0">
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-muted-foreground/20"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary"
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span className="text-xs text-muted-foreground font-medium">{percentage}%</span>
    </div>
  );
}

function TrustScoreRing({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const radius = size === "lg" ? 28 : 16;
  const svgSize = size === "lg" ? 72 : 40;
  const viewBox = size === "lg" ? 64 : 40;
  const center = viewBox / 2;
  const strokeWidth = size === "lg" ? 4 : 3;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let colorClass: string;
  if (score >= 70) colorClass = "text-emerald-500";
  else if (score >= 40) colorClass = "text-amber-500";
  else colorClass = "text-red-500";

  return (
    <div className="flex flex-col items-center" data-testid="indicator-trust-score">
      <div className="relative">
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${viewBox} ${viewBox}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted-foreground/15"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={colorClass}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${size === "lg" ? "text-lg font-bold" : "text-xs font-semibold"} ${colorClass}`}>
            {score}
          </span>
        </div>
      </div>
      {size === "lg" && (
        <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">TrustAdd Score</span>
      )}
    </div>
  );
}

function TrustScoreBreakdownBar({ breakdown }: { breakdown: { identity: number; history: number; capability: number; community: number; transparency: number } }) {
  const categories = [
    { key: "identity", label: "Identity", max: 25, value: breakdown.identity, color: "bg-blue-500" },
    { key: "history", label: "History", max: 20, value: breakdown.history, color: "bg-purple-500" },
    { key: "capability", label: "Capability", max: 15, value: breakdown.capability, color: "bg-emerald-500" },
    { key: "community", label: "Community", max: 20, value: breakdown.community, color: "bg-amber-500" },
    { key: "transparency", label: "Transparency", max: 20, value: breakdown.transparency, color: "bg-teal-500" },
  ];

  return (
    <div className="space-y-2" data-testid="trust-score-breakdown">
      {categories.map(({ key, label, max, value, color }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${color} transition-all`}
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium w-10 text-right">{value}/{max}</span>
        </div>
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button size="icon" variant="ghost" onClick={handleCopy} data-testid="button-copy-address">
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </Button>
  );
}

function DetailRow({ icon: Icon, label, value, mono, link }: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <p className={`text-sm truncate ${mono ? "font-mono" : ""}`} data-testid={`text-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            {value}
          </p>
          {mono && <CopyButton text={value} />}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost" data-testid={`button-external-link-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                <ExternalLink className="w-3 h-3" />
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function getEndpointsList(endpoints: unknown): Array<{ name: string; endpoint: string }> {
  if (!endpoints) return [];
  if (Array.isArray(endpoints)) {
    return endpoints.map((ep, i) => {
      if (typeof ep === "object" && ep !== null) {
        return {
          name: (ep as Record<string, string>).name || `Endpoint ${i + 1}`,
          endpoint: (ep as Record<string, string>).endpoint || (ep as Record<string, string>).url || String(ep),
        };
      }
      return { name: `Endpoint ${i + 1}`, endpoint: String(ep) };
    });
  }
  if (typeof endpoints === "object" && endpoints !== null) {
    return Object.entries(endpoints as Record<string, string>).map(([key, value]) => ({
      name: key,
      endpoint: typeof value === "string" ? value : String(value),
    }));
  }
  return [];
}

function getEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case "FeedbackPosted": return "Feedback";
    case "ReputationUpdated": return "Reputation Update";
    case "EndorsementAdded": return "Endorsement";
    case "EndorsementRemoved": return "Endorsement Removed";
    default: return eventType;
  }
}

function getEventTypeColor(eventType: string): string {
  switch (eventType) {
    case "FeedbackPosted": return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "ReputationUpdated": return "bg-purple-500/15 text-purple-700 dark:text-purple-400";
    case "EndorsementAdded": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "EndorsementRemoved": return "bg-red-500/15 text-red-700 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function getEventTypeIcon(eventType: string) {
  switch (eventType) {
    case "FeedbackPosted": return MessageSquare;
    case "ReputationUpdated": return Star;
    case "EndorsementAdded": return Award;
    case "EndorsementRemoved": return Award;
    default: return Star;
  }
}

function sourceColorClasses(color: string): { badge: string; border: string; avatar: string } {
  switch (color) {
    case "emerald":
      return { badge: "bg-emerald-600 text-white", border: "border-l-2 border-emerald-500", avatar: "#059669" };
    case "blue":
      return { badge: "bg-blue-600 text-white", border: "border-l-2 border-blue-500", avatar: "#2563eb" };
    case "violet":
      return { badge: "bg-violet-600 text-white", border: "border-l-2 border-violet-500", avatar: "#7c3aed" };
    default:
      return { badge: "bg-muted text-muted-foreground", border: "", avatar: "#6b7280" };
  }
}

function ReputationTab({ feedback, isLoading }: { feedback: FeedbackSummary | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-md" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  const hasFeedback = feedback && feedback.feedbackCount > 0;
  const sources = feedback?.sources ?? {};
  const sybilFlags = feedback?.sybilFlags ?? [];
  const hasCriticalFlags = sybilFlags.some((f) => f.severity === "critical");
  const hasWarningFlags = sybilFlags.some((f) => f.severity === "warning");
  const knownSourceCount = Object.keys(sources).length;

  if (!hasFeedback) {
    return (
      <Card className="p-6" data-testid="card-reputation-empty">
        <div className="flex flex-col items-center text-center max-w-md mx-auto py-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <Star className="w-7 h-7 text-amber-500" />
          </div>
          <h3 className="font-semibold text-base mb-2">No Reputation Data Yet</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {PROFILE.reputationEmpty}
          </p>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Reputation data comes from on-chain feedback events, community signals, and protocol interactions — giving you a transparent view of this agent's track record.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {(hasCriticalFlags || hasWarningFlags) && (
        <div className="space-y-2" data-testid="section-sybil-flags">
          {sybilFlags.map((flag, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
                flag.severity === "critical"
                  ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
              data-testid={`alert-sybil-${flag.type}`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium capitalize">{flag.type.replace(/_/g, " ")}: </span>
                {flag.description}
              </div>
            </div>
          ))}
        </div>
      )}

      {knownSourceCount > 0 && (
        <div className="space-y-2" data-testid="section-known-sources">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Verified Sources</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(sources).map((source) => {
              const colors = sourceColorClasses(source.color);
              return (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${colors.badge} hover:opacity-90 transition-opacity`}
                  title={source.description}
                  data-testid={`badge-source-${source.id}`}
                >
                  <Shield className="w-3 h-3" />
                  {source.name}
                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-4" data-testid="card-reputation-summary">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Total Feedback</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-feedback-count">{feedback.feedbackCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Unique Reviewers</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-unique-reviewers">{feedback.uniqueReviewers}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">First Feedback</span>
          </div>
          <p className="text-sm font-semibold" data-testid="text-first-feedback">
            {feedback.firstFeedbackBlock ? `Block ${feedback.firstFeedbackBlock.toLocaleString()}` : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Latest Feedback</span>
          </div>
          <p className="text-sm font-semibold" data-testid="text-latest-feedback">
            {feedback.lastFeedbackBlock ? `Block ${feedback.lastFeedbackBlock.toLocaleString()}` : "—"}
          </p>
        </Card>
      </div>

      <div className="space-y-3" data-testid="list-feedback-events">
        {feedback.events.map((event) => {
          const Icon = getEventTypeIcon(event.eventType);
          const rawData = event.rawData as Record<string, unknown> | null;
          const reviewer = rawData && typeof rawData === "object" && "reviewer" in rawData
            ? String(rawData.reviewer)
            : null;
          const feedbackUri = rawData && typeof rawData === "object" && "feedbackURI" in rawData
            ? String(rawData.feedbackURI)
            : rawData && typeof rawData === "object" && "uri" in rawData
              ? String(rawData.uri)
              : null;
          const knownSource = reviewer ? (sources[reviewer.toLowerCase()] ?? null) : null;
          const reviewerColor = knownSource
            ? sourceColorClasses(knownSource.color).avatar
            : reviewer ? addressToColor(reviewer) : "hsl(0, 0%, 50%)";
          const borderClass = knownSource ? sourceColorClasses(knownSource.color).border : "";

          return (
            <Card key={event.id} className={`p-4 ${borderClass}`} data-testid={`card-feedback-${event.id}`}>
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback
                    style={{ backgroundColor: reviewerColor, color: "white" }}
                    className="text-xs font-semibold"
                  >
                    {knownSource ? knownSource.shortName.slice(0, 2).toUpperCase() : reviewer ? reviewer.slice(2, 4).toUpperCase() : "??"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${getEventTypeColor(event.eventType)}`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {getEventTypeLabel(event.eventType)}
                    </Badge>
                    {knownSource && (
                      <Badge
                        className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${sourceColorClasses(knownSource.color).badge}`}
                        data-testid={`badge-event-source-${event.id}`}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {knownSource.name}
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      Block {event.blockNumber.toLocaleString()}
                    </span>
                  </div>
                  {knownSource && (
                    <p className="text-xs text-muted-foreground mt-1 leading-snug max-w-prose">
                      {knownSource.description}
                    </p>
                  )}
                  {reviewer && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">From</span>
                      <a
                        href={getExplorerAddressUrl(event.chainId, reviewer)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-primary hover:underline"
                        data-testid={`link-reviewer-${event.id}`}
                      >
                        {knownSource ? knownSource.name : `${reviewer.slice(0, 6)}...${reviewer.slice(-4)}`}
                      </a>
                    </div>
                  )}
                  {feedbackUri && (
                    <a
                      href={feedbackUri.startsWith("ipfs://")
                        ? `https://ipfs.io/ipfs/${feedbackUri.slice(7)}`
                        : feedbackUri.startsWith("http") ? feedbackUri : `https://${feedbackUri}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      data-testid={`link-feedback-uri-${event.id}`}
                    >
                      <FileText className="w-3 h-3" />
                      View feedback details
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <a
                      href={getExplorerTxUrl(event.chainId, event.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-muted-foreground hover:underline"
                      data-testid={`link-tx-feedback-${event.id}`}
                    >
                      tx: {event.txHash.slice(0, 10)}...{event.txHash.slice(-6)}
                    </a>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(event.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function HealthScoreRing({ score }: { score: number }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-500";
  const bgColor = score >= 70 ? "stroke-emerald-500/15" : score >= 40 ? "stroke-amber-500/15" : "stroke-red-500/15";

  return (
    <div className="relative inline-flex items-center justify-center" data-testid="health-score-ring">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" className={bgColor} strokeWidth="6" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          className={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold ${color}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function FarcasterSection({ data }: { data: CommunityFeedbackResponse }) {
  const summary = data.summary!;
  const farcaster = data.farcaster!;
  const profile = farcaster.items.find((i) => i.itemType === "profile_snapshot");
  const casts = farcaster.items.filter((i) => i.itemType === "cast").slice(0, 5);
  const username = farcaster.source.platformIdentifier;
  const profileData = profile?.rawData as Record<string, any> | null;
  const scorePercent = summary.farcasterScore != null ? Math.round(summary.farcasterScore * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <SiFarcaster className="w-5 h-5 text-[#8A63D2]" />
        <h3 className="text-sm font-semibold">Farcaster Activity</h3>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 md:col-span-2" data-testid="card-farcaster-profile">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <a
                href={`https://warpcast.com/${username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold hover:underline flex items-center gap-1"
                data-testid="link-farcaster-profile"
              >
                @{username}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              {profile?.contentSnippet && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{profile.contentSnippet}</p>
              )}
            </div>
            {profileData?.powerBadge && (
              <Badge className="bg-[#8A63D2] text-white text-[10px] flex-shrink-0" data-testid="badge-farcaster-power">
                Power Badge
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-1.5 text-sm" data-testid="stat-farcaster-followers">
              <Users className="w-4 h-4 text-[#8A63D2]" />
              <span className="font-medium">{(summary.farcasterFollowers ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">followers</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm" data-testid="stat-farcaster-following">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="font-medium">{(summary.farcasterFollowing ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">following</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm" data-testid="stat-farcaster-casts">
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              <span className="font-medium">{summary.farcasterTotalCasts ?? 0}</span>
              <span className="text-xs text-muted-foreground">casts</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm" data-testid="stat-farcaster-engagement">
              <Activity className="w-4 h-4 text-amber-500" />
              <span className="font-medium">{summary.farcasterEngagementAvg?.toFixed(1) ?? "0"}</span>
              <span className="text-xs text-muted-foreground">avg engagement</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
            {summary.farcasterFid && (
              <div className="flex items-center gap-1" data-testid="stat-farcaster-fid">
                FID: {summary.farcasterFid}
              </div>
            )}
            {summary.farcasterLastCastAt && (
              <div className="flex items-center gap-1" data-testid="stat-farcaster-last-cast">
                <Clock className="w-3 h-3" />
                Last cast: {formatRelativeTime(summary.farcasterLastCastAt as string)}
              </div>
            )}
            {farcaster.source.lastScrapedAt && (
              <div className="flex items-center gap-1" data-testid="stat-farcaster-last-scraped">
                <Clock className="w-3 h-3" />
                Updated: {formatRelativeTime(farcaster.source.lastScrapedAt as string)}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 flex flex-col items-center justify-center" data-testid="card-farcaster-score">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Neynar Score</h4>
          {scorePercent != null ? (
            <>
              <div className="relative inline-flex items-center justify-center">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" className={scorePercent >= 70 ? "stroke-[#8A63D2]/15" : scorePercent >= 40 ? "stroke-amber-500/15" : "stroke-red-500/15"} strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    className={scorePercent >= 70 ? "stroke-[#8A63D2]" : scorePercent >= 40 ? "stroke-amber-500" : "stroke-red-500"}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={Math.PI * 2 * 34} strokeDashoffset={Math.PI * 2 * 34 - (scorePercent / 100) * Math.PI * 2 * 34}
                    transform="rotate(-90 40 40)"
                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-lg font-bold ${scorePercent >= 70 ? "text-[#8A63D2]" : scorePercent >= 40 ? "text-amber-500" : "text-red-500"}`}>{scorePercent}%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {scorePercent >= 70 ? "High trust" : scorePercent >= 40 ? "Moderate trust" : "Low trust"}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No score available</p>
          )}
        </Card>
      </div>

      {casts.length > 0 && (
        <Card className="p-4" data-testid="card-farcaster-casts">
          <h4 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Recent Casts
          </h4>
          <div className="space-y-2">
            {casts.map((cast) => {
              const castData = cast.rawData as Record<string, any> | null;
              return (
                <a
                  key={cast.id}
                  href={cast.externalUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded-md hover:bg-muted/50 transition-colors"
                  data-testid={`link-cast-${cast.id}`}
                >
                  <p className="text-sm line-clamp-2">{cast.contentSnippet}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    {cast.postedAt && <span>{formatRelativeTime(cast.postedAt as string)}</span>}
                    {castData && (
                      <>
                        <span className="flex items-center gap-0.5">
                          <Heart className="w-3 h-3" /> {castData.likes ?? 0}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <ArrowRight className="w-3 h-3" /> {castData.recasts ?? 0}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="w-3 h-3" /> {castData.replies ?? 0}
                        </span>
                      </>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function GitHubSection({ data }: { data: CommunityFeedbackResponse }) {
  const summary = data.summary!;
  const github = data.github!;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <SiGithub className="w-5 h-5" />
        <h3 className="text-sm font-semibold">GitHub Activity</h3>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 md:col-span-2" data-testid="card-github-repo">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <a
                href={`https://github.com/${github.source.platformIdentifier}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold hover:underline flex items-center gap-1"
                data-testid="link-github-repo"
              >
                {github.source.platformIdentifier}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              {summary.githubDescription && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{summary.githubDescription}</p>
              )}
            </div>
            {summary.githubLanguage && (
              <Badge variant="outline" className="text-xs flex-shrink-0" data-testid="badge-github-language">
                <Code className="w-3 h-3 mr-1" />
                {summary.githubLanguage}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-1.5 text-sm" data-testid="stat-github-stars">
              <Star className="w-4 h-4 text-amber-500" />
              <span className="font-medium">{(summary.githubStars ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">stars</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm" data-testid="stat-github-forks">
              <GitBranch className="w-4 h-4 text-blue-500" />
              <span className="font-medium">{(summary.githubForks ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">forks</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm" data-testid="stat-github-issues">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span className="font-medium">{summary.githubOpenIssues ?? 0}</span>
              <span className="text-xs text-muted-foreground">issues</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm" data-testid="stat-github-contributors">
              <Users className="w-4 h-4 text-purple-500" />
              <span className="font-medium">{summary.githubContributors ?? 0}</span>
              <span className="text-xs text-muted-foreground">contributors</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1" data-testid="stat-github-last-commit">
              <Activity className="w-3 h-3" />
              Last commit: {formatRelativeTime(summary.githubLastCommitAt as string | null)}
            </div>
            {github.source.lastScrapedAt && (
              <div className="flex items-center gap-1" data-testid="stat-github-last-scraped">
                <Clock className="w-3 h-3" />
                Updated: {formatRelativeTime(github.source.lastScrapedAt as string | null)}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 flex flex-col items-center justify-center" data-testid="card-github-health">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">GitHub Health</h4>
          <HealthScoreRing score={summary.githubHealthScore ?? 0} />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {(summary.githubHealthScore ?? 0) >= 70
              ? "Active & healthy"
              : (summary.githubHealthScore ?? 0) >= 40
                ? "Moderate activity"
                : "Low activity"}
          </p>
        </Card>
      </div>

      {github.items.filter((i) => i.itemType === "issue").length > 0 && (
        <Card className="p-4" data-testid="card-github-issues">
          <h4 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Recent Open Issues
          </h4>
          <div className="space-y-2">
            {github.items
              .filter((i) => i.itemType === "issue")
              .slice(0, 5)
              .map((issue) => (
                <a
                  key={issue.id}
                  href={issue.externalUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded-md hover:bg-muted/50 transition-colors"
                  data-testid={`link-issue-${issue.id}`}
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{issue.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {issue.author && <span>by {issue.author}</span>}
                        {issue.postedAt && <span>{formatRelativeTime(issue.postedAt as string)}</span>}
                        {(issue.rawData as any)?.labels?.map((label: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px] px-1 py-0">{label}</Badge>
                        ))}
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                </a>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function CommunityTab({ data, isLoading }: { data: CommunityFeedbackResponse | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const hasGithub = data?.github && data.summary?.githubStars !== null && data.summary?.githubStars !== undefined;
  const hasFarcaster = data?.farcaster && data.summary?.farcasterFid !== null && data.summary?.farcasterFid !== undefined;

  return (
    <div className="space-y-6">
      {hasGithub && data?.summary && data?.github && (
        <GitHubSection data={data} />
      )}

      {hasFarcaster && data?.summary && data?.farcaster && (
        <FarcasterSection data={data} />
      )}

      {!hasGithub && !hasFarcaster && (
        <Card className="p-6 text-center" data-testid="card-no-community">
          <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <h3 className="text-sm font-semibold mb-1">No Community Data Yet</h3>
          <p className="text-xs text-muted-foreground">
            Community feedback data hasn't been collected for this agent yet.
          </p>
        </Card>
      )}

      <Card className="p-4 opacity-60" data-testid="card-twitter-coming-soon">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-4 h-4 text-sky-500" />
          <h4 className="text-sm font-semibold">Twitter / X Sentiment</h4>
        </div>
        <p className="text-xs text-muted-foreground">Coming soon — community mentions and sentiment analysis</p>
      </Card>
    </div>
  );
}

function ReputationSignalsCard({ feedback, onTabSwitch }: { feedback: FeedbackSummary | undefined; onTabSwitch: () => void }) {
  if (!feedback || feedback.feedbackCount === 0) return null;

  const knownSources = Object.values(feedback.sources ?? {});
  const hasSybilFlags = (feedback.sybilFlags ?? []).length > 0;
  const hasCritical = (feedback.sybilFlags ?? []).some((f) => f.severity === "critical");

  return (
    <Card className="p-4 md:col-span-2" data-testid="card-reputation-signals">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${hasCritical ? "bg-red-500/10" : "bg-amber-500/10"}`}>
            <Star className={`w-4 h-4 ${hasCritical ? "text-red-500" : "text-amber-500"}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Reputation Signals</h3>
            <p className="text-xs text-muted-foreground">
              {feedback.feedbackCount} feedback event{feedback.feedbackCount !== 1 ? "s" : ""}
              {knownSources.length > 0 && (
                <> · {knownSources.map((s) => s.name).join(", ")}</>
              )}
              {hasSybilFlags && (
                <span className={`ml-1 font-medium ${hasCritical ? "text-red-500" : "text-amber-500"}`}>
                  · {hasCritical ? "⚠ flags detected" : "flags detected"}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="gap-1" onClick={onTabSwitch} data-testid="button-view-reputation">
          View details
          <ArrowRight className="w-3 h-3" />
        </Button>
      </div>
    </Card>
  );
}

export default function AgentProfile() {
  const [, params] = useRoute("/agent/:id");
  const id = params?.id;
  const [activeTab, setActiveTab] = useState("overview");

  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery<Agent>({
    queryKey: ["/api/agents", id],
    enabled: !!id,
  });

  const { data: events, isLoading: eventsLoading } = useQuery<AgentMetadataEvent[]>({
    queryKey: ["/api/agents", id, "history"],
    enabled: !!id,
  });

  const { data: feedback, isLoading: feedbackLoading } = useQuery<FeedbackSummary>({
    queryKey: ["/api/agents", id, "feedback"],
    enabled: !!id,
  });

  const { data: agentTxStats } = useQuery<{
    totalVolume: number; txCount: number; uniquePayers: number; lastTxAt: string | null;
  }>({
    queryKey: ["/api/agents", id, "transactions", "stats"],
    enabled: !!agent,
  });

  const { data: agentTxns } = useQuery<Array<{
    id: number; chainId: number; txHash: string; fromAddress: string; toAddress: string;
    tokenSymbol: string; amount: string; amountUsd: number | null; blockTimestamp: string; category: string;
  }>>({
    queryKey: ["/api/agents", id, "transactions"],
    enabled: !!agent && activeTab === "transactions",
  });

  const { data: communityFeedback, isLoading: communityLoading } = useQuery<CommunityFeedbackResponse>({
    queryKey: ["/api/agents", id, "community-feedback"],
    enabled: !!id,
  });

  useEffect(() => {
    if (!agent) return;
    const chain = getChain(agent.chainId);
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: agent.name ?? `Agent #${agent.erc8004Id}`,
      description: agent.description ?? `An AI agent on ${chain?.name ?? "EVM"} tracked by TrustAdd.`,
      url: `https://trustadd.com/agent/${agent.slug ?? agent.id}`,
      identifier: agent.primaryContractAddress,
      applicationCategory: "AI Agent",
      operatingSystem: chain?.name ?? "EVM Blockchain",
      aggregateRating: agent.trustScore != null ? {
        "@type": "AggregateRating",
        ratingValue: agent.trustScore,
        bestRating: 100,
        worstRating: 0,
        ratingCount: 1,
      } : undefined,
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "agent-jsonld";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => {
      document.getElementById("agent-jsonld")?.remove();
    };
  }, [agent]);

  if (agentLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Skeleton className="h-6 w-24 mb-6" />
          <div className="flex items-start gap-4 mb-6">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      </Layout>
    );
  }

  if (agentError || !agent) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Shield className="w-10 h-10 text-muted-foreground mb-3" />
              <h2 className="font-semibold text-lg mb-1">Agent not found</h2>
              <p className="text-sm text-muted-foreground mb-4">
                This agent may not exist or hasn't been indexed yet.
              </p>
              <Link href="/agents">
                <Button variant="outline" className="gap-2" data-testid="button-back-to-directory">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Directory
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  const color = addressToColor(agent.primaryContractAddress);
  const initials = getInitials(agent.name, agent.primaryContractAddress);
  const completeness = calculateCompleteness(agent);
  const endpointsList = getEndpointsList(agent.endpoints);

  return (
    <Layout>
      <SEO
        title={agent.name ? `${agent.name} — Agent Profile` : `Agent #${agent.erc8004Id} — Profile`}
        description={agent.description || PROFILE.defaultSeoDescription(agent.erc8004Id, getChain(agent.chainId)?.name || "EVM")}
        path={`/agent/${agent.slug ?? agent.id}`}
      />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/agents">
          <Button variant="ghost" size="sm" className="gap-1 mb-4 -ml-2" data-testid="button-back">
            <ArrowLeft className="w-3 h-3" />
            Back
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
          <Avatar className="h-20 w-20 flex-shrink-0">
            {agent.imageUrl && (
              <AvatarImage src={agent.imageUrl} alt={agent.name || "Agent avatar"} className="object-cover" data-testid="img-agent-avatar" />
            )}
            <AvatarFallback
              style={{ backgroundColor: color, color: "white" }}
              className="text-2xl font-semibold"
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight" data-testid="text-agent-name">
                {agent.name || `Agent #${agent.erc8004Id}`}
              </h1>
              {agent.trustScore != null && (
                <TrustScoreRing score={agent.trustScore} size="sm" />
              )}
              <CompletenessIndicator percentage={completeness} />
              <ChainBadge chainId={agent.chainId} size="md" />
              {agent.x402Support && (
                <Badge className="bg-emerald-600 text-white no-default-hover-elevate no-default-active-elevate" data-testid="badge-x402-support">
                  <CreditCard className="w-3 h-3 mr-1" />
                  x402 Payments
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed" data-testid="text-agent-description">
              {agent.description || PROFILE.defaultDescription(getChain(agent.chainId)?.name ?? "Ethereum")}
            </p>
          </div>

          {agent.trustScore != null && (
            <div className="hidden sm:block flex-shrink-0">
              <TrustScoreRing score={agent.trustScore} size="lg" />
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList data-testid="tabs-agent">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="reputation" data-testid="tab-reputation">Reputation</TabsTrigger>
            <TabsTrigger value="community" data-testid="tab-community">Community</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
            <TabsTrigger value="transactions" data-testid="tab-transactions">
              Transactions
              {agentTxStats && agentTxStats.txCount > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {agentTxStats.txCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="technical" data-testid="tab-technical">Technical</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {agent.trustScore != null && agent.trustScoreBreakdown && (
              <Card className="p-4 mb-4">
                <div className="flex items-start gap-6">
                  <div className="flex flex-col items-center gap-1">
                    <TrustScoreRing score={agent.trustScore} size="lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-3">Score Breakdown</h3>
                    <TrustScoreBreakdownBar breakdown={agent.trustScoreBreakdown as any} />
                  </div>
                </div>
              </Card>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-1">Identity Details</h3>
                <div className="divide-y">
                  <DetailRow
                    icon={Layers}
                    label="Chain"
                    value={getChain(agent.chainId)?.name ?? "Unknown"}
                  />
                  <DetailRow
                    icon={Shield}
                    label="Contract Address"
                    value={agent.primaryContractAddress}
                    mono
                    link={getExplorerAddressUrl(agent.chainId, agent.primaryContractAddress)}
                  />
                  <DetailRow
                    icon={User}
                    label="Controller"
                    value={agent.controllerAddress}
                    mono
                    link={getExplorerAddressUrl(agent.chainId, agent.controllerAddress)}
                  />
                  <DetailRow
                    icon={Hash}
                    label="ERC-8004 ID"
                    value={agent.erc8004Id}
                    mono
                  />
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-1">Discovery Info</h3>
                <div className="divide-y">
                  <DetailRow
                    icon={Blocks}
                    label="First Seen"
                    value={`Block ${agent.firstSeenBlock.toLocaleString()}`}
                  />
                  <DetailRow
                    icon={Clock}
                    label="Last Updated"
                    value={`Block ${agent.lastUpdatedBlock.toLocaleString()}`}
                  />
                  <DetailRow
                    icon={FileText}
                    label="Status"
                    value={PROFILE.statusDiscovery}
                  />
                </div>
              </Card>

              {agent.capabilities && agent.capabilities.length > 0 && (
                <Card className="p-4 md:col-span-2" data-testid="card-capabilities">
                  <h3 className="text-sm font-semibold mb-2">Declared Capabilities</h3>
                  <div className="flex flex-wrap gap-2">
                    {agent.capabilities.map((cap, i) => (
                      <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-capability-${i}`}>
                        <Zap className="w-3 h-3 mr-1" />
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {agent.oasfSkills && agent.oasfSkills.length > 0 && (
                <Card className="p-4" data-testid="card-skills">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Skills</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {agent.oasfSkills.map((skill, i) => (
                      <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-skill-${i}`}>
                        {formatSkillLabel(skill)}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {agent.oasfDomains && agent.oasfDomains.length > 0 && (
                <Card className="p-4" data-testid="card-domains">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Domains</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {agent.oasfDomains.map((domain, i) => (
                      <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-domain-${i}`}>
                        {formatSkillLabel(domain)}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {agent.tags && agent.tags.length > 0 && (
                <Card className="p-4" data-testid="card-tags">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Tags</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {agent.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-tag-${i}`}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {endpointsList.length > 0 && (
                <Card className="p-4" data-testid="card-endpoints">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Endpoints & Services</h3>
                  </div>
                  <div className="space-y-2">
                    {endpointsList.map((ep, i) => (
                      <div key={i} className="flex items-center gap-2" data-testid={`endpoint-${i}`}>
                        <span className="text-xs font-medium text-muted-foreground">{ep.name}</span>
                        <a
                          href={ep.endpoint.startsWith("http") ? ep.endpoint : `https://${ep.endpoint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-primary hover:underline truncate flex items-center gap-1"
                          data-testid={`link-endpoint-${i}`}
                        >
                          {ep.endpoint}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {agent.supportedTrust && agent.supportedTrust.length > 0 && (
                <Card className="p-4" data-testid="card-trust">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Trust Mechanisms</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {agent.supportedTrust.map((trust, i) => (
                      <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-trust-${i}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        {toTitleCase(trust)}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              <ReputationSignalsCard feedback={feedback} onTabSwitch={() => setActiveTab("reputation")} />
            </div>
          </TabsContent>

          <TabsContent value="reputation">
            <ReputationTab feedback={feedback} isLoading={feedbackLoading} />
          </TabsContent>

          <TabsContent value="community">
            <CommunityTab data={communityFeedback} isLoading={communityLoading} />
          </TabsContent>

          <TabsContent value="history">
            <EventTimeline events={events ?? []} isLoading={eventsLoading} />
          </TabsContent>

          <TabsContent value="transactions">
            <Card className="p-4">
              {agentTxStats && agentTxStats.txCount > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold">${agentTxStats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground">Total Volume</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold">{agentTxStats.txCount}</p>
                      <p className="text-xs text-muted-foreground">Transactions</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold">{agentTxStats.uniquePayers}</p>
                      <p className="text-xs text-muted-foreground">Unique Payers</p>
                    </div>
                  </div>

                  {agentTxns && agentTxns.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium mb-2">Transaction History</h4>
                      {agentTxns.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                          data-testid={`agent-tx-${tx.id}`}
                        >
                          <div className={`w-2 h-2 rounded-full ${tx.category === "incoming" ? "bg-emerald-500" : "bg-amber-500"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground uppercase">{tx.category}</span>
                              <code className="text-[11px] text-muted-foreground font-mono">
                                {tx.category === "incoming" ? tx.fromAddress.slice(0, 10) : tx.toAddress.slice(0, 10)}...
                              </code>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-sm font-medium">
                              {tx.amountUsd ? `$${tx.amountUsd.toFixed(2)}` : `${parseFloat(tx.amount).toFixed(2)} ${tx.tokenSymbol}`}
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(tx.blockTimestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No transaction data available for this agent.</p>
                  <p className="text-xs mt-1">Transaction data is indexed from discovered payment addresses.</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="technical">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Raw Agent Data</h3>
              <pre className="text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto text-muted-foreground" data-testid="text-raw-data">
                {JSON.stringify(agent, null, 2)}
              </pre>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
