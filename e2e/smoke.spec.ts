import { test, expect } from "@playwright/test";

test("homepage responds and renders the app shell", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Plateforme MLM/);
});
