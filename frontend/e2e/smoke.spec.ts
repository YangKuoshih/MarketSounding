import { test, expect } from "@playwright/test";

/**
 * Smoke test: verify all routes load and return 200, and check for console errors.
 */

const ROUTES = [
  { path: "/", title: "MarketSounding", h1Match: /Simulate dealer reactions/i },
  { path: "/about", title: "MarketSounding", h1Match: /agent-time/i },
  { path: "/chat", title: "MarketSounding", h1Match: /Goldman Sachs/i },
  { path: "/auth/login", title: "MarketSounding" },
  { path: "/auth/register", title: "MarketSounding" },
  { path: "/console", title: "MarketSounding", h1Match: /happening in the markets/i },
  { path: "/console/sounding/new", title: "MarketSounding", h1Match: /New Sounding/i },
  { path: "/console/sounding/demo", title: "MarketSounding", h1Match: /FOMC June 2026/i },
  { path: "/console/sounding/running", title: "MarketSounding" },
  { path: "/console/graph", title: "MarketSounding", h1Match: /Knowledge Graph/i },
  { path: "/console/history", title: "MarketSounding", h1Match: /Simulation History/i },
];

for (const route of ROUTES) {
  test(`route ${route.path} loads without errors`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        // Ignore third-party noise
        const text = msg.text();
        if (
          !text.includes("Failed to load resource") &&
          !text.includes("favicon") &&
          !text.includes("Hydration")
        ) {
          consoleErrors.push(text);
        }
      }
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const response = await page.goto(route.path, { waitUntil: "networkidle" });
    expect(response?.status(), `Route ${route.path}`).toBeLessThan(400);

    await expect(page).toHaveTitle(new RegExp(route.title, "i"));

    if (route.h1Match) {
      // Find any heading or visible text that matches
      const matched = page.getByText(route.h1Match).first();
      await expect(matched).toBeVisible({ timeout: 5000 });
    }

    expect(consoleErrors, `Console errors on ${route.path}`).toEqual([]);
  });
}
