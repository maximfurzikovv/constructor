import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import type { Excursion } from 'shared/types';
import './ExcursionDetailPage.css';

// Публичная страница одной экскурсии:
export default function ExcursionDetailPage() {
  // Для возврата на сайт:
  const { slug, excursionId } = useParams<{ slug: string; excursionId: string }>();
  // Данные экскурсии:
  const [excursion, setExcursion] = useState<Excursion | null>(null);

  // Опубликованная версия экскурсии:
  useEffect(() => {
    if (excursionId) api.getExcursion(excursionId, true).then((d: any) => setExcursion(d));
  }, [excursionId]);

  // Пока данных нет:
  if (!excursion || !excursion.route) return <p style={{ padding: 40 }}>Загрузка...</p>;

  const points = excursion.route.points; // Точки маршрута
  const center: [number, number] = // Центр карты
    points.length > 0
      ? [points[0].lat, points[0].lng]
      : [59.939, 30.316];

  // Массив координат для линии маршрута:
  const positions: [number, number][] = points.map((p) => [p.lat, p.lng]);

  return (
    // Контейнер страницы:
    <div className="tour-detail">
      {/* Возврат на публичный сайт: */}
      <Link to={`/s/${slug}`} className="td-back">
        ← Назад к каталогу
      </Link>
      {/* Название экскурсии: */}
      <h1>{excursion.title}</h1>
      {/* Метаданные маршрута: */}
      <div className="td-meta">
        <Badge>{excursion.city}</Badge>
        <span>{excursion.route.duration} мин</span>
        <span>{(excursion.route.distance / 1000).toFixed(1)} км</span>
        <span>{points.length} точек</span>
      </div>
      {/* Описание экскурсии: */}
      <p className="td-desc">{excursion.description}</p>

      {/* Карта маршрута: */}
      <div className="td-map-container">
        <MapContainer
          center={center}
          zoom={13}
          style={{ width: '100%', height: '400px', borderRadius: 12 }}
          attributionControl={false}
        >
          {/* Слой карты: */}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {/* Линия маршрута: */}
          {positions.length > 1 && (
            <Polyline positions={positions} color="#2563eb" weight={3} />
          )}
          {/* Маркеры всех точек: */}
          {points.map((point) => (
            <Marker key={point.id} position={[point.lat, point.lng]}>
              {/* Всплывающее описание точки: */}
              <Popup>
                <strong>{point.title}</strong>
                <br />
                {point.description}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Действия страницы: */}
      <div className="td-actions">
        <Link to={`/player/${excursion.id}`}>
          <Button size="lg">Начать маршрут</Button>
        </Link>
      </div>

      {/* Список точек маршрута: */}
      <h2>Точки маршрута</h2>
      <div className="td-stops">
        {points
            // Точки показываются по порядку прохождения:
          .sort((a, b) => a.order - b.order)
          .map((point) => (
            // Карточка точки маршрута:
            <Card key={point.id} className="td-stop-card">
              <div className="td-stop-order">{point.order + 1}</div>
              <div>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
                <span className="td-stop-dur">{point.duration} мин</span>
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}
