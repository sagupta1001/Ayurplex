import { test, expect } from '@playwright/test';

test('home page shows Hello Ayurplex heading', async ({ page }) => {
  await page.goto('/');
  const heading = page.getByRole('heading', { level: 1, name: 'Hello Ayurplex' });
  await expect(heading).toBeVisible();
});
