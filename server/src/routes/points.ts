import { Router } from 'express';
import prisma from '../db';
import { AuthRequest, requireAuth, requireRole } from '../authSecurity';

const router = Router();

// Проверяет, что маршрут принадлежит текущему пользователю:
async function findOwnedRoute(routeId: string, userId: string) {
  return prisma.route.findFirst({
    where: { id: routeId, excursion: { authorId: userId } },
  });
}

// Проверяет, что точка принадлежит текущему пользователю:
async function findOwnedPoint(pointId: string, userId: string) {
  return prisma.point.findFirst({
    where: { id: pointId, route: { excursion: { authorId: userId } } },
  });
}

// Собирает GeoJSON-линию маршрута из текущего порядка точек:
function buildRouteJson(points: Array<{ lng: number; lat: number }>) {
  // В базе routeJson хранится строкой, поэтому объект превращается в JSON:
  return JSON.stringify({
    // LineString означает линию маршрута через несколько координат:
    type: 'LineString',
    // В GeoJSON порядок координат именно [долгота, широта]:
    coordinates: points.map((point) => [point.lng, point.lat]),
  });
}

// Проверяет, что id уже существует в базе, а не является временным id клиента:
function isPersistedId(id?: string) {
  // В редакторе новые точки сначала получают id вида temp-:
  return Boolean(id && !id.startsWith('temp-'));
}

// Возвращает точки одного маршрута в порядке прохождения:
router.get('/route/:routeId', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Точки маршрута доступны только владельцу экскурсии:
  const route = await findOwnedRoute(req.params.routeId, req.user!.id);
  if (!route) return res.status(404).json({ error: 'Route not found' });
  // Подгружаем media сразу, чтобы редактору не делать второй запрос:
  const points = await prisma.point.findMany({
    where: { routeId: req.params.routeId },
    orderBy: { order: 'asc' },
    include: { media: true },
  });
  res.json({ data: points });
});

// Создает одну новую точку маршрута:
router.post('/', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Проверяем, что маршрут существует:
  const route = await findOwnedRoute(req.body.routeId, req.user!.id);
  if (!route) return res.status(404).json({ error: 'Route not found' });

  // Количество точек используется как следующий order:
  const maxOrder = await prisma.point.count({ where: { routeId: req.body.routeId } });

  // Создаем точку с координатами и настройками активации:
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

  // После создания перечитываем точки, чтобы обновить линию маршрута:
  const allPoints = await prisma.point.findMany({
    where: { routeId: req.body.routeId },
    orderBy: { order: 'asc' },
  });
  // routeJson нужен для хранения общей линии маршрута:
  await prisma.route.update({
    where: { id: req.body.routeId },
    data: { routeJson: buildRouteJson(allPoints) },
  });

  res.status(201).json({ data: { ...point, media: [] } });
});

// Полностью синхронизирует точки маршрута после редактирования:
router.put('/route/:routeId/sync', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  try {
    // routeId приходит из URL:
    const { routeId } = req.params;
    // points приходит из тела запроса и должен быть массивом:
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

    // Нельзя синхронизировать точки несуществующего маршрута:
    const route = await findOwnedRoute(routeId, req.user!.id);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    // Все операции выполняются в транзакции, чтобы маршрут не сохранился наполовину:
    const result = await prisma.$transaction(async (tx) => {
      // Список id, которые клиент оставил в маршруте:
      const incomingIds = points.filter((point) => isPersistedId(point.id)).map((point) => point.id!);

      // Удаляем точки, которые были в базе, но исчезли на клиенте:
      await tx.point.deleteMany({
        where: { routeId, id: { notIn: incomingIds } },
      });

      // Здесь будет итоговый список сохраненных точек:
      const synced = [];
      // Порядок массива на клиенте становится порядком прохождения маршрута:
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        // Данные нормализуются перед сохранением в PostgreSQL:
        const data = {
          title: point.title || `Точка ${index + 1}`,
          description: point.description || '',
          lat: Number(point.lat),
          lng: Number(point.lng),
          order: index,
          duration: Number(point.duration) || 5,
          radius: Number(point.radius) || 50,
        };

        // savedPoint останется пустым, если нужно создать новую точку:
        let savedPoint = null;
        // Для существующих точек сначала пробуем update:
        if (isPersistedId(point.id)) {
          // Проверяем, что точка действительно принадлежит этому маршруту:
          const existing = await tx.point.findFirst({
            where: { id: point.id, routeId },
            select: { id: true },
          });

          // Если точка есть, обновляем ее:
          if (existing) {
            savedPoint = await tx.point.update({
              where: { id: point.id },
              data,
              include: { media: true },
            });
          }
        }

        // Если id был временным или запись не найдена, создаем новую точку:
        if (!savedPoint) {
          savedPoint = await tx.point.create({
            data: { ...data, routeId },
            include: { media: true },
          });
        }

        // Добавляем сохраненную точку в итоговый массив:
        synced.push(savedPoint);
      }

      // После синхронизации точек пересобираем GeoJSON маршрута:
      await tx.route.update({
        where: { id: routeId },
        data: { routeJson: buildRouteJson(synced) },
      });

      // Возвращаем результат из транзакции:
      return synced;
    });

    // Клиент получает точки уже с настоящими id:
    res.json({ data: result });
  } catch (error: any) {
    // Лог нужен, чтобы видеть причину ошибки в консоли или Render logs:
    console.error('Point sync failed:', error);
    res.status(500).json({ error: error.message || 'Point sync failed' });
  }
});

// Обновляет одну конкретную точку:
router.put('/:id', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  try {
    const existing = await findOwnedPoint(req.params.id, req.user!.id);
    if (!existing) return res.status(404).json({ error: 'Point not found' });
    // req.body содержит поля, которые пришли из формы редактирования:
    const point = await prisma.point.update({
      where: { id: req.params.id },
      data: req.body,
    });
    // Возвращаем обновленную точку:
    res.json({ data: point });
  } catch {
    // Если id не найден, Prisma выбросит ошибку:
    res.status(404).json({ error: 'Point not found' });
  }
});

// Удаляет точку и пересчитывает порядок оставшихся точек:
router.delete('/:id', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  try {
    // Сначала ищем точку, потому что нужен routeId:
    const point = await findOwnedPoint(req.params.id, req.user!.id);
    if (!point) return res.status(404).json({ error: 'Point not found' });

    // Удаляем точку из базы:
    await prisma.point.delete({ where: { id: req.params.id } });

    // Получаем оставшиеся точки маршрута:
    const remaining = await prisma.point.findMany({
      where: { routeId: point.routeId },
      orderBy: { order: 'asc' },
    });

    // Перенумеровываем order без пропусков:
    for (let index = 0; index < remaining.length; index += 1) {
      if (remaining[index].order !== index) {
        await prisma.point.update({ where: { id: remaining[index].id }, data: { order: index } });
      }
    }

    // Обновляем линию маршрута после удаления точки:
    await prisma.route.update({
      where: { id: point.routeId },
      data: { routeJson: buildRouteJson(remaining) },
    });

    // Сообщаем клиенту, что операция выполнена:
    res.json({ data: { success: true } });
  } catch {
    // Ошибку удаления показываем как отсутствие точки:
    res.status(404).json({ error: 'Point not found' });
  }
});

export default router;
