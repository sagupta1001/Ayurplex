import { test, expect } from '@playwright/test';
import { buildFakeSession, SUPABASE_STORAGE_KEY } from './helpers/fake-session';
import { TEST_USER_ID, TEST_USER_EMAIL, TEST_USER_NAME } from './global-setup';

test('authenticated user completes onboarding and lands on home', async ({ context, page }) => {
  const session = buildFakeSession(TEST_USER_ID, TEST_USER_EMAIL, TEST_USER_NAME);

  // Prime localStorage before any app script runs
  await context.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: SUPABASE_STORAGE_KEY, value: JSON.stringify(session) },
  );

  await page.goto('/');

  // RequireOnboarded redirects unonboarded authenticated users to /onboarding
  await expect(page).toHaveURL(/\/onboarding$/);

  // WelcomeStep
  await expect(page.getByRole('heading', { name: 'Welcome to Ayurplex' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // HomeLocationStep - skip map interaction; click Skip for now
  await expect(page.getByRole('heading', { name: /set your home/i })).toBeVisible();
  await page.getByRole('button', { name: /skip for now/i }).click();

  // NotificationStep - heading differs by browser notification support
  await expect(
    page.getByRole('heading', { name: /reminders/i }),
  ).toBeVisible();

  // Wait for the profile PATCH (onboarding finish) to complete, then the app navigates to /
  const profileUpdateResponse = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH',
  );
  await page
    .getByRole('button', { name: /maybe later|continue/i })
    .first()
    .click();
  await profileUpdateResponse;

  // Home page — give extra time for the refetch + RequireOnboarded to unblock
  await expect(page).toHaveURL('http://localhost:5175/', { timeout: 15_000 });
  await expect(page.getByText(/hello, e2e user/i)).toBeVisible();
});
