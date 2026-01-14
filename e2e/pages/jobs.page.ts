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
    this.createJobButton = page.getByRole('button', { name: /Create Job|New Job/i });
    this.jobsList = page.locator('[data-testid="jobs-list"]');
    this.statusFilter = page.getByRole('combobox', { name: /status/i });
    this.builderFilter = page.getByRole('combobox', { name: /builder/i });

    // Modal elements
    this.modal = page.locator('[role="dialog"]');
    this.jobNameInput = page.getByLabel(/Job Name/i);
    this.builderSelect = page.getByLabel(/Builder|Client/i);
    this.siteAddressInput = page.getByLabel(/Site Address/i);
    this.jobTypeSelect = page.getByLabel(/Job Type/i);
    this.quotedPriceInput = page.getByLabel(/Quoted Price/i);
    this.startDateInput = page.getByLabel(/Start Date/i);
    this.submitButton = this.modal.getByRole('button', { name: /Create|Save/i });
    this.cancelButton = this.modal.getByRole('button', { name: /Cancel/i });
  }

  async goto() {
    await this.page.goto('/jobs');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async openCreateJobModal() {
    await this.createJobButton.click();
    await expect(this.modal).toBeVisible();
  }

  async expectJobInList(jobName: string) {
    await expect(this.page.getByText(jobName)).toBeVisible();
  }

  async clickJob(jobName: string) {
    await this.page.getByText(jobName).click();
  }
}
