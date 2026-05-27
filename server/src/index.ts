import express from 'express';
import cors from 'cors'; // Разрешает запросы с другого адреса
import path from 'path';
import authRoutes from './routes/auth'; // Маршруты аутентификации
import excursionsRoutes from './routes/excursions'; // Маршруты работы с экскурсиями
import pointsRoutes from './routes/points'; // Маршруты работы с точками
import mediaRoutes from './routes/media'; // Маршруты работы с медиа
import showcaseRoutes from './routes/showcase'; // Маршруты работы с созданным сайтом
import prisma, { withDbRetry } from './db';
// Создание приложения:
const app = express();
const PORT = Number(process.env.PORT) || 3001; // Порт
// Путь к фронтенду:
const clientDistPath = path.resolve(__dirname, '..', '..', 'client', 'dist');
// Отдельный origin нужен только при раздельном размещении клиента и API:
const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : true);
// CORS и middleware:
app.use(cors({ origin: corsOrigin, credentials: true })); // Cookie разрешены только нужному origin
app.use(express.json({ limit: '50mb' }));

// Раздача загруженных файлов:
// Папка публичная:
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api/auth', authRoutes); // Маршруты аутентификации
app.use('/api/excursions', excursionsRoutes); // Маршруты экскурсий
app.use('/api/points', pointsRoutes); // Маршруты точек
app.use('/api/media', mediaRoutes); // Маршруты медиафайлов
app.use('/api/showcase', showcaseRoutes); // Маршруты созданного сайта
// Проверка, что сервер работает:
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Проверка, что БД работает:
app.get('/api/health/db', async (_req, res) => {
  try {
    // Тестовый запрос к БД:
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`, 2);
    // Если ok:
    res.json({ status: 'ok', database: 'ok', timestamp: new Date().toISOString() });
  } catch (error) { // Если ошибка
    console.error('Database health check failed:', error);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});
// Если production режим:
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDistPath)); // Файлы фронтенда
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}
// Запуск сервера:
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
