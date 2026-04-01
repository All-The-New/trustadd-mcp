import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { pool } from "../db.js";
import { createLogger } from "./logger.js";
import { getRequestId } from "./request-context.js";

const logger = createLogger("admin");

export function verifyAdminSecret(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string" || provided.length === 0) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function writeAuditEntry(entry: {
  endpoint: string;
  ipAddress: string | undefined;
  userAgent: string | undefined;
  success: boolean;
  failureReason: string | null;
  parameters: Record<string, unknown> | null;
  durationMs: number | null;
  requestId: string | undefined;
}) {
  try {
    await pool.query(
      `INSERT INTO admin_audit_log (endpoint, ip_address, user_agent, success, failure_reason, parameters, duration_ms, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [entry.endpoint, entry.ipAddress, entry.userAgent, entry.success, entry.failureReason, entry.parameters ? JSON.stringify(entry.parameters) : null, entry.durationMs, entry.requestId],
    );
  } catch (err) {
    logger.error("Failed to write audit log", { error: (err as Error).message });
  }
}

/**
 * Express middleware that validates the admin secret and logs the action.
 * Usage: app.post("/api/admin/sync", requireAdmin(), async (req, res) => { ... })
 */
export function requireAdmin() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const endpoint = req.path;
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];
    const requestId = getRequestId();

    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      writeAuditEntry({ endpoint, ipAddress, userAgent, success: false, failureReason: "ADMIN_SECRET not configured", parameters: null, durationMs: 0, requestId });
      return res.status(503).json({ message: "Admin not configured" });
    }

    const provided = req.headers["x-admin-secret"];
    if (!verifyAdminSecret(provided, adminSecret)) {
      writeAuditEntry({ endpoint, ipAddress, userAgent, success: false, failureReason: "Invalid secret", parameters: null, durationMs: 0, requestId });
      logger.warn("Unauthorized admin access attempt", { endpoint, ip: ipAddress });
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Log successful action on response finish (captures duration)
    res.on("finish", () => {
      const durationMs = Date.now() - start;
      writeAuditEntry({ endpoint, ipAddress, userAgent, success: true, failureReason: null, parameters: sanitizeParams(req.query), durationMs, requestId });
      logger.info("Admin action completed", { endpoint, durationMs, statusCode: res.statusCode });
    });

    next();
  };
}

function sanitizeParams(query: Record<string, any>): Record<string, unknown> | null {
  const sanitized: Record<string, unknown> = {};
  let hasKeys = false;
  for (const [k, v] of Object.entries(query)) {
    if (k === "secret" || k === "password" || k === "token") continue;
    sanitized[k] = v;
    hasKeys = true;
  }
  return hasKeys ? sanitized : null;
}
