import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, apiRequestRaw, ensureApiServer, stopApiServer } from './testServer.mjs';

describe('system API', () => {
  before(ensureApiServer);
  after(stopApiServer);

  it('reports API and database health', async () => {
    const health = await apiRequestRaw('/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.status, 'ok');

    const dbHealth = await apiRequestRaw('/health/db');
    assert.equal(dbHealth.response.status, 200);
    assert.equal(dbHealth.body.database, 'ok');
  });

  it('returns dashboard statistics shape', async () => {
    const stats = await apiRequest('/excursions/stats');
    assert.equal(typeof stats.totalExcursions, 'number');
    assert.equal(typeof stats.publishedExcursions, 'number');
    assert.equal(typeof stats.totalPoints, 'number');
    assert.equal(typeof stats.totalMedia, 'number');
  });
});
