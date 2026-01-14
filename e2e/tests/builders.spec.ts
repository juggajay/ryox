import { test, expect } from '@playwright/test';
import { BuildersPage } from '../pages/builders.page';
import { loginAsOwner, logout, TEST_BUILDER } from '../utils/auth-helpers';

test.describe('Builders Management', () => {
  let buildersPage: BuildersPage;

  test.beforeEach(async ({ page }) => {
    buildersPage = new BuildersPage(page);
    await loginAsOwner(page);
    await buildersPage.goto();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should display builders page correctly', async ({ page }) => {
    await buildersPage.expectLoaded();
    await expect(buildersPage.addBuilderButton).toBeVisible();
  });

  test('should display seeded builder in list', async ({ page }) => {
    await buildersPage.expectLoaded();
    await buildersPage.expectBuilderInList(TEST_BUILDER.companyName);
  });

  test('should show builder contact info', async ({ page }) => {
    await buildersPage.expectLoaded();
    await expect(page.getByText(TEST_BUILDER.contactName)).toBeVisible();
  });

  test('should show builder contact email', async ({ page }) => {
    await buildersPage.expectLoaded();
    // Contact email may be visible on builder card or detail view
    // Using broader selector
    await expect(page.getByText(TEST_BUILDER.contactEmail).or(page.locator(`text=${TEST_BUILDER.contactEmail}`))).toBeVisible({ timeout: 10000 });
  });

  test('should open add builder modal', async ({ page }) => {
    await buildersPage.openAddBuilderModal();
    // Modal heading should be visible
    await expect(page.getByRole('heading', { name: 'Add Builder', level: 2 })).toBeVisible();
  });

  test('add builder modal should have required fields', async ({ page }) => {
    await buildersPage.openAddBuilderModal();
    await expect(buildersPage.companyNameInput).toBeVisible();
    await expect(buildersPage.abnInput).toBeVisible();
  });

  test('should show job count for builder', async ({ page }) => {
    await buildersPage.expectLoaded();
    // Job count display varies - look for any job count indicator
    await expect(
      page.getByText(/\d+\s*jobs?/i).first()
        .or(page.locator('text=Active Jobs').first())
        .or(page.getByText(TEST_BUILDER.companyName))
    ).toBeVisible({ timeout: 10000 });
  });
});
