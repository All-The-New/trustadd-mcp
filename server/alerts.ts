import { storage } from "./storage.js";
import { getEnabledChains } from "../shared/chains.js";

export interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  chainId: number | null;
  title: string;
  message: string;
  firstSeen: Date;
  lastSeen: Date;
}

const STALL_THRESHOLD_MINUTES = 60;
const HIGH_ERROR_RATE_THRESHOLD = 0.5;
const PROBER_WARN_HOURS = 25;
const TX_INDEXER_WARN_HOURS = 8;
const TX_INDEXER_CRITICAL_HOURS = 13;

export async function evaluateAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();
  const enabledChains = getEnabledChains();

  let chainsDown = 0;
  let chainsTotal = 0;

  for (const chain of enabledChains) {
    chainsTotal++;
    const state = await storage.getIndexerState(chain.chainId);

    if (!state.isRunning) {
      chainsDown++;
      alerts.push({
        id: `chain_down_${chain.chainId}`,
        severity: "warning",
        chainId: chain.chainId,
        title: "Chain Not Running",
        message: `${chain.name} indexer is not running${state.lastError ? `: ${state.lastError.slice(0, 150)}` : ""}`,
        firstSeen: state.updatedAt,
        lastSeen: now,
      });
      continue;
    }

    if (state.lastError) {
      alerts.push({
        id: `rpc_degraded_${chain.chainId}`,
        severity: "warning",
        chainId: chain.chainId,
        title: "RPC Degraded",
        message: `${chain.name}: ${state.lastError.slice(0, 150)}`,
        firstSeen: state.updatedAt,
        lastSeen: now,
      });
    }

    const timeSinceUpdate = (now.getTime() - state.updatedAt.getTime()) / (60 * 1000);
    if (timeSinceUpdate > STALL_THRESHOLD_MINUTES && state.isRunning) {
      alerts.push({
        id: `chain_stalled_${chain.chainId}`,
        severity: "warning",
        chainId: chain.chainId,
        title: "Chain Stalled",
        message: `${chain.name} hasn't progressed in ${Math.round(timeSinceUpdate)} minutes`,
        firstSeen: new Date(now.getTime() - timeSinceUpdate * 60 * 1000),
        lastSeen: now,
      });
    }

    const eventCounts = await storage.getIndexerEventCounts(60, chain.chainId);
    const completedCount = eventCounts.find(e => e.eventType === "cycle_complete")?.count || 0;
    const errorTypes = ["error", "rate_limit", "timeout", "connection_error"];
    const failedCount = eventCounts.filter(e => errorTypes.includes(e.eventType)).reduce((sum, e) => sum + e.count, 0);
    const totalCycles = completedCount + failedCount;

    if (totalCycles > 2 && failedCount / totalCycles > HIGH_ERROR_RATE_THRESHOLD) {
      alerts.push({
        id: `high_error_rate_${chain.chainId}`,
        severity: "warning",
        chainId: chain.chainId,
        title: "High Error Rate",
        message: `${chain.name}: ${failedCount}/${totalCycles} cycles failed in the last hour (${Math.round(failedCount / totalCycles * 100)}%)`,
        firstSeen: now,
        lastSeen: now,
      });
    }

    const backoffCount = eventCounts.find(e => e.eventType === "backoff")?.count || 0;
    if (backoffCount > 0) {
      alerts.push({
        id: `backoff_active_${chain.chainId}`,
        severity: "info",
        chainId: chain.chainId,
        title: "Backoff Active",
        message: `${chain.name} is in exponential backoff (${backoffCount} backoff events in last hour)`,
        firstSeen: now,
        lastSeen: now,
      });
    }
  }

  if (chainsTotal > 0 && chainsDown === chainsTotal) {
    alerts.unshift({
      id: "all_chains_down",
      severity: "critical",
      chainId: null,
      title: "All Chains Down",
      message: `None of the ${chainsTotal} configured chain indexers are running`,
      firstSeen: now,
      lastSeen: now,
    });
  }

  // x402 prober staleness
  try {
    const probeStats = await storage.getProbeStats();
    if (probeStats.lastProbeAt) {
      const probeAgeHours = (now.getTime() - probeStats.lastProbeAt.getTime()) / (60 * 60 * 1000);
      if (probeAgeHours > PROBER_WARN_HOURS) {
        alerts.push({
          id: "x402_prober_stale",
          severity: "warning",
          chainId: null,
          title: "x402 Prober Stale",
          message: `x402 prober last ran ${Math.round(probeAgeHours)}h ago — expected every 24h`,
          firstSeen: probeStats.lastProbeAt,
          lastSeen: now,
        });
      }
    }
  } catch {
    // non-critical — prober may not have run yet
  }

  // Transaction indexer sync staleness
  try {
    const lastSync = await storage.getMostRecentSyncTime();
    if (lastSync) {
      const syncAgeHours = (now.getTime() - lastSync.getTime()) / (60 * 60 * 1000);
      if (syncAgeHours > TX_INDEXER_CRITICAL_HOURS) {
        alerts.push({
          id: "tx_indexer_critical",
          severity: "critical",
          chainId: null,
          title: "Transaction Indexer Offline",
          message: `Transaction indexer last synced ${Math.round(syncAgeHours)}h ago — two or more missed cycles (expected every 6h)`,
          firstSeen: lastSync,
          lastSeen: now,
        });
      } else if (syncAgeHours > TX_INDEXER_WARN_HOURS) {
        alerts.push({
          id: "tx_indexer_stale",
          severity: "warning",
          chainId: null,
          title: "Transaction Indexer Delayed",
          message: `Transaction indexer last synced ${Math.round(syncAgeHours)}h ago — one missed cycle (expected every 6h)`,
          firstSeen: lastSync,
          lastSeen: now,
        });
      }
    }
  } catch {
    // non-critical — tx indexer may not have run yet
  }

  return alerts;
}
