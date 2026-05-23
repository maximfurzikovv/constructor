import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, apiRequestRaw, ensureApiServer, stopApiServer } from './testServer.mjs';

describe('media API', () => {
  before(ensureApiServer);
  after(stopApiServer);

  it('uploads, lists, updates and deletes point media', async () => {
    const excursion = await apiRequest('/excursions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Media upload test',
        description: 'Temporary excursion for upload checks',
        city: 'Test city',
      }),
    });

    const [point] = await apiRequest(`/points/route/${excursion.route.id}/sync`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [
          {
            title: 'Audio point',
            description: 'Point with media',
            lat: 59.934,
            lng: 30.306,
            duration: 3,
            radius: 25,
          },
        ],
      }),
    });

    const form = new FormData();
    form.append('excursionId', excursion.id);
    form.append('pointId', point.id);
    form.append('title', 'Intro audio');
    form.append('description', 'Short test audio fragment');
    form.append('file', new Blob(['fake-audio-payload'], { type: 'audio/mpeg' }), 'intro.mp3');

    const upload = await apiRequestRaw('/media/upload', { method: 'POST', body: form, headers: {} });
    assert.equal(upload.response.status, 201);
    assert.equal(upload.body.data.type, 'audio');
    assert.equal(upload.body.data.pointId, point.id);
    assert.match(upload.body.data.url, /^data:audio\/mpeg;base64,/);

    const mediaItems = await apiRequest(`/media?excursionId=${excursion.id}`);
    assert.ok(mediaItems.some((item) => item.id === upload.body.data.id));

    const updated = await apiRequest(`/media/${upload.body.data.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated audio', description: 'Changed by test' }),
    });
    assert.equal(updated.title, 'Updated audio');

    const deleted = await apiRequest(`/media/${upload.body.data.id}`, { method: 'DELETE' });
    assert.equal(deleted.success, true);

    await apiRequest(`/excursions/${excursion.id}`, { method: 'DELETE' });
  });

  it('rejects upload without a file', async () => {
    const response = await apiRequestRaw('/media/upload', { method: 'POST', body: new FormData(), headers: {} });
    assert.equal(response.response.status, 400);
  });
});
