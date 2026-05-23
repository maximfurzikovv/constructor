import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, ensureApiServer, stopApiServer } from './testServer.mjs';

before(async () => {
  await ensureApiServer();
});

after(() => {
  stopApiServer();
});

test('excursions: create, sync route points, publish, and read published snapshot', async () => {
  let createdExcursion = null;

  try {
    createdExcursion = await apiRequest('/excursions', {
      method: 'POST',
      body: JSON.stringify({
        title: `API Test Excursion ${Date.now()}`,
        description: 'Created by automated API test',
        city: 'Санкт-Петербург',
        transport: 'walk',
      }),
    });

    assert.ok(createdExcursion.id);
    assert.equal(createdExcursion.status, 'draft');
    assert.ok(createdExcursion.route?.id);

    const routeId = createdExcursion.route.id;
    const syncedPoints = await apiRequest(`/points/route/${routeId}/sync`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [
          {
            title: 'Point 1',
            description: 'Start point',
            lat: 59.939,
            lng: 30.3158,
            duration: 5,
            radius: 40,
          },
          {
            title: 'Point 2',
            description: 'Finish point',
            lat: 59.94,
            lng: 30.3289,
            duration: 7,
            radius: 50,
          },
        ],
      }),
    });

    assert.equal(syncedPoints.length, 2);
    assert.equal(syncedPoints[0].order, 0);
    assert.equal(syncedPoints[1].order, 1);

    const published = await apiRequest(`/excursions/${createdExcursion.id}/publish`, {
      method: 'PUT',
    });

    assert.equal(published.status, 'published');
    assert.equal(published.route.points.length, 2);

    const snapshot = await apiRequest(`/excursions/${createdExcursion.id}?published=true`);
    assert.equal(snapshot.status, 'published');
    assert.equal(snapshot.route.points.length, 2);
    assert.equal(snapshot.route.points[0].title, 'Point 1');
  } finally {
    if (createdExcursion?.id) {
      await apiRequest(`/excursions/${createdExcursion.id}`, { method: 'DELETE' });
    }
  }
});
