import { expect, test } from '@playwright/test';
import { createPublishedExcursion, deleteExcursion, expectNoHorizontalOverflow } from './helpers';

// Проверяет плеер при разрешенной геолокации:
test('player opens with allowed geolocation and shows the route', async ({ browser }) => {
  // Создаем экскурсию для прохождения:
  const excursion = await createPublishedExcursion();
  // Создаем контекст с разрешенной геолокацией:
  const context = await browser.newContext({
    geolocation: { latitude: 59.934, longitude: 30.306 },
    permissions: ['geolocation'],
  });
  // Открываем страницу в созданном контексте:
  const page = await context.newPage();

  try {
    // Переходим в плеер экскурсии:
    await page.goto(`/player/${excursion.id}`);
    // Проверяем название экскурсии:
    await expect(page.getByText(excursion.title).first()).toBeVisible();
    // Проверяем наличие карты:
    await expect(page.locator('.leaflet-container')).toBeVisible();
    // Проверяем карточку точки:
    await expect(page.getByText(/Start|До следующей точки|Следующая/i).first()).toBeVisible();
    // Проверяем отсутствие горизонтального скролла:
    await expectNoHorizontalOverflow(page);
  } finally {
    // Закрываем контекст:
    await context.close();
    // Удаляем тестовую экскурсию:
    await deleteExcursion(excursion.id);
  }
});

// Проверяет плеер при отказе в геолокации:
test('player handles geolocation denial without breaking the route', async ({ browser }) => {
  // Создаем экскурсию для проверки отказа:
  const excursion = await createPublishedExcursion();
  // Контекст создается без разрешений:
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  // Явно очищаем возможные разрешения:
  await context.clearPermissions();

  try {
    // Плеер должен открыться даже без геолокации:
    await page.goto(`/player/${excursion.id}`);
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.getByText(excursion.title).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    // Закрываем контекст:
    await context.close();
    // Удаляем тестовую экскурсию:
    await deleteExcursion(excursion.id);
  }
});

// Проверяет мобильный режим прохождения:
test('player works on mobile viewport', async ({ page }) => {
  // Создаем экскурсию:
  const excursion = await createPublishedExcursion();
  // Ставим мобильный размер:
  await page.setViewportSize({ width: 390, height: 844 });

  try {
    // Открываем плеер:
    await page.goto(`/player/${excursion.id}`);
    // Карта должна быть видна:
    await expect(page.locator('.leaflet-container')).toBeVisible();
    // Панель точки должна быть видна:
    await expect(page.getByText(excursion.title).first()).toBeVisible();
    // Показатели маршрута должны быть рассчитаны:
    await expect(page.getByText(/0\.0 км/)).toHaveCount(0);
    // Переходим к первой точке:
    await page.getByRole('button', { name: 'Начать с первой точки' }).click();
    // Длинное описание открывается отдельно:
    await page.getByRole('button', { name: 'Читать полностью' }).click();
    await expect(page.locator('.point-text-dialog')).toBeVisible();
    await page.locator('.point-text-close').click();
    // Переходим к завершению маршрута:
    await page.getByRole('button', { name: /Следующая/ }).click();
    await page.getByRole('button', { name: /Следующая/ }).click();
    await page.getByRole('button', { name: 'Завершить' }).click();
    await expect(page.getByText('Маршрут пройден')).toBeVisible();
    // Горизонтального скролла быть не должно:
    await expectNoHorizontalOverflow(page);
  } finally {
    // Удаляем экскурсию:
    await deleteExcursion(excursion.id);
  }
});
