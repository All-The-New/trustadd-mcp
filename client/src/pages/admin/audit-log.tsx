import { AdminLayout } from "@/components/admin-layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState } from "react";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function AdminAuditLog() {
  const [page, setPage] = useState(0);
  const [successFilter, setSuccessFilter] = useState("all");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["admin-audit-log", page, successFilter],
    queryFn: async () => {
      const url = `/api/admin/audit-log/detailed?limit=50&offset=${page * 50}${successFilter !== "all" ? `&success=${successFilter}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
    retry: false,
  });

  return (
    <AdminLayout>
      <SEO title="Audit Log" description="Admin action audit trail" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <Select value={successFilter} onValueChange={(v) => { setSuccessFilter(v); setPage(0); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="true">Successful only</SelectItem>
              <SelectItem value="false">Failed only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    <th className="px-4 py-3 text-muted-foreground"></th>
                    <th className="px-4 py-3 text-muted-foreground">Time</th>
                    <th className="px-4 py-3 text-muted-foreground">Endpoint</th>
                    <th className="px-4 py-3 text-muted-foreground">IP</th>
                    <th className="px-4 py-3 text-muted-foreground">Duration</th>
                    <th className="px-4 py-3 text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.entries?.map((entry: any) => (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        {entry.success
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <XCircle className="w-4 h-4 text-red-500" />}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{entry.endpoint}</td>
                      <td className="px-4 py-3 font-mono text-xs">{entry.ip_address || "-"}</td>
                      <td className="px-4 py-3 text-xs">{entry.duration_ms ? `${entry.duration_ms}ms` : "-"}</td>
                      <td className="px-4 py-3 text-xs">
                        {entry.failure_reason && (
                          <Badge variant="destructive" className="text-xs">{entry.failure_reason}</Badge>
                        )}
                        {entry.parameters && (
                          <span className="text-muted-foreground ml-2">{JSON.stringify(entry.parameters)}</span>
                        )}
                        {entry.request_id && (
                          <span className="text-muted-foreground ml-2 text-[10px]">req:{entry.request_id}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data?.entries?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        No audit log entries found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {data && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{data.total?.toLocaleString()} total entries</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
              <span className="text-sm text-muted-foreground py-1">Page {page + 1}</span>
              <Button variant="outline" size="sm" disabled={(page + 1) * 50 >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
