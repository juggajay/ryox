import { Page, Locator, expect } from '@playwright/test';

export class LandingPage {
  readonly page: Page;
  readonly logo: Locator;
  readonly tagline: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.locator('img[alt*="Ryox"]');
    this.tagline = page.getByText('Carpentry Business Management');
    this.signInButton = page.getByRole('link', { name: 'Sign In' });
  }

  async goto() {
    await this.page.goto('/');
  }

  async expectLoaded() {
    await expect(this.logo).toBeVisible();
    await expect(this.signInButton).toBeVisible();
  }

  async clickSignIn() {
    await this.signInButton.click();
    await this.page.waitForURL('/sign-in');
  }
}
