import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const watchdogTask = schedules.task({
  id: "watchdog",
  cron: "*/15 * * * *",
  maxDuration: 30,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { evaluateAlerts, deliverAlerts } = await import("../server/alerts");

      metadata.set("phase", "evaluating");
      const alerts = await evaluateAlerts();
      const critical = alerts.filter((a) => a.severity === "critical").length;
      const warnings = alerts.filter((a) => a.severity === "warning").length;
      metadata.set("alertsFound", alerts.length);
      metadata.set("critical", critical);
      metadata.set("warnings", warnings);

      if (alerts.length > 0) {
        metadata.set("phase", "delivering");
        await deliverAlerts(alerts);
        logger.warn("Alerts detected", { critical, warnings, total: alerts.length });
      } else {
        logger.info("Watchdog check clean — no alerts");
      }

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.costInCents);
      metadata.set("durationMs", cost.durationMs);

      return { alertsFound: alerts.length, critical, warnings };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("Watchdog failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorAt", new Date().toISOString());
      throw error;
    }
  },
});
