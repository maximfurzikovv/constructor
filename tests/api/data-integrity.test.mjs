import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { API_BASE_URL, apiRequest, apiRequestRaw, ensureApiServer, stopApiServer } from './testServer.mjs';

// Формирует уникальный email для тестового пользователя:
function testEmail(prefix) {
  // Date.now и random уменьшают риск конфликта между запусками:
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}@example.com`;
}

// Регистрирует отдельного автора для проверки прав:
async function registerGuide(prefix) {
  // Запрос идет без готового токена:
  const result = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail(prefix),
      password: 'password123',
      name: `Test ${prefix}`,
      consentPersonalData: true,
    }),
  });
  // Возвращаем пользователя и его JWT:
  return result;
}

// Выполняет запрос с конкретным JWT:
async function requestAs(token, path, options = {}) {
  // FormData сам выставит Content-Type:
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  // Отправляем запрос к тестовому API:
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: isFormData
      ? { Authorization: `Bearer ${token}`, ...options.headers }
      : {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
  });
  // Тело нужно для диагностики падения:
  const body = await response.json().catch(() => null);
  // Возвращаем статус и данные:
  return { response, body };
}

// Создает экскурсию с одной точкой:
async function createExcursionWithPoint() {
  // Создаем экскурсию:
  const excursion = await apiRequest('/excursions', {
    method: 'POST',
    body: JSON.stringify({
      title: `Integrity excursion ${Date.now()}`,
      description: 'Temporary excursion for integrity checks',
      city: 'Test city',
    }),
  });

  // Создаем одну точку маршрута:
  const [point] = await apiRequest(`/points/route/${excursion.route.id}/sync`, {
    method: 'PUT',
    body: JSON.stringify({
      points: [
        {
          title: 'Integrity point',
          description: 'Point for media checks',
          lat: 59.934,
          lng: 30.306,
          duration: 3,
          radius: 25,
        },
      ],
    }),
  });

  // Возвращаем связанную пару:
  return { excursion, point };
}

async function loginAdmin() {
  const adminLogin = await apiRequestRaw('/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email: 'admin@constructor.local', password: 'Admin4219!' }),
  });
  assert.equal(adminLogin.response.ok, true);
  return adminLogin.body.data.token;
}

async function approveSiteBySlug(adminToken, slug) {
  const overview = await requestAs(adminToken, '/admin/overview');
  assert.equal(overview.response.status, 200);
  const site = overview.body.data.sites.find((item) => item.slug === slug);
  assert.ok(site);
  const approved = await requestAs(adminToken, `/admin/sites/${site.id}/published`, {
    method: 'PUT',
    body: JSON.stringify({ published: true }),
  });
  assert.equal(approved.response.status, 200);
}

describe('data ownership and integrity API', () => {
  before(ensureApiServer);
  after(stopApiServer);

  it('rejects editing another author excursion and route', async () => {
    // Создаем двух независимых авторов:
    const owner = await registerGuide('owner');
    const stranger = await registerGuide('stranger');
    // Экскурсия принадлежит первому автору:
    const created = await requestAs(owner.token, '/excursions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Owner only excursion',
        description: 'Must not be edited by another author',
        city: 'Test city',
      }),
    });
    assert.equal(created.response.status, 201);
    const excursion = created.body.data;

    try {
      // Второй автор не должен менять чужую экскурсию:
      const update = await requestAs(stranger.token, `/excursions/${excursion.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: 'Hacked title' }),
      });
      assert.equal(update.response.status, 404);

      // Второй автор не должен синхронизировать чужой маршрут:
      const sync = await requestAs(stranger.token, `/points/route/${excursion.route.id}/sync`, {
        method: 'PUT',
        body: JSON.stringify({ points: [] }),
      });
      assert.equal(sync.response.status, 404);

      // Второй автор не должен загружать медиа в чужую экскурсию:
      const form = new FormData();
      form.append('excursionId', excursion.id);
      form.append('title', 'Foreign media');
      form.append('file', new Blob(['fake-image'], { type: 'image/png' }), 'foreign.png');
      const upload = await requestAs(stranger.token, '/media/upload', { method: 'POST', body: form, headers: {} });
      assert.equal(upload.response.status, 404);
    } finally {
      // Владелец удаляет тестовую экскурсию:
      await requestAs(owner.token, `/excursions/${excursion.id}`, { method: 'DELETE' });
    }
  });

  it('deletes excursion with route, points and media relations unavailable through API', async () => {
    // Готовим экскурсию и точку:
    const { excursion, point } = await createExcursionWithPoint();

    // Загружаем медиа к точке:
    const form = new FormData();
    form.append('excursionId', excursion.id);
    form.append('pointId', point.id);
    form.append('title', 'Cascade image');
    form.append('file', new Blob(['fake-image'], { type: 'image/png' }), 'cascade.png');
    const upload = await apiRequestRaw('/media/upload', { method: 'POST', body: form, headers: {} });
    assert.equal(upload.response.status, 201);

    // Удаляем экскурсию:
    const deleted = await apiRequest(`/excursions/${excursion.id}`, { method: 'DELETE' });
    assert.equal(deleted.success, true);

    // Маршрут с точками больше недоступен:
    const pointsAfterDelete = await apiRequestRaw(`/points/route/${excursion.route.id}`);
    assert.equal(pointsAfterDelete.response.status, 404);

    // Медиафайл больше недоступен:
    const mediaAfterDelete = await apiRequestRaw(`/media/${upload.body.data.id}`);
    assert.equal(mediaAfterDelete.response.status, 404);
  });

  it('keeps audio playback order metadata for point media', async () => {
    // Готовим точку маршрута:
    const { excursion, point } = await createExcursionWithPoint();

    try {
      // Создаем второе аудио первым, чтобы проверить ручной порядок:
      const second = await apiRequest('/media', {
        method: 'POST',
        body: JSON.stringify({
          excursionId: excursion.id,
          pointId: point.id,
          type: 'audio',
          url: 'data:audio/mpeg;base64,c2Vjb25k',
          title: 'Second audio',
          description: '2',
        }),
      });
      // Создаем первое аудио вторым:
      const first = await apiRequest('/media', {
        method: 'POST',
        body: JSON.stringify({
          excursionId: excursion.id,
          pointId: point.id,
          type: 'audio',
          url: 'data:audio/mpeg;base64,Zmlyc3Q=',
          title: 'First audio',
          description: '1',
        }),
      });

      // Получаем точку вместе с медиа:
      const [savedPoint] = await apiRequest(`/points/route/${excursion.route.id}`);
      // Сортировка повторяет логику плеера:
      const orderedTitles = savedPoint.media
        .filter((media) => media.type === 'audio')
        .sort((a, b) => Number(a.description) - Number(b.description))
        .map((media) => media.title);

      // Первым должен идти файл с порядком 1:
      assert.deepEqual(orderedTitles, ['First audio', 'Second audio']);
      // Проверяем, что оба файла реально были созданы:
      assert.ok(first.id);
      assert.ok(second.id);
    } finally {
      // Удаляем временную экскурсию:
      await apiRequest(`/excursions/${excursion.id}`, { method: 'DELETE' });
    }
  });

  it('attaches a media library item to a point', async () => {
    // Готовим экскурсию и точку:
    const { excursion, point } = await createExcursionWithPoint();

    try {
      // Загружаем файл в медиатеку без pointId:
      const form = new FormData();
      form.append('excursionId', excursion.id);
      form.append('title', 'Library image');
      form.append('file', new Blob(['fake-image'], { type: 'image/png' }), 'library.png');
      const upload = await apiRequestRaw('/media/upload', { method: 'POST', body: form, headers: {} });
      assert.equal(upload.response.status, 201);
      assert.equal(upload.body.data.pointId, null);

      // Привязываем файл из медиатеки к точке:
      const attached = await apiRequest(`/media/${upload.body.data.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: upload.body.data.title,
          description: upload.body.data.description,
          pointId: point.id,
        }),
      });
      assert.equal(attached.pointId, point.id);

      // Проверяем, что точка теперь возвращает выбранный файл:
      const [savedPoint] = await apiRequest(`/points/route/${excursion.route.id}`);
      assert.ok(savedPoint.media.some((media) => media.id === upload.body.data.id));
    } finally {
      // Удаляем временную экскурсию:
      await apiRequest(`/excursions/${excursion.id}`, { method: 'DELETE' });
    }
  });

  it('reports occupied site slug and rejects using it for another author', async () => {
    // Создаем двух авторов с независимыми сайтами:
    const owner = await registerGuide('slug-owner');
    const stranger = await registerGuide('slug-stranger');
    const slug = `occupied-${Date.now()}`; // Проверяемый адрес
    const payload = {
      siteSlug: slug,
      theme: {},
      pages: [{ id: 'page-main', title: 'Главная', slug: '', sections: [] }],
    }; // Минимальные данные сайта

    const occupied = await requestAs(owner.token, '/showcase/constructor/draft', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    assert.equal(occupied.response.status, 200);

    // Второму автору адрес должен отображаться занятым:
    const check = await requestAs(stranger.token, `/showcase/constructor/slug-availability?slug=${slug}`);
    assert.equal(check.response.status, 200);
    assert.equal(check.body.data.available, false);

    // Обход интерфейса также не должен позволить сохранить адрес:
    const save = await requestAs(stranger.token, '/showcase/constructor/draft', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    assert.equal(save.response.status, 409);
    assert.equal(save.body.error, 'Этот адрес сайта уже занят');
  });

  it('rejects unexpected fields and invalid route or media values', async () => {
    // Создаем экскурсию для проверок схем:
    const { excursion } = await createExcursionWithPoint();

    try {
      // Служебное поле нельзя записать через форму:
      const foreignField = await apiRequestRaw(`/excursions/${excursion.id}`, {
        method: 'PUT',
        body: JSON.stringify({ authorId: 'forged-author' }),
      });
      assert.equal(foreignField.response.status, 400);

      // Координаты вне диапазона не должны попадать в маршрут:
      const badPoint = await apiRequestRaw(`/points/route/${excursion.route.id}/sync`, {
        method: 'PUT',
        body: JSON.stringify({ points: [{ title: 'Bad point', lat: 123, lng: 30, duration: 5, radius: 50 }] }),
      });
      assert.equal(badPoint.response.status, 400);

      // Тип медиа ограничен поддерживаемыми форматами:
      const badMedia = await apiRequestRaw('/media', {
        method: 'POST',
        body: JSON.stringify({
          excursionId: excursion.id,
          type: 'video',
          url: 'https://example.com/video.mp4',
          title: 'Unsupported media',
        }),
      });
      assert.equal(badMedia.response.status, 400);
    } finally {
      // Удаляем временную экскурсию:
      await apiRequest(`/excursions/${excursion.id}`, { method: 'DELETE' });
    }
  });

  it('keeps public sites of two registered authors separated', async () => {
    // Регистрируем двух авторов:
    const first = await registerGuide('site-first');
    const second = await registerGuide('site-second');
    const adminToken = await loginAdmin();
    const firstSlug = `first-site-${Date.now()}`;
    const secondSlug = `second-site-${Date.now()}`;

    // Формирует страницу с отличимым заголовком:
    const sitePayload = (slug, heading) => ({
      siteSlug: slug,
      theme: {},
      pages: [{
        id: 'page-main',
        title: 'Главная',
        slug: '',
        sections: [{ id: 's', columns: [{ id: 'c', elements: [{ id: 'h', type: 'heading', data: { text: heading }, style: {} }] }] }],
      }],
    });

    // Каждый автор публикует собственный сайт:
    const firstPublish = await requestAs(first.token, '/showcase/constructor', {
      method: 'PUT',
      body: JSON.stringify(sitePayload(firstSlug, 'Первый автор')),
    });
    const secondPublish = await requestAs(second.token, '/showcase/constructor', {
      method: 'PUT',
      body: JSON.stringify(sitePayload(secondSlug, 'Второй автор')),
    });
    assert.equal(firstPublish.response.status, 200);
    assert.equal(secondPublish.response.status, 200);
    await approveSiteBySlug(adminToken, firstSlug);
    await approveSiteBySlug(adminToken, secondSlug);

    // Публичные страницы не должны обмениваться данными:
    const firstSite = await requestAs(first.token, `/showcase/${firstSlug}`);
    const secondSite = await requestAs(second.token, `/showcase/${secondSlug}`);
    assert.equal(firstSite.body.data.constructorData.pages[0].sections[0].columns[0].elements[0].data.text, 'Первый автор');
    assert.equal(secondSite.body.data.constructorData.pages[0].sections[0].columns[0].elements[0].data.text, 'Второй автор');
  });
});
