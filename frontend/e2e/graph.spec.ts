import { test, expect } from "@playwright/test";

test.describe("Knowledge Graph page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/console/graph");
  });

  test("header and stats visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Knowledge Graph/i })).toBeVisible();
    await expect(page.getByText(/13 nodes, 24 edges/i)).toBeVisible();
  });

  test("SVG canvas is rendered with nodes", async ({ page }) => {
    // The graph SVG is the first full-size svg; Lucide icons are smaller SVGs
    // Use the SVG with class h-full w-full
    const svg = page.locator("svg.h-full.w-full");
    await expect(svg).toBeVisible();

    // After force simulation has time to settle, nodes should render
    await page.waitForTimeout(2000);

    // Verify specific dealer monograms render in the graph
    await expect(svg.locator("text").filter({ hasText: /^GS$/ }).first()).toBeVisible();
    await expect(svg.locator("text").filter({ hasText: /^JPM$/ }).first()).toBeVisible();
    await expect(svg.locator("text").filter({ hasText: /^MS$/ }).first()).toBeVisible();
    await expect(svg.locator("text").filter({ hasText: /^Citi$/ }).first()).toBeVisible();
    await expect(svg.locator("text").filter({ hasText: /^BofA$/ }).first()).toBeVisible();
  });

  test("zoom controls visible", async ({ page }) => {
    await expect(page.getByLabel("Zoom in")).toBeVisible();
    await expect(page.getByLabel("Zoom out")).toBeVisible();
    await expect(page.getByLabel("Reset view")).toBeVisible();
  });

  test("legend shows all 4 node types and 3 edge types", async ({ page }) => {
    // The "Legend" label and entries appear in the legend bar at the bottom
    const legendBar = page.locator("text=/^Legend$/i").locator("..");
    await expect(legendBar.getByText("Dealer", { exact: true })).toBeVisible();
    await expect(legendBar.getByText("Topic", { exact: true })).toBeVisible();
    // "Concern" appears once in node-type legend and once in edge-type legend, so use a count check
    expect(await legendBar.getByText("Concern", { exact: true }).count()).toBeGreaterThanOrEqual(1);
    await expect(legendBar.getByText("Crisis", { exact: true }).first()).toBeVisible();
    await expect(legendBar.getByText("Influence", { exact: true })).toBeVisible();
  });

  test("clicking a node opens detail panel", async ({ page }) => {
    await page.waitForTimeout(2500); // let force simulation settle
    const svg = page.locator("svg.h-full.w-full");

    // Click using bounding box of the GS text label
    const gsText = svg.locator("text").filter({ hasText: /^GS$/ }).first();
    await expect(gsText).toBeVisible();
    const box = await gsText.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }

    // Detail panel slides in
    await expect(page.getByLabel("Close panel")).toBeVisible({ timeout: 3000 });
  });
});
