import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { loginAsWorker, logout } from '../utils/auth-helpers';

test.describe('Worker Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    await loginAsWorker(page);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should display worker-specific dashboard', async ({ page }) => {
    await dashboardPage.expectLoaded();
    await dashboardPage.expectWorkerDashboard();
    await expect(page.getByText('My Assigned Jobs')).toBeVisible();
  });

  test('should NOT show owner-only navigation items', async ({ page }) => {
    await dashboardPage.expectLoaded();
    await expect(dashboardPage.workersLink).not.toBeVisible();
    await expect(dashboardPage.buildersLink).not.toBeVisible();
  });

  test('should show worker navigation items', async ({ page }) => {
    await dashboardPage.expectLoaded();
    await expect(page.getByRole('link', { name: 'My Jobs' })).toBeVisible();
    await expect(dashboardPage.timesheetsLink).toBeVisible();
    await expect(dashboardPage.chatLink).toBeVisible();
  });

  test('should show assigned jobs when allocated', async ({ page }) => {
    await dashboardPage.expectLoaded();
    await expect(page.locator('text=My Assigned Jobs')).toBeVisible();
  });

  test('should display worker name in sidebar', async ({ page }) => {
    await dashboardPage.expectLoaded();
    await expect(page.locator('aside')).toContainText('E2E Test Worker');
  });
});
