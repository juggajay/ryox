import { test, expect } from '@playwright/test';
import { WorkersPage } from '../pages/workers.page';
import { loginAsOwner, logout, TEST_WORKER } from '../utils/auth-helpers';

test.describe('Workers Management', () => {
  let workersPage: WorkersPage;

  test.beforeEach(async ({ page }) => {
    workersPage = new WorkersPage(page);
    await loginAsOwner(page);
    await workersPage.goto();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should display workers page correctly', async ({ page }) => {
    await workersPage.expectLoaded();
    await expect(workersPage.inviteWorkerButton).toBeVisible();
  });

  test('should display seeded worker in list', async ({ page }) => {
    await workersPage.expectLoaded();
    await workersPage.expectWorkerInList(TEST_WORKER.name);
  });

  test('should show worker details', async ({ page }) => {
    await workersPage.expectLoaded();
    await expect(page.getByText(TEST_WORKER.email)).toBeVisible();
  });

  test('should show worker pay rate', async ({ page }) => {
    await workersPage.expectLoaded();
    await expect(page.getByText(`$${TEST_WORKER.payRate}`)).toBeVisible();
  });

  test('should show worker charge-out rate', async ({ page }) => {
    await workersPage.expectLoaded();
    await expect(page.getByText(`$${TEST_WORKER.chargeOutRate}`)).toBeVisible();
  });

  test('should open invite worker modal', async ({ page }) => {
    await workersPage.openInviteModal();
    await expect(workersPage.inviteModal).toBeVisible();
  });

  test('invite modal should have required fields', async ({ page }) => {
    await workersPage.openInviteModal();
    await expect(workersPage.payRateInput).toBeVisible();
    await expect(workersPage.chargeOutRateInput).toBeVisible();
  });

  test('should show pending invites section', async ({ page }) => {
    await workersPage.expectLoaded();
    await expect(page.getByText(/Pending Invites|No pending invites/i)).toBeVisible();
  });
});
