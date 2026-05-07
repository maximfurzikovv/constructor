import { Router } from 'express';
import prisma from '../db';

const router = Router();

router.get('/route/:routeId', async (req, res) => {
  const points = await prisma.point.findMany({
    where: { routeId: req.params.routeId },
    orderBy: { order: 'asc' },
    include: { media: true },
  });
  res.json({ data: points });
});

router.post('/', async (req, res) => {
  const route = await prisma.route.findUnique({ where: { id: req.body.routeId } });
  if (!route) return res.status(404).json({ error: 'Маршрут не найден' });

  const maxOrder = await prisma.point.count({ where: { routeId: req.body.routeId } });

  const point = await prisma.point.create({
    data: {
      routeId: req.body.routeId,
      title: req.body.title || 'Новая точка',
      description: req.body.description || '',
      lat: req.body.lat,
      lng: req.body.lng,
      order: maxOrder,
      duration: req.body.duration || 5,
      radius: req.body.radius || 50,
    },
  });

  // Update route geometry
  const allPoints = await prisma.point.findMany({
    where: { routeId: req.body.routeId },
    orderBy: { order: 'asc' },
  });
  const routeJson = JSON.stringify({
    type: 'LineString',
    coordinates: allPoints.map((p) => [p.lng, p.lat]),
  });
  await prisma.route.update({ where: { id: req.body.routeId }, data: { routeJson } });

  res.status(201).json({ data: { ...point, media: [] } });
});

// Batch sync: upsert points for a route, preserving media
router.put('/route/:routeId/sync', async (req, res) => {
  try {
    const { routeId } = req.params;
    const points: Array<{
      id?: string;
      title: string;
      description: string;
      lat: number;
      lng: number;
      order: number;
      duration: number;
      radius: number;
    }> = req.body.points;

    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route) return res.status(404).json({ error: 'Маршрут не найден' });

    // IDs of points that should remain
    const incomingIds = points.filter((p) => p.id).map((p) => p.id!);

    // Delete points that are no longer in the list
    await prisma.point.deleteMany({
      where: { routeId, id: { notIn: incomingIds } },
    });

    // Upsert each point: update existing, create new
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let point;
      if (p.id) {
        point = await prisma.point.update({
          where: { id: p.id },
          data: {
            title: p.title || `Точка ${i + 1}`,
            description: p.description || '',
            lat: p.lat,
            lng: p.lng,
            order: i,
            duration: p.duration || 5,
            radius: p.radius || 50,
          },
          include: { media: true },
        });
      } else {
        point = await prisma.point.create({
          data: {
            routeId,
            title: p.title || `Точка ${i + 1}`,
            description: p.description || '',
            lat: p.lat,
            lng: p.lng,
            order: i,
            duration: p.duration || 5,
            radius: p.radius || 50,
          },
          include: { media: true },
        });
      }
      result.push(point);
    }

    // Rebuild route geometry
    const routeJson = JSON.stringify({
      type: 'LineString',
      coordinates: result.map((p) => [p.lng, p.lat]),
    });
    await prisma.route.update({ where: { id: routeId }, data: { routeJson } });

    res.json({ data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Ошибка синхронизации' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const point = await prisma.point.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ data: point });
  } catch {
    res.status(404).json({ error: 'Точка не найдена' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const point = await prisma.point.findUnique({ where: { id: req.params.id } });
    if (!point) return res.status(404).json({ error: 'Точка не найдена' });

    await prisma.point.delete({ where: { id: req.params.id } });

    // Reorder remaining points
    const remaining = await prisma.point.findMany({
      where: { routeId: point.routeId },
      orderBy: { order: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i) {
        await prisma.point.update({ where: { id: remaining[i].id }, data: { order: i } });
      }
    }

    // Rebuild route geometry
    const routeJson = JSON.stringify({
      type: 'LineString',
      coordinates: remaining.map((p) => [p.lng, p.lat]),
    });
    await prisma.route.update({ where: { id: point.routeId }, data: { routeJson } });

    res.json({ data: { success: true } });
  } catch {
    res.status(404).json({ error: 'Точка не найдена' });
  }
});

export default router;
