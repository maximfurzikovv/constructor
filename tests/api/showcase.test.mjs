import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, ensureApiServer, stopApiServer } from './testServer.mjs';

before(async () => {
  await ensureApiServer();
});

after(() => {
  stopApiServer();
});

// Создает минимальный конструктор:
function fallbackConstructor(original) {
  // Возвращаем одну страницу:
  return {
    siteSlug: original.slug,
    pages: [
      {
        id: 'page-main',
        title: 'Главная',
        slug: '',
        sections: [],
      },
    ],
    theme: {},
    siteTitle: original.title,
  };
}

test('showcase: save draft, publish constructor data, and open public site by slug', async () => {
  const original = await apiRequest('/showcase/maxim-furzikov');
  const originalPayload = original.constructorData || fallbackConstructor(original);

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

    const publicSite = await apiRequest(`/showcase/${testSlug}`);
    assert.equal(publicSite.slug, testSlug);
    assert.equal(publicSite.published, true);
    assert.equal(publicSite.constructorData.siteSlug, testSlug);
    assert.equal(publicSite.constructorData.pages[0].title, 'Главная');
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
