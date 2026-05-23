import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, apiRequestRaw, ensureApiServer, stopApiServer } from './testServer.mjs';

before(async () => {
  await ensureApiServer();
});

after(() => {
  stopApiServer();
});

test('auth: seeded user can log in', async () => {
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'guide@example.com',
      password: 'password123',
    }),
  });

  assert.equal(result.token.split('.').length, 3);
  assert.equal(result.user.email, 'guide@example.com');
  assert.equal(result.user.role, 'guide');
});

test('auth: invalid password returns 401', async () => {
  const { response, body } = await apiRequestRaw('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'guide@example.com',
      password: 'wrong-password',
    }),
  });

  assert.equal(response.status, 401);
  assert.equal(body.error, 'Invalid email or password');
});

test('auth: user registration returns token and created user', async () => {
  const email = `test-${Date.now()}-${Math.round(Math.random() * 10000)}@example.com`;
  const result = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'password123',
      name: 'Test User',
    }),
  });

  assert.equal(result.token.split('.').length, 3);
  assert.equal(result.user.email, email);
  assert.equal(result.user.name, 'Test User');
});
