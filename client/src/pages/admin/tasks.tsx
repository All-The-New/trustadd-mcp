import { AdminLayout } from "@/components/admin-layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, RefreshCw, Zap, Cpu } from "lucide-react";

function timeAgo(dateStr: string | Date | null): string {
  if (!dateStr) return "never";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const TASK_INFO: Record<string, { name: string; schedule: string; description: string }> = {
  "blockchain-indexer": { name: "Blockchain Indexer", schedule: "Every 2 min", description: "Orchestrator: dispatches per-chain indexing sub-tasks" },
  "chain-indexer": { name: "Chain Indexer", schedule: "On demand", description: "Per-chain sub-task: 2 cycles + 90s checkpointed wait" },
  "watchdog": { name: "Watchdog", schedule: "Every 15 min", description: "Evaluates alerts, delivers notifications" },
  "recalculate-scores": { name: "Trust Score Recalc", schedule: "Daily 5 AM UTC", description: "Recalculates trust scores for all agents" },
  "transaction-indexer": { name: "Transaction Indexer", schedule: "Every 6 hours", description: "Syncs on-chain payments to agent addresses" },
  "community-feedback": { name: "Community Feedback", schedule: "Daily 4 AM UTC", description: "Orchestrator: scrapes GitHub/Farcaster data" },
  "community-scrape": { name: "Community Scrape", schedule: "On demand", description: "Per-platform sub-task for feedback scraping" },
  "x402-prober": { name: "x402 Prober", schedule: "Daily 3 AM UTC", description: "Probes agent HTTP endpoints for 402 payment capability" },
  "bazaar-indexer": { name: "Bazaar Indexer", schedule: "Every 6 hours", description: "Indexes x402 marketplace services from CDP + x402Scout" },
  "alert": { name: "Alert Helper", schedule: "On demand", description: "Delivers alert notifications via webhooks" },
};

export default function AdminTasks() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/status/tasks"],
    staleTime: 30_000,
    retry: false,
  });

  const tasks = data?.tasks ?? [];

  return (
    <AdminLayout>
      <SEO title="Task Monitor" description="Trigger.dev background task monitoring" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Task Monitor</h1>
          <Badge variant="outline">{tasks.length} tasks</Badge>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No task data available. Requires TRIGGER_SECRET_KEY.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task: any) => {
              const info = TASK_INFO[task.taskId] || { name: task.taskId, schedule: "Unknown", description: "" };
              const isSuccess = task.lastStatus === "COMPLETED";
              const isFailed = task.lastStatus === "FAILED" || task.lastStatus === "CRASHED" || task.lastStatus === "SYSTEM_FAILURE";
              const isRunning = task.lastStatus === "EXECUTING" || task.lastStatus === "REATTEMPTING";
              const total = task.recentSuccesses + task.recentFailures;
              const failRate = total > 0 ? Math.round((task.recentFailures / total) * 100) : 0;

              return (
                <Card key={task.taskId}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          isRunning ? "bg-blue-500 animate-pulse" :
                          isSuccess ? "bg-green-500" :
                          isFailed ? "bg-red-500" : "bg-gray-400"
                        }`} />
                        <span className="font-medium text-sm">{info.name}</span>
                      </div>
                      <Badge variant="outline" className={`text-xs ${
                        isSuccess ? "text-green-700 dark:text-green-400" :
                        isFailed ? "text-red-700 dark:text-red-400" :
                        isRunning ? "text-blue-700 dark:text-blue-400" : ""
                      }`}>
                        {task.lastStatus || "UNKNOWN"}
                      </Badge>
                    </div>

                    {info.description && (
                      <p className="text-xs text-muted-foreground mb-3">{info.description}</p>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Last run</span>
                        <span>{timeAgo(task.lastRunAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Schedule</span>
                        <span className="text-xs">{info.schedule}</span>
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
                        <span className="text-muted-foreground">Recent (24h)</span>
                        <span className="text-xs">
                          <span className="text-green-600">{task.recentSuccesses} ok</span>
                          {task.recentFailures > 0 && <span className="text-red-600 ml-1">/ {task.recentFailures} fail</span>}
                          {failRate > 0 && <span className="text-muted-foreground ml-1">({failRate}%)</span>}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
