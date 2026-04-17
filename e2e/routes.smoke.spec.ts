import { test, expect, type ConsoleMessage } from "@playwright/test";

const TOP_ROUTES = [
  "/",
  "/agents",
  "/analytics",
  "/methodology",
  "/trust-api",
  "/principles",
];

// A real agent slug that should exist in prod; for local dev any 404 is fine —
// we only assert the root renders (not blank) and no JS errors occur.
const AGENT_SAMPLE_PATH = "/agent/klara";

for (const route of [...TOP_ROUTES, AGENT_SAMPLE_PATH]) {
  test(`${route} renders without JS errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err: Error) => errors.push(err.message));

    const response = await page.goto(route, { waitUntil: "networkidle" });

    // Page must respond (SPA shell is always 200; API 404s redirect to shell)
    expect(response?.status()).not.toBe(500);

    // Root div must have children — a white screen renders an empty #root
    const rootChildren = await page.locator("#root").evaluate(
      (el) => el.childElementCount
    );
    expect(rootChildren, `#root is empty on ${route}`).toBeGreaterThan(0);

    // Zero JS console errors
    expect(errors, `Console errors on ${route}: ${errors.join("; ")}`).toHaveLength(0);
  });
}
