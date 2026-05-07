import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import type { Excursion } from 'shared/types';
import './ExcursionDetailPage.css';

export default function ExcursionDetailPage() {
  const { slug, excursionId } = useParams<{ slug: string; excursionId: string }>();
  const [excursion, setExcursion] = useState<Excursion | null>(null);

  useEffect(() => {
    if (excursionId) api.getExcursion(excursionId, true).then((d: any) => setExcursion(d));
  }, [excursionId]);

  if (!excursion || !excursion.route) return <p style={{ padding: 40 }}>Загрузка...</p>;

  const points = excursion.route.points;
  const center: [number, number] =
    points.length > 0
      ? [points[0].lat, points[0].lng]
      : [59.939, 30.316];

  const positions: [number, number][] = points.map((p) => [p.lat, p.lng]);

  return (
    <div className="tour-detail">
      <Link to={`/s/${slug}`} className="td-back">
        ← Назад к каталогу
      </Link>
      <h1>{excursion.title}</h1>
      <div className="td-meta">
        <Badge>{excursion.city}</Badge>
        <span>{excursion.route.duration} мин</span>
        <span>{(excursion.route.distance / 1000).toFixed(1)} км</span>
        <span>{points.length} точек</span>
      </div>
      <p className="td-desc">{excursion.description}</p>

      <div className="td-map-container">
        <MapContainer
          center={center}
          zoom={13}
          style={{ width: '100%', height: '400px', borderRadius: 12 }}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {positions.length > 1 && (
            <Polyline positions={positions} color="#2563eb" weight={3} />
          )}
          {points.map((point) => (
            <Marker key={point.id} position={[point.lat, point.lng]}>
              <Popup>
                <strong>{point.title}</strong>
                <br />
                {point.description}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="td-actions">
        <Link to={`/player/${excursion.id}`}>
          <Button size="lg">Начать маршрут</Button>
        </Link>
      </div>

      <h2>Точки маршрута</h2>
      <div className="td-stops">
        {points
          .sort((a, b) => a.order - b.order)
          .map((point) => (
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
