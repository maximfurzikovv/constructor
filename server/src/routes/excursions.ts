import { Router } from 'express';
import prisma from '../db';

const router = Router();

router.get('/', async (req, res) => {
  const excursions = await prisma.excursion.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      route: {
        include: { _count: { select: { points: true } } },
      },
    },
  });
  const data = excursions.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    authorId: e.authorId,
    status: e.status,
    city: e.city,
    coverImage: e.coverImage,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    route: e.route
      ? {
          id: e.route.id,
          duration: e.route.duration,
          distance: e.route.distance,
          transport: e.route.transport,
          pointsCount: e.route._count.points,
        }
      : null,
  }));
  res.json({ data });
});

router.get('/stats', async (req, res) => {
  const [totalExcursions, publishedExcursions, totalPoints] = await Promise.all([
    prisma.excursion.count(),
    prisma.excursion.count({ where: { status: 'published' } }),
    prisma.point.count(),
  ]);
  res.json({
    data: {
      totalExcursions,
      publishedExcursions,
      totalPoints,
      totalViews: totalExcursions * 42,
    },
  });
});

router.get('/:id', async (req, res) => {
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

  // If ?published=true and snapshot exists, return snapshot data
  if (req.query.published === 'true' && excursion.publishedSnapshot) {
    return res.json({ data: JSON.parse(excursion.publishedSnapshot) });
  }

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
            duration: excursion.route.duration,
            distance: excursion.route.distance,
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

router.post('/', async (req, res) => {
  const excursion = await prisma.excursion.create({
    data: {
      title: req.body.title || 'Новая экскурсия',
      description: req.body.description || '',
      authorId: 'user-1',
      city: req.body.city || '',
      route: {
        create: {
          transport: req.body.transport || 'walk',
        },
      },
    },
    include: { route: true },
  });
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

router.put('/:id', async (req, res) => {
  const { route, createdAt, updatedAt, ...excursionData } = req.body;
  try {
    // Update excursion fields
    const excursion = await prisma.excursion.update({
      where: { id: req.params.id },
      data: excursionData,
      include: { route: true },
    });

    // Update route fields if provided
    if (route && excursion.route) {
      const routeUpdate: any = {};
      if (route.duration !== undefined) routeUpdate.duration = route.duration;
      if (route.distance !== undefined) routeUpdate.distance = route.distance;
      if (route.transport !== undefined) routeUpdate.transport = route.transport;
      if (route.routeGeo !== undefined) routeUpdate.routeJson = JSON.stringify(route.routeGeo);

      if (Object.keys(routeUpdate).length > 0) {
        await prisma.route.update({
          where: { id: excursion.route.id },
          data: routeUpdate,
        });
      }
    }

    const updated = await prisma.excursion.findUnique({
      where: { id: req.params.id },
      include: { route: true },
    });

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

router.put('/:id/publish', async (req, res) => {
  try {
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

    // Build the snapshot — same shape as GET /:id response
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
            duration: excursion.route.duration,
            distance: excursion.route.distance,
            transport: excursion.route.transport,
            points: excursion.route.points.map((p) => ({
              ...p,
              media: p.media || [],
            })),
          }
        : null,
    };

    await prisma.excursion.update({
      where: { id: req.params.id },
      data: {
        status: 'published',
        publishedSnapshot: JSON.stringify(snapshot),
      },
    });

    res.json({ data: snapshot });
  } catch {
    res.status(500).json({ error: 'Ошибка публикации' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.excursion.delete({ where: { id: req.params.id } });
    res.json({ data: { success: true } });
  } catch {
    res.status(404).json({ error: 'Экскурсия не найдена' });
  }
});

export default router;
