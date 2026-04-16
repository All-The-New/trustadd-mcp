import { Link } from "wouter";
import type { Agent } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChainBadge } from "@/components/chain-badge";
import { TrustStamp } from "@/components/trust-stamp";
import { VerificationChips, type EarnedVerification } from "@/components/verification-chips";
import { addressToColor } from "@/lib/address-color";
import type { PublicVerdict } from "@/lib/verdict";

export type AgentWithVerdict = Agent & {
  verdict?: PublicVerdict;
  trustScoreForStamp?: number | null;
  verifications?: EarnedVerification[];
  extraChainCount?: number;
};

function shortMobile(a: string): string { return `${a.slice(0, 6)}…${a.slice(-4)}`; }
function initials(name: string | null, address: string): string {
  if (name) return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return address.slice(2, 4).toUpperCase();
}

interface Props { agent: AgentWithVerdict }

export function AgentCard({ agent }: Props) {
  const color = addressToColor(agent.primaryContractAddress);
  const verdict: PublicVerdict = agent.verdict ?? "UNKNOWN";
  const verifications = agent.verifications ?? [];
  const addressChip = (
    <span className="text-[10px] font-mono px-2 py-1 rounded bg-muted text-muted-foreground border border-border whitespace-nowrap">
      {shortMobile(agent.primaryContractAddress)}
    </span>
  );

  return (
    <Link href={`/agent/${agent.slug || agent.id}`}>
      <Card className="hover-elevate cursor-pointer p-4 transition-all" data-testid={`card-agent-${agent.id}`}>
        <div className="flex items-start gap-3">
          <Avatar className="h-16 w-16 ring-2 ring-border/50">
            {agent.imageUrl && <AvatarImage src={agent.imageUrl} alt={agent.name ?? "Agent avatar"} />}
            <AvatarFallback style={{ backgroundColor: color, color: "white" }} className="text-base font-bold">
              {initials(agent.name, agent.primaryContractAddress)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate" title={agent.name ?? `Agent #${agent.erc8004Id}`} data-testid={`text-agent-name-${agent.id}`}>
                  {agent.name || `Agent #${agent.erc8004Id}`}
                </h3>
              </div>
              <span className="hidden sm:inline"><ChainBadge chainId={agent.chainId} extraChainCount={agent.extraChainCount ?? 0} /></span>
              <span className="sm:hidden"><ChainBadge chainId={agent.chainId} short extraChainCount={agent.extraChainCount ?? 0} /></span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-0.5" style={{ minHeight: "2.4rem", wordBreak: "break-word" }}>
              {agent.description ?? <i className="opacity-50">No description provided.</i>}
            </p>
          </div>

          <TrustStamp
            verdict={verdict}
            score={agent.trustScoreForStamp ?? null}
            size="square"
            className="ml-auto"
          />
        </div>
        <div className="mt-3">
          <VerificationChips verifications={verifications} addressChip={addressChip} />
        </div>
      </Card>
    </Link>
  );
}

export function AgentCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-36 bg-muted animate-pulse rounded" />
          <div className="h-3 w-full bg-muted animate-pulse rounded" />
          <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
        </div>
        <div className="w-16 h-16 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="mt-3 h-7 w-full rounded bg-muted animate-pulse" />
    </Card>
  );
}
