import { Router } from 'express';
import prisma from '../db';
import { AuthRequest, getOptionalAuthUser, requireAuth, requireRole } from '../authSecurity';
import { calculateRouteMetrics } from '../routeMetrics';
// Маршрутизатор:
const router = Router(); // API-маршруты
// GET получение списка экскурсий:
router.get('/', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Текущий автор берется из JWT:
  const userId = req.user!.id;
  // Запрос всех экскурсий:
  const excursions = await prisma.excursion.findMany({
    where: { authorId: userId },
    orderBy: { updatedAt: 'desc' }, // По дате обновления
    include: {
      route: { // А также все маршруты и точки
        include: { points: { orderBy: { order: 'asc' } } },
      },
    },
  });
  // Массив объектов для ответа API:
  const data = excursions.map((e) => {
    // В списке метрики также считаются по фактическим точкам:
    const metrics = e.route ? calculateRouteMetrics(e.route.points) : null;

    return {
      id: e.id,
      title: e.title,
      description: e.description,
      authorId: e.authorId,
      status: e.status,
      city: e.city,
      coverImage: e.coverImage,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      route: e.route // Если маршрут есть
        ? {
            id: e.route.id,
            duration: metrics!.duration,
            distance: metrics!.distance,
            transport: e.route.transport,
            pointsCount: e.route.points.length,
          }
        : null,
    };
  });
  res.json({ data }); // Возврат списка экскурсий
});

// GET статистики для дашборда:
router.get('/stats', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Статистика считается только по данным текущего автора:
  const userId = req.user!.id;
  // Считаем несколько показателей параллельно:
  const [totalExcursions, publishedExcursions, totalPoints, totalMedia] = await Promise.all([
    // Общее количество экскурсий:
    prisma.excursion.count({ where: { authorId: userId } }),
    // Количество опубликованных экскурсий:
    prisma.excursion.count({ where: { authorId: userId, status: 'published' } }),
    // Общее количество точек маршрутов:
    prisma.point.count({ where: { route: { excursion: { authorId: userId } } } }),
    // Общее количество медиафайлов:
    prisma.media.count({ where: { excursion: { authorId: userId } } }),
  ]);
  // Возвращаем агрегированные данные:
  res.json({
    data: {
      totalExcursions,
      publishedExcursions,
      totalPoints,
      totalMedia,
    },
  });
});

// GET одной экскурсии по id:
router.get('/:id', async (req, res) => {
  // Ищем экскурсию вместе с маршрутом, точками и медиа:
  const excursion = await prisma.excursion.findUnique({
    where: { id: req.params.id },
    include: {
      route: {
        include: {
          points: { orderBy: { order: 'asc' }, include: { media: true } },
        },
      },
    },
  });
  if (!excursion) return res.status(404).json({ error: 'Экскурсия не найдена' });

  // Черновик может читать только его автор:
  const authUser = await getOptionalAuthUser(req);
  if (excursion.status !== 'published' && authUser?.id !== excursion.authorId) {
    return res.status(404).json({ error: 'Excursion not found' });
  }

  // If ?published=true and snapshot exists, return snapshot data:
  // Для публичного просмотра берем опубликованный snapshot:
  if (req.query.published === 'true' && excursion.publishedSnapshot) {
    const snapshot = JSON.parse(excursion.publishedSnapshot);
    // Старые публикации также получают актуальный расчет по точкам:
    const metrics = snapshot.route?.points ? calculateRouteMetrics(snapshot.route.points) : null;
    return res.json({
      data: metrics ? { ...snapshot, route: { ...snapshot.route, ...metrics } } : snapshot,
    });
  }

  // Метрики вычисляются по фактически сохраненным точкам:
  const routeMetrics = excursion.route ? calculateRouteMetrics(excursion.route.points) : null;
  // Иначе собираем текущие данные из базы:
  res.json({
    data: {
      id: excursion.id,
      title: excursion.title,
      description: excursion.description,
      authorId: excursion.authorId,
      status: excursion.status,
      city: excursion.city,
      coverImage: excursion.coverImage,
      createdAt: excursion.createdAt.toISOString(),
      updatedAt: excursion.updatedAt.toISOString(),
      route: excursion.route
        ? {
            id: excursion.route.id,
            excursionId: excursion.id,
            routeGeo: JSON.parse(excursion.route.routeJson),
            duration: routeMetrics!.duration,
            distance: routeMetrics!.distance,
            transport: excursion.route.transport,
            points: excursion.route.points.map((p) => ({
              ...p,
              media: p.media || [],
            })),
          }
        : null,
    },
  });
});

// POST создания новой экскурсии:
router.post('/', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Новая экскурсия привязывается к текущему пользователю:
  const userId = req.user!.id;
  // Создаем экскурсию и сразу создаем пустой маршрут:
  const excursion = await prisma.excursion.create({
    data: {
      title: req.body.title || 'Новая экскурсия',
      description: req.body.description || '',
      authorId: userId,
      city: req.body.city || '',
      route: {
        create: {
          transport: req.body.transport || 'walk',
        },
      },
    },
    include: { route: true },
  });
  // Возвращаем созданную экскурсию клиенту:
  res.status(201).json({
    data: {
      id: excursion.id,
      title: excursion.title,
      description: excursion.description,
      authorId: excursion.authorId,
      status: excursion.status,
      city: excursion.city,
      coverImage: excursion.coverImage,
      createdAt: excursion.createdAt.toISOString(),
      updatedAt: excursion.updatedAt.toISOString(),
      route: excursion.route
        ? {
            id: excursion.route.id,
            excursionId: excursion.id,
            routeGeo: JSON.parse(excursion.route.routeJson),
            duration: excursion.route.duration,
            distance: excursion.route.distance,
            transport: excursion.route.transport,
            points: [],
          }
        : null,
    },
  });
});

// PUT обновления экскурсии:
router.put('/:id', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Обновлять можно только свои экскурсии:
  const userId = req.user!.id;
  // Отделяем route от основных полей экскурсии:
  const { route, createdAt, updatedAt, ...excursionData } = req.body;
  try {
    const existing = await prisma.excursion.findFirst({
      where: { id: req.params.id, authorId: userId },
      include: { route: true },
    });
    if (!existing) return res.status(404).json({ error: 'Excursion not found' });
    // Update excursion fields:
    // Обновляем основные поля экскурсии:
    const excursion = await prisma.excursion.update({
      where: { id: existing.id },
      data: excursionData,
      include: { route: true },
    });

    // Update route fields if provided:
    // Если клиент прислал route, обновляем поля маршрута отдельно:
    if (route && excursion.route) {
      // routeUpdate собирается только из реально переданных полей:
      const routeUpdate: any = {};
      if (route.duration !== undefined) routeUpdate.duration = route.duration;
      if (route.distance !== undefined) routeUpdate.distance = route.distance;
      if (route.transport !== undefined) routeUpdate.transport = route.transport;
      if (route.routeGeo !== undefined) routeUpdate.routeJson = JSON.stringify(route.routeGeo);

      // Если есть что обновлять, сохраняем route:
      if (Object.keys(routeUpdate).length > 0) {
        await prisma.route.update({
          where: { id: excursion.route.id },
          data: routeUpdate,
        });
      }
    }

    // Перечитываем запись после обновления:
    const updated = await prisma.excursion.findUnique({
      where: { id: existing.id },
      include: { route: true },
    });

    // Возвращаем обновленную экскурсию:
    res.json({
      data: {
        id: updated!.id,
        title: updated!.title,
        description: updated!.description,
        authorId: updated!.authorId,
        status: updated!.status,
        city: updated!.city,
        coverImage: updated!.coverImage,
        createdAt: updated!.createdAt.toISOString(),
        updatedAt: updated!.updatedAt.toISOString(),
        route: updated!.route
          ? {
              id: updated!.route.id,
              excursionId: updated!.id,
              routeGeo: JSON.parse(updated!.route.routeJson),
              duration: updated!.route.duration,
              distance: updated!.route.distance,
              transport: updated!.route.transport,
            }
          : null,
      },
    });
  } catch {
    res.status(404).json({ error: 'Экскурсия не найдена' });
  }
});

// PUT публикации экскурсии:
router.put('/:id/publish', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Публиковать можно только свою экскурсию:
  const userId = req.user!.id;
  try {
    // Берем экскурсию со всеми точками и медиа для snapshot:
    const excursion = await prisma.excursion.findUnique({
      where: { id: req.params.id },
      include: {
        route: {
          include: {
            points: { orderBy: { order: 'asc' }, include: { media: true } },
          },
        },
      },
    });
    if (!excursion) return res.status(404).json({ error: 'Экскурсия не найдена' });

    // Build the snapshot — same shape as GET /:id response:
    // Snapshot фиксирует публичную версию экскурсии:
    // Проверяем владельца перед публикацией:
    if (excursion.authorId !== userId) return res.status(404).json({ error: 'Excursion not found' });

    // Для публикации используем расчет по сохраненным точкам:
    const routeMetrics = excursion.route ? calculateRouteMetrics(excursion.route.points) : null;
    const snapshot = {
      id: excursion.id,
      title: excursion.title,
      description: excursion.description,
      authorId: excursion.authorId,
      status: 'published',
      city: excursion.city,
      coverImage: excursion.coverImage,
      createdAt: excursion.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
      route: excursion.route
        ? {
            id: excursion.route.id,
            excursionId: excursion.id,
            routeGeo: JSON.parse(excursion.route.routeJson),
            duration: routeMetrics!.duration,
            distance: routeMetrics!.distance,
            transport: excursion.route.transport,
            points: excursion.route.points.map((p) => ({
              ...p,
              media: p.media || [],
            })),
          }
        : null,
    };

    // Обновляем snapshot и сохраненные показатели маршрута вместе:
    await prisma.$transaction([
      prisma.excursion.update({
        where: { id: req.params.id },
        data: {
          status: 'published',
          publishedSnapshot: JSON.stringify(snapshot),
        },
      }),
      ...(excursion.route && routeMetrics
        ? [prisma.route.update({ where: { id: excursion.route.id }, data: routeMetrics })]
        : []),
    ]);

    // Возвращаем опубликованную версию:
    res.json({ data: snapshot });
  } catch {
    res.status(500).json({ error: 'Ошибка публикации' });
  }
});

router.delete('/:id', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Удалять можно только свои экскурсии:
  const userId = req.user!.id;
  try {
    // Сначала проверяем, что экскурсия принадлежит текущему автору:
    const existing = await prisma.excursion.findFirst({ where: { id: req.params.id, authorId: userId } });
    if (!existing) return res.status(404).json({ error: 'Excursion not found' });
    await prisma.excursion.delete({ where: { id: existing.id } });
    res.json({ data: { success: true } });
  } catch {
    res.status(404).json({ error: 'Экскурсия не найдена' });
  }
});

export default router;
