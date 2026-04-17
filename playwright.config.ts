import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 15_000,
  use: {
    baseURL: "http://localhost:5001",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5001",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
