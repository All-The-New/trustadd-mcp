import { schedules, logger } from "@trigger.dev/sdk/v3";
import { probeAllAgents } from "../server/x402-prober";
import { notifyJobFailure } from "./alert";

export const x402ProberTask = schedules.task({
  id: "x402-prober",
  // Run daily at 3:00 AM UTC
  cron: "0 3 * * *",
  run: async (payload) => {
    try {
      logger.info("Starting x402 endpoint probing", {
        timestamp: payload.timestamp,
      });

      const result = await probeAllAgents();
      logger.info("x402 probing complete", { result });

      return result;
    } catch (err) {
      await notifyJobFailure("x402-prober", err as Error);
      throw err;
    }
  },
});
