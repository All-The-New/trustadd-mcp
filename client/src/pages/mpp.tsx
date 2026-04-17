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
  Search, ChevronLeft, ChevronRight, Network, Coins, Info,
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
const VERDICT_BADGE_CLASSES: Record<string, string> = {
  TRUSTED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  CAUTION: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  UNTRUSTED: "bg-red-500/10 text-red-600 border-red-500/20",
  UNKNOWN: "bg-muted text-muted-foreground",
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
          {MPP.dashboard.preIndexerEmpty}
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
        <CardHeader className="pb-2"><CardTitle className="text-base">{MPP.dashboard.categoriesTitle}</CardTitle></CardHeader>
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
        <CardHeader className="pb-2"><CardTitle className="text-base">{MPP.dashboard.paymentMethodsTitle}</CardTitle></CardHeader>
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
        <CardHeader className="pb-2"><CardTitle className="text-base">{MPP.dashboard.directoryGrowthTitle}</CardTitle></CardHeader>
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
        <CardHeader className="pb-2"><CardTitle className="text-base">{MPP.dashboard.volumeTitle}</CardTitle></CardHeader>
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

// --- Directory table ---

interface MppServiceRow {
  id: number;
  serviceUrl: string;
  serviceName: string | null;
  providerName: string | null;
  description: string | null;
  category: string;
  pricingModel: string | null;
  priceAmount: string | null;
  priceCurrency: string | null;
  paymentMethods: Array<{ method: string; currency?: string; recipient?: string }>;
  recipientAddress: string | null;
  isActive: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface MppServicesResponse {
  services: MppServiceRow[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 25;

function formatPrice(amount: string | null): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function DirectoryTable() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDeferredValue(searchInput);
  const [category, setCategory] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<MppServicesResponse>({
    queryKey: ["/api/mpp/directory/services", { category, paymentMethod, search, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      return fetch(`/api/mpp/directory/services?${params}`).then((r) => r.json());
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{MPP.dashboard.directoryTitle}</CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search services…"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              className="pl-8 h-9"
            />
          </div>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            data-testid="filter-mpp-category"
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={paymentMethod}
            onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            data-testid="filter-mpp-payment"
          >
            <option value="">Any payment</option>
            <option value="tempo">Tempo</option>
            <option value="stripe">Stripe</option>
            <option value="lightning">Lightning</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : isError ? (
          <ChartError message="Failed to load services" />
        ) : !data?.services.length ? (
          <EmptyState message={search || category || paymentMethod ? "No services match your filters." : "No services indexed yet."} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="py-2 pr-3 font-medium">Service</th>
                    <th className="py-2 px-3 font-medium">Provider</th>
                    <th className="py-2 px-3 font-medium">Category</th>
                    <th className="py-2 px-3 font-medium">Payment</th>
                    <th className="py-2 px-3 font-medium text-right">Price</th>
                    <th className="py-2 pl-3 font-medium text-right">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-3">
                        <a href={s.serviceUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                          {s.serviceName ?? s.serviceUrl}
                        </a>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{s.providerName ?? "—"}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-xs" style={{ borderColor: CATEGORY_COLORS[s.category] ?? CATEGORY_COLORS.other, color: CATEGORY_COLORS[s.category] ?? CATEGORY_COLORS.other }}>
                          {CATEGORY_LABELS[s.category] ?? s.category}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 space-x-1">
                        {s.paymentMethods.map((p, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{p.method}</Badge>
                        ))}
                      </td>
                      <td className="py-2 px-3 text-right">{formatPrice(s.priceAmount)}</td>
                      <td className="py-2 pl-3 text-right text-muted-foreground">
                        {new Date(s.lastSeenAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages} · {data.total} total
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Top providers ---

interface TopProviderRow {
  provider_name: string;
  service_count: number;
}

function TopProviders() {
  const { data, isLoading, isError } = useQuery<TopProviderRow[]>({
    queryKey: ["/api/mpp/directory/top-providers"],
  });

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{MPP.dashboard.topProvidersTitle}</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : isError ? (
          <ChartError message="Failed to load top providers" />
        ) : !data?.length ? (
          <EmptyState message="No provider data yet." />
        ) : (
          <ol className="space-y-2">
            {data.slice(0, 10).map((p, idx) => (
              <li key={p.provider_name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right text-muted-foreground tabular-nums">{idx + 1}.</span>
                  <span className="font-medium">{p.provider_name}</span>
                </span>
                <Badge variant="secondary">{p.service_count} services</Badge>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// --- Multi-protocol agents ---

interface PublicAgent {
  id: string;
  name?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
  chainId?: number | null;
  verdict?: string | null;
}

interface MultiProtocolResponse {
  total: number;
  agents: PublicAgent[];
}

function MultiProtocolAgents() {
  const { data, isLoading, isError } = useQuery<MultiProtocolResponse>({
    queryKey: ["/api/ecosystem/multi-protocol-agents"],
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{MPP.dashboard.multiProtocolTitle}</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {MPP.methodology.crossProtocol}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : isError ? (
          <ChartError message="Failed to load multi-protocol agents" />
        ) : !data?.agents.length ? (
          <EmptyState message="No agents yet detected on both MPP and x402." />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {data.agents.slice(0, 16).map((a) => (
                <Link key={a.id} href={a.slug ? `/agent/${a.slug}` : `/agent/${a.id}`}>
                  <div className="border rounded-md px-3 py-2 hover:bg-muted/40 transition cursor-pointer">
                    <div className="text-sm font-medium truncate">{a.name ?? "Unnamed agent"}</div>
                    {a.verdict && (
                      <Badge
                        variant="outline"
                        className={`text-xs mt-1 ${VERDICT_BADGE_CLASSES[a.verdict] ?? VERDICT_BADGE_CLASSES.UNKNOWN}`}
                      >
                        {a.verdict}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            {data.total > 16 && (
              <p className="text-xs text-muted-foreground mt-3">
                Showing 16 of {data.total} multi-protocol agents.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-300 mb-1">Early Protocol Notice</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              MPP launched in early 2026 and is still in its earliest stage. Directory coverage,
              payment volume, and agent adoption data reflect a very new ecosystem — numbers will
              grow significantly as more services and agents adopt the standard. Scoring integration
              is planned for methodology v3.
            </p>
          </div>
        </div>
        <HeroStats />
        <BreakdownCharts />
        <TrendCharts />
        <DirectoryTable />
        <TopProviders />
        <MultiProtocolAgents />
        {/* Sections added in Tasks 11-12 */}
      </div>
    </Layout>
  );
}
