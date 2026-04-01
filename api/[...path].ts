import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "../server/routes.js";
import { createLogger } from "../server/lib/logger.js";
import { requestStore, generateRequestId } from "../server/lib/request-context.js";
import { createRateLimiter } from "../server/lib/rate-limiter.js";

const app = express();
app.set("trust proxy", 1);

app.use(
  express.json({
    verify: (req: any, _res: any, buf: any) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") || ["https://trustadd.com"],
  methods: ["GET", "POST"],
  credentials: false,
}));

app.use((_req: any, res: any, next: any) => {
  res.set("X-Frame-Options", "DENY");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// DB-backed rate limiting (shared across all Vercel serverless instances)
app.use("/api/admin", createRateLimiter({ prefix: "admin", windowMs: 60 * 60 * 1000, limit: 2 }));
app.use("/api", createRateLimiter({ prefix: "api", windowMs: 60 * 1000, limit: 100 }));

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
