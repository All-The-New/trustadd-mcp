import type { Agent } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoneCard } from "@/components/zone-card";
import { SiGithub, SiFarcaster } from "react-icons/si";
import { ArrowRight } from "lucide-react";

interface Props { agent: Agent }

interface CommunityGatedData {
  message?: string;
  preview?: { totalSources?: number; hasGithub?: boolean; hasFarcaster?: boolean };
}

export function CommunityTab({ agent }: Props) {
  const { data } = useQuery<CommunityGatedData>({
    queryKey: ["/api/agents", agent.slug ?? agent.id, "community-feedback"],
    queryFn: async () => {
      const r = await fetch(`/api/agents/${agent.slug ?? agent.id}/community-feedback`);
      if (r.status >= 500) throw new Error("server error");
      return r.json();
    },
    retry: false,
  });
  const preview = data?.preview ?? {};
  const hasGithub = preview.hasGithub === true;
  const hasFarcaster = preview.hasFarcaster === true;
  const totalSources = preview.totalSources ?? 0;

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-blue-500/5 border-blue-500/20" data-testid="community-summary">
        <p className="text-sm"><strong>{totalSources} of 2</strong> community sources indexed</p>
      </Card>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <ZoneCard
          state={hasGithub ? "earned" : "empty"}
          label="GitHub"
          statusTag={hasGithub ? "INDEXED ✓" : "NOT LINKED"}
          data-testid="zone-github"
        >
          <div className="flex items-center gap-2 text-sm">
            <SiGithub className="w-4 h-4" />
            {hasGithub ? "GitHub health indexed." : "No GitHub repo linked."}
          </div>
        </ZoneCard>
        <ZoneCard
          state={hasFarcaster ? "earned" : "empty"}
          label="Farcaster"
          statusTag={hasFarcaster ? "INDEXED ✓" : "NOT LINKED"}
          data-testid="zone-farcaster"
        >
          <div className="flex items-center gap-2 text-sm">
            <SiFarcaster className="w-4 h-4 text-[#8A63D2]" />
            {hasFarcaster ? "Farcaster presence indexed." : "No Farcaster handle linked."}
          </div>
        </ZoneCard>
      </div>

      <Card className="p-5 border-dashed opacity-60" data-testid="community-gated">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">Detailed community signals — Trust API</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• GitHub health score, commit cadence, contributors</li>
          <li>• Farcaster follower count, Neynar score</li>
        </ul>
        <Link href="/trust-api">
          <Button variant="outline" size="sm" className="mt-3 gap-1">View on Trust API <ArrowRight className="w-3 h-3" /></Button>
        </Link>
      </Card>
    </div>
  );
}
