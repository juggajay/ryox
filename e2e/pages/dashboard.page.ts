import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly sidebar: Locator;
  readonly orgName: Locator;
  readonly userName: Locator;

  // Owner-specific elements
  readonly activeJobsCard: Locator;
  readonly activeWorkersCard: Locator;
  readonly pendingTimesheetsCard: Locator;
  readonly buildersCard: Locator;
  readonly activeJobsList: Locator;
  readonly expiringCertsSection: Locator;

  // Worker-specific elements
  readonly myJobsList: Locator;

  // Navigation links
  readonly dashboardLink: Locator;
  readonly jobsLink: Locator;
  readonly workersLink: Locator;
  readonly buildersLink: Locator;
  readonly timesheetsLink: Locator;
  readonly chatLink: Locator;
  readonly settingsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1');
    this.sidebar = page.locator('aside');
    this.orgName = page.locator('[data-testid="org-name"]');
    this.userName = page.locator('[data-testid="user-name"]');

    // Stats cards (owner)
    this.activeJobsCard = page.locator('text=Active Jobs').locator('..');
    this.activeWorkersCard = page.locator('text=Active Workers').locator('..');
    this.pendingTimesheetsCard = page.locator('text=Pending Timesheets').locator('..');
    this.buildersCard = page.locator('text=Builders').locator('..');

    // Sections
    this.activeJobsList = page.locator('text=Active Jobs').locator('..').locator('xpath=following-sibling::*');
    this.expiringCertsSection = page.locator('text=Expiring Certifications');
    this.myJobsList = page.locator('h2:has-text("My Assigned Jobs")').locator('xpath=following-sibling::*');

    // Nav links (use sidebar context to avoid duplicates)
    const nav = page.locator('aside nav');
    this.dashboardLink = nav.getByRole('link', { name: 'Dashboard' });
    this.jobsLink = nav.getByRole('link', { name: 'Jobs' });
    this.workersLink = nav.getByRole('link', { name: 'Workers', exact: true });
    this.buildersLink = nav.getByRole('link', { name: 'Builders', exact: true });
    this.timesheetsLink = nav.getByRole('link', { name: 'Timesheets' });
    this.chatLink = nav.getByRole('link', { name: 'Chat' });
    this.settingsLink = nav.getByRole('link', { name: 'Settings' });
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async expectLoaded() {
    await expect(this.sidebar).toBeVisible();
    await expect(this.heading).toBeVisible();
  }

  async expectOwnerDashboard() {
    // Use heading role to avoid duplicate matches
    await expect(this.page.getByRole('heading', { name: 'Active Jobs' })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Active Workers' }).or(this.page.locator('text=Active Workers').first())).toBeVisible();
    await expect(this.jobsLink).toBeVisible();
    await expect(this.workersLink).toBeVisible();
    await expect(this.buildersLink).toBeVisible();
  }

  async expectWorkerDashboard() {
    // Workers see their jobs section - text may vary
    await expect(
      this.page.getByRole('heading', { name: /My.*Jobs|Assigned.*Jobs|Your.*Jobs/i })
        .or(this.page.locator('h2').filter({ hasText: /Jobs/i }))
        .or(this.page.getByText(/My Jobs|Assigned Jobs|Your Jobs/i).first())
    ).toBeVisible({ timeout: 10000 });

    // Workers should have Chat link visible
    await expect(this.chatLink).toBeVisible();
    // Workers should NOT see owner-only links in sidebar
    await expect(this.workersLink).not.toBeVisible({ timeout: 5000 });
    await expect(this.buildersLink).not.toBeVisible({ timeout: 5000 });
  }

  async navigateToJobs() {
    await this.jobsLink.click();
    await this.page.waitForURL('/jobs');
  }

  async navigateToWorkers() {
    await this.workersLink.click();
    await this.page.waitForURL('/workers');
  }

  async navigateToBuilders() {
    await this.buildersLink.click();
    await this.page.waitForURL('/builders');
  }
}
