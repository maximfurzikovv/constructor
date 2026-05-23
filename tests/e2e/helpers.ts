import { expect, Page, request } from '@playwright/test';

// Порт тестового сервера можно переопределить через env:
export const serverPort = Number(process.env.TEST_SERVER_PORT || 3011);
// Базовый адрес API для E2E-тестов:
export const apiBaseUrl = `http://localhost:${serverPort}`;

// Токен автора для API-подготовки E2E-данных:
let authToken: string | null = null;

// Получает JWT для запросов из тестов:
export async function getAuthToken() {
  if (authToken) return authToken;
  const api = await request.newContext({ baseURL: apiBaseUrl });
  const response = await api.post('/api/auth/login', {
    data: { email: 'guide@example.com', password: 'password123' },
  });
  const body = await response.json().catch(() => null); // Тело ответа помогает понять ошибку входа
  expect(response.ok(), `Login failed: ${response.status()} ${JSON.stringify(body)}`).toBeTruthy();
  authToken = body.data.token;
  await api.dispose();
  return authToken;
}

// Выполняет вход в админ-панель через форму:
export async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('guide@example.com');
  await page.getByLabel(/Пароль|Password/i).fill('password123');
  await page.getByRole('button', { name: /Войти|Login/i }).click();
  await expect(page).toHaveURL(/\/admin/);
}

// Создает опубликованную экскурсию через API:
export async function createPublishedExcursion() {
  // Получаем JWT для защищенных API:
  const token = await getAuthToken();
  // Отдельный API-контекст не зависит от страницы браузера:
  const api = await request.newContext({ baseURL: apiBaseUrl, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  // Создаем экскурсию:
  const excursionResponse = await api.post('/api/excursions', {
    data: {
      title: `E2E route ${Date.now()}`,
      description: 'Route created for browser checks',
      city: 'Saint Petersburg',
    },
  });
  expect(excursionResponse.ok()).toBeTruthy();
  // Забираем тело ответа:
  const excursion = (await excursionResponse.json()).data;

  // Добавляем две точки маршрута:
  const pointsResponse = await api.put(`/api/points/route/${excursion.route.id}/sync`, {
    data: {
      points: [
        { title: 'Start', description: 'First point', lat: 59.934, lng: 30.306, duration: 2, radius: 50 },
        { title: 'Finish', description: 'Second point', lat: 59.936, lng: 30.31, duration: 2, radius: 50 },
      ],
    },
  });
  expect(pointsResponse.ok()).toBeTruthy();

  // Публикуем экскурсию для публичного плеера:
  const publishResponse = await api.put(`/api/excursions/${excursion.id}/publish`);
  expect(publishResponse.ok()).toBeTruthy();
  await api.dispose();
  return excursion;
}

// Удаляет тестовую экскурсию после проверки:
export async function deleteExcursion(id: string) {
  const token = await getAuthToken();
  const api = await request.newContext({ baseURL: apiBaseUrl, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  await api.delete(`/api/excursions/${id}`);
  await api.dispose();
}

// Проверяет, что страница не уезжает вправо:
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}
