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
  Search, ExternalLink, Wifi, WifiOff, ChevronLeft, ChevronRight,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  ai: "#8b5cf6",
  data: "#3b82f6",
  compute: "#f59e0b",
  blockchain: "#22c55e",
  content: "#ec4899",
  utility: "#06b6d4",
  other: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI / Inference",
  data: "Data & APIs",
  compute: "Compute",
  blockchain: "Blockchain",
  content: "Content",
  utility: "Utility",
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

function truncateUrl(url: string, max = 60): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 3) + "...";
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

export default function Bazaar() {
  const [searchInput, setSearchInput] = useState("");
  const searchQuery = useDeferredValue(searchInput);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<{
    totalServices: number;
    activeServices: number;
    categoryBreakdown: Array<{ category: string; count: number }>;
    networkBreakdown: Array<{ network: string; count: number }>;
    priceStats: { median: number | null; mean: number | null; min: number | null; max: number | null };
    totalPayToWallets: number;
  }>({
    queryKey: ["/api/bazaar/stats"],
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery<{
    services: Array<{
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
    }>;
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

      <div className="space-y-8">
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
              label="Categories"
              value={stats.categoryBreakdown.length}
              icon={TrendingUp}
              subtitle={`Top: ${stats.categoryBreakdown[0]?.category || "N/A"}`}
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

          {/* Price Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pricing Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? <ChartSkeleton /> : statsError ? <ChartError /> : stats ? (
                <div className="space-y-4">
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

                  {/* Network breakdown */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Network Distribution</p>
                    <div className="space-y-1.5">
                      {stats.networkBreakdown.map(n => (
                        <div key={n.network} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{n.network}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${(n.count / stats.activeServices) * 100}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground w-12 text-right">{n.count.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
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
                        <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-medium line-clamp-1">{s.name || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {truncateUrl(s.resourceUrl)}
                            </p>
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
                          <td className="px-4 py-2.5 text-center">
                            <a href={s.resourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </td>
                        </tr>
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
