import { Page, Locator, expect } from '@playwright/test';

export class WorkersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly inviteWorkerButton: Locator;
  readonly workersList: Locator;
  readonly pendingInvitesSection: Locator;

  // Invite modal
  readonly inviteModal: Locator;
  readonly emailInput: Locator;
  readonly payRateInput: Locator;
  readonly chargeOutRateInput: Locator;
  readonly tradeSelect: Locator;
  readonly employmentTypeSelect: Locator;
  readonly generateInviteButton: Locator;
  readonly inviteLinkDisplay: Locator;
  readonly copyLinkButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Workers' });
    // Use first() since there might be multiple invite buttons (header + empty state)
    this.inviteWorkerButton = page.getByRole('button', { name: /Invite Worker/i }).first();
    this.workersList = page.locator('[data-testid="workers-list"]');
    this.pendingInvitesSection = page.locator('text=Pending Invites').locator('..');

    // Modal - find by heading since there's no role="dialog"
    this.inviteModal = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Invite Worker', level: 2 }) });
    this.emailInput = page.getByPlaceholder('worker@example.com');
    this.payRateInput = page.locator('input[type="number"]').first();
    this.chargeOutRateInput = page.locator('input[type="number"]').nth(1);
    this.tradeSelect = page.locator('select').nth(1);
    this.employmentTypeSelect = page.locator('select').first();
    this.generateInviteButton = page.getByRole('button', { name: /Generate Invite Link/i });
    this.inviteLinkDisplay = page.locator('.font-mono.break-all');
    this.copyLinkButton = page.getByRole('button', { name: /Copy/i });
  }

  async goto() {
    await this.page.goto('/workers');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async openInviteModal() {
    await this.inviteWorkerButton.click();
    // Wait for the modal heading to appear
    await expect(this.page.getByRole('heading', { name: 'Invite Worker', level: 2 })).toBeVisible();
  }

  async expectWorkerInList(workerName: string) {
    await expect(this.page.getByText(workerName)).toBeVisible();
  }
}
