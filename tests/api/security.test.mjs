import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, apiRequestRaw, ensureApiServer, stopApiServer } from './testServer.mjs';

before(async () => {
  await ensureApiServer();
});

after(() => {
  stopApiServer();
});

// Минимальный конструктор для восстановления:
function fallbackConstructor(original = {}) {
  // Возвращаем безопасную страницу:
  return {
    siteSlug: original.slug || 'maxim-furzikov',
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

function ensureConstructorPayload(payload) {
  return Array.isArray(payload?.pages) && payload.pages.length > 0
    ? payload
    : fallbackConstructor({ slug: payload?.siteSlug || 'maxim-furzikov' });
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

test('api security: protected constructor route rejects missing token', async () => {
  const { response, body } = await apiRequestRaw('/showcase/constructor/data', {
    method: 'GET',
    skipAuth: true,
  });

  assert.equal(response.status, 401);
  assert.equal(body.error, 'Not authorized');
});

test('api security: protected constructor route rejects broken token', async () => {
  const { response, body } = await apiRequestRaw('/showcase/constructor/data', {
    method: 'GET',
    skipAuth: true,
    headers: { Authorization: 'Bearer broken.token.value' },
  });

  assert.equal(response.status, 401);
  assert.equal(body.error, 'Invalid or expired token');
});

test('api validation: constructor rejects missing pages', async () => {
  const { response, body } = await apiRequestRaw('/showcase/constructor/draft', {
    method: 'PUT',
    body: JSON.stringify({ siteSlug: 'bad-payload', theme: {} }),
  });

  assert.equal(response.status, 400);
  assert.match(body.error, /страниц/i);
});

test('api validation: constructor removes unknown theme fields and sanitizes embed HTML', async () => {
  const testSlug = `security-test-${Date.now()}`;
  const payload = {
    siteSlug: testSlug,
    theme: {
      primaryColor: '#2563eb',
      unsupportedSetting: 'remove-me',
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
            columns: [
              {
                id: 'column-1',
                width: 100,
                elements: [
                  { id: 'embed-1', type: 'embed', data: { code: '<script>alert(1)</script><div onclick="bad()">ok</div>' }, style: {} },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const originalPayload = ensureConstructorPayload(await apiRequest('/showcase/constructor/data'));
  const adminToken = await loginAdmin();

  try {
    const result = await apiRequest('/showcase/constructor', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    assert.equal(result.slug, testSlug);
    assert.equal(result.status, 'review');

    await approveSiteBySlug(adminToken, testSlug);

    const publicSite = await apiRequest(`/showcase/${testSlug}`);
    const savedTheme = publicSite.constructorData.theme;
    const savedCode = publicSite.constructorData.pages[0].sections[0].columns[0].elements[0].data.code;
    assert.equal(savedTheme.unsupportedSetting, undefined);
    assert.equal(/<script/i.test(savedCode), false);
    assert.equal(/onclick/i.test(savedCode), false);
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
