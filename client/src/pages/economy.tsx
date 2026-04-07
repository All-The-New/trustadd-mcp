import { useState } from "react";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { ECONOMY } from "@/lib/content-zones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChainBadge } from "@/components/chain-badge";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
  ResponsiveContainer,
} from "recharts";
import {
  Zap, Globe, Link2, Coins, TrendingUp, ArrowRight, Shield, Server,
  Radar, Wallet, ExternalLink, DollarSign, Users, Receipt, Clock,
  FileCode, MessagesSquare, Wrench, CreditCard, KeyRound,
  AtSign, Mail, Send, Fingerprint, Code, BookOpen, Bot, type LucideIcon,
} from "lucide-react";
import { SiGithub, SiTelegram, SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CHAIN_COLORS, CHAIN_NAMES } from "@shared/chains";

const ENDPOINT_COLORS: Record<string, string> = {
  oasf: "#3b82f6",
  web: "#22c55e",
  a2a: "#8b5cf6",
  mcp: "#f59e0b",
  x402: "#06b6d4",
  wallet: "#ec4899",
  custom: "#6b7280",
};

const ENDPOINT_DESCRIPTIONS: Record<string, string> = {
  oasf: "Open Agent Skills Framework. A standard for agents to declare their skills, domains, and capabilities in a structured format.",
  web: "Standard website or HTTP endpoint. The agent's public-facing URL for human users.",
  a2a: "Agent-to-Agent protocol. Enables direct communication between AI agents using standardized message formats.",
  mcp: "Model Context Protocol. Allows agents to expose tools and data sources to LLMs and other AI systems.",
  x402: "HTTP 402 Payment endpoint. The agent accepts USDC payments for API access using the x402 standard.",
  wallet: "On-chain wallet address. The agent's payment or controller address on the blockchain.",
  custom: "Custom-defined endpoint type specific to the agent's implementation.",
  supermission: "SuperMission protocol endpoint for agent task coordination and mission assignment.",
  agentwallet: "Dedicated agent wallet endpoint for receiving payments and managing on-chain assets.",
  ens: "Ethereum Name Service. A human-readable name linked to the agent's on-chain identity.",
  email: "Email contact endpoint for the agent or its operator.",
  twitter: "Twitter/X social profile linked to the agent.",
  telegram: "Telegram bot or channel for interacting with the agent.",
  did: "Decentralized Identifier. A self-sovereign identity standard for verifiable credentials.",
  api: "Generic REST API endpoint for programmatic access to the agent's services.",
  http: "Direct HTTP endpoint for the agent's services.",
  nostr: "Nostr protocol identity. A decentralized social networking protocol.",
  github: "GitHub repository or profile linked to the agent's source code.",
  docs: "Documentation endpoint providing usage guides and API references.",
  lightning: "Bitcoin Lightning Network endpoint for fast, low-cost payments.",
};

const ENDPOINT_ICONS: Record<string, LucideIcon | null> = {
  oasf: FileCode,
  web: Globe,
  a2a: MessagesSquare,
  mcp: Wrench,
  x402: CreditCard,
  wallet: Wallet,
  custom: Code,
  supermission: Bot,
  agentwallet: KeyRound,
  ens: Fingerprint,
  email: Mail,
  twitter: null,
  telegram: null,
  did: Fingerprint,
  api: Server,
  http: Globe,
  nostr: Radar,
  github: null,
  docs: BookOpen,
  lightning: Zap,
};

const ENDPOINT_LABELS: Record<string, string> = {
  oasf: "OASF",
  web: "Web",
  a2a: "A2A",
  mcp: "MCP",
  x402: "x402",
  wallet: "Wallet",
  custom: "Custom",
  supermission: "SuperMission",
  agentwallet: "Agent Wallet",
  ens: "ENS",
  email: "Email",
  twitter: "Twitter / X",
  telegram: "Telegram",
  did: "DID",
  api: "API",
  http: "HTTP",
  nostr: "Nostr",
  github: "GitHub",
  docs: "Docs",
  lightning: "Lightning",
};

function getTrustScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getTrustScoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-500/10 border-emerald-500/30";
  if (score >= 40) return "bg-amber-500/10 border-amber-500/30";
  return "bg-red-500/10 border-red-500/30";
}

function getInitials(name: string | null, id: string): string {
  if (name) {
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }
  return id.slice(0, 2).toUpperCase();
}

function addressToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

function getEndpointTypes(endpoints: any): string[] {
  if (!endpoints || !Array.isArray(endpoints)) return [];
  return [...new Set(endpoints.map((e: any) => (e.name || "").toLowerCase()).filter(Boolean))];
}

function KpiCard({ label, value, icon: Icon, subtitle, iconColor }: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  subtitle?: string;
  iconColor?: string;
}) {
  return (
    <Card data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight mt-0.5">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Icon className={`w-10 h-10 ${iconColor ?? "text-muted-foreground"}`} strokeWidth={1.5} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Economy() {
  const [chainFilter, setChainFilter] = useState<number | undefined>(undefined);

  const { data: overview, isLoading: overviewLoading } = useQuery<{
    totalAgents: number;
    x402Agents: number;
    agentsWithEndpoints: number;
    chainsWithX402: number;
    endpointTypes: Array<{ type: string; count: number }>;
    chainBreakdown: Array<{ chainId: number; total: number; x402: number; withEndpoints: number; adoptionRate: number }>;
  }>({ queryKey: ["/api/economy/overview"] });

  const { data: topAgents, isLoading: topAgentsLoading } = useQuery<Array<{
    id: string; slug: string | null; name: string | null; imageUrl: string | null; chainId: number;
    trustScore: number | null; trustScoreBreakdown: any; endpoints: any; description: string | null;
  }>>({
    queryKey: ["/api/economy/top-agents", chainFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20" });
      if (chainFilter) params.set("chain", String(chainFilter));
      const res = await fetch(`/api/economy/top-agents?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: endpointAnalysis, isLoading: endpointsLoading } = useQuery<
    Array<{ type: string; count: number; percentage: number }>
  >({ queryKey: ["/api/economy/endpoints"] });

  const { data: chainBreakdown, isLoading: chainLoading } = useQuery<Array<{
    chainId: number; totalAgents: number; x402Agents: number; adoptionRate: number;
    withEndpoints: number; avgTrustScore: number | null;
  }>>({ queryKey: ["/api/economy/chain-breakdown"] });

  const { data: probeStats } = useQuery<{
    totalProbed: number; found402: number; uniquePaymentAddresses: number; lastProbeAt: string | null;
  }>({ queryKey: ["/api/economy/probes"] });

  const { data: paymentAddresses } = useQuery<Array<{
    agentId: string; agentName: string | null; agentSlug: string | null; chainId: number;
    paymentAddress: string; paymentNetwork: string | null; paymentToken: string | null; probedAt: string;
  }>>({ queryKey: ["/api/economy/payment-addresses"] });

  const { data: txStats } = useQuery<{
    totalTransactions: number; totalVolumeUsd: number; uniqueBuyers: number; uniqueSellers: number;
    volumeByChain: Array<{ chainId: number; volume: number; count: number }>;
  }>({ queryKey: ["/api/economy/transactions/stats"] });

  const { data: recentTxns } = useQuery<Array<{
    id: number; agentId: string; chainId: number; txHash: string; fromAddress: string; toAddress: string;
    tokenSymbol: string; amount: string; amountUsd: number | null; blockTimestamp: string; category: string;
  }>>({ queryKey: ["/api/economy/transactions/recent"] });

  const { data: topEarners } = useQuery<Array<{
    agentId: string; agentName: string | null; agentSlug: string | null; chainId: number;
    totalVolume: number; txCount: number; imageUrl: string | null;
  }>>({ queryKey: ["/api/economy/transactions/top-earners"] });

  const { data: volumeData } = useQuery<Array<{ date: string; volume: number; count: number }>>({
    queryKey: ["/api/economy/transactions/volume"],
  });

  const adoptionRate = overview ? Math.round((overview.x402Agents / overview.totalAgents) * 100) : 0;
  const hasTxData = txStats && txStats.totalTransactions > 0;

  const endpointChartData = (endpointAnalysis || []).slice(0, 10).map((e) => ({
    name: e.type.toUpperCase(),
    agents: e.count,
    fill: ENDPOINT_COLORS[e.type] || "#6b7280",
  }));

  const endpointChartConfig: ChartConfig = {};
  endpointChartData.forEach((e) => {
    endpointChartConfig[e.name] = { label: e.name, color: e.fill };
  });

  const chainAdoptionData = (chainBreakdown || []).map((c) => ({
    name: CHAIN_NAMES[c.chainId] || `Chain ${c.chainId}`,
    chainId: c.chainId,
    x402: c.x402Agents,
    total: c.totalAgents,
    rate: c.adoptionRate,
    fill: CHAIN_COLORS[c.chainId] || "#888",
  }));

  const chainAdoptionConfig: ChartConfig = {};
  chainAdoptionData.forEach((c) => {
    chainAdoptionConfig[c.name] = { label: c.name, color: c.fill };
  });

  return (
    <Layout>
      <SEO
        title={ECONOMY.seo.title}
        description={ECONOMY.seo.description}
        path="/economy"
      />

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-economy-title">Agent Economy</h1>
              <p className="text-muted-foreground">
                Agent payment protocols and endpoint ecosystem across {overview?.chainsWithX402 || "—"} chains
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {txStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full" data-testid="section-tx-hero">
              <KpiCard
                label="Transactions"
                value={hasTxData ? txStats.totalTransactions : "—"}
                icon={Receipt}
                subtitle={hasTxData ? "total indexed" : "awaiting indexer"}
                iconColor="text-emerald-500"
              />
              <KpiCard
                label="Volume"
                value={hasTxData ? `$${formatCompact(txStats.totalVolumeUsd)}` : "—"}
                icon={TrendingUp}
                subtitle={hasTxData ? "USD equivalent" : "awaiting indexer"}
                iconColor="text-green-500"
              />
              <KpiCard
                label="Buyers"
                value={hasTxData ? txStats.uniqueBuyers : "—"}
                icon={Users}
                subtitle={hasTxData ? "unique addresses" : "awaiting indexer"}
                iconColor="text-blue-500"
              />
              <KpiCard
                label="Sellers"
                value={hasTxData ? txStats.uniqueSellers : "—"}
                icon={Wallet}
                subtitle={hasTxData ? "unique agents" : "awaiting indexer"}
                iconColor="text-orange-500"
              />
            </div>
          )}

          {overviewLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              {[...Array(4)].map((_, i) => (
                <Card key={i}><CardContent className="pt-4 pb-3 px-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : overview ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              <KpiCard label="x402 Agents" value={overview.x402Agents} icon={CreditCard} subtitle={`${adoptionRate}% of all agents`} iconColor="text-amber-500" />
              <KpiCard label="With Endpoints" value={overview.agentsWithEndpoints} icon={Link2} subtitle="Live service endpoints" iconColor="text-sky-500" />
              <KpiCard label="Endpoint Types" value={overview.endpointTypes.length} icon={Server} subtitle="Distinct protocols detected" iconColor="text-violet-500" />
              <KpiCard label="Active Chains" value={overview.chainsWithX402} icon={Globe} subtitle="Networks with x402 agents" iconColor="text-cyan-500" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2" data-testid="economy-chain-filter">
          <Button
            variant={chainFilter === undefined ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setChainFilter(undefined)}
            data-testid="filter-chain-all"
          >
            All Chains
          </Button>
          {(chainBreakdown || []).map((c) => (
            <Button
              key={c.chainId}
              variant={chainFilter === c.chainId ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChainFilter(c.chainId)}
              className="gap-1.5"
              data-testid={`filter-chain-${c.chainId}`}
            >
              <ChainBadge chainId={c.chainId} size="xs" />
              <span>{CHAIN_NAMES[c.chainId]}</span>
              <span className="text-muted-foreground text-xs">{c.x402Agents.toLocaleString()}</span>
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-top-x402-agents">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Top x402 Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topAgentsLoading ? (
                <div className="space-y-3">
                  {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : topAgents && topAgents.length > 0 ? (
                <div className="space-y-1">
                  {topAgents.map((agent, idx) => {
                    const types = getEndpointTypes(agent.endpoints);
                    return (
                      <Link
                        key={agent.id}
                        href={`/agent/${agent.slug || agent.id}`}
                        data-testid={`economy-agent-${agent.id}`}
                      >
                        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                          <span className="text-xs text-muted-foreground w-5 text-right font-mono">{idx + 1}</span>
                          <Avatar className="h-8 w-8 shrink-0">
                            {agent.imageUrl && (
                              <AvatarImage src={agent.imageUrl} alt={agent.name || "Agent"} className="object-cover" />
                            )}
                            <AvatarFallback
                              className="text-xs font-medium text-white"
                              style={{ backgroundColor: addressToColor(agent.id) }}
                            >
                              {getInitials(agent.name, agent.id)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {agent.name || `Agent #${agent.id.slice(0, 6)}`}
                              </span>
                              <ChainBadge chainId={agent.chainId} size="xs" />
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {types.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] px-1.5 py-0 rounded bg-muted text-muted-foreground uppercase font-medium"
                                >
                                  {t}
                                </span>
                              ))}
                              {types.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{types.length - 3}</span>
                              )}
                            </div>
                          </div>
                          {agent.trustScore != null && (
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold border ${getTrustScoreBg(agent.trustScore)} ${getTrustScoreColor(agent.trustScore)}`}
                              data-testid={`trust-score-${agent.id}`}
                            >
                              <Shield className="w-3 h-3 mr-0.5" />
                              {agent.trustScore}
                            </Badge>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">No x402 agents found</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card data-testid="card-endpoint-analysis">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Endpoint Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                {endpointsLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : endpointChartData.length > 0 ? (
                  <div className="space-y-4">
                    {endpointChartData.map((ep) => {
                      const maxCount = Math.max(...endpointChartData.map((e) => e.agents));
                      const width = Math.max((ep.agents / maxCount) * 100, 4);
                      const key = ep.name.toLowerCase();
                      const label = ENDPOINT_LABELS[key] || ep.name;
                      const description = ENDPOINT_DESCRIPTIONS[key] || "Endpoint type declared by this agent.";
                      const LucideIcon = ENDPOINT_ICONS[key];
                      const brandIcons: Record<string, any> = { github: SiGithub, twitter: SiX, telegram: SiTelegram };
                      const BrandIcon = brandIcons[key];
                      return (
                        <div key={ep.name} className="flex gap-3" data-testid={`endpoint-${key}`}>
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ backgroundColor: `${ep.fill}18`, color: ep.fill }}
                          >
                            {BrandIcon ? (
                              <BrandIcon className="w-4 h-4" style={{ color: ep.fill }} />
                            ) : LucideIcon ? (
                              <LucideIcon className="w-4 h-4" />
                            ) : (
                              <Link2 className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                                <div
                                  className="h-full rounded-md flex items-center justify-end px-2 transition-all"
                                  style={{ width: `${width}%`, backgroundColor: ep.fill }}
                                >
                                  <span className="text-[10px] font-semibold text-white">{ep.agents.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              <span className="font-semibold text-foreground">{label}</span>
                              {" — "}
                              {description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">No endpoint data</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-chain-adoption">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  x402 Adoption by Chain
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chainLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : chainBreakdown && chainBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {chainBreakdown.map((chain) => (
                      <div key={chain.chainId} className="space-y-1.5" data-testid={`chain-adoption-${chain.chainId}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ChainBadge chainId={chain.chainId} size="xs" />
                            <span className="text-sm font-medium">{CHAIN_NAMES[chain.chainId]}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{chain.x402Agents.toLocaleString()} agents</span>
                            <span className="font-semibold text-foreground">{chain.adoptionRate}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${chain.adoptionRate}%`,
                              backgroundColor: CHAIN_COLORS[chain.chainId] || "#888",
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                          <span>{chain.withEndpoints.toLocaleString()} with endpoints</span>
                          {chain.avgTrustScore != null && (
                            <span>Avg trust: {chain.avgTrustScore}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">No chain data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {(probeStats && probeStats.totalProbed > 0) || (paymentAddresses && paymentAddresses.length > 0) ? (
          <Card data-testid="card-payment-discovery">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Radar className="w-4 h-4" />
                Payment Discovery
                <Badge variant="outline" className="text-[10px] ml-1">Live Probing</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {probeStats && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{probeStats.totalProbed}</p>
                      <p className="text-xs text-muted-foreground">Agents Probed</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-primary">{probeStats.found402}</p>
                      <p className="text-xs text-muted-foreground">402 Responses</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{probeStats.uniquePaymentAddresses}</p>
                      <p className="text-xs text-muted-foreground">Payment Addresses</p>
                    </div>
                  </div>
                )}

                {paymentAddresses && paymentAddresses.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" />
                      Discovered Payment Addresses
                    </h4>
                    <div className="space-y-1">
                      {paymentAddresses.map((pa) => (
                        <Link
                          key={`${pa.agentId}-${pa.paymentAddress}`}
                          href={`/agent/${pa.agentSlug || pa.agentId}`}
                        >
                          <div
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                            data-testid={`payment-address-${pa.paymentAddress.slice(0, 8)}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{pa.agentName || "Unknown Agent"}</span>
                                <ChainBadge chainId={pa.chainId} size="xs" />
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <code className="text-[11px] text-muted-foreground font-mono">
                                  {pa.paymentAddress.slice(0, 6)}...{pa.paymentAddress.slice(-4)}
                                </code>
                                {pa.paymentNetwork && (
                                  <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground uppercase">{pa.paymentNetwork}</span>
                                )}
                                {pa.paymentToken && (
                                  <span className="text-[10px] px-1.5 rounded bg-primary/10 text-primary uppercase font-medium">{pa.paymentToken}</span>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {probeStats && probeStats.lastProbeAt && (
                  <p className="text-[11px] text-muted-foreground text-right">
                    Last probed: {new Date(probeStats.lastProbeAt).toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {(hasTxData || (topEarners && topEarners.length > 0)) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {recentTxns && recentTxns.length > 0 && (
              <Card data-testid="card-recent-transactions">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Recent Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {recentTxns.slice(0, 10).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`tx-${tx.id}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${tx.category === "incoming" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-[11px] text-muted-foreground font-mono">
                              {tx.fromAddress.slice(0, 6)}...{tx.fromAddress.slice(-4)}
                            </code>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <code className="text-[11px] text-muted-foreground font-mono">
                              {tx.toAddress.slice(0, 6)}...{tx.toAddress.slice(-4)}
                            </code>
                            <ChainBadge chainId={tx.chainId} size="xs" />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-medium">
                            {tx.amountUsd ? formatUsd(tx.amountUsd) : `${parseFloat(tx.amount).toFixed(2)} ${tx.tokenSymbol}`}
                          </span>
                          <p className="text-[10px] text-muted-foreground">{timeAgo(tx.blockTimestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {topEarners && topEarners.length > 0 && (
              <Card data-testid="card-top-earners">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Top Earning Agents
                    <Badge variant="outline" className="text-[10px] ml-1">By USDC Volume</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {topEarners.map((agent, idx) => (
                      <Link key={agent.agentId} href={`/agent/${agent.agentSlug || agent.agentId}`}>
                        <div
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                          data-testid={`top-earner-${idx}`}
                        >
                          <span className="text-xs font-medium text-muted-foreground w-5 text-right">{idx + 1}</span>
                          <Avatar className="w-7 h-7">
                            {agent.imageUrl && <AvatarImage src={agent.imageUrl} alt={agent.agentName || ""} />}
                            <AvatarFallback className="text-[10px]" style={{ backgroundColor: addressToColor(agent.agentId) }}>
                              {getInitials(agent.agentName, agent.agentId)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{agent.agentName || agent.agentId.slice(0, 8)}</span>
                            <div className="flex items-center gap-1.5">
                              <ChainBadge chainId={agent.chainId} size="xs" />
                              <span className="text-[10px] text-muted-foreground">{agent.txCount} txns</span>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatUsd(agent.totalVolume)}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {volumeData && volumeData.length > 0 && (
          <Card data-testid="card-volume-chart">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Daily Volume (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${formatCompact(v)}`} />
                    <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-x402-explainer">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">What is x402?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  x402 (HTTP 402 Payment Required) is the standard for agent-to-agent payments,
                  developed by Coinbase and Cloudflare. It allows AI agents to charge for API calls
                  via USDC on-chain settlements. When an agent receives a request, it responds with
                  a 402 status code and payment details. The requesting agent signs a USDC transfer,
                  and the response is delivered after payment confirmation.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  TrustAdd tracks which agents support x402 payments and the types of service
                  endpoints they expose — including A2A (agent-to-agent), MCP (model context protocol),
                  OASF (open agent skills framework), and direct x402 payment endpoints.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
