import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { API_BASE_URL, apiRequest, apiRequestRaw, ensureApiServer, stopApiServer } from './testServer.mjs';

before(async () => {
  await ensureApiServer();
});

after(() => {
  stopApiServer();
});

async function loginAdmin() {
  const result = await apiRequestRaw('/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email: 'admin@constructor.local', password: 'Admin4219!' }),
  });
  assert.equal(result.response.ok, true);
  return result.body.data.token;
}

async function requestAs(token, path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

test('admin: guide cannot open system overview', async () => {
  const guide = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'guide@example.com', password: 'password123' }),
  });

  const result = await requestAs(guide.token, '/admin/overview');
  assert.equal(result.response.status, 403);
});

test('admin: overview returns moderation counters and test summaries', async () => {
  const adminToken = await loginAdmin();
  const result = await requestAs(adminToken, '/admin/overview');

  assert.equal(result.response.status, 200);
  assert.equal(typeof result.body.data.summary.users, 'number');
  assert.equal(Array.isArray(result.body.data.healthChecks), true);
  assert.equal(result.body.data.healthChecks.some((item) => item.label === 'API-тесты'), true);
  assert.equal(result.body.data.healthChecks.some((item) => item.label === 'E2E Playwright'), true);
  assert.equal(result.body.data.healthChecks.some((item) => item.label === 'Состояние платформы'), true);
});

test('admin: can reject and approve an excursion with moderation comment', async () => {
  const adminToken = await loginAdmin();
  const excursion = await apiRequest('/excursions', {
    method: 'POST',
    body: JSON.stringify({ title: `Admin moderation ${Date.now()}`, city: 'Test city' }),
  });

  try {
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
    const rejected = await requestAs(adminToken, `/admin/excursions/${excursion.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'archived', moderationComment: 'Нужно уточнить описание' }),
    });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.body.data.status, 'archived');
    assert.equal(rejected.body.data.moderationComment, 'Нужно уточнить описание');

    const approved = await requestAs(adminToken, `/admin/excursions/${excursion.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'published' }),
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.data.status, 'published');
    assert.equal(approved.body.data.moderationComment, null);
  } finally {
    await apiRequest(`/excursions/${excursion.id}`, { method: 'DELETE' });
  }
});

test('admin: can reject and approve a web application with moderation comment', async () => {
  const adminToken = await loginAdmin();
  const guide = await apiRequestRaw('/auth/register', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      email: `admin-site-${Date.now()}@example.com`,
      name: 'Admin Site Owner',
      password: 'password123',
      confirmPassword: 'password123',
    }),
  });
  assert.equal(guide.response.ok, true);
  const guideToken = guide.body.data.token;
  const slug = `admin-site-${Date.now()}`;
  const payload = {
    siteSlug: slug,
    pages: [{ id: 'page-main', title: 'Главная', slug: '', sections: [] }],
    theme: {},
  };

  const publish = await requestAs(guideToken, '/showcase/constructor', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  assert.equal(publish.response.status, 200);
  assert.equal(publish.body.data.status, 'review');

  const blockedPublic = await apiRequestRaw(`/showcase/${slug}`, { skipAuth: true });
  assert.equal(blockedPublic.response.status, 404);

  const overview = await requestAs(adminToken, '/admin/overview');
  const site = overview.body.data.sites.find((item) => item.slug === slug);
  assert.ok(site);
  assert.equal(site.published, false);
  assert.equal(site.moderationComment, null);

  const rejected = await requestAs(adminToken, `/admin/sites/${site.id}/published`, {
    method: 'PUT',
    body: JSON.stringify({ published: false, moderationComment: 'Нужно поправить страницу' }),
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.data.published, false);
  assert.equal(rejected.body.data.moderationComment, 'Нужно поправить страницу');

  const approved = await requestAs(adminToken, `/admin/sites/${site.id}/published`, {
    method: 'PUT',
    body: JSON.stringify({ published: true }),
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.body.data.published, true);
  assert.equal(approved.body.data.moderationComment, null);

  const publicSite = await apiRequestRaw(`/showcase/${slug}`, { skipAuth: true });
  assert.equal(publicSite.response.status, 200);
  assert.equal(publicSite.body.data.constructorData.siteSlug, slug);
});

test('admin: full moderation flow publishes excursion for anonymous visitor', async () => {
  const adminToken = await loginAdmin();
  const excursion = await apiRequest('/excursions', {
    method: 'POST',
    body: JSON.stringify({
      title: `Full moderation ${Date.now()}`,
      description: 'Excursion becomes public only after admin approval',
      city: 'Test city',
    }),
  });

  try {
    const syncedPoints = await apiRequest(`/points/route/${excursion.route.id}/sync`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [
          { title: 'Start', description: 'Start point', lat: 59.934, lng: 30.306, duration: 3, radius: 50 },
          { title: 'Middle', description: 'Middle point', lat: 59.935, lng: 30.308, duration: 3, radius: 50 },
          { title: 'Finish', description: 'Finish point', lat: 59.936, lng: 30.31, duration: 4, radius: 50 },
        ],
      }),
    });
    assert.equal(syncedPoints.length, 3);

    const submitted = await apiRequest(`/excursions/${excursion.id}/publish`, { method: 'PUT' });
    assert.equal(submitted.status, 'review');

    const blockedPublic = await apiRequestRaw(`/excursions/${excursion.id}?published=true`, { skipAuth: true });
    assert.equal(blockedPublic.response.status, 404);

    const historyBefore = await apiRequest(`/excursions/${excursion.id}/publications`);
    assert.equal(historyBefore.length, 1);
    assert.equal(historyBefore[0].status, 'review');

    const approved = await requestAs(adminToken, `/admin/excursions/${excursion.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'published' }),
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.data.status, 'published');

    const publicSnapshot = await apiRequestRaw(`/excursions/${excursion.id}?published=true`, { skipAuth: true });
    assert.equal(publicSnapshot.response.status, 200);
    assert.equal(publicSnapshot.body.data.status, 'published');
    assert.equal(publicSnapshot.body.data.route.points.length, 3);

    const historyAfter = await apiRequest(`/excursions/${excursion.id}/publications`);
    assert.equal(historyAfter.length, 1);
    assert.equal(historyAfter[0].status, 'published');
    assert.ok(historyAfter[0].reviewedAt);
  } finally {
    await apiRequest(`/excursions/${excursion.id}`, { method: 'DELETE' });
  }
});
