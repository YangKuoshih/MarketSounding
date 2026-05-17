import { test, expect } from "@playwright/test";

test.describe("Agent chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
  });

  test("default agent is Goldman Sachs with intro and prompts", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Talk to Goldman Sachs" })).toBeVisible();
    await expect(page.getByText("research desk", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("What's your view on the next FOMC meeting?")).toBeVisible();
  });

  test("dealer picker shows 5 agents", async ({ page }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Goldman Sachs", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("JP Morgan", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Morgan Stanley", { exact: true })).toBeVisible();
    // Citi appears once in sidebar list as a button label
    expect(await sidebar.getByText("Citi", { exact: true }).count()).toBeGreaterThanOrEqual(1);
    await expect(sidebar.getByText("Bank of America", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("5 / 5 Agents Online")).toBeVisible();
  });

  test("switching to Morgan Stanley updates active agent header", async ({ page }) => {
    await page.locator("aside").getByText("Morgan Stanley", { exact: true }).click();
    // Active agent header at top of chat panel shows Morgan Stanley + bias info
    const activeHeader = page.locator("h2").filter({ hasText: "Morgan Stanley" });
    await expect(activeHeader).toBeVisible();
    // Bias indicator text "BIAS +0.50 - HAWKISH"
    await expect(page.getByText(/BIAS \+0\.50/i)).toBeVisible();
    // Intro bubble appears with MS persona text
    await expect(page.getByText(/Cautious, scenario-heavy/i)).toBeVisible();
  });

  test("clicking a suggested prompt sends message and gets agent reply", async ({ page }) => {
    const prompt = "What's your view on the next FOMC meeting?";
    await page.getByRole("button", { name: prompt }).click();

    // User message bubble appears (the button is gone, but the text now exists in a chat bubble)
    await expect(page.locator(`text="${prompt}"`).first()).toBeVisible({ timeout: 3000 });

    // Wait for agent thinking indicator
    await expect(page.getByText("GS is thinking...")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("GS is thinking...")).toBeHidden({ timeout: 8000 });

    // After reply, the user prompt should still be on screen and a new agent bubble exists
    await expect(page.locator(`text="${prompt}"`).first()).toBeVisible();
  });

  test("typing custom message and sending works", async ({ page }) => {
    const input = page.getByPlaceholder(/Ask GS about markets/i);
    await input.fill("Hello GS");
    await page.getByRole("button", { name: /Send/i }).click();

    await expect(page.locator("text=Hello GS")).toBeVisible();
    await expect(page.locator("text=GS is thinking")).toBeVisible({ timeout: 3000 });
  });

  test("Home link navigates back to landing", async ({ page }) => {
    await page.getByRole("link", { name: /Home/i }).click();
    await page.waitForURL(/^.*\/$/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/$/);
  });
});
