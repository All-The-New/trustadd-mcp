import { AdminLayout } from "@/components/admin-layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, Globe, Clock, AlertTriangle, Users, Zap, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { useState } from "react";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n?.toLocaleString() ?? "0";
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Icon className="w-4 h-4 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminUsage() {
  const [days, setDays] = useState("7");
  const [logFilter, setLogFilter] = useState({ path: "", ip: "", minStatus: "" });
  const [logPage, setLogPage] = useState(0);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["admin-usage-detailed", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/usage/detailed?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  const logUrl = `/api/admin/usage/log?limit=50&offset=${logPage * 50}${logFilter.path ? `&path=${encodeURIComponent(logFilter.path)}` : ""}${logFilter.ip ? `&ip=${encodeURIComponent(logFilter.ip)}` : ""}${logFilter.minStatus ? `&minStatus=${logFilter.minStatus}` : ""}`;
  const { data: logData } = useQuery<any>({
    queryKey: ["admin-usage-log", logPage, logFilter.path, logFilter.ip, logFilter.minStatus],
    queryFn: async () => {
      const res = await fetch(logUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
    retry: false,
  });

  const s = data?.summary;
  const hourlyData = data?.hourly?.map((h: any) => ({
    ...h,
    hour: new Date(h.hour).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" }),
  })) ?? [];

  return (
    <AdminLayout>
      <SEO title="API Usage" description="TrustAdd API usage analytics" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">API Usage</h1>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24h</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : s ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={BarChart3} label="Total Requests" value={fmtNumber(s.total_requests)} sub={`${s.active_days} active days`} />
              <KpiCard icon={Users} label="Unique IPs" value={fmtNumber(s.unique_ips)} />
              <KpiCard icon={Clock} label="Avg Response" value={`${s.avg_duration_ms}ms`} sub={`p95: ${s.p95_ms}ms | p99: ${s.p99_ms}ms`} />
              <KpiCard icon={AlertTriangle} label="Errors" value={fmtNumber(s.error_count)} sub={`${s.server_error_count} server errors`} />
            </div>

            {/* Traffic Chart */}
            <Card>
              <CardHeader><CardTitle className="text-base">Traffic Over Time</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="hour" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="requests" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Status Code Breakdown */}
              <Card>
                <CardHeader><CardTitle className="text-base">Status Codes</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.statusBreakdown} dataKey="count" nameKey="status_code" cx="50%" cy="50%" outerRadius={70} label={({ status_code, count }: any) => `${status_code}: ${count}`}>
                          {data.statusBreakdown?.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Country Breakdown */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" />Top Countries</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {data.countryBreakdown?.map((c: any) => (
                      <div key={c.country} className="flex items-center justify-between text-sm py-1">
                        <span className="font-medium">{c.country || "Unknown"}</span>
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <span>{fmtNumber(c.hits)} hits</span>
                          <span>{c.unique_ips} IPs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Endpoints */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" />Top Endpoints</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2">Path</th><th className="pb-2 text-right">Hits</th><th className="pb-2 text-right">Unique IPs</th><th className="pb-2 text-right">Avg ms</th><th className="pb-2 text-right">p95 ms</th><th className="pb-2 text-right">Errors</th>
                    </tr></thead>
                    <tbody>
                      {data.topPaths?.map((p: any) => (
                        <tr key={p.path} className="border-b last:border-0">
                          <td className="py-2 font-mono text-xs">{p.path}</td>
                          <td className="py-2 text-right">{fmtNumber(p.hits)}</td>
                          <td className="py-2 text-right">{p.unique_ips}</td>
                          <td className="py-2 text-right">{p.avg_ms}ms</td>
                          <td className="py-2 text-right">{p.p95_ms}ms</td>
                          <td className="py-2 text-right">{p.errors > 0 ? <Badge variant="destructive" className="text-xs">{p.errors}</Badge> : "0"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Slow Endpoints */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" />Slowest Endpoints</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2">Path</th><th className="pb-2 text-right">Avg ms</th><th className="pb-2 text-right">p95 ms</th><th className="pb-2 text-right">Hits</th>
                    </tr></thead>
                    <tbody>
                      {data.slowEndpoints?.map((p: any) => (
                        <tr key={p.path} className="border-b last:border-0">
                          <td className="py-2 font-mono text-xs">{p.path}</td>
                          <td className="py-2 text-right font-medium">{p.avg_ms}ms</td>
                          <td className="py-2 text-right">{p.p95_ms}ms</td>
                          <td className="py-2 text-right">{fmtNumber(p.hits)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Top Users */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Top Users (by IP)</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2">IP</th><th className="pb-2">Country</th><th className="pb-2 text-right">Hits</th><th className="pb-2 text-right">Endpoints</th><th className="pb-2 text-right">Active Days</th><th className="pb-2">User Agent</th>
                    </tr></thead>
                    <tbody>
                      {data.topUsers?.map((u: any) => (
                        <tr key={u.ip} className="border-b last:border-0">
                          <td className="py-2 font-mono text-xs">{u.ip}</td>
                          <td className="py-2">{u.country || "-"}</td>
                          <td className="py-2 text-right font-medium">{fmtNumber(u.hits)}</td>
                          <td className="py-2 text-right">{u.endpoints_used}</td>
                          <td className="py-2 text-right">{u.active_days}</td>
                          <td className="py-2 text-xs text-muted-foreground max-w-[200px] truncate">{u.user_agent || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}

        {/* Raw Log Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" />Request Log</CardTitle>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Input placeholder="Filter by path..." className="w-48 h-8 text-xs" value={logFilter.path}
                onChange={(e) => { setLogFilter({ ...logFilter, path: e.target.value }); setLogPage(0); }} />
              <Input placeholder="Filter by IP..." className="w-36 h-8 text-xs" value={logFilter.ip}
                onChange={(e) => { setLogFilter({ ...logFilter, ip: e.target.value }); setLogPage(0); }} />
              <Select value={logFilter.minStatus || "0"} onValueChange={(v) => { setLogFilter({ ...logFilter, minStatus: v === "0" ? "" : v }); setLogPage(0); }}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All statuses</SelectItem>
                  <SelectItem value="400">4xx+ errors</SelectItem>
                  <SelectItem value="500">5xx errors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">Time</th><th className="pb-2">Method</th><th className="pb-2">Path</th>
                  <th className="pb-2">Status</th><th className="pb-2">Duration</th><th className="pb-2">IP</th><th className="pb-2">Country</th>
                </tr></thead>
                <tbody>
                  {logData?.entries?.map((e: any) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-1.5 whitespace-nowrap">{new Date(e.ts).toLocaleString()}</td>
                      <td className="py-1.5"><Badge variant="outline" className="text-xs">{e.method}</Badge></td>
                      <td className="py-1.5 font-mono max-w-[300px] truncate">{e.path}</td>
                      <td className="py-1.5">
                        <Badge variant={e.status_code >= 500 ? "destructive" : e.status_code >= 400 ? "secondary" : "outline"} className="text-xs">{e.status_code}</Badge>
                      </td>
                      <td className="py-1.5 text-right">{e.duration_ms}ms</td>
                      <td className="py-1.5 font-mono">{e.ip}</td>
                      <td className="py-1.5">{e.country || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {logData && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-muted-foreground">{logData.total?.toLocaleString()} total entries</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={logPage === 0} onClick={() => setLogPage(logPage - 1)}>Prev</Button>
                  <span className="text-sm text-muted-foreground py-1">Page {logPage + 1}</span>
                  <Button variant="outline" size="sm" disabled={(logPage + 1) * 50 >= logData.total} onClick={() => setLogPage(logPage + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
