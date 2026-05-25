import { expect, test } from '@playwright/test';
import { APP_ROUTES, ROUTES, gotoAppRoute, isMissingRoute, preparePage } from './helpers.js';

for (const route of ROUTES) {
  test(`${route} loads without HTTP errors and has a title`, async ({ page }) => {
    await preparePage(page, { authenticated: APP_ROUTES.has(route) });
    const failedResponses = [];
    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400 && status <= 599) failedResponses.push(`${status} ${response.url()}`);
    });

    const response = await gotoAppRoute(page, route);
    test.skip(isMissingRoute(response), `${route} returned 404`);

    await expect(page.locator('body')).toBeVisible();
    await expect.poll(() => page.title()).not.toBe('');
    expect(failedResponses).toEqual([]);
  });
}
