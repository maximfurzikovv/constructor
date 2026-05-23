# Базовый образ Node.js для установки зависимостей:
FROM node:22-alpine AS deps

# Рабочая папка внутри контейнера:
WORKDIR /app

# Системные библиотеки нужны Prisma:
RUN apk add --no-cache openssl libc6-compat

# Копируем package-файлы монорепозитория:
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json

# Устанавливаем зависимости всех workspace-пакетов:
RUN npm ci --include=dev

# Образ для сборки проекта:
FROM deps AS build

# Копируем исходный код приложения:
COPY . .

# Генерируем Prisma Client и собираем server, shared и client:
RUN npm run build

# Финальный образ для запуска приложения:
FROM node:22-alpine AS runner

# Рабочая папка приложения:
WORKDIR /app

# Системные библиотеки нужны Prisma при старте:
RUN apk add --no-cache openssl libc6-compat

# Включаем production-режим Express:
ENV NODE_ENV=production

# Копируем package-файлы для npm-скриптов:
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/client/package.json client/package.json
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/shared/package.json shared/package.json

# Копируем зависимости, сборку и Prisma-схему:
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/client/dist client/dist
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/src server/src
COPY --from=build /app/server/prisma server/prisma
COPY --from=build /app/shared/dist shared/dist

# Создаем папку для локальных загруженных файлов:
RUN mkdir -p server/uploads

# Открываем порт Express-сервера:
EXPOSE 3001

# При старте применяем схему, seed и запускаем сервер:
CMD ["npm", "run", "docker:start"]
