import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { Agent, AgentMetadataEvent } from "@shared/schema";
import { getExplorerAddressUrl, getChain } from "@shared/chains";
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
  ShieldCheck,
  ShieldAlert,
  ShieldX,
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
  Users,
  ArrowRight,
  Layers,
  Activity,
  FileSearch,
} from "lucide-react";
import { SiGithub, SiFarcaster } from "react-icons/si";
import { useState, useEffect } from "react";

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

type Verdict = "TRUSTED" | "CAUTION" | "UNTRUSTED" | "UNKNOWN";

function VerdictBadge({ verdict, size = "sm" }: { verdict: Verdict | null | undefined; size?: "sm" | "lg" }) {
  const v = verdict ?? "UNKNOWN";

  const config: Record<Verdict, { label: string; Icon: React.ElementType; classes: string; iconColor: string }> = {
    TRUSTED: {
      label: "Trusted",
      Icon: ShieldCheck,
      classes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
      iconColor: "text-emerald-500",
    },
    CAUTION: {
      label: "Caution",
      Icon: ShieldAlert,
      classes: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
      iconColor: "text-amber-500",
    },
    UNTRUSTED: {
      label: "Untrusted",
      Icon: ShieldX,
      classes: "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30",
      iconColor: "text-red-500",
    },
    UNKNOWN: {
      label: "Unknown",
      Icon: Shield,
      classes: "bg-muted text-muted-foreground border border-border",
      iconColor: "text-muted-foreground",
    },
  };

  const { label, Icon, classes, iconColor } = config[v];

  if (size === "lg") {
    return (
      <div
        className={`flex flex-col items-center gap-2 rounded-xl px-6 py-4 ${classes}`}
        data-testid="indicator-trust-verdict"
      >
        <Icon className={`w-10 h-10 ${iconColor}`} />
        <span className="text-sm font-bold uppercase tracking-wide">{label}</span>
        <span className="text-[10px] opacity-70 font-medium">Trust Verdict</span>
      </div>
    );
  }

  return (
    <Badge
      className={`gap-1 font-semibold no-default-hover-elevate no-default-active-elevate ${classes}`}
      data-testid="badge-trust-verdict"
    >
      <Icon className={`w-3 h-3 ${iconColor}`} />
      {label}
    </Badge>
  );
}

function FullReportCTA({ agentId, className }: { agentId: string | number; className?: string }) {
  return (
    <Card className={`p-5 border-2 border-primary/20 bg-primary/5 ${className ?? ""}`} data-testid="card-full-report-cta">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <FileSearch className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">Get Full Trust Report</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Access the complete trust analysis — community signals, transaction history, score breakdown, and a detailed verdict with supporting evidence.
          </p>
        </div>
        <a
          href={`/api/agents/${agentId}/trust-report`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
          data-testid="link-full-report"
        >
          <Button className="gap-2 whitespace-nowrap">
            <FileSearch className="w-4 h-4" />
            Full Report — $0.05 USDC
          </Button>
        </a>
      </div>
    </Card>
  );
}

function GatedTabContent({
  icon: Icon,
  title,
  description,
  agentId,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  agentId: string | number;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-8" data-testid="card-gated-content">
        <div className="flex flex-col items-center text-center max-w-sm mx-auto">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-base mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
          <a
            href={`/api/agents/${agentId}/trust-report`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-gated-cta"
          >
            <Button variant="outline" className="gap-2">
              <FileSearch className="w-4 h-4" />
              View in Full Trust Report
            </Button>
          </a>
        </div>
      </Card>
    </div>
  );
}

function CommunityGatedTab({
  agentId,
  preview,
}: {
  agentId: string | number;
  preview?: { totalSources?: number; hasGithub?: boolean; hasFarcaster?: boolean };
}) {
  const totalSources = preview?.totalSources ?? 0;
  const hasGithub = preview?.hasGithub ?? false;
  const hasFarcaster = preview?.hasFarcaster ?? false;

  return (
    <div className="space-y-4">
      {totalSources > 0 && (
        <Card className="p-4 border-dashed" data-testid="card-community-preview">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold">Community signals available</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalSources} source{totalSources !== 1 ? "s" : ""} indexed
                {hasGithub && " · GitHub"}
                {hasFarcaster && " · Farcaster"}
              </p>
            </div>
            <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5 opacity-60" data-testid="card-github-locked">
          <div className="flex items-center gap-2 mb-3">
            <SiGithub className="w-5 h-5" />
            <h3 className="text-sm font-semibold">GitHub Activity</h3>
            <Lock className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
          </div>
          <p className="text-xs text-muted-foreground">
            Repository stats, commit history, contributors, and health score — available in the Full Trust Report.
          </p>
        </Card>

        <Card className="p-5 opacity-60" data-testid="card-farcaster-locked">
          <div className="flex items-center gap-2 mb-3">
            <SiFarcaster className="w-5 h-5 text-[#8A63D2]" />
            <h3 className="text-sm font-semibold">Farcaster Activity</h3>
            <Lock className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
          </div>
          <p className="text-xs text-muted-foreground">
            Follower counts, cast activity, Neynar score, and engagement — available in the Full Trust Report.
          </p>
        </Card>
      </div>

      <FullReportCTA agentId={agentId} />
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

interface TrustScoreData {
  verdict: Verdict;
  updatedAt?: string | null;
  reportAvailable?: boolean;
  quickCheckPrice?: string;
  fullReportPrice?: string;
  message?: string;
}

interface CommunityGatedData {
  message?: string;
  preview?: { totalSources?: number; hasGithub?: boolean; hasFarcaster?: boolean };
  quickCheckPrice?: string;
  fullReportPrice?: string;
}

export default function AgentProfile() {
  const [, params] = useRoute("/agent/:id");
  const id = params?.id;
  const [activeTab, setActiveTab] = useState("overview");

  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery<Agent>({
    queryKey: ["/api/agents", id],
    enabled: !!id,
  });

  // These endpoints return 402 for gated data — parse the body regardless of 4xx status.
  // Throw on 5xx so TanStack Query can surface real server errors.
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

  const { data: communityData } = useQuery<CommunityGatedData>({
    queryKey: ["/api/agents", id, "community-feedback"],
    queryFn: gatedQueryFn(`/api/agents/${id}/community-feedback`),
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (!agent) return;
    const chain = getChain(agent.chainId);
    const verdict = (agent as any).verdict as Verdict | null;
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
    if (verdict && verdict !== "UNKNOWN") {
      jsonLd.description = `${jsonLd.description} Verdict: ${verdict}.`;
    }
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
  const verdict = ((agent as any).verdict as Verdict | null) ?? trustScoreData?.verdict ?? null;
  const reportAvailable = (agent as any).reportAvailable ?? trustScoreData?.reportAvailable ?? false;

  // Determine if history data is gated (returned 402-style object)
  const historyIsGated = events && !Array.isArray(events) && "message" in events;
  const eventsArray = Array.isArray(events) ? events : [];

  // Determine if community data has preview info (indicates gated 402 response)
  const communityIsGated = communityData && "preview" in communityData;
  const communityPreview = communityIsGated ? (communityData as CommunityGatedData).preview : undefined;

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
              {verdict && <VerdictBadge verdict={verdict} size="sm" />}
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

          {verdict && (
            <div className="hidden sm:block flex-shrink-0">
              <VerdictBadge verdict={verdict} size="lg" />
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList data-testid="tabs-agent">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="community" data-testid="tab-community">Community</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
            <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
            <TabsTrigger value="technical" data-testid="tab-technical">Technical</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {/* Verdict + CTA banner */}
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <Card className="p-5 flex items-center gap-4 md:col-span-1" data-testid="card-verdict-overview">
                {verdict ? (
                  <>
                    <VerdictBadge verdict={verdict} size="lg" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Trust assessment based on on-chain data and community signals.</p>
                      {reportAvailable && (
                        <p className="text-xs text-primary font-medium mt-1">Full report available</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Trust verdict not yet available.</p>
                  </div>
                )}
              </Card>
              <div className="md:col-span-2">
                <FullReportCTA agentId={agent.slug ?? agent.id} />
              </div>
            </div>

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

              {/* Community preview teaser on overview */}
              {communityPreview && (communityPreview.totalSources ?? 0) > 0 && (
                <Card className="p-4 md:col-span-2 border-dashed" data-testid="card-community-teaser">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">Community Signals</h3>
                        <p className="text-xs text-muted-foreground">
                          {communityPreview.totalSources} source{(communityPreview.totalSources ?? 0) !== 1 ? "s" : ""} indexed
                          {communityPreview.hasGithub && " · GitHub"}
                          {communityPreview.hasFarcaster && " · Farcaster"}
                          {" "}— available in Full Trust Report
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => setActiveTab("community")} data-testid="button-view-community">
                      View details
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="community">
            <CommunityGatedTab
              agentId={agent.slug ?? agent.id}
              preview={communityPreview}
            />
          </TabsContent>

          <TabsContent value="history">
            {historyIsGated ? (
              <GatedTabContent
                icon={Activity}
                title="Event History Available in Full Trust Report"
                description="The complete on-chain event history — metadata updates, ownership transfers, and reputation changes — is included in the Full Trust Report."
                agentId={agent.slug ?? agent.id}
              />
            ) : (
              <EventTimeline events={eventsArray} isLoading={eventsLoading} />
            )}
          </TabsContent>

          <TabsContent value="transactions">
            <GatedTabContent
              icon={CreditCard}
              title="Transaction History Available in Full Trust Report"
              description="Access the full transaction history for this agent — volume, unique payers, payment patterns, and on-chain payment address data — included in the Full Trust Report."
              agentId={agent.slug ?? agent.id}
            />
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
