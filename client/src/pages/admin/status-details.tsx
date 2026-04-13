import { AdminLayout } from "@/components/admin-layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChainBadge } from "@/components/chain-badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, Clock,
  Info, Zap, Database,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { useState } from "react";
import { CHAIN_COLORS, CHAIN_NAMES } from "@shared/chains";

const ERROR_EVENT_TYPES = ["error", "timeout", "connection_error", "rate_limit", "backoff"];

function timeAgo(dateStr: string | Date | null): string {
  if (!dateStr) return "never";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n?.toLocaleString() ?? "0";
}

const EVENT_TYPE_STYLES: Record<string, { color: string; label: string }> = {
  cycle_complete: { color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20", label: "Cycle OK" },
  error: { color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20", label: "Error" },
  recovery: { color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20", label: "Recovery" },
  rate_limit: { color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", label: "Rate Limit" },
  timeout: { color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20", label: "Timeout" },
  backoff: { color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20", label: "Backoff" },
  connection_error: { color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20", label: "Connection" },
};

export default function AdminStatusDetails() {
  const [eventLimit, setEventLimit] = useState("100");

  const { data: overview, isLoading: loadingOverview } = useQuery<any>({
    queryKey: ["/api/status/overview"],
    staleTime: 15_000,
    retry: false,
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/status/summary"],
    staleTime: 30_000,
    retry: false,
  });

  const { data: metrics } = useQuery<any>({
    queryKey: ["/api/status/metrics"],
    staleTime: 30_000,
    retry: false,
  });

  const { data: events } = useQuery<any>({
    queryKey: ["admin-status-events", eventLimit],
    queryFn: async () => {
      const res = await fetch(`/api/status/events?limit=${eventLimit}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 15_000,
    retry: false,
  });

  const { data: alerts } = useQuery<any>({
    queryKey: ["/api/status/alerts"],
    staleTime: 15_000,
    retry: false,
  });

  const { data: tasks } = useQuery<any>({
    queryKey: ["/api/status/tasks"],
    staleTime: 30_000,
    retry: false,
  });

  const chains = overview?.chains ?? [];

  // Ops KPIs
  const runningCount = chains.filter((c: any) => {
    const minutesStale = c.updatedAt ? (Date.now() - new Date(c.updatedAt).getTime()) / 60_000 : Infinity;
    return minutesStale < 10;
  }).length;

  const allEvents24h = summary?.eventCounts24h ?? [];
  const totalCycles = allEvents24h.filter((e: any) => e.eventType === "cycle_complete").reduce((s: number, e: any) => s + e.count, 0);
  const totalFailed = allEvents24h.filter((e: any) => ERROR_EVENT_TYPES.includes(e.eventType)).reduce((s: number, e: any) => s + e.count, 0);
  const errorRate = (totalCycles + totalFailed) > 0 ? Math.round((totalFailed / (totalCycles + totalFailed)) * 100) : 0;

  // Metrics charts data
  const metricsData = metrics?.metrics ?? [];
  const chainIds = [...new Set(metricsData.map((m: any) => m.chainId))] as number[];

  const blocksData = metricsData.reduce((acc: any[], m: any) => {
    const timeKey = new Date(m.periodStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let entry = acc.find((e: any) => e.time === timeKey);
    if (!entry) { entry = { time: timeKey }; acc.push(entry); }
    entry[`chain_${m.chainId}`] = m.blocksIndexed;
    return acc;
  }, []);

  const errorData = metricsData.reduce((acc: any[], m: any) => {
    const timeKey = new Date(m.periodStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let entry = acc.find((e: any) => e.time === timeKey);
    if (!entry) { entry = { time: timeKey }; acc.push(entry); }
    const total = (m.cyclesCompleted || 0) + (m.cyclesFailed || 0);
    entry[`rate_${m.chainId}`] = total > 0 ? Math.round((m.cyclesFailed / total) * 100) : 0;
    return acc;
  }, []);

  // Per-chain 24h strip
  const perChainTotals = chainIds.map((cid) => {
    const rows = metricsData.filter((m: any) => m.chainId === cid);
    const blocks = rows.reduce((s: number, m: any) => s + (m.blocksIndexed ?? 0), 0);
    const ok = rows.reduce((s: number, m: any) => s + (m.cyclesCompleted ?? 0), 0);
    const fail = rows.reduce((s: number, m: any) => s + (m.cyclesFailed ?? 0), 0);
    const agents = rows.reduce((s: number, m: any) => s + (m.agentsDiscovered ?? 0), 0);
    const rpcReqs = rows.reduce((s: number, m: any) => s + (m.rpcRequests ?? 0), 0);
    const rpcErrs = rows.reduce((s: number, m: any) => s + (m.rpcErrors ?? 0), 0);
    const total = ok + fail;
    const errPct = total > 0 ? Math.round((fail / total) * 100) : 0;
    return { chainId: cid, blocks, ok, fail, errPct, agents, rpcReqs, rpcErrs };
  });

  return (
    <AdminLayout>
      <SEO title="Status Details" description="Detailed system status" />
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Status Details</h1>

        {loadingOverview ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <>
            {/* Health Banner */}
            {overview && (
              <div className={`rounded-lg border p-4 flex items-center justify-between ${
                overview.status === "healthy" ? "bg-green-500/10 border-green-500/30" :
                overview.status === "degraded" ? "bg-amber-500/10 border-amber-500/30" :
                "bg-red-500/10 border-red-500/30"
              }`}>
                <div className="flex items-center gap-3">
                  {overview.status === "healthy" ? <CheckCircle2 className="w-6 h-6 text-green-600" /> :
                   overview.status === "degraded" ? <AlertTriangle className="w-6 h-6 text-amber-600" /> :
                   <XCircle className="w-6 h-6 text-red-600" />}
                  <div>
                    <p className="font-semibold">{overview.status === "healthy" ? "All Systems Operational" : overview.status === "degraded" ? "Degraded Performance" : "System Issues"}</p>
                    <p className="text-sm text-muted-foreground">{runningCount}/{chains.length} chains active</p>
                  </div>
                </div>
              </div>
            )}

            {/* KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Chains Active</p>
                <p className="text-sm font-bold">{runningCount} / {chains.length}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Total Agents</p>
                <p className="text-sm font-bold">{fmtNumber(summary?.discoveryStats?.totalAgents ?? 0)}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Discovered Today</p>
                <p className="text-sm font-bold text-primary">+{fmtNumber(summary?.discoveryStats?.agentsToday ?? 0)}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Cycles (24h)</p>
                <p className="text-sm font-bold">{totalCycles} ok / {totalFailed} fail</p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Error Rate (24h)</p>
                <p className={`text-sm font-bold ${errorRate > 10 ? "text-red-600" : errorRate > 5 ? "text-amber-600" : "text-green-600"}`}>{errorRate}%</p>
              </div>
            </div>

            {/* Chain Status Cards (live status + 24h metrics combined) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {chains.map((chain: any) => {
                const minutesSinceUpdate = chain.updatedAt ? (Date.now() - new Date(chain.updatedAt).getTime()) / 60_000 : Infinity;
                const isActive = minutesSinceUpdate < 10;
                const m = perChainTotals.find((c) => c.chainId === chain.chainId);
                return (
                  <Card key={chain.chainId}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${isActive ? (chain.lastError ? "bg-amber-500" : "bg-green-500") : "bg-red-500"} animate-pulse`} />
                          <ChainBadge chainId={chain.chainId} size="md" />
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {isActive ? (chain.lastError ? "Degraded" : "Active") : "Stale"}
                        </Badge>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Block</span>
                          <span className="font-mono">{chain.lastBlock?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cycles (1h)</span>
                          <span>
                            <span className="text-green-600">{chain.cyclesCompleted} ok</span>
                            {chain.cyclesFailed > 0 && <span className="text-red-600 ml-1">/ {chain.cyclesFailed} fail</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Updated</span>
                          <span>{timeAgo(chain.updatedAt)}</span>
                        </div>
                        {m && (
                          <>
                            <div className="border-t my-2" />
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">24h Metrics</p>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Blocks indexed</span>
                              <span className="font-medium">{fmtNumber(m.blocks)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Agents found</span>
                              <span className="font-medium">{m.agents}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">RPC calls</span>
                              <span className="font-medium">{fmtNumber(m.rpcReqs)}{m.rpcErrs > 0 && <span className="text-amber-600"> / {m.rpcErrs} err</span>}</span>
                            </div>
                          </>
                        )}
                        {chain.lastError && (
                          <div className="mt-2 p-2 rounded bg-red-500/5 border border-red-500/20">
                            <p className="text-xs text-red-600 break-words line-clamp-2">{chain.lastError}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Blocks Indexed per Hour</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={blocksData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtNumber} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {chainIds.map(id => (
                          <Area key={id} type="monotone" dataKey={`chain_${id}`} name={CHAIN_NAMES[id] ?? `Chain ${id}`}
                            stackId="1" fill={CHAIN_COLORS[id] || "#6b7280"} stroke={CHAIN_COLORS[id] || "#6b7280"} fillOpacity={0.4} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Error Rate Over Time (%)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={errorData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip formatter={(v: any) => `${v}%`} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {chainIds.map(id => (
                          <Line key={id} type="monotone" dataKey={`rate_${id}`} name={CHAIN_NAMES[id] ?? `Chain ${id}`}
                            stroke={CHAIN_COLORS[id] || "#6b7280"} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Error Breakdown Table */}
            {allEvents24h.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Event Breakdown (24h)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2">Chain</th>
                          <th className="text-right px-3 py-2 text-green-700">OK</th>
                          <th className="text-right px-3 py-2 text-red-700">Errors</th>
                          <th className="text-right px-3 py-2 text-orange-700">Timeouts</th>
                          <th className="text-right px-3 py-2 text-red-700">Conn.</th>
                          <th className="text-right px-3 py-2 text-amber-700">Rate Limit</th>
                          <th className="text-right px-3 py-2 text-purple-700">Backoff</th>
                          <th className="text-right px-3 py-2 text-blue-700">Recovery</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...new Set(allEvents24h.map((e: any) => e.chainId))].sort().map((chainId: any) => {
                          const getCount = (type: string) => allEvents24h.find((e: any) => e.chainId === chainId && e.eventType === type)?.count ?? 0;
                          return (
                            <tr key={chainId} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-4 py-2"><ChainBadge chainId={chainId} size="sm" /></td>
                              <td className="px-3 py-2 text-right text-green-700 font-medium">{getCount("cycle_complete")}</td>
                              <td className="px-3 py-2 text-right">{getCount("error") || "-"}</td>
                              <td className="px-3 py-2 text-right">{getCount("timeout") || "-"}</td>
                              <td className="px-3 py-2 text-right">{getCount("connection_error") || "-"}</td>
                              <td className="px-3 py-2 text-right">{getCount("rate_limit") || "-"}</td>
                              <td className="px-3 py-2 text-right">{getCount("backoff") || "-"}</td>
                              <td className="px-3 py-2 text-right">{getCount("recovery") || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Alerts */}
            {alerts?.alerts?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Active Alerts ({alerts.alerts.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {alerts.alerts.map((alert: any, i: number) => (
                      <div key={i} className={`rounded-lg border p-3 flex items-start gap-3 ${
                        alert.severity === "critical" ? "border-red-500/30 bg-red-500/5" :
                        alert.severity === "warning" ? "border-amber-500/30 bg-amber-500/5" :
                        "border-blue-500/30 bg-blue-500/5"
                      }`}>
                        {alert.severity === "critical" ? <XCircle className="w-5 h-5 text-red-600 shrink-0" /> :
                         alert.severity === "warning" ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" /> :
                         <Info className="w-5 h-5 text-blue-600 shrink-0" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{alert.title}</span>
                            {alert.chainId && <ChainBadge chainId={alert.chainId} size="sm" />}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Event Log */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" />Event Log</CardTitle>
                  <Select value={eventLimit} onValueChange={setEventLimit}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 events</SelectItem>
                      <SelectItem value="100">100 events</SelectItem>
                      <SelectItem value="200">200 events</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {events?.events?.map((event: any, i: number) => {
                    const style = EVENT_TYPE_STYLES[event.eventType] || { color: "bg-gray-500/10 text-gray-600 border-gray-500/20", label: event.eventType };
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                        <span className="text-muted-foreground w-20 shrink-0">{timeAgo(event.createdAt)}</span>
                        <ChainBadge chainId={event.chainId} size="sm" />
                        <Badge variant="outline" className={`text-xs ${style.color}`}>{style.label}</Badge>
                        <span className="text-muted-foreground truncate flex-1">{event.message}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
