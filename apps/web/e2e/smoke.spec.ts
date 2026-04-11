import { test, expect } from '@playwright/test';

test('unauthenticated users see sign-in page heading', async ({ page }) => {
  await page.goto('/');
  const heading = page.getByRole('heading', { level: 1, name: 'Ayurplex' });
  await expect(heading).toBeVisible();
});
