import { test, expect } from '@playwright/test';
import { JobsPage } from '../pages/jobs.page';
import { loginAsOwner, logout, TEST_JOB, TEST_BUILDER } from '../utils/auth-helpers';

test.describe('Jobs Management', () => {
  let jobsPage: JobsPage;

  test.beforeEach(async ({ page }) => {
    jobsPage = new JobsPage(page);
    await loginAsOwner(page);
    await jobsPage.goto();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should display jobs page correctly', async ({ page }) => {
    await jobsPage.expectLoaded();
    await expect(jobsPage.createJobButton).toBeVisible();
  });

  test('should display seeded job in list', async ({ page }) => {
    await jobsPage.expectLoaded();
    await jobsPage.expectJobInList(TEST_JOB.name);
  });

  test('should open create job modal', async ({ page }) => {
    await jobsPage.openCreateJobModal();
    await expect(jobsPage.modal).toBeVisible();
  });

  test('should show job details when clicking a job', async ({ page }) => {
    await jobsPage.expectLoaded();
    await page.getByText(TEST_JOB.name).first().click();
    await expect(page.getByText(TEST_JOB.siteAddress)).toBeVisible();
  });

  test('should display job type badge', async ({ page }) => {
    await jobsPage.expectLoaded();
    await expect(page.getByText(/contract|labour hire/i).first()).toBeVisible();
  });

  test('should display job status', async ({ page }) => {
    await jobsPage.expectLoaded();
    await expect(page.getByText(/active|pending|completed/i).first()).toBeVisible();
  });

  test('should show builder name on job card', async ({ page }) => {
    await jobsPage.expectLoaded();
    await expect(page.getByText(TEST_BUILDER.companyName)).toBeVisible();
  });
});
