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
  assert.equal(body.error, 'Неверная почта или пароль');
});

test('auth: user registration returns token and created user', async () => {
  const email = `test-${Date.now()}-${Math.round(Math.random() * 10000)}@example.com`;
  const result = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'password123',
      confirmPassword: 'password123',
      name: 'Test User',
      consentPersonalData: true,
    }),
  });

  assert.equal(result.token.split('.').length, 3);
  assert.equal(result.user.email, email);
  assert.equal(result.user.name, 'Test User');
});

test('auth: duplicate email returns clear conflict', async () => {
  const email = `duplicate-${Date.now()}-${Math.round(Math.random() * 10000)}@example.com`;
  const registration = {
    email,
    password: 'password123',
    confirmPassword: 'password123',
    name: 'Duplicate User',
    consentPersonalData: true,
  };

  await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(registration),
  });

  const { response, body } = await apiRequestRaw('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...registration, email: email.toUpperCase() }),
  });

  assert.equal(response.status, 409);
  assert.equal(body.error, 'Пользователь с такой почтой уже зарегистрирован');
});

test('auth: mismatched registration passwords are rejected', async () => {
  const { response, body } = await apiRequestRaw('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `mismatch-${Date.now()}@example.com`,
      password: 'password123',
      confirmPassword: 'password456',
      name: 'Mismatch User',
      consentPersonalData: true,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, 'Пароли не совпадают');
});

test('auth: registration without personal data consent is rejected', async () => {
  const { response, body } = await apiRequestRaw('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `consent-${Date.now()}@example.com`,
      password: 'password123',
      confirmPassword: 'password123',
      name: 'Consent User',
      consentPersonalData: false,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, 'Требуется согласие на обработку персональных данных');
});
