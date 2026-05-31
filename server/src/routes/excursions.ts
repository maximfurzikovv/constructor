import { Router } from 'express';
import prisma from '../db';
import { AuthRequest, getOptionalAuthUser, requireAuth, requireRole } from '../authSecurity';
import { calculateRouteMetrics, calculateWalkingRouteMetrics } from '../routeMetrics';
import { removeStoredMedia } from '../objectStorage';
import { ApiValidationError, excursionCreateSchema, excursionUpdateSchema, parseBody } from '../apiValidation';

function formatReview(review: { id: string; excursionId: string; authorName: string; rating: number; text: string; published: boolean; createdAt: Date }) {
  return {
    id: review.id,
    excursionId: review.excursionId,
    authorName: review.authorName,
    rating: review.rating,
    text: review.text,
    published: review.published,
    createdAt: review.createdAt.toISOString(),
  };
}

function sanitizeReviewBody(body: any) {
  const authorName = String(body?.authorName || '').trim().slice(0, 80);
  const text = String(body?.text || '').trim().slice(0, 1200);
  const rating = Number(body?.rating);
  if (!authorName) return { error: 'Укажите имя' };
  if (!text || text.length < 10) return { error: 'Отзыв должен быть не короче 10 символов' };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Оценка должна быть от 1 до 5' };
  return { authorName, text, rating };
}
// Маршрутизатор:
const router = Router(); // API-маршруты

// Возвращает сохраненные метрики либо резервный расчет старых данных:
function readRouteMetrics(route: { duration: number; distance: number; points: Array<{ lat: number; lng: number; duration?: number | null }> }) {
  if (route.distance > 0) return { duration: route.duration, distance: route.distance };
  return calculateRouteMetrics(route.points); // Резерв для маршрута без пересчета
}
// GET получение списка экскурсий:
router.get('/', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
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
      reviews: { where: { published: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  // Массив объектов для ответа API:
  const data = excursions.map((e) => {
    // В списке показываются сохраненные показатели пешего маршрута:
    const metrics = e.route ? readRouteMetrics(e.route) : null;

    return {
      id: e.id,
      title: e.title,
      description: e.description,
      authorId: e.authorId,
      status: e.status,
      city: e.city,
      coverImage: e.coverImage,
      moderationComment: e.moderationComment,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      reviews: e.reviews.map(formatReview),
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
router.get('/stats', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
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
router.get('/:id/reviews', async (req, res) => {
  const excursion = await prisma.excursion.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true },
  });
  if (!excursion || excursion.status !== 'published') return res.status(404).json({ error: 'Excursion not found' });

  const reviews = await prisma.review.findMany({
    where: { excursionId: excursion.id, published: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: reviews.map(formatReview) });
});

router.post('/:id/reviews', async (req, res) => {
  const payload = sanitizeReviewBody(req.body);
  if ('error' in payload) return res.status(400).json({ error: payload.error });

  const excursion = await prisma.excursion.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true },
  });
  if (!excursion || excursion.status !== 'published') return res.status(404).json({ error: 'Excursion not found' });

  const review = await prisma.review.create({
    data: {
      excursionId: excursion.id,
      authorName: payload.authorName,
      rating: payload.rating,
      text: payload.text,
    },
  });
  res.status(201).json({ data: formatReview(review) });
});

router.get('/:id/publications', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  const excursion = await prisma.excursion.findFirst({
    where: { id: req.params.id, authorId: req.user!.id },
    select: { id: true },
  });
  if (!excursion) return res.status(404).json({ error: 'Excursion not found' });

  const publications = await prisma.excursionPublication.findMany({
    where: { excursionId: excursion.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      excursionId: true,
      status: true,
      moderationComment: true,
      createdAt: true,
      reviewedAt: true,
    },
  });

  res.json({
    data: publications.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
    })),
  });
});

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
      reviews: { where: { published: true }, orderBy: { createdAt: 'desc' } },
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
    // Для старой публикации с нулевыми показателями используется резервный расчет:
    if (snapshot.route && !snapshot.route.distance && Array.isArray(snapshot.route.points)) {
      const metrics = calculateRouteMetrics(snapshot.route.points); // Показатели по гаверсинусу
      snapshot.route = { ...snapshot.route, ...metrics }; // Исправленный ответ
    }
    return res.json({ data: { ...snapshot, reviews: excursion.reviews.map(formatReview) } }); // Публичная версия экскурсии
  }

  // Метрики берутся из сохраненного пешего маршрута:
  const routeMetrics = excursion.route ? readRouteMetrics(excursion.route) : null;
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
      moderationComment: excursion.moderationComment,
      createdAt: excursion.createdAt.toISOString(),
      updatedAt: excursion.updatedAt.toISOString(),
      reviews: excursion.reviews.map(formatReview),
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
router.post('/', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  // Новая экскурсия привязывается к текущему пользователю:
  const userId = req.user!.id;
  let payload;
  try {
    payload = parseBody(excursionCreateSchema, req.body); // Проверенные поля экскурсии
  } catch (error) {
    if (error instanceof ApiValidationError) return res.status(error.statusCode).json({ error: error.message });
    return res.status(400).json({ error: 'Некорректные данные экскурсии' });
  }
  // Создаем экскурсию и сразу создаем пустой маршрут:
  const excursion = await prisma.excursion.create({
    data: {
      title: payload.title || 'Новая экскурсия',
      description: payload.description || '',
      authorId: userId,
      city: payload.city || '',
      route: {
        create: {
          transport: payload.transport || 'walk',
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
      moderationComment: excursion.moderationComment,
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
router.put('/:id', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  // Обновлять можно только свои экскурсии:
  const userId = req.user!.id;
  let payload;
  try {
    payload = parseBody(excursionUpdateSchema, req.body); // Разрешенные поля формы
  } catch (error) {
    if (error instanceof ApiValidationError) return res.status(error.statusCode).json({ error: error.message });
    return res.status(400).json({ error: 'Некорректные данные экскурсии' });
  }
  // Отделяем route от разрешенных полей экскурсии:
  const { route, ...excursionData } = payload;
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

    // Если клиент прислал route, обновляем только выбранный вид передвижения:
    if (route && excursion.route) {
      const routeUpdate: { transport?: string } = {};
      if (route.transport !== undefined) routeUpdate.transport = route.transport;

      // Геометрия и показатели меняются только при синхронизации точек:
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
        moderationComment: updated!.moderationComment,
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
router.put('/:id/publish', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
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

    // Перед публикацией получаем показатели пешего маршрута по улицам:
    const routeMetrics = excursion.route ? await calculateWalkingRouteMetrics(excursion.route.points) : null;
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

    const snapshotJson = JSON.stringify(snapshot);

    // Обновляем snapshot, сохраняем заявку на модерацию и показатели маршрута вместе:
    await prisma.$transaction([
      prisma.excursion.update({
        where: { id: req.params.id },
        data: {
          status: 'review',
          moderationComment: null,
          publishedSnapshot: snapshotJson,
        },
      }),
      prisma.excursionPublication.create({
        data: {
          excursionId: req.params.id,
          snapshotJson,
          status: 'review',
        },
      }),
      ...(excursion.route && routeMetrics
        ? [prisma.route.update({ where: { id: excursion.route.id }, data: routeMetrics })]
        : []),
    ]);

    // Возвращаем состояние заявки; публичной экскурсия станет после решения администратора:
    res.json({ data: { ...snapshot, status: 'review' } });
  } catch {
    res.status(500).json({ error: 'Ошибка публикации' });
  }
});

router.delete('/:id', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  // Удалять можно только свои экскурсии:
  const userId = req.user!.id;
  try {
    // Сначала проверяем, что экскурсия принадлежит текущему автору:
    const existing = await prisma.excursion.findFirst({
      where: { id: req.params.id, authorId: userId },
      include: { media: { select: { storageKey: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Excursion not found' });

    // Удаляем бинарные объекты экскурсии из Cloudinary:
    await Promise.all(existing.media.map((item) => removeStoredMedia(item.storageKey)));

    // Каскад базы удаляет маршрут, точки и записи медиа:
    await prisma.excursion.delete({ where: { id: existing.id } });
    res.json({ data: { success: true } });
  } catch {
    res.status(404).json({ error: 'Экскурсия не найдена' });
  }
});

export default router;
