import { APIRequestContext, expect, test } from '@playwright/test';
import { apiBaseUrl, expectNoHorizontalOverflow, getAuthToken, login } from './helpers';

// Тестовая структура конструктора:
type TestConstructorData = {
  siteSlug?: string;
  theme?: Record<string, unknown>;
  pages: unknown[];
};

// Минимальный конструктор для восстановления:
function fallbackConstructor() {
  // Возвращаем одну страницу:
  return {
    siteSlug: 'maxim-furzikov',
    theme: {},
    pages: [
      {
        id: 'page-main',
        title: 'Главная',
        slug: '',
        sections: [],
      },
    ],
  };
}

// Получает текущий конструктор:
async function getCurrentSite(request: APIRequestContext): Promise<TestConstructorData> {
  // Получаем токен:
  const token = await getAuthToken();
  // Запрашиваем данные редактора:
  const response = await request.get(`${apiBaseUrl}/api/showcase/constructor/data`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Данные должны загрузиться:
  expect(response.ok()).toBeTruthy();
  // Читаем JSON:
  const body = await response.json();
  // Если сайт еще не редактировали, восстанавливаем корректную пустую структуру:
  if (!body.data || !Array.isArray(body.data.pages)) {
    return {
      ...fallbackConstructor(),
      siteSlug: body.data?.siteSlug || 'maxim-furzikov',
    };
  }
  // Возвращаем текущую структуру:
  return body.data;
}

// Восстанавливает конструктор:
async function restoreSite(request: APIRequestContext, data: TestConstructorData) {
  // Получаем токен:
  const token = await getAuthToken();
  // Публикуем прежнее состояние:
  const response = await request.put(`${apiBaseUrl}/api/showcase/constructor`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...data,
      siteSlug: data.siteSlug || 'maxim-furzikov',
    },
  });
  // Восстановление должно пройти:
  expect(response.ok()).toBeTruthy();
}

// Публикует тестовый сайт через API:
async function publishTestSite(request: APIRequestContext, slug: string) {
  // Получаем токен автора:
  const token = await getAuthToken();
  // Отправляем структуру сайта:
  const response = await request.put(`${apiBaseUrl}/api/showcase/constructor`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      siteSlug: slug,
      theme: {
        primaryColor: '#2563eb',
      },
      pages: [
        {
          id: 'page-main',
          title: 'Главная',
          slug: '',
          sections: [
            {
              id: 'section-1',
              layout: '1',
              style: { padding: 24 },
              columns: [
                {
                  id: 'column-1',
                  width: 100,
                  style: {},
                  elements: [
                    { id: 'heading-1', type: 'heading', data: { text: 'E2E public page', level: 'h1' }, style: { fontSize: 32 } },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'page-contacts',
          title: 'Контакты',
          slug: 'contacts',
          sections: [{
            id: 'section-contacts',
            columns: [{
              id: 'column-contacts',
              elements: [{ id: 'heading-contacts', type: 'heading', data: { text: 'E2E contacts page', level: 'h2' }, style: {} }],
            }],
          }],
        },
      ],
    },
  });
  // Публикация должна пройти:
  expect(response.ok()).toBeTruthy();
}

// Проверяет кастомный slug:
test('site builder: published site opens by custom slug', async ({ page, request }) => {
  // Сохраняем исходное состояние:
  const original = await getCurrentSite(request);
  // Уникальный slug:
  const slug = `e2e-custom-${Date.now()}`;

  try {
    // Публикуем сайт:
    await publishTestSite(request, slug);
    // Открываем публичную страницу:
    await page.goto(`/s/${slug}`);
    // Проверяем контент:
    await expect(page.getByText('E2E public page')).toBeVisible();
    // Открываем вторую страницу по внутреннему slug:
    await page.getByRole('button', { name: 'Контакты' }).click();
    await expect(page).toHaveURL(new RegExp(`/s/${slug}/contacts$`));
    await expect(page.getByText('E2E contacts page')).toBeVisible();
    // Проверяем отсутствие горизонтального скролла:
    await expectNoHorizontalOverflow(page);
  } finally {
    // Возвращаем исходное состояние:
    await restoreSite(request, original);
  }
});

// Проверяет сохранение черновика:
test('site builder: draft save does not publish unfinished changes', async ({ page, request }) => {
  // Сохраняем исходное состояние:
  const original = await getCurrentSite(request);
  // Получаем токен:
  const token = await getAuthToken();
  // Уникальный slug:
  const slug = `e2e-draft-${Date.now()}`;

  try {
    // Публикуем начальную версию:
    await publishTestSite(request, slug);
    // Сохраняем черновик:
    const draftResponse = await request.put(`${apiBaseUrl}/api/showcase/constructor/draft`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        siteSlug: slug,
        theme: {},
        pages: [
          {
            id: 'page-main',
            title: 'Главная',
            slug: '',
            sections: [
              {
                id: 'section-draft',
                columns: [
                  {
                    id: 'column-draft',
                    width: 100,
                    elements: [
                      { id: 'heading-draft', type: 'heading', data: { text: 'E2E draft is not published yet', level: 'h1' }, style: {} },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    // Черновик должен сохраниться:
    expect(draftResponse.ok()).toBeTruthy();
    // Открываем публичную страницу:
    await page.goto(`/s/${slug}`);
    // Публичная версия должна остаться прежней:
    await expect(page.getByText('E2E public page')).toBeVisible();
    // Черновик не должен быть виден:
    await expect(page.getByText('E2E draft is not published yet')).toHaveCount(0);
  } finally {
    // Возвращаем исходное состояние:
    await restoreSite(request, original);
  }
});

// Проверяет undo и redo:
test('site builder: undo and redo controls are available in editor', async ({ page }) => {
  // Входим в админку:
  await login(page);
  // Открываем конструктор:
  await page.goto('/admin/showcase');
  // Кнопка undo должна быть видна:
  await expect(page.locator('.history-actions button').first()).toBeVisible();
  // Кнопка redo должна быть видна:
  await expect(page.locator('.history-actions button').nth(1)).toBeVisible();
  // Проверяем отсутствие горизонтального скролла:
  await expectNoHorizontalOverflow(page);
});
