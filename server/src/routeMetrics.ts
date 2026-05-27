// Точка, достаточная для расчета маршрута:
type RouteMetricPoint = {
  lat: number;
  lng: number;
  duration?: number | null;
};

// Скорость нужна для резервной оценки времени ходьбы:
const fallbackWalkMetersPerMinute = 80;

// Считает расстояние между двумя координатами:
export function distanceMeters(first: RouteMetricPoint, second: RouteMetricPoint) {
  const radius = 6371000; // Радиус Земли в метрах
  const firstLat = (first.lat * Math.PI) / 180; // Широта первой точки
  const secondLat = (second.lat * Math.PI) / 180; // Широта второй точки
  const deltaLat = ((second.lat - first.lat) * Math.PI) / 180; // Разница широт
  const deltaLng = ((second.lng - first.lng) * Math.PI) / 180; // Разница долгот

  // Вычисляем расстояние по формуле гаверсинусов:
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * radius * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value)))); // Метры
}

// Возвращает общие показатели маршрута:
export function calculateRouteMetrics(points: RouteMetricPoint[]) {
  // Время складывается из времени осмотра точек:
  const stopsDuration = points.reduce((sum, point) => sum + (Number(point.duration) || 0), 0);
  // Длина складывается из отрезков между соседними точками:
  const distance = points.slice(1).reduce((sum, point, index) => sum + distanceMeters(points[index], point), 0);
  // Если маршрутизатор недоступен, добавляем оценку времени перемещения:
  const walkingDuration = Math.ceil(distance / fallbackWalkMetersPerMinute);

  return {
    duration: stopsDuration + walkingDuration,
    distance: Math.round(distance), // В базе хранятся целые метры
  };
}

// Получает показатели пешего пути по улицам:
export async function calculateWalkingRouteMetrics(points: RouteMetricPoint[]) {
  const fallback = calculateRouteMetrics(points); // Резервный расчет по гаверсинусам
  if (points.length < 2 || process.env.NODE_ENV === 'test') return fallback;

  const stopsDuration = points.reduce((sum, point) => sum + (Number(point.duration) || 0), 0); // Осмотр точек
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(';'); // Координаты API
  const baseUrl = process.env.ROUTING_SERVICE_URL || 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'; // Пеший сервис
  const url = `${baseUrl}/${coordinates}?overview=false&steps=false&alternatives=false`; // Запрос маршрута

  try {
    // Таймаут не дает внешнему сервису блокировать сохранение:
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return fallback;

    const body = await response.json() as { code?: string; routes?: Array<{ distance?: number; duration?: number }> };
    const route = body.code === 'Ok' ? body.routes?.[0] : null; // Пеший маршрут
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) return fallback;

    return {
      distance: Math.round(route.distance!),
      duration: stopsDuration + Math.ceil(route.duration! / 60),
    }; // Путь по улицам и остановки
  } catch {
    return fallback; // При сбое используется расчет по координатам
  }
}
