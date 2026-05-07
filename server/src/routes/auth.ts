import { Router } from 'express';
import prisma, { withDbRetry } from '../db';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await withDbRetry(() => prisma.user.findUnique({ where: { email } }));
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      data: {
        token: 'mock-jwt-token-' + user.id,
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
  } catch (error) {
    console.error('Login failed:', error);
    res.status(503).json({ error: 'Database is unavailable. Try again in a minute.' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const user = await withDbRetry(() => prisma.user.create({
      data: { email, password, name },
    }));

    res.json({
      data: {
        token: 'mock-jwt-token-' + user.id,
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
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(400).json({ error: 'User cannot be created' });
  }
});

router.get('/me', async (_req, res) => {
  try {
    const user = await withDbRetry(() => prisma.user.findFirst());
    if (!user) return res.status(401).json({ error: 'Not authorized' });

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
  } catch (error) {
    console.error('Current user lookup failed:', error);
    res.status(503).json({ error: 'Database is unavailable. Try again in a minute.' });
  }
});

export default router;
