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

    // Nav links
    this.dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    this.jobsLink = page.getByRole('link', { name: 'Jobs' });
    this.workersLink = page.getByRole('link', { name: 'Workers' });
    this.buildersLink = page.getByRole('link', { name: 'Builders' });
    this.timesheetsLink = page.getByRole('link', { name: 'Timesheets' });
    this.chatLink = page.getByRole('link', { name: 'Chat' });
    this.settingsLink = page.getByRole('link', { name: 'Settings' });
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async expectLoaded() {
    await expect(this.sidebar).toBeVisible();
    await expect(this.heading).toBeVisible();
  }

  async expectOwnerDashboard() {
    await expect(this.page.getByText('Active Jobs')).toBeVisible();
    await expect(this.page.getByText('Active Workers')).toBeVisible();
    await expect(this.jobsLink).toBeVisible();
    await expect(this.workersLink).toBeVisible();
    await expect(this.buildersLink).toBeVisible();
  }

  async expectWorkerDashboard() {
    await expect(this.page.getByText('My Assigned Jobs')).toBeVisible();
    await expect(this.chatLink).toBeVisible();
    // Workers should NOT see certain links
    await expect(this.workersLink).not.toBeVisible();
    await expect(this.buildersLink).not.toBeVisible();
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
