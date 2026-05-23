import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const TEST_SERVER_PORT = process.env.TEST_SERVER_PORT || (process.env.TEST_DATABASE_URL ? '3011' : '3001');
const API_ORIGIN = process.env.TEST_API_ORIGIN || `http://localhost:${TEST_SERVER_PORT}`;
export const API_BASE_URL = `${API_ORIGIN}/api`;

let serverProcess = null;
let serverStartedByTests = false;
let authToken = null;

function sanitizeEnv(envSource) {
  const env = {}; // Чистое окружение для Windows spawn
  for (const [key, value] of Object.entries(envSource)) {
    if (!key || key.startsWith('=') || typeof value === 'undefined') continue; // Служебные ключи Windows пропускаются
    env[key] = value; // Валидная переменная переносится в дочерний процесс
  }
  return env;
}

function createServerEnv() {
  const source = sanitizeEnv(process.env); // Берем только валидные ключи окружения
  return {
    PATH: source.PATH || source.Path || '', // npm должен быть доступен из PATH
    Path: source.Path || source.PATH || '', // Windows иногда использует Path
    SystemRoot: source.SystemRoot || 'C:\\Windows', // Нужен cmd.exe и системным DLL
    COMSPEC: source.COMSPEC || source.ComSpec || 'C:\\Windows\\System32\\cmd.exe', // Командный интерпретатор Windows
    TEMP: source.TEMP || source.TMP || '', // Временная папка для npm
    TMP: source.TMP || source.TEMP || '', // Временная папка для npm
    USERPROFILE: source.USERPROFILE || '', // Профиль нужен npm на Windows
    APPDATA: source.APPDATA || '', // npm хранит часть служебных данных тут
    NODE_ENV: 'test',
    PORT: TEST_SERVER_PORT,
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function canReachServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < 30000) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(2500) });
      if (response.ok) return;
      lastError = new Error(`Health check returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(700);
  }

  throw lastError || new Error('API server did not start in time');
}

async function fetchWithRetry(url, options = {}) {
  let lastError = null; // Последняя ошибка нужна для понятного падения
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await fetch(url, options); // Успешный ответ сразу возвращается
    } catch (error) {
      lastError = error; // Запоминаем сетевую ошибку
      await sleep(500); // Даем dev-серверу завершить старт
    }
  }
  throw lastError || new Error(`Fetch failed: ${url}`);
}

export async function ensureApiServer() {
  const canReuseExistingServer = Boolean(process.env.TEST_API_ORIGIN) || !process.env.TEST_DATABASE_URL;
  if (canReuseExistingServer && await canReachServer()) return;

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const env = createServerEnv(); // Окружение тестового сервера
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL; // URL тестовой базы
  const stdio = process.env.TEST_DEBUG ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'ignore', 'ignore']; // Логи включаются флагом
  if (databaseUrl) env.DATABASE_URL = databaseUrl; // Передаем БД только если она есть
  serverProcess = spawn(npmCommand, ['run', 'dev:server:test'], {
    cwd: process.cwd(),
    env,
    detached: process.platform !== 'win32',
    shell: process.platform === 'win32',
    stdio,
  });
  serverStartedByTests = true;

  await waitForServer();
}

export function stopApiServer() {
  if (!serverStartedByTests || !serverProcess) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(serverProcess.pid), '/T', '/F']); // Останавливаем все дочерние процессы Windows
  } else {
    try {
      process.kill(-serverProcess.pid, 'SIGTERM'); // Останавливаем группу процессов Unix
    } catch {
      serverProcess.kill('SIGTERM'); // Запасная остановка процесса
    }
  }
  serverProcess.unref(); // Не держим event loop тестов
  serverProcess = null;
  serverStartedByTests = false;
}

async function getAuthToken() {
  if (authToken) return authToken;
  const response = await fetchWithRetry(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'guide@example.com', password: 'password123' }),
  });
  const body = await response.json().catch(() => null);
  assert.ok(response.ok, `Expected auth login to be ok, got ${response.status}: ${JSON.stringify(body)}`);
  authToken = body.data.token;
  return authToken;
}

function needsAuth(path) {
  if (path.startsWith('/auth')) return false;
  if (path.startsWith('/showcase/') && !path.startsWith('/showcase/constructor')) return false;
  return true;
}

export async function apiRequest(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const { skipAuth, ...fetchOptions } = options; // Служебный флаг теста
  const token = !skipAuth && needsAuth(path) ? await getAuthToken() : null; // Токен нужен не всегда
  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: isFormData
      ? { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...fetchOptions.headers }
      : {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...fetchOptions.headers,
        },
  });

  const body = await response.json().catch(() => null);
  assert.ok(response.ok, `Expected ${path} to be ok, got ${response.status}: ${JSON.stringify(body)}`);
  return body.data;
}

export async function apiRequestRaw(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const { skipAuth, ...fetchOptions } = options; // Служебный флаг теста
  const token = !skipAuth && needsAuth(path) ? await getAuthToken() : null; // Токен нужен не всегда
  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: isFormData
      ? { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...fetchOptions.headers }
      : {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...fetchOptions.headers,
        },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}
