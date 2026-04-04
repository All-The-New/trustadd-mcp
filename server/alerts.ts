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
  const subject = criticalCount > 0
    ? `[CRITICAL] TrustAdd: ${criticalCount} critical alert${criticalCount > 1 ? "s" : ""}`
    : `[WARNING] TrustAdd: ${toDeliver.length} alert${toDeliver.length > 1 ? "s" : ""}`;

  const rows = toDeliver.map((a) => {
    const color = a.severity === "critical" ? "#dc2626" : "#f59e0b";
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
  const prefix = criticalCount > 0 ? "🚨" : "⚠️";
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
  const candidates = alerts.filter((a) => a.severity !== "info");
  if (candidates.length === 0) return;

  const lastDelivered = await getLastDelivered(candidates.map((a) => a.id));
  const toDeliver = candidates.filter((a) => {
    const last = lastDelivered.get(a.id);
    if (last && now - last.getTime() < REDELIVER_INTERVAL_MS) return false;
    return true;
  });

  if (toDeliver.length === 0) return;

  // Try email first, fall back to webhook
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

    // High event volume (cost spike indicator) — reuses cached eventCounts
    const spamSkips = eventCounts.find(e => e.eventType === "spam_skip")?.count || 0;
    const rpcErrors = eventCounts.find(e => e.eventType === "rpc_error")?.count || 0;
    const totalErrorVolume = failedCount + spamSkips + rpcErrors;
    if (totalErrorVolume > 100) {
      alerts.push({
        id: `high_event_volume_${chain.chainId}`,
        severity: totalErrorVolume > 500 ? "critical" : "warning",
        chainId: chain.chainId,
        title: "High Error/Skip Volume",
        message: `${chain.name}: ${totalErrorVolume} error/skip events in the last hour — may indicate elevated compute cost`,
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
