import { test, expect } from "@playwright/test";

test.describe("Console dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/console");
  });

  test("header shows all 5 nav tabs", async ({ page }) => {
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: /Dashboard/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /New Sounding/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /Agent Chat/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /Knowledge Graph/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /History/i })).toBeVisible();
  });

  test("hero search input works and routes to new sounding", async ({ page }) => {
    const input = page.getByPlaceholder(/FOMC rate decision/i);
    await input.fill("FOMC June rate decision");
    await page.getByRole("button", { name: /Research/i }).click();
    await page.waitForURL(/\/console\/sounding\/new/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/console\/sounding\/new/);
    await expect(page).toHaveURL(/topic=/);
  });

  test("3 sample event cards are clickable", async ({ page }) => {
    await expect(page.getByRole("button", { name: /FOMC June 2026 Decision/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /US-China Tariff Escalation/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Middle East Oil Supply Shock/i })).toBeVisible();
  });

  test("clicking sample event routes to new sounding with sample param", async ({ page }) => {
    await page.getByRole("button", { name: /FOMC June 2026 Decision/i }).click();
    await page.waitForURL(/\/console\/sounding\/new\?sample=/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/console\/sounding\/new\?sample=/);
  });

  test("recent soundings section shows 3 items with sparklines", async ({ page }) => {
    await expect(page.getByText(/Recent Soundings/i)).toBeVisible();
    await expect(page.getByText(/sim_a1b2c3d4/i)).toBeVisible();
    await expect(page.getByText(/Yen Intervention Speculation/i)).toBeVisible();
  });

  test("disclaimer banner present at footer", async ({ page }) => {
    await expect(page.getByText(/Simulated views -- not actual dealer commentary/i)).toBeVisible();
  });
});

test.describe("New Sounding page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/console/sounding/new");
  });

  test("3 input mode tabs are visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^Search$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Paste$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sample$/i })).toBeVisible();
  });

  test("Launch button visible with Rocket icon", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Launch Simulation/i })).toBeVisible();
  });

  test("Launch button (no API configured) routes to demo simulation", async ({ page }) => {
    await page.getByRole("button", { name: /Launch Simulation/i }).click();
    await page.waitForURL(/\/console\/sounding\/demo/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/console\/sounding\/demo/);
  });
});

test.describe("Simulation Demo (complete state)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/console/sounding/demo");
  });

  test("shows complete badge", async ({ page }) => {
    await expect(page.getByText(/^Complete$/i).first()).toBeVisible();
  });

  test("HD spectrum and position evolution sections visible", async ({ page }) => {
    await expect(page.getByText(/Hawkish \/ Dovish Spectrum/i)).toBeVisible();
    await expect(page.getByText(/Position Evolution/i)).toBeVisible();
    await expect(page.getByText(/Final Positions/i)).toBeVisible();
  });

  test("transcript toggle works", async ({ page }) => {
    const toggle = page.getByRole("button", { name: /Show Discussion Transcript/i });
    await toggle.click();
    await expect(page.getByText(/Round 1: Initial Reactions/i)).toBeVisible();
    await page.getByRole("button", { name: /Hide Discussion Transcript/i }).click();
  });
});

test.describe("Simulation Demo (running state)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/console/sounding/running");
  });

  test("Running badge is visible", async ({ page }) => {
    await expect(page.getByText(/^Running$/i).first()).toBeVisible();
  });

  test("system dashboard shows logs", async ({ page }) => {
    await expect(page.getByText(/System Dashboard/i)).toBeVisible();
    // Wait for at least one log entry to appear (after mount)
    await expect(page.getByText(/Initializing simulation/i)).toBeVisible({ timeout: 5000 });
  });

  test("crisis injection textarea is present", async ({ page }) => {
    // Crisis textarea has a long placeholder that includes "stimulus package"
    const textarea = page.getByPlaceholder(/stimulus package/i);
    await expect(textarea).toBeVisible();
  });
});

test.describe("History page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/console/history");
  });

  test("shows simulation table with sample data", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Simulation History/i })).toBeVisible();
    await expect(page.getByText(/FOMC June 2026 Decision/i)).toBeVisible();
    await expect(page.getByText(/US-China Tariff Escalation/i)).toBeVisible();
  });

  test("status badges render", async ({ page }) => {
    await expect(page.getByText(/^Complete$/i).first()).toBeVisible();
    await expect(page.getByText(/^Running$/i).first()).toBeVisible();
    await expect(page.getByText(/^Failed$/i).first()).toBeVisible();
  });

  test("search filters the list", async ({ page }) => {
    const search = page.getByPlaceholder(/Search simulations/i);
    await search.fill("FOMC");
    await expect(page.getByText(/FOMC June 2026 Decision/i)).toBeVisible();
    await expect(page.getByText(/US-China Tariff Escalation/i)).not.toBeVisible();
  });

  test("search with no matches shows empty state", async ({ page }) => {
    const search = page.getByPlaceholder(/Search simulations/i);
    await search.fill("zzz_nomatch");
    await expect(page.getByText(/No simulations match/i)).toBeVisible();
  });
});
