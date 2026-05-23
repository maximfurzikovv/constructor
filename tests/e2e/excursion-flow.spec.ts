import { expect, test } from '@playwright/test';
import { apiBaseUrl, deleteExcursion, expectNoHorizontalOverflow, getAuthToken, login } from './helpers';

// Проверяет путь от создания экскурсии до публикации:
test('excursion flow: author creates route, publishes it and opens player', async ({ page, request }) => {
  // Получаем токен:
  const token = await getAuthToken();
  // Создаем экскурсию:
  const createResponse = await request.post(`${apiBaseUrl}/api/excursions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: `E2E full route ${Date.now()}`,
      description: 'Full route scenario',
      city: 'Saint Petersburg',
    },
  });
  // Создание должно пройти:
  expect(createResponse.ok()).toBeTruthy();
  // Читаем экскурсию:
  const excursion = (await createResponse.json()).data;

  try {
    // Добавляем точки маршрута:
    const pointsResponse = await request.put(`${apiBaseUrl}/api/points/route/${excursion.route.id}/sync`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        points: [
          { title: 'Point 1', description: 'Start point', lat: 59.934, lng: 30.306, duration: 3, radius: 50 },
          { title: 'Point 2', description: 'Finish point', lat: 59.936, lng: 30.31, duration: 4, radius: 50 },
        ],
      },
    });
    // Точки должны сохраниться:
    expect(pointsResponse.ok()).toBeTruthy();
    // Публикуем экскурсию:
    const publishResponse = await request.put(`${apiBaseUrl}/api/excursions/${excursion.id}/publish`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Публикация должна пройти:
    expect(publishResponse.ok()).toBeTruthy();

    // Входим в интерфейс:
    await login(page);
    // Открываем редактор:
    await page.goto(`/admin/excursions/${excursion.id}/edit`);
    // Проверяем страницу редактора:
    await expect(page.getByText(excursion.title).first()).toBeVisible();
    // Открываем плеер:
    await page.goto(`/player/${excursion.id}`);
    // Проверяем публичный маршрут:
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.getByText(excursion.title).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    // Удаляем тестовую экскурсию:
    await deleteExcursion(excursion.id);
  }
});
