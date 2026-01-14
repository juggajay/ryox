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
    // Use first() since there may be multiple buttons (header + empty state)
    this.addBuilderButton = page.getByRole('button', { name: /Add Builder|New Builder/i }).first();
    this.buildersList = page.locator('[data-testid="builders-list"]');

    // Modal - find by heading since there's no role="dialog"
    this.modal = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Add Builder', level: 2 }) });
    this.companyNameInput = page.getByPlaceholder('ABC Builders Pty Ltd');
    this.abnInput = page.getByPlaceholder('12 345 678 901');
    this.paymentTermsInput = page.locator('select').first(); // Payment terms is a select
    this.contactNameInput = page.getByPlaceholder('John Doe');
    this.contactEmailInput = page.getByPlaceholder('john@builder.com');
    this.contactPhoneInput = page.getByPlaceholder('0400 123 456');
    this.contactRoleInput = page.getByPlaceholder('Project Manager');
    // The submit button in the modal has the same text as the page button, use last()
    this.submitButton = page.getByRole('button', { name: 'Add Builder' }).last();
    this.cancelButton = page.getByRole('button', { name: /Cancel|Close/i });
  }

  async goto() {
    await this.page.goto('/builders');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async openAddBuilderModal() {
    await this.addBuilderButton.click();
    // Wait for modal heading to appear
    await expect(this.page.getByRole('heading', { name: 'Add Builder', level: 2 })).toBeVisible();
  }

  async expectBuilderInList(companyName: string) {
    await expect(this.page.getByText(companyName)).toBeVisible();
  }
}
