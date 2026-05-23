// Пользователь:
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string; // Ссылка на аватар
  role: 'author' | 'admin'; // Роль
  createdAt: string;
}

export type ExcursionStatus = 'draft' | 'published' | 'archived'; // Статус экскурсии
export type TransportMode = 'walk' | 'bus' | 'metro' | 'car' | 'bike'; // Тип транспорта
// Экскурсии:
export interface Excursion {
  id: string;
  title: string;
  description: string; // Описание
  authorId: string; // Автор экскурсии
  status: ExcursionStatus;
  city: string;
  coverImage?: string; //Обложка
  route: Route; // Маршрут
  createdAt: string;
  updatedAt: string;
}
// Маршрут экскурсии:
export interface Route {
  id: string;
  excursionId: string;
  routeGeo: GeoJSONLineString; // Геометрия маршрута
  duration: number; // В минутах
  distance: number; // В метрах
  transport: TransportMode; // Тип передвижения
  points: Point[]; // Точки интереса
}
// Точка интереса:
export interface Point {
  id: string;
  routeId: string;
  title: string;
  description: string;
  lat: number; // Широта точки
  lng: number; // Долгота точки
  order: number; // Порядковый номер
  media: MediaItem[]; // Медиафайлы
  duration: number; // Время у точки
  radius: number; // Радиус активации
}
// Медиафайл:
export interface MediaItem {
  id: string;
  pointId?: string;
  excursionId: string;
  type: 'image' | 'audio' | 'video'; // Тип
  url: string; // Ссылка на файл
  title: string;
  description?: string;
  createdAt: string;
}
// Созданный сайт:
export interface ShowcaseSite {
  id: string;
  authorId: string;
  slug: string; // Адрес сайта
  title: string;
  description: string;
  theme: 'light' | 'dark';
  heroImage?: string; // Главное изображение сайта
  tours: string[]; // ID экскурсий
  published: boolean;
  createdAt: string;
}

// GeoJSON:
// GeoJSON точки:
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}
// GeoJSON линии (маршрута):
export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][]; // [[lng, lat], ...]
}

// API Types:
// Запрос на вход:
export interface LoginRequest {
  email: string;
  password: string;
}
// Ответ сервера на вход:
export interface LoginResponse {
  token: string;
  user: User;
}
// Запрос регистрации:
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}
// Ответ API:
export interface ApiResponse<T> {
  data: T;
  message?: string;
}
// Ошибка:
export interface ApiError {
  error: string;
  statusCode: number;
}
// Запрос на создание экскурсии:
export interface ExcursionCreateRequest {
  title: string;
  description: string;
  city: string;
  transport: TransportMode;
}
// Запрос на создание точки:
export interface PointCreateRequest {
  routeId: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  order: number;
  duration: number;
}
// Статистика:
export interface DashboardStats {
  totalExcursions: number;
  publishedExcursions: number;
  totalPoints: number;
  totalMedia: number;
}
