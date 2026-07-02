import { test, expect } from "@playwright/test";

test.describe("Activity Page", () => {
  test("redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard/activity");
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain("/auth/login");
  });

  test("shows activity feed for authenticated user", async ({ page, context }) => {
    // Seed session cookie
    await context.addCookies([
      {
        name: "bizweave_session",
        value: "test-session-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard/activity");

    // Should show the activity page heading
    await expect(page.locator("h1")).toContainText("Activity");
  });

  test("shows stats row with event counts", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "bizweave_session",
        value: "test-session-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard/activity");

    // Stats row should be visible
    await expect(page.getByText("Total events")).toBeVisible();
    await expect(page.getByText("Warnings")).toBeVisible();
    await expect(page.getByText("Errors")).toBeVisible();
  });

  test("back button navigates to dashboard", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "bizweave_session",
        value: "test-session-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard/activity");
    await page.getByText("Back to dashboard").click();
    await expect(page).toHaveURL("/dashboard");
  });
});
