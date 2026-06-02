// Пользователь:
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string; // Ссылка на аватар
  role: 'guide' | 'admin'; // Роль пользователя
  createdAt: string;
}

export type ExcursionStatus = 'draft' | 'review' | 'published' | 'archived'; // Статус экскурсии
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
  publishedSnapshot?: string;
  moderationComment?: string;
  reviews?: Review[];
  route: Route; // Маршрут
  createdAt: string;
  updatedAt: string;
}

export interface ExcursionPublication {
  id: string;
  excursionId: string;
  snapshotJson: string;
  status: ExcursionStatus;
  moderationComment?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}
// Маршрут экскурсии:
export interface Review {
  id: string;
  excursionId: string;
  authorName: string;
  rating: number;
  text: string;
  published: boolean;
  createdAt: string;
}

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
  type: 'image' | 'audio'; // Тип
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
  status: ExcursionStatus;
  published: boolean;
  constructorJson?: string;
  publishedJson?: string;
  moderationComment?: string | null;
  createdAt: string;
}

export interface ShowcaseSitePublication {
  id: string;
  siteId: string;
  snapshotJson: string;
  status: ExcursionStatus;
  moderationComment?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
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
