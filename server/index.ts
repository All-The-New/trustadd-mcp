process.on("uncaughtException", (err) => {
  process.stderr.write(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", source: "process", message: `Uncaught exception: ${err.message}`, stack: err.stack }) + "\n");
});
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  process.stderr.write(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", source: "process", message: `Unhandled rejection: ${msg}`, stack }) + "\n");
});

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import { startIndexer, stopIndexer } from "./indexer.js";
import { runSync } from "../scripts/sync-prod-to-dev.js";
import { storage } from "./storage.js";
import { initCommunityFeedback } from "./community-feedback/index.js";
import { ensureScoresCalculated } from "./trust-score.js";
import { ensureSlugsGenerated } from "./slugs.js";
import { initProber, stopProber } from "./x402-prober.js";
import { initTransactionIndexer, stopTransactionIndexer } from "./transaction-indexer.js";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
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

app.use((_req, res, next) => {
  res.set("X-Frame-Options", "DENY");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later.", retryAfter: 60 },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 2,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Admin endpoint rate limit exceeded. Try again later." },
});

app.use("/api/admin", adminLimiter);
app.use("/api", apiLimiter);

import { log } from "./lib/log.js";
import { createLogger } from "./lib/logger.js";
import { requestStore, generateRequestId } from "./lib/request-context.js";
export { log };

const reqLog = createLogger("http");

// Request ID + context middleware (must be early in chain)
app.use((req, res, next) => {
  const requestId = (req.headers["x-request-id"] as string) || generateRequestId();
  res.setHeader("X-Request-ID", requestId);
  requestStore.run({ requestId, startTime: Date.now() }, () => next());
});

// Request logging middleware
app.use((req, res, next) => {
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

let shuttingDown = false;

function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`${signal} received — shutting down gracefully...`, "shutdown");

  stopProber();
  stopTransactionIndexer();

  try {
    stopIndexer();
  } catch {}

  httpServer.close(() => {
    log("HTTP server closed", "shutdown");
    process.exit(0);
  });

  setTimeout(() => {
    log("Shutdown timeout — forcing exit", "shutdown");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

(async () => {
  const enableIndexer = process.env.ENABLE_INDEXER === "true";

  const SYNC_STALE_HOURS = 24;
  if (!enableIndexer && process.env.PROD_DATABASE_URL && process.env.DATABASE_URL) {
    try {
      const state = await storage.getIndexerState(1);
      const hoursSinceSync = state.lastSyncedAt
        ? (Date.now() - new Date(state.lastSyncedAt).getTime()) / (1000 * 60 * 60)
        : Infinity;

      if (hoursSinceSync > SYNC_STALE_HOURS) {
        const label = state.lastSyncedAt
          ? `last synced ${Math.round(hoursSinceSync)}h ago`
          : "never synced";
        log(`Auto-sync: ${label}, syncing now...`, "sync");

        runSync(
          process.env.PROD_DATABASE_URL!,
          process.env.DATABASE_URL!,
          (msg) => log(msg, "sync"),
        ).then(async () => {
          await storage.updateIndexerState(1, { lastSyncedAt: new Date() });
          log("Auto-sync complete", "sync");
        }).catch((err) => {
          log(`Auto-sync failed: ${(err as Error).message}`, "sync");
        });
      } else {
        log(`Auto-sync: data is fresh (synced ${Math.round(hoursSinceSync)}h ago), skipping`, "sync");
      }
    } catch (err) {
      log(`Auto-sync check failed: ${(err as Error).message}`, "sync");
    }
  }
  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    reqLog.error("Internal Server Error", { error: (err as Error).message, stack: (err as Error).stack });

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      const hasRpcKey = !!(process.env.API_KEY_ALCHEMY || process.env.API_KEY_INFURA);
      const enableIndexer = process.env.ENABLE_INDEXER === "true";
      if (hasRpcKey && enableIndexer) {
        try {
          const indexers = startIndexer();
          log(`Started ${indexers.length} chain indexer(s)`, "startup");
        } catch (err) {
          log(`Indexer failed to start: ${(err as Error).message}`, "startup");
        }
      } else if (hasRpcKey && !enableIndexer) {
        log("Indexer disabled (set ENABLE_INDEXER=true to enable)", "startup");
      }

      initCommunityFeedback().catch((err) => {
        log(`Community feedback init failed: ${(err as Error).message}`, "startup");
      });

      ensureScoresCalculated().catch((err) => {
        log(`Trust score init failed: ${(err as Error).message}`, "startup");
      });

      ensureSlugsGenerated().catch((err) => {
        log(`Slug generation failed: ${(err as Error).message}`, "startup");
      });

      initProber();           // first run: 7 min
      initTransactionIndexer(); // first run: 10 min
    },
  );
})();
