import { Router } from 'express';
import prisma from '../db';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  res.json({
    data: {
      token: 'mock-jwt-token-' + user.id,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar, createdAt: user.createdAt.toISOString() },
    },
  });
});

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }
  try {
    const user = await prisma.user.create({
      data: { email, password, name },
    });
    res.json({
      data: {
        token: 'mock-jwt-token-' + user.id,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar, createdAt: user.createdAt.toISOString() },
      },
    });
  } catch {
    res.status(400).json({ error: 'Пользователь с таким email уже существует' });
  }
});

router.get('/me', async (req, res) => {
  const user = await prisma.user.findFirst();
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  res.json({
    data: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar, createdAt: user.createdAt.toISOString() },
  });
});

export default router;
