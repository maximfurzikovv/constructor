import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../db';
import { AuthRequest, requireAuth, requireRole } from '../authSecurity';

const router = Router();
// Разрешенные типы медиафайлов:
const allowedMimePrefixes = ['image/', 'audio/'];
// Максимальный размер файла в байтах:
const maxUploadSize = 8 * 1024 * 1024;

// Проверяет, что MIME-тип можно сохранять:
function isAllowedMime(mimetype: string) {
  return allowedMimePrefixes.some((prefix) => mimetype.startsWith(prefix));
}

// Проверяет, что экскурсия принадлежит текущему пользователю:
async function findOwnedExcursion(excursionId: string, userId: string) {
  return prisma.excursion.findFirst({ where: { id: excursionId, authorId: userId } });
}

// Проверяет, что точка принадлежит указанной экскурсии:
async function isPointInsideExcursion(pointId: string | null | undefined, excursionId: string) {
  if (!pointId) return true;
  const point = await prisma.point.findFirst({
    where: { id: pointId, route: { excursionId } },
    select: { id: true },
  });
  return Boolean(point);
}

// Old local uploads remain readable, but new demo uploads are DB-backed:
// Папка нужна для совместимости со старыми файлами, которые могли храниться на диске:
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
// Если папки еще нет, создаем ее при старте сервера:
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer принимает файл из multipart/form-data:
const upload = multer({
  // В бесплатном деплое файл удобнее держать в памяти и потом сохранить в базе:
  storage: multer.memoryStorage(),
  // Ограничение 8 МБ защищает сервер от слишком тяжелых загрузок:
  limits: { fileSize: maxUploadSize },
  // Фильтр отсекает неподдерживаемые типы файлов:
  fileFilter: (_req, file, callback) => {
    callback(null, isAllowedMime(file.mimetype));
  },
});

// Возвращает список медиафайлов:
router.get('/', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // excursionId позволяет отфильтровать файлы конкретной экскурсии:
  const { excursionId } = req.query;
  // Пользователь видит только свои медиафайлы:
  const userId = req.user!.id;
  // Если excursionId нет, возвращаются все медиа:
  const media = await prisma.media.findMany({
    where: {
      excursion: { authorId: userId },
      ...(excursionId ? { excursionId: excursionId as string } : {}),
    },
    // Новые файлы показываются первыми:
    orderBy: { createdAt: 'desc' },
  });
  // Единый формат ответа API:
  res.json({ data: media });
});

// Возвращает один медиафайл по id:
router.get('/:id', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Ищем запись в таблице Media:
  const item = await prisma.media.findFirst({
    where: { id: req.params.id, excursion: { authorId: req.user!.id } },
  });
  // Если записи нет, возвращаем 404:
  if (!item) return res.status(404).json({ error: 'Media not found' });
  // Возвращаем найденный файл:
  res.json({ data: item });
});

// Загружает реальный файл через multipart/form-data:
router.post('/upload', requireAuth, requireRole('guide', 'admin'), upload.single('file'), async (req: AuthRequest, res) => {
  // Без файла загрузка не имеет смысла:
  if (!req.file) return res.status(400).json({ error: 'File is required' });
  // MIME-тип должен быть изображением или аудио:
  if (!isAllowedMime(req.file.mimetype)) return res.status(400).json({ error: 'Unsupported file type' });
  // Дополнительная проверка размера дублирует multer-limit:
  if (req.file.size > maxUploadSize) return res.status(400).json({ error: 'File is too large' });
  // Каждый медиафайл должен быть привязан к экскурсии:
  if (!req.body.excursionId) return res.status(400).json({ error: 'excursionId is required' });
  // Экскурсия должна принадлежать текущему пользователю:
  const excursion = await findOwnedExcursion(req.body.excursionId, req.user!.id);
  if (!excursion) return res.status(404).json({ error: 'Excursion not found' });
  // Точка должна входить в эту же экскурсию:
  if (!(await isPointInsideExcursion(req.body.pointId, excursion.id))) {
    return res.status(400).json({ error: 'Point does not belong to excursion' });
  }

  // Файл кодируется в data URL, чтобы храниться прямо в PostgreSQL:
  const url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  // Тип определяется по MIME type загруженного файла:
  const type = req.file.mimetype.startsWith('image/') ? 'image' : 'audio';

  // Создаем запись медиа в базе:
  const item = await prisma.media.create({
    data: {
      excursionId: req.body.excursionId,
      pointId: req.body.pointId || null,
      type,
      url,
      title: req.body.title || req.file.originalname,
      description: req.body.description || null,
    },
  });
  // 201 означает, что файл создан:
  res.status(201).json({ data: item });
});

// Создает медиа-запись без загрузки файла, например по готовому URL:
router.post('/', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  // Медиа без файла тоже должно относиться к своей экскурсии:
  const excursion = await findOwnedExcursion(req.body.excursionId, req.user!.id);
  if (!excursion) return res.status(404).json({ error: 'Excursion not found' });
  if (!(await isPointInsideExcursion(req.body.pointId, excursion.id))) {
    return res.status(400).json({ error: 'Point does not belong to excursion' });
  }
  // Берем значения из тела запроса и задаем fallback:
  const item = await prisma.media.create({
    data: {
      excursionId: req.body.excursionId,
      pointId: req.body.pointId || null,
      type: req.body.type || 'image',
      url: req.body.url || '',
      title: req.body.title || 'Untitled',
      description: req.body.description,
    },
  });
  // Возвращаем созданную запись:
  res.status(201).json({ data: item });
});

// Обновляет подпись, описание или привязку медиа:
router.put('/:id', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.media.findFirst({
      where: { id: req.params.id, excursion: { authorId: req.user!.id } },
    });
    if (!existing) return res.status(404).json({ error: 'Media not found' });
    if (!(await isPointInsideExcursion(req.body.pointId, existing.excursionId))) {
      return res.status(400).json({ error: 'Point does not belong to excursion' });
    }
    // Обновляем только редактируемые поля:
    const item = await prisma.media.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        description: req.body.description,
        // undefined означает не трогать поле, null означает отвязать от точки:
        pointId: req.body.pointId === undefined ? undefined : req.body.pointId || null,
      },
    });
    // Отдаем обновленную запись:
    res.json({ data: item });
  } catch {
    // Ошибка Prisma превращается в понятный ответ API:
    res.status(500).json({ error: 'Failed to update media' });
  }
});

// Удаляет медиафайл:
router.delete('/:id', requireAuth, requireRole('guide', 'admin'), async (req: AuthRequest, res) => {
  try {
    // Сначала ищем запись, чтобы понять, есть ли файл:
    const item = await prisma.media.findFirst({
      where: { id: req.params.id, excursion: { authorId: req.user!.id } },
    });
    if (!item) return res.status(404).json({ error: 'Media not found' });

    // Если файл старого формата лежит в uploads, удаляем его с диска:
    if (item.url.startsWith('/uploads/')) {
      const filePath = path.join(uploadsDir, path.basename(item.url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Удаляем запись из базы:
    await prisma.media.delete({ where: { id: req.params.id } });
    // Клиенту возвращается простой признак успеха:
    res.json({ data: { success: true } });
  } catch {
    // При ошибке удаления возвращаем 500:
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// Экспортируем router для подключения в index.ts:
export default router;
