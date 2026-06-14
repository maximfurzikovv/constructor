import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, apiRequestRaw, ensureApiServer, stopApiServer } from './testServer.mjs';

before(async () => {
  await ensureApiServer();
});

after(() => {
  stopApiServer();
});

// Создает минимальный конструктор:
function fallbackConstructor(original = {}) {
  // Возвращаем одну страницу:
  return {
    siteSlug: original.slug || 'maxim-furzikov',
    pages: [
      {
        id: 'page-main',
        title: 'Главная',
        slug: '',
        sections: [],
      },
    ],
    theme: {},
    siteTitle: original.title || 'Витрина',
  };
}

function ensureConstructorPayload(payload) {
  return Array.isArray(payload?.pages) && payload.pages.length > 0
    ? payload
    : fallbackConstructor({ slug: payload?.siteSlug || 'maxim-furzikov', title: payload?.siteTitle });
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
  const overview = await apiRequestRaw('/admin/overview', {
    skipAuth: true,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(overview.response.ok, true);
  const site = overview.body.data.sites.find((item) => item.slug === slug);
  assert.ok(site);
  const approved = await apiRequestRaw(`/admin/sites/${site.id}/published`, {
    method: 'PUT',
    skipAuth: true,
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ published: true }),
  });
  assert.equal(approved.response.ok, true);
}

test('showcase: save draft, publish constructor data, and open public site by slug', async () => {
  const originalPayload = ensureConstructorPayload(await apiRequest('/showcase/constructor/data'));
  const adminToken = await loginAdmin();

  const testSlug = `api-test-${Date.now()}`;
  const payload = {
    siteSlug: testSlug,
    siteTitle: 'API Test Site',
    theme: {
      primaryColor: '#2563eb',
      fontFamily: 'system',
    },
    pages: [
      {
        id: 'page-main',
        title: 'Главная',
        slug: '',
        sections: [],
      },
    ],
  };

  try {
    const draftResult = await apiRequest('/showcase/constructor/draft', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    assert.equal(draftResult.success, true);
    assert.equal(draftResult.slug, testSlug);

    const publishResult = await apiRequest('/showcase/constructor', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    assert.equal(publishResult.success, true);
    assert.equal(publishResult.slug, testSlug);
    assert.equal(publishResult.status, 'review');

    const hiddenBeforeApproval = await apiRequestRaw(`/showcase/${testSlug}`, { skipAuth: true });
    assert.equal(hiddenBeforeApproval.response.status, 404);

    await approveSiteBySlug(adminToken, testSlug);

    const publicSite = await apiRequest(`/showcase/${testSlug}`);
    assert.equal(publicSite.slug, testSlug);
    assert.equal(publicSite.published, true);
    assert.equal(publicSite.constructorData.siteSlug, testSlug);
    assert.equal(publicSite.constructorData.pages[0].title, 'Главная');

    const changedDraft = {
      ...payload,
      pages: [{ ...payload.pages[0], title: 'Черновик не для посетителя' }],
    };
    await apiRequest('/showcase/constructor/draft', {
      method: 'PUT',
      body: JSON.stringify(changedDraft),
    }); // Сохраняем неопубликованный черновик

    const publicAfterDraft = await apiRequest(`/showcase/${testSlug}`);
    assert.equal(publicAfterDraft.constructorData.pages[0].title, 'Главная'); // Публичная версия не меняется
  } finally {
    await apiRequest('/showcase/constructor', {
      method: 'PUT',
      body: JSON.stringify({
        ...originalPayload,
        siteSlug: originalPayload.siteSlug || 'maxim-furzikov',
      }),
    });
    await approveSiteBySlug(adminToken, originalPayload.siteSlug || 'maxim-furzikov');
  }
});

test('showcase: published excursion cover is visible in public site data', async () => {
  // Берем текущий адрес сайта автора:
  const constructorData = await apiRequest('/showcase/constructor/data');
  const slug = constructorData.siteSlug || 'maxim-furzikov';
  let excursion = null;

  try {
    // Создаем экскурсию с тестовой обложкой:
    excursion = await apiRequest('/excursions', {
      method: 'POST',
      body: JSON.stringify({ title: `Cover test ${Date.now()}`, city: 'Москва' }),
    });
    const coverImage = 'data:image/png;base64,Y292ZXI=';
    await apiRequest(`/excursions/${excursion.id}`, {
      method: 'PUT',
      body: JSON.stringify({ coverImage }),
    });
    await apiRequest(`/points/route/${excursion.route.id}/sync`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [
          { title: 'Start', description: 'Start point', lat: 59.934, lng: 30.306, duration: 3, radius: 50 },
          { title: 'Middle', description: 'Middle point', lat: 59.935, lng: 30.308, duration: 3, radius: 50 },
          { title: 'Finish', description: 'Finish point', lat: 59.936, lng: 30.31, duration: 4, radius: 50 },
        ],
      }),
    });
    await apiRequest(`/excursions/${excursion.id}/publish`, { method: 'PUT' });
    const adminLogin = await apiRequestRaw('/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ email: 'admin@constructor.local', password: 'Admin4219!' }),
    });
    assert.equal(adminLogin.response.ok, true);
    const adminToken = adminLogin.body.data.token;
    const approveResult = await apiRequestRaw(`/admin/excursions/${excursion.id}/status`, {
      method: 'PUT',
      skipAuth: true,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'published' }),
    });
    assert.equal(approveResult.response.ok, true);

    // Публичный сайт получает опубликованную обложку:
    const publicSite = await apiRequest(`/showcase/${slug}`);
    const published = publicSite.excursionDetails.find((item) => item.id === excursion.id);
    assert.equal(published.coverImage, coverImage);
  } finally {
    if (excursion?.id) await apiRequest(`/excursions/${excursion.id}`, { method: 'DELETE' });
  }
});

test('showcase: unpublished site is unavailable by known slug', async () => {
  const email = `unpublished-${Date.now()}@example.com`; // Новый автор
  const registered = await apiRequestRaw('/auth/register', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      email,
      name: 'Unpublished author',
      password: 'password123',
      confirmPassword: 'password123',
      consentPersonalData: true,
    }),
  });
  assert.equal(registered.response.ok, true);

  const token = registered.body.data.token; // Токен нового автора
  const draftSlug = `draft-only-${Date.now()}`;
  const draft = await apiRequestRaw('/showcase/constructor/draft', {
    method: 'PUT',
    skipAuth: true,
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      siteSlug: draftSlug,
      pages: [{ id: 'page-main', title: 'Главная', slug: '', sections: [] }],
      theme: {},
    }),
  });
  assert.equal(draft.response.ok, true);

  const publicRequest = await apiRequestRaw(`/showcase/${draftSlug}`, { skipAuth: true });
  assert.equal(publicRequest.response.status, 404); // Черновик закрыт посетителю
});

test('showcase: constructor image upload returns image address', async () => {
  const formData = new FormData();
  formData.append('file', new Blob(['image-content'], { type: 'image/png' }), 'logo.png'); // Тестовый логотип

  const result = await apiRequest('/showcase/constructor/asset/upload', {
    method: 'POST',
    body: formData,
  });

  assert.equal(typeof result.url, 'string');
  assert.equal(result.url.startsWith('data:image/') || result.url.startsWith('https://'), true); // Fallback или Cloudinary
});
