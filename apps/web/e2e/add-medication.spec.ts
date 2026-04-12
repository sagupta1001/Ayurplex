import { test, expect } from '@playwright/test';
import { buildFakeSession, SUPABASE_STORAGE_KEY } from './helpers/fake-session';
import { TEST_USER_ID, TEST_USER_EMAIL, TEST_USER_NAME } from './global-setup';

test.describe('Add medication happy path', () => {
  test('user adds Metformin, sees it on dashboard', async ({ context, page }) => {
    const session = buildFakeSession(TEST_USER_ID, TEST_USER_EMAIL, TEST_USER_NAME);

    await context.addInitScript(
      ({ key, value }: { key: string; value: string }) => {
        window.localStorage.setItem(key, value);
      },
      { key: SUPABASE_STORAGE_KEY, value: JSON.stringify(session) },
    );

    await page.goto('/');

    // If redirected to onboarding (unonboarded state), complete it inline
    if (/\/onboarding$/.test(page.url())) {
      await expect(page.getByRole('heading', { name: 'Welcome to Ayurplex' })).toBeVisible();
      const profileUpdateResponse = page.waitForResponse(
        (r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH',
      );
      await page.getByRole('button', { name: 'Continue' }).click();
      await profileUpdateResponse;
    }

    // Land on home
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByText(/hello, e2e user/i)).toBeVisible();

    // Navigate to Add Medication route via the FAB link
    await page.getByRole('link', { name: /add medication/i }).click();

    // The route renders a dialog
    await expect(page).toHaveURL(/\/add-med$/, { timeout: 10_000 });
    await expect(page.getByRole('dialog', { name: /add medication/i })).toBeVisible();

    // Step 1: name
    await page.getByLabel('Medication name').fill('Metformin');
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 2: dosage
    await expect(page.getByLabel('Amount')).toBeVisible();
    await page.getByLabel('Amount').fill('500');
    await page.getByLabel('Unit').fill('mg');
    await page.getByLabel('Form').selectOption('tablet');
    await page.getByLabel('Instructions').fill('with food');
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 3: meal relationship — select "With meal"
    // The radio input has opacity:0 and pointer-events:none; click the parent label instead
    await expect(page.getByRole('heading', { name: /when do you take it/i })).toBeVisible();
    await page.locator('label', { has: page.getByLabel('With meal') }).click();
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 4: schedule (08:00–11:00, Mon–Fri)
    await expect(page.getByLabel('Window start')).toBeVisible();
    await page.getByLabel('Window start').fill('08:00');
    await page.getByLabel('Window end').fill('11:00');
    for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      await page.getByLabel(d, { exact: true }).check();
    }
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 5: room — skip (no rooms, just click Next)
    await expect(page.getByRole('heading', { name: /preferred room/i })).toBeVisible();
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 6: dates (start today)
    await expect(page.getByLabel('Start date')).toBeVisible();
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel('Start date').fill(today);
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 7: review
    await expect(page.getByRole('heading', { name: /^review$/i })).toBeVisible();
    await expect(page.getByText('Metformin')).toBeVisible();

    // Wait for the save mutation to complete (POST to medications)
    const saveMedResponse = page.waitForResponse(
      (r) => r.url().includes('/rest/v1/medications') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /save medication/i }).click();
    await saveMedResponse;

    // Back on dashboard — medication appears
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByText('Metformin').first()).toBeVisible();
  });
});
