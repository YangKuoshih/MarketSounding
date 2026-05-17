import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hero is visible with status banner", async ({ page }) => {
    await expect(page.getByText(/SYSTEM READY/i)).toBeVisible();
    await expect(page.getByText(/Simulate dealer reactions/i)).toBeVisible();
  });

  test("stats row shows 5 dealers, 3-5 round depth, < 90s", async ({ page }) => {
    await expect(page.getByText("DEALER AGENTS")).toBeVisible();
    await expect(page.getByText("ROUND DEPTH")).toBeVisible();
    await expect(page.getByText("PER SIMULATION")).toBeVisible();
  });

  test("dealer card stack shows all 5 personas", async ({ page }) => {
    for (const dealer of ["Goldman Sachs", "JP Morgan", "Morgan Stanley", "Citi", "Bank of America"]) {
      await expect(page.getByText(dealer).first()).toBeVisible();
    }
  });

  test("Launch Console CTA navigates to /console", async ({ page }) => {
    await page.getByRole("link", { name: /Launch Console/i }).first().click();
    await page.waitForURL(/\/console$/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/console$/);
  });

  test("How it Works link navigates to /about", async ({ page }) => {
    await page.getByRole("link", { name: /How it Works/i }).click();
    await page.waitForURL(/\/about$/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/about$/);
  });

  test("Header About link navigates", async ({ page }) => {
    await page.locator("header").getByRole("link", { name: /^About$/i }).click();
    await page.waitForURL(/\/about$/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/about$/);
  });

  test("CTA section at bottom shows Launch + Talk to Agent buttons", async ({ page }) => {
    await page.locator("section").last().scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: /Talk to an Agent/i })).toBeVisible();
  });

  test("features grid shows 6 feature cards", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "5 Dealer Personas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Multi-Round Roundtable" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Crisis Injection" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Knowledge Graph" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Discussion Transcripts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Disclaimers Built-In" })).toBeVisible();
  });

  test("workflow shows 5 numbered steps (01-05)", async ({ page }) => {
    for (const n of ["01", "02", "03", "04", "05"]) {
      await expect(page.locator("section").getByText(n).first()).toBeVisible();
    }
  });
});
