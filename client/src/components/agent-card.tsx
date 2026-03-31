import { Link } from "wouter";
import type { Agent } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChainBadge } from "@/components/chain-badge";
import { Shield, CreditCard, Globe, Hash, Bot } from "lucide-react";

function addressToColor(address: string): string {
  const hash = address.slice(2, 8);
  const hue = parseInt(hash, 16) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortenAddressMobile(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
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

function getTrustScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function getTrustScoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-500/10 border-emerald-500/30";
  if (score >= 40) return "bg-amber-500/10 border-amber-500/30";
  return "bg-red-500/10 border-red-500/30";
}

function getProfileCompleteness(agent: Agent): number {
  const fields = [
    agent.name,
    agent.description,
    agent.imageUrl,
    agent.metadataUri,
  ];
  const filled = fields.filter((f) => f !== null && f !== undefined && f !== "").length;
  return Math.round((filled / fields.length) * 100);
}

interface AgentCardProps {
  agent: Agent;
}

function getEndpointCount(endpoints: unknown): number {
  if (Array.isArray(endpoints)) return endpoints.length;
  if (endpoints && typeof endpoints === "object" && !Array.isArray(endpoints)) {
    return Object.keys(endpoints).length;
  }
  return 0;
}

export function AgentCard({ agent }: AgentCardProps) {
  const color = addressToColor(agent.primaryContractAddress);
  const initials = getInitials(agent.name, agent.primaryContractAddress);
  const endpointCount = getEndpointCount(agent.endpoints);
  const profilePct = getProfileCompleteness(agent);

  return (
    <Link href={`/agent/${agent.slug || agent.id}`}>
      <Card
        className="hover-elevate cursor-pointer p-4 transition-all group"
        data-testid={`card-agent-${agent.id}`}
      >
        <div className="flex items-stretch gap-3.5">
          {/* Left column: avatar top, trust score bottom */}
          <div className="flex flex-col items-center justify-between flex-shrink-0">
            <Avatar className="h-16 w-16 ring-2 ring-border/50">
              {agent.imageUrl && (
                <AvatarImage src={agent.imageUrl} alt={agent.name ?? "Agent avatar"} data-testid={`img-avatar-${agent.id}`} />
              )}
              <AvatarFallback
                style={{ backgroundColor: color, color: "white" }}
                className="text-base font-bold"
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {agent.trustScore != null && (
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-bold ${getTrustScoreBg(agent.trustScore)}`}
                data-testid={`badge-trust-score-${agent.id}`}
              >
                <Shield className={`w-3.5 h-3.5 ${getTrustScoreColor(agent.trustScore)}`} fill="currentColor" stroke="none" />
                <span className={getTrustScoreColor(agent.trustScore)}>{agent.trustScore}</span>
              </div>
            )}
          </div>

          {/* Right column: name, description, badge row */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate flex-1 min-w-0" data-testid={`text-agent-name-${agent.id}`}>
                {agent.name || `Agent #${agent.erc8004Id}`}
              </h3>
              <span className="shrink-0"><ChainBadge chainId={agent.chainId} /></span>
            </div>

            <div className="flex-1 min-h-[3rem] overflow-hidden">
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {agent.description ?? ""}
              </p>
            </div>

            {/* Badge row — full width, justify-between on all sizes */}
            <div className="flex items-center justify-between mt-0.5 w-full">
              <Badge
                variant="outline"
                className="text-[10px] gap-1 font-mono px-1.5 sm:px-2.5 shrink-0 no-default-hover-elevate no-default-active-elevate"
                data-testid={`badge-address-${agent.id}`}
              >
                <Hash className="w-3 h-3 shrink-0" />
                <span className="sm:hidden">{shortenAddressMobile(agent.primaryContractAddress)}</span>
                <span className="hidden sm:inline">{shortenAddress(agent.primaryContractAddress)}</span>
              </Badge>
              {agent.x402Support && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 px-1.5 sm:px-2.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shrink-0 no-default-hover-elevate no-default-active-elevate"
                  data-testid={`badge-x402-${agent.id}`}
                >
                  <CreditCard className="w-3 h-3 shrink-0" />
                  <span className="sm:hidden">x402</span>
                  <span className="hidden sm:inline">x402 Payments</span>
                </Badge>
              )}
              {endpointCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 px-1.5 sm:px-2.5 shrink-0 no-default-hover-elevate no-default-active-elevate"
                  data-testid={`badge-endpoints-${agent.id}`}
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  <span className="sm:hidden">{endpointCount}</span>
                  <span className="hidden sm:inline">{endpointCount} Endpoint{endpointCount !== 1 ? "s" : ""}</span>
                </Badge>
              )}
              <Badge
                variant="outline"
                className="text-[10px] gap-1 px-1.5 sm:px-2.5 bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400 shrink-0 no-default-hover-elevate no-default-active-elevate"
                data-testid={`badge-profile-${agent.id}`}
              >
                <span className="sm:hidden flex items-center gap-1"><Bot className="w-3 h-3 shrink-0" />{profilePct}%</span>
                <span className="hidden sm:inline">Profile {profilePct}%</span>
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function AgentCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3.5">
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
          <div className="h-7 w-14 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-36 bg-muted animate-pulse rounded" />
            <div className="h-5 w-14 bg-muted animate-pulse rounded-full ml-auto" />
          </div>
          <div className="h-3 w-full bg-muted animate-pulse rounded" />
          <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
            <div className="flex gap-1.5">
              <div className="h-5 w-10 bg-muted animate-pulse rounded-full" />
              <div className="h-5 w-10 bg-muted animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
