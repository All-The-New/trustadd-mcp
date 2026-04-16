import type { Agent } from "@shared/schema";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreRail } from "@/components/score-rail";
import { CategoryBars, type CategoryStrengths } from "@/components/category-bars";
import { ArrowRight, Info } from "lucide-react";
import type { PublicVerdict } from "@/lib/verdict";

interface Props {
  agent: Agent;
  verdict: PublicVerdict;
  strengths: CategoryStrengths | null;
}

export function ScoreTab({ agent, verdict, strengths }: Props) {
  const score = (agent as any).trustScore ?? null;
  const emptyStrengths: CategoryStrengths = {
    identity: "none", behavioral: "none", community: "none", attestation: "none", authenticity: "high",
  };
  return (
    <div className="space-y-6">
      <ScoreRail verdict={verdict} score={score} />

      <Card className="p-4 bg-blue-500/5 border-blue-500/20" data-testid="evidence-basis">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm">
            {score == null
              ? "Profile data only — no verified transactions recorded yet for this agent."
              : `Based on public on-chain data indexed by TrustAdd. See the Trust API for the complete Evidence Basis.`}
          </p>
        </div>
      </Card>

      <Card className="p-5" data-testid="score-breakdown">
        <h3 className="text-sm font-semibold mb-4">Score Breakdown</h3>
        <CategoryBars strengths={strengths ?? emptyStrengths} />
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border">
          <Link href="/methodology"><Button variant="ghost" size="sm">View Methodology</Button></Link>
          <Link href="/trust-api" className="ml-auto">
            <Button size="sm" className="gap-1">Unlock full breakdown <ArrowRight className="w-3 h-3" /></Button>
          </Link>
        </div>
      </Card>

      <div className="border-t border-dashed border-border pt-5">
        <Card className="p-5 border-dashed opacity-60" data-testid="score-gated">
          <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">Detailed breakdown — Trust API</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• 5 numeric category scores</li>
            <li>• 21 individual signal scores</li>
            <li>• Sybil detection signals + dampening detail</li>
            <li>• Provenance hash + methodology version</li>
          </ul>
          <Link href="/trust-api">
            <Button variant="outline" size="sm" className="mt-3">View on Trust API →</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
