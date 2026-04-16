import type { Agent } from "@shared/schema";
import { Link } from "wouter";
import { ZoneCard } from "@/components/zone-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getChain } from "@shared/chains";
import { ArrowRight, Layers, Zap } from "lucide-react";

interface Props { agent: Agent }

function StatTile({ label, value, earned }: { label: string; value: string | number; earned: boolean }) {
  return (
    <Card className={`p-4 ${earned ? "border-l-[3px] border-l-emerald-500" : "border-l-[3px] border-l-muted-foreground/40 opacity-60"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

export function OnChainTab({ agent }: Props) {
  const chain = getChain(agent.chainId);
  const x402 = agent.x402Support === true;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Verified Txs" value={0} earned={false} />
        <StatTile label="Chains" value={1} earned={false} />
        <StatTile label="x402" value={x402 ? "Live" : "Off"} earned={x402} />
      </div>

      <ZoneCard state="populated" label="Chain Presence" data-testid="zone-chains">
        <div className="flex items-center gap-3">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <div className="text-sm">
            {chain?.name ?? `Chain ${agent.chainId}`} · first seen block {agent.firstSeenBlock.toLocaleString()}
          </div>
        </div>
      </ZoneCard>

      <ZoneCard
        state={x402 ? "earned" : "empty"}
        label="x402 Endpoint"
        statusTag={x402 ? "LIVE ✓" : "NONE"}
        data-testid="zone-x402"
      >
        <div className="flex items-center gap-2 text-sm">
          <Zap className={`w-4 h-4 ${x402 ? "text-emerald-500" : "text-muted-foreground"}`} />
          {x402 ? <span>Endpoint responds with HTTP 402 payment requirements.</span> : <span>No x402 endpoint detected.</span>}
        </div>
      </ZoneCard>

      <Card className="p-5 border-dashed opacity-60" data-testid="onchain-gated">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">Detailed on-chain history — Trust API</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Full transaction list + volumes</li>
          <li>• Unique payer counts + patterns</li>
          <li>• Per-chain breakdown + token mix</li>
        </ul>
        <Link href="/trust-api">
          <Button variant="outline" size="sm" className="mt-3 gap-1">View on Trust API <ArrowRight className="w-3 h-3" /></Button>
        </Link>
      </Card>
    </div>
  );
}
