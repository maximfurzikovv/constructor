import { Router } from 'express';
import prisma, { withDbRetry } from '../db';
import { AuthRequest, clearAuthCookie, createAuthCookie, createJwtToken, hashPassword, requireAuth, verifyPassword } from '../authSecurity';

// Маршруты API:
const router = Router();

// Формирует данные пользователя для ответа:
function toResponseUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    createdAt: user.createdAt.toISOString(),
  }; // Публичная часть профиля
}

// POST-маршрут входа:
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body; // Данные формы
    if (!email || !password) {
      return res.status(400).json({ error: 'Введите email и пароль' });
    } // Проверка заполнения

    const normalizedEmail = String(email).trim().toLowerCase(); // Нормализованная почта
    const user = await withDbRetry(() => prisma.user.findUnique({ where: { email: normalizedEmail } })); // Пользователь
    if (!user || !verifyPassword(String(password), user.password)) {
      return res.status(401).json({ error: 'Неверная почта или пароль' });
    } // Проверка пароля

    const token = createJwtToken(user); // JWT пользователя
    res.setHeader('Set-Cookie', createAuthCookie(token)); // HttpOnly cookie

    return res.json({
      data: {
        token,
        user: toResponseUser(user),
      },
    }); // Ответ входа
  } catch (error) {
    console.error('Login failed:', error); // Ошибка входа
    return res.status(503).json({ error: 'Database is unavailable. Try again in a minute.' });
  }
});

// POST-маршрут регистрации:
router.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword, name } = req.body; // Данные формы
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Заполните имя, email и пароль' });
    } // Проверка заполнения

    const normalizedEmail = String(email).trim().toLowerCase(); // Нормализованная почта
    const normalizedName = String(name).trim(); // Имя пользователя
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Формат почты
    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Введите корректный email' });
    } // Проверка почты
    if (!normalizedName) {
      return res.status(400).json({ error: 'Введите имя' });
    } // Проверка имени
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Пароль должен содержать не менее 8 символов' });
    } // Проверка длины
    if (typeof confirmPassword === 'string' && password !== confirmPassword) {
      return res.status(400).json({ error: 'Пароли не совпадают' });
    } // Проверка повтора

    const existingUser = await withDbRetry(() => prisma.user.findUnique({ where: { email: normalizedEmail } })); // Существующий аккаунт
    if (existingUser) {
      return res.status(409).json({ error: 'Пользователь с такой почтой уже зарегистрирован' });
    } // Проверка занятости почты

    const user = await withDbRetry(() => prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashPassword(String(password)),
        name: normalizedName,
        role: 'guide',
        showcaseSites: {
          create: {
            slug: `site-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: normalizedName,
            description: '',
            published: false,
          },
        },
      },
    })); // Новый автор с личным сайтом

    const token = createJwtToken(user); // JWT пользователя
    res.setHeader('Set-Cookie', createAuthCookie(token)); // HttpOnly cookie

    return res.json({
      data: {
        token,
        user: toResponseUser(user),
      },
    }); // Ответ регистрации
  } catch (error: any) {
    console.error('Registration failed:', error); // Ошибка регистрации
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Пользователь с такой почтой уже зарегистрирован' });
    } // Одновременная регистрация
    return res.status(400).json({ error: 'Не удалось создать пользователя' });
  }
});

// GET-маршрут текущего пользователя:
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await withDbRetry(() => prisma.user.findUnique({ where: { id: req.user!.id } })); // Пользователь сессии
    if (!user) return res.status(401).json({ error: 'Not authorized' });
    return res.json({ data: toResponseUser(user) }); // Текущий профиль
  } catch (error) {
    console.error('Current user lookup failed:', error); // Ошибка поиска
    return res.status(503).json({ error: 'Database is unavailable. Try again in a minute.' });
  }
});

// POST-маршрут выхода:
router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearAuthCookie()); // Очистка сессии
  res.json({ data: { success: true } }); // Ответ выхода
});

// Экспорт по умолчанию:
export default router;
