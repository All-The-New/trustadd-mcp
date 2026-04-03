import { defineConfig } from "@trigger.dev/sdk/v3";

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
  maxDuration: 300,
});
