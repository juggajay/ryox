import { test, expect } from '@playwright/test';
import { LandingPage } from '../pages/landing.page';
import { SignInPage } from '../pages/sign-in.page';
import { DashboardPage } from '../pages/dashboard.page';
import { JobsPage } from '../pages/jobs.page';
import { WorkersPage } from '../pages/workers.page';
import { BuildersPage } from '../pages/builders.page';
import { TEST_OWNER, TEST_WORKER, TEST_JOB, TEST_BUILDER, logout } from '../utils/auth-helpers';

test.describe('Full User Journey', () => {

  test('owner complete workflow: login -> view dashboard -> check jobs -> check workers -> check builders', async ({ page }) => {
    const landingPage = new LandingPage(page);
    const signInPage = new SignInPage(page);
    const dashboardPage = new DashboardPage(page);
    const jobsPage = new JobsPage(page);
    const workersPage = new WorkersPage(page);
    const buildersPage = new BuildersPage(page);

    // 1. Start at landing page
    await landingPage.goto();
    await landingPage.expectLoaded();

    // 2. Navigate to sign in
    await landingPage.clickSignIn();
    await signInPage.expectLoaded();

    // 3. Sign in as owner
    await signInPage.signIn(TEST_OWNER.email, TEST_OWNER.password);
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // 4. Verify dashboard loads with stats
    await dashboardPage.expectLoaded();
    await dashboardPage.expectOwnerDashboard();

    // 5. Navigate to Jobs and verify seeded data
    await dashboardPage.navigateToJobs();
    await jobsPage.expectLoaded();
    await jobsPage.expectJobInList(TEST_JOB.name);

    // 6. Navigate to Workers and verify seeded data
    await page.goto('/workers');
    await workersPage.expectLoaded();
    await workersPage.expectWorkerInList(TEST_WORKER.name);

    // 7. Navigate to Builders and verify seeded data
    await page.goto('/builders');
    await buildersPage.expectLoaded();
    await buildersPage.expectBuilderInList(TEST_BUILDER.companyName);

    // 8. Return to dashboard
    await page.goto('/dashboard');
    await dashboardPage.expectLoaded();

    // Cleanup
    await logout(page);
  });

  test('worker complete workflow: login -> view assigned jobs', async ({ page }) => {
    const landingPage = new LandingPage(page);
    const signInPage = new SignInPage(page);
    const dashboardPage = new DashboardPage(page);

    // 1. Start at landing page
    await landingPage.goto();
    await landingPage.clickSignIn();

    // 2. Sign in as worker
    await signInPage.signIn(TEST_WORKER.email, TEST_WORKER.password);
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // 3. Verify worker dashboard
    await dashboardPage.expectLoaded();
    await dashboardPage.expectWorkerDashboard();

    // 4. Verify navigation is restricted
    await expect(dashboardPage.workersLink).not.toBeVisible();
    await expect(dashboardPage.buildersLink).not.toBeVisible();

    // 5. Verify worker-specific nav is present
    await expect(dashboardPage.chatLink).toBeVisible();
    await expect(dashboardPage.timesheetsLink).toBeVisible();

    // Cleanup
    await logout(page);
  });

  test('role switching: owner logs out, worker logs in', async ({ page }) => {
    const signInPage = new SignInPage(page);
    const dashboardPage = new DashboardPage(page);

    // 1. Login as owner
    await signInPage.goto();
    await signInPage.signIn(TEST_OWNER.email, TEST_OWNER.password);
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    await dashboardPage.expectOwnerDashboard();

    // 2. Logout
    await logout(page);

    // 3. Login as worker
    await signInPage.goto();
    await signInPage.signIn(TEST_WORKER.email, TEST_WORKER.password);
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    await dashboardPage.expectWorkerDashboard();

    // Cleanup
    await logout(page);
  });

  test('navigation breadcrumb: deep link then navigate back', async ({ page }) => {
    const signInPage = new SignInPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login as owner
    await signInPage.goto();
    await signInPage.signIn(TEST_OWNER.email, TEST_OWNER.password);
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Deep link to jobs
    await page.goto('/jobs');
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();

    // Navigate back via sidebar
    await dashboardPage.dashboardLink.click();
    await expect(page).toHaveURL('/dashboard');

    // Cleanup
    await logout(page);
  });

  test('owner can access all main sections without errors', async ({ page }) => {
    const signInPage = new SignInPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login as owner
    await signInPage.goto();
    await signInPage.signIn(TEST_OWNER.email, TEST_OWNER.password);
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Navigate to each section and verify no errors
    const sections = [
      { link: dashboardPage.jobsLink, heading: 'Jobs' },
      { link: dashboardPage.workersLink, heading: 'Workers' },
      { link: dashboardPage.buildersLink, heading: 'Builders' },
      { link: dashboardPage.timesheetsLink, heading: 'Timesheets' },
      { link: dashboardPage.chatLink, heading: 'Chat' },
    ];

    for (const section of sections) {
      await section.link.click();
      await expect(page.getByRole('heading', { name: section.heading })).toBeVisible({ timeout: 5000 });
    }

    // Return to dashboard
    await dashboardPage.dashboardLink.click();
    await dashboardPage.expectLoaded();

    // Cleanup
    await logout(page);
  });

  test('unauthenticated user is redirected to sign-in when accessing protected routes', async ({ page }) => {
    // Try to access protected routes without logging in
    const protectedRoutes = ['/dashboard', '/jobs', '/workers', '/builders', '/timesheets', '/chat'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should be redirected to sign-in or landing page
      await expect(page).toHaveURL(/\/(sign-in)?$/, { timeout: 5000 });
    }
  });

  test('landing page has all expected elements', async ({ page }) => {
    const landingPage = new LandingPage(page);

    await landingPage.goto();

    // Check logo
    await expect(landingPage.logo).toBeVisible();

    // Check tagline
    await expect(landingPage.tagline).toBeVisible();

    // Check sign in button
    await expect(landingPage.signInButton).toBeVisible();
  });

  test('sign-in page shows error for invalid credentials', async ({ page }) => {
    const signInPage = new SignInPage(page);

    await signInPage.goto();
    await signInPage.expectLoaded();

    // Attempt login with invalid credentials
    await signInPage.signIn('invalid@email.com', 'wrongpassword');

    // Should show error message
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 5000 });

    // Should still be on sign-in page
    await expect(page).toHaveURL('/sign-in');
  });

  test('session persists across page navigation', async ({ page }) => {
    const signInPage = new SignInPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login
    await signInPage.goto();
    await signInPage.signIn(TEST_OWNER.email, TEST_OWNER.password);
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Navigate to multiple pages
    await dashboardPage.navigateToJobs();
    await page.goto('/workers');
    await page.goto('/builders');

    // Return to dashboard - should still be logged in
    await page.goto('/dashboard');
    await dashboardPage.expectOwnerDashboard();

    // Refresh the page - should still be logged in
    await page.reload();
    await dashboardPage.expectOwnerDashboard();

    // Cleanup
    await logout(page);
  });

  test('worker cannot access owner-only routes', async ({ page }) => {
    const signInPage = new SignInPage(page);

    // Login as worker
    await signInPage.goto();
    await signInPage.signIn(TEST_WORKER.email, TEST_WORKER.password);
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Try to access workers page (owner-only)
    await page.goto('/workers');
    // Should either redirect to dashboard or show access denied
    await expect(page).toHaveURL(/\/(dashboard|workers)/, { timeout: 5000 });

    // If on workers page, should not see full worker management
    if (page.url().includes('/workers')) {
      // Worker should not see "Invite Worker" button
      await expect(page.getByRole('button', { name: /Invite Worker/i })).not.toBeVisible();
    }

    // Cleanup
    await logout(page);
  });
});
