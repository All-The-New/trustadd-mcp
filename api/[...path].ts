import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: any;
let initError: Error | null = null;

try {
  const mod = await import("../server/app.js");
  app = mod.app;
  await mod.initPromise;
} catch (err) {
  initError = err as Error;
  console.error("Failed to initialize app:", err);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (initError) {
    return res.status(500).json({
      error: "App initialization failed",
      message: initError.message,
      stack: initError.stack?.split("\n").slice(0, 5),
    });
  }
  return app(req, res);
}
