import { useState } from "react";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { SKILLS } from "@/lib/content-zones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChainBadge } from "@/components/chain-badge";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  ScatterChart, Scatter, ZAxis, Tooltip, LabelList, Legend, ResponsiveContainer,
} from "recharts";
import {
  Sparkles, Shield, Users, Brain, Info, ArrowRight,
  Cpu, AlertTriangle, FileCode, Globe, TrendingUp,
} from "lucide-react";

const CHAIN_COLORS: Record<number, string> = {
  1: "#627EEA", 8453: "#0052FF", 56: "#F0B90B", 137: "#8247E5", 42161: "#28A0F0",
};
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum", 8453: "Base", 56: "BNB Chain", 137: "Polygon", 42161: "Arbitrum",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Social": "#f59e0b",
  "AI & Content": "#8b5cf6",
  "DeFi & Trading": "#22c55e",
  "Programming": "#3b82f6",
  "Blockchain": "#06b6d4",
  "Data & Ops": "#ec4899",
  "Other": "#6b7280",
};

function KpiCard({ label, value, icon: Icon, subtitle }: {
  label: string; value: number | string; icon: React.ElementType; subtitle?: string;
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
          <Icon className="w-5 h-5 text-muted-foreground" />
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

function AgentAvatar({ name, imageUrl }: { name: string | null; imageUrl: string | null }) {
  const [imgError, setImgError] = useState(false);
  const initials = (name || "?").slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
      {imageUrl && !imgError ? (
        <img src={imageUrl} alt={name || "Agent"} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      ) : (
        <span className="text-xs font-bold text-muted-foreground">{initials}</span>
      )}
    </div>
  );
}

function getTrustColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function getTrustBg(score: number): string {
  if (score >= 70) return "bg-emerald-500/10 border-emerald-500/30";
  if (score >= 40) return "bg-amber-500/10 border-amber-500/30";
  return "bg-red-500/10 border-red-500/30";
}

function formatSkillName(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function Skills() {
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery<{
    totalNonSpam: number; withCapabilities: number; withTags: number;
    withOasfSkills: number; withOasfDomains: number;
    avgCapabilitiesPerAgent: number; avgTagsPerAgent: number;
  }>({ queryKey: ["/api/skills/summary"] });

  const { data: chainDist, isLoading: chainLoading, isError: chainError } = useQuery<Array<{
    chainId: number; totalAgents: number; withSkills: number; coveragePct: number; shareOfAllSkilled: number;
  }>>({ queryKey: ["/api/skills/chain-distribution"] });

  const { data: topCaps, isLoading: capsLoading, isError: capsError } = useQuery<Array<{
    skill: string; agentCount: number; avgTrust: number;
  }>>({ queryKey: ["/api/skills/top-capabilities"] });

  const { data: categories, isLoading: catLoading, isError: catError } = useQuery<Array<{
    category: string; agentCount: number; skillCount: number; avgTrust: number;
  }>>({ queryKey: ["/api/skills/category-breakdown"] });

  const { data: trustCorr, isLoading: trustLoading, isError: trustError } = useQuery<Array<{
    skill: string; agentCount: number; avgTrust: number;
  }>>({ queryKey: ["/api/skills/trust-correlation"] });

  const { data: oasf, isLoading: oasfLoading, isError: oasfError } = useQuery<{
    topSkills: Array<{ skill: string; agentCount: number }>;
    topDomains: Array<{ domain: string; agentCount: number }>;
    totalAgents: number;
  }>({ queryKey: ["/api/skills/oasf-overview"] });

  const { data: notableAgents, isLoading: notableLoading, isError: notableError } = useQuery<Array<{
    id: string; name: string | null; slug: string | null; chainId: number;
    trustScore: number | null; imageUrl: string | null; skillCount: number;
    capabilities: string[];
  }>>({ queryKey: ["/api/skills/notable-agents"] });

  const coveragePct = summary && summary.totalNonSpam > 0
    ? ((summary.withCapabilities / summary.totalNonSpam) * 100).toFixed(1)
    : "0";

  const topCapsChart = (topCaps || []).slice(0, 15).map(c => ({
    name: formatSkillName(c.skill),
    agents: c.agentCount,
    avgTrust: c.avgTrust,
  }));

  const categoryChart = (categories || []).map(c => ({
    name: c.category,
    agents: c.agentCount,
    skills: c.skillCount,
    avgTrust: c.avgTrust,
    fill: CATEGORY_COLORS[c.category] || "#6b7280",
  }));

  const bubbleData = (trustCorr || []).slice(0, 25).map(c => ({
    name: formatSkillName(c.skill),
    x: c.agentCount,
    y: c.avgTrust,
    z: c.agentCount,
  }));

  const oasfSkillsChart = (oasf?.topSkills || []).slice(0, 10).map(s => {
    const parts = s.skill.split("/");
    const label = parts.length > 1 ? parts[parts.length - 1] : s.skill;
    return { name: formatSkillName(label), agents: s.agentCount, full: s.skill };
  });

  const oasfDomainsChart = (oasf?.topDomains || []).slice(0, 10).map(d => {
    const parts = d.domain.split("/");
    const label = parts.length > 1 ? parts[parts.length - 1] : d.domain;
    return { name: formatSkillName(label), agents: d.agentCount, full: d.domain };
  });

  return (
    <Layout>
      <SEO title={SKILLS.seo.title} description={SKILLS.seo.description} path="/skills" />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-skills-title">
                Skills & Capabilities
              </h1>
              <p className="text-muted-foreground">{SKILLS.subtitle}</p>
            </div>
          </div>
        </div>

        <Alert className="border-blue-500/30 bg-blue-500/5" data-testid="alert-data-caveat">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm">
            Skills data covers <strong>{coveragePct}%</strong> of verified agents ({summary?.withCapabilities?.toLocaleString() || "..."} of {summary?.totalNonSpam?.toLocaleString() || "..."}), concentrated on the Base chain. Data sparsity is shown intentionally as a transparency measure.
          </AlertDescription>
        </Alert>

        {summaryError ? <ChartError message="Failed to load skills summary" /> : summaryLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-lg" />)}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Agents with Skills" value={summary.withCapabilities} icon={Cpu} subtitle={`of ${summary.totalNonSpam.toLocaleString()} verified`} />
            <KpiCard label="Coverage" value={`${coveragePct}%`} icon={TrendingUp} subtitle="Of verified agents" />
            <KpiCard label="Avg Skills/Agent" value={summary.avgCapabilitiesPerAgent} icon={Brain} subtitle="Per skilled agent" />
            <KpiCard label="OASF Agents" value={summary.withOasfSkills} icon={FileCode} subtitle="Structured taxonomy" />
            <KpiCard label="Tagged Agents" value={summary.withTags} icon={Globe} subtitle={`Avg ${summary.avgTagsPerAgent} tags each`} />
          </div>
        ) : null}

        <section data-testid="section-capabilities">
          <SectionTitle subtitle="Top declared capabilities across all agents">
            What Agents Can Do
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top 15 Capabilities</CardTitle>
              </CardHeader>
              <CardContent>
                {capsError ? <ChartError /> : capsLoading ? <ChartSkeleton /> : topCapsChart.length > 0 ? (
                  <div style={{ width: "100%", height: 420 }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                      <BarChart data={topCapsChart} layout="vertical" margin={{ left: 10, right: 16, top: 4, bottom: 4 }} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={130} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                          formatter={(value: any, name: string) => [
                            name === "agents" ? value.toLocaleString() : value,
                            name === "agents" ? "Agents" : "Avg Trust",
                          ]}
                        />
                        <Bar dataKey="agents" radius={[0, 4, 4, 0]} fill="#3b82f6" name="agents" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No data available</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Skill Categories</CardTitle>
              </CardHeader>
              <CardContent>
                {catError ? <ChartError /> : catLoading ? <ChartSkeleton /> : categoryChart.length > 0 ? (
                  <ChartContainer config={{}} className="h-[280px]">
                    <BarChart data={[...categoryChart].sort((a, b) => b.agents - a.agents)} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis type="number" tick={false} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} tickLine={false} axisLine={false} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: any) => [value.toLocaleString(), "Agents"]}
                      />
                      <Bar dataKey="agents" name="agents" radius={[0, 4, 4, 0]}>
                        {[...categoryChart].sort((a, b) => b.agents - a.agents).map((c, i) => (
                          <Cell key={i} fill={c.fill} />
                        ))}
                        <LabelList dataKey="agents" position="right" style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontVariantNumeric: "tabular-nums" }} formatter={(v: number) => v.toLocaleString()} />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No data available</p>}
              </CardContent>
            </Card>
          </div>
        </section>

        <section data-testid="section-trust-correlation">
          <SectionTitle subtitle="How capability types correlate with trust scores">
            Skills & Trust
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Trust by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {catError ? <ChartError /> : catLoading ? <ChartSkeleton /> : categoryChart.length > 0 ? (
                  <ChartContainer config={{}} className="h-[280px]">
                    <BarChart data={[...categoryChart].sort((a, b) => b.avgTrust - a.avgTrust)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 'auto']} className="fill-muted-foreground" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: any) => [`${value} / 100`, "Avg Trust"]}
                      />
                      <Bar dataKey="avgTrust" radius={[0, 4, 4, 0]} name="avgTrust">
                        {[...categoryChart].sort((a, b) => b.avgTrust - a.avgTrust).map((c, i) => {
                          let fill = "#ef4444";
                          if (c.avgTrust >= 70) fill = "#10b981";
                          else if (c.avgTrust >= 40) fill = "#f59e0b";
                          else if (c.avgTrust >= 20) fill = "#f97316";
                          return <Cell key={i} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No data available</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Skills by Trust Score</CardTitle>
              </CardHeader>
              <CardContent>
                {trustError ? <ChartError /> : trustLoading ? <ChartSkeleton /> : bubbleData.length > 0 ? (
                  <ChartContainer config={{}} className="h-[280px]">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" dataKey="x" name="Agents" tick={{ fontSize: 10 }} className="fill-muted-foreground" label={{ value: "Agent Count", position: "bottom", fontSize: 10, className: "fill-muted-foreground" }} />
                      <YAxis type="number" dataKey="y" name="Trust" tick={{ fontSize: 10 }} domain={[0, 'auto']} className="fill-muted-foreground" label={{ value: "Avg Trust", angle: -90, position: "insideLeft", fontSize: 10, className: "fill-muted-foreground" }} />
                      <ZAxis type="number" dataKey="z" range={[40, 400]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: any, name: string) => [value, name === "x" ? "Agents" : name === "y" ? "Avg Trust" : name]}
                        labelFormatter={(label: any) => {
                          const item = bubbleData.find(d => d.x === label);
                          return item?.name || "";
                        }}
                      />
                      <Scatter data={bubbleData} fill="#3b82f6" fillOpacity={0.6} />
                    </ScatterChart>
                  </ChartContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No data available</p>}
              </CardContent>
            </Card>
          </div>
        </section>

        <section data-testid="section-oasf">
          <SectionTitle subtitle="Structured skill taxonomy from the Open Agent Skills Framework">
            Skill Taxonomy (OASF)
          </SectionTitle>
          <Alert className="mb-4 border-amber-500/30 bg-amber-500/5">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              OASF data is available for <strong>{oasf?.totalAgents || "..."}</strong> agents — early signal from a small but growing sample.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top OASF Skills</CardTitle>
              </CardHeader>
              <CardContent>
                {oasfError ? <ChartError /> : oasfLoading ? <ChartSkeleton /> : oasfSkillsChart.length > 0 ? (
                  <ChartContainer config={{}} className="h-[280px]">
                    <BarChart data={oasfSkillsChart} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: any) => [value, "Agents"]}
                        labelFormatter={(label: any) => {
                          const item = oasfSkillsChart.find(s => s.name === label);
                          return item?.full || label;
                        }}
                      />
                      <Bar dataKey="agents" radius={[0, 4, 4, 0]} fill="#8b5cf6" />
                    </BarChart>
                  </ChartContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Not enough OASF data yet</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top OASF Domains</CardTitle>
              </CardHeader>
              <CardContent>
                {oasfError ? <ChartError /> : oasfLoading ? <ChartSkeleton /> : oasfDomainsChart.length > 0 ? (
                  <ChartContainer config={{}} className="h-[280px]">
                    <BarChart data={oasfDomainsChart} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: any) => [value, "Agents"]}
                        labelFormatter={(label: any) => {
                          const item = oasfDomainsChart.find(d => d.name === label);
                          return item?.full || label;
                        }}
                      />
                      <Bar dataKey="agents" radius={[0, 4, 4, 0]} fill="#06b6d4" />
                    </BarChart>
                  </ChartContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Not enough OASF data yet</p>}
              </CardContent>
            </Card>
          </div>
        </section>

        <section data-testid="section-chain-distribution">
          <SectionTitle subtitle="Skills coverage varies dramatically across chains">
            Where Skills Exist
          </SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Skills Coverage by Chain</CardTitle>
              </CardHeader>
              <CardContent>
                {chainError ? <ChartError /> : chainLoading ? <ChartSkeleton /> : chainDist && chainDist.length > 0 ? (
                  <ChartContainer config={{}} className="h-[280px]">
                    <BarChart data={chainDist.map(c => ({
                      name: CHAIN_NAMES[c.chainId] || `Chain ${c.chainId}`,
                      coverage: c.coveragePct,
                      agents: c.withSkills,
                      chainId: c.chainId,
                    }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} unit="%" className="fill-muted-foreground" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: any, name: string) => [
                          name === "coverage" ? `${value}%` : value.toLocaleString(),
                          name === "coverage" ? "Coverage" : "Agents",
                        ]}
                      />
                      <Bar dataKey="coverage" radius={[0, 4, 4, 0]} name="coverage">
                        {chainDist.map(c => <Cell key={c.chainId} fill={CHAIN_COLORS[c.chainId] || "#888"} />)}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No data available</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Agents vs Agents with Skills</CardTitle>
              </CardHeader>
              <CardContent>
                {chainError ? <ChartError /> : chainLoading ? <ChartSkeleton /> : chainDist && chainDist.length > 0 ? (
                  <ChartContainer config={{}} className="h-[280px]">
                    <BarChart
                      data={chainDist.map(c => ({
                        name: CHAIN_NAMES[c.chainId] || `Chain ${c.chainId}`,
                        total: c.totalAgents,
                        skilled: c.withSkills,
                        chainId: c.chainId,
                      }))}
                      layout="vertical"
                      margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                      barSize={10}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} className="fill-muted-foreground" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} tickLine={false} axisLine={false} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: any, name: string) => [value.toLocaleString(), name === "total" ? "Total Agents" : "With Skills"]}
                      />
                      <Legend
                        formatter={(value) => value === "total" ? "Total Agents" : "With Skills"}
                        wrapperStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="total" name="total" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="skilled" name="skilled" radius={[0, 4, 4, 0]}>
                        {chainDist.map(c => <Cell key={c.chainId} fill={CHAIN_COLORS[c.chainId] || "#888"} />)}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No data available</p>}
              </CardContent>
            </Card>
          </div>
        </section>

        <section data-testid="section-notable-agents">
          <SectionTitle subtitle="Agents with the most declared capabilities">
            Most Capable Agents
          </SectionTitle>
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              {notableError ? <ChartError message="Failed to load notable agents" /> : notableLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : notableAgents && notableAgents.length > 0 ? (
                <table className="w-full text-sm" data-testid="table-notable-agents">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-2 font-medium w-8">#</th>
                      <th className="pb-2 pr-2 font-medium">Agent</th>
                      <th className="pb-2 pr-2 font-medium">Chain</th>
                      <th className="pb-2 pr-2 font-medium text-center">Skills</th>
                      <th className="pb-2 pr-2 font-medium text-center">Trust</th>
                      <th className="pb-2 font-medium">Top Capabilities</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {notableAgents.map((agent, idx) => (
                      <tr key={agent.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors" data-testid={`notable-agent-${idx}`}>
                        <td className="py-2.5 pr-2 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="py-2.5 pr-2">
                          <Link href={`/agent/${agent.slug || agent.id}`}>
                            <div className="flex items-center gap-2 cursor-pointer">
                              <AgentAvatar name={agent.name} imageUrl={agent.imageUrl} />
                              <span className="font-medium truncate max-w-[160px]">{agent.name || "Unnamed Agent"}</span>
                            </div>
                          </Link>
                        </td>
                        <td className="py-2.5 pr-2"><ChainBadge chainId={agent.chainId} size="xs" /></td>
                        <td className="py-2.5 pr-2 text-center">
                          <Badge variant="outline" className="text-xs font-medium">
                            <Sparkles className="w-3 h-3 mr-0.5" />
                            {agent.skillCount}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-2 text-center">
                          {agent.trustScore != null ? (
                            <Badge variant="outline" className={`text-xs font-semibold border ${getTrustBg(agent.trustScore)} ${getTrustColor(agent.trustScore)}`}>
                              <Shield className="w-3 h-3 mr-0.5" />
                              {agent.trustScore}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            {agent.capabilities.slice(0, 3).map(cap => (
                              <span key={cap} className="text-[10px] px-1.5 py-0 rounded bg-muted text-muted-foreground font-medium">
                                {formatSkillName(cap).slice(0, 16)}
                              </span>
                            ))}
                            {agent.capabilities.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{agent.capabilities.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5">
                          <Link href={`/agent/${agent.slug || agent.id}`}>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-sm text-muted-foreground text-center py-8">No agents with skills found</p>}
            </CardContent>
          </Card>
        </section>
      </div>
    </Layout>
  );
}
