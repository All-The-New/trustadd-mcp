import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { AgentMetadataEvent } from "@shared/schema";
import { getChain } from "@shared/chains";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChainBadge } from "@/components/chain-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus,
  FileEdit,
  MessageSquare,
  TrendingUp,
  Award,
  RefreshCw,
} from "lucide-react";

interface RecentEvent {
  event: AgentMetadataEvent;
  agentName: string | null;
  agentImage: string | null;
  agentErc8004Id: string;
  agentId: string;
  agentSlug: string | null;
}

function addressToColor(address: string): string {
  const hash = address.slice(2, 8);
  const hue = parseInt(hash, 16) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

function getInitials(name: string | null, erc8004Id: string): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return erc8004Id.slice(0, 2).toUpperCase();
}

function getEventConfig(eventType: string) {
  switch (eventType) {
    case "AgentRegistered":
      return {
        icon: UserPlus,
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-500/10",
        action: "was discovered",
        label: "discovered",
      };
    case "MetadataUpdated":
      return {
        icon: FileEdit,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-500/10",
        action: "updated their profile",
        label: "profile updated",
      };
    case "FeedbackPosted":
      return {
        icon: MessageSquare,
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-500/10",
        action: "received feedback",
        label: "feedback received",
      };
    case "ReputationUpdated":
      return {
        icon: TrendingUp,
        color: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-500/10",
        action: "reputation updated",
        label: "reputation updated",
      };
    case "EndorsementAdded":
      return {
        icon: Award,
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-500/10",
        action: "received an endorsement",
        label: "endorsement received",
      };
    case "IdentityUpdated":
      return {
        icon: RefreshCw,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-500/10",
        action: "updated their identity",
        label: "identity updated",
      };
    default:
      return {
        icon: RefreshCw,
        color: "text-muted-foreground",
        bgColor: "bg-muted",
        action: "had an event",
        label: eventType,
      };
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function getAgentDisplayName(
  agentName: string | null,
  erc8004Id: string,
): string {
  if (agentName) return agentName;
  return `Agent #${erc8004Id}`;
}

function enrichAction(eventType: string, rawData: unknown, chainId?: number): string {
  const config = getEventConfig(eventType);
  const data = rawData as Record<string, unknown> | null;

  if (eventType === "AgentRegistered" && chainId) {
    const chain = getChain(chainId);
    if (chain) return `was discovered on ${chain.name}`;
  }

  if (eventType === "FeedbackPosted" && data && typeof data.reviewer === "string") {
    const reviewer = data.reviewer as string;
    const short = `${reviewer.slice(0, 6)}...${reviewer.slice(-4)}`;
    return `received feedback from ${short}`;
  }

  if (eventType === "EndorsementAdded" && data && typeof data.endorser === "string") {
    const endorser = data.endorser as string;
    const short = `${endorser.slice(0, 6)}...${endorser.slice(-4)}`;
    return `received an endorsement from ${short}`;
  }

  return config.action;
}

interface ActivityFeedProps {
  limit?: number;
  className?: string;
  showHeader?: boolean;
}

export function ActivityFeed({ limit = 15, className, showHeader = true }: ActivityFeedProps) {
  const { data: events, isLoading } = useQuery<RecentEvent[]>({
    queryKey: ["/api/events/recent", { limit }],
    queryFn: () =>
      fetch(`/api/events/recent?limit=${limit}`).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  return (
    <div data-testid="section-activity-feed" className={`flex flex-col ${className ?? ""}`}>
      {showHeader && (
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <div className="relative flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" data-testid="indicator-live" />
          </div>
          <h3 className="text-sm font-semibold">Live Activity</h3>
        </div>
      )}

      <div className="space-y-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <ActivityItemSkeleton key={i} />
          ))
        ) : events && events.length > 0 ? (
          events.map((item) => (
            <ActivityItem key={item.event.id} item={item} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No recent activity
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ item }: { item: RecentEvent }) {
  const config = getEventConfig(item.event.eventType);
  const Icon = config.icon;
  const displayName = getAgentDisplayName(item.agentName, item.agentErc8004Id);
  const action = enrichAction(item.event.eventType, item.event.rawData, item.event.chainId);
  const timeStr = formatRelativeTime(new Date(item.event.createdAt));
  const color = addressToColor(item.agentErc8004Id);
  const initials = getInitials(item.agentName, item.agentErc8004Id);

  return (
    <Link href={`/agent/${item.agentSlug || item.agentId}`}>
      <div
        className="flex items-start gap-2.5 p-2 rounded-md hover-elevate cursor-pointer transition-colors"
        data-testid={`activity-item-${item.event.id}`}
      >
        <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
          {item.agentImage && (
            <AvatarImage src={item.agentImage} alt={displayName} />
          )}
          <AvatarFallback
            style={{ backgroundColor: color, color: "white" }}
            className="text-[10px] font-semibold"
          >
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="text-xs leading-relaxed">
            <span className="font-medium truncate">{displayName}</span>{" "}
            <span className="text-muted-foreground">{action}</span>
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <ChainBadge chainId={item.event.chainId} />
            <div className={`flex items-center gap-1 ${config.color}`}>
              <Icon className="w-3 h-3" />
              <span className="text-[10px] capitalize">{config.label}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{timeStr}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-2.5 p-2">
      <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
    </div>
  );
}
