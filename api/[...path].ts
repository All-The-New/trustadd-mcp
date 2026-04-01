import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "../server/routes.js";

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

// Register routes FIRST, then error handler
let initialized = false;
const initPromise = registerRoutes(app).then(() => {
  // Error handler must come AFTER routes
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("API Error:", err.message, err.stack?.split("\n").slice(0, 3).join("\n"));
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
