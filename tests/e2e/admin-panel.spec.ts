import { expect, type Page, test } from '@playwright/test';

async function loginAdmin(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@example.test');
  await page.locator('input[type="password"]').fill('TestAdmin-Only-4219!');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin\/system/);
}

test('admin panel shows system navigation and opens test details modal', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('/admin/system/monitoring');

  await expect(page.locator('.admin-layout.admin-theme')).toBeVisible();
  await expect(page.locator('.nav-item')).toHaveCount(3);
  await expect(page.locator('.nav-item[href="/admin/system/monitoring"]')).toBeVisible();
  await expect(page.locator('.nav-item[href="/admin/system/users"]')).toBeVisible();
  await expect(page.locator('.nav-item[href="/admin/system/moderation"]')).toBeVisible();
  await expect(page.locator('.nav-item[href="/admin/excursions"]')).toHaveCount(0);

  await page.locator('.test-toggle').first().click();
  await expect(page.locator('.modal')).toBeVisible();
  await expect(page.locator('.test-detail-list')).toBeVisible();
  await expect(page.locator('.test-status').first()).toContainText('OK');
});

test('admin panel filters users and moderation lists', async ({ page }) => {
  await loginAdmin(page);

  await page.goto('/admin/system/users');
  await page.locator('.admin-filters input').fill('admin@example.test');
  await expect(page.locator('.admin-table')).toContainText('admin@example.test');
  await page.locator('.admin-filters select').selectOption('admin');
  await expect(page.locator('.role-pill.admin').first()).toBeVisible();

  await page.goto('/admin/system/moderation');
  await page.locator('.admin-filters input').fill('maxim');
  await page.locator('.admin-filters select').selectOption('all');
  await expect(page.locator('.moderation-grid')).toBeVisible();
  await expect(page.locator('.moderation-action.action-open').first()).toBeVisible();
});
