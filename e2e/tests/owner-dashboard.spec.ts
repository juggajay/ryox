import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { JobsPage } from '../pages/jobs.page';
import { WorkersPage } from '../pages/workers.page';
import { BuildersPage } from '../pages/builders.page';
import { loginAsOwner, logout, TEST_JOB, TEST_WORKER, TEST_BUILDER } from '../utils/auth-helpers';

test.describe('Owner Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    await loginAsOwner(page);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should display all stat cards', async ({ page }) => {
    await dashboardPage.expectLoaded();
    // Use first() since text appears in both heading and stat label
    await expect(page.getByText('Active Jobs').first()).toBeVisible();
    await expect(page.getByText('Active Workers').first()).toBeVisible();
    await expect(page.getByText(/Pending Timesheets|Timesheets/i).first()).toBeVisible();
    await expect(page.getByText(/Builders/i).first()).toBeVisible();
  });

  test('should display seeded job in active jobs list', async ({ page }) => {
    await dashboardPage.expectLoaded();
    await expect(page.getByText(TEST_JOB.name)).toBeVisible();
  });

  test('should navigate to Jobs page', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await dashboardPage.navigateToJobs();
    await jobsPage.expectLoaded();
    await jobsPage.expectJobInList(TEST_JOB.name);
  });

  test('should navigate to Workers page', async ({ page }) => {
    const workersPage = new WorkersPage(page);
    await dashboardPage.navigateToWorkers();
    await workersPage.expectLoaded();
    await workersPage.expectWorkerInList(TEST_WORKER.name);
  });

  test('should navigate to Builders page', async ({ page }) => {
    const buildersPage = new BuildersPage(page);
    await dashboardPage.navigateToBuilders();
    await buildersPage.expectLoaded();
    await buildersPage.expectBuilderInList(TEST_BUILDER.companyName);
  });

  test('should show organization name in sidebar', async ({ page }) => {
    await dashboardPage.expectLoaded();
    await expect(page.locator('aside')).toContainText('E2E Test Organization');
  });

  test('sidebar should have all owner navigation links', async ({ page }) => {
    await dashboardPage.expectLoaded();
    await expect(dashboardPage.dashboardLink).toBeVisible();
    await expect(dashboardPage.jobsLink).toBeVisible();
    await expect(dashboardPage.workersLink).toBeVisible();
    await expect(dashboardPage.buildersLink).toBeVisible();
    await expect(dashboardPage.timesheetsLink).toBeVisible();
    await expect(dashboardPage.settingsLink).toBeVisible();
  });
});
