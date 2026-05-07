// ─── Domain Types ───

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'author' | 'admin';
  createdAt: string;
}

export type ExcursionStatus = 'draft' | 'published' | 'archived';
export type TransportMode = 'walk' | 'bus' | 'metro' | 'car' | 'bike';

export interface Excursion {
  id: string;
  title: string;
  description: string;
  authorId: string;
  status: ExcursionStatus;
  city: string;
  coverImage?: string;
  route: Route;
  createdAt: string;
  updatedAt: string;
}

export interface Route {
  id: string;
  excursionId: string;
  routeGeo: GeoJSONLineString;
  duration: number;       // minutes
  distance: number;       // meters
  transport: TransportMode;
  points: Point[];
}

export interface Point {
  id: string;
  routeId: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  order: number;
  media: MediaItem[];
  duration: number;       // minutes to spend at point
  radius: number;         // activation radius in meters (default 50)
}

export interface MediaItem {
  id: string;
  pointId?: string;
  excursionId: string;
  type: 'image' | 'audio' | 'video';
  url: string;
  title: string;
  description?: string;
  createdAt: string;
}

export interface ShowcaseSite {
  id: string;
  authorId: string;
  slug: string;
  title: string;
  description: string;
  theme: 'light' | 'dark';
  heroImage?: string;
  tours: string[];         // excursion IDs
  published: boolean;
  createdAt: string;
}

// ─── GeoJSON ───

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][]; // [[lng, lat], ...]
}

// ─── API Types ───

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  statusCode: number;
}

export interface ExcursionCreateRequest {
  title: string;
  description: string;
  city: string;
  transport: TransportMode;
}

export interface PointCreateRequest {
  routeId: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  order: number;
  duration: number;
}

export interface DashboardStats {
  totalExcursions: number;
  publishedExcursions: number;
  totalPoints: number;
  totalViews: number;
}
