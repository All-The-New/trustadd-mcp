import { schedules, logger } from "@trigger.dev/sdk/v3";
import { notifyJobFailure } from "./alert";

export const watchdogTask = schedules.task({
  id: "watchdog",
  // Run every 15 minutes — independent health check
  cron: "*/15 * * * *",
  run: async (payload) => {
    logger.info("Watchdog check starting", { timestamp: payload.timestamp });

    try {
      const { evaluateAlerts, deliverAlerts } = await import("../server/alerts");
      const alerts = await evaluateAlerts();
      const critical = alerts.filter((a) => a.severity === "critical").length;
      const warnings = alerts.filter((a) => a.severity === "warning").length;

      if (alerts.length > 0) {
        await deliverAlerts(alerts);
        logger.warn("Alerts detected", { critical, warnings, total: alerts.length });
      } else {
        logger.info("Watchdog check clean — no alerts");
      }

      return { alertsFound: alerts.length, critical, warnings };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("Watchdog failed", { error: error.message, stack: error.stack });
      // Return error as output so we can read it via API (temporarily)
      return { error: error.message, stack: error.stack?.split("\n").slice(0, 10) };
    }
  },
});
