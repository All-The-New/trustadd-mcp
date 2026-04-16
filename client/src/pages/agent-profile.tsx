import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useEffect, useState } from "react";
import type { Agent, AgentMetadataEvent } from "@shared/schema";
import { getChain } from "@shared/chains";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { PROFILE } from "@/lib/content-zones";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, X as XIcon } from "lucide-react";
import { Banner } from "./agent-profile/banner";
import { OverviewTab } from "./agent-profile/overview-tab";
import { ScoreTab } from "./agent-profile/score-tab";
import { OnChainTab } from "./agent-profile/on-chain-tab";
import { CommunityTab } from "./agent-profile/community-tab";
import { HistoryTab } from "./agent-profile/history-tab";
import type { PublicVerdict } from "@/lib/verdict";

interface TrustScoreData {
  verdict: PublicVerdict;
  updatedAt?: string | null;
  reportAvailable?: boolean;
  quickCheckPrice?: string;
  fullReportPrice?: string;
  categoryStrengths?: {
    identity: "high" | "medium" | "low" | "none";
    behavioral: "high" | "medium" | "low" | "none";
    community: "high" | "medium" | "low" | "none";
    attestation: "high" | "medium" | "low" | "none";
    authenticity: "high" | "medium" | "low" | "none";
  };
}

const DISCLAIMER_STORAGE_KEY = "trustadd.v2.early-stage-disclaimer.dismissed";

function EarlyStageDisclaimer() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISCLAIMER_STORAGE_KEY) === "true"; } catch { return false; }
  });
  if (dismissed) return null;
  return (
    <div className="flex items-center gap-2 py-2 px-3 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border-l-2 border-amber-500 rounded-sm mb-3">
      <span className="font-semibold uppercase tracking-wider">⚠ Early-stage ecosystem</span>
      <span className="opacity-80">
        Attestation signals aren't active yet; effective score ceiling is ~75/100. Applies to all agents until v3.
      </span>
      <button
        onClick={() => { try { localStorage.setItem(DISCLAIMER_STORAGE_KEY, "true"); } catch {}; setDismissed(true); }}
        className="ml-auto p-1 hover:bg-amber-500/20 rounded"
        aria-label="Dismiss"
        data-testid="dismiss-early-stage-disclaimer"
      >
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function AgentProfile() {
  const [, params] = useRoute("/agent/:id");
  const id = params?.id;
  const [activeTab, setActiveTab] = useState("overview");

  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery<Agent & { verdict?: PublicVerdict; reportAvailable?: boolean }>({
    queryKey: ["/api/agents", id],
    enabled: !!id,
  });

  const gatedQueryFn = (path: string) => async () => {
    const res = await fetch(path);
    if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
    return res.json();
  };

  const { data: events, isLoading: eventsLoading } = useQuery<AgentMetadataEvent[] | { message: string; fullReportPrice: string }>({
    queryKey: ["/api/agents", id, "history"],
    queryFn: gatedQueryFn(`/api/agents/${id}/history`),
    enabled: !!id,
    retry: false,
  });

  const { data: trustScoreData } = useQuery<TrustScoreData>({
    queryKey: ["/api/agents", id, "trust-score"],
    queryFn: gatedQueryFn(`/api/agents/${id}/trust-score`),
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (!agent) return;
    const chain = getChain(agent.chainId);
    const verdict = agent.verdict ?? trustScoreData?.verdict ?? null;
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: agent.name ?? `Agent #${agent.erc8004Id}`,
      description: agent.description ?? `An AI agent on ${chain?.name ?? "EVM"} tracked by TrustAdd.`,
      url: `https://trustadd.com/agent/${agent.slug ?? agent.id}`,
      identifier: agent.primaryContractAddress,
      applicationCategory: "AI Agent",
      operatingSystem: chain?.name ?? "EVM Blockchain",
    };
    if (verdict && verdict !== "UNKNOWN") jsonLd.description = `${jsonLd.description} Verdict: ${verdict}.`;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "agent-jsonld";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => { document.getElementById("agent-jsonld")?.remove(); };
  }, [agent, trustScoreData]);

  if (agentLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Skeleton className="h-6 w-24 mb-6" />
          <Skeleton className="w-full h-[204px] rounded-md mb-4" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      </Layout>
    );
  }

  if (agentError || !agent) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Card className="p-12 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold text-lg mb-1">Agent not found</h2>
            <p className="text-sm text-muted-foreground mb-4">This agent may not exist or hasn't been indexed yet.</p>
            <Link href="/agents"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back to Directory</Button></Link>
          </Card>
        </div>
      </Layout>
    );
  }

  const verdict: PublicVerdict = agent.verdict ?? trustScoreData?.verdict ?? "UNKNOWN";

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
            <ArrowLeft className="w-3 h-3" />Back
          </Button>
        </Link>

        <Banner agent={agent} verdict={verdict} updatedAt={trustScoreData?.updatedAt ?? null} />

        <EarlyStageDisclaimer />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList data-testid="tabs-agent">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="score" data-testid="tab-score">Score</TabsTrigger>
            <TabsTrigger value="onchain" data-testid="tab-onchain">On-Chain</TabsTrigger>
            <TabsTrigger value="community" data-testid="tab-community">Community</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab agent={agent} /></TabsContent>
          <TabsContent value="score"><ScoreTab agent={agent} verdict={verdict} strengths={trustScoreData?.categoryStrengths ?? null} /></TabsContent>
          <TabsContent value="onchain"><OnChainTab agent={agent} /></TabsContent>
          <TabsContent value="community"><CommunityTab agent={agent} /></TabsContent>
          <TabsContent value="history"><HistoryTab events={events} isLoading={eventsLoading} /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
