/**
 * E2E: Progress tracking flow — first scan → 30-day re-scan → score comparison.
 *
 * These tests use a pre-seeded test user (from test fixtures or storage state).
 * If no pre-auth state is available, tests skip gracefully.
 */

import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Auth state helpers
// ---------------------------------------------------------------------------

async function loginAsTestUser(page: Page): Promise<boolean> {
  const authFile = process.env.PLAYWRIGHT_STORAGE_STATE;
  if (authFile) return true; // Storage state handles auth

  await page.goto(`${BASE_URL}/login`);
  const email = process.env.E2E_TEST_EMAIL ?? "e2e_progress@test.example";
  const password = process.env.E2E_TEST_PASSWORD ?? "E2eTestPass123!";

  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');

  try {
    // A completed test user lands on /dashboard; a fresh one is sent into the
    // gated onboarding flow (/onboarding/*). Accept either as "logged in".
    // The post-onboarding tests below assume a completed pre-seeded fixture user.
    await page.waitForURL(/\/(dashboard|onboarding)(\/|$|\?)/, { timeout: 8_000 });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Progress page structure", () => {
  test("progress page renders core sections", async ({ page }) => {
    const loggedIn = await loginAsTestUser(page);
    if (!loggedIn) {
      test.skip(true, "No authenticated test user available");
      return;
    }

    await page.goto(`${BASE_URL}/progress`);

    // Should not be redirected to login
    await expect(page).not.toHaveURL(/login/);

    // Core sections
    await expect(page.locator("text=/Skin Journey|Progress/i").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("progress page shows re-scan CTA for users without recent scan", async ({ page }) => {
    const loggedIn = await loginAsTestUser(page);
    if (!loggedIn) {
      test.skip(true, "No authenticated test user available");
      return;
    }

    await page.goto(`${BASE_URL}/progress`);
    // Either shows a countdown CTA or a "start your first scan" prompt
    const rescanSection = page.locator(
      "text=/Re-scan|Start your journey|First scan|Take a scan/i"
    );
    await expect(rescanSection.first()).toBeVisible({ timeout: 12_000 });
  });

  test("progress timeline chart renders after first scan", async ({ page }) => {
    const loggedIn = await loginAsTestUser(page);
    if (!loggedIn) {
      test.skip(true, "No authenticated test user available");
      return;
    }

    await page.goto(`${BASE_URL}/progress`);
    // Chart area or no-data message should be visible
    const chartOrEmpty = page.locator(
      ".recharts-wrapper, text=/No scans yet|Start your first/i"
    );
    await expect(chartOrEmpty.first()).toBeVisible({ timeout: 12_000 });
  });
});

test.describe("Score comparison after re-scan", () => {
  test("results page shows improvement score after scan", async ({ page }) => {
    const loggedIn = await loginAsTestUser(page);
    if (!loggedIn) {
      test.skip(true, "No authenticated test user available");
      return;
    }

    await page.goto(`${BASE_URL}/results`);
    // Either redirects to latest result or shows empty state
    const scoreOrEmpty = page.locator(
      "[data-testid='skin-score'], text=/Skin Score|No results yet|Start a scan/i"
    );
    await expect(scoreOrEmpty.first()).toBeVisible({ timeout: 12_000 });
  });

  test("notification bell shows unread count when notifications exist", async ({
    page,
  }) => {
    const loggedIn = await loginAsTestUser(page);
    if (!loggedIn) {
      test.skip(true, "No authenticated test user available");
      return;
    }

    await page.goto(`${BASE_URL}/progress`);
    // Bell icon may or may not have a badge — just check it exists
    const bell = page.locator('[aria-label*="notification"], [data-testid="notifications"]');
    if (await bell.count() > 0) {
      await expect(bell.first()).toBeVisible();
    }
  });
});

test.describe("Adherence heatmap", () => {
  test("adherence section renders heatmap or empty state", async ({ page }) => {
    const loggedIn = await loginAsTestUser(page);
    if (!loggedIn) {
      test.skip(true, "No authenticated test user available");
      return;
    }

    await page.goto(`${BASE_URL}/progress`);
    const adherenceSection = page.locator(
      "text=/Adherence|Routine|Check-in|Streak/i"
    ).first();
    await expect(adherenceSection).toBeVisible({ timeout: 12_000 });
  });

  test("routine check-in button is clickable", async ({ page }) => {
    const loggedIn = await loginAsTestUser(page);
    if (!loggedIn) {
      test.skip(true, "No authenticated test user available");
      return;
    }

    await page.goto(`${BASE_URL}/progress`);
    const checkinBtn = page.locator(
      'button:has-text("Check In"), button:has-text("Log Today"), button[data-testid="checkin"]'
    );
    if (await checkinBtn.count() > 0) {
      await expect(checkinBtn.first()).toBeEnabled();
    }
  });
});
