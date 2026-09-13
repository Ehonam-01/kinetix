import { test, expect } from "@playwright/test";

// requireAdmin() (services/auth/current-user.ts) redirects a non-admin the
// same way requireUser() does for /dashboard — same guard, same behavior,
// worth its own assertion since a regression here would expose admin data.
test("/admin redirige vers /login si non authentifié", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("une sous-page /admin redirige aussi vers /login si non authentifié", async ({
  page,
}) => {
  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/login$/);
});
