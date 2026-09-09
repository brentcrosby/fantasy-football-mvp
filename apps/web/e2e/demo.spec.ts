import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("visitor can explore and export a sample league without an API or account", async ({
  page,
  context
}, testInfo) => {
  const apiRequests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Fourth & Goal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Alex Carter, QB, details" }).click();
  await expect(
    page.getByText("A scoring breakdown is not available for this player.", { exact: true })
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Alex Carter ruled out" }).check();
  await expect(page.getByRole("button", { name: "Drew Foster, QB, details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Alex Carter, BN, details" })).toBeVisible();
  await page.getByRole("button", { name: "Reset sample scenario" }).click();
  await expect(page.getByRole("button", { name: "Alex Carter, QB, details" })).toBeVisible();
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sunday Standard" })).toBeVisible();
  await page.getByRole("button", { name: "League", exact: true }).click();
  await page.getByRole("tab", { name: "Context export" }).click();
  const preview = page.getByRole("textbox", { name: "League context text" });
  const text = await preview.inputValue();
  expect(text).toContain("SAMPLE DATA:");
  expect(text).toContain("West Coast Drive");
  await page.getByRole("button", { name: "Copy context", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .txt" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sunday-sample-league-week-4-context.txt");
  expect(await readFile((await download.path())!, "utf8")).toBe(text);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("context-export.png"), fullPage: true });
  await page.getByRole("button", { name: "My Team", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("lineup.png"), fullPage: true });
});
