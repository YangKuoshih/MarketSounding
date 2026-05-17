import { test, expect } from "@playwright/test";

test.describe("Theme toggle", () => {
  test("can toggle between light and dark on landing page", async ({ page }) => {
    await page.goto("/");

    // Determine starting theme by checking <html class>
    const html = page.locator("html");
    const initialClass = (await html.getAttribute("class")) || "";
    const startedDark = initialClass.includes("dark");

    // Click theme toggle
    await page.getByLabel("Toggle theme").click();
    await page.waitForTimeout(300); // animation

    // Class should have flipped
    const newClass = (await html.getAttribute("class")) || "";
    const nowDark = newClass.includes("dark");
    expect(nowDark).toBe(!startedDark);

    // Toggle back
    await page.getByLabel("Toggle theme").click();
    await page.waitForTimeout(300);
    const finalClass = (await html.getAttribute("class")) || "";
    const finalDark = finalClass.includes("dark");
    expect(finalDark).toBe(startedDark);
  });

  test("theme persists across navigation", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    const initialClass = (await html.getAttribute("class")) || "";
    const startedDark = initialClass.includes("dark");

    await page.getByLabel("Toggle theme").click();
    await page.waitForTimeout(300);

    // Navigate to /console
    await page.goto("/console");
    const consoleClass = (await html.getAttribute("class")) || "";
    expect(consoleClass.includes("dark")).toBe(!startedDark);
  });

  test("theme toggle works on console", async ({ page }) => {
    await page.goto("/console");
    await expect(page.getByLabel("Toggle theme")).toBeVisible();
    await page.getByLabel("Toggle theme").click();
  });

  test("theme toggle works on chat", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByLabel("Toggle theme")).toBeVisible();
    await page.getByLabel("Toggle theme").click();
  });
});
