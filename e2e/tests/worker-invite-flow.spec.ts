import { test, expect } from '@playwright/test';
import { WorkersPage } from '../pages/workers.page';
import { loginAsOwner, logout, TEST_OWNER } from '../utils/auth-helpers';

test.describe('Worker Invite Flow', () => {
  test('complete invite flow: owner creates invite, worker accepts', async ({ page }) => {
    // Step 1: Owner logs in and creates invite
    await loginAsOwner(page);
    await page.goto('/workers');

    const workersPage = new WorkersPage(page);
    await workersPage.expectLoaded();

    // Open invite modal
    await workersPage.inviteWorkerButton.click();
    await expect(page.locator('.fixed.inset-0.z-50')).toBeVisible();

    // Fill invite form with unique email to avoid conflicts
    const uniqueEmail = `new-worker-${Date.now()}@test.carptrack.com`;

    // Fill in the form
    const emailField = page.getByPlaceholder('worker@example.com');
    if (await emailField.isVisible()) {
      await emailField.fill(uniqueEmail);
    }

    await page.getByPlaceholder('45.00').fill('60');
    await page.getByPlaceholder('75.00').fill('90');

    // Select employment type (default is employee)
    const employmentSelect = page.locator('select').filter({ hasText: /Employee|Subcontractor/ }).first();
    if (await employmentSelect.isVisible()) {
      await employmentSelect.selectOption('employee');
    }

    // Select trade classification (default is qualified)
    const tradeSelect = page.locator('select').filter({ hasText: /Apprentice|Qualified|Leading Hand|Foreman/ }).first();
    if (await tradeSelect.isVisible()) {
      await tradeSelect.selectOption('qualified');
    }

    // Generate invite
    await page.getByRole('button', { name: /Generate Invite Link/i }).click();

    // Wait for invite link to appear
    await expect(page.getByText(/Share this link/i)).toBeVisible({ timeout: 10000 });

    // Get the invite link from the modal
    const inviteLinkContainer = page.locator('.font-mono.break-all');
    await expect(inviteLinkContainer).toBeVisible();
    const inviteLink = await inviteLinkContainer.textContent();
    expect(inviteLink).toBeTruthy();
    expect(inviteLink).toContain('/invite/');

    // Extract the token from the link
    const tokenMatch = inviteLink?.match(/\/invite\/([a-zA-Z0-9]+)/);
    expect(tokenMatch).toBeTruthy();
    const token = tokenMatch![1];

    // Close modal and logout owner
    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);

    // Step 2: Worker visits invite link
    await page.goto(`/invite/${token}`);

    // Should see invite page with org name
    await expect(page.getByText(TEST_OWNER.orgName)).toBeVisible({ timeout: 10000 });

    // Fill worker profile form
    await page.locator('#name').fill('New Invited Worker');
    await page.locator('#email').fill(uniqueEmail);
    await page.locator('#phone').fill('0411111111');

    // Emergency contact
    await page.locator('#emergencyContactName').fill('Emergency Person');
    await page.locator('#emergencyContactPhone').fill('0422222222');
    await page.locator('#emergencyContactRelationship').fill('Spouse');

    // Password
    await page.locator('#password').fill('NewWorker123!');
    await page.locator('#confirmPassword').fill('NewWorker123!');

    // Accept invite by clicking Join Team button
    await page.getByRole('button', { name: /Join Team/i }).click();

    // Should be redirected to dashboard after successful registration
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Should see worker dashboard elements
    await expect(page.getByText('My Assigned Jobs')).toBeVisible({ timeout: 10000 });

    // Cleanup: logout
    await logout(page);
  });

  test('expired invite token shows error', async ({ page }) => {
    // Visit with a fake/expired token
    await page.goto('/invite/expired-fake-token-12345');

    // Should show error message - either "Invite Expired" or "Invalid"
    await expect(page.getByText(/invalid|expired/i)).toBeVisible({ timeout: 10000 });
  });

  test('already accepted invite shows appropriate message', async ({ page }) => {
    // First, create and accept an invite, then try to use the same link again
    await loginAsOwner(page);
    await page.goto('/workers');

    // Open invite modal and create invite
    await page.getByRole('button', { name: /Invite Worker/i }).click();
    await expect(page.locator('.fixed.inset-0.z-50')).toBeVisible();

    const uniqueEmail = `accepted-worker-${Date.now()}@test.carptrack.com`;

    await page.getByPlaceholder('45.00').fill('50');
    await page.getByPlaceholder('75.00').fill('80');
    await page.getByRole('button', { name: /Generate Invite Link/i }).click();

    // Get invite link
    await expect(page.getByText(/Share this link/i)).toBeVisible({ timeout: 10000 });
    const inviteLinkContainer = page.locator('.font-mono.break-all');
    const inviteLink = await inviteLinkContainer.textContent();
    const tokenMatch = inviteLink?.match(/\/invite\/([a-zA-Z0-9]+)/);
    const token = tokenMatch![1];

    // Close modal and logout
    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);

    // First acceptance - worker accepts the invite
    await page.goto(`/invite/${token}`);
    await expect(page.getByText(TEST_OWNER.orgName)).toBeVisible({ timeout: 10000 });

    await page.locator('#name').fill('Accepted Worker');
    await page.locator('#email').fill(uniqueEmail);
    await page.locator('#phone').fill('0433333333');
    await page.locator('#emergencyContactName').fill('Emergency');
    await page.locator('#emergencyContactPhone').fill('0444444444');
    await page.locator('#emergencyContactRelationship').fill('Parent');
    await page.locator('#password').fill('AcceptedWorker123!');
    await page.locator('#confirmPassword').fill('AcceptedWorker123!');
    await page.getByRole('button', { name: /Join Team/i }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    await logout(page);

    // Try to use the same link again - should show "already used" message
    await page.goto(`/invite/${token}`);
    await expect(page.getByText(/already.*used|already.*accepted/i)).toBeVisible({ timeout: 10000 });
  });

  test('invite page shows organization name and trade classification', async ({ page }) => {
    // Create a valid invite via owner
    await loginAsOwner(page);
    await page.goto('/workers');

    await page.getByRole('button', { name: /Invite Worker/i }).click();
    await expect(page.locator('.fixed.inset-0.z-50')).toBeVisible();

    await page.getByPlaceholder('45.00').fill('55');
    await page.getByPlaceholder('75.00').fill('85');

    // Select specific trade classification to verify it shows correctly
    const tradeSelect = page.locator('select').nth(1); // Trade classification is second select
    await tradeSelect.selectOption('leadingHand');

    await page.getByRole('button', { name: /Generate Invite Link/i }).click();

    await expect(page.getByText(/Share this link/i)).toBeVisible({ timeout: 10000 });
    const inviteLinkContainer = page.locator('.font-mono.break-all');
    const inviteLink = await inviteLinkContainer.textContent();
    const tokenMatch = inviteLink?.match(/\/invite\/([a-zA-Z0-9]+)/);
    const token = tokenMatch![1];

    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);

    // Visit invite page
    await page.goto(`/invite/${token}`);

    // Should show organization name
    await expect(page.getByText(TEST_OWNER.orgName)).toBeVisible({ timeout: 10000 });

    // Should show trade classification
    await expect(page.getByText(/Leading Hand/i)).toBeVisible();
  });

  test('owner can see pending invites on workers page', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/workers');

    // Create an invite
    await page.getByRole('button', { name: /Invite Worker/i }).click();
    await expect(page.locator('.fixed.inset-0.z-50')).toBeVisible();

    const pendingEmail = `pending-${Date.now()}@test.carptrack.com`;
    await page.getByPlaceholder('worker@example.com').fill(pendingEmail);
    await page.getByPlaceholder('45.00').fill('45');
    await page.getByPlaceholder('75.00').fill('75');
    await page.getByRole('button', { name: /Generate Invite Link/i }).click();

    await expect(page.getByText(/Share this link/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Done' }).click();

    // Verify pending invite appears in the Pending Invites section
    await expect(page.getByText('Pending Invites')).toBeVisible();
    await expect(page.getByText(pendingEmail)).toBeVisible();

    await logout(page);
  });

  test('password validation on invite acceptance', async ({ page }) => {
    // Create an invite
    await loginAsOwner(page);
    await page.goto('/workers');

    await page.getByRole('button', { name: /Invite Worker/i }).click();
    await page.getByPlaceholder('45.00').fill('50');
    await page.getByPlaceholder('75.00').fill('80');
    await page.getByRole('button', { name: /Generate Invite Link/i }).click();

    await expect(page.getByText(/Share this link/i)).toBeVisible({ timeout: 10000 });
    const inviteLinkContainer = page.locator('.font-mono.break-all');
    const inviteLink = await inviteLinkContainer.textContent();
    const tokenMatch = inviteLink?.match(/\/invite\/([a-zA-Z0-9]+)/);
    const token = tokenMatch![1];

    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);

    // Visit invite page
    await page.goto(`/invite/${token}`);
    await expect(page.getByText(TEST_OWNER.orgName)).toBeVisible({ timeout: 10000 });

    // Fill form with mismatched passwords
    const uniqueEmail = `password-test-${Date.now()}@test.carptrack.com`;
    await page.locator('#name').fill('Password Test Worker');
    await page.locator('#email').fill(uniqueEmail);
    await page.locator('#phone').fill('0455555555');
    await page.locator('#emergencyContactName').fill('Emergency');
    await page.locator('#emergencyContactPhone').fill('0466666666');
    await page.locator('#emergencyContactRelationship').fill('Sibling');
    await page.locator('#password').fill('Password123!');
    await page.locator('#confirmPassword').fill('DifferentPassword123!');

    await page.getByRole('button', { name: /Join Team/i }).click();

    // Should show password mismatch error
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});
