import { expect, test } from '@playwright/test';
import { gotoAppRoute, isMissingRoute, preparePage, visibleSearchInput } from './helpers.js';

test('/notes note editor accepts title and body input without saving', async ({ page }) => {
  await preparePage(page, { authenticated: true });
  const response = await gotoAppRoute(page, '/notes');
  test.skip(isMissingRoute(response), '/notes returned 404');

  await page.locator('#new-note').click();
  const titleInput = page.locator('#modal-note-title, input[name="title"]').first();
  const bodyInput = page.locator('#modal-note-content, textarea[name="content"]').first();

  await titleInput.fill('E2E note title');
  await bodyInput.fill('E2E note body');

  await expect(titleInput).toHaveValue('E2E note title');
  await expect(bodyInput).toHaveValue('E2E note body');
  await expect(page.locator('[data-save]').first()).toBeEnabled();
});

test('/ideas idea editor accepts text input without saving', async ({ page }) => {
  await preparePage(page, { authenticated: true });
  const response = await gotoAppRoute(page, '/ideas');
  test.skip(isMissingRoute(response), '/ideas returned 404');

  await page.locator('#new-idea').click();
  const firstTextField = page.locator('.modal [type="text"], .modal input:not([type]), .modal textarea').first();

  await firstTextField.fill('E2E idea draft');

  await expect(firstTextField).toHaveValue('E2E idea draft');
});

test('/search global search input accepts a query', async ({ page }) => {
  await preparePage(page, { authenticated: true });
  const response = await gotoAppRoute(page, '/search');
  test.skip(isMissingRoute(response), '/search returned 404');

  const searchInput = visibleSearchInput(page);
  await expect(searchInput).toBeVisible();
  await searchInput.fill('test query');

  await expect(searchInput).toHaveValue('test query');
});

test('/focus exposes an enabled interactive control', async ({ page }) => {
  await preparePage(page, { authenticated: true });
  const response = await gotoAppRoute(page, '/focus');
  test.skip(isMissingRoute(response), '/focus returned 404');

  const interactiveButton = page.locator('#timer-start, button').first();

  await expect(interactiveButton).toBeVisible();
  await expect(interactiveButton).toBeEnabled();
});
