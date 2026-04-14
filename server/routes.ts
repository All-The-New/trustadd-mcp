import type { Express } from "express";
import { type Server } from "http";
import { registerStatusRoutes } from "./routes/status.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerTrustRoutes } from "./routes/trust.js";

// Re-export helpers used by tests and other modules
export { verdictFor, redactAgentForPublic } from "./routes/helpers.js";

export async function registerRoutes(
  app: Express,
  _httpServer?: Server,
): Promise<void> {
  registerStatusRoutes(app);
  registerAgentRoutes(app);
  registerAnalyticsRoutes(app);
  registerAdminRoutes(app);
  registerTrustRoutes(app);
}
