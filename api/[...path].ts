import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import cors from "cors";
import cookieParser from "cookie-parser";
import { registerRoutes } from "../server/routes.js";
import { createLogger } from "../server/lib/logger.js";
import { requestStore, generateRequestId } from "../server/lib/request-context.js";
import { createRateLimiter } from "../server/lib/rate-limiter.js";
import { requestLogger } from "../server/lib/request-logger.js";

const app = express();
app.set("trust proxy", 1);

app.use(cookieParser());

app.use(
  express.json({
    verify: (req: any, _res: any, buf: any) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || ["https://trustadd.com"];

// CORS: route-specific policies. Only one cors() should fire per request to avoid header conflicts.
app.use((req: any, res: any, next: any) => {
  const path = req.path || req.url;
  if (path.startsWith("/api/v1/trust")) {
    // Trust Data Product: open CORS for agent-to-agent access, no credentials
    return cors({ origin: "*", methods: ["GET"], credentials: false })(req, res, next);
  }
  if (path.startsWith("/api/admin")) {
    // Admin: restricted origins with credentials for cookie auth
    return cors({ origin: allowedOrigins, methods: ["GET", "POST"], credentials: true })(req, res, next);
  }
  // All other routes: restricted origins with credentials
  return cors({ origin: allowedOrigins, methods: ["GET", "POST"], credentials: true })(req, res, next);
});

app.use((_req: any, res: any, next: any) => {
  res.set("X-Frame-Options", "DENY");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// DB-backed rate limiting (shared across all Vercel serverless instances)
// Admin: app.use matches all sub-routes (/api/admin/login, /api/admin/logout, etc.)
// Agent list: stricter limit to prevent scraping (anti-scraping, see docs/api-tiering.md).
// Note: /api/agents requests hit both the agents-list AND the general api limiter.
// The agents-list bucket (10/min) is the effective bottleneck; the general bucket (100/min) has headroom.
app.use("/api/admin", (req, res, next) => {
  const limiter = req.method === "POST"
    ? createRateLimiter({ prefix: "admin-write", windowMs: 60 * 60 * 1000, limit: 10 })
    : createRateLimiter({ prefix: "admin-read", windowMs: 60 * 1000, limit: 60 });
  return limiter(req, res, next);
});
app.get("/api/agents", createRateLimiter({ prefix: "agents-list", windowMs: 60 * 1000, limit: 10 }));
app.use("/api", createRateLimiter({ prefix: "api", windowMs: 60 * 1000, limit: 100 }));

// Persist API requests to DB for usage analytics
app.use(requestLogger());

const reqLog = createLogger("http");

// Request ID + context middleware
app.use((req: any, res: any, next: any) => {
  const requestId = (req.headers["x-request-id"] as string) || generateRequestId();
  res.setHeader("X-Request-ID", requestId);
  requestStore.run({ requestId, startTime: Date.now() }, () => next());
});

// Request logging middleware
app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      reqLog.info(`${req.method} ${path} ${res.statusCode} in ${duration}ms`, {
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
      });
    }
  });

  next();
});

const errLog = createLogger("api");

// Register routes FIRST, then error handler
let initialized = false;
const initPromise = registerRoutes(app).then(() => {
  // Error handler must come AFTER routes
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    errLog.error(`API Error: ${err.message}`, { status, stack: err.stack?.split("\n").slice(0, 3).join("\n") });
    Sentry.captureException(err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
  initialized = true;
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!initialized) {
    try {
      await initPromise;
    } catch (err: any) {
      return res.status(500).json({ error: "Init failed", message: err.message });
    }
  }

  return app(req, res);
}
