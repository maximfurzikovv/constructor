import test from 'node:test';
import assert from 'node:assert/strict';
import { createJwtToken, hashPassword, isPasswordHash, verifyJwtToken, verifyPassword } from '../../server/src/authSecurity';

// Проверяем создание JWT:
test('unit auth: JWT has header, payload and signature', () => {
  // Создаем токен:
  const token = createJwtToken({ id: 'user-test', email: 'test@example.com', role: 'guide' });
  // Разбираем части:
  const parts = token.split('.');
  // JWT должен состоять из трех частей:
  assert.equal(parts.length, 3);
  // Проверяем payload:
  const payload = verifyJwtToken(token);
  // Payload должен существовать:
  assert.ok(payload);
  // ID пользователя должен сохраниться:
  assert.equal(payload.sub, 'user-test');
  // Email должен сохраниться:
  assert.equal(payload.email, 'test@example.com');
});

// Проверяем защиту подписи:
test('unit auth: tampered JWT is rejected', () => {
  // Создаем токен:
  const token = createJwtToken({ id: 'user-test', email: 'test@example.com', role: 'guide' });
  // Ломаем подпись:
  const broken = `${token.slice(0, -2)}xx`;
  // Проверка должна вернуть null:
  assert.equal(verifyJwtToken(broken), null);
});

// Проверяем хэширование пароля:
test('unit auth: password hash verifies only the original password', () => {
  // Хэшируем пароль:
  const hash = hashPassword('password123');
  // Проверяем формат:
  assert.equal(isPasswordHash(hash), true);
  // Правильный пароль проходит:
  assert.equal(verifyPassword('password123', hash), true);
  // Чужой пароль не проходит:
  assert.equal(verifyPassword('wrong-password', hash), false);
});

// Проверяем отказ от открытого пароля:
test('unit auth: plaintext password is no longer accepted', () => {
  assert.equal(verifyPassword('password123', 'password123'), false); // Старый формат запрещен
});
