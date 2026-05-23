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
function fallbackConstructor(original) {
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

test('api validation: constructor sanitizes custom CSS and embed HTML', async () => {
  const testSlug = `security-test-${Date.now()}`;
  const payload = {
    siteSlug: testSlug,
    theme: {
      customCss: '@import url(https://bad.test/style.css); .x { background: url(javascript:alert(1)); color: red; }',
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

  const original = await apiRequest('/showcase/maxim-furzikov');
  const originalPayload = original.constructorData || fallbackConstructor(original);

  try {
    const result = await apiRequest('/showcase/constructor', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    assert.equal(result.slug, testSlug);

    const publicSite = await apiRequest(`/showcase/${testSlug}`);
    const savedCss = publicSite.constructorData.theme.customCss;
    const savedCode = publicSite.constructorData.pages[0].sections[0].columns[0].elements[0].data.code;
    assert.equal(savedCss.includes('@import'), false);
    assert.equal(/javascript\s*:/i.test(savedCss), false);
    assert.equal(/<script/i.test(savedCode), false);
    assert.equal(/onclick/i.test(savedCode), false);
  } finally {
    await apiRequest('/showcase/constructor', {
      method: 'PUT',
      body: JSON.stringify({
        ...originalPayload,
        siteSlug: originalPayload.siteSlug || original.slug || 'maxim-furzikov',
      }),
    });
  }
});
