// Базовый путь ко всем серверным маршрутам:
const BASE_URL = '/api';

// Payload конструктора сайта:
export interface ConstructorPayload {
  pages: unknown[];
  theme: unknown;
  siteSlug: string;
  version?: number;
}

// Общая функция для JSON-запросов к API:
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');  // Токен из localStorage
  // HTTP-запрос к серверу:
  const res = await fetch(`${BASE_URL}${url}`, {
    // Переданные настройки запроса сохраняются:
    ...options,
    headers: {
      // По умолчанию JSON:
      'Content-Type': 'application/json',

      ...(token ? { Authorization: `Bearer ${token}` } : {}), // Если токен есть, Bearer-авторизация
      ...options?.headers,
    },
  });

  // Если сервер вернул ошибку:
  if (!res.ok) {
    // Текст ошибки из JSON:
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  // Успешный ответ API:
  const json = await res.json();
  return json.data;
}

// Единый объект для работы клиента с сервером:
export const api = {
  // Авторизация пользователя:
  login: (email: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  // Регистрация пользователя:
  register: (email: string, password: string, name: string) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  // Получение текущего пользователя по JWT:
  me: () => request('/auth/me'),

  // Получение списка экскурсий:
  getExcursions: () => request('/excursions'),
  // Получение одной экскурсии:
  getExcursion: (id: string, published?: boolean) =>
    request(`/excursions/${id}${published ? '?published=true' : ''}`),
  // Получение статистики:
  getStats: () => request('/excursions/stats'),
  // Создание новой экскурсии:
  createExcursion: (data: any) =>
    request('/excursions', { method: 'POST', body: JSON.stringify(data) }),
  // Обновление экскурсии:
  updateExcursion: (id: string, data: any) =>
    request(`/excursions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  // Публикация экскурсии:
  publishExcursion: (id: string) =>
    request(`/excursions/${id}/publish`, { method: 'PUT' }),
  // Удаление экскурсии:
  deleteExcursion: (id: string) =>
    request(`/excursions/${id}`, { method: 'DELETE' }),

  // Получение точек маршрута:
  getPoints: (routeId: string) => request(`/points/route/${routeId}`),
  // Создание одной точки:
  createPoint: (data: any) =>
    request('/points', { method: 'POST', body: JSON.stringify(data) }),
  // Обновление одной точки:
  updatePoint: (id: string, data: any) =>
    request(`/points/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  // Удаление одной точки:
  deletePoint: (id: string) =>
    request(`/points/${id}`, { method: 'DELETE' }),
  // Синхронизация всего списка точек:
  syncPoints: (routeId: string, points: any[]) =>
    request(`/points/route/${routeId}/sync`, {
      method: 'PUT',
      body: JSON.stringify({ points }),
    }),

  // Получение медиафайлов:
  getMedia: (excursionId?: string) =>
    request(`/media${excursionId ? `?excursionId=${excursionId}` : ''}`),
  // Загрузка файла на сервер:
  uploadMedia: async (file: File, excursionId?: string, pointId?: string) => {
    const formData = new FormData();
    formData.append('file', file); //  Сам файл
    // Привязываем файл к экскурсии:
    if (excursionId) formData.append('excursionId', excursionId);
    // Привязываем файл к точке, если id передан:
    if (pointId) formData.append('pointId', pointId);

    // Достаем токен:
    const token = localStorage.getItem('token');
    const res = await fetch(`${BASE_URL}/media/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    // Ошибка загрузки:
    if (!res.ok) throw new Error('Upload failed');
    // Сервер возвращает созданную media-запись:
    const json = await res.json();
    return json.data;
  },
  // Обновление подписи или привязки медиа:
  updateMedia: (id: string, data: any) =>
    request(`/media/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  // Удаление медиа:
  deleteMedia: (id: string) =>
    request(`/media/${id}`, { method: 'DELETE' }),

  // Получение публичного сайта по slug:
  getShowcase: (slug: string) => request(`/showcase/${slug}`),
  // Публикация конструктора сайта:
  saveConstructor: (data: ConstructorPayload) =>
    request('/showcase/constructor', { method: 'PUT', body: JSON.stringify(data) }),
  // Сохранение черновика конструктора:
  saveDraft: (data: ConstructorPayload) =>
    request('/showcase/constructor/draft', { method: 'PUT', body: JSON.stringify(data) }),
  // Получение текущих данных конструктора:
  getConstructorData: () => request('/showcase/constructor/data'),
};
