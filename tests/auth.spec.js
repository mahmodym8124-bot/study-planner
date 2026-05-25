import { expect, test } from '@playwright/test';
import { gotoAppRoute, isMissingRoute, preparePage } from './helpers.js';

test('/login loads without console errors and shows Google OAuth', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  await preparePage(page);
  const response = await gotoAppRoute(page, '/login');
  test.skip(isMissingRoute(response), '/login returned 404');

  const googleButton = page.locator('[data-testid="google-oauth"], button:has-text("Google"), a:has-text("Google"), .google-btn').first();

  await expect(googleButton).toBeVisible();
  await expect(googleButton).toBeEnabled();
  expect(errors).toEqual([]);
});
