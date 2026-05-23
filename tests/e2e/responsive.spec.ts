import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers';

// Набор размеров экрана для адаптивной проверки:
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
];

// Для каждого размера запускается отдельный тест:
for (const viewport of viewports) {
  test(`public site is responsive on ${viewport.name}`, async ({ page }) => {
    // Устанавливаем размер окна браузера:
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // Открываем опубликованный сайт:
    await page.goto('/s/maxim-furzikov');
    // Проверяем, что страница загрузилась:
    await expect(page.locator('body')).toBeVisible();
    // Проверяем отсутствие горизонтального переполнения:
    await expectNoHorizontalOverflow(page);
  });
}
