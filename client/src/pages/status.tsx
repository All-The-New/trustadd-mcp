import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { STATUS } from "@/lib/content-zones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChainBadge } from "@/components/chain-badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, Clock, Blocks,
  Users, TrendingUp, RefreshCw, Lock,
} from "lucide-react";

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

/** Letter grade from health status — soft, trust-building language. */
function getGrade(status: string, runningCount: number, totalChains: number) {
  if (status === "healthy" && runningCount === totalChains) {
    return { letter: "A", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 border-green-500/30", label: "All Systems Operational" };
  }
  if (status === "healthy") {
    return { letter: "A-", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 border-green-500/30", label: "Systems Operational" };
  }
  if (status === "degraded") {
    return { letter: "B", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", label: "Minor Delays Possible" };
  }
  return { letter: "C", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", label: "Experiencing Slowdowns" };
}

export default function StatusPage() {
  const overviewQuery = useQuery({
    queryKey: ["/api/status/overview"],
    refetchInterval: 30000,
  });

  const summaryQuery = useQuery({
    queryKey: ["/api/status/summary"],
    refetchInterval: 60000,
  });

  const alertsQuery = useQuery({
    queryKey: ["/api/status/alerts"],
    refetchInterval: 30000,
  });

  const overviewData = overviewQuery.data as any;
  const summaryData = summaryQuery.data as any;
  const alertsData = alertsQuery.data as any;

  const chains = overviewData?.chains ?? [];
  const runningCount = chains.filter((c: any) => {
    const minutesStale = c.updatedAt ? (Date.now() - new Date(c.updatedAt).getTime()) / 60_000 : Infinity;
    return minutesStale < 10;
  }).length;

  const totalAgents = summaryData?.discoveryStats?.totalAgents ?? 0;
  const agentsToday = summaryData?.discoveryStats?.agentsToday ?? 0;

  // Only show critical/warning alerts publicly, soften the language
  const importantAlerts = (alertsData?.alerts ?? []).filter(
    (a: any) => a.severity === "critical" || a.severity === "warning"
  );

  const allUpdatedAts = chains.map((c: any) => new Date(c.updatedAt).getTime()).filter(Boolean);
  const mostRecent = allUpdatedAts.length > 0 ? new Date(Math.max(...allUpdatedAts)) : null;

  return (
    <Layout>
      <SEO title={STATUS.seo.title} description={STATUS.seo.description} path="/status" />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-status-title">
              <Activity className="w-6 h-6 text-primary" />
              System Status
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Multi-chain indexer health and coverage
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
            Auto-refreshes
          </div>
        </div>

        {/* Grade Banner */}
        {overviewQuery.isLoading ? (
          <Skeleton className="h-24" />
        ) : overviewData ? (() => {
          const grade = getGrade(overviewData.status, runningCount, chains.length);
          return (
            <div className={`rounded-xl border p-6 flex items-center gap-6 ${grade.bg}`} data-testid="status-health-banner">
              <div className={`text-5xl font-black ${grade.color}`}>{grade.letter}</div>
              <div className="flex-1">
                <p className={`text-lg font-semibold ${grade.color}`} data-testid="text-health-status">{grade.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {runningCount} of {chains.length} chains active
                  {mostRecent && <> &middot; Last update {timeAgo(mostRecent.toISOString())}</>}
                </p>
              </div>
            </div>
          );
        })() : null}

        {/* Summary Stats */}
        {(summaryQuery.isLoading) ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : summaryData ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs">Total Agents</span>
              </div>
              <p className="text-xl font-bold">{fmtNumber(totalAgents)}</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Discovered Today</span>
              </div>
              <p className="text-xl font-bold text-primary">+{fmtNumber(agentsToday)}</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-xs">Chains Monitored</span>
              </div>
              <p className="text-xl font-bold">{chains.length}</p>
            </div>
          </div>
        ) : null}

        {/* Chain Status Cards */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Chain Coverage</h2>
          {overviewQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : chains.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {chains.map((chain: any) => {
                const minutesSince = chain.updatedAt ? (Date.now() - new Date(chain.updatedAt).getTime()) / 60_000 : Infinity;
                const isActive = minutesSince < 10;
                const hasError = !!chain.lastError;
                return (
                  <Card key={chain.chainId}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            isActive ? (hasError ? "bg-amber-500" : "bg-green-500") : "bg-red-500"
                          } animate-pulse`} />
                          <ChainBadge chainId={chain.chainId} size="md" />
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {isActive ? (hasError ? "Recovering" : "Operational") : "Syncing"}
                        </Badge>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1"><Blocks className="w-3.5 h-3.5" /> Last Block</span>
                          <span className="font-mono">{chain.lastBlock?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Updated</span>
                          <span>{timeAgo(chain.updatedAt)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">No chain data available</p>
          )}
        </section>

        {/* Important Alerts — soft language */}
        {importantAlerts.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Notices</h2>
            <div className="space-y-3">
              {importantAlerts.map((alert: any, i: number) => {
                const isCritical = alert.severity === "critical";
                return (
                  <div key={i} className={`rounded-lg border p-4 flex items-start gap-3 ${
                    isCritical ? "border-amber-500/30 bg-amber-500/5" : "border-blue-500/30 bg-blue-500/5"
                  }`}>
                    {isCritical
                      ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
                    <div>
                      <span className={`font-medium text-sm ${isCritical ? "text-amber-600" : "text-blue-600"}`}>{alert.title}</span>
                      <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* No alerts */}
        {!alertsQuery.isLoading && importantAlerts.length === 0 && overviewData?.status === "healthy" && (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active notices. All systems running normally.</p>
            </CardContent>
          </Card>
        )}

        {/* Admin link */}
        <div className="text-center pt-4">
          <Link href="/admin/login">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
              <Lock className="w-3 h-3" />
              Detailed metrics in Admin
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
