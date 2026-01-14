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

    await signInPage.expectError('Invalid email or password');
  });

  test('should show error for empty fields', async ({ page }) => {
    await signInPage.goto();
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Check for validation
    await expect(page.getByText(/email.*required|enter.*email/i)).toBeVisible();
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
