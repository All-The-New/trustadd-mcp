import { schedules, logger } from "@trigger.dev/sdk/v3";

export const watchdogTask = schedules.task({
  id: "watchdog",
  // Run every 15 minutes — independent health check
  cron: "*/15 * * * *",
  run: async (payload) => {
    logger.info("Watchdog starting (minimal test)", {
      timestamp: payload.timestamp,
    });

    // Step 1: Test basic import
    logger.info("Step 1: Importing alerts module...");
    let evaluateAlerts, deliverAlerts;
    try {
      const alerts = await import("../server/alerts");
      evaluateAlerts = alerts.evaluateAlerts;
      deliverAlerts = alerts.deliverAlerts;
      logger.info("Step 1: OK — alerts module loaded");
    } catch (err) {
      logger.error("Step 1: FAILED — alerts import crashed", {
        error: (err as Error).message,
        stack: (err as Error).stack,
      });
      return { error: "alerts import failed", message: (err as Error).message };
    }

    // Step 2: Evaluate alerts
    logger.info("Step 2: Evaluating alerts...");
    let alertList;
    try {
      alertList = await evaluateAlerts();
      logger.info("Step 2: OK", { count: alertList.length });
    } catch (err) {
      logger.error("Step 2: FAILED — evaluateAlerts crashed", {
        error: (err as Error).message,
        stack: (err as Error).stack,
      });
      return { error: "evaluateAlerts failed", message: (err as Error).message };
    }

    // Step 3: Deliver alerts
    const critical = alertList.filter((a: any) => a.severity === "critical").length;
    const warnings = alertList.filter((a: any) => a.severity === "warning").length;

    if (alertList.length > 0) {
      logger.info("Step 3: Delivering alerts...", { count: alertList.length });
      try {
        await deliverAlerts(alertList);
        logger.info("Step 3: OK — alerts delivered");
      } catch (err) {
        logger.error("Step 3: FAILED — deliverAlerts crashed", {
          error: (err as Error).message,
          stack: (err as Error).stack,
        });
        return { error: "deliverAlerts failed", message: (err as Error).message };
      }
    } else {
      logger.info("Step 3: Skipped — no alerts to deliver");
    }

    return { alertsFound: alertList.length, critical, warnings };
  },
});
