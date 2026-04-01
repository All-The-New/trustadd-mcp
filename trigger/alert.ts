import { logger } from "@trigger.dev/sdk/v3";

/**
 * Send a failure alert to the configured webhook when a Trigger.dev job fails.
 * Uses the same ALERT_WEBHOOK_URL env var as server/alerts.ts.
 */
export async function notifyJobFailure(jobId: string, error: Error): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn("ALERT_WEBHOOK_URL not set — cannot deliver job failure alert");
    return;
  }

  const text = `🚨 **TrustAdd Job Failed**\n\n[CRITICAL] **${jobId}**: ${error.message}`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10000),
    });
    logger.info(`Failure alert sent for job ${jobId}`);
  } catch (err) {
    logger.error(`Failed to send job failure alert: ${(err as Error).message}`);
  }
}
