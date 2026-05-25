// Точка, достаточная для расчета маршрута:
type RouteMetricPoint = {
  lat: number;
  lng: number;
  duration?: number | null;
};

// Считает расстояние между двумя координатами:
function distanceMeters(first: RouteMetricPoint, second: RouteMetricPoint) {
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
  const duration = points.reduce((sum, point) => sum + (Number(point.duration) || 0), 0);
  // Длина складывается из отрезков между соседними точками:
  const distance = points.slice(1).reduce((sum, point, index) => sum + distanceMeters(points[index], point), 0);

  return {
    duration,
    distance: Math.round(distance), // В базе хранятся целые метры
  };
}
