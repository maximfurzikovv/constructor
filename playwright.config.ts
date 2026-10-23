import { defineConfig, devices } from '@playwright/test';

const serverPort = Number(process.env.TEST_SERVER_PORT || 3011);
const clientPort = Number(process.env.TEST_CLIENT_PORT || 5174);
// Локальная тестовая БД для Docker:
const fallbackDatabaseUrl = 'postgresql://constructor:constructor@127.0.0.1:55432/constructor?schema=public';
// URL БД явно передается тестовому серверу:
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || fallbackDatabaseUrl;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${clientPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `npm run dev:server:test`,
      url: `http://localhost:${serverPort}/api/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        PORT: String(serverPort),
        DATABASE_URL: databaseUrl,
        TEST_DATABASE_URL: databaseUrl,
        DEMO_USER_EMAIL: 'guide@example.com',
        DEMO_USER_PASSWORD: 'password123',
        TEST_ADMIN_EMAIL: 'admin@example.test',
        TEST_ADMIN_PASSWORD: 'TestAdmin-Only-4219!',
      },
      timeout: 120_000,
    },
    {
      command: `npm run dev:client:test`,
      url: `http://localhost:${clientPort}/login`,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_PROXY_TARGET: `http://localhost:${serverPort}`,
      },
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
