import crypto from 'crypto';
import { Router } from 'express';
import prisma, { withDbRetry } from '../db';
import { createJwtToken as createSecureJwtToken, hashPassword, isPasswordHash, verifyPassword } from '../authSecurity';
// Маршруты API:
const router = Router();
// Секрет JWT берется из переменной окружения, чтобы на сервере можно было задать свой ключ:
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
// Время жизни токена: 7 дней, чтобы пользователь не входил заново при каждом открытии:
const JWT_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
// Полезная нагрузка токена: здесь храним id пользователя и минимум служебных данных:
type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
};
// Кодирование base64url используется в JWT вместо обычного base64:
function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}
// Подпись HMAC-SHA256 позволяет понять, что токен не был изменен на клиенте:
function signJwtPart(value: string) {
  return crypto.createHmac('sha256', JWT_SECRET).update(value).digest('base64url');
}
// Создаем настоящий JWT в формате header.payload.signature:
function createJwtToken(user: { id: string; email: string; role: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + JWT_EXPIRES_IN_SECONDS,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = signJwtPart(unsignedToken);
  return `${unsignedToken}.${signature}`;
}
// Достаем Bearer-токен из заголовка Authorization:
function getBearerToken(header: string | undefined) {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}
// Проверяем подпись токена, срок действия и структуру payload:
function verifyJwtToken(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = signJwtPart(`${encodedHeader}.${encodedPayload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as JwtPayload;
    if (!payload.sub || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
// POST-маршрут входа:
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body; // Достаем данные
    if (!email || !password) { // Если нет данных
      return res.status(400).json({ error: 'Email and password are required' });
    }
    // Поиск пользователя:
    const user = await withDbRetry(() => prisma.user.findUnique({ where: { email } }));
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    // Если пароль был старого формата, сразу обновляем его на хэш:
    if (!isPasswordHash(user.password)) {
      await withDbRetry(() => prisma.user.update({
        where: { id: user.id },
        data: { password: hashPassword(password) },
      }));
    }
    // JSON ответ:
    res.json({
      data: {
        token: createSecureJwtToken(user),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          createdAt: user.createdAt.toISOString(),
        },
      },
    });
  } catch (error) { // Ошибка
    console.error('Login failed:', error);
    res.status(503).json({ error: 'Database is unavailable. Try again in a minute.' });
  }
});
// POST-маршрут регистрации:
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body; // Достаем данные:
    if (!email || !password || !name) { // Если данных нет
      return res.status(400).json({ error: 'All fields are required' });
    }
    // Создание нового пользователя:
    const user = await withDbRetry(() => prisma.user.create({
      data: {
        email,
        password: hashPassword(password),
        name,
        // Новые зарегистрированные пользователи являются авторами:
        role: 'guide',
        // Для нового автора сразу создается личный сайт-витрина:
        showcaseSites: {
          create: {
            slug: `site-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: name,
            description: '',
            published: false,
          },
        },
      },
    }));
    // Ответ сервера:
    res.json({
      data: {
        token: createSecureJwtToken(user),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          createdAt: user.createdAt.toISOString(),
        },
      },
    });
  } catch (error) { // Ошибка
    console.error('Registration failed:', error);
    res.status(400).json({ error: 'User cannot be created' });
  }
});
// GET-маршрут текущего пользователя:
router.get('/me', async (req, res) => {
  try {
    // Достаем токен из Authorization, потому что текущий пользователь определяется именно по токену:
    const token = getBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: 'Not authorized' });
    // Проверяем, что токен настоящий, подписан нашим секретом и еще не истек:
    const payload = verifyJwtToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
    // Поиск пользователя:
    const user = await withDbRetry(() => prisma.user.findUnique({ where: { id: payload.sub } }));
    if (!user) return res.status(401).json({ error: 'Not authorized' });
    // Ответ сервера:
    res.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) { // Ошибка
    console.error('Current user lookup failed:', error);
    res.status(503).json({ error: 'Database is unavailable. Try again in a minute.' });
  }
});
// Экспорт по умолчанию:
export default router;
