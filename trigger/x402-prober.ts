import { schedules, logger } from "@trigger.dev/sdk/v3";

export const x402ProberTask = schedules.task({
  id: "x402-prober",
  // Run daily at 3:00 AM UTC
  cron: "0 3 * * *",
  run: async (payload) => {
    logger.info("Starting x402 endpoint probing", { timestamp: payload.timestamp });

    try {
      const { probeAllAgents } = await import("../server/x402-prober");
      const result = await probeAllAgents();
      logger.info("x402 probing complete", { result });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("x402-prober failed", { error: error.message, stack: error.stack });
      return { error: error.message };
    }
  },
});
