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
    this.inviteWorkerButton = page.getByRole('button', { name: /Invite Worker/i });
    this.workersList = page.locator('[data-testid="workers-list"]');
    this.pendingInvitesSection = page.locator('text=Pending Invites').locator('..');

    // Modal
    this.inviteModal = page.locator('[role="dialog"]');
    this.emailInput = page.getByLabel(/Email/i);
    this.payRateInput = page.getByLabel(/Pay Rate/i);
    this.chargeOutRateInput = page.getByLabel(/Charge.*Rate/i);
    this.tradeSelect = page.getByLabel(/Trade/i);
    this.employmentTypeSelect = page.getByLabel(/Employment Type/i);
    this.generateInviteButton = this.inviteModal.getByRole('button', { name: /Generate|Create|Invite/i });
    this.inviteLinkDisplay = page.locator('[data-testid="invite-link"]');
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
    await expect(this.inviteModal).toBeVisible();
  }

  async expectWorkerInList(workerName: string) {
    await expect(this.page.getByText(workerName)).toBeVisible();
  }
}
