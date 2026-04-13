import type { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import { createLogger } from "./logger.js";

const logger = createLogger("admin-auth");

const JWT_EXPIRY_S = 24 * 60 * 60; // 24 hours

/** Simple HMAC-based token (no external deps needed). */
function createToken(secret: string): string {
  const payload = JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_S });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

function verifyToken(token: string, secret: string): boolean {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;
  const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return false;
  } catch {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

function getClientIp(req: Request): string {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "";
}

function isIpWhitelisted(ip: string): boolean {
  const whitelist = process.env.ADMIN_WHITELIST_IPS;
  if (!whitelist) return false;
  const allowed = whitelist.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(ip);
}

function getSigningSecret(): string | null {
  return process.env.ADMIN_SECRET || null;
}

const COOKIE_NAME = "ta_admin";

/**
 * POST /api/admin/login — validate password, set cookie.
 */
export function handleAdminLogin(req: Request, res: Response) {
  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return res.status(503).json({ error: "Admin login not configured" });
  }
  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ error: "Password required" });
  }
  try {
    const match = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
    if (!match) {
      logger.warn("Failed admin login attempt", { ip: getClientIp(req) });
      return res.status(401).json({ error: "Invalid password" });
    }
  } catch {
    logger.warn("Failed admin login attempt (length mismatch)", { ip: getClientIp(req) });
    return res.status(401).json({ error: "Invalid password" });
  }

  const secret = getSigningSecret();
  if (!secret) {
    return res.status(503).json({ error: "Server signing not configured" });
  }

  const token = createToken(secret);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: JWT_EXPIRY_S * 1000,
    path: "/",
  });

  logger.info("Admin login successful", { ip: getClientIp(req) });
  return res.json({ ok: true });
}

/**
 * GET /api/admin/session — check if the current session is valid.
 */
export function handleAdminSession(req: Request, res: Response) {
  const ip = getClientIp(req);

  // IP whitelist bypass
  if (isIpWhitelisted(ip)) {
    return res.json({ authenticated: true, method: "ip-whitelist" });
  }

  const token = req.cookies?.[COOKIE_NAME];
  const secret = getSigningSecret();
  if (token && secret && verifyToken(token, secret)) {
    return res.json({ authenticated: true, method: "cookie" });
  }

  return res.status(401).json({ authenticated: false });
}

/**
 * POST /api/admin/logout — clear the cookie.
 */
export function handleAdminLogout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  return res.json({ ok: true });
}

/**
 * Middleware: require admin session (cookie or IP whitelist).
 * Does NOT check X-Admin-Secret header (that's the old requireAdmin for CLI/API usage).
 */
export function requireAdminSession() {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);

    // IP whitelist bypass
    if (isIpWhitelisted(ip)) {
      return next();
    }

    const token = req.cookies?.[COOKIE_NAME];
    const secret = getSigningSecret();
    if (token && secret && verifyToken(token, secret)) {
      return next();
    }

    // Also accept the old X-Admin-Secret header for backward compat
    const headerSecret = req.headers["x-admin-secret"];
    const adminSecret = process.env.ADMIN_SECRET;
    if (headerSecret && adminSecret) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(headerSecret as string), Buffer.from(adminSecret))) {
          return next();
        }
      } catch { /* length mismatch */ }
    }

    return res.status(401).json({ error: "Authentication required" });
  };
}
