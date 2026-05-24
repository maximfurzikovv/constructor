import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import type { Excursion } from 'shared/types';
import './ExcursionPlayerPage.css';

const SERVER_URL = '';

// Иконка текущего положения пользователя:
const userIcon = L.divIcon({
  className: 'user-marker',
  html: '<div class="user-marker-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Учетом состояния точки:
function pointMarkerIcon(order: number, state: 'upcoming' | 'active' | 'visited') {
  return L.divIcon({
    className: 'player-stop-marker',
    html: `<div class="player-stop-inner ${state}">${order + 1}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Следит за пользователем и двигает карту:
function MapFollower({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(position, { animate: true, duration: 0.5 });
  }, [map, position]);
  return null;
}

// Считает расстояние:
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const safeA = Math.min(1, Math.max(0, a)); // Защита от погрешности
  return 2 * R * Math.asin(Math.sqrt(safeA));
}

// Форматирует расстояние для интерфейса:
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

// Возвращает порядок аудио внутри точки:
function audioOrder(media: any, index: number) {
  const parsed = Number(media.description);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1;
}
// Форматирует время аудио:
function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60); // Минуты
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0'); // Секунды
  return `${minutes}:${rest}`;
}

// Возвращает понятное название аудиофайла:
function audioTitle(media: any, index: number) {
  const title = String(media.title || '').trim(); // Название из базы
  const rawFileName = /(\.mp3|\.wav|\.m4a|\.ogg|\.webm|\.aac)$/i.test(title) || title.includes('_'); // Техническое имя
  return !title || rawFileName ? `Аудиофайл ${index + 1}` : title;
}

// Отображает свой аудиоплеер:
function AudioTrack({
  media,
  index,
  total,
  src,
  setAudioRef,
  onEnded,
}: {
  media: any;
  index: number;
  total: number;
  src: string;
  setAudioRef: (node: HTMLAudioElement | null) => void;
  onEnded: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null); // Ссылка на audio
  const [playing, setPlaying] = useState(false); // Состояние воспроизведения
  const [current, setCurrent] = useState(0); // Текущее время
  const [duration, setDuration] = useState(0); // Длительность

  // Связывает audio с внешним списком ссылок:
  const bindRef = (node: HTMLAudioElement | null) => {
    audioRef.current = node;
    setAudioRef(node);
  };

  // Переключает воспроизведение:
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  };

  // Перематывает дорожку:
  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  return (
    <div className="audio-card">
      <div className="audio-card-head">
        <span className="audio-card-icon">♪</span>
        <div>
          <strong>{audioTitle(media, index)}</strong>
          <small>{index + 1} из {total}</small>
        </div>
      </div>
      <div className="audio-player">
        <button type="button" className="audio-play-btn" onClick={togglePlay}>{playing ? 'Ⅱ' : '▶'}</button>
        <span className="audio-time">{formatAudioTime(current)}</span>
        <input
          className="audio-range"
          type="range"
          min={0}
          max={duration || 0}
          value={Math.min(current, duration || current)}
          step={1}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span className="audio-time">{formatAudioTime(duration)}</span>
      </div>
      <audio
        ref={bindRef}
        src={src}
        preload="auto"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          onEnded();
        }}
      />
    </div>
  );
}

export default function ExcursionPlayerPage() {
  // Получаем id экскурсии из маршрута:
  const { excursionId } = useParams<{ excursionId: string }>();
  // Навигация нужна для кнопки возврата:
  const navigate = useNavigate();
  // Храним экскурсию с точками и медиа:
  const [excursion, setExcursion] = useState<Excursion | null>(null);
  // Индекс текущей точки прохождения:
  const [currentPointIndex, setCurrentPointIndex] = useState(-1);
  // Управляет открытием нижней панели:
  const [sheetOpen, setSheetOpen] = useState(true);
  // Высота нижней панели в vh:
  const [sheetHeight, setSheetHeight] = useState(42);
  // Текущая геопозиция пользователя:
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  // Ошибка геолокации для вывода на экран:
  const [geoError, setGeoError] = useState<string | null>(null);
  // Флаг включенной геолокации:
  const [geoEnabled, setGeoEnabled] = useState(true);
  // Флаг слежения карты за пользователем:
  const [following, setFollowing] = useState(true);
  // Автоматическая активация точки по радиусу:
  const [autoActivate, setAutoActivate] = useState(true);
  // Индекс картинки в просмотрщике:
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Дорожная линия маршрута между точками:
  const [roadRoute, setRoadRoute] = useState<[number, number][] | null>(null);
  // Подсказка, если браузер заблокировал автозапуск аудио:
  const [audioPrompt, setAudioPrompt] = useState<string | null>(null);
  // Id подписки на геолокацию:
  const watchIdRef = useRef<number | null>(null);
  // Данные перетаскивания нижней панели:
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  // Ссылки на audio-элементы для автозапуска:
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  // Защита от повторного автозапуска одной точки:
  const lastAutoPlayedPointRef = useRef<string | null>(null);

  // Загружает экскурсию перед прохождением:
  useEffect(() => {
    if (excursionId) api.getExcursion(excursionId).then((data: any) => setExcursion(data));
  }, [excursionId]);

  // Загружает дорожный маршрут между соседними точками:
  useEffect(() => {
    if (!excursion?.route || excursion.route.points.length < 2) return;
    let cancelled = false;
    const sorted = [...excursion.route.points].sort((a, b) => a.order - b.order);

    async function loadSegment(from: typeof sorted[number], to: typeof sorted[number]) {
      // Прямая линия используется как запасной вариант:
      const fallback: [number, number][] = [[from.lat, from.lng], [to.lat, to.lng]];
      const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false&alternatives=true`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        const routes = Array.isArray(data.routes) ? data.routes : [];
        if (data.code !== 'Ok' || routes.length === 0) return fallback;
        // Выбираем самый короткий вариант из доступных:
        const shortest = routes
          .filter((route: any) => route.geometry?.coordinates?.length)
          .sort((a: any, b: any) => (a.distance || Infinity) - (b.distance || Infinity))[0];
        const coordinates = shortest?.geometry?.coordinates;
        if (!coordinates) return fallback;
        return coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
      } catch {
        return fallback;
      }
    }

    Promise.all(sorted.slice(0, -1).map((point, index) => loadSegment(point, sorted[index + 1]))).then((segments) => {
      if (cancelled) return;
      const merged = segments.flatMap((segment, index) => (index === 0 ? segment : segment.slice(1)));
      setRoadRoute(merged.length > 1 ? merged : null);
    });

    return () => {
      cancelled = true;
    };
  }, [excursion]);

  // Включает или выключает постоянное отслеживание позиции:
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
        if (err.code === 1) setGeoError('Доступ к геолокации запрещен');
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

  // Активирует точку, когда пользователь входит в ее радиус:
  useEffect(() => {
    if (!autoActivate || !userPosition || !excursion?.route) return;
    const sortedPoints = [...excursion.route.points].sort((a, b) => a.order - b.order);
    for (let i = 0; i < sortedPoints.length; i++) {
      const point = sortedPoints[i];
      const dist = distanceMeters(userPosition[0], userPosition[1], point.lat, point.lng);
      if (dist <= (point.radius || 50)) {
        setCurrentPointIndex(i);
        setSheetOpen(true);
        break;
      }
    }
  }, [autoActivate, excursion, userPosition]);

  // Сортированные точки нужны для стабильного порядка прохождения:
  const sortedPoints = useMemo(
    () => [...(excursion?.route?.points || [])].sort((a, b) => a.order - b.order),
    [excursion]
  );
  // Координаты точек для линии на карте:
  const positions: [number, number][] = sortedPoints.map((point) => [point.lat, point.lng]);
  // Текущая активная точка:
  const currentPoint = currentPointIndex >= 0 ? sortedPoints[currentPointIndex] : null;
  // Изображения текущей точки:
  const currentPointImages = currentPoint ? (currentPoint.media || []).filter((media) => media.type === 'image') : [];
  // Аудио текущей точки в заданном порядке:
  const currentPointAudio = currentPoint
    ? (currentPoint.media || [])
        .filter((media) => media.type === 'audio')
        .sort((a, b) => audioOrder(a, 0) - audioOrder(b, 0))
    : [];
  // Видео текущей точки:
  const currentPointVideo = currentPoint ? (currentPoint.media || []).filter((media) => media.type === 'video') : [];

  // Запускает аудиофайлы точки последовательно:
  const playAudioSequence = (audios: any[], index = 0) => {
    const item = audios[index];
    if (!item) return;
    setAudioPrompt(null);
    const audio = audioRefs.current[item.id];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {
      setAudioPrompt('Нажмите кнопку воспроизведения в аудиоплеере, чтобы браузер разрешил звук');
    });
  };

  // Автоматически запускает аудио при переходе к новой точке:
  useEffect(() => {
    if (!currentPoint || currentPointAudio.length === 0) return;
    if (lastAutoPlayedPointRef.current === currentPoint.id) return;
    lastAutoPlayedPointRef.current = currentPoint.id;
    window.setTimeout(() => playAudioSequence(currentPointAudio, 0), 120);
  }, [currentPoint?.id, currentPointAudio.length]);

  // Пока экскурсия не загружена, показываем простой экран ожидания:
  if (!excursion?.route) {
    return <div className="player-loading">Загрузка маршрута...</div>;
  }

  // Центр карты зависит от геолокации или первой точки маршрута:
  const center: [number, number] = userPosition || positions[0] || [59.939, 30.316];
  // Показываем дорожный маршрут или линию между точками:
  const routeLine = roadRoute || positions;
  // Следующая целевая точка для навигации:
  const nextPoint = currentPointIndex >= 0
    ? (currentPointIndex < sortedPoints.length - 1 ? sortedPoints[currentPointIndex + 1] : null)
    : sortedPoints[0] || null;
  // Расстояние до первой точки до начала экскурсии:
  const distToFirst = userPosition && sortedPoints[0]
    ? distanceMeters(userPosition[0], userPosition[1], sortedPoints[0].lat, sortedPoints[0].lng)
    : null;
  // Расстояние до следующей точки:
  const distToNext = userPosition && nextPoint
    ? distanceMeters(userPosition[0], userPosition[1], nextPoint.lat, nextPoint.lng)
    : null;
  // Определяет визуальное состояние точки на карте:
  const getPointState = (index: number): 'upcoming' | 'active' | 'visited' => {
    if (currentPointIndex < 0) return 'upcoming';
    if (index === currentPointIndex) return 'active';
    if (index < currentPointIndex) return 'visited';
    return 'upcoming';
  };

  // Переключает текущую точку вручную:
  const goToPoint = (index: number) => {
    setCurrentPointIndex(index);
    setSheetOpen(true);
    setSheetHeight((height) => Math.max(height, 42));
    setLightboxIndex(null);
  };

  // Завершает перетаскивание нижней панели:
  const finishSheetDrag = () => {
    dragRef.current = null;
    setSheetHeight((height) => {
      const next = height < 18 ? 6 : height > 50 ? 62 : 42;
      setSheetOpen(next > 12);
      return next;
    });
  };

  // Обновляет высоту панели во время движения пальца:
  const updateSheetDrag = (clientY: number) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - clientY;
    const next = dragRef.current.startHeight + (delta / window.innerHeight) * 100;
    const clamped = Math.max(6, Math.min(72, next));
    setSheetHeight(clamped);
    setSheetOpen(clamped > 12);
  };

  // Пунктирная линия ведет пользователя к первой точке:
  const routeToFirst: [number, number][] =
    userPosition && sortedPoints.length > 0 && currentPointIndex < 0
      ? [userPosition, [sortedPoints[0].lat, sortedPoints[0].lng]]
      : [];

  return (
    <div className="player-layout">
      {/* Основная карта прохождения экскурсии: */}
      <div className="player-map">
        <MapContainer center={center} zoom={14} style={{ width: '100%', height: '100%' }} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {routeLine.length > 1 && <Polyline positions={routeLine} color="#2563eb" weight={4} />}
          {routeToFirst.length === 2 && <Polyline positions={routeToFirst} color="#f59e0b" weight={3} dashArray="8 8" />}

          {sortedPoints.map((point, index) => (
            <React.Fragment key={point.id}>
              <Marker
                position={[point.lat, point.lng]}
                icon={pointMarkerIcon(point.order, getPointState(index))}
                eventHandlers={{ click: () => goToPoint(index) }}
              />
              <Circle
                center={[point.lat, point.lng]}
                radius={point.radius || 50}
                pathOptions={{
                  color: getPointState(index) === 'active' ? '#2563eb' : '#94a3b8',
                  fillColor: getPointState(index) === 'active' ? '#2563eb' : '#94a3b8',
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
              {following && <MapFollower position={userPosition} />}
            </>
          )}
        </MapContainer>

        <div className="player-top-bar">
          <button className="player-back-btn" onClick={() => navigate(-1)}>← Назад</button>
          <span className="player-tour-title">{excursion.title}</span>
        </div>

        {geoError && <div className="player-geo-error">{geoError}</div>}
      </div>

      {/* Нижняя панель с описанием точки и управлением прохождением: */}
      <div className={`player-sheet ${sheetOpen ? 'open' : 'collapsed'}`} style={{ height: `${sheetHeight}vh` }}>
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
                  {sortedPoints.length} точек | {excursion.route.duration} мин | {(excursion.route.distance / 1000).toFixed(1)} км
                </p>
                {distToFirst !== null && (
                  <p className="sheet-welcome-distance">
                    До первой точки: <strong>{formatDistance(distToFirst)}</strong>
                  </p>
                )}
                <p className="sheet-welcome-hint">
                  Идите к первой точке маршрута. Когда вы окажетесь в зоне активации, описание и аудио откроются автоматически.
                </p>
                <Button variant="primary" size="sm" onClick={() => goToPoint(0)} style={{ width: '100%', marginTop: 12, marginBottom: 16 }}>
                  Начать с первой точки
                </Button>
              </div>
            ) : currentPoint ? (
              <>
                <div className="sheet-stop-header">
                  <div className="sheet-stop-number">{currentPoint.order + 1}</div>
                  <div>
                    <h2>{currentPoint.title}</h2>
                    <span className="sheet-stop-dur">{currentPoint.duration} мин на точке</span>
                  </div>
                </div>
                <p className="sheet-stop-desc">{currentPoint.description}</p>

                {currentPointImages.length > 0 && (
                  <div className="sheet-gallery">
                    {currentPointImages.map((media, index) => (
                      <img
                        key={media.id}
                        className="sheet-gallery-img"
                        src={`${SERVER_URL}${media.url}`}
                        alt={media.title}
                        onClick={() => setLightboxIndex(index)}
                      />
                    ))}
                  </div>
                )}

                {(currentPointAudio.length > 0 || currentPointVideo.length > 0) && (
                  <div className="sheet-media-stack">
                    {audioPrompt && <p className="audio-autoplay-note">{audioPrompt}</p>}
                    {currentPointAudio.map((media, index) => (
                      <AudioTrack
                        key={media.id}
                        media={media}
                        index={index}
                        total={currentPointAudio.length}
                        src={`${SERVER_URL}${media.url}`}
                        setAudioRef={(node) => {
                          audioRefs.current[media.id] = node;
                        }}
                        onEnded={() => playAudioSequence(currentPointAudio, index + 1)}
                      />
                    ))}
                    {currentPointVideo.map((media) => (
                      <video key={media.id} src={`${SERVER_URL}${media.url}`} controls />
                    ))}
                  </div>
                )}

                {distToNext !== null && currentPointIndex < sortedPoints.length - 1 && (
                  <p className="sheet-distance-next">
                    До следующей точки: <strong>{formatDistance(distToNext)}</strong>
                  </p>
                )}

                <div className="sheet-nav">
                  <Button variant="secondary" size="sm" disabled={currentPointIndex === 0} onClick={() => goToPoint(currentPointIndex - 1)}>
                    ← Предыдущая
                  </Button>
                  <span className="sheet-nav-counter">{currentPointIndex + 1} / {sortedPoints.length}</span>
                  <Button variant="secondary" size="sm" disabled={currentPointIndex === sortedPoints.length - 1} onClick={() => goToPoint(currentPointIndex + 1)}>
                    Следующая →
                  </Button>
                </div>
              </>
            ) : null}

            <div className="sheet-location">
              {/* Управление геолокацией: */}
              <Button
                variant={geoEnabled ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  const next = !geoEnabled;
                  setGeoEnabled(next);
                  setAutoActivate(next);
                  setFollowing(next);
                }}
                style={{ width: '100%' }}
              >
                {geoEnabled ? 'Отключить геолокацию' : 'Включить геолокацию'}
              </Button>
              {geoEnabled && userPosition && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFollowing(true)}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  Центрировать по мне
                </Button>
              )}
            </div>

            <div className="sheet-stops-list">
              {/* Быстрый список всех точек маршрута: */}
              {sortedPoints.map((point, index) => {
                const state = getPointState(index);
                return (
                  <div key={point.id} className={`sheet-stop-item ${state}`} onClick={() => goToPoint(index)}>
                    <span className={`sheet-stop-item-num ${state}`}>{state === 'visited' ? '✓' : index + 1}</span>
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

      {/* Просмотр изображений точки во весь экран: */}
      {lightboxIndex !== null && currentPointImages.length > 0 && (
        <div className="lightbox-overlay" onClick={() => setLightboxIndex(null)}>
          <button className="lightbox-close" onClick={() => setLightboxIndex(null)}>&times;</button>
          {currentPointImages.length > 1 && (
            <button
              className="lightbox-arrow lightbox-arrow-left"
              onClick={(event) => {
                event.stopPropagation();
                setLightboxIndex((lightboxIndex - 1 + currentPointImages.length) % currentPointImages.length);
              }}
            >
              &#8249;
            </button>
          )}
          <img
            className="lightbox-img"
            src={`${SERVER_URL}${currentPointImages[lightboxIndex].url}`}
            alt={currentPointImages[lightboxIndex].title}
            onClick={(event) => event.stopPropagation()}
          />
          {currentPointImages.length > 1 && (
            <button
              className="lightbox-arrow lightbox-arrow-right"
              onClick={(event) => {
                event.stopPropagation();
                setLightboxIndex((lightboxIndex + 1) % currentPointImages.length);
              }}
            >
              &#8250;
            </button>
          )}
          <div className="lightbox-counter">{lightboxIndex + 1} / {currentPointImages.length}</div>
        </div>
      )}
    </div>
  );
}
