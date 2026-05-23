import { expect, test } from '@playwright/test';
import { APP_ROUTES, CONSOLE_ROUTES, gotoAppRoute, isMissingRoute, preparePage } from './helpers.js';

for (const route of CONSOLE_ROUTES) {
  test(`${route} has no console errors or page errors`, async ({ page }) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await preparePage(page, { authenticated: APP_ROUTES.has(route) });
    const response = await gotoAppRoute(page, route);
    test.skip(isMissingRoute(response), `${route} returned 404`);

    expect(errors).toEqual([]);
  });
}
