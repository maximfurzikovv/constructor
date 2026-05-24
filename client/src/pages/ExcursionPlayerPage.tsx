import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import type { Excursion } from 'shared/types';
import './ExcursionPlayerPage.css';

const SERVER_URL = '';

// Иконка текущего положения:
const userIcon = L.divIcon({
  className: 'user-marker',
  html: '<div class="user-marker-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Иконка точки маршрута:
function pointMarkerIcon(order: number, state: 'upcoming' | 'active' | 'visited') {
  return L.divIcon({
    className: 'player-stop-marker',
    html: `<div class="player-stop-inner ${state}">${order + 1}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Центрирует карту только по нажатию кнопки:
function MapFollower({ position, trigger }: { position: [number, number]; trigger: number }) {
  const map = useMap();

  useEffect(() => {
    if (trigger > 0) map.panTo(position, { animate: true, duration: 0.5 });
  }, [map, trigger]);

  return null;
}

// Считает расстояние по формуле гаверсинусов:
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6371000; // Радиус Земли в метрах
  const phi1 = (lat1 * Math.PI) / 180; // Широта первой точки
  const phi2 = (lat2 * Math.PI) / 180; // Широта второй точки
  const dPhi = ((lat2 - lat1) * Math.PI) / 180; // Разница широт
  const dLambda = ((lng2 - lng1) * Math.PI) / 180; // Разница долгот
  const hav =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2; // Гаверсинус

  return 2 * radius * Math.asin(Math.sqrt(Math.min(1, Math.max(0, hav)))); // Расстояние
}

// Считает длину маршрута по точкам:
function pointsDistance(points: Array<{ lat: number; lng: number }>) {
  return points.slice(1).reduce((sum, point, index) => {
    const prev = points[index]; // Предыдущая точка
    return sum + distanceMeters(prev.lat, prev.lng, point.lat, point.lng);
  }, 0);
}

// Форматирует расстояние:
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

// Форматирует время аудио:
function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60); // Минуты
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0'); // Секунды
  return `${minutes}:${rest}`;
}

// Возвращает порядок аудио:
function audioOrder(media: any, index: number) {
  const parsed = Number(media.description); // Порядок из описания
  return Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1;
}

// Возвращает понятное название аудио:
function audioTitle(media: any, index: number) {
  const title = String(media.title || '').trim(); // Название из базы
  const looksLikeFile = /(\.mp3|\.wav|\.m4a|\.ogg|\.webm|\.aac)$/i.test(title) || title.includes('_'); // Техническое имя
  return !title || looksLikeFile ? `Аудиофайл ${index + 1}` : title;
}

// Отображает аудиодорожку:
function AudioTrack({
  media,
  index,
  total,
  src,
  setAudioRef,
  onEnded,
  autoPlayToken,
  onAutoBlocked,
}: {
  media: any;
  index: number;
  total: number;
  src: string;
  setAudioRef: (node: HTMLAudioElement | null) => void;
  onEnded: () => void;
  autoPlayToken: number;
  onAutoBlocked: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null); // Ссылка на audio
  const [playing, setPlaying] = useState(false); // Состояние воспроизведения
  const [current, setCurrent] = useState(0); // Текущее время
  const [duration, setDuration] = useState(0); // Длительность

  // Передает audio наружу:
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

  // Пробует автозапуск первого аудио:
  useEffect(() => {
    if (!autoPlayToken || index !== 0) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(onAutoBlocked);
  }, [autoPlayToken, index, onAutoBlocked]);

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
        playsInline
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
  const { excursionId } = useParams<{ excursionId: string }>(); // Id экскурсии
  const navigate = useNavigate(); // Навигация
  const [excursion, setExcursion] = useState<Excursion | null>(null); // Экскурсия
  const [currentPointIndex, setCurrentPointIndex] = useState(-1); // Индекс точки
  const [sheetOpen, setSheetOpen] = useState(true); // Нижняя панель
  const [sheetHeight, setSheetHeight] = useState(42); // Высота панели
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null); // Позиция пользователя
  const [geoError, setGeoError] = useState<string | null>(null); // Ошибка геолокации
  const [geoEnabled, setGeoEnabled] = useState(true); // Геолокация
  const [autoActivate, setAutoActivate] = useState(true); // Автоактивация точек
  const [centerRequest, setCenterRequest] = useState(0); // Ручное центрирование
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null); // Просмотр фото
  const [roadRoute, setRoadRoute] = useState<[number, number][] | null>(null); // Линия маршрута
  const [audioPrompt, setAudioPrompt] = useState<string | null>(null); // Подсказка аудио
  const [autoPlayToken, setAutoPlayToken] = useState(0); // Запрос автозапуска
  const [fullTextOpen, setFullTextOpen] = useState(false); // Полный текст
  const watchIdRef = useRef<number | null>(null); // Id слежения
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null); // Перетаскивание панели
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({}); // Audio-ссылки
  const lastAutoPlayedPointRef = useRef<string | null>(null); // Последняя автозапущенная точка

  // Показывает подсказку, если браузер заблокировал звук:
  const handleAutoBlocked = useCallback(() => {
    setAudioPrompt('Если звук не включился автоматически, нажмите кнопку воспроизведения в аудиоплеере.');
  }, []);

  // Загружает экскурсию:
  useEffect(() => {
    if (excursionId) api.getExcursion(excursionId, true).then((data: any) => setExcursion(data));
  }, [excursionId]);

  const sortedPoints = useMemo(
    () => [...(excursion?.route?.points || [])].sort((a, b) => a.order - b.order),
    [excursion]
  ); // Точки по порядку

  const positions: [number, number][] = sortedPoints.map((point) => [point.lat, point.lng]); // Координаты
  const finished = sortedPoints.length > 0 && currentPointIndex >= sortedPoints.length; // Маршрут завершен
  const currentPoint = currentPointIndex >= 0 && currentPointIndex < sortedPoints.length ? sortedPoints[currentPointIndex] : null; // Активная точка
  const routeDistance = excursion?.route?.distance || pointsDistance(sortedPoints); // Длина
  const routeDuration = excursion?.route?.duration || sortedPoints.reduce((sum, point) => sum + (Number(point.duration) || 0), 0); // Время

  const currentPointImages = currentPoint ? (currentPoint.media || []).filter((media) => media.type === 'image') : []; // Изображения
  const currentPointAudio = currentPoint
    ? (currentPoint.media || []).filter((media) => media.type === 'audio').sort((a, b) => audioOrder(a, 0) - audioOrder(b, 0))
    : []; // Аудио

  // Загружает дорожную линию между точками:
  useEffect(() => {
    if (sortedPoints.length < 2) return;
    let cancelled = false;

    async function loadSegment(from: typeof sortedPoints[number], to: typeof sortedPoints[number]) {
      const fallback: [number, number][] = [[from.lat, from.lng], [to.lat, to.lng]]; // Запасная линия
      const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false&alternatives=true`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        const routes = Array.isArray(data.routes) ? data.routes : [];
        if (data.code !== 'Ok' || routes.length === 0) return fallback;
        const shortest = routes
          .filter((route: any) => route.geometry?.coordinates?.length)
          .sort((a: any, b: any) => (a.distance || Infinity) - (b.distance || Infinity))[0]; // Короткий путь
        const coordinates = shortest?.geometry?.coordinates;
        if (!coordinates) return fallback;
        return coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
      } catch {
        return fallback;
      }
    }

    Promise.all(sortedPoints.slice(0, -1).map((point, index) => loadSegment(point, sortedPoints[index + 1]))).then((segments) => {
      if (cancelled) return;
      const merged = segments.flatMap((segment, index) => (index === 0 ? segment : segment.slice(1)));
      setRoadRoute(merged.length > 1 ? merged : null);
    });

    return () => {
      cancelled = true;
    };
  }, [sortedPoints]);

  // Следит за местоположением во время движения:
  useEffect(() => {
    if (!geoEnabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setGeoError('Геолокация не поддерживается браузером');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPosition([pos.coords.latitude, pos.coords.longitude]); // Новые координаты
        setGeoError(null);
      },
      (err) => {
        if (err.code === 1) setGeoError('Доступ к геолокации запрещен');
        else if (err.code === 2) setGeoError('Не удалось определить местоположение');
        else setGeoError('Ошибка геолокации');
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [geoEnabled]);

  // Активирует точку при входе в радиус:
  useEffect(() => {
    if (!autoActivate || !userPosition || !sortedPoints.length || finished) return;
    for (let i = 0; i < sortedPoints.length; i += 1) {
      const point = sortedPoints[i];
      const dist = distanceMeters(userPosition[0], userPosition[1], point.lat, point.lng);
      if (dist <= (point.radius || 50)) {
        setCurrentPointIndex(i);
        setSheetOpen(true);
        break;
      }
    }
  }, [autoActivate, finished, sortedPoints, userPosition]);

  // Запускает следующее аудио:
  const playAudioSequence = (audios: any[], index = 0) => {
    const item = audios[index];
    if (!item) return;
    setAudioPrompt(null);
    const audio = audioRefs.current[item.id];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(handleAutoBlocked);
  };

  // Пытается включить первое аудио точки:
  useEffect(() => {
    if (!currentPoint || currentPointAudio.length === 0) return;
    if (lastAutoPlayedPointRef.current === currentPoint.id) return;
    lastAutoPlayedPointRef.current = currentPoint.id;
    setAudioPrompt(null);
    setAutoPlayToken((value) => value + 1);
  }, [currentPoint?.id, currentPointAudio.length]);

  if (!excursion?.route) {
    return <div className="player-loading">Загрузка маршрута...</div>;
  }

  const center: [number, number] = positions[0] || userPosition || [59.939, 30.316]; // Начальный центр
  const routeLine = roadRoute || positions; // Линия маршрута
  const siteBackPath = (() => {
    const match = window.location.pathname.match(/^\/s\/([^/]+)/);
    return match ? `/s/${match[1]}` : '/';
  })(); // Адрес сайта
  const nextPoint = currentPointIndex >= 0
    ? (currentPointIndex < sortedPoints.length - 1 ? sortedPoints[currentPointIndex + 1] : null)
    : sortedPoints[0] || null; // Следующая цель
  const distToFirst = userPosition && sortedPoints[0]
    ? distanceMeters(userPosition[0], userPosition[1], sortedPoints[0].lat, sortedPoints[0].lng)
    : null; // До первой точки
  const distToNext = userPosition && nextPoint
    ? distanceMeters(userPosition[0], userPosition[1], nextPoint.lat, nextPoint.lng)
    : null; // До следующей точки

  // Возвращает состояние точки:
  const getPointState = (index: number): 'upcoming' | 'active' | 'visited' => {
    if (finished) return 'visited';
    if (currentPointIndex < 0) return 'upcoming';
    if (index === currentPointIndex) return 'active';
    if (index < currentPointIndex) return 'visited';
    return 'upcoming';
  };

  // Открывает точку вручную:
  const goToPoint = (index: number) => {
    setCurrentPointIndex(index);
    setSheetOpen(true);
    setSheetHeight((height) => Math.max(height, 42));
    setLightboxIndex(null);
    setFullTextOpen(false);
  };

  // Завершает маршрут:
  const finishRoute = () => {
    setCurrentPointIndex(sortedPoints.length);
    setSheetOpen(true);
    setSheetHeight(42);
    setFullTextOpen(false);
  };

  // Завершает перетаскивание панели:
  const finishSheetDrag = () => {
    dragRef.current = null;
    setSheetHeight((height) => {
      const next = height < 18 ? 6 : height > 50 ? 62 : 42;
      setSheetOpen(next > 12);
      return next;
    });
  };

  // Двигает нижнюю панель:
  const updateSheetDrag = (clientY: number) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - clientY;
    const next = dragRef.current.startHeight + (delta / window.innerHeight) * 100;
    const clamped = Math.max(6, Math.min(72, next));
    setSheetHeight(clamped);
    setSheetOpen(clamped > 12);
  };

  const routeToFirst: [number, number][] =
    userPosition && sortedPoints.length > 0 && currentPointIndex < 0
      ? [userPosition, [sortedPoints[0].lat, sortedPoints[0].lng]]
      : []; // Путь к старту

  return (
    <div className="player-layout">
      <div className="player-map">
        <MapContainer center={center} zoom={14} style={{ width: '100%', height: '100%' }} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {routeLine.length > 1 && <Polyline positions={routeLine} color="#2563eb" weight={4} />}
          {routeToFirst.length === 2 && <Polyline positions={routeToFirst} color="#f59e0b" weight={3} dashArray="8 8" />}

          {sortedPoints.map((point, index) => (
            <React.Fragment key={point.id}>
              <Marker position={[point.lat, point.lng]} icon={pointMarkerIcon(point.order, getPointState(index))} eventHandlers={{ click: () => goToPoint(index) }} />
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
              {centerRequest > 0 && <MapFollower position={userPosition} trigger={centerRequest} />}
            </>
          )}
        </MapContainer>

        <div className="player-top-bar">
          <button className="player-back-btn" onClick={() => navigate(-1)}>← Назад</button>
          <span className="player-tour-title">{excursion.title}</span>
        </div>

        {geoError && <div className="player-geo-error">{geoError}</div>}
      </div>

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
                  {sortedPoints.length} точек | {routeDuration} мин | {(routeDistance / 1000).toFixed(1)} км
                </p>
                {distToFirst !== null && (
                  <p className="sheet-welcome-distance">
                    До первой точки: <strong>{formatDistance(distToFirst)}</strong>
                  </p>
                )}
                <p className="sheet-welcome-hint">
                  Идите к первой точке маршрута. Когда вы окажетесь в зоне активации, описание и аудио откроются автоматически.
                </p>
                <Button variant="primary" size="sm" onClick={() => goToPoint(0)} className="sheet-primary-action">
                  Начать с первой точки
                </Button>
              </div>
            ) : finished ? (
              <div className="sheet-finished">
                <h2>Маршрут пройден</h2>
                <p>Вы прошли {formatDistance(routeDistance)} и познакомились с {sortedPoints.length} точками маршрута.</p>
                <div className="sheet-finished-actions">
                  <Button variant="primary" size="sm" onClick={() => navigate(siteBackPath)}>
                    Вернуться на сайт
                  </Button>
                </div>
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
                {currentPoint.description && currentPoint.description.length > 140 && (
                  <button className="sheet-read-more" type="button" onClick={() => setFullTextOpen(true)}>
                    Читать полностью
                  </button>
                )}

                {currentPointImages.length > 0 && (
                  <div className="sheet-gallery">
                    {currentPointImages.map((media, index) => (
                      <img key={media.id} className="sheet-gallery-img" src={`${SERVER_URL}${media.url}`} alt={media.title} onClick={() => setLightboxIndex(index)} />
                    ))}
                  </div>
                )}

                {currentPointAudio.length > 0 && (
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
                        autoPlayToken={autoPlayToken}
                        onAutoBlocked={handleAutoBlocked}
                      />
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
                  {currentPointIndex === sortedPoints.length - 1 ? (
                    <Button variant="primary" size="sm" onClick={finishRoute}>Завершить</Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => goToPoint(currentPointIndex + 1)}>Следующая →</Button>
                  )}
                </div>
              </>
            ) : null}

            <div className="sheet-location">
              <div className="sheet-location-actions">
                <Button
                  variant={geoEnabled ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    const next = !geoEnabled;
                    setGeoEnabled(next);
                    setAutoActivate(next);
                  }}
                >
                  {geoEnabled ? 'Отключить геолокацию' : 'Включить геолокацию'}
                </Button>
                {geoEnabled && userPosition && (
                  <Button variant="secondary" size="sm" onClick={() => setCenterRequest((value) => value + 1)}>
                    Центрировать по мне
                  </Button>
                )}
              </div>
            </div>

            <div className="sheet-stops-list">
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

      {lightboxIndex !== null && currentPointImages.length > 0 && (
        <div className="lightbox-overlay" onClick={() => setLightboxIndex(null)}>
          <button className="lightbox-close" onClick={() => setLightboxIndex(null)}>&times;</button>
          <img className="lightbox-img" src={`${SERVER_URL}${currentPointImages[lightboxIndex].url}`} alt={currentPointImages[lightboxIndex].title} onClick={(event) => event.stopPropagation()} />
          <div className="lightbox-counter">{lightboxIndex + 1} / {currentPointImages.length}</div>
        </div>
      )}

      {fullTextOpen && currentPoint && (
        <div className="point-text-modal" onClick={() => setFullTextOpen(false)}>
          <div className="point-text-dialog" onClick={(event) => event.stopPropagation()}>
            <button className="point-text-close" type="button" onClick={() => setFullTextOpen(false)}>&times;</button>
            <h2>{currentPoint.title}</h2>
            <p>{currentPoint.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
