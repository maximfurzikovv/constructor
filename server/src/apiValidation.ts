import { z } from 'zod';

// Ошибка некорректного запроса API:
export class ApiValidationError extends Error {
  statusCode = 400;
}

// Разрешенные состояния экскурсии:
const excursionStatusSchema = z.enum(['draft', 'review', 'published', 'archived']);

// Разрешенные способы передвижения:
const transportSchema = z.enum(['walk', 'bus', 'metro', 'car', 'bike']);

// Ограничивает обычное текстовое поле:
const text = (max: number) => z.string().trim().max(max);

// Проверяет ссылку медиа или локальный формат для тестов:
const mediaUrlSchema = z.string().trim().min(1).max(12_000_000).refine((value) => {
  return value.startsWith('https://') || value.startsWith('/uploads/') || value.startsWith('data:image/') || value.startsWith('data:audio/');
}, 'Недопустимый адрес медиафайла');

// Координаты точки:
const latitudeSchema = z.coerce.number().finite().min(-90).max(90);
const longitudeSchema = z.coerce.number().finite().min(-180).max(180);

// Параметры одной точки:
const pointFieldsSchema = z.object({
  title: text(200).optional(),
  description: text(20_000).optional(),
  lat: latitudeSchema,
  lng: longitudeSchema,
  duration: z.coerce.number().int().min(0).max(1440).optional(),
  radius: z.coerce.number().int().min(1).max(5000).optional(),
}).strict();

// Создание экскурсии:
export const excursionCreateSchema = z.object({
  title: text(200).optional(),
  description: text(20_000).optional(),
  city: text(200).optional(),
  transport: transportSchema.optional(),
}).strict();

// Изменение экскурсии:
export const excursionUpdateSchema = z.object({
  title: text(200).optional(),
  description: text(20_000).optional(),
  city: text(200).optional(),
  coverImage: mediaUrlSchema.nullable().optional(),
  status: excursionStatusSchema.optional(),
  route: z.object({
    transport: transportSchema.optional(),
    duration: z.coerce.number().int().min(0).optional(),
    distance: z.coerce.number().min(0).optional(),
  }).strict().optional(),
}).strict();

// Создание точки:
export const pointCreateSchema = pointFieldsSchema.extend({
  routeId: z.string().uuid(),
}).strict();

// Изменение одной точки:
export const pointUpdateSchema = pointFieldsSchema.partial().strict();

// Точка в полной синхронизации маршрута:
export const syncedPointSchema = pointFieldsSchema.extend({
  id: z.string().optional(),
  order: z.coerce.number().int().min(0).optional(),
}).strict();

// Синхронизация точек:
export const pointsSyncSchema = z.object({
  points: z.array(syncedPointSchema).max(500),
}).strict();

// Поля multipart-загрузки медиа:
export const mediaUploadFieldsSchema = z.object({
  excursionId: z.string().uuid(),
  pointId: z.string().uuid().optional(),
  title: text(200).optional(),
  description: text(1000).optional(),
}).strict();

// Создание медиа по готовому адресу:
export const mediaCreateSchema = z.object({
  excursionId: z.string().uuid(),
  pointId: z.string().uuid().nullable().optional(),
  type: z.enum(['image', 'audio']),
  url: mediaUrlSchema,
  title: text(200).optional(),
  description: text(1000).nullable().optional(),
}).strict();

// Редактирование данных медиа:
export const mediaUpdateSchema = z.object({
  pointId: z.string().uuid().nullable().optional(),
  title: text(200).optional(),
  description: text(1000).nullable().optional(),
}).strict();

// Возвращает только проверенные поля запроса:
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body); // Результат проверки
  if (parsed.success) return parsed.data;

  const message = parsed.error.issues[0]?.message || 'Некорректные данные запроса'; // Первая причина
  throw new ApiValidationError(message);
}
