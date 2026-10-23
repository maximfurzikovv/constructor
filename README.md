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
