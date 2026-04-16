import { useDeferredValue, useState } from "react";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { MPP } from "@/lib/content-zones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  Store, DollarSign, Users, TrendingUp, AlertTriangle,
  Search, ChevronLeft, ChevronRight, Network, Coins,
} from "lucide-react";
import { Link } from "wouter";

// --- Category + payment method color tables ---

const CATEGORY_COLORS: Record<string, string> = {
  "ai-model": "#8b5cf6",
  "dev-infra": "#3b82f6",
  compute: "#f59e0b",
  data: "#22c55e",
  commerce: "#ec4899",
  other: "#6b7280",
};
const CATEGORY_LABELS: Record<string, string> = {
  "ai-model": "AI Models",
  "dev-infra": "Dev Infra",
  compute: "Compute",
  data: "Data",
  commerce: "Commerce",
  other: "Other",
};
const PAYMENT_METHOD_COLORS: Record<string, string> = {
  tempo: "#14b8a6",
  stripe: "#635bff",
  lightning: "#f7931a",
  other: "#6b7280",
};

// --- Primitives ---

function KpiCard({ label, value, icon: Icon, subtitle, iconColor }: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  subtitle?: string;
  iconColor?: string;
}) {
  return (
    <Card>
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

function ChartSkeleton() {
  return <Skeleton className="w-full h-[280px] rounded-lg" />;
}

function ChartError({ message }: { message?: string }) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{message ?? "Failed to load data"}</AlertDescription>
    </Alert>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{message}</div>
  );
}

// --- Hero KPIs ---

interface MppDirectoryStats {
  totalServices: number;
  activeServices: number;
  categoryBreakdown: Record<string, number>;
  pricingModelBreakdown: Record<string, number>;
  paymentMethodBreakdown: Record<string, number>;
  priceStats: { median: number; mean: number; min: number; max: number } | null;
  snapshotDate: string | null;
}

interface MppChainStats {
  volume: number;
  txCount: number;
  uniquePayers: number;
  activeRecipients: number;
}

interface MppAdoptionStats {
  mpp: number;
  x402: number;
  both: number;
}

function HeroStats() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<MppDirectoryStats>({
    queryKey: ["/api/mpp/directory/stats"],
  });
  const { data: chain } = useQuery<MppChainStats>({
    queryKey: ["/api/mpp/chain/stats"],
  });
  const { data: adoption } = useQuery<MppAdoptionStats>({
    queryKey: ["/api/mpp/adoption"],
  });

  if (statsLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (statsError) {
    return (
      <Alert className="my-2">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          MPP analytics coming online — first snapshot pending. Check back once the indexer runs.
        </AlertDescription>
      </Alert>
    );
  }

  const categoryCount = stats ? Object.keys(stats.categoryBreakdown).length : 0;
  const snapshotLabel = stats?.snapshotDate
    ? `Snapshot: ${new Date(stats.snapshotDate).toLocaleDateString()}`
    : "Awaiting first snapshot";

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Services Indexed"
          value={stats?.activeServices ?? 0}
          subtitle={`${stats?.totalServices ?? 0} all-time`}
          icon={Store}
          iconColor="text-teal-500"
        />
        <KpiCard
          label="Categories"
          value={categoryCount}
          subtitle={snapshotLabel}
          icon={TrendingUp}
          iconColor="text-blue-500"
        />
        <KpiCard
          label="Tempo pathUSD Volume"
          value={chain?.volume != null ? `$${chain.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
          subtitle={chain?.txCount != null ? `${chain.txCount.toLocaleString()} transfers` : undefined}
          icon={Coins}
          iconColor="text-emerald-500"
        />
        <KpiCard
          label="Multi-Protocol Agents"
          value={adoption?.both ?? 0}
          subtitle={`${adoption?.mpp ?? 0} MPP · ${adoption?.x402 ?? 0} x402`}
          icon={Network}
          iconColor="text-purple-500"
        />
      </div>
    </>
  );
}

// --- Breakdown charts ---

function BreakdownCharts() {
  const { data: stats, isLoading, isError } = useQuery<MppDirectoryStats>({
    queryKey: ["/api/mpp/directory/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }
  if (isError) return <ChartError message="Failed to load MPP breakdown" />;
  if (!stats) return null;

  const categoryPieData = Object.entries(stats.categoryBreakdown).map(([category, count]) => ({
    name: CATEGORY_LABELS[category] ?? category,
    value: count,
    category,
  }));
  const paymentMethodData = Object.entries(stats.paymentMethodBreakdown).map(([method, count]) => ({
    name: method,
    value: count,
  }));

  const categoryConfig: ChartConfig = Object.fromEntries(
    Object.entries(CATEGORY_COLORS).map(([k, v]) => [k, { label: CATEGORY_LABELS[k] ?? k, color: v }])
  );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Service Categories</CardTitle></CardHeader>
        <CardContent>
          {categoryPieData.length > 0 ? (
            <ChartContainer config={categoryConfig} className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryPieData.map((entry) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <EmptyState message="No categorized services yet." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Payment Methods</CardTitle></CardHeader>
        <CardContent>
          {paymentMethodData.length > 0 ? (
            <ChartContainer config={{ value: { label: "Services", color: "#14b8a6" } }} className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentMethodData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {paymentMethodData.map((entry) => (
                      <Cell key={entry.name} fill={PAYMENT_METHOD_COLORS[entry.name] ?? PAYMENT_METHOD_COLORS.other} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <EmptyState message="No payment methods indexed yet." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Trend charts ---

interface MppDirectorySnapshotRow {
  snapshotDate: string;
  totalServices: number;
  activeServices: number;
  categoryBreakdown?: Record<string, number>;
}

interface VolumeTrendPoint {
  day: string;
  volume: number;
  tx_count: number;
}

function TrendCharts() {
  const { data: dirTrends, isLoading: dirLoading, isError: dirError } = useQuery<MppDirectorySnapshotRow[]>({
    queryKey: ["/api/mpp/directory/trends"],
  });
  const { data: volumeTrend, isLoading: volLoading, isError: volError } = useQuery<VolumeTrendPoint[]>({
    queryKey: ["/api/mpp/chain/volume-trend"],
  });

  const dirChartData = (dirTrends ?? []).map((s) => ({
    date: new Date(s.snapshotDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    total: s.totalServices,
    active: s.activeServices,
  }));
  const volChartData = (volumeTrend ?? []).map((p) => ({
    date: new Date(p.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    volume: p.volume,
    tx: p.tx_count,
  }));

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Directory Growth</CardTitle></CardHeader>
        <CardContent>
          {dirLoading ? <ChartSkeleton />
            : dirError ? <ChartError message="Failed to load growth data" />
            : dirChartData.length > 1 ? (
              <ChartContainer config={{
                total: { label: "Total", color: "#3b82f6" },
                active: { label: "Active", color: "#22c55e" },
              }} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dirChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Total" />
                    <Area type="monotone" dataKey="active" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} name="Active" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <EmptyState message="Growth trends appear after several days of snapshots." />
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Tempo pathUSD Daily Volume</CardTitle></CardHeader>
        <CardContent>
          {volLoading ? <ChartSkeleton />
            : volError ? <ChartError message="Failed to load volume data" />
            : volChartData.length > 1 ? (
              <ChartContainer config={{ volume: { label: "Volume (USD)", color: "#14b8a6" } }} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Volume"]} />
                    <Bar dataKey="volume" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <EmptyState message="Volume data appears after the Tempo indexer runs." />
            )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Page ---

export default function MppPage() {
  return (
    <Layout>
      <SEO title={MPP.seo.title} description={MPP.seo.description} path="/mpp" />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{MPP.overview.title}</h1>
          <p className="text-muted-foreground mt-1">{MPP.overview.description}</p>
        </header>
        <HeroStats />
        <BreakdownCharts />
        <TrendCharts />
        {/* Sections added in Tasks 6-12 */}
      </div>
    </Layout>
  );
}
