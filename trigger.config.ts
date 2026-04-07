import { defineConfig } from "@trigger.dev/sdk/v3";
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: process.env.TRIGGER_ENVIRONMENT ?? "production",
  });
}

export default defineConfig({
  project: "proj_nabhtdcabmsfzbmlifqh",
  runtime: "node",
  logLevel: "log",
  build: {
    external: ["pg"],
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  dirs: ["./trigger"],
  maxDuration: 600,
  onFailure: async ({ payload, error, ctx }) => {
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: {
          taskId: ctx.task.id,
          environment: ctx.environment.type,
        },
        extra: { payload },
      });
      await Sentry.flush(2000);
    }
  },
});
