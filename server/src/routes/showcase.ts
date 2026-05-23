import { Router } from 'express';
import prisma from '../db';
import { AuthRequest, requireAuth, requireRole } from '../authSecurity';
import { normalizeSiteSlug, SiteBuilderValidationError, validateConstructorPayload } from '../siteBuilderSecurity';

const router = Router();

// Приводит пользовательский адрес сайта к безопасному slug:
function normalizeSlug(value: unknown, fallback: string) {
  // Используем общий безопасный нормализатор:
  return normalizeSiteSlug(value, fallback);
}

// Возвращает черновые данные конструктора для редактора:
router.get('/constructor/data', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Автор сайта берется из JWT:
  const userId = req.user!.id;
  // Сейчас используется демонстрационный автор user-1:
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: userId } });
  // Если сайт или JSON конструктора еще не создан, возвращаем null:
  if (!site || !site.constructorJson) {
    return res.json({ data: null });
  }
  // constructorJson хранит структуру страниц, секций, колонок, элементов и темы:
  const data = JSON.parse(site.constructorJson);
  // siteSlug добавляется для совместимости со старыми сохраненными данными:
  res.json({ data: { ...data, siteSlug: data.siteSlug || site.slug } });
});

// Публикует сайт из конструктора:
router.put('/constructor', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Публикуем сайт текущего автора:
  const userId = req.user!.id;
  // Находим сайт текущего автора:
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: userId } });
  if (!site) return res.status(404).json({ error: 'Site not found' });

  // Нормализуем адрес, который пользователь указал в настройках сайта:
  const slug = normalizeSlug(req.body.siteSlug, site.slug);
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

  // При публикации черновик и опубликованная версия становятся одинаковыми:
  await prisma.showcaseSite.update({
    where: { id: site.id },
    data: {
      constructorJson: json,
      publishedJson: json,
      published: true,
      slug,
    },
  });

  // Клиент получает slug, чтобы показать ссылку на опубликованный сайт:
  res.json({ data: { success: true, slug } });
});

// Сохраняет черновик конструктора без публикации:
router.put('/constructor/draft', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Черновик сохраняется для текущего автора:
  const userId = req.user!.id;
  // Ищем сайт автора:
  const site = await prisma.showcaseSite.findFirst({ where: { authorId: userId } });
  if (!site) return res.status(404).json({ error: 'Site not found' });

  // Даже в черновике slug нормализуется, чтобы не сохранить неправильный URL:
  const slug = normalizeSlug(req.body.siteSlug, site.slug);
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

  // publishedJson не меняется, поэтому публичный сайт остается прежним:
  await prisma.showcaseSite.update({
    where: { id: site.id },
    data: {
      constructorJson: JSON.stringify(payload),
      slug,
    },
  });

  // Возвращаем успех и актуальный slug:
  res.json({ data: { success: true, slug } });
});

// Возвращает опубликованный сайт по slug:
router.get('/:slug', async (req, res) => {
  // Сначала ищем сайт по адресу из URL:
  let site = await prisma.showcaseSite.findUnique({
    where: { slug: req.params.slug },
  });

  // Совместимость со старым адресом maxim-furzikov:
  if (!site && req.params.slug === 'maxim-furzikov') {
    // Если сайт автора есть, назначаем ему ожидаемый slug:
    const current = await prisma.showcaseSite.findFirst({ where: { authorId: 'user-1' } });
    if (current) {
      site = await prisma.showcaseSite.update({
        where: { id: current.id },
        data: { slug: 'maxim-furzikov', title: 'Экскурсии Максима Фурзикова' },
      });
    }
  }

  // Если сайт не найден, публичная страница не открывается:
  if (!site) return res.status(404).json({ error: 'Site not found' });

  // Берем только опубликованные экскурсии автора:
  const publishedExcursions = await prisma.excursion.findMany({
    where: { status: 'published', authorId: site.authorId },
    include: {
      route: {
        include: { _count: { select: { points: true } } },
      },
    },
  });

  // Приводим экскурсии к короткому формату для карточек публичного сайта:
  const excursionDetails = publishedExcursions.map((e) => {
    // Если есть snapshot, публичная карточка строится по опубликованной версии:
    if (e.publishedSnapshot) {
      const snap = JSON.parse(e.publishedSnapshot);
      return {
        id: snap.id,
        title: snap.title,
        description: snap.description,
        city: snap.city,
        duration: snap.route?.duration || 0,
        distance: snap.route?.distance || 0,
        transport: snap.route?.transport || 'walk',
        status: snap.status,
      };
    }
    // Если snapshot нет, используем текущие данные из базы:
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      city: e.city,
      duration: e.route?.duration || 0,
      distance: e.route?.distance || 0,
      transport: e.route?.transport || 'walk',
      status: e.status,
    };
  });

  // Публичный сайт должен показывать только publishedJson:
  const constructorData = site.published
    ? (site.publishedJson ? JSON.parse(site.publishedJson) : (site.constructorJson ? JSON.parse(site.constructorJson) : null))
    : null;

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
      constructorData: constructorData ? { ...constructorData, siteSlug: constructorData.siteSlug || site.slug } : null,
    },
  });
});

// Обновляет базовые настройки витрины старого формата:
router.put('/', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
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
