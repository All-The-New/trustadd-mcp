import type { VercelRequest, VercelResponse } from "@vercel/node";
import { app, initPromise } from "../server/app";

let initialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!initialized) {
    await initPromise;
    initialized = true;
  }
  return app(req, res);
}
