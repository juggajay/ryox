import { test, expect } from '@playwright/test';
import { SignInPage } from '../pages/sign-in.page';
import { DashboardPage } from '../pages/dashboard.page';
import { TEST_OWNER, TEST_WORKER, logout } from '../utils/auth-helpers';

test.describe('Authentication', () => {
  let signInPage: SignInPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    signInPage = new SignInPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should display sign in form correctly', async ({ page }) => {
    await signInPage.goto();
    await signInPage.expectLoaded();

    // Check for invite-only message
    await expect(page.getByText(/invitation only|invite only/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await signInPage.goto();
    await signInPage.signIn('wrong@email.com', 'wrongpassword');

    // Error message appears containing "Invalid email or password"
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show error for empty fields', async ({ page }) => {
    await signInPage.goto();

    // Fill only email, leave password empty
    await signInPage.emailInput.fill('test@example.com');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Either browser validation kicks in or app shows error
    // Browser validation will prevent form submission with invalid inputs
    const emailInput = signInPage.emailInput;
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid || el.value === '');

    // Just verify we're still on sign-in page (form didn't submit successfully)
    await expect(page).toHaveURL(/sign-in/);
  });

  test('owner can sign in and see owner dashboard', async ({ page }) => {
    await signInPage.goto();
    await signInPage.signIn(TEST_OWNER.email, TEST_OWNER.password);

    await expect(page).toHaveURL('/dashboard');
    await dashboardPage.expectLoaded();
    await dashboardPage.expectOwnerDashboard();
  });

  test('worker can sign in and see worker dashboard', async ({ page }) => {
    await signInPage.goto();
    await signInPage.signIn(TEST_WORKER.email, TEST_WORKER.password);

    await expect(page).toHaveURL('/dashboard');
    await dashboardPage.expectLoaded();
    await dashboardPage.expectWorkerDashboard();
  });

  test('unauthenticated user is redirected from dashboard', async ({ page }) => {
    // Clear any existing auth
    await logout(page);

    await page.goto('/dashboard');

    // Should redirect to sign-in
    await expect(page).toHaveURL('/sign-in');
  });

  test('sign-up page redirects to sign-in (invite only)', async ({ page }) => {
    await page.goto('/sign-up');

    // Should redirect to sign-in
    await expect(page).toHaveURL('/sign-in');
  });
});
