import { useState } from "react";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { ANALYTICS } from "@/lib/content-zones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChainBadge } from "@/components/chain-badge";
import { Link } from "wouter";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
  AreaChart, Area, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Users, FileText, Image, Zap, Activity, Globe, Link2, Award,
  Database, Fingerprint, TrendingUp, AlertTriangle, Layers, Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const CHAIN_COLORS: Record<number, string> = {
  1: "#627EEA",
  8453: "#0052FF",
  56: "#F0B90B",
  137: "#8247E5",
  42161: "#28A0F0",
};

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  56: "BNB Chain",
  137: "Polygon",
  42161: "Arbitrum",
};

const QUALITY_COLORS = {
  complete: "#22c55e",
  partial: "#3b82f6",
  minimal: "#f59e0b",
  empty: "#6b7280",
};

const X402_COLORS = {
  enabled: "#22c55e",
  disabled: "#ef4444",
  unknown: "#6b7280",
};

const URI_COLORS = ["#3b82f6", "#22c55e", "#8b5cf6", "#ef4444", "#6b7280", "#f59e0b"];

const CATEGORY_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
  "#84cc16", "#a855f7",
];

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

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function AgentAvatar({ name, imageUrl }: { name: string | null; imageUrl: string | null }) {
  const [imgError, setImgError] = useState(false);
  const initials = (name || "?").slice(0, 2).toUpperCase();

  return (
    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt={name || "Agent"}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-xs font-bold text-muted-foreground">{initials}</span>
      )}
    </div>
  );
}

function ChartSkeleton() {
  return <Skeleton className="w-full h-[300px] rounded-lg" />;
}

function ChartError({ message }: { message?: string }) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{message || "Failed to load data"}</AlertDescription>
    </Alert>
  );
}

function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Analytics() {
  const { data: overview, isLoading: overviewLoading, isError: overviewError } = useQuery<any>({
    queryKey: ["/api/analytics/overview"],
  });

  const { data: chainDist, isLoading: chainDistLoading, isError: chainDistError } = useQuery<any[]>({
    queryKey: ["/api/analytics/chain-distribution"],
  });

  const { data: registrations, isLoading: regsLoading, isError: regsError } = useQuery<any[]>({
    queryKey: ["/api/analytics/registrations"],
  });

  const { data: metadataQuality, isLoading: mqLoading, isError: mqError } = useQuery<any[]>({
    queryKey: ["/api/analytics/metadata-quality"],
  });

  const { data: x402Data, isLoading: x402Loading, isError: x402Error } = useQuery<any[]>({
    queryKey: ["/api/analytics/x402-by-chain"],
  });

  const { data: controllerData, isLoading: controllerLoading, isError: controllerError } = useQuery<any>({
    queryKey: ["/api/analytics/controller-concentration"],
  });

  const { data: uriData, isLoading: uriLoading, isError: uriError } = useQuery<any>({
    queryKey: ["/api/analytics/uri-schemes"],
  });

  const { data: categoryData, isLoading: catLoading, isError: catError } = useQuery<any>({
    queryKey: ["/api/analytics/categories"],
  });

  const { data: imageDomains, isLoading: imgLoading, isError: imgError } = useQuery<any[]>({
    queryKey: ["/api/analytics/image-domains"],
  });

  const { data: modelData, isLoading: modelLoading, isError: modelError } = useQuery<any[]>({
    queryKey: ["/api/analytics/models"],
  });

  const { data: endpointsData, isLoading: endpointsLoading, isError: endpointsError } = useQuery<any>({
    queryKey: ["/api/analytics/endpoints-coverage"],
  });

  const { data: trustScoreData, isLoading: trustLoading, isError: trustError } = useQuery<{
    distribution: Array<{ bucket: string; count: number }>;
    byChain: Array<{ chainId: number; avgScore: number; agentCount: number }>;
    topAgents: Array<{ id: string; name: string | null; imageUrl: string | null; chainId: number; trustScore: number; slug: string | null }>;
  }>({
    queryKey: ["/api/analytics/trust-scores"],
  });

  const { data: topAgents, isLoading: topLoading, isError: topError } = useQuery<any>({
    queryKey: ["/api/analytics/top-agents"],
  });

  const pieData = chainDist?.map(c => ({
    name: CHAIN_NAMES[c.chainId] || `Chain ${c.chainId}`,
    value: c.total,
    chainId: c.chainId,
  })) || [];

  const metadataChartData = metadataQuality?.map(c => ({
    name: CHAIN_NAMES[c.chainId] || `Chain ${c.chainId}`,
    chainId: c.chainId,
    Complete: c.complete,
    Partial: c.partial,
    Minimal: c.minimal,
    Empty: c.empty,
    total: c.complete + c.partial + c.minimal + c.empty,
  })) || [];

  const x402ChartData = x402Data?.map(c => ({
    name: CHAIN_NAMES[c.chainId] || `Chain ${c.chainId}`,
    Enabled: c.enabled,
    Disabled: c.disabled,
    Unknown: c.unknown,
  })) || [];

  const regChartData = (() => {
    if (!registrations) return [];
    const chainIds = [...new Set(registrations.map(r => r.chainId))];
    const buckets = [...new Set(registrations.map(r => r.blockBucket))].sort((a, b) => a - b);
    return buckets.map(b => {
      const row: any = { block: b.toLocaleString() };
      chainIds.forEach(cid => {
        const match = registrations.find(r => r.blockBucket === b && r.chainId === cid);
        row[CHAIN_NAMES[cid] || `Chain ${cid}`] = match?.count || 0;
      });
      return row;
    });
  })();

  const regChainIds = registrations ? [...new Set(registrations.map(r => r.chainId))] : [];

  const uriPieData = uriData?.overall?.map((u: any, i: number) => ({
    name: u.scheme,
    value: u.count,
    fill: URI_COLORS[i % URI_COLORS.length],
  })) || [];

  const categoryChartData = categoryData?.overall?.filter((c: any) => c.category !== "General").slice(0, 10) || [];

  const histogramData = controllerData?.histogram
    ? ["1", "2-5", "6-10", "11-50", "51-100", "100+"].map(bucket => ({
        bucket,
        count: controllerData.histogram.find((h: any) => h.bucket === bucket)?.count || 0,
      }))
    : [];

  const chainDistChartConfig: ChartConfig = {};
  pieData.forEach(c => {
    chainDistChartConfig[c.name] = { label: c.name, color: CHAIN_COLORS[c.chainId] || "#888" };
  });

  const metadataChartConfig: ChartConfig = {
    Complete: { label: "Complete", color: QUALITY_COLORS.complete },
    Partial: { label: "Partial", color: QUALITY_COLORS.partial },
    Minimal: { label: "Minimal", color: QUALITY_COLORS.minimal },
    Empty: { label: "Empty", color: QUALITY_COLORS.empty },
  };

  const x402ChartConfig: ChartConfig = {
    Enabled: { label: "Enabled", color: X402_COLORS.enabled },
    Disabled: { label: "Disabled", color: X402_COLORS.disabled },
    Unknown: { label: "Unknown", color: X402_COLORS.unknown },
  };

  return (
    <Layout>
      <SEO
        title={ANALYTICS.seo.title}
        description={ANALYTICS.seo.description}
        path="/analytics"
      />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-analytics-title">
            {ANALYTICS.seo.title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {ANALYTICS.subtitle}
          </p>
        </div>

        {/* KPI Cards */}
        {overviewError ? <ChartError message="Failed to load overview statistics" /> : overviewLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-lg" />
            ))}
          </div>
        ) : overview ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <KpiCard label="Total Agents" value={overview.totalAgents} icon={Users}
              subtitle={(overview as any).newAgents24h > 0 ? `+${((overview as any).newAgents24h).toLocaleString()} new today` : "no new today"} iconColor="text-blue-500" />
            <KpiCard label="With Metadata" value={overview.withMetadata} icon={FileText}
              subtitle={formatPercent(overview.withMetadata, overview.totalAgents)} iconColor="text-violet-500" />
            <KpiCard label="With Image" value={overview.withImage} icon={Image}
              subtitle={formatPercent(overview.withImage, overview.totalAgents)} iconColor="text-purple-500" />
            <KpiCard label="x402 Enabled" value={overview.x402Enabled} icon={Zap}
              subtitle={formatPercent(overview.x402Enabled, overview.totalAgents)} iconColor="text-amber-500" />
            <KpiCard label="Active" value={overview.activeTrue} icon={Activity}
              subtitle={formatPercent(overview.activeTrue, overview.totalAgents)} iconColor="text-emerald-500" />
            <KpiCard label="Unique Controllers" value={overview.uniqueControllers} icon={Fingerprint}
              subtitle={`avg ${overview.uniqueControllers > 0 ? (overview.totalAgents / overview.uniqueControllers).toFixed(1) : "—"} agents each`} iconColor="text-indigo-500" />
            <KpiCard label="Cross-Chain Controllers" value={overview.crossChainControllers} icon={Globe}
              subtitle={`${overview.uniqueControllers > 0 ? ((overview.crossChainControllers / overview.uniqueControllers) * 100).toFixed(1) : "0"}% of controllers`} iconColor="text-cyan-500" />
            <KpiCard label="With Endpoints" value={overview.withEndpoints} icon={Link2}
              subtitle={formatPercent(overview.withEndpoints, overview.totalAgents)} iconColor="text-sky-500" />
            <KpiCard label="Reputation Events" value={overview.reputationEvents} icon={Award}
              subtitle="early-stage signal" iconColor="text-orange-500" />
            <KpiCard label="Unique Names" value={overview.uniqueNames} icon={Database}
              subtitle={`of ${overview.totalNamed?.toLocaleString()} named`} iconColor="text-teal-500" />
          </div>
        ) : null}

        {/* Chain Distribution */}
        <section>
          <SectionTitle subtitle="Agent distribution and chain-specific metrics">
            Chain Distribution
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Agents by Chain</CardTitle>
              </CardHeader>
              <CardContent>
                {chainDistError ? <ChartError /> : chainDistLoading ? <ChartSkeleton /> : (
                  <ChartContainer config={chainDistChartConfig} className="h-[280px]">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.chainId} fill={CHAIN_COLORS[entry.chainId] || "#888"} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Chain Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                {chainDistError ? <ChartError /> : chainDistLoading ? <ChartSkeleton /> : (
                  <div className="space-y-3">
                    {chainDist?.map(c => {
                      const metaPct = c.total > 0 ? (c.withMetadata / c.total * 100) : 0;
                      const x402Pct = c.total > 0 ? (c.x402Enabled / c.total * 100) : 0;
                      const imgPct = c.total > 0 ? (c.withImage / c.total * 100) : 0;
                      const endPct = c.total > 0 ? (c.withEndpoints / c.total * 100) : 0;
                      return (
                        <div key={c.chainId} className="space-y-1.5" data-testid={`chain-comparison-${c.chainId}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ChainBadge chainId={c.chainId} />
                              <span className="text-sm font-medium">{c.total.toLocaleString()} agents</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Metadata</div>
                              <div className="font-medium">{metaPct.toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">x402</div>
                              <div className="font-medium">{x402Pct.toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Images</div>
                              <div className="font-medium">{imgPct.toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Endpoints</div>
                              <div className="font-medium">{endPct.toFixed(1)}%</div>
                            </div>
                          </div>
                          <div className="flex gap-0.5 h-2 rounded overflow-hidden">
                            <div className="bg-blue-500" style={{ width: `${metaPct}%` }} title="Metadata" />
                            <div className="bg-green-500" style={{ width: `${x402Pct}%` }} title="x402" />
                            <div className="bg-purple-500" style={{ width: `${imgPct}%` }} title="Images" />
                            <div className="bg-gray-300 dark:bg-gray-600 flex-1" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Registration Velocity */}
        <section>
          <SectionTitle subtitle="Agent registration activity over block ranges">
            Registration Velocity
          </SectionTitle>
          <Card>
            <CardContent className="pt-4">
              {regsError ? <ChartError /> : regsLoading ? <ChartSkeleton /> : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={regChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="block" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend />
                      {regChainIds.map(cid => (
                        <Area
                          key={cid}
                          type="monotone"
                          dataKey={CHAIN_NAMES[cid] || `Chain ${cid}`}
                          stackId="1"
                          fill={CHAIN_COLORS[cid] || "#888"}
                          stroke={CHAIN_COLORS[cid] || "#888"}
                          fillOpacity={0.6}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Metadata Quality + x402 */}
        <section>
          <SectionTitle subtitle="Data completeness and payment protocol adoption">
            Metadata Quality & x402 Support
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Metadata Completeness by Chain</CardTitle>
              </CardHeader>
              <CardContent>
                {mqError ? <ChartError /> : mqLoading ? <ChartSkeleton /> : (
                  <ChartContainer config={metadataChartConfig} className="h-[280px]">
                    <BarChart data={metadataChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="Complete" stackId="a" fill={QUALITY_COLORS.complete} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Partial" stackId="a" fill={QUALITY_COLORS.partial} />
                      <Bar dataKey="Minimal" stackId="a" fill={QUALITY_COLORS.minimal} />
                      <Bar dataKey="Empty" stackId="a" fill={QUALITY_COLORS.empty} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">x402 Payment Support by Chain</CardTitle>
              </CardHeader>
              <CardContent>
                {x402Error ? <ChartError /> : x402Loading ? <ChartSkeleton /> : (
                  <ChartContainer config={x402ChartConfig} className="h-[280px]">
                    <BarChart data={x402ChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="Enabled" stackId="a" fill={X402_COLORS.enabled} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Disabled" stackId="a" fill={X402_COLORS.disabled} />
                      <Bar dataKey="Unknown" stackId="a" fill={X402_COLORS.unknown} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* URI Schemes + Categories */}
        <section>
          <SectionTitle subtitle="How agent metadata is stored and what agents do">
            Data Storage & Agent Categories
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Metadata URI Schemes</CardTitle>
              </CardHeader>
              <CardContent>
                {uriError ? <ChartError /> : uriLoading ? <ChartSkeleton /> : (
                  <ChartContainer config={{}} className="h-[280px]">
                    <PieChart>
                      <Pie
                        data={uriPieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {uriPieData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Agent Categories (by description)</CardTitle>
              </CardHeader>
              <CardContent>
                {catError ? <ChartError /> : catLoading ? <ChartSkeleton /> : (
                  <ChartContainer config={{}} className="h-[280px]">
                    <BarChart data={categoryChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {categoryChartData.map((_: any, i: number) => (
                          <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Controller Concentration */}
        <section>
          <SectionTitle subtitle="How agents are distributed across controller wallets">
            Controller Concentration
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Agents per Controller (Distribution)</CardTitle>
              </CardHeader>
              <CardContent>
                {controllerError ? <ChartError /> : controllerLoading ? <ChartSkeleton /> : (
                  <ChartContainer config={{}} className="h-[280px]">
                    <BarChart data={histogramData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Controllers</CardTitle>
              </CardHeader>
              <CardContent>
                {controllerError ? <ChartError /> : controllerLoading ? <ChartSkeleton /> : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {controllerData?.topControllers?.slice(0, 10).map((c: any, i: number) => (
                      <div key={c.address} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0" data-testid={`controller-row-${i}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-muted-foreground font-mono">{truncateAddress(c.address)}</code>
                            <div className="flex gap-0.5">
                              {c.chains?.map((cid: number) => (
                                <ChainBadge key={cid} chainId={cid} size="sm" />
                              ))}
                            </div>
                          </div>
                          {c.sampleNames?.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {c.sampleNames.slice(0, 3).join(", ")}
                              {c.sampleNames.length > 3 && "..."}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2 shrink-0">
                          {c.agentCount}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* AI Models + Image Domains */}
        <section>
          <SectionTitle subtitle="Technology and infrastructure signals">
            AI Models & Image Infrastructure
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">AI Model Mentions</CardTitle>
              </CardHeader>
              <CardContent>
                {modelError ? <ChartError /> : modelLoading ? <ChartSkeleton /> : (
                  <ChartContainer config={{}} className="h-[240px]">
                    <BarChart data={modelData || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis dataKey="model" type="category" width={110} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Image Hosting Domains</CardTitle>
              </CardHeader>
              <CardContent>
                {imgError ? <ChartError /> : imgLoading ? <ChartSkeleton /> : (
                  <ChartContainer config={{}} className="h-[240px]">
                    <BarChart data={(imageDomains || []).slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis dataKey="domain" type="category" width={140} tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Opportunity Signals */}
        <section>
          <SectionTitle subtitle="Growth signals and coverage gaps across chains">
            Opportunity Signals
          </SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chainDistError || overviewError ? <ChartError message="Failed to load opportunity data" /> : chainDist && overview && !chainDistLoading && !overviewLoading ? (
              <>
                {chainDist.map(c => {
                  const metaPct = c.total > 0 ? (c.withMetadata / c.total * 100) : 0;
                  const metaGap = c.total - c.withMetadata;
                  const imgGap = c.total - c.withImage;
                  const x402Pct = c.total > 0 ? (c.x402Enabled / c.total * 100) : 0;
                  const endpointPct = c.total > 0 ? (c.withEndpoints / c.total * 100) : 0;
                  return (
                    <Card key={c.chainId} data-testid={`opportunity-${c.chainId}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <ChainBadge chainId={c.chainId} />
                          <CardTitle className="text-sm font-medium">
                            {CHAIN_NAMES[c.chainId]}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="space-y-1">
                            <div className="text-muted-foreground">Metadata Gap</div>
                            <div className="font-semibold text-amber-500 dark:text-amber-400">{metaGap.toLocaleString()} agents</div>
                            <div className="text-muted-foreground">{(100 - metaPct).toFixed(1)}% missing</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-muted-foreground">Image Gap</div>
                            <div className="font-semibold text-amber-500 dark:text-amber-400">{imgGap.toLocaleString()} agents</div>
                            <div className="text-muted-foreground">{c.total > 0 ? ((1 - c.withImage / c.total) * 100).toFixed(1) : 0}% missing</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-muted-foreground">x402 Adoption</div>
                            <div className="font-semibold">{x402Pct.toFixed(1)}%</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-muted-foreground">Endpoint Coverage</div>
                            <div className="font-semibold">{endpointPct.toFixed(1)}%</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <Card data-testid="opportunity-cross-chain">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-medium">Cross-Chain Trends</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Multi-chain Controllers</div>
                      <div className="font-semibold text-lg">{overview.crossChainControllers}</div>
                      <div className="text-muted-foreground">of {overview.uniqueControllers.toLocaleString()} unique</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Name Uniqueness</div>
                      <div className="font-semibold">
                        {overview.uniqueNames.toLocaleString()} unique / {overview.totalNamed.toLocaleString()} named
                      </div>
                      <div className="text-muted-foreground">
                        {formatPercent(overview.uniqueNames, overview.totalNamed)} unique rate
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Reputation Events</div>
                      <div className="font-semibold">{overview.reputationEvents}</div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[180px] rounded-lg" />)
            )}
          </div>
        </section>

        {/* Top Agents */}
        <section>
          <SectionTitle subtitle="Agents with the richest on-chain profiles">
            Top Agents
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="w-4 h-4" /> By Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topError ? <ChartError /> : topLoading ? <ChartSkeleton /> : (
                  <div className="space-y-2">
                    {topAgents?.byCapabilities?.slice(0, 10).map((a: any, i: number) => (
                      <Link key={a.id} href={`/agent/${a.slug || a.id}`}>
                        <div className="flex items-center justify-between py-1 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1" data-testid={`top-cap-${i}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                            <span className="text-sm font-medium truncate">{a.name}</span>
                            <ChainBadge chainId={a.chainId} size="sm" />
                          </div>
                          <Badge variant="secondary" className="shrink-0">{a.capCount}</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> By Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topError ? <ChartError /> : topLoading ? <ChartSkeleton /> : (
                  <div className="space-y-2">
                    {topAgents?.byTags?.slice(0, 10).map((a: any, i: number) => (
                      <Link key={a.id} href={`/agent/${a.slug || a.id}`}>
                        <div className="flex items-center justify-between py-1 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1" data-testid={`top-tag-${i}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                            <span className="text-sm font-medium truncate">{a.name}</span>
                            <ChainBadge chainId={a.chainId} size="sm" />
                          </div>
                          <Badge variant="secondary" className="shrink-0">{a.tagCount}</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" /> By Description Detail
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topError ? <ChartError /> : topLoading ? <ChartSkeleton /> : (
                  <div className="space-y-2">
                    {topAgents?.byDescriptionLength?.slice(0, 10).map((a: any, i: number) => (
                      <Link key={a.id} href={`/agent/${a.slug || a.id}`}>
                        <div className="py-1 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1" data-testid={`top-desc-${i}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                              <span className="text-sm font-medium truncate">{a.name}</span>
                              <ChainBadge chainId={a.chainId} size="sm" />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{a.descLength} chars</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Endpoints & OASF Coverage */}
        {(endpointsError || endpointsLoading || endpointsData) && (
          <section>
            <SectionTitle subtitle="Protocol interoperability and endpoint availability">
              Endpoints & OASF Coverage
            </SectionTitle>
            {endpointsError ? <ChartError message="Failed to load endpoints data" /> : endpointsLoading ? <ChartSkeleton /> : endpointsData ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="With Endpoints" value={endpointsData.withEndpoints} icon={Link2}
                subtitle={`${formatPercent(endpointsData.withEndpoints, overview?.totalAgents || 1)} of all agents`} iconColor="text-sky-500" />
              <KpiCard label="OASF Skills" value={endpointsData.withOasfSkills} icon={Layers} iconColor="text-violet-500" />
              <KpiCard label="OASF Domains" value={endpointsData.withOasfDomains} icon={Globe} iconColor="text-cyan-500" />
              <KpiCard label="Supported Trust" value={overview?.withSupportedTrust || 0} icon={Award} iconColor="text-orange-500" />
            </div>
            {endpointsData.byChain?.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Endpoint Coverage by Chain</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="h-[200px]">
                    <BarChart data={endpointsData.byChain.map((c: any) => ({
                      name: CHAIN_NAMES[c.chainId] || `Chain ${c.chainId}`,
                      Endpoints: c.withEndpoints,
                      OASF: c.withOasfSkills + c.withOasfDomains,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Endpoints" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="OASF" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
            </>
            ) : null}
          </section>
        )}

      </div>
    </Layout>
  );
}
