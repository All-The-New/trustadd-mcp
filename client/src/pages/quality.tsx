import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
  AreaChart, Area, ReferenceLine, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import {
  ShieldCheck, AlertTriangle, Eye, Code2, BookOpen, Clock,
  Layers, Lock, TrendingUp, Users, Zap, Globe, Star,
} from "lucide-react";
import { ChainBadge } from "@/components/chain-badge";
import { Link } from "wouter";

type QualityOffenders = {
  topSpamControllers: Array<{ address: string; fullAddress?: string; agentCount: number; chains: number[]; topFlag: string }>;
  topSpamTemplates: Array<{ fingerprint: string; agentCount: number; controllerCount: number; sampleUri: string; uriType: string; chains: number[] }>;
  multiChainSpammers: Array<{ address: string; fullAddress?: string; chainCount: number; agentCount: number; chains: number[] }>;
  topHighQualityControllers: Array<{ address: string; fullAddress?: string; agentCount: number; chains: number[]; avgTrustScore: number; maxTrustScore: number }>;
  dailyRegistrations: Array<{ date: string; high: number; medium: number; low: number; spam: number }>;
  spamConcentration: { top20Count: number; totalSpam: number; top20Pct: number };
};

type QualitySummary = {
  totalAgents: number;
  verifiedAgents: number;
  tierCounts: { high: number; medium: number; low: number; spam: number; archived: number; unclassified: number };
  spamFlagCounts: { whitespace_name: number; blank_uri: number; spec_uri: number; code_as_uri: number; test_agent: number; duplicate_template: number };
  trustDistribution: Array<{ bucket: string; count: number }>;
  perChainQuality: Array<{ chainId: number; chainName: string; total: number; high: number; medium: number; low: number; spam: number }>;
  lastUpdated: string;
};

const TIER_COLORS = {
  high: "#22c55e",
  medium: "#3b82f6",
  low: "#f59e0b",
  spam: "#ef4444",
  archived: "#6b7280",
  unclassified: "#94a3b8",
};

const TIER_LABELS: Record<string, string> = {
  high: "High Quality",
  medium: "Medium Quality",
  low: "Low Quality",
  spam: "Spam / Noise",
  archived: "Archived",
  unclassified: "Unclassified",
};

const FLAG_LABELS: Record<string, string> = {
  whitespace_name: "No real name",
  blank_uri: "No metadata link",
  duplicate_template: "Duplicate template",
  test_agent: "Test or demo agent",
  spec_uri: "Metadata links to spec page",
  code_as_uri: "Code pasted as metadata link",
};

const URI_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ipfs: { label: "IPFS", color: "#8b5cf6" },
  "data-uri": { label: "Data URI", color: "#f59e0b" },
  http: { label: "HTTP/S", color: "#3b82f6" },
  blank: { label: "Blank", color: "#6b7280" },
  code: { label: "Code as URI", color: "#ef4444" },
  other: { label: "Other", color: "#94a3b8" },
};

import { getExplorerAddressUrl } from "@shared/chains";

function AddressLink({ address, fullAddress, chainId }: { address: string; fullAddress?: string; chainId?: number }) {
  const target = fullAddress ?? address;
  const href = getExplorerAddressUrl(chainId ?? 1, target);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-primary hover:underline"
    >
      {address}
    </a>
  );
}

function TrustScoreBadge({ score }: { score: number }) {
  const color = score >= 40 ? "#22c55e" : score >= 30 ? "#3b82f6" : "#f59e0b";
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-xs" style={{ color }}>
      <Star className="w-3 h-3" />
      {score}
    </span>
  );
}

const areaConfig: ChartConfig = {
  spam: { label: "Spam", color: TIER_COLORS.spam },
  medium: { label: "Medium", color: TIER_COLORS.medium },
  high: { label: "High", color: TIER_COLORS.high },
  low: { label: "Low", color: TIER_COLORS.low },
};

const donutConfig: ChartConfig = {
  high: { label: "High Quality", color: TIER_COLORS.high },
  medium: { label: "Medium Quality", color: TIER_COLORS.medium },
  low: { label: "Low Quality", color: TIER_COLORS.low },
  spam: { label: "Spam / Noise", color: TIER_COLORS.spam },
  archived: { label: "Archived", color: TIER_COLORS.archived },
};

const stackedConfig: ChartConfig = {
  high: { label: "High", color: TIER_COLORS.high },
  medium: { label: "Medium", color: TIER_COLORS.medium },
  low: { label: "Low", color: TIER_COLORS.low },
  spam: { label: "Spam", color: TIER_COLORS.spam },
};

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number | string; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <Card data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold tracking-tight mt-1" style={color ? { color } : {}}>
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-32" />
      </CardContent>
    </Card>
  );
}

function TierCard({ tier, count, total, description, criteria }: {
  tier: string; count: number; total: number; description: string; criteria: string;
}) {
  const color = TIER_COLORS[tier as keyof typeof TIER_COLORS] ?? "#94a3b8";
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
  return (
    <Card data-testid={`tier-card-${tier}`} className="flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <Badge style={{ backgroundColor: color, color: "#fff" }} className="text-xs font-semibold">
            {TIER_LABELS[tier] ?? tier}
          </Badge>
          <span className="text-sm font-semibold text-muted-foreground">{pct}%</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1">
        <p className="text-2xl font-bold tracking-tight">{count.toLocaleString()}</p>
        <p className="text-sm font-medium mt-2">{description}</p>
        <p className="text-xs text-muted-foreground mt-1">{criteria}</p>
      </CardContent>
    </Card>
  );
}

function CustomDonutLabel({ viewBox, total }: { viewBox?: { cx: number; cy: number }; total: number }) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.4em" className="fill-foreground text-xl font-bold" style={{ fontSize: 22, fontWeight: 700 }}>
        {total.toLocaleString()}
      </tspan>
      <tspan x={cx} dy="1.4em" className="fill-muted-foreground" style={{ fontSize: 11 }}>
        total agents
      </tspan>
    </text>
  );
}

export default function QualityPage() {
  const { data, isLoading, isError } = useQuery<QualitySummary>({
    queryKey: ["/api/quality/summary"],
  });

  // Per-agent quality analysis is now gated (x402). Disable this query to avoid 402 noise.
  const offenders: QualityOffenders | undefined = undefined;
  const offendersLoading = false;

  const pct = (n: number) =>
    data ? `${((n / data.totalAgents) * 100).toFixed(1)}%` : "";

  const donutData = data
    ? (["high", "medium", "low", "spam", "archived"] as const)
        .filter((t) => data.tierCounts[t] > 0)
        .map((t) => ({ name: TIER_LABELS[t], value: data.tierCounts[t], color: TIER_COLORS[t] }))
    : [];

  const flagData = data
    ? Object.entries(data.spamFlagCounts)
        .map(([flag, count]) => ({ flag: FLAG_LABELS[flag] ?? flag, count, key: flag }))
        .sort((a, b) => b.count - a.count)
    : [];

  const chainData = data?.perChainQuality ?? [];

  const trustData = data?.trustDistribution ?? [];

  const lastUpdatedStr = data?.lastUpdated
    ? new Date(data.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <Layout>
      <SEO
        title="Quality Report | TrustAdd"
        description="How TrustAdd classifies the quality of every AI agent it indexes — covering spam detection, quality tiers, and what it means to be a verified agent."
      />

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary uppercase tracking-wider">Quality Report</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Quality by Design</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            TrustAdd indexes every AI agent registered on-chain — but not all agents are equal. We classify each one automatically
            so users and developers see the signal, not the noise.
            {lastUpdatedStr && <span className="text-sm block mt-1">Last classified: {lastUpdatedStr}</span>}
          </p>
        </div>
      </section>

      {/* KPI strip */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-strip">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : isError ? (
            <p className="col-span-4 text-sm text-destructive">Failed to load quality data.</p>
          ) : data ? (
            <>
              <StatCard label="Total agents indexed" value={data.totalAgents} icon={Layers} />
              <StatCard
                label="Shown in directory"
                value={data.verifiedAgents}
                sub="Trust ≥ 20, non-spam"
                icon={Eye}
                color="#3b82f6"
              />
              <StatCard
                label="High quality agents"
                value={data.tierCounts.high}
                sub={`${pct(data.tierCounts.high)} of total`}
                icon={ShieldCheck}
                color="#22c55e"
              />
              <StatCard
                label="Filtered as spam"
                value={data.tierCounts.spam + data.tierCounts.archived}
                sub={`${pct(data.tierCounts.spam + data.tierCounts.archived)} of total`}
                icon={AlertTriangle}
                color="#ef4444"
              />
            </>
          ) : null}
        </div>
      </section>

      {/* Tier explanation */}
      <section className="mx-auto max-w-6xl px-4 py-4">
        <h2 className="text-xl font-semibold tracking-tight mb-1">How we classify agents</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Every agent is automatically assigned a quality tier based on its trust score, metadata completeness, and spam signals.
          No manual curation — the rules are fully deterministic.
        </p>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <TierCard
              tier="high"
              count={data.tierCounts.high}
              total={data.totalAgents}
              description="Established, trusted agents"
              criteria="Trust score ≥ 30"
            />
            <TierCard
              tier="medium"
              count={data.tierCounts.medium}
              total={data.totalAgents}
              description="Legitimate agents with good metadata"
              criteria="Trust score ≥ 15, has name and description"
            />
            <TierCard
              tier="low"
              count={data.tierCounts.low}
              total={data.totalAgents}
              description="Registered but with minimal information"
              criteria="Has some metadata, but below medium threshold"
            />
            <TierCard
              tier="spam"
              count={data.tierCounts.spam}
              total={data.totalAgents}
              description="Automated, empty, or abusive registrations"
              criteria="Blank name, duplicate template, test agent, or other spam signals"
            />
            <TierCard
              tier="archived"
              count={data.tierCounts.archived}
              total={data.totalAgents}
              description="Old spam that has been moved to archive"
              criteria="Spam agents registered more than 60 days ago"
            />
          </div>
        ) : null}

        {data && (
          <div className="mt-4 p-4 rounded-lg border bg-muted/40 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">What gets shown in the directory by default</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                The agent directory defaults to showing only <strong>verified agents</strong> — those with a trust score of 20 or above
                that are not classified as spam or archived. That's <strong>{data.verifiedAgents.toLocaleString()} agents</strong> out of {data.totalAgents.toLocaleString()} total.
                You can toggle to see all agents at any time.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Charts */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-xl font-semibold tracking-tight mb-1">Quality findings</h2>
        <p className="text-sm text-muted-foreground mb-6">Live data from the full indexed agent set.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart A: Donut */}
          <Card data-testid="chart-tier-distribution">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tier distribution</CardTitle>
              <p className="text-xs text-muted-foreground">How all {data?.totalAgents.toLocaleString() ?? "…"} indexed agents break down by quality tier</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : donutData.length > 0 ? (
                <ChartContainer config={donutConfig} className="h-64 w-full">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      dataKey="value"
                      strokeWidth={2}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
                            <p className="font-medium">{d.name}</p>
                            <p className="text-muted-foreground">{d.value.toLocaleString()} agents</p>
                            {data && <p className="text-muted-foreground">{((d.value / data.totalAgents) * 100).toFixed(1)}%</p>}
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ChartContainer>
              ) : null}
              {/* Legend */}
              {data && (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                  {donutData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-muted-foreground">{d.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart B: Spam flags */}
          <Card data-testid="chart-spam-flags">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spam signals detected</CardTitle>
              <p className="text-xs text-muted-foreground">Agents can carry multiple flags — counts overlap</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : flagData.length > 0 ? (
                <ChartContainer config={{ count: { label: "Agents", color: "#ef4444" } }} className="h-64 w-full">
                  <BarChart data={flagData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
                    <YAxis type="category" dataKey="flag" width={160} tick={{ fontSize: 11 }} />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
                            <p className="font-medium">{d.flag}</p>
                            <p className="text-muted-foreground">{d.count.toLocaleString()} agents flagged</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : null}
            </CardContent>
          </Card>

          {/* Chart C: Per-chain stacked quality */}
          <Card data-testid="chart-chain-quality">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quality by chain</CardTitle>
              <p className="text-xs text-muted-foreground">Agent quality profile across each indexed blockchain</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : chainData.length > 0 ? (
                <ChartContainer config={stackedConfig} className="h-64 w-full">
                  <BarChart data={chainData} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="chainName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
                    <ChartTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[140px]">
                            <p className="font-medium mb-1">{label}</p>
                            {[...payload].reverse().map((p) => (
                              <div key={p.dataKey} className="flex justify-between gap-4">
                                <span className="text-muted-foreground">{stackedConfig[p.dataKey as string]?.label ?? p.dataKey}</span>
                                <span className="font-medium">{Number(p.value).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="spam" stackId="a" fill={TIER_COLORS.spam} name="Spam" />
                    <Bar dataKey="low" stackId="a" fill={TIER_COLORS.low} name="Low" />
                    <Bar dataKey="medium" stackId="a" fill={TIER_COLORS.medium} name="Medium" />
                    <Bar dataKey="high" stackId="a" fill={TIER_COLORS.high} name="High" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : null}
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                {(["high", "medium", "low", "spam"] as const).map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[t] }} />
                    <span className="text-xs text-muted-foreground">{TIER_LABELS[t]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chart D: Trust score distribution */}
          <Card data-testid="chart-trust-distribution">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Trust score distribution</CardTitle>
              <p className="text-xs text-muted-foreground">
                Agents by score range — the vertical line at 20 marks the directory threshold
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : trustData.length > 0 ? (
                <ChartContainer config={{ count: { label: "Agents", color: "#3b82f6" } }} className="h-64 w-full">
                  <BarChart data={trustData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
                            <p className="font-medium">Score {d.bucket}</p>
                            <p className="text-muted-foreground">{d.count.toLocaleString()} agents</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {trustData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.bucket === "20-29" || entry.bucket === "30-39" || entry.bucket === "40-49" || entry.bucket === "50+"
                              ? "#22c55e"
                              : "#3b82f6"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : null}
              <p className="text-xs text-muted-foreground mt-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1" />
                Green bars (score ≥ 20) are shown in the directory by default
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Spam Sources Section */}
      <section className="border-t mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="text-xl font-semibold tracking-tight text-destructive">Spam sources</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Who and what is producing the low-quality registrations — the addresses, templates, and patterns behind the noise.
        </p>

        {/* Registration timeline */}
        <Card className="mb-6" data-testid="chart-daily-registrations">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">30-day registration timeline</CardTitle>
            <p className="text-xs text-muted-foreground">Daily agent registrations by quality tier — bulk events show as sharp spikes</p>
          </CardHeader>
          <CardContent>
            {offendersLoading ? (
              <Skeleton className="h-56 w-full rounded-lg" />
            ) : offenders?.dailyRegistrations && offenders.dailyRegistrations.length > 0 ? (
              <ChartContainer config={areaConfig} className="h-56 w-full">
                <AreaChart data={offenders.dailyRegistrations} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v.toLocaleString()} />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm min-w-[140px]">
                          <p className="font-medium mb-1">{label}</p>
                          {[...payload].reverse().map((p) => (
                            <div key={p.dataKey} className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{areaConfig[p.dataKey as string]?.label ?? p.dataKey}</span>
                              <span className="font-medium">{Number(p.value).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="spam" stackId="1" stroke={TIER_COLORS.spam} fill={TIER_COLORS.spam} fillOpacity={0.7} />
                  <Area type="monotone" dataKey="low" stackId="1" stroke={TIER_COLORS.low} fill={TIER_COLORS.low} fillOpacity={0.7} />
                  <Area type="monotone" dataKey="medium" stackId="1" stroke={TIER_COLORS.medium} fill={TIER_COLORS.medium} fillOpacity={0.7} />
                  <Area type="monotone" dataKey="high" stackId="1" stroke={TIER_COLORS.high} fill={TIER_COLORS.high} fillOpacity={0.8} />
                </AreaChart>
              </ChartContainer>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
              {(["spam", "medium", "high", "low"] as const).map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[t] }} />
                  <span className="text-xs text-muted-foreground">{TIER_LABELS[t]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Spam concentration insight */}
        {offenders?.spamConcentration && (
          <div className="mb-6 p-4 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-3" data-testid="spam-concentration">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Spam is broadly distributed, not centralised</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                The top 20 spam addresses account for only{" "}
                <strong>{offenders.spamConcentration.top20Count.toLocaleString()}</strong> of{" "}
                <strong>{offenders.spamConcentration.totalSpam.toLocaleString()}</strong> spam agents (
                {offenders.spamConcentration.top20Pct}%). The bulk of the noise comes from hundreds of small operators,
                not a single bad actor — making it a systemic challenge rather than a targeted one.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top spam controllers */}
          <Card data-testid="table-spam-controllers">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top spam producers</CardTitle>
              <p className="text-xs text-muted-foreground">Addresses that have registered the most spam agents</p>
            </CardHeader>
            <CardContent className="p-0">
              {offendersLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">#</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Address</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Agents</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Chains</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Top signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(offenders?.topSpamControllers ?? []).map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2 text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-4 py-2">
                            <AddressLink address={row.address} fullAddress={row.fullAddress} chainId={row.chains[0]} />
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">{row.agentCount.toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {row.chains.slice(0, 3).map((c) => <ChainBadge key={c} chainId={c} />)}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{FLAG_LABELS[row.topFlag] ?? row.topFlag}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Multi-chain spammers */}
          <Card data-testid="table-multichain-spammers">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Multi-chain spam operators</CardTitle>
              <p className="text-xs text-muted-foreground">Addresses deliberately operating spam across multiple chains</p>
            </CardHeader>
            <CardContent className="p-0">
              {offendersLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">#</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Address</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Agents</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Active on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(offenders?.multiChainSpammers ?? []).map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2 text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-4 py-2">
                            <AddressLink address={row.address} fullAddress={row.fullAddress} chainId={row.chains[0]} />
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">{row.agentCount.toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {row.chains.map((c) => <ChainBadge key={c} chainId={c} />)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Spam template clusters */}
        <div className="mb-2">
          <h3 className="text-base font-semibold mb-1">Spam template clusters</h3>
          <p className="text-xs text-muted-foreground mb-4">
            The most-used metadata templates across spam registrations — the "what" behind the bulk operators.
          </p>
        </div>
        {offendersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="spam-templates-grid">
            {(offenders?.topSpamTemplates ?? []).slice(0, 6).map((t, i) => {
              const uriMeta = URI_TYPE_LABELS[t.uriType] ?? { label: t.uriType, color: "#94a3b8" };
              return (
                <Card key={i} className="flex flex-col">
                  <CardContent className="pt-4 pb-3 px-4 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-2xl font-bold">{t.agentCount.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground ml-1">agents</span>
                      </div>
                      <Badge style={{ backgroundColor: uriMeta.color, color: "#fff" }} className="text-xs shrink-0">
                        {uriMeta.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t.controllerCount.toLocaleString()} distinct controllers &middot; fingerprint <code className="text-[10px] bg-muted px-1 rounded">{t.fingerprint.slice(0, 8)}</code>
                    </p>
                    {t.sampleUri && (
                      <p className="text-xs text-muted-foreground font-mono truncate mb-2" title={t.sampleUri}>
                        {t.sampleUri}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {t.chains.map((c) => <ChainBadge key={c} chainId={c} />)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Quality Builders Section */}
      <section className="border-t bg-muted/20 mx-auto max-w-6xl px-4 py-10" style={{ maxWidth: "100%" }}>
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-semibold tracking-tight text-green-600 dark:text-green-400">Quality builders</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            The addresses building high-quality, high-trust AI agents — who's doing it right.
          </p>

          {/* Top high quality controllers table */}
          <Card className="mb-6" data-testid="table-quality-builders">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top quality producers</CardTitle>
              <p className="text-xs text-muted-foreground">Addresses with the most high-quality agents (trust score ≥ 30)</p>
            </CardHeader>
            <CardContent className="p-0">
              {offendersLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">#</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Address</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Agents</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Avg trust</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Max trust</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Chains</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(offenders?.topHighQualityControllers ?? []).map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2 text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-4 py-2">
                            <AddressLink address={row.address} fullAddress={row.fullAddress} chainId={row.chains[0]} />
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">{row.agentCount}</td>
                          <td className="px-4 py-2 text-right"><TrustScoreBadge score={row.avgTrustScore} /></td>
                          <td className="px-4 py-2 text-right"><TrustScoreBadge score={row.maxTrustScore} /></td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {row.chains.map((c) => <ChainBadge key={c} chainId={c} />)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cross-chain spotlight */}
          {offenders?.topHighQualityControllers && (
            <div>
              <h3 className="text-base font-semibold mb-1">Cross-chain builders</h3>
              <p className="text-xs text-muted-foreground mb-4">Operators running high-quality agents across 3 or more chains simultaneously.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" data-testid="cross-chain-builders">
                {offenders.topHighQualityControllers
                  .filter((c) => c.chains.length >= 3)
                  .slice(0, 6)
                  .map((row, i) => (
                    <Card key={i}>
                      <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-center justify-between mb-2">
                          <AddressLink address={row.address} fullAddress={row.fullAddress} chainId={row.chains[0]} />
                          <Badge className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                            <Globe className="w-2.5 h-2.5 mr-1" />
                            {row.chains.length} chains
                          </Badge>
                        </div>
                        <p className="text-xl font-bold">{row.agentCount} <span className="text-xs font-normal text-muted-foreground">agents</span></p>
                        <p className="text-xs text-muted-foreground mb-2">avg trust <TrustScoreBadge score={row.avgTrustScore} /></p>
                        <div className="flex flex-wrap gap-1">
                          {row.chains.map((c) => <ChainBadge key={c} chainId={c} />)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
              {offenders.topHighQualityControllers.filter((c) => c.chains.length >= 3).length === 0 && (
                <p className="text-sm text-muted-foreground">No cross-chain builders with 3+ chains currently in the high tier.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Why it matters */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-semibold tracking-tight mb-1">Why this matters</h2>
          <p className="text-sm text-muted-foreground mb-6">Quality classification makes TrustAdd useful to both humans and machines.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-3" data-testid="impact-directory">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Clean directory by default</h3>
              <p className="text-sm text-muted-foreground">
                When you browse the agent directory, you see verified agents first — not bulk-registered noise or spam templates.
                You can always reveal the full set with one click.
              </p>
            </div>
            <div className="flex flex-col gap-3" data-testid="impact-api">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Machine-readable quality</h3>
              <p className="text-sm text-muted-foreground">
                Every agent in the API includes its quality tier and spam flags. Developers building on top of TrustAdd
                can filter, route, or rank agents programmatically — without reimplementing classification logic.
              </p>
            </div>
            <div className="flex flex-col gap-3" data-testid="impact-transparency">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Fully transparent</h3>
              <p className="text-sm text-muted-foreground">
                The rules are public and deterministic. No manual curation, no editorial judgment — just a consistent,
                automated policy applied equally to every agent across all chains.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Methodology accordion */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-xl font-semibold tracking-tight mb-1">Methodology</h2>
        <p className="text-sm text-muted-foreground mb-5">
          The full details of how classification works — for anyone who wants to understand the system deeply.
        </p>
        <Accordion type="multiple" className="border rounded-lg divide-y overflow-hidden">
          <AccordionItem value="rules" className="px-4" data-testid="accordion-rules">
            <AccordionTrigger className="text-sm font-medium py-4">Classification rules in detail</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
              <p>Tiers are assigned in priority order. An agent can only be in one tier:</p>
              <ul className="space-y-2 list-none">
                <li><strong className="text-foreground">Spam</strong> — any spam flag is present, or the agent has a trust score of zero with no name and no description.</li>
                <li><strong className="text-foreground">High</strong> — trust score ≥ 30. No spam flags.</li>
                <li><strong className="text-foreground">Medium</strong> — trust score ≥ 15, has a name, has a description. No spam flags.</li>
                <li><strong className="text-foreground">Low</strong> — everything else with at least some presence on-chain.</li>
                <li><strong className="text-foreground">Archived</strong> — spam agents registered more than 60 days ago.</li>
              </ul>
              <p>Spam flags detected:</p>
              <ul className="space-y-1.5 list-none">
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">whitespace_name</code> — name is null, "unnamed", empty, or all whitespace</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">blank_uri</code> — no metadata URI provided at registration</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">spec_uri</code> — metadata URI points to an Ethereum EIP specification page instead of actual agent metadata</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">code_as_uri</code> — metadata URI contains raw JavaScript code (e.g. <code className="text-xs bg-muted px-1 py-0.5 rounded">const </code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">require(</code>)</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">test_agent</code> — name or description strongly indicates a test or demo agent</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">duplicate_template</code> — the same metadata URI fingerprint is shared by more than 50 distinct controller addresses</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cadence" className="px-4" data-testid="accordion-cadence">
            <AccordionTrigger className="text-sm font-medium py-4">Re-classification and refresh cadence</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2 pb-4">
              <p>Agents aren't re-checked constantly. We use a tiered refresh schedule to focus effort on high-value agents:</p>
              <ul className="space-y-1.5 list-none">
                <li><strong className="text-foreground">High quality</strong> — re-enriched every 6 hours</li>
                <li><strong className="text-foreground">Medium quality</strong> — every 24 hours</li>
                <li><strong className="text-foreground">Low quality</strong> — every 7 days</li>
                <li><strong className="text-foreground">Spam / Archived</strong> — every 30 days</li>
              </ul>
              <p>New agents are classified immediately on discovery, before their first re-resolve cycle.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="overlap" className="px-4" data-testid="accordion-overlap">
            <AccordionTrigger className="text-sm font-medium py-4">Spam flag overlap</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground pb-4">
              <p>
                A single agent can carry multiple spam flags at once. For example, an agent might have both a blank name
                (<code className="text-xs bg-muted px-1 py-0.5 rounded">whitespace_name</code>) and no metadata URI
                (<code className="text-xs bg-muted px-1 py-0.5 rounded">blank_uri</code>). This means the flag counts shown
                in the chart above will add up to more than the total number of spam agents — that's expected and correct.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="duplicate" className="px-4" data-testid="accordion-duplicate">
            <AccordionTrigger className="text-sm font-medium py-4">How duplicate template detection works</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground pb-4">
              <p>
                Some operators bulk-register large numbers of agents using the same metadata URI or JSON template.
                TrustAdd computes a fingerprint (a short hash) of each agent's metadata URI and groups agents by that fingerprint.
                If more than 50 distinct controller addresses share the same fingerprint, those agents are flagged as
                <code className="text-xs bg-muted mx-1 px-1 py-0.5 rounded">duplicate_template</code>.
                The threshold of 50 is set to avoid penalising legitimate multi-agent deployments.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="no-curation" className="px-4" data-testid="accordion-no-curation">
            <AccordionTrigger className="text-sm font-medium py-4">No manual curation</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground pb-4">
              <p>
                TrustAdd does not manually whitelist or blacklist agents. Every classification decision is made by the
                same deterministic rules applied to all agents equally. If you believe an agent has been incorrectly
                classified, the most effective path is to improve the agent's on-chain metadata — a higher trust score
                and well-formed metadata will move it to the appropriate tier automatically on the next refresh cycle.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* CTA footer */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-semibold tracking-tight mb-1">Explore the data</h2>
          <p className="text-sm text-muted-foreground mb-5">Quality tiers are live — see them in action.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/agents">
              <Button data-testid="cta-browse-agents" className="gap-2">
                <Eye className="w-4 h-4" />
                Browse verified agents
              </Button>
            </Link>
            <Link href="/api-docs">
              <Button variant="outline" data-testid="cta-api-docs" className="gap-2">
                <Code2 className="w-4 h-4" />
                Explore the API
              </Button>
            </Link>
            <Link href="/status">
              <Button variant="outline" data-testid="cta-status" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                View indexer status
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
