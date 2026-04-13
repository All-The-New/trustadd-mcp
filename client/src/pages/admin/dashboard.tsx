import { AdminLayout } from "@/components/admin-layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, BarChart3, AlertTriangle, Server,
  Users, Zap, Clock, CheckCircle2, XCircle,
} from "lucide-react";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
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

export default function AdminDashboard() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/dashboard"],
    staleTime: 30_000,
    retry: false,
  });

  return (
    <AdminLayout>
      <SEO title="Admin Dashboard" description="TrustAdd system overview" />
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">System Overview</h1>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : data ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={Users} label="Total Agents" value={data.stats?.totalAgents?.toLocaleString() ?? 0} />
              <KpiCard icon={Server} label="Active Chains"
                value={data.indexerStates?.filter((s: any) => s.is_running).length ?? 0}
                sub={`of ${data.indexerStates?.length ?? 0} configured`} />
              <KpiCard icon={BarChart3} label="API Requests (24h)"
                value={data.apiSummary?.total_24h?.toLocaleString() ?? 0}
                sub={`${data.apiSummary?.unique_ips_24h ?? 0} unique IPs`} />
              <KpiCard icon={AlertTriangle} label="Server Errors (24h)"
                value={data.apiSummary?.errors_24h ?? 0}
                sub={`avg ${data.apiSummary?.avg_ms_24h ?? 0}ms`} />
            </div>

            {/* Indexer States */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" />Chain Indexer Status</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.indexerStates?.map((s: any) => (
                    <div key={s.chain_id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        {s.is_running ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                        <span className="font-medium">Chain {s.chain_id}</span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span>Block {s.last_processed_block?.toLocaleString()}</span>
                        <span>{timeAgo(s.updated_at)}</span>
                        {s.last_error && <Badge variant="destructive" className="text-xs">Error</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent Errors */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Recent Errors (24h)</CardTitle></CardHeader>
                <CardContent>
                  {data.recentErrors?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No errors in the last 24 hours</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {data.recentErrors?.map((e: any, i: number) => (
                        <div key={i} className="text-xs border-b pb-2 last:border-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{e.event_type}</Badge>
                            <span className="text-muted-foreground">Chain {e.chain_id}</span>
                            <span className="text-muted-foreground ml-auto">{timeAgo(e.created_at)}</span>
                          </div>
                          {e.message && <p className="text-muted-foreground mt-1 truncate">{e.message}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Audit Log */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" />Recent Admin Actions</CardTitle></CardHeader>
                <CardContent>
                  {data.recentAuditEntries?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent admin actions</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {data.recentAuditEntries?.map((e: any, i: number) => (
                        <div key={i} className="text-xs border-b pb-2 last:border-0">
                          <div className="flex items-center gap-2">
                            {e.success ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                            <span className="font-medium">{e.endpoint}</span>
                            <span className="text-muted-foreground ml-auto">{timeAgo(e.timestamp)}</span>
                          </div>
                          {e.failure_reason && <p className="text-destructive mt-1">{e.failure_reason}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Failed to load dashboard data</p>
        )}
      </div>
    </AdminLayout>
  );
}
