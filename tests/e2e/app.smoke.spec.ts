import { expect, test } from "@playwright/test";

test("landing page renders core messaging", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /your business, woven online/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /start weaving free/i })).toBeVisible();
});

test("signup form renders required fields", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("user can sign up and land on onboarding", async ({ page }) => {
  await page.goto("/signup");

  const unique = `${Date.now()}_${Math.floor(Math.random() * 10_000)}`;
  await page.getByLabel("Your name").fill("Playwright User");
  await page.getByLabel("Email").fill(`playwright_${unique}@example.com`);
  await page.getByLabel("Password").fill("playwright-pass-123");
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL("**/onboarding", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /weave a new business/i })).toBeVisible();
});
