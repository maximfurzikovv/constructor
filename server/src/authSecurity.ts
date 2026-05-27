import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import prisma, { withDbRetry } from './db';

// Секрет JWT обязателен для опубликованного приложения:
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-secret-change-me');
// Токен живет семь дней:
const JWT_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
// Имя защищенной cookie:
export const AUTH_COOKIE_NAME = 'excursion_session';
// Количество итераций для PBKDF2:
const PASSWORD_ITERATIONS = 120_000;
// Длина соли в байтах:
const PASSWORD_SALT_BYTES = 16;
// Длина итогового хэша в байтах:
const PASSWORD_KEY_BYTES = 32;
// Алгоритм хэширования пароля:
const PASSWORD_DIGEST = 'sha256';

// Данные пользователя, которые кладутся в request:
export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

// Request с авторизованным пользователем:
export type AuthRequest = Request & {
  user?: AuthUser;
};

// Полезная нагрузка JWT:
type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
};

// Проверяет, похож ли пароль на новый хэш:
export function isPasswordHash(value: string) {
  return value.startsWith('pbkdf2$');
}

// Хэширует пароль перед сохранением в базу:
export function hashPassword(password: string) {
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES).toString('base64url');
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_BYTES, PASSWORD_DIGEST)
    .toString('base64url');
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

// Проверяет наличие секрета подписи:
function requireJwtSecret() {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is required in production');
  return JWT_SECRET;
}

// Сравнивает введенный пароль с сохраненным хэшем:
export function verifyPassword(password: string, storedPassword: string) {
  // Открытый пароль больше не считается допустимым форматом:
  if (!isPasswordHash(storedPassword)) return false;
  // Разбираем сохраненный формат хэша:
  const [, iterationsRaw, salt, hash] = storedPassword.split('$');
  const iterations = Number(iterationsRaw);
  if (!iterations || !salt || !hash) return false;
  // Считаем хэш введенного пароля с той же солью:
  const candidate = crypto
    .pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_BYTES, PASSWORD_DIGEST)
    .toString('base64url');
  // Сравниваем буферы без утечки времени:
  const candidateBuffer = Buffer.from(candidate);
  const hashBuffer = Buffer.from(hash);
  if (candidateBuffer.length !== hashBuffer.length) return false;
  return crypto.timingSafeEqual(candidateBuffer, hashBuffer);
}

// Кодирует строку в base64url:
function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

// Подписывает часть JWT:
function signJwtPart(value: string) {
  return crypto.createHmac('sha256', requireJwtSecret()).update(value).digest('base64url');
}

// Создает JWT для авторизованного пользователя:
export function createJwtToken(user: AuthUser) {
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

// Достает Bearer-токен из заголовка Authorization:
function getBearerToken(header: string | undefined) {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

// Достает JWT из защищенной cookie:
function getCookieToken(header: string | undefined) {
  if (!header) return null;
  const part = header.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!part) return null;
  return decodeURIComponent(part.slice(AUTH_COOKIE_NAME.length + 1));
}

// Достает JWT из запроса:
function getRequestToken(req: Request) {
  return getBearerToken(req.headers.authorization) || getCookieToken(req.headers.cookie);
}

// Формирует HttpOnly cookie после успешного входа:
export function createAuthCookie(token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''; // HTTPS для Render
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${JWT_EXPIRES_IN_SECONDS}; SameSite=Lax${secure}`;
}

// Удаляет HttpOnly cookie при выходе:
export function clearAuthCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''; // HTTPS для Render
  return `${AUTH_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

// Проверяет JWT и возвращает payload:
export function verifyJwtToken(token: string): JwtPayload | null {
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

// Middleware проверяет авторизацию пользователя:
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Токен приходит из HttpOnly cookie либо Authorization для API-тестов:
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: 'Not authorized' });
    // Payload должен быть подписан и не просрочен:
    const payload = verifyJwtToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
    // Пользователь должен существовать в базе:
    const user = await withDbRetry(() => prisma.user.findUnique({ where: { id: payload.sub } }));
    if (!user) return res.status(401).json({ error: 'Not authorized' });
    // Сохраняем пользователя для следующих обработчиков:
    req.user = { id: user.id, email: user.email, role: user.role };
    return next();
  } catch (error) {
    // Ошибка БД возвращается как временная недоступность:
    console.error('Auth middleware failed:', error);
    return res.status(503).json({ error: 'Database is unavailable. Try again in a minute.' });
  }
}

// Проверяет роль пользователя:
export function requireRole(...roles: string[]) {
  // Возвращаем middleware для Express:
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Пользователь должен быть добавлен requireAuth:
    const userRole = req.user?.role; // Роль из единой модели данных
    // Без роли доступ запрещен:
    if (!userRole) return res.status(403).json({ error: 'Forbidden' });
    // Роль должна входить в список разрешенных:
    if (!roles.includes(userRole)) return res.status(403).json({ error: 'Forbidden' });
    // Передаем управление дальше:
    return next();
  };
}

export async function getOptionalAuthUser(req: Request): Promise<AuthUser | null> {
  // Без токена запрос остается публичным:
  const token = getRequestToken(req);
  if (!token) return null;
  // Невалидный токен не дает прав доступа:
  const payload = verifyJwtToken(token);
  if (!payload) return null;
  // Пользователь должен существовать в базе:
  const user = await withDbRetry(() => prisma.user.findUnique({ where: { id: payload.sub } }));
  if (!user) return null;
  return { id: user.id, email: user.email, role: user.role };
}
