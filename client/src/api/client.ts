const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

export const api = {
  login: (email: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name: string) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  me: () => request('/auth/me'),

  getExcursions: () => request('/excursions'),
  getExcursion: (id: string, published?: boolean) =>
    request(`/excursions/${id}${published ? '?published=true' : ''}`),
  getStats: () => request('/excursions/stats'),
  createExcursion: (data: any) =>
    request('/excursions', { method: 'POST', body: JSON.stringify(data) }),
  updateExcursion: (id: string, data: any) =>
    request(`/excursions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  publishExcursion: (id: string) =>
    request(`/excursions/${id}/publish`, { method: 'PUT' }),
  deleteExcursion: (id: string) =>
    request(`/excursions/${id}`, { method: 'DELETE' }),

  getPoints: (routeId: string) => request(`/points/route/${routeId}`),
  createPoint: (data: any) =>
    request('/points', { method: 'POST', body: JSON.stringify(data) }),
  updatePoint: (id: string, data: any) =>
    request(`/points/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePoint: (id: string) =>
    request(`/points/${id}`, { method: 'DELETE' }),
  syncPoints: (routeId: string, points: any[]) =>
    request(`/points/route/${routeId}/sync`, {
      method: 'PUT',
      body: JSON.stringify({ points }),
    }),

  getMedia: (excursionId?: string) =>
    request(`/media${excursionId ? `?excursionId=${excursionId}` : ''}`),
  uploadMedia: async (file: File, excursionId?: string, pointId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (excursionId) formData.append('excursionId', excursionId);
    if (pointId) formData.append('pointId', pointId);

    const token = localStorage.getItem('token');
    const res = await fetch(`${BASE_URL}/media/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    const json = await res.json();
    return json.data;
  },
  updateMedia: (id: string, data: any) =>
    request(`/media/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMedia: (id: string) =>
    request(`/media/${id}`, { method: 'DELETE' }),

  getShowcase: (slug: string) => request(`/showcase/${slug}`),
  saveConstructor: (data: any) =>
    request('/showcase/constructor', { method: 'PUT', body: JSON.stringify(data) }),
  saveDraft: (data: any) =>
    request('/showcase/constructor/draft', { method: 'PUT', body: JSON.stringify(data) }),
  getConstructorData: () => request('/showcase/constructor/data'),
};
