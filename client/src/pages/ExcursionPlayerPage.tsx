import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import type { Excursion } from 'shared/types';
import './ExcursionPlayerPage.css';

const SERVER_URL = '';

const userIcon = L.divIcon({
  className: 'user-marker',
  html: '<div class="user-marker-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function pointMarkerIcon(order: number, state: 'upcoming' | 'active' | 'visited') {
  return L.divIcon({
    className: 'player-stop-marker',
    html: `<div class="player-stop-inner ${state}">${order + 1}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function MapFollower({ position, navigatorMode }: { position: [number, number]; navigatorMode: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (navigatorMode) {
      map.setView(position, Math.max(map.getZoom(), 17), { animate: true, duration: 0.5 });
    } else {
      map.panTo(position, { animate: true, duration: 0.5 });
    }
  }, [map, position, navigatorMode]);
  return null;
}

/** Haversine distance in meters between two lat/lng points */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

function routeDistance(points: [number, number][]): number {
  return points.reduce((total, point, index) => {
    if (index === 0) return 0;
    const prev = points[index - 1];
    return total + distanceMeters(prev[0], prev[1], point[0], point[1]);
  }, 0);
}

export default function ExcursionPlayerPage() {
  const { excursionId } = useParams<{ excursionId: string }>();
  const navigate = useNavigate();
  const [excursion, setExcursion] = useState<Excursion | null>(null);
  const [currentPointIndex, setCurrentPointIndex] = useState(-1);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [sheetHeight, setSheetHeight] = useState(42);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoEnabled, setGeoEnabled] = useState(true);
  const [navigatorMode, setNavigatorMode] = useState(false);
  const [following, setFollowing] = useState(true);
  const [autoActivate, setAutoActivate] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [roadRoute, setRoadRoute] = useState<[number, number][] | null>(null);

  // Load excursion with fresh data (including latest media)
  useEffect(() => {
    if (excursionId) api.getExcursion(excursionId).then((d: any) => setExcursion(d));
  }, [excursionId]);

  // Fetch road-based route by segments. Segment routing avoids one bad waypoint
  // creating huge loops through the whole excursion.
  useEffect(() => {
    if (!excursion || !excursion.route || excursion.route.points.length < 2) return;
    let cancelled = false;
    const sorted = [...excursion.route.points].sort((a, b) => a.order - b.order);

    async function loadSegment(from: typeof sorted[number], to: typeof sorted[number]) {
      const direct: [number, number][] = [[from.lat, from.lng], [to.lat, to.lng]];
      const directDistance = distanceMeters(from.lat, from.lng, to.lat, to.lng);
      const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false&alternatives=true`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        const routes = Array.isArray(data.routes) ? data.routes : [];
        if (data.code !== 'Ok' || routes.length === 0) return direct;
        const shortest = routes
          .filter((route: any) => route.geometry?.coordinates?.length)
          .sort((a: any, b: any) => (a.distance || Infinity) - (b.distance || Infinity))[0];
        const coordinates = shortest?.geometry?.coordinates;
        if (!coordinates) return direct;
        const geo: [number, number][] = coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        );
        const routedDistance = shortest.distance || routeDistance(geo);
        const looksLikeLoop = directDistance > 0 && routedDistance > Math.max(directDistance * 1.45, directDistance + 180);
        return looksLikeLoop ? direct : geo;
      } catch {
        return direct;
      }
    }

    Promise.all(sorted.slice(0, -1).map((point, index) => loadSegment(point, sorted[index + 1])))
      .then((segments) => {
        if (cancelled) return;
        const merged = segments.flatMap((segment, index) => index === 0 ? segment : segment.slice(1));
        setRoadRoute(merged.length > 1 ? merged : null);
      });

    return () => {
      cancelled = true;
    };
  }, [excursion]);

  // Start watching geolocation
  useEffect(() => {
    if (!geoEnabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setFollowing(false);
      return;
    }

    if (!navigator.geolocation) {
      setGeoError('Геолокация не поддерживается браузером');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPosition([pos.coords.latitude, pos.coords.longitude]);
        setGeoError(null);
      },
      (err) => {
        if (err.code === 1) setGeoError('Доступ к геолокации запрещён');
        else if (err.code === 2) setGeoError('Не удалось определить местоположение');
        else setGeoError('Ошибка геолокации');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [geoEnabled]);

  // Auto-activate points based on radius
  useEffect(() => {
    if (!autoActivate || !userPosition || !excursion || !excursion.route) return;
    const sortedPoints = [...excursion.route.points].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedPoints.length; i++) {
      const point = sortedPoints[i];
      const dist = distanceMeters(userPosition[0], userPosition[1], point.lat, point.lng);
      const radius = point.radius || 50;
      if (dist <= radius) {
        setCurrentPointIndex(i);
        setSheetOpen(true);
        break;
      }
    }
  }, [userPosition, excursion, autoActivate]);

  if (!excursion || !excursion.route) {
    return <div className="player-loading">Загрузка маршрута...</div>;
  }

  const sortedPoints = [...excursion.route.points].sort((a, b) => a.order - b.order);
  const positions: [number, number][] = sortedPoints.map((p) => [p.lat, p.lng]);
  const routeLine = roadRoute || positions;
  const currentPoint = currentPointIndex >= 0 ? sortedPoints[currentPointIndex] : null;

  const center: [number, number] = userPosition || positions[0] || [59.939, 30.316];

  const distToFirst = userPosition && sortedPoints.length > 0
    ? distanceMeters(userPosition[0], userPosition[1], sortedPoints[0].lat, sortedPoints[0].lng)
    : null;

  const nextPoint = currentPointIndex >= 0
    ? (currentPointIndex < sortedPoints.length - 1 ? sortedPoints[currentPointIndex + 1] : null)
    : sortedPoints[0] || null;
  const distToNext = userPosition && nextPoint
    ? distanceMeters(userPosition[0], userPosition[1], nextPoint.lat, nextPoint.lng)
    : null;

  const getPointState = (index: number): 'upcoming' | 'active' | 'visited' => {
    if (currentPointIndex < 0) return 'upcoming';
    if (index === currentPointIndex) return 'active';
    if (index < currentPointIndex) return 'visited';
    return 'upcoming';
  };

  const goToPoint = (index: number) => {
    setCurrentPointIndex(index);
    setSheetOpen(true);
    setSheetHeight((height) => Math.max(height, 42));
    setLightboxIndex(null);
  };

  const finishSheetDrag = () => {
    dragRef.current = null;
    setSheetHeight((height) => {
      const next = height < 18 ? 6 : height > 50 ? 62 : 42;
      setSheetOpen(next > 12);
      return next;
    });
  };

  const updateSheetDrag = (clientY: number) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - clientY;
    const next = dragRef.current.startHeight + (delta / window.innerHeight) * 100;
    const clamped = Math.max(6, Math.min(72, next));
    setSheetHeight(clamped);
    setSheetOpen(clamped > 12);
  };

  // Route from user to first point — straight dashed line
  const routeToFirst: [number, number][] =
    userPosition && sortedPoints.length > 0 && currentPointIndex < 0
      ? [userPosition, [sortedPoints[0].lat, sortedPoints[0].lng]]
      : [];

  // Current point images
  const currentPointImages = currentPoint
    ? (currentPoint.media || []).filter((m) => m.type === 'image')
    : [];
  const currentPointAudio = currentPoint
    ? (currentPoint.media || []).filter((m) => m.type === 'audio')
    : [];
  const currentPointVideo = currentPoint
    ? (currentPoint.media || []).filter((m) => m.type === 'video')
    : [];

  return (
    <div className="player-layout">
      {/* Map */}
      <div className="player-map">
        <MapContainer
          center={center}
          zoom={14}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Route polyline — road-based if available, straight fallback */}
          {routeLine.length > 1 && (
            <Polyline positions={routeLine} color="#2563eb" weight={4} />
          )}

          {/* Dashed line from user to first point */}
          {routeToFirst.length === 2 && (
            <Polyline
              positions={routeToFirst}
              color="#f59e0b"
              weight={3}
              dashArray="8 8"
            />
          )}

          {sortedPoints.map((point, i) => (
            <React.Fragment key={point.id}>
              <Marker
                position={[point.lat, point.lng]}
                icon={pointMarkerIcon(point.order, getPointState(i))}
                eventHandlers={{ click: () => goToPoint(i) }}
              />
              <Circle
                center={[point.lat, point.lng]}
                radius={point.radius || 50}
                pathOptions={{
                  color: getPointState(i) === 'active' ? '#2563eb' : '#94a3b8',
                  fillColor: getPointState(i) === 'active' ? '#2563eb' : '#94a3b8',
                  fillOpacity: 0.08,
                  weight: 1,
                  dashArray: '4 4',
                }}
              />
            </React.Fragment>
          ))}

          {userPosition && (
            <>
              <Marker position={userPosition} icon={userIcon} />
              {following && <MapFollower position={userPosition} navigatorMode={navigatorMode} />}
            </>
          )}
        </MapContainer>

        {/* Top bar */}
        <div className="player-top-bar">
          <button className="player-back-btn" onClick={() => navigate(-1)}>
            ← Назад
          </button>
          <span className="player-tour-title">{excursion.title}</span>
        </div>

        {/* Geo status */}
        {geoError && (
          <div className="player-geo-error">{geoError}</div>
        )}
      </div>

      {/* Bottom sheet */}
      <div
        className={`player-sheet ${sheetOpen ? 'open' : 'collapsed'}`}
        style={{ height: `${sheetHeight}vh` }}
      >
        <div
          className="sheet-handle"
          onPointerDown={(event) => {
            dragRef.current = { startY: event.clientY, startHeight: sheetHeight };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => updateSheetDrag(event.clientY)}
          onPointerUp={finishSheetDrag}
          onPointerCancel={finishSheetDrag}
        >
          <div className="sheet-handle-bar" />
        </div>

        {sheetOpen && (
          <div className="sheet-content">
            {currentPointIndex < 0 ? (
              <div className="sheet-welcome">
                <h2>{excursion.title}</h2>
                <p className="sheet-welcome-info">
                  {sortedPoints.length} точек &bull; {excursion.route.duration} мин &bull; {(excursion.route.distance / 1000).toFixed(1)} км
                </p>
                {distToFirst !== null && (
                  <p className="sheet-welcome-distance">
                    До первой точки: <strong>{formatDistance(distToFirst)}</strong>
                  </p>
                )}
                <p className="sheet-welcome-hint">
                  Идите к первой точке маршрута. Когда вы окажетесь в зоне активации, текст появится автоматически.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => goToPoint(0)}
                  style={{ width: '100%', marginTop: 12, marginBottom: 16 }}
                >
                  Начать с первой точки
                </Button>
              </div>
            ) : currentPoint ? (
              <>
                <div className="sheet-stop-header">
                  <div className="sheet-stop-number">{currentPoint.order + 1}</div>
                  <div>
                    <h2>{currentPoint.title}</h2>
                    <span className="sheet-stop-dur">
                      {currentPoint.duration} мин на точке
                    </span>
                  </div>
                </div>
                <p className="sheet-stop-desc">{currentPoint.description}</p>

                {/* Image gallery for current point */}
                {currentPointImages.length > 0 && (
                  <div className="sheet-gallery">
                    {currentPointImages.map((m, idx) => (
                      <img
                        key={m.id}
                        className="sheet-gallery-img"
                        src={`${SERVER_URL}${m.url}`}
                        alt={m.title}
                        onClick={() => setLightboxIndex(idx)}
                      />
                    ))}
                  </div>
                )}

                {(currentPointAudio.length > 0 || currentPointVideo.length > 0) && (
                  <div className="sheet-media-stack">
                    {currentPointAudio.map((m) => (
                      <audio key={m.id} src={`${SERVER_URL}${m.url}`} controls />
                    ))}
                    {currentPointVideo.map((m) => (
                      <video key={m.id} src={`${SERVER_URL}${m.url}`} controls />
                    ))}
                  </div>
                )}

                {distToNext !== null && currentPointIndex < sortedPoints.length - 1 && (
                  <p className="sheet-distance-next">
                    До следующей точки: <strong>{formatDistance(distToNext)}</strong>
                  </p>
                )}

                <div className="sheet-nav">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPointIndex === 0}
                    onClick={() => goToPoint(currentPointIndex - 1)}
                  >
                    ← Предыдущая
                  </Button>
                  <span className="sheet-nav-counter">
                    {currentPointIndex + 1} / {sortedPoints.length}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPointIndex === sortedPoints.length - 1}
                    onClick={() => goToPoint(currentPointIndex + 1)}
                  >
                    Следующая →
                  </Button>
                </div>
              </>
            ) : null}

            <div className="sheet-location">
              <Button
                variant={following ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  if (!geoEnabled) {
                    setGeoEnabled(true);
                    setFollowing(true);
                  } else {
                    setFollowing(!following);
                  }
                }}
                style={{ width: '100%' }}
              >
                {following ? '📍 Слежение включено' : '📍 Включить слежение'}
              </Button>
              <Button
                variant={navigatorMode ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  setNavigatorMode((enabled) => !enabled);
                  setGeoEnabled(true);
                  setFollowing(true);
                }}
                style={{ width: '100%', marginTop: 8 }}
              >
                {navigatorMode ? 'Режим навигатора включен' : 'Включить режим навигатора'}
              </Button>
              <Button
                variant={geoEnabled ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  setGeoEnabled((enabled) => !enabled);
                  if (geoEnabled) {
                    setAutoActivate(false);
                    setFollowing(false);
                  } else {
                    setAutoActivate(true);
                    setFollowing(true);
                  }
                }}
                style={{ width: '100%', marginTop: 8 }}
              >
                {autoActivate ? '🎯 Автоактивация включена' : '🎯 Включить автоактивацию'}
              </Button>
            </div>

            <div className="sheet-stops-list">
              {sortedPoints.map((point, i) => {
                const state = getPointState(i);
                return (
                  <div
                    key={point.id}
                    className={`sheet-stop-item ${state}`}
                    onClick={() => goToPoint(i)}
                  >
                    <span className={`sheet-stop-item-num ${state}`}>
                      {state === 'visited' ? '✓' : i + 1}
                    </span>
                    <span>{point.title}</span>
                    {userPosition && (
                      <span className="sheet-stop-dist">
                        {formatDistance(distanceMeters(userPosition[0], userPosition[1], point.lat, point.lng))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && currentPointImages.length > 0 && (
        <div className="lightbox-overlay" onClick={() => setLightboxIndex(null)}>
          <button className="lightbox-close" onClick={() => setLightboxIndex(null)}>&times;</button>
          {currentPointImages.length > 1 && (
            <button
              className="lightbox-arrow lightbox-arrow-left"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((lightboxIndex - 1 + currentPointImages.length) % currentPointImages.length);
              }}
            >&#8249;</button>
          )}
          <img
            className="lightbox-img"
            src={`${SERVER_URL}${currentPointImages[lightboxIndex].url}`}
            alt={currentPointImages[lightboxIndex].title}
            onClick={(e) => e.stopPropagation()}
          />
          {currentPointImages.length > 1 && (
            <button
              className="lightbox-arrow lightbox-arrow-right"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((lightboxIndex + 1) % currentPointImages.length);
              }}
            >&#8250;</button>
          )}
          <div className="lightbox-counter">
            {lightboxIndex + 1} / {currentPointImages.length}
          </div>
        </div>
      )}
    </div>
  );
}
