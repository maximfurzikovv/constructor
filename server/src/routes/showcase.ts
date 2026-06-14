import { Router } from 'express';
import multer from 'multer';
import prisma from '../db';
import { AuthRequest, requireAuth, requireRole } from '../authSecurity';
import { normalizeSiteSlug, SiteBuilderValidationError, validateConstructorPayload } from '../siteBuilderSecurity';
import { calculateRouteMetrics } from '../routeMetrics';
import { storeMediaFile } from '../objectStorage';
import { sendShowcaseLeadEmail } from '../mailer';

const router = Router();

// Принимает изображение сайта перед загрузкой во внешнее хранилище:
const siteImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith('image/')); // Только изображения
  },
});

// Приводит пользовательский адрес сайта к безопасному slug:
function normalizeSlug(value: unknown, fallback: string) {
  // Используем общий безопасный нормализатор:
  return normalizeSiteSlug(value, fallback);
}

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

function createFallbackConstructor(site: { slug: string; title: string }) {
  return {
    siteSlug: site.slug,
    siteTitle: site.title,
    pages: [
      {
        id: 'page-main',
        title: 'Главная',
        slug: '',
        sections: [],
      },
    ],
    theme: {},
  };
}

function formatLeadPayload(fields: unknown) {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((item) => ({
      label: typeof item?.label === 'string' ? item.label.trim().slice(0, 120) : '',
      value: typeof item?.value === 'string' ? item.value.trim().slice(0, 2000) : '',
    }))
    .filter((item) => item.label && item.value);
}

function formatLead(lead: { id: string; siteId: string; authorId: string; formTitle: string; payloadJson: string; createdAt: Date }) {
  return {
    id: lead.id,
    siteId: lead.siteId,
    authorId: lead.authorId,
    formTitle: lead.formTitle,
    fields: JSON.parse(lead.payloadJson),
    createdAt: lead.createdAt.toISOString(),
  };
}

// Проверяет, занят ли адрес другим сайтом:
async function isSlugTaken(slug: string, siteId: string) {
  const existing = await prisma.showcaseSite.findFirst({
    where: { slug, id: { not: siteId } },
    select: { id: true },
  }); // Другой сайт с таким адресом
  return Boolean(existing); // Результат проверки
}

// Возвращает черновые данные конструктора для редактора:
router.get('/constructor/data', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  // Автор сайта берется из JWT:
  const userId = req.user!.id;
  // Ищем личный сайт авторизованного пользователя:
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: userId } });
  // Если личный сайт еще не создан, возвращаем null:
  if (!site) {
    return res.json({ data: null });
  }
  const siteMeta = {
    siteId: site.id,
    siteTitle: site.title,
    siteSlug: site.slug,
    sitePublished: site.published,
    siteModerationComment: site.moderationComment,
    siteModerationStatus: site.status,
  };
  // Если JSON конструктора еще не создан, возвращаем только личный slug:
  if (!site.constructorJson) {
    return res.json({ data: siteMeta });
  }
  // constructorJson хранит структуру страниц, секций, колонок, элементов и темы:
  const data = JSON.parse(site.constructorJson);
  // siteSlug добавляется для совместимости со старыми сохраненными данными:
  res.json({ data: { ...siteMeta, ...data, siteSlug: data.siteSlug || site.slug } });
});

// Проверяет доступность адреса сайта при вводе в конструкторе:
router.get('/constructor/slug-availability', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: req.user!.id } }); // Сайт автора
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const slug = normalizeSlug(req.query.slug, site.slug); // Проверяемый адрес
  const taken = await isSlugTaken(slug, site.id); // Занятость адреса

  res.json({ data: { slug, available: !taken } }); // Состояние адреса
});

// Загружает изображение конструктора во внешнее хранилище:
router.post('/constructor/asset/upload', requireAuth, requireRole('guide'), siteImageUpload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Выберите изображение' }); // Выбранный файл

  const site = await prisma.showcaseSite.findFirst({
    where: { authorId: req.user!.id },
    select: { id: true },
  }); // Сайт автора
  if (!site) return res.status(404).json({ error: 'Site not found' });

  try {
    const stored = await storeMediaFile(req.file, req.user!.id, `site-${site.id}`); // URL изображения
    return res.status(201).json({ data: { url: stored.url } }); // Ссылка для JSON сайта
  } catch (error) {
    console.error('Site image upload failed:', error); // Причина ошибки
    return res.status(503).json({ error: 'Не удалось сохранить изображение' });
  }
});

// Отправляет сайт из конструктора на модерацию:
router.put('/constructor', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  // Отправляем сайт текущего автора на проверку администратором:
  const userId = req.user!.id;
  // Находим сайт текущего автора:
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: userId } });
  if (!site) return res.status(404).json({ error: 'Site not found' });

  // Нормализуем адрес, который пользователь указал в настройках сайта:
  const slug = normalizeSlug(req.body.siteSlug, site.slug);
  // Не разрешаем публикацию на адресе другого сайта:
  if (await isSlugTaken(slug, site.id)) {
    return res.status(409).json({ error: 'Этот адрес сайта уже занят' });
  }
  // Проверяем данные конструктора:
  let payload;
  try {
    payload = validateConstructorPayload(req.body, slug);
  } catch (error) {
    // Возвращаем понятную ошибку:
    if (error instanceof SiteBuilderValidationError) return res.status(error.statusCode).json({ error: error.message });
    // Неизвестную ошибку скрываем:
    return res.status(500).json({ error: 'Ошибка проверки конструктора' });
  }
  // Сохраняем структуру конструктора в JSON-строку:
  const json = JSON.stringify(payload);

  try {
    // Сайт становится заявкой на модерацию, а публичная версия появится только после решения администратора:
    await prisma.$transaction([
      prisma.showcaseSite.update({
        where: { id: site.id },
        data: {
          constructorJson: json,
          published: false,
          status: 'review',
          moderationComment: null,
          slug,
        },
      }),
      prisma.showcaseSitePublication.create({
        data: {
          siteId: site.id,
          snapshotJson: json,
          status: 'review',
        },
      }),
    ]);
  } catch (error: any) {
    // Уникальный индекс защищает от одновременного выбора slug:
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Этот адрес сайта уже занят' });
    throw error;
  }

  // Клиент получает slug, но публичным сайт станет только после решения администратора:
  res.json({ data: { success: true, slug, status: 'review' } });
});

// Возвращает историю заявок сайта-витрины:
router.get('/constructor/publications', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  const site = await prisma.showcaseSite.findFirst({
    where: { authorId: req.user!.id },
    select: { id: true },
  });
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const publications = await prisma.showcaseSitePublication.findMany({
    where: { siteId: site.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      siteId: true,
      snapshotJson: true,
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

// Возвращает последние заявки, отправленные через публичную форму сайта автора:
router.get('/constructor/leads', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  const site = await prisma.showcaseSite.findFirst({
    where: { authorId: req.user!.id },
    select: { id: true },
  });
  if (!site) return res.json({ data: [] });

  const leads = await prisma.showcaseLead.findMany({
    where: { siteId: site.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  res.json({ data: leads.map(formatLead) });
});

// Сохраняет черновик конструктора без публикации:
router.put('/constructor/draft', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  // Черновик сохраняется для текущего автора:
  const userId = req.user!.id;
  // Ищем сайт автора:
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: userId } });
  if (!site) return res.status(404).json({ error: 'Site not found' });

  // Даже в черновике slug нормализуется, чтобы не сохранить неправильный URL:
  const slug = normalizeSlug(req.body.siteSlug, site.slug);
  // Не разрешаем сохранить занятый адрес:
  if (await isSlugTaken(slug, site.id)) {
    return res.status(409).json({ error: 'Этот адрес сайта уже занят' });
  }
  // Проверяем данные конструктора:
  let payload;
  try {
    payload = validateConstructorPayload(req.body, slug);
  } catch (error) {
    // Возвращаем понятную ошибку:
    if (error instanceof SiteBuilderValidationError) return res.status(error.statusCode).json({ error: error.message });
    // Неизвестную ошибку скрываем:
    return res.status(500).json({ error: 'Ошибка проверки конструктора' });
  }

  try {
    // publishedJson не меняется, поэтому публичный сайт остается прежним:
    const nextStatus = site.published ? site.status : 'draft';
    await prisma.showcaseSite.update({
      where: { id: site.id },
      data: {
        constructorJson: JSON.stringify(payload),
        slug,
        status: nextStatus,
      },
    });
  } catch (error: any) {
    // Уникальный индекс защищает от одновременного выбора slug:
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Этот адрес сайта уже занят' });
    throw error;
  }

  // Возвращаем успех и актуальный slug:
  res.json({ data: { success: true, slug } });
});

// Возвращает опубликованный сайт по slug:
router.get('/:slug', async (req, res) => {
  // Сначала ищем сайт по адресу из URL:
  const site = await prisma.showcaseSite.findUnique({
    where: { slug: req.params.slug },
  });

  // Неопубликованный сайт не должен открываться посетителю:
  if (!site || !site.published) return res.status(404).json({ error: 'Site not found' });

  // Берем только опубликованные экскурсии автора:
  const publishedExcursions = await prisma.excursion.findMany({
    where: { status: 'published', authorId: site.authorId },
    include: {
      route: {
        include: { points: { orderBy: { order: 'asc' } } },
      },
      reviews: { where: { published: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  // Приводим экскурсии к короткому формату для карточек публичного сайта:
  const excursionDetails = publishedExcursions.map((e) => {
    // Если есть snapshot, публичная карточка строится по опубликованной версии:
    if (e.publishedSnapshot) {
      const snap = JSON.parse(e.publishedSnapshot);
      // Показатели карточки фиксируются в опубликованной версии:
      const metrics = snap.route?.distance > 0
        ? { duration: snap.route.duration, distance: snap.route.distance }
        : (snap.route?.points ? calculateRouteMetrics(snap.route.points) : { duration: 0, distance: 0 });
      return {
        id: snap.id,
        title: snap.title,
        description: snap.description,
        city: snap.city,
        coverImage: snap.coverImage || e.coverImage,
        duration: metrics.duration,
        distance: metrics.distance,
        transport: snap.route?.transport || 'walk',
        status: snap.status,
        reviews: e.reviews.map(formatReview),
      };
    }
    // Без snapshot используем сохраненные показатели маршрута:
    const route = e.route; // Маршрут экскурсии
    const metrics = route && route.distance > 0
      ? { duration: route.duration, distance: route.distance }
      : (route ? calculateRouteMetrics(route.points) : { duration: 0, distance: 0 });
    // Если snapshot нет, используем текущие данные из базы:
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      city: e.city,
      coverImage: e.coverImage,
      duration: metrics.duration,
      distance: metrics.distance,
      transport: route?.transport || 'walk',
      status: e.status,
      reviews: e.reviews.map(formatReview),
    };
  });

  // Публичный сайт показывает publishedJson или безопасную структуру для старых demo-данных:
  const constructorData = site.publishedJson ? JSON.parse(site.publishedJson) : createFallbackConstructor(site);

  // Собираем полный ответ для публичной витрины:
  res.json({
    data: {
      id: site.id,
      authorId: site.authorId,
      slug: site.slug,
      title: site.title,
      description: site.description,
      theme: site.theme,
      published: site.published,
      createdAt: site.createdAt.toISOString(),
      excursionDetails,
      constructorData: { ...constructorData, siteSlug: constructorData.siteSlug || site.slug },
    },
  });
});

// Принимает заявку с публичной формы сайта и сохраняет ее у автора:
router.post('/:slug/leads', async (req, res) => {
  try {
    const site = await prisma.showcaseSite.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        authorId: true,
        published: true,
        author: {
          select: {
            email: true,
          },
        },
        publishedJson: true,
      },
    });

    if (!site || !site.published) return res.status(404).json({ error: 'Site not found' });

    const formTitle = typeof req.body.formTitle === 'string' ? req.body.formTitle.trim().slice(0, 160) : '';
    const fields = formatLeadPayload(req.body.fields);

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Заполните хотя бы одно поле формы' });
    }

    const recipientFromPayload = typeof req.body.recipientEmail === 'string' ? req.body.recipientEmail.trim().toLowerCase() : '';
    let recipientEmail = recipientFromPayload || site.author.email;

    if (!recipientEmail && site.publishedJson) {
      try {
        const publishedData = JSON.parse(site.publishedJson);
        const pages = Array.isArray(publishedData?.pages) ? publishedData.pages : [];
        for (const page of pages) {
          const sections = Array.isArray(page?.sections) ? page.sections : [];
          for (const section of sections) {
            const columns = Array.isArray(section?.columns) ? section.columns : [];
            for (const column of columns) {
              const elements = Array.isArray(column?.elements) ? column.elements : [];
              for (const element of elements) {
                if (element?.type === 'form' && String(element?.data?.heading || '') === formTitle) {
                  const candidate = String(element?.data?.recipientEmail || '').trim().toLowerCase();
                  if (candidate) recipientEmail = candidate;
                }
              }
            }
          }
        }
      } catch {
        // fallback остается на email автора
      }
    }

    if (!recipientEmail) {
      return res.status(400).json({ error: 'Для формы не настроен email получателя' });
    }

    const lead = await prisma.showcaseLead.create({
      data: {
        siteId: site.id,
        authorId: site.authorId,
        formTitle,
        payloadJson: JSON.stringify(fields),
      },
    });

    await sendShowcaseLeadEmail({
      to: recipientEmail,
      siteSlug: req.params.slug,
      formTitle,
      fields,
    });

    return res.status(201).json({
      data: {
        id: lead.id,
        createdAt: lead.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Showcase lead submit failed:', error);
    return res.status(503).json({
      error: error?.message === 'SMTP is not configured'
        ? 'SMTP не настроен. Укажите SMTP-переменные окружения на сервере.'
        : 'Не удалось отправить форму. Проверьте настройки SMTP и лог сервера.',
    });
  }
});

// Обновляет базовые настройки витрины старого формата:
router.put('/', requireAuth, requireRole('guide'), async (req: AuthRequest, res) => {
  // Базовые настройки меняет только владелец сайта:
  const userId = req.user!.id;
  // Ищем сайт автора:
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: userId } });
  if (!site) return res.status(404).json({ error: 'Site not found' });
  // Берем только разрешенные поля:
  const data = {
    title: typeof req.body.title === 'string' ? req.body.title.slice(0, 120) : undefined,
    description: typeof req.body.description === 'string' ? req.body.description.slice(0, 500) : undefined,
    theme: req.body.theme === 'dark' || req.body.theme === 'light' ? req.body.theme : undefined,
    heroImage: typeof req.body.heroImage === 'string' ? req.body.heroImage.slice(0, 4000) : undefined,
  };
  // Убираем undefined-поля:
  Object.keys(data).forEach((key) => data[key as keyof typeof data] === undefined && delete data[key as keyof typeof data]);
  // Обновляем переданные поля:
  const updated = await prisma.showcaseSite.update({
    where: { id: site.id },
    data,
  });
  // Возвращаем обновленную запись:
  res.json({ data: updated });
});

// Экспортируем router для index.ts:
export default router;
