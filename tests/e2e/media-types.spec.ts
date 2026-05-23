import { APIRequestContext, expect, test } from '@playwright/test';
import { apiBaseUrl, createPublishedExcursion, deleteExcursion, getAuthToken } from './helpers';

// Загружает файл в точку:
async function uploadMedia(request: APIRequestContext, token: string, excursionId: string, pointId: string, name: string, mimeType: string, buffer: Buffer) {
  // Отправляем multipart:
  const response = await request.post(`${apiBaseUrl}/api/media/upload`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      excursionId,
      pointId,
      title: name,
      file: { name, mimeType, buffer },
    },
  });
  // Загрузка должна пройти:
  expect(response.ok()).toBeTruthy();
  // Возвращаем тело ответа:
  return (await response.json()).data;
}

// Проверяет медиа разных типов:
test('media: image, audio and video files can be attached to a point', async ({ request }) => {
  // Создаем экскурсию:
  const excursion = await createPublishedExcursion();
  // Получаем токен:
  const token = await getAuthToken();
  // Загружаем полные данные:
  const excursionResponse = await request.get(`${apiBaseUrl}/api/excursions/${excursion.id}`);
  // Читаем JSON:
  const fullExcursion = (await excursionResponse.json()).data;
  // Берем первую точку:
  const point = fullExcursion.route.points[0];

  try {
    // Загружаем изображение:
    const image = await uploadMedia(request, token, excursion.id, point.id, 'test-image.png', 'image/png', Buffer.from([137, 80, 78, 71]));
    // Загружаем аудио:
    const audio = await uploadMedia(request, token, excursion.id, point.id, 'test-audio.mp3', 'audio/mpeg', Buffer.from('fake-audio'));
    // Загружаем видео:
    const video = await uploadMedia(request, token, excursion.id, point.id, 'test-video.mp4', 'video/mp4', Buffer.from('fake-video'));

    // Проверяем тип изображения:
    expect(image.type).toBe('image');
    // Проверяем тип аудио:
    expect(audio.type).toBe('audio');
    // Проверяем тип видео:
    expect(video.type).toBe('video');
  } finally {
    // Удаляем экскурсию:
    await deleteExcursion(excursion.id);
  }
});
