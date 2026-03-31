import type { AgentMetadataEvent } from "@shared/schema";
import { getExplorerTxUrl } from "@shared/chains";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  FileText,
  Star,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  CircleDot,
} from "lucide-react";

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "AgentRegistered":
      return UserPlus;
    case "MetadataUpdated":
    case "IdentityUpdated":
      return FileText;
    case "ReputationUpdated":
      return Star;
    case "EndorsementAdded":
      return ThumbsUp;
    case "EndorsementRemoved":
      return ThumbsDown;
    default:
      return CircleDot;
  }
}

function getEventLabel(eventType: string): string {
  switch (eventType) {
    case "AgentRegistered":
      return "Identity Created";
    case "MetadataUpdated":
      return "Metadata Updated";
    case "IdentityUpdated":
      return "Identity Updated";
    case "ReputationUpdated":
      return "Reputation Signal Updated";
    case "EndorsementAdded":
      return "Endorsement Added";
    case "EndorsementRemoved":
      return "Endorsement Removed";
    default:
      return eventType;
  }
}

function getEventVariant(eventType: string): "default" | "secondary" | "outline" {
  switch (eventType) {
    case "AgentRegistered":
      return "default";
    case "EndorsementAdded":
    case "EndorsementRemoved":
      return "outline";
    default:
      return "secondary";
  }
}

interface EventTimelineProps {
  events: AgentMetadataEvent[];
  isLoading?: boolean;
}

export function EventTimeline({ events, isLoading }: EventTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-3 w-48 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No on-chain events recorded yet for this agent.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const Icon = getEventIcon(event.eventType);
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="flex gap-3" data-testid={`event-${event.id}`}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-card border">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border my-1" />}
            </div>

            <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getEventVariant(event.eventType)} className="text-[10px]">
                  {getEventLabel(event.eventType)}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  Block {event.blockNumber.toLocaleString()}
                </span>
              </div>

              <a
                href={getExplorerTxUrl(event.chainId, event.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-primary hover:underline mt-1 inline-block"
                data-testid={`link-tx-${event.id}`}
              >
                {event.txHash.slice(0, 10)}...{event.txHash.slice(-8)}
              </a>

              {event.rawData && typeof event.rawData === "object" && (() => {
                const str = JSON.stringify(event.rawData, null, 2);
                return (
                  <div className="mt-2 text-[11px] font-mono text-muted-foreground bg-muted/50 p-2 rounded-md overflow-x-auto">
                    <span>{str.slice(0, 200)}</span>
                    {str.length > 200 && <span>...</span>}
                  </div>
                );
              })()}

              <p className="text-[11px] text-muted-foreground mt-1">
                {new Date(event.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
