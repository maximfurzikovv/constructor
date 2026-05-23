import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001';

export default defineConfig({
  // Корень клиента нужен для запуска из монорепозитория:
  root: __dirname,
  // Подключает React-плагин для Vite.
  plugins: [react()],
  // Настраивает короткий импорт shared-модулей.
  resolve: {
    alias: {
      // Алиас ведет на общие типы проекта.
      shared: path.resolve(__dirname, '../shared/src'),
    },
  },
  // Параметры локального dev-сервера клиента.
  server: {
    // Основной порт фронтенда.
    port: 5173,
    // API и файлы проксируются на сервер.
    proxy: {
      '/api': apiProxyTarget,
      '/uploads': apiProxyTarget,
    },
  },
});
