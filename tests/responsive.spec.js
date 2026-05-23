import { expect, test } from '@playwright/test';
import { APP_ROUTES, gotoAppRoute, isMissingRoute, preparePage } from './helpers.js';

for (const route of ['/', '/workspace']) {
  test(`${route} has no horizontal overflow and exposes responsive navigation`, async ({ page }) => {
    await preparePage(page, { authenticated: APP_ROUTES.has(route) });
    await page.setViewportSize({ width: 1440, height: 900 });
    let response = await gotoAppRoute(page, route);
    test.skip(isMissingRoute(response), `${route} returned 404`);

    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
    await expect(page.locator('main, #root, #app, .app-container').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    response = await gotoAppRoute(page, route);
    test.skip(isMissingRoute(response), `${route} returned 404`);

    await expect(page.locator('nav, [role="navigation"], .navbar, .sidebar').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
}
