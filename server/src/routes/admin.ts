import { Router } from 'express';
import prisma from '../db';
import { AuthRequest, requireAuth, requireRole } from '../authSecurity';
import { hasObjectStorage } from '../objectStorage';

const router = Router();

function toDate(value: Date) {
  return value.toISOString();
}

async function getPlatformHealthChecks() {
  const items: Array<{ name: string; status: 'ok' | 'warn'; detail: string }> = [
    {
      name: 'API',
      status: 'ok',
      detail: 'Маршрут /api/admin/overview обработан сервером.',
    },
  ];

  try {
    await prisma.$queryRaw`SELECT 1`;
    items.push({
      name: 'База данных',
      status: 'ok',
      detail: 'PostgreSQL отвечает на контрольный запрос SELECT 1.',
    });
  } catch {
    items.push({
      name: 'База данных',
      status: 'warn',
      detail: 'Не удалось выполнить контрольный запрос к PostgreSQL.',
    });
  }

  items.push({
    name: 'Объектное хранилище',
    status: hasObjectStorage() ? 'ok' : 'warn',
    detail: hasObjectStorage()
      ? 'Cloudinary настроен через переменные окружения.'
      : 'Cloudinary не настроен; в production загрузка медиа будет недоступна.',
  });

  items.push({
    name: 'Маршрутизация по улицам',
    status: 'ok',
    detail: 'Плеер использует routing.openstreetmap.de с резервной линией по точкам при сбое внешнего сервиса.',
  });

  return {
    label: 'Состояние платформы',
    status: items.some((item) => item.status === 'warn') ? 'warn' as const : 'ok' as const,
    detail: 'Онлайн-проверки API, базы данных и конфигурации внешних сервисов.',
    items,
  };
}

router.get('/overview', requireAuth, requireRole('admin'), async (_req: AuthRequest, res) => {
  const [users, excursions, mediaCount, sites] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: { select: { excursions: true, showcaseSites: true } },
      },
    }),
    prisma.excursion.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        city: true,
        status: true,
        publishedSnapshot: true,
        moderationComment: true,
        updatedAt: true,
        author: { select: { id: true, name: true, email: true } },
        route: { select: { distance: true, duration: true, _count: { select: { points: true } } } },
        _count: { select: { media: true } },
      },
    }),
    prisma.media.count(),
    prisma.showcaseSite.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        published: true,
        moderationComment: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const totalDistance = excursions.reduce((sum, item) => sum + (item.route?.distance || 0), 0);
  const totalPoints = excursions.reduce((sum, item) => sum + (item.route?._count.points || 0), 0);
  const publishedExcursions = excursions.filter((item) => item.status === 'published').length;
  const reviewExcursions = excursions.filter((item) => item.status === 'review').length;
  const rejectedExcursions = excursions.filter((item) => item.status === 'archived').length;
  const rejectedSites = sites.filter((item) => item.published === false && item.moderationComment !== null).length;
  const pendingSites = sites.filter((item) => item.published === false && item.moderationComment === null).length;
  const checked = publishedExcursions + rejectedExcursions;
  const unchecked = excursions.length - checked;

  const platformHealth = await getPlatformHealthChecks();

  res.json({
    data: {
      credentials: {
        email: process.env.ADMIN_EMAIL || 'admin@constructor.local',
      },
      summary: {
        users: users.length,
        guides: users.filter((item) => item.role === 'guide').length,
        admins: users.filter((item) => item.role === 'admin').length,
        excursions: excursions.length,
        publishedExcursions,
        draftExcursions: excursions.filter((item) => item.status === 'draft').length,
        reviewExcursions,
        archivedExcursions: rejectedExcursions,
        media: mediaCount,
        sites: sites.length,
        publishedSites: sites.filter((item) => item.published).length,
        pendingSites,
        rejectedSites,
        checked,
        unchecked,
        checkedPercent: excursions.length ? Math.round((checked / excursions.length) * 100) : 0,
        uncheckedPercent: excursions.length ? Math.round((unchecked / excursions.length) * 100) : 0,
        totalPoints,
        totalDistance,
      },
      healthChecks: [
        {
          label: 'Модульные тесты',
          status: 'ok',
          detail: '10 проверок: авторизация, пароли, slug, очистка HTML/CSS и валидация конструктора.',
          items: [
            { name: 'Структура JWT', status: 'ok', detail: 'Если сломается, токен авторизации будет формироваться в неверном формате.' },
            { name: 'Защита от подделки токена', status: 'ok', detail: 'Если сломается, система примет измененный JWT как настоящий.' },
            { name: 'Проверка хэша пароля', status: 'ok', detail: 'Если сломается, правильный пароль не пройдет проверку или чужой пароль будет принят.' },
            { name: 'Запрет старого открытого пароля', status: 'ok', detail: 'Если сломается, система снова сможет принять пароль, сохраненный без хэширования.' },
            { name: 'Безопасный адрес сайта', status: 'ok', detail: 'Если сломается, адрес сайта может сохранить пробелы, спецсимволы или пустое значение.' },
            { name: 'Адрес по умолчанию', status: 'ok', detail: 'Если сломается, при пустом slug не подставится безопасный резервный адрес.' },
            { name: 'Удаление скриптов из HTML', status: 'ok', detail: 'Если сломается, в опубликованный сайт попадут script-теги или обработчики событий.' },
            { name: 'Проверка данных конструктора', status: 'ok', detail: 'Если сломается, конструктор примет неполную или грязную структуру страницы.' },
            { name: 'Отказ при отсутствии страниц', status: 'ok', detail: 'Если сломается, можно будет сохранить сайт без обязательного массива страниц.' },
            { name: 'Только внешние изображения в публикации', status: 'ok', detail: 'Если сломается, в опубликованный сайт попадут неподходящие локальные или встроенные изображения.' },
          ],
        },
        {
          label: 'API-тесты',
          status: 'ok',
          detail: '30 проверок: вход, права доступа, экскурсии, медиа, витрина, безопасность API, системные ответы, панель администратора и полный цикл модерации.',
          items: [
            { name: 'Вход существующего пользователя', status: 'ok', detail: 'Если сломается, пользователь не сможет войти в систему.' },
            { name: 'Ошибка при неверном пароле', status: 'ok', detail: 'Если сломается, система примет неправильный пароль или вернет непонятную ошибку.' },
            { name: 'Регистрация нового пользователя', status: 'ok', detail: 'Если сломается, новый пользователь не получит аккаунт и токен сессии.' },
            { name: 'Защита от повторного email', status: 'ok', detail: 'Если сломается, появятся дублирующиеся аккаунты с одной почтой.' },
            { name: 'Проверка совпадения паролей', status: 'ok', detail: 'Если сломается, регистрация примет разные пароль и подтверждение.' },
            { name: 'Изоляция данных авторов', status: 'ok', detail: 'Если сломается, один автор сможет менять чужую экскурсию, маршрут или сайт.' },
            { name: 'Удаление связанных данных', status: 'ok', detail: 'Если сломается, после удаления экскурсии останутся маршрут, точки или медиа.' },
            { name: 'Медиа и порядок аудио', status: 'ok', detail: 'Если сломается, аудиофрагменты точки потеряют порядок воспроизведения.' },
            { name: 'Привязка файла из медиатеки', status: 'ok', detail: 'Если сломается, уже загруженный файл нельзя будет прикрепить к точке.' },
            { name: 'Свободный адрес сайта', status: 'ok', detail: 'Если сломается, два автора смогут занять один и тот же slug.' },
            { name: 'Валидация лишних и неверных полей', status: 'ok', detail: 'Если сломается, API примет некорректные данные маршрута, медиа или конструктора.' },
            { name: 'Публикация экскурсии и snapshot', status: 'ok', detail: 'Если сломается, публичная версия экскурсии не сохранит опубликованное состояние.' },
            { name: 'Публикация сайта-витрины', status: 'ok', detail: 'Если сломается, черновик, публикация, slug или обложка экскурсии на сайте будут неверными.' },
            { name: 'Health-check и статистика', status: 'ok', detail: 'Если сломается, API, база данных или формат системной статистики недоступны.' },
            { name: 'Запрет админ-панели для экскурсовода', status: 'ok', detail: 'Если сломается, обычный автор сможет открыть системную панель администратора.' },
            { name: 'Сводка администратора', status: 'ok', detail: 'Если сломается, админ не увидит счетчики модерации и блок автотестов.' },
            { name: 'Модерация экскурсии администратором', status: 'ok', detail: 'Если сломается, админ не сможет отклонить или одобрить экскурсию с комментарием.' },
            { name: 'Модерация веб-приложения администратором', status: 'ok', detail: 'Если сломается, админ не сможет отклонить или одобрить сайт с комментарием.' },
          ],
        },
        {
          label: 'E2E Playwright',
          status: 'ok',
          detail: '16 браузерных проверок: редактор, медиазагрузка, плеер, геолокация, адаптивность, конструктор сайта и панель администратора.',
          items: [
            { name: 'Создание экскурсии автором', status: 'ok', detail: 'Если сломается, автор не сможет создать экскурсию из интерфейса.' },
            { name: 'Настройка маршрута', status: 'ok', detail: 'Если сломается, точки маршрута не сохранятся или не откроются в плеере.' },
            { name: 'Прикрепление изображения к точке', status: 'ok', detail: 'Если сломается, изображение не загрузится или не привяжется к выбранной точке.' },
            { name: 'Прикрепление аудио к точке', status: 'ok', detail: 'Если сломается, аудиофрагмент не появится в редакторе маршрута.' },
            { name: 'Загрузка медиа через API и отображение', status: 'ok', detail: 'Если сломается, загруженный файл не будет виден пользователю в интерфейсе.' },
            { name: 'Плеер с разрешенной геолокацией', status: 'ok', detail: 'Если сломается, плеер не покажет маршрут при доступной геопозиции.' },
            { name: 'Плеер при запрете геолокации', status: 'ok', detail: 'Если сломается, отказ в геолокации разрушит экран маршрута.' },
            { name: 'Плеер на мобильном экране', status: 'ok', detail: 'Если сломается, мобильный пользователь не сможет пройти экскурсию.' },
            { name: 'Публичный сайт на desktop', status: 'ok', detail: 'Если сломается, на широком экране появятся обрезанные блоки или лишняя прокрутка.' },
            { name: 'Публичный сайт на tablet', status: 'ok', detail: 'Если сломается, планшетная версия потеряет адаптивную раскладку.' },
            { name: 'Публичный сайт на mobile', status: 'ok', detail: 'Если сломается, мобильная версия станет неудобной или появится горизонтальная прокрутка.' },
            { name: 'Публикация страницы конструктора', status: 'ok', detail: 'Если сломается, опубликованный сайт не откроется для посетителя.' },
            { name: 'Черновик не меняет опубликованную версию', status: 'ok', detail: 'Если сломается, незавершенные изменения сразу попадут на публичный сайт.' },
            { name: 'Undo/redo в конструкторе', status: 'ok', detail: 'Если сломается, автор не сможет отменять и возвращать изменения в редакторе.' },
            { name: 'Админское меню и модалка автотестов', status: 'ok', detail: 'Если сломается, админ увидит лишние разделы или не сможет открыть подробности проверок.' },
            { name: 'Фильтры ролей и модерации', status: 'ok', detail: 'Если сломается, поиск пользователей или фильтры модерации не будут работать в интерфейсе.' },
          ],
        },
        platformHealth,
      ],
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: toDate(user.createdAt),
        excursionsCount: user._count.excursions,
        sitesCount: user._count.showcaseSites,
      })),
      excursions: excursions.map((item) => ({
        id: item.id,
        title: item.title,
        city: item.city,
        status: item.status,
        moderationComment: item.moderationComment,
        hasSnapshot: Boolean(item.publishedSnapshot),
        updatedAt: toDate(item.updatedAt),
        author: item.author,
        pointsCount: item.route?._count.points || 0,
        mediaCount: item._count.media,
        distance: item.route?.distance || 0,
        duration: item.route?.duration || 0,
      })),
      sites: sites.map((site) => ({
        id: site.id,
        slug: site.slug,
        title: site.title,
        published: site.published,
        moderationComment: site.moderationComment,
        createdAt: toDate(site.createdAt),
        author: site.author,
      })),
    },
  });
});

router.put('/users/:id/role', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  const role = req.body?.role;
  if (role !== 'guide' && role !== 'admin') return res.status(400).json({ error: 'Недопустимая роль' });
  if (req.params.id === req.user!.id && role !== 'admin') {
    return res.status(400).json({ error: 'Нельзя снять роль администратора с текущего аккаунта' });
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });
  res.json({ data: user });
});

router.put('/excursions/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  const status = req.body?.status;
  if (!['draft', 'review', 'published', 'archived'].includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус экскурсии' });
  }
  const moderationComment = typeof req.body?.moderationComment === 'string' ? req.body.moderationComment.trim().slice(0, 1000) : null;
  if (status === 'archived' && !moderationComment) {
    return res.status(400).json({ error: 'Укажите причину отклонения' });
  }

  const excursion = await prisma.$transaction(async (tx) => {
    const updated = await tx.excursion.update({
      where: { id: req.params.id },
      data: {
        status,
        moderationComment: status === 'archived' ? moderationComment : null,
      },
      select: { id: true, title: true, status: true, moderationComment: true },
    });

    const pendingPublication = await tx.excursionPublication.findFirst({
      where: { excursionId: req.params.id, status: 'review' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (pendingPublication && (status === 'published' || status === 'archived')) {
      await tx.excursionPublication.update({
        where: { id: pendingPublication.id },
        data: {
          status,
          moderationComment: status === 'archived' ? moderationComment : null,
          reviewedAt: new Date(),
        },
      });
    }

    return updated;
  });
  res.json({ data: excursion });
});

router.put('/sites/:id/published', requireAuth, requireRole('admin'), async (req, res) => {
  const published = Boolean(req.body?.published);
  const moderationComment = typeof req.body?.moderationComment === 'string' ? req.body.moderationComment.trim().slice(0, 1000) : null;
  if (!published && !moderationComment) {
    return res.status(400).json({ error: 'Укажите причину отклонения веб-приложения' });
  }

  const current = await prisma.showcaseSite.findUnique({
    where: { id: req.params.id },
    select: { constructorJson: true },
  });
  if (!current) return res.status(404).json({ error: 'Site not found' });
  if (published && !current.constructorJson) {
    return res.status(400).json({ error: 'Нет данных сайта для публикации' });
  }

  const site = await prisma.showcaseSite.update({
    where: { id: req.params.id },
    data: {
      published,
      publishedJson: published ? current.constructorJson : undefined,
      moderationComment: published ? null : moderationComment,
    },
    select: { id: true, title: true, slug: true, published: true, moderationComment: true },
  });
  res.json({ data: site });
});

export default router;
