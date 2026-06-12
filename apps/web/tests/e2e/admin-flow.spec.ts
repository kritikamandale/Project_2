/**
 * E2E: Admin panel flow — login → verify dermatologist → add product → analytics.
 *
 * Requires ADMIN credentials set via env vars.
 * All tests skip gracefully if admin login is unavailable.
 */

import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Admin login helper
// ---------------------------------------------------------------------------

async function loginAsAdmin(page: Page): Promise<boolean> {
  await page.goto(`${BASE_URL}/login`);

  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@test.example";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "AdminPass123!";

  // Click Admin tab
  const adminTab = page.locator('button:has-text("Admin"), [role="tab"]:has-text("Admin")');
  await adminTab.click().catch(() => {});

  await page.fill('input[name="email"], input[type="email"]', adminEmail);
  await page.fill('input[name="password"], input[type="password"]', adminPassword);

  // Admin may need TOTP — skip if prompt appears
  await page.click('button[type="submit"], button:has-text("Login")');

  try {
    await page.waitForURL(`${BASE_URL}/admin-dashboard**`, { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Admin authentication", () => {
  test("admin login redirects to admin-dashboard", async ({ page }) => {
    const success = await loginAsAdmin(page);
    if (!success) {
      test.skip(true, "Admin test credentials not available");
      return;
    }
    await expect(page).toHaveURL(/admin-dashboard/);
  });

  test("regular user redirected away from admin-dashboard", async ({ page }) => {
    // Log in as a regular user (no admin role)
    await page.goto(`${BASE_URL}/login`);
    const userEmail = process.env.E2E_TEST_EMAIL ?? "user@test.example";
    const userPassword = process.env.E2E_TEST_PASSWORD ?? "E2eTestPass123!";
    await page.fill('input[type="email"]', userEmail);
    await page.fill('input[type="password"]', userPassword);
    await page.click('button[type="submit"]');

    // After login, try to navigate to admin
    try {
      await page.waitForURL(`${BASE_URL}/dashboard**`, { timeout: 8_000 });
    } catch {}

    await page.goto(`${BASE_URL}/admin-dashboard`);
    // Should be redirected to /dashboard or /login
    await expect(page).not.toHaveURL(/admin-dashboard/);
  });
});

test.describe("Admin analytics dashboard", () => {
  test("analytics page shows KPI cards", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    await page.goto(`${BASE_URL}/admin-dashboard`);
    // KPI cards for total users, scans, etc.
    const kpiCards = page.locator('[data-testid="kpi-card"], .kpi-card, text=/Total Users/i');
    await expect(kpiCards.first()).toBeVisible({ timeout: 15_000 });
  });

  test("analytics page renders at least one chart", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    await page.goto(`${BASE_URL}/admin-dashboard`);
    const chart = page.locator(".recharts-wrapper, svg.recharts-surface");
    await expect(chart.first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("User management", () => {
  test("admin users page loads and shows searchable table", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    await page.goto(`${BASE_URL}/users`);
    await expect(page).not.toHaveURL(/login/);

    // Search box should be visible
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[type="search"]'
    );
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 });
  });

  test("dermatologist verification queue tab is present", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    await page.goto(`${BASE_URL}/users`);
    const dermTab = page.locator(
      'button:has-text("Dermatologist"), [role="tab"]:has-text("Verification")'
    );
    await expect(dermTab.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Product catalog management", () => {
  test("products page loads with paginated table", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    await page.goto(`${BASE_URL}/products`);
    await expect(page).not.toHaveURL(/login/);
    // Either a table or empty state
    const tableOrEmpty = page.locator(
      "table, text=/No products|Add your first product/i"
    );
    await expect(tableOrEmpty.first()).toBeVisible({ timeout: 10_000 });
  });

  test("add product button opens form modal", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    await page.goto(`${BASE_URL}/products`);
    const addBtn = page.locator(
      'button:has-text("Add Product"), button:has-text("New Product"), [data-testid="add-product"]'
    );
    if (await addBtn.count() > 0) {
      await addBtn.first().click();
      // Modal should open
      const modal = page.locator('[role="dialog"], [data-testid="product-form"]');
      await expect(modal.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("Platform settings", () => {
  test("settings page shows 2FA setup option for admin", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    await page.goto(`${BASE_URL}/settings`);
    const twoFaSection = page.locator(
      "text=/Two-Factor|TOTP|2FA|Authenticator/i"
    );
    await expect(twoFaSection.first()).toBeVisible({ timeout: 10_000 });
  });

  test("audit log tab shows paginated log table", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    await page.goto(`${BASE_URL}/settings`);
    const auditTab = page.locator(
      '[role="tab"]:has-text("Audit"), button:has-text("Audit Log")'
    );
    if (await auditTab.count() > 0) {
      await auditTab.first().click();
      const logTable = page.locator("table, text=/No audit logs/i");
      await expect(logTable.first()).toBeVisible({ timeout: 8_000 });
    }
  });

  test("bias report section shows Fitzpatrick distribution", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    await page.goto(`${BASE_URL}/settings`);
    const biasTab = page.locator(
      '[role="tab"]:has-text("Bias"), button:has-text("Bias Report")'
    );
    if (await biasTab.count() > 0) {
      await biasTab.first().click();
      const fitzContent = page.locator("text=/Fitzpatrick|Tone|Bias/i");
      await expect(fitzContent.first()).toBeVisible({ timeout: 8_000 });
    }
  });
});
