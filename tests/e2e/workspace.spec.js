import { expect, test } from '@playwright/test';

test('signup, login, notes, focus, tasks, and persistence with no /api 502', async ({ page }) => {
  const runId = Date.now();
  const name = `E2E User ${runId}`;
  const email = `e2e-${runId}@example.com`;
  const password = `Pass${runId}!Aa`;
  const noteTitle = `E2E Note ${runId}`;
  const noteContent = 'Playwright note content';
  const focusText = `Focus target ${runId}`;
  const taskText = `Finish task ${runId}`;
  const badGatewayApiResponses = [];

  page.on('response', (response) => {
    if (response.url().includes('/api') && response.status() === 502) {
      badGatewayApiResponses.push(response.url());
    }
  });

  await page.goto('/#/signup');
  await page.locator('#auth-form [name="name"]').fill(name);
  await page.locator('#auth-form [name="email"]').fill(email);
  await page.locator('#auth-form [name="password"]').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/#\/app\/dashboard$/);

  await page.locator('#logout').click();
  await expect(page).toHaveURL(/#\/$/);

  await page.goto('/#/login');
  await page.locator('#auth-form [name="email"]').fill(email);
  await page.locator('#auth-form [name="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/#\/app\/dashboard$/);

  await page.getByRole('link', { name: /notes/i }).click();
  await expect(page).toHaveURL(/#\/app\/notes$/);
  await page.locator('#new-note').click();
  const noteModal = page.locator('.modal-backdrop.open');
  await noteModal.locator('[name="title"]').fill(noteTitle);
  await noteModal.locator('[name="content"]').fill(noteContent);
  await noteModal.locator('[data-save]').click();
  await expect(page.locator('.note-card h3', { hasText: noteTitle })).toBeVisible();

  await page.getByRole('link', { name: /focus/i }).click();
  await expect(page).toHaveURL(/#\/app\/productivity$/);
  await page.locator('#focus-text').fill(focusText);
  await page.locator('#save-focus').click();
  await expect(page.locator('#focus-text')).toHaveValue(focusText);

  await page.locator('#todo-form [name="todo"]').fill(taskText);
  await page.locator('#todo-form button').click();
  const todoItem = page.locator(`.todo:has-text("${taskText}")`);
  await expect(todoItem).toBeVisible();
  await todoItem.locator('[data-toggle-todo]').click();
  await expect(page.locator(`.todo.done:has-text("${taskText}")`)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/#\/app\/productivity$/);
  await expect(page.locator('#focus-text')).toHaveValue(focusText);
  await expect(page.locator(`.todo.done:has-text("${taskText}")`)).toBeVisible();

  await page.getByRole('link', { name: /notes/i }).click();
  await expect(page.locator('.note-card h3', { hasText: noteTitle })).toBeVisible();

  expect(badGatewayApiResponses, badGatewayApiResponses.join('\n')).toEqual([]);
});
