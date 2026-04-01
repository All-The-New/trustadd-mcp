import { schedules, logger } from "@trigger.dev/sdk/v3";
import { evaluateAlerts, deliverAlerts } from "../server/alerts";
import { notifyJobFailure } from "./alert";

export const watchdogTask = schedules.task({
  id: "watchdog",
  // Run every 15 minutes — independent health check
  cron: "*/15 * * * *",
  run: async (payload) => {
    try {
      logger.info("Watchdog check starting", {
        timestamp: payload.timestamp,
      });

      logger.info("Calling evaluateAlerts...");
      let alerts;
      try {
        alerts = await evaluateAlerts();
      } catch (evalErr) {
        logger.error("evaluateAlerts crashed", {
          error: (evalErr as Error).message,
          stack: (evalErr as Error).stack,
        });
        throw evalErr;
      }
      const critical = alerts.filter((a) => a.severity === "critical").length;
      const warnings = alerts.filter((a) => a.severity === "warning").length;

      if (alerts.length > 0) {
        logger.info("Delivering alerts", { count: alerts.length });
        try {
          await deliverAlerts(alerts);
        } catch (deliverErr) {
          logger.error("deliverAlerts crashed", {
            error: (deliverErr as Error).message,
            stack: (deliverErr as Error).stack,
          });
          throw deliverErr;
        }
        logger.warn("Alerts detected", { critical, warnings, total: alerts.length });
      } else {
        logger.info("Watchdog check clean — no alerts");
      }

      return { alertsFound: alerts.length, critical, warnings };
    } catch (err) {
      await notifyJobFailure("watchdog", err as Error);
      throw err;
    }
  },
});
