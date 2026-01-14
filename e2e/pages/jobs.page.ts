import { Page, Locator, expect } from '@playwright/test';

export class JobsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createJobButton: Locator;
  readonly jobsList: Locator;
  readonly statusFilter: Locator;
  readonly builderFilter: Locator;

  // Create job modal
  readonly modal: Locator;
  readonly jobNameInput: Locator;
  readonly builderSelect: Locator;
  readonly siteAddressInput: Locator;
  readonly jobTypeSelect: Locator;
  readonly quotedPriceInput: Locator;
  readonly startDateInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Jobs' });
    // Use first() since there may be multiple buttons (header + empty state)
    this.createJobButton = page.getByRole('button', { name: /Create Job|New Job/i }).first();
    this.jobsList = page.locator('[data-testid="jobs-list"]');
    this.statusFilter = page.getByRole('combobox', { name: /status/i });
    this.builderFilter = page.getByRole('combobox', { name: /builder/i });

    // Modal - find by heading since there's no role="dialog"
    this.modal = page.locator('div').filter({ has: page.getByRole('heading', { name: /Create Job|New Job/i, level: 2 }) });
    this.jobNameInput = page.getByPlaceholder(/Job name|Kitchen Renovation/i);
    this.builderSelect = page.locator('select').first();
    this.siteAddressInput = page.getByPlaceholder(/address|123 Main St/i);
    this.jobTypeSelect = page.locator('select').nth(1);
    this.quotedPriceInput = page.locator('input[type="number"]').first();
    this.startDateInput = page.locator('input[type="date"]').first();
    this.submitButton = page.getByRole('button', { name: /Create Job|Save/i });
    this.cancelButton = page.getByRole('button', { name: /Cancel/i });
  }

  async goto() {
    await this.page.goto('/jobs');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async openCreateJobModal() {
    await this.createJobButton.click();
    // Wait for modal heading to appear
    await expect(this.page.getByRole('heading', { name: /Create Job|New Job/i, level: 2 })).toBeVisible();
  }

  async expectJobInList(jobName: string) {
    await expect(this.page.getByText(jobName)).toBeVisible();
  }

  async clickJob(jobName: string) {
    await this.page.getByText(jobName).click();
  }
}
