import { storage } from "./storage.js";
import { getEnabledChains } from "../shared/chains.js";
import { createLogger } from "./lib/logger.js";
import { getDbPool } from "./db.js";

const logger = createLogger("alerts");

export interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  chainId: number | null;
  title: string;
  message: string;
  firstSeen: Date;
  lastSeen: Date;
}

const REDELIVER_INTERVAL_MS = 6 * 60 * 60 * 1000; // re-alert every 6h for persistent issues
const INFO_REDELIVER_INTERVAL_MS = 24 * 60 * 60 * 1000; // info alerts (discovery) once per day

async function getLastDelivered(alertIds: string[]): Promise<Map<string, Date>> {
  const result = new Map<string, Date>();
  if (alertIds.length === 0) return result;
  try {
    const pool = getDbPool();
    const placeholders = alertIds.map((_, i) => `$${i + 1}`).join(",");
    const rows = await pool.query(
      `SELECT alert_id, last_delivered_at FROM alert_deliveries WHERE alert_id IN (${placeholders})`,
      alertIds,
    );
    for (const row of rows.rows) {
      result.set(row.alert_id, new Date(row.last_delivered_at));
    }
  } catch {
    // DB might not have the table yet — fall through (deliver all)
  }
  return result;
}

async function recordDeliveries(alertIds: string[]): Promise<void> {
  if (alertIds.length === 0) return;
  try {
    const pool = getDbPool();
    const values = alertIds.map((_, i) => `($${i + 1}, NOW())`).join(",");
    await pool.query(
      `INSERT INTO alert_deliveries (alert_id, last_delivered_at) VALUES ${values}
       ON CONFLICT (alert_id) DO UPDATE SET last_delivered_at = NOW()`,
      alertIds,
    );
  } catch {
    // Non-critical — worst case we re-deliver
  }
}

async function sendEmailAlert(toDeliver: Alert[]): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_EMAIL;
  if (!apiKey || !alertEmail) return false;

  const criticalCount = toDeliver.filter((a) => a.severity === "critical").length;
  const infoCount = toDeliver.filter((a) => a.severity === "info").length;
  const subject = criticalCount > 0
    ? `[CRITICAL] TrustAdd: ${criticalCount} critical alert${criticalCount > 1 ? "s" : ""}`
    : infoCount === toDeliver.length
    ? `TrustAdd: ${infoCount} notification${infoCount > 1 ? "s" : ""}`
    : `[WARNING] TrustAdd: ${toDeliver.length} alert${toDeliver.length > 1 ? "s" : ""}`;

  const rows = toDeliver.map((a) => {
    const color = a.severity === "critical" ? "#dc2626" : a.severity === "warning" ? "#f59e0b" : "#2563eb";
    return `<tr><td style="padding:8px;border-bottom:1px solid #eee"><span style="color:${color};font-weight:bold">${a.severity.toUpperCase()}</span></td><td style="padding:8px;border-bottom:1px solid #eee"><strong>${a.title}</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${a.message}</td></tr>`;
  }).join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#1e40af">TrustAdd Alert</h2>
      <p>${toDeliver.length} issue${toDeliver.length > 1 ? "s" : ""} detected at ${new Date().toISOString()}</p>
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Severity</th><th style="padding:8px;text-align:left">Alert</th><th style="padding:8px;text-align:left">Details</th></tr>
        ${rows}
      </table>
      <p style="color:#6b7280;font-size:12px;margin-top:16px">Alerts re-send every 6 hours while active. <a href="https://trustadd.com/status">View status page</a></p>
    </div>`;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "TrustAdd Alerts <alerts@trustadd.com>",
      to: alertEmail.split(",").map((e) => e.trim()),
      subject,
      html,
    });
    return true;
  } catch (err) {
    logger.error("Failed to send alert email", { error: (err as Error).message });
    return false;
  }
}

async function sendWebhookAlert(toDeliver: Alert[]): Promise<boolean> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const criticalCount = toDeliver.filter((a) => a.severity === "critical").length;
  const infoOnly = toDeliver.every((a) => a.severity === "info");
  const prefix = criticalCount > 0 ? "🚨" : infoOnly ? "ℹ️" : "⚠️";
  const text = `${prefix} **TrustAdd Alert** (${toDeliver.length} issue${toDeliver.length > 1 ? "s" : ""})\n\n` +
    toDeliver
      .map((a) => `[${a.severity.toUpperCase()}] **${a.title}**: ${a.message}`)
      .join("\n");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10000),
    });
    return true;
  } catch (err) {
    logger.error("Failed to deliver webhook", { error: (err as Error).message });
    return false;
  }
}

export async function deliverAlerts(alerts: Alert[]): Promise<void> {
  const hasEmail = process.env.RESEND_API_KEY && process.env.ALERT_EMAIL;
  const hasWebhook = !!process.env.ALERT_WEBHOOK_URL;
  if (!hasEmail && !hasWebhook) return;

  const now = Date.now();
  if (alerts.length === 0) return;

  const lastDelivered = await getLastDelivered(alerts.map((a) => a.id));
  const toDeliver = alerts.filter((a) => {
    const last = lastDelivered.get(a.id);
    if (!last) return true;
    const interval = a.severity === "info" ? INFO_REDELIVER_INTERVAL_MS : REDELIVER_INTERVAL_MS;
    return now - last.getTime() >= interval;
  });

  if (toDeliver.length === 0) return;

  // Deliver both health and info alerts via webhook + email
  let delivered = false;
  if (hasEmail) delivered = await sendEmailAlert(toDeliver);
  if (hasWebhook) delivered = (await sendWebhookAlert(toDeliver)) || delivered;

  if (delivered) {
    await recordDeliveries(toDeliver.map((a) => a.id));
  }
}

const STALL_THRESHOLD_MINUTES = 60;
const HIGH_ERROR_RATE_THRESHOLD = 0.5;
const PROBER_WARN_HOURS = 25;
const TX_INDEXER_WARN_HOURS = 8;
const TX_INDEXER_CRITICAL_HOURS = 13;
const ZERO_PROGRESS_MIN_CYCLES = 4; // alert after 4+ cycles with no block progress (~8+ minutes)
const STUCK_BLOCK_MIN_EVENTS = 10;  // alert after 10+ no_new_blocks events in hour (~20+ min stuck)

export async function evaluateAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();
  const enabledChains = getEnabledChains();

  let chainsDown = 0;
  let chainsTotal = 0;

  const CHAIN_DOWN_MINUTES = 10; // 5 missed 2-min cycles = definitely down

  for (const chain of enabledChains) {
    chainsTotal++;
    const state = await storage.getIndexerState(chain.chainId);
    const timeSinceUpdate = (now.getTime() - state.updatedAt.getTime()) / (60 * 1000);

    // Chain is "down" if no update in 10+ minutes (not based on is_running flag,
    // which is only true mid-cycle and false between Trigger.dev cron runs)
    if (timeSinceUpdate > CHAIN_DOWN_MINUTES) {
      chainsDown++;
      if (timeSinceUpdate > STALL_THRESHOLD_MINUTES) {
        alerts.push({
          id: `chain_stalled_${chain.chainId}`,
          severity: "warning",
          chainId: chain.chainId,
          title: "Chain Stalled",
          message: `${chain.name} hasn't progressed in ${Math.round(timeSinceUpdate)} minutes${state.lastError ? `: ${state.lastError.slice(0, 150)}` : ""}`,
          firstSeen: state.updatedAt,
          lastSeen: now,
        });
      }
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

    // High error volume (excludes spam_skip — expected on BNB)
    const rpcErrors = eventCounts.find(e => e.eventType === "rpc_error")?.count || 0;
    const totalErrorVolume = failedCount + rpcErrors;
    if (totalErrorVolume > 50) {
      alerts.push({
        id: `high_event_volume_${chain.chainId}`,
        severity: totalErrorVolume > 200 ? "critical" : "warning",
        chainId: chain.chainId,
        title: "High Error Volume",
        message: `${chain.name}: ${totalErrorVolume} errors in the last hour (${failedCount} failed cycles, ${rpcErrors} RPC errors)`,
        firstSeen: now,
        lastSeen: now,
      });
    }

    // Auth config error: 403/Forbidden from RPC provider (needs Alchemy dashboard fix)
    const authErrors = eventCounts.find(e => e.eventType === "auth_error")?.count || 0;
    if (authErrors > 0) {
      alerts.push({
        id: `auth_config_error_${chain.chainId}`,
        severity: "critical",
        chainId: chain.chainId,
        title: "RPC Auth Error",
        message: `${chain.name}: ${authErrors} auth failures in last hour — likely needs network enabled in Alchemy dashboard${state.lastError ? `: ${state.lastError.slice(0, 120)}` : ""}`,
        firstSeen: now,
        lastSeen: now,
      });
    }

    // Zero block progress: chain is actively cycling but last_processed_block never advances
    // This catches the Gnosis-type bug where the cycle runs but errors prevent block persistence.
    // Trigger after 4+ cycles (≥8 min of effort) with no progress — avoids false positives on brand-new chains.
    if (state.lastProcessedBlock === 0 && totalCycles > ZERO_PROGRESS_MIN_CYCLES && timeSinceUpdate < CHAIN_DOWN_MINUTES) {
      alerts.push({
        id: `zero_progress_${chain.chainId}`,
        severity: "warning",
        chainId: chain.chainId,
        title: "Zero Block Progress",
        message: `${chain.name}: ${totalCycles} cycles ran but last_processed_block is still 0 — blocks may not be persisting`,
        firstSeen: now,
        lastSeen: now,
      });
    }

    // Stuck at non-zero block: indexer is "running" (updated_at recent) but block hasn't
    // advanced despite multiple cycles. Catches the Gnosis-style silent RPC-behind bug.
    // Detected via the no_new_blocks telemetry event (emitted when startBlock > currentBlock).
    const noNewBlocksCount = eventCounts.find(e => e.eventType === "no_new_blocks")?.count || 0;
    if (state.lastProcessedBlock > 0 && noNewBlocksCount >= STUCK_BLOCK_MIN_EVENTS) {
      alerts.push({
        id: `stuck_block_${chain.chainId}`,
        severity: "warning",
        chainId: chain.chainId,
        title: "Stuck at Block",
        message: `${chain.name}: RPC returned currentBlock < startBlock ${noNewBlocksCount} times in last hour — last_processed_block=${state.lastProcessedBlock}, likely a lagging/cached RPC provider`,
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

  // New agent discovery
  try {
    const pool = getDbPool();
    const newAgentsResult = await pool.query(
      `SELECT id, name, chain_id, quality_tier, created_at
       FROM agents
       WHERE created_at >= NOW() - INTERVAL '24 hours'
         AND quality_tier NOT IN ('spam', 'unclassified')
       ORDER BY created_at DESC
       LIMIT 50`,
    );
    const newAgents = newAgentsResult.rows;
    if (newAgents.length > 0) {
      const agentSummary = newAgents.map((a: any) => `${a.name || a.id} (${a.quality_tier})`).join(", ");
      alerts.push({
        id: `new_agents_${new Date().toISOString().slice(0, 10)}`,
        severity: "info",
        chainId: null,
        title: "New Agents Discovered",
        message: `${newAgents.length} new quality agent(s) in last 24h: ${agentSummary.slice(0, 300)}`,
        firstSeen: new Date(newAgents[newAgents.length - 1].created_at),
        lastSeen: new Date(newAgents[0].created_at),
      });
    }
  } catch {
    // non-critical — agent table may be empty
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
