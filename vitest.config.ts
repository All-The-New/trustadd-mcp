import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "__tests__/**/*.test.ts",
      "server/__tests__/**/*.test.ts",
      "server/lib/**/__tests__/**/*.test.ts",
      "shared/__tests__/**/*.test.ts",
    ],
    exclude: ["node_modules", "dist"],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
