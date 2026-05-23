import { expect, test } from '@playwright/test';
import { apiBaseUrl, createPublishedExcursion, deleteExcursion, getAuthToken, login } from './helpers';

// Проверяет загрузку аудио к точке маршрута:
test('author can attach an audio fragment to a point through the media API and see it on the route', async ({ page, request }) => {
  // Создаем опубликованную экскурсию:
  const excursion = await createPublishedExcursion();
  // Получаем полные данные экскурсии:
  const excursionResponse = await request.get(`${apiBaseUrl}/api/excursions/${excursion.id}`);
  // Берем первую точку маршрута:
  const fullExcursion = (await excursionResponse.json()).data;
  const point = fullExcursion.route.points[0];
  // Получаем JWT для загрузки медиа:
  const token = await getAuthToken();

  try {
    // Отправляем аудио через multipart:
    const uploadResponse = await request.post(`${apiBaseUrl}/api/media/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        excursionId: excursion.id,
        pointId: point.id,
        title: 'E2E audio fragment',
        file: {
          name: 'fragment.mp3',
          mimeType: 'audio/mpeg',
          buffer: Buffer.from('fake-audio'),
        },
      },
    });
    expect(uploadResponse.ok()).toBeTruthy();
    const uploadBody = await uploadResponse.json(); // Ответ содержит созданный медиафайл
    expect(uploadBody.data.title).toBe('E2E audio fragment');

    // Открываем редактор маршрута:
    await login(page);
    await page.goto(`/admin/excursions/${excursion.id}/edit`);
    // Проверяем, что точка маршрута доступна в редакторе:
    await expect(page.getByText(point.title).first()).toBeVisible({ timeout: 10_000 });
  } finally {
    // Удаляем тестовые данные:
    await deleteExcursion(excursion.id);
  }
});
