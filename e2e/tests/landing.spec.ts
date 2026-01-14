import { test, expect } from '@playwright/test';
import { LandingPage } from '../pages/landing.page';

test.describe('Landing Page', () => {
  let landingPage: LandingPage;

  test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
  });

  test('should display Ryox logo and sign in button', async ({ page }) => {
    await landingPage.goto();
    await landingPage.expectLoaded();

    // Check for brand elements
    await expect(page.locator('img[alt*="Ryox"]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });

  test('should navigate to sign in page when clicking sign in', async ({ page }) => {
    await landingPage.goto();
    await landingPage.clickSignIn();

    await expect(page).toHaveURL('/sign-in');
  });

  test('should have dark theme styling', async ({ page }) => {
    await landingPage.goto();

    // Verify dark background
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    // Should be dark (low RGB values)
    expect(bgColor).toMatch(/rgb\(\s*\d{1,2}\s*,\s*\d{1,2}\s*,\s*\d{1,2}\s*\)/);
  });
});
