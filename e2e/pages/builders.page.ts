import { Page, Locator, expect } from '@playwright/test';

export class BuildersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addBuilderButton: Locator;
  readonly buildersList: Locator;

  // Add builder modal
  readonly modal: Locator;
  readonly companyNameInput: Locator;
  readonly abnInput: Locator;
  readonly paymentTermsInput: Locator;
  readonly contactNameInput: Locator;
  readonly contactEmailInput: Locator;
  readonly contactPhoneInput: Locator;
  readonly contactRoleInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Builders' });
    this.addBuilderButton = page.getByRole('button', { name: /Add Builder|New Builder/i });
    this.buildersList = page.locator('[data-testid="builders-list"]');

    // Modal
    this.modal = page.locator('[role="dialog"]');
    this.companyNameInput = page.getByLabel(/Company Name/i);
    this.abnInput = page.getByLabel(/ABN/i);
    this.paymentTermsInput = page.getByLabel(/Payment Terms/i);
    this.contactNameInput = page.getByLabel(/Contact Name/i);
    this.contactEmailInput = page.getByLabel(/Contact Email/i);
    this.contactPhoneInput = page.getByLabel(/Contact Phone/i);
    this.contactRoleInput = page.getByLabel(/Role/i);
    this.submitButton = this.modal.getByRole('button', { name: /Add|Create|Save/i });
    this.cancelButton = this.modal.getByRole('button', { name: /Cancel/i });
  }

  async goto() {
    await this.page.goto('/builders');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async openAddBuilderModal() {
    await this.addBuilderButton.click();
    await expect(this.modal).toBeVisible();
  }

  async expectBuilderInList(companyName: string) {
    await expect(this.page.getByText(companyName)).toBeVisible();
  }
}
