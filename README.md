# Конструктор веб-приложений для экскурсий

Веб-система для создания, оформления и публикации индивидуальных экскурсий.

**Рабочая версия:** [constructor-buac.onrender.com](https://constructor-buac.onrender.com)

## Возможности

- создание экскурсий и маршрутов на интерактивной карте;
- добавление точек интереса, изображений и аудиоматериалов;
- расчёт расстояния и продолжительности маршрута;
- визуальный конструктор сайта автора;
- публикация экскурсий и прохождение маршрута в браузере;
- модерация материалов и управление ролями;
- адаптивный интерфейс для компьютеров и мобильных устройств.

## Технологии

- React, TypeScript, Vite;
- Node.js, Express;
- Prisma ORM, PostgreSQL;
- JWT, HttpOnly cookies, PBKDF2;
- Leaflet и OpenStreetMap;
- Render, Neon PostgreSQL, Cloudinary;
- Playwright и `node:test`.

## Структура проекта

```text
client/   React-приложение
server/   Express API и Prisma
shared/   общие TypeScript-типы
tests/    unit, API и E2E-тесты
```

## Локальный запуск

Требуются Node.js 22 и PostgreSQL.

```bash
npm install
```

Создайте `.env` на основе `.env.example` и укажите:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
NODE_ENV="development"
JWT_SECRET="уникальная-случайная-строка-не-короче-32-символов"
```

Подготовьте базу и запустите приложение:

```bash
npm run db:push --workspace=server
npm run dev:server
```

В другом терминале:

```bash
npm run dev:client
```

Клиент будет доступен по адресу `http://localhost:5173`.

## Создание администратора

В проекте нет стандартного администратора и резервного пароля. Администратор создаётся отдельной командой.

Задайте `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` и при необходимости `BOOTSTRAP_ADMIN_NAME`, затем выполните:

```bash
npm run admin:create
```

После выполнения удалите `BOOTSTRAP_ADMIN_PASSWORD` из окружения. Пароль должен содержать не менее 12 символов, прописную и строчную буквы и цифру.

## Демонстрационные данные

Seed запрещён в production. Для локальной разработки необходимо явно задать:

```env
ALLOW_DEMO_SEED="true"
DEMO_USER_EMAIL="demo@example.test"
DEMO_USER_PASSWORD="локальный-тестовый-пароль"
```

Затем выполнить:

```bash
npm run db:seed --workspace=server
```

## Проверка

```bash
npm run build
npm run test:unit
npm run test:api
npm run test:e2e
```

GitHub Actions автоматически проверяет сборку, unit-, API- и E2E-тесты.

## Docker

Перед запуском задайте уникальный `JWT_SECRET` длиной не менее 32 символов:

```bash
docker compose up --build
```

Docker применяет схему Prisma, но не загружает демонстрационные данные.

## Переменные окружения

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `JWT_SECRET` | Секрет подписи токенов |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `SMTP_HOST`, `SMTP_PORT` | Параметры SMTP-сервера |
| `SMTP_USER`, `SMTP_PASS` | Учётные данные SMTP |
| `SMTP_FROM` | Адрес отправителя |
| `CORS_ORIGIN` | Разрешённый origin при раздельном размещении |

Реальные секреты нельзя добавлять в Git.

## Проверка состояния

- `GET /api/health` — состояние API;
- `GET /api/health/db` — подключение к базе данных.

## Развёртывание

Репозиторий содержит `render.yaml` для Render. Перед деплоем обязательно настройте `DATABASE_URL`, уникальный `JWT_SECRET`, Cloudinary и SMTP. Production-сервер не запустится с отсутствующими или небезопасными обязательными настройками.
