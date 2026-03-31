import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ChainBadge } from "@/components/chain-badge";
import { STATS } from "@/lib/content-zones";
import { Bot, CreditCard, Blocks, Activity, Shield } from "lucide-react";

interface Stats {
  totalAgents: number;
  totalEvents: number;
  lastProcessedBlock: number;
  newAgents24h?: number;
  isIndexerRunning?: boolean;
  lastError?: string | null;
  chainBreakdown?: Array<{ chainId: number; totalAgents: number; totalEvents: number; lastProcessedBlock: number }>;
}

interface StatsBarProps {
  stats: Stats | undefined;
  isLoading: boolean;
}

export function StatsBar({ stats, isLoading }: StatsBarProps) {
  const { data: filterCounts } = useQuery<{ hasMetadata: number; x402Enabled: number }>({
    queryKey: ["/api/stats/bar-filters"],
    queryFn: async () => {
      const [hasMeta, x402] = await Promise.all([
        fetch("/api/agents?limit=1&filter=has-metadata").then((r) => r.json()),
        fetch("/api/agents?limit=1&filter=x402-enabled").then((r) => r.json()),
      ]);
      return { hasMetadata: hasMeta.total, x402Enabled: x402.total };
    },
    staleTime: 60_000,
  });

  const totalAgents = stats?.totalAgents ?? 0;
  const metadataCount = filterCounts?.hasMetadata ?? 0;
  const x402Count = filterCounts?.x402Enabled ?? 0;
  const metadataPct = totalAgents > 0 ? Math.round((metadataCount / totalAgents) * 100) : 0;
  const x402Pct = totalAgents > 0 ? Math.round((x402Count / totalAgents) * 100) : 0;
  const newAgents24h = stats?.newAgents24h ?? 0;
  const chainCount = stats?.chainBreakdown?.length ?? 1;

  const items = [
    {
      label: STATS.agentsLabel,
      value: totalAgents,
      displayValue: totalAgents.toLocaleString(),
      subValue: newAgents24h > 0 ? `+${newAgents24h.toLocaleString()} in 24h` : null as string | null,
      icon: Bot,
    },
    {
      label: STATS.metadataLabel,
      value: metadataCount,
      displayValue: metadataCount.toLocaleString(),
      subValue: `${metadataPct}% of total`,
      icon: Shield,
    },
    {
      label: STATS.x402Label,
      value: x402Count,
      displayValue: x402Count.toLocaleString(),
      subValue: `${x402Pct}% of total`,
      icon: CreditCard,
    },
    {
      label: STATS.blockLabel,
      value: stats?.lastProcessedBlock ?? 0,
      displayValue: stats?.lastProcessedBlock?.toLocaleString() ?? "---",
      subValue: `across ${chainCount} chain${chainCount !== 1 ? "s" : ""}`,
      icon: Blocks,
    },
  ];

  const isRunning = stats?.isIndexerRunning === true;
  const hasStatusInfo = stats !== undefined && stats.isIndexerRunning !== undefined;

  return (
    <div className="space-y-3">
      {hasStatusInfo && (
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3" data-testid="text-indexer-status">
          <div className="flex items-center gap-2">
            <Activity className={`w-5 h-5 flex-shrink-0 ${isRunning ? "text-green-500 animate-pulse" : "text-muted-foreground/50"}`} />
            <span className="text-lg font-semibold tracking-tight">
              {isRunning ? "Indexer Scanning" : "Indexer Idle"}
            </span>
          </div>
          {isRunning && (
            <span className="flex items-center gap-0.5 pl-7 sm:pl-0">
              {stats?.chainBreakdown ? (
                stats.chainBreakdown.map((cb: { chainId: number }) => (
                  <ChainBadge key={cb.chainId} chainId={cb.chainId} />
                ))
              ) : (
                <ChainBadge chainId={1} />
              )}
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <Card key={item.label} className="p-3">
            <div className="flex items-center gap-2">
              <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            {isLoading ? (
              <div className="h-6 w-16 bg-muted animate-pulse rounded mt-1" />
            ) : (
              <div>
                <p className="text-xl font-semibold tabular-nums mt-1" data-testid={`text-stat-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {item.displayValue}
                </p>
                {item.subValue && (
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">{item.subValue}</p>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
