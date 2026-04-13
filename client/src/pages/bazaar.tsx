import { useState, useDeferredValue } from "react";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Store, DollarSign, Users, TrendingUp, AlertTriangle, Coins,
  Search, ExternalLink, Wifi, WifiOff, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Fingerprint, Link2,
} from "lucide-react";
import { Link } from "wouter";
import { CHAIN_NAMES } from "@shared/chains";

const CATEGORY_COLORS: Record<string, string> = {
  ai: "#8b5cf6",
  data: "#3b82f6",
  compute: "#f59e0b",
  blockchain: "#22c55e",
  content: "#ec4899",
  utility: "#06b6d4",
  finance: "#f97316",
  other: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI / Inference",
  data: "Data & APIs",
  compute: "Compute",
  blockchain: "Blockchain",
  content: "Content",
  utility: "Utility",
  finance: "Finance",
  other: "Other",
};

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

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "N/A";
  if (price < 0.001) return `$${price.toFixed(6)}`;
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

function formatVolume(vol: number | null | undefined): string {
  if (vol == null || vol === 0) return "$0";
  if (vol < 1) return `$${vol.toFixed(2)}`;
  if (vol < 1_000) return `$${vol.toFixed(0)}`;
  if (vol < 1_000_000) return `$${(vol / 1_000).toFixed(1)}K`;
  return `$${(vol / 1_000_000).toFixed(2)}M`;
}

function truncateUrl(url: string, max = 60): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 3) + "...";
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function HealthBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-xs">Unknown</Badge>;
  if (status === "verified_up" || status === "up") {
    return <Badge className="bg-green-500/15 text-green-600 text-xs"><Wifi className="w-3 h-3 mr-1" />Live</Badge>;
  }
  return <Badge variant="destructive" className="text-xs"><WifiOff className="w-3 h-3 mr-1" />{status}</Badge>;
}

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return (
    <Badge
      variant="outline"
      className="text-xs"
      style={{ borderColor: color, color }}
    >
      {CATEGORY_LABELS[category] || category}
    </Badge>
  );
}

type BazaarServiceRow = {
  id: number;
  resourceUrl: string;
  name: string | null;
  description: string | null;
  category: string;
  network: string;
  priceUsd: number | null;
  payTo: string | null;
  healthStatus: string | null;
  uptimePct: number | null;
  avgLatencyMs: number | null;
  trustScore: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  method: string | null;
  assetName: string | null;
  scheme: string | null;
  paymentVolumeUsdc: number | null;
  paymentCount: number | null;
};

function ServiceDetailRow({ service }: { service: BazaarServiceRow }) {
  return (
    <tr className="bg-muted/20">
      <td colSpan={6} className="px-4 py-3">
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            {service.description && (
              <div>
                <span className="text-muted-foreground">Description: </span>
                <span>{service.description.length > 200 ? service.description.slice(0, 197) + "..." : service.description}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">URL: </span>
              <a href={service.resourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                {service.resourceUrl}
              </a>
            </div>
            {service.payTo && (
              <div>
                <span className="text-muted-foreground">Pay To: </span>
                <span className="font-mono">{service.payTo}</span>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            {service.method && (
              <div><span className="text-muted-foreground">Method: </span><Badge variant="outline" className="text-xs">{service.method}</Badge></div>
            )}
            {service.assetName && (
              <div><span className="text-muted-foreground">Token: </span>{service.assetName}</div>
            )}
            {service.scheme && (
              <div><span className="text-muted-foreground">Scheme: </span>{service.scheme}</div>
            )}
            {service.uptimePct != null && (
              <div><span className="text-muted-foreground">Uptime: </span>{service.uptimePct.toFixed(1)}%</div>
            )}
            {(service.paymentVolumeUsdc != null && service.paymentVolumeUsdc > 0) && (
              <div>
                <span className="text-muted-foreground">Payment Volume: </span>
                {formatVolume(service.paymentVolumeUsdc)} USDC ({service.paymentCount?.toLocaleString() ?? 0} txns)
              </div>
            )}
            <div>
              <span className="text-muted-foreground">First Seen: </span>
              {new Date(service.firstSeenAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function Bazaar() {
  const [searchInput, setSearchInput] = useState("");
  const searchQuery = useDeferredValue(searchInput);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const PAGE_SIZE = 25;

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<{
    totalServices: number;
    activeServices: number;
    categoryBreakdown: Array<{ category: string; count: number }>;
    networkBreakdown: Array<{ network: string; count: number }>;
    priceStats: { median: number | null; mean: number | null; min: number | null; max: number | null };
    totalPayToWallets: number;
    totalPaymentVolumeUsdc: number;
    totalPaymentCount: number;
  }>({
    queryKey: ["/api/bazaar/stats"],
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery<{
    services: BazaarServiceRow[];
    total: number;
  }>({
    queryKey: ["/api/bazaar/services", { category: selectedCategory, search: searchQuery, sortBy, offset: page * PAGE_SIZE, limit: PAGE_SIZE }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      if (searchQuery) params.set("search", searchQuery);
      params.set("sortBy", sortBy);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      return fetch(`/api/bazaar/services?${params}`).then(r => r.json());
    },
  });

  const { data: trends, isLoading: trendsLoading } = useQuery<Array<{
    snapshotDate: string;
    totalServices: number;
    activeServices: number;
    newServicesCount: number;
    categoryBreakdown: any;
    priceStats: any;
    totalPayToWallets: number;
  }>>({
    queryKey: ["/api/bazaar/trends"],
  });

  const { data: topServices } = useQuery<Array<{
    id: number;
    resourceUrl: string;
    name: string | null;
    category: string;
    priceUsd: number | null;
    trustScore: number | null;
    avgLatencyMs: number | null;
    healthStatus: string | null;
  }>>({
    queryKey: ["/api/bazaar/top-services"],
  });

  const { data: priceDist } = useQuery<Array<{ bucket: string; count: number }>>({
    queryKey: ["/api/bazaar/price-distribution"],
  });

  const { data: crossref } = useQuery<Array<{
    payTo: string;
    serviceName: string | null;
    category: string;
    priceUsd: number | null;
    agentId: string;
    agentName: string | null;
    agentSlug: string | null;
    chainId: number;
    trustScore: number | null;
    imageUrl: string | null;
    matchType: string;
  }>>({
    queryKey: ["/api/bazaar/crossref"],
  });

  const categoryChartConfig: ChartConfig = Object.fromEntries(
    Object.entries(CATEGORY_COLORS).map(([k, v]) => [k, { label: CATEGORY_LABELS[k] || k, color: v }])
  );

  const pieData = stats?.categoryBreakdown?.map(c => ({
    name: CATEGORY_LABELS[c.category] || c.category,
    value: c.count,
    category: c.category,
  })) || [];

  const trendData = trends?.slice().reverse().map(s => ({
    date: new Date(s.snapshotDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    total: s.totalServices,
    active: s.activeServices,
    newServices: s.newServicesCount,
    wallets: s.totalPayToWallets,
  })) || [];

  const totalPages = servicesData ? Math.ceil(servicesData.total / PAGE_SIZE) : 0;

  return (
    <Layout>
      <SEO
        title="x402 Bazaar Analytics"
        description="The definitive intelligence dashboard for the x402 agent economy. Track services, pricing, growth, and health across the Coinbase x402 Bazaar."
        path="/bazaar"
      />

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">x402 Bazaar Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Intelligence dashboard for the x402 agent payment ecosystem. Tracking services, pricing, and growth across the Coinbase Bazaar.
          </p>
        </div>

        {/* KPI Cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : statsError ? (
          <ChartError message="Failed to load bazaar stats" />
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total Services"
              value={stats.activeServices}
              icon={Store}
              subtitle={`${stats.totalServices} all-time`}
              iconColor="text-blue-500"
            />
            <KpiCard
              label="Median Price"
              value={formatPrice(stats.priceStats.median)}
              icon={DollarSign}
              subtitle={`Range: ${formatPrice(stats.priceStats.min)} - ${formatPrice(stats.priceStats.max)}`}
              iconColor="text-green-500"
            />
            <KpiCard
              label="Unique Merchants"
              value={stats.totalPayToWallets}
              icon={Users}
              subtitle="Distinct payTo wallets"
              iconColor="text-purple-500"
            />
            <KpiCard
              label="Payment Volume"
              value={formatVolume(stats.totalPaymentVolumeUsdc)}
              icon={Coins}
              subtitle={`${stats.totalPaymentCount.toLocaleString()} transactions`}
              iconColor="text-orange-500"
            />
          </div>
        ) : null}

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Service Categories</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? <ChartSkeleton /> : statsError ? <ChartError /> : pieData.length > 0 ? (
                <ChartContainer config={categoryChartConfig} className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
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
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No data yet. Indexer will populate data on next run.</p>
              )}
            </CardContent>
          </Card>

          {/* Price Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Price Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {!priceDist ? <ChartSkeleton /> : priceDist.length > 0 ? (
                <ChartContainer config={{ count: { label: "Services", color: "#3b82f6" } }} className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priceDist} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="bucket" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [v.toLocaleString(), "Services"]} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No pricing data available.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pricing Stats + Network */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Minimum</p>
                    <p className="text-lg font-bold">{formatPrice(stats.priceStats.min)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Maximum</p>
                    <p className="text-lg font-bold">{formatPrice(stats.priceStats.max)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Median</p>
                    <p className="text-lg font-bold">{formatPrice(stats.priceStats.median)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Mean</p>
                    <p className="text-lg font-bold">{formatPrice(stats.priceStats.mean)}</p>
                  </div>
                </div>
              ) : <Skeleton className="h-32" />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Network Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="space-y-2">
                  {stats.networkBreakdown.map(n => (
                    <div key={n.network} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{n.network}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.max((n.count / stats.activeServices) * 100, 2)}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground w-16 text-right">{n.count.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Skeleton className="h-32" />}
            </CardContent>
          </Card>
        </div>

        {/* Growth Trends */}
        {trendData.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Growth Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ total: { label: "Total Services", color: "#3b82f6" }, active: { label: "Active", color: "#22c55e" } }} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Total Services" />
                    <Area type="monotone" dataKey="active" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} name="Active" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {trendData.length <= 1 && !trendsLoading && (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground text-center">
                Growth trends will appear after a few days of data collection. The indexer runs every 6 hours and stores daily snapshots.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ERC-8004 Cross-Reference */}
        {crossref && crossref.length > 0 && (
          <div>
            <SectionTitle subtitle="Bazaar services linked to verified ERC-8004 agent identities via payment addresses">
              <Fingerprint className="w-5 h-5 inline mr-2 -mt-0.5" />Identity Cross-Reference
            </SectionTitle>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {crossref.slice(0, 9).map(cr => (
                <Card key={cr.payTo} className="hover:border-primary/30 transition-colors">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={cr.imageUrl || undefined} />
                        <AvatarFallback className="text-xs">{(cr.agentName || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <Link href={cr.agentSlug ? `/agent/${cr.agentSlug}` : `/agent/${cr.agentId}`}>
                          <p className="text-sm font-medium truncate hover:text-primary cursor-pointer">{cr.agentName || "Unknown Agent"}</p>
                        </Link>
                        <p className="text-xs text-muted-foreground">{CHAIN_NAMES[cr.chainId] || `Chain ${cr.chainId}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryBadge category={cr.category} />
                      {cr.priceUsd != null && (
                        <Badge variant="secondary" className="text-xs">{formatPrice(cr.priceUsd)}</Badge>
                      )}
                      {cr.trustScore != null && (
                        <Badge variant="outline" className="text-xs">Score: {cr.trustScore}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 truncate">
                      <Link2 className="w-3 h-3 inline mr-1" />{cr.serviceName || truncateAddress(cr.payTo)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Top Services by Trust Score */}
        {topServices && topServices.length > 0 && (
          <>
            <SectionTitle subtitle="Services with health monitoring from x402Scout">Top Rated Services</SectionTitle>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topServices.slice(0, 9).map(s => (
                <Card key={s.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium line-clamp-1">{s.name || "Unnamed"}</p>
                      <HealthBadge status={s.healthStatus} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryBadge category={s.category} />
                      {s.priceUsd != null && (
                        <Badge variant="secondary" className="text-xs">{formatPrice(s.priceUsd)}</Badge>
                      )}
                      {s.trustScore != null && (
                        <Badge variant="outline" className="text-xs">Score: {s.trustScore}</Badge>
                      )}
                      {s.avgLatencyMs != null && (
                        <Badge variant="outline" className="text-xs">{Math.round(s.avgLatencyMs)}ms</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Service Explorer */}
        <div>
          <SectionTitle subtitle="Browse and filter all indexed x402 services">Service Explorer</SectionTitle>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
                className="pl-10"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setPage(0); }}
              className="h-10 px-3 rounded-md border bg-background text-sm"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(0); }}
              className="h-10 px-3 rounded-md border bg-background text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="volume">Payment Volume</option>
              <option value="trust">Trust Score</option>
              <option value="latency">Latency</option>
            </select>
          </div>

          {/* Services Table */}
          {servicesLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : servicesData && servicesData.services.length > 0 ? (
            <>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2.5 font-medium">Service</th>
                        <th className="text-left px-4 py-2.5 font-medium">Category</th>
                        <th className="text-right px-4 py-2.5 font-medium">Price</th>
                        <th className="text-center px-4 py-2.5 font-medium hidden md:table-cell">Health</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">Latency</th>
                        <th className="text-center px-4 py-2.5 font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicesData.services.map((s) => (
                        <>
                          <tr
                            key={s.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {expandedId === s.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                                <div>
                                  <p className="font-medium line-clamp-1">{s.name || "Unnamed"}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                    {truncateUrl(s.resourceUrl)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <CategoryBadge category={s.category} />
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs">
                              {formatPrice(s.priceUsd)}
                            </td>
                            <td className="px-4 py-2.5 text-center hidden md:table-cell">
                              <HealthBadge status={s.healthStatus} />
                            </td>
                            <td className="px-4 py-2.5 text-right hidden lg:table-cell text-muted-foreground">
                              {s.avgLatencyMs != null ? `${Math.round(s.avgLatencyMs)}ms` : "-"}
                            </td>
                            <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <a href={s.resourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </td>
                          </tr>
                          {expandedId === s.id && <ServiceDetailRow key={`detail-${s.id}`} service={s} />}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, servicesData.total)} of {servicesData.total.toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-sm text-muted-foreground text-center">
                  {searchInput || selectedCategory
                    ? "No services match your filters. Try adjusting your search."
                    : "No services indexed yet. The bazaar indexer runs every 6 hours to populate this data."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
