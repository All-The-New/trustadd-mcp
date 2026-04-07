import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { STATUS } from "@/lib/content-zones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChainBadge } from "@/components/chain-badge";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle,
  Clock, Blocks, RefreshCw, Info, AlertCircle,
  Cpu, Zap, Database, TrendingUp, Users, Server,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { useState } from "react";

import { CHAIN_COLORS, CHAIN_NAMES } from "@shared/chains";

const ERROR_EVENT_TYPES = ["error", "timeout", "connection_error", "rate_limit", "backoff"];

const EVENT_TYPE_STYLES: Record<string, { color: string; label: string }> = {
  cycle_complete: { color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20", label: "Cycle OK" },
  error: { color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20", label: "Error" },
  recovery: { color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20", label: "Recovery" },
  rate_limit: { color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", label: "Rate Limit" },
  timeout: { color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20", label: "Timeout" },
  backoff: { color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20", label: "Backoff" },
  connection_error: { color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20", label: "Connection" },
  spam_skip: { color: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20", label: "Spam Skip" },
};

function timeAgo(dateStr: string | Date | null): string {
  if (!dateStr) return "never";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function HealthBanner({ data }: { data: any }) {
  const statusConfig = {
    healthy: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 border-green-500/30", label: "All Systems Operational" },
    degraded: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", label: "Degraded Performance" },
    unhealthy: { icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "System Issues Detected" },
  };

  const config = statusConfig[data.status as keyof typeof statusConfig] || statusConfig.unhealthy;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border p-4 flex items-center justify-between ${config.bg}`} data-testid="status-health-banner">
      <div className="flex items-center gap-3">
        <Icon className={`w-6 h-6 ${config.color}`} />
        <div>
          <p className={`font-semibold ${config.color}`} data-testid="text-health-status">{config.label}</p>
          <p className="text-sm text-muted-foreground">
            {data.chains?.filter((c: any) => c.status !== "down").length}/{data.chains?.length} chains active
          </p>
        </div>
      </div>
      <Badge variant="outline" className={config.color}>
        {data.status?.toUpperCase()}
      </Badge>
    </div>
  );
}

function AlertCard({ alert }: { alert: any }) {
  const severityConfig = {
    critical: { icon: XCircle, color: "text-red-600 dark:text-red-400", border: "border-red-500/30 bg-red-500/5" },
    warning: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30 bg-amber-500/5" },
    info: { icon: Info, color: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30 bg-blue-500/5" },
  };

  const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border p-3 flex items-start gap-3 ${config.border}`} data-testid={`alert-${alert.id}`}>
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${config.color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-sm ${config.color}`}>{alert.title}</span>
          {alert.chainId && <ChainBadge chainId={alert.chainId} size="sm" />}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 break-words">{alert.message}</p>
      </div>
    </div>
  );
}

function ChainStatusCard({ chain }: { chain: any }) {
  const minutesSinceUpdate = chain.updatedAt
    ? (Date.now() - new Date(chain.updatedAt).getTime()) / 60_000
    : Infinity;
  const isActive = minutesSinceUpdate < 10;
  const hasError = !!chain.lastError;

  return (
    <Card data-testid={`card-chain-status-${chain.chainId}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isActive ? (hasError ? "bg-amber-500" : "bg-green-500") : "bg-red-500"} animate-pulse`} />
            <ChainBadge chainId={chain.chainId} size="md" />
          </div>
          <Badge variant="outline" className="text-xs">
            {isActive ? (hasError ? "Degraded" : "Active") : "Stale"}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1"><Blocks className="w-3.5 h-3.5" /> Last Block</span>
            <span className="font-mono" data-testid={`text-last-block-${chain.chainId}`}>{chain.lastBlock?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Cycles (1h)</span>
            <span>
              <span className="text-green-600 dark:text-green-400">{chain.cyclesCompleted} ok</span>
              {chain.cyclesFailed > 0 && <span className="text-red-600 dark:text-red-400 ml-1">/ {chain.cyclesFailed} fail</span>}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Updated</span>
            <span>{timeAgo(chain.updatedAt)}</span>
          </div>
          {hasError && (
            <div className="mt-2 p-2 rounded bg-red-500/5 border border-red-500/20">
              <p className="text-xs text-red-600 dark:text-red-400 break-words line-clamp-2">{chain.lastError}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OpsKpiStrip({ summary, overviewData }: { summary: any; overviewData: any }) {
  const chains = overviewData?.chains ?? [];
  const runningCount = chains.filter((c: any) => {
    const minutesStale = c.updatedAt ? (Date.now() - new Date(c.updatedAt).getTime()) / 60_000 : Infinity;
    return minutesStale < 10;
  }).length;
  const totalCount = chains.length;

  const allUpdatedAts = chains.map((c: any) => new Date(c.updatedAt).getTime()).filter(Boolean);
  const mostRecentUpdate = allUpdatedAts.length > 0 ? new Date(Math.max(...allUpdatedAts)) : null;

  const totalAgents = summary?.discoveryStats?.totalAgents ?? 0;
  const agentsToday = summary?.discoveryStats?.agentsToday ?? 0;

  const allEvents = summary?.eventCounts24h ?? [];
  const totalEvents1h = 0;
  const totalCycles24h = allEvents.filter((e: any) => e.eventType === "cycle_complete").reduce((s: number, e: any) => s + e.count, 0);
  const totalFailed24h = allEvents.filter((e: any) => ERROR_EVENT_TYPES.includes(e.eventType)).reduce((s: number, e: any) => s + e.count, 0);
  const errorRate24h = (totalCycles24h + totalFailed24h) > 0
    ? Math.round((totalFailed24h / (totalCycles24h + totalFailed24h)) * 100)
    : 0;

  const chips = [
    {
      label: "Chains active",
      value: `${runningCount} / ${totalCount}`,
      icon: Activity,
      color: runningCount === totalCount ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Total agents",
      value: fmtNumber(totalAgents),
      icon: Users,
      color: "text-foreground",
    },
    {
      label: "Discovered today",
      value: `+${fmtNumber(agentsToday)}`,
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      label: "Indexer last update",
      value: mostRecentUpdate ? timeAgo(mostRecentUpdate.toISOString()) : "—",
      icon: Clock,
      color: "text-foreground",
    },
    {
      label: "Error rate (24h)",
      value: `${errorRate24h}%`,
      icon: Cpu,
      color: errorRate24h > 10 ? "text-red-600 dark:text-red-400" : errorRate24h > 5 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="ops-kpi-strip">
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <div key={chip.label} className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3">
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium truncate">{chip.label}</p>
              <p className={`text-sm font-bold ${chip.color}`}>{chip.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PerChain24hStrip({ metrics }: { metrics: any[] }) {
  if (!metrics || metrics.length === 0) return null;

  const chainIds = [...new Set(metrics.map((m: any) => m.chainId))];

  const chainTotals = chainIds.map((cid) => {
    const rows = metrics.filter((m: any) => m.chainId === cid);
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4" data-testid="per-chain-24h-strip">
      {chainTotals.map((c) => (
        <Card key={c.chainId} className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <ChainBadge chainId={c.chainId} size="sm" />
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Blocks indexed</span>
                <span className="font-medium tabular-nums">{fmtNumber(c.blocks)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cycles ok / fail</span>
                <span className="font-medium tabular-nums">
                  <span className="text-green-600 dark:text-green-400">{c.ok}</span>
                  {c.fail > 0 && <span className="text-red-600 dark:text-red-400"> / {c.fail}</span>}
                  {c.errPct > 0 && <span className={`ml-1 ${c.errPct > 10 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>({c.errPct}%)</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agents found</span>
                <span className="font-medium tabular-nums">{c.agents}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RPC calls / err</span>
                <span className="font-medium tabular-nums">
                  {fmtNumber(c.rpcReqs)}
                  {c.rpcErrs > 0 && <span className="text-amber-600 dark:text-amber-400"> / {c.rpcErrs}</span>}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MetricsCharts({ metrics }: { metrics: any[] }) {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="col-span-2 text-center text-muted-foreground py-12">
        No metrics data yet. Metrics are collected hourly.
      </div>
    );
  }

  const chainIds = [...new Set(metrics.map((m: any) => m.chainId))];

  const blocksData = metrics.reduce((acc: any[], m: any) => {
    const timeKey = new Date(m.periodStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let entry = acc.find(e => e.time === timeKey);
    if (!entry) {
      entry = { time: timeKey };
      acc.push(entry);
    }
    entry[`chain_${m.chainId}`] = m.blocksIndexed;
    return acc;
  }, []);

  const errorData = metrics.reduce((acc: any[], m: any) => {
    const timeKey = new Date(m.periodStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let entry = acc.find(e => e.time === timeKey);
    if (!entry) {
      entry = { time: timeKey };
      acc.push(entry);
    }
    const total = (m.cyclesCompleted || 0) + (m.cyclesFailed || 0);
    entry[`rate_${m.chainId}`] = total > 0 ? Math.round((m.cyclesFailed / total) * 100) : 0;
    return acc;
  }, []);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Blocks Indexed per Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={blocksData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={fmtNumber} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => fmtNumber(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {chainIds.map(id => (
                  <Area
                    key={id}
                    type="monotone"
                    dataKey={`chain_${id}`}
                    name={CHAIN_NAMES[id as number] ?? `Chain ${id}`}
                    stackId="1"
                    fill={CHAIN_COLORS[id as number] || "#6b7280"}
                    stroke={CHAIN_COLORS[id as number] || "#6b7280"}
                    fillOpacity={0.4}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Error Rate Over Time (%)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} className="text-muted-foreground" />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {chainIds.map(id => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={`rate_${id}`}
                    name={CHAIN_NAMES[id as number] ?? `Chain ${id}`}
                    stroke={CHAIN_COLORS[id as number] || "#6b7280"}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ErrorBreakdownTable({ eventCounts24h }: { eventCounts24h: Array<{ chainId: number; eventType: string; count: number }> }) {
  if (!eventCounts24h || eventCounts24h.length === 0) return null;

  const chainIds = [...new Set(eventCounts24h.map(e => e.chainId))].sort();
  const errorTypes = ["cycle_complete", "error", "timeout", "connection_error", "rate_limit", "backoff", "recovery"];

  const getCount = (chainId: number, eventType: string) =>
    eventCounts24h.find(e => e.chainId === chainId && e.eventType === eventType)?.count ?? 0;

  return (
    <Card className="mt-4" data-testid="table-error-breakdown">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Event breakdown (24h)</CardTitle>
        <p className="text-xs text-muted-foreground">Cycle outcomes per chain — reveals whether errors are RPC timeouts, rate limits, or connection drops</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Chain</th>
                <th className="text-right px-3 py-2 font-medium text-green-700 dark:text-green-400">Cycles OK</th>
                <th className="text-right px-3 py-2 font-medium text-red-700 dark:text-red-400">Errors</th>
                <th className="text-right px-3 py-2 font-medium text-orange-700 dark:text-orange-400">Timeouts</th>
                <th className="text-right px-3 py-2 font-medium text-red-700 dark:text-red-400">Conn. Errors</th>
                <th className="text-right px-3 py-2 font-medium text-amber-700 dark:text-amber-400">Rate Limits</th>
                <th className="text-right px-3 py-2 font-medium text-purple-700 dark:text-purple-400">Backoffs</th>
                <th className="text-right px-3 py-2 font-medium text-blue-700 dark:text-blue-400">Recoveries</th>
              </tr>
            </thead>
            <tbody>
              {chainIds.map(chainId => {
                const ok = getCount(chainId, "cycle_complete");
                const err = getCount(chainId, "error");
                const timeout = getCount(chainId, "timeout");
                const connErr = getCount(chainId, "connection_error");
                const rl = getCount(chainId, "rate_limit");
                const backoff = getCount(chainId, "backoff");
                const recovery = getCount(chainId, "recovery");
                const totalFail = err + timeout + connErr + rl;
                const total = ok + totalFail;
                const errPct = total > 0 ? Math.round((totalFail / total) * 100) : 0;
                return (
                  <tr key={chainId} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-events-${chainId}`}>
                    <td className="px-4 py-2"><ChainBadge chainId={chainId} size="sm" /></td>
                    <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400 font-medium">{ok}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={err > 0 ? "text-red-700 dark:text-red-400 font-medium" : "text-muted-foreground"}>{err}</span>
                      {errPct > 0 && <span className="text-muted-foreground ml-1">({errPct}%)</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums"><span className={timeout > 0 ? "text-orange-700 dark:text-orange-400 font-medium" : "text-muted-foreground"}>{timeout}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums"><span className={connErr > 0 ? "text-red-700 dark:text-red-400 font-medium" : "text-muted-foreground"}>{connErr}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums"><span className={rl > 0 ? "text-amber-700 dark:text-amber-400 font-medium" : "text-muted-foreground"}>{rl}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums"><span className={backoff > 0 ? "text-purple-700 dark:text-purple-400 font-medium" : "text-muted-foreground"}>{backoff}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums"><span className={recovery > 0 ? "text-blue-700 dark:text-blue-400 font-medium" : "text-muted-foreground"}>{recovery}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DownstreamSystemsPanel({ summary }: { summary: any }) {
  const prober = summary?.proberStats;
  const tx = summary?.txSyncStats;

  const proberAge = prober?.lastProbeAt ? (Date.now() - new Date(prober.lastProbeAt).getTime()) / (1000 * 60 * 60) : null;
  const proberStale = proberAge !== null && proberAge > 25;
  const found402Pct = prober?.totalProbed > 0 ? Math.round((prober.found402 / prober.totalProbed) * 100) : 0;

  const txAge = tx?.lastSyncedAt ? (Date.now() - new Date(tx.lastSyncedAt).getTime()) / (1000 * 60 * 60) : null;
  const txWarn = txAge !== null && txAge > 8;
  const txCrit = txAge !== null && txAge > 13;

  return (
    <section data-testid="section-downstream-systems">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Zap className="w-5 h-5 text-muted-foreground" />
        Downstream Systems
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card data-testid="card-x402-prober">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${proberStale ? "bg-amber-500" : "bg-green-500"}`} />
              x402 Prober
            </CardTitle>
            <p className="text-xs text-muted-foreground">Scans agent HTTP endpoints for payment capability</p>
          </CardHeader>
          <CardContent>
            {!prober ? (
              <p className="text-xs text-muted-foreground">No probe data yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Last run</p>
                  <p className={`font-medium ${proberStale ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    {prober.lastProbeAt ? timeAgo(prober.lastProbeAt) : "never"}
                    {proberStale && <span className="ml-1 text-xs">(stale)</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Agents probed</p>
                  <p className="font-medium">{prober.totalProbed.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">x402 capable</p>
                  <p className="font-medium">
                    {prober.found402.toLocaleString()}
                    <span className="text-xs text-muted-foreground ml-1">({found402Pct}%)</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment addresses</p>
                  <p className="font-medium">{prober.uniquePaymentAddresses.toLocaleString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-tx-indexer">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${txCrit ? "bg-red-500" : txWarn ? "bg-amber-500" : "bg-green-500"}`} />
              Transaction Indexer
            </CardTitle>
            <p className="text-xs text-muted-foreground">Tracks on-chain payments to agent addresses</p>
          </CardHeader>
          <CardContent>
            {!tx ? (
              <p className="text-xs text-muted-foreground">No sync data yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Last sync</p>
                  <p className={`font-medium ${txCrit ? "text-red-600 dark:text-red-400" : txWarn ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    {tx.lastSyncedAt ? timeAgo(tx.lastSyncedAt) : "never"}
                    {txCrit && <span className="ml-1 text-xs">(offline)</span>}
                    {!txCrit && txWarn && <span className="ml-1 text-xs">(delayed)</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Addresses tracked</p>
                  <p className="font-medium">{tx.addressCount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Synced (12h)</p>
                  <p className={`font-medium ${tx.syncedCount < tx.addressCount ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    {tx.syncedCount}
                    <span className="text-xs text-muted-foreground ml-1">/ {tx.addressCount}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cycle interval</p>
                  <p className="font-medium text-muted-foreground">6h</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

const TASK_DISPLAY_NAMES: Record<string, { name: string; schedule: string }> = {
  "blockchain-indexer": { name: "Blockchain Indexer", schedule: "Every 2 min" },
  "chain-indexer": { name: "Chain Indexer (sub-task)", schedule: "On demand" },
  "watchdog": { name: "Watchdog", schedule: "Every 15 min" },
  "recalculate-scores": { name: "Trust Score Recalc", schedule: "Daily 5 AM UTC" },
  "transaction-indexer": { name: "Transaction Indexer", schedule: "Every 6 hours" },
  "community-feedback": { name: "Community Feedback", schedule: "Daily 4 AM UTC" },
  "x402-prober": { name: "x402 Prober", schedule: "Daily 3 AM UTC" },
};

function BackgroundTasksPanel({ tasks }: { tasks: any[] | null }) {
  if (!tasks || tasks.length === 0) {
    return (
      <section data-testid="section-background-tasks">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Server className="w-5 h-5 text-muted-foreground" />
          Background Tasks
        </h2>
        <p className="text-sm text-muted-foreground">No task data available. Requires TRIGGER_SECRET_KEY.</p>
      </section>
    );
  }

  return (
    <section data-testid="section-background-tasks">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Server className="w-5 h-5 text-muted-foreground" />
        Background Tasks ({tasks.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((task: any) => {
          const display = TASK_DISPLAY_NAMES[task.taskId] || { name: task.taskId, schedule: "Unknown" };
          const isSuccess = task.lastStatus === "COMPLETED";
          const isFailed = task.lastStatus === "FAILED" || task.lastStatus === "CRASHED" || task.lastStatus === "SYSTEM_FAILURE";
          const isRunning = task.lastStatus === "EXECUTING" || task.lastStatus === "REATTEMPTING";
          const total = task.recentSuccesses + task.recentFailures;
          const failRate = total > 0 ? Math.round((task.recentFailures / total) * 100) : 0;

          return (
            <Card key={task.taskId} data-testid={`card-task-${task.taskId}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-blue-500 animate-pulse" : isSuccess ? "bg-green-500" : isFailed ? "bg-red-500" : "bg-gray-400"}`} />
                    <span className="font-medium text-sm">{display.name}</span>
                  </div>
                  <Badge variant="outline" className={`text-xs ${isSuccess ? "text-green-700 dark:text-green-400" : isFailed ? "text-red-700 dark:text-red-400" : isRunning ? "text-blue-700 dark:text-blue-400" : ""}`}>
                    {task.lastStatus}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Last run</span>
                    <span>{timeAgo(task.lastRunAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Schedule</span>
                    <span className="text-xs">{display.schedule}</span>
                  </div>
                  {task.lastDurationMs > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Duration</span>
                      <span className="font-mono text-xs">{(task.lastDurationMs / 1000).toFixed(1)}s</span>
                    </div>
                  )}
                  {task.lastCostCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> Cost</span>
                      <span className="font-mono text-xs">${(task.lastCostCents / 100).toFixed(3)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recent runs</span>
                    <span>
                      <span className="text-green-600 dark:text-green-400">{task.recentSuccesses} ok</span>
                      {task.recentFailures > 0 && (
                        <span className="text-red-600 dark:text-red-400 ml-1">/ {task.recentFailures} fail
                          <span className="text-muted-foreground ml-1">({failRate}%)</span>
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default function StatusPage() {
  const [eventChainFilter, setEventChainFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");

  const healthQuery = useQuery({
    queryKey: ["/api/health"],
    refetchInterval: 30000,
  });

  const overviewQuery = useQuery({
    queryKey: ["/api/status/overview"],
    refetchInterval: 30000,
  });

  const alertsQuery = useQuery({
    queryKey: ["/api/status/alerts"],
    refetchInterval: 30000,
  });

  const summaryQuery = useQuery({
    queryKey: ["/api/status/summary"],
    refetchInterval: 60000,
  });

  const eventsUrl = (() => {
    const params = new URLSearchParams();
    if (eventChainFilter !== "all") params.set("chainId", eventChainFilter);
    if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
    return `/api/status/events?${params}`;
  })();

  const eventsQuery = useQuery({
    queryKey: ["/api/status/events", eventChainFilter, eventTypeFilter],
    queryFn: async () => {
      const res = await fetch(eventsUrl);
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const metricsQuery = useQuery({
    queryKey: ["/api/status/metrics"],
    refetchInterval: 60000,
  });

  const tasksQuery = useQuery({
    queryKey: ["/api/status/tasks"],
    refetchInterval: 60000,
  });

  const healthData = healthQuery.data as any;
  const overviewData = overviewQuery.data as any;
  const alertsData = alertsQuery.data as any;
  const summaryData = summaryQuery.data as any;
  const eventsData = eventsQuery.data as any;
  const metricsData = metricsQuery.data as any;
  const tasksData = tasksQuery.data as any;

  return (
    <Layout>
      <SEO
        title={STATUS.seo.title}
        description={STATUS.seo.description}
        path="/status"
      />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-status-title">
              <Activity className="w-6 h-6 text-primary" />
              System Status
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Multi-chain indexer health, alerts, and performance telemetry
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
            Auto-refreshes every 30s
          </div>
        </div>

        {/* Ops KPI strip */}
        {(summaryQuery.isLoading || overviewQuery.isLoading) ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : summaryData && overviewData ? (
          <OpsKpiStrip summary={summaryData} overviewData={overviewData} />
        ) : null}

        <section>
          <h2 className="text-lg font-semibold mb-3">Chain Status</h2>
          {overviewQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : overviewData?.chains ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="container-chain-status">
              {overviewData.chains.map((chain: any) => (
                <ChainStatusCard key={chain.chainId} chain={chain} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No chain data available</p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Database className="w-5 h-5 text-muted-foreground" />
            Performance Metrics (24h)
          </h2>

          {metricsQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : metricsData?.metrics?.length > 0 ? (
            <PerChain24hStrip metrics={metricsData.metrics} />
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {metricsQuery.isLoading ? (
              <>
                <Skeleton className="h-[320px]" />
                <Skeleton className="h-[320px]" />
              </>
            ) : (
              <MetricsCharts metrics={metricsData?.metrics || []} />
            )}
          </div>

          {summaryData?.eventCounts24h?.length > 0 && (
            <ErrorBreakdownTable eventCounts24h={summaryData.eventCounts24h} />
          )}
        </section>

        {summaryData && (
          <DownstreamSystemsPanel summary={summaryData} />
        )}

        {tasksQuery.isLoading ? (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Server className="w-5 h-5 text-muted-foreground" />
              Background Tasks
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-44" />)}
            </div>
          </section>
        ) : tasksData?.tasks ? (
          <BackgroundTasksPanel tasks={tasksData.tasks} />
        ) : null}

        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Event Log</h2>
            <div className="flex gap-2">
              <Select value={eventChainFilter} onValueChange={setEventChainFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-event-chain">
                  <SelectValue placeholder="All Chains" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chains</SelectItem>
                  <SelectItem value="1">Ethereum</SelectItem>
                  <SelectItem value="8453">Base</SelectItem>
                  <SelectItem value="56">BNB Chain</SelectItem>
                  <SelectItem value="137">Polygon</SelectItem>
                  <SelectItem value="42161">Arbitrum</SelectItem>
                </SelectContent>
              </Select>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-event-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="cycle_complete">Cycle OK</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="recovery">Recovery</SelectItem>
                  <SelectItem value="rate_limit">Rate Limit</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                  <SelectItem value="backoff">Backoff</SelectItem>
                  <SelectItem value="connection_error">Connection</SelectItem>
                  <SelectItem value="spam_skip">Spam Skip</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-events">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Time</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Chain</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventsQuery.isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-3" colSpan={4}><Skeleton className="h-5" /></td>
                        </tr>
                      ))
                    ) : eventsData?.events?.length > 0 ? (
                      eventsData.events.map((event: any) => {
                        const style = EVENT_TYPE_STYLES[event.eventType] || EVENT_TYPE_STYLES.error;
                        return (
                          <tr key={event.id} className="border-b hover:bg-muted/30 transition-colors" data-testid={`row-event-${event.id}`}>
                            <td className="p-3 text-muted-foreground whitespace-nowrap text-xs">{timeAgo(event.createdAt)}</td>
                            <td className="p-3"><ChainBadge chainId={event.chainId} size="sm" /></td>
                            <td className="p-3">
                              <Badge variant="outline" className={`text-xs ${style.color}`}>{style.label}</Badge>
                            </td>
                            <td className="p-3 text-xs max-w-md truncate">{event.message}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          No events recorded yet. Events will appear as the indexer runs.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </Layout>
  );
}
