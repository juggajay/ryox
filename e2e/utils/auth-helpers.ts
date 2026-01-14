import { Page } from '@playwright/test';

export const TEST_OWNER = {
  email: 'e2e-owner@test.carptrack.com',
  password: 'TestPassword123!',
  name: 'E2E Test Owner',
  orgName: 'E2E Test Organization',
};

export const TEST_WORKER = {
  email: 'e2e-worker@test.carptrack.com',
  password: 'TestPassword456!',
  name: 'E2E Test Worker',
  phone: '0412345678',
  payRate: 55,
  chargeOutRate: 85,
};

export const TEST_BUILDER = {
  companyName: 'E2E Test Builder Pty Ltd',
  contactName: 'John Builder',
  contactEmail: 'john@testbuilder.com',
  contactPhone: '0498765432',
};

export const TEST_JOB = {
  name: 'E2E Test Kitchen Renovation',
  siteAddress: '123 Test Street, Sydney NSW 2000',
  jobType: 'contract' as const,
  quotedPrice: 25000,
};

export async function loginAsOwner(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await page.getByPlaceholder('you@example.com').fill(TEST_OWNER.email);
  await page.getByPlaceholder(/\u2022+/).fill(TEST_OWNER.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/dashboard');
}

export async function loginAsWorker(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await page.getByPlaceholder('you@example.com').fill(TEST_WORKER.email);
  await page.getByPlaceholder(/\u2022+/).fill(TEST_WORKER.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/dashboard');
}

export async function logout(page: Page): Promise<void> {
  // Clear localStorage to log out
  await page.evaluate(() => {
    localStorage.removeItem('carptrack_user_id');
  });
  await page.goto('/');
}
