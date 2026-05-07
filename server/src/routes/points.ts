import { Router } from 'express';
import prisma from '../db';

const router = Router();

function buildRouteJson(points: Array<{ lng: number; lat: number }>) {
  return JSON.stringify({
    type: 'LineString',
    coordinates: points.map((point) => [point.lng, point.lat]),
  });
}

function isPersistedId(id?: string) {
  return Boolean(id && !id.startsWith('temp-'));
}

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
  if (!route) return res.status(404).json({ error: 'Route not found' });

  const maxOrder = await prisma.point.count({ where: { routeId: req.body.routeId } });

  const point = await prisma.point.create({
    data: {
      routeId: req.body.routeId,
      title: req.body.title || `Точка ${maxOrder + 1}`,
      description: req.body.description || '',
      lat: Number(req.body.lat),
      lng: Number(req.body.lng),
      order: maxOrder,
      duration: Number(req.body.duration) || 5,
      radius: Number(req.body.radius) || 50,
    },
  });

  const allPoints = await prisma.point.findMany({
    where: { routeId: req.body.routeId },
    orderBy: { order: 'asc' },
  });
  await prisma.route.update({
    where: { id: req.body.routeId },
    data: { routeJson: buildRouteJson(allPoints) },
  });

  res.status(201).json({ data: { ...point, media: [] } });
});

router.put('/route/:routeId/sync', async (req, res) => {
  try {
    const { routeId } = req.params;
    const points: Array<{
      id?: string;
      title?: string;
      description?: string;
      lat: number | string;
      lng: number | string;
      order?: number;
      duration?: number | string;
      radius?: number | string;
    }> = Array.isArray(req.body.points) ? req.body.points : [];

    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const result = await prisma.$transaction(async (tx) => {
      const incomingIds = points.filter((point) => isPersistedId(point.id)).map((point) => point.id!);

      await tx.point.deleteMany({
        where: { routeId, id: { notIn: incomingIds } },
      });

      const synced = [];
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const data = {
          title: point.title || `Точка ${index + 1}`,
          description: point.description || '',
          lat: Number(point.lat),
          lng: Number(point.lng),
          order: index,
          duration: Number(point.duration) || 5,
          radius: Number(point.radius) || 50,
        };

        let savedPoint = null;
        if (isPersistedId(point.id)) {
          const existing = await tx.point.findFirst({
            where: { id: point.id, routeId },
            select: { id: true },
          });

          if (existing) {
            savedPoint = await tx.point.update({
              where: { id: point.id },
              data,
              include: { media: true },
            });
          }
        }

        if (!savedPoint) {
          savedPoint = await tx.point.create({
            data: { ...data, routeId },
            include: { media: true },
          });
        }

        synced.push(savedPoint);
      }

      await tx.route.update({
        where: { id: routeId },
        data: { routeJson: buildRouteJson(synced) },
      });

      return synced;
    });

    res.json({ data: result });
  } catch (error: any) {
    console.error('Point sync failed:', error);
    res.status(500).json({ error: error.message || 'Point sync failed' });
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
    res.status(404).json({ error: 'Point not found' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const point = await prisma.point.findUnique({ where: { id: req.params.id } });
    if (!point) return res.status(404).json({ error: 'Point not found' });

    await prisma.point.delete({ where: { id: req.params.id } });

    const remaining = await prisma.point.findMany({
      where: { routeId: point.routeId },
      orderBy: { order: 'asc' },
    });

    for (let index = 0; index < remaining.length; index += 1) {
      if (remaining[index].order !== index) {
        await prisma.point.update({ where: { id: remaining[index].id }, data: { order: index } });
      }
    }

    await prisma.route.update({
      where: { id: point.routeId },
      data: { routeJson: buildRouteJson(remaining) },
    });

    res.json({ data: { success: true } });
  } catch {
    res.status(404).json({ error: 'Point not found' });
  }
});

export default router;
