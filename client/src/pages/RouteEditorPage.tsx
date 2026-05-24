import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import Input, { Textarea } from '../components/ui/Input';
import type { Excursion, MediaItem, Point } from 'shared/types';
import './RouteEditorPage.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SERVER_URL = '';
let tempIdCounter = 0;

// Временный id для точки:
function nextTempId() {
  return `temp-${++tempIdCounter}`;
}

// Кастомная иконка точки:
function pointIcon(order: number, selected: boolean) {
  return L.divIcon({
    className: 'stop-marker',
    html: `<div class="stop-marker-inner ${selected ? 'selected' : ''}">${order + 1}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Обрабатка клика по карте:
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Возвращает порядок аудио:
function audioOrder(media: any, index: number) {
  const parsed = Number(media.description);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1;
}

// Проверяет, похоже ли название на техническое имя файла:
function isRawFileName(title: string) {
  return /(\.mp3|\.wav|\.m4a|\.ogg|\.webm|\.aac|\.mp4)$/i.test(title) || title.includes('_');
}

// Считает расстояние между двумя координатами:
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371000; // Радиус Земли в метрах
  const dLat = ((lat2 - lat1) * Math.PI) / 180; // Разница широт
  const dLng = ((lng2 - lng1) * Math.PI) / 180; // Разница долгот
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2; // Формула гаверсинусов
  return 2 * radius * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))); // Расстояние в метрах
}

// Считает длину маршрута по точкам:
function routeDistanceMeters(points: Point[]) {
  return points.slice(1).reduce((sum, point, index) => {
    const prev = points[index]; // Предыдущая точка
    return sum + distanceMeters(prev.lat, prev.lng, point.lat, point.lng);
  }, 0);
}

// Считает длительность маршрута по остановкам:
function routeDurationMinutes(points: Point[]) {
  return points.reduce((sum, point) => sum + (Number(point.duration) || 0), 0);
}

export default function RouteEditorPage() {
  // id экскурсии из адреса страницы:
  const { excursionId } = useParams<{ excursionId: string }>();
  // Храним загруженную экскурсию:
  const [excursion, setExcursion] = useState<Excursion | null>(null);
  // Храним выбранную точку маршрута:
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  // Режим добавления новой точки на карту:
  const [addMode, setAddMode] = useState(false);
  // Флаг процесса сохранения:
  const [saving, setSaving] = useState(false);
  // Текст статуса для пользователя:
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  // Флаг несохраненных изменений:
  const [hasChanges, setHasChanges] = useState(false);
  // Флаг загрузки медиафайла:
  const [uploadingMedia, setUploadingMedia] = useState(false);
  // Флаг открытия медиатеки точки:
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  // Файлы медиатеки текущей экскурсии:
  const [libraryMedia, setLibraryMedia] = useState<MediaItem[]>([]);
  // Флаг загрузки списка медиатеки:
  const [libraryLoading, setLibraryLoading] = useState(false);
  // Флаг открытия медиатеки для выбора обложки:
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  // Файлы медиатеки для выбора обложки:
  const [coverLibraryMedia, setCoverLibraryMedia] = useState<MediaItem[]>([]);
  // Флаг загрузки обложки:
  const [coverUploading, setCoverUploading] = useState(false);
  // Черновики названий медиа:
  const [mediaTitleDrafts, setMediaTitleDrafts] = useState<Record<string, string>>({});
  // Защита от отметки изменений при первой загрузке:
  const initialLoadDone = useRef(false);
  // Ссылка на скрытый input для выбора файла:
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ссылка на скрытый input обложки:
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Загрузка экскурсии с маршрутом при открытии редактора:
  useEffect(() => {
    if (!excursionId) return;
    api.getExcursion(excursionId).then((data: any) => {
      setExcursion(data);
      initialLoadDone.current = true;
    });
  }, [excursionId]);

  // Пометка формы измененной после начальной загрузки:
  const markDirty = useCallback(() => {
    if (initialLoadDone.current) setHasChanges(true);
  }, []);

  // Обновление выбранной точки:
  const syncSelectedPoint = (updatedPoint: Point) => {
    setSelectedPoint(updatedPoint);
    setExcursion((prev) =>
      prev && prev.route
        ? {
            ...prev,
            route: {
              ...prev.route,
              points: prev.route.points.map((point) => (point.id === updatedPoint.id ? updatedPoint : point)),
            },
          }
        : prev
    );
  };

  // Добавление новой точку в место клика по карте:
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!addMode || !excursion?.route) return;
      const points = excursion.route.points;
      const newPoint: Point = {
        id: nextTempId(),
        routeId: excursion.route.id,
        title: `Точка ${points.length + 1}`,
        description: '',
        lat,
        lng,
        order: points.length,
        duration: 5,
        radius: 50,
        media: [],
      };

      setExcursion((prev) =>
        prev?.route
          ? {
              ...prev,
              route: {
                ...prev.route,
                points: [...prev.route.points, newPoint],
                routeGeo: {
                  ...prev.route.routeGeo,
                  coordinates: [...prev.route.routeGeo.coordinates, [lng, lat]],
                },
              },
            }
          : prev
      );
      setSelectedPoint(newPoint);
      setAddMode(false);
      markDirty();
    },
    [addMode, excursion, markDirty]
  );

  // Изменение одного поля выбранной точки:
  const handlePointUpdate = (field: string, value: string | number) => {
    if (!selectedPoint) return;
    syncSelectedPoint({ ...selectedPoint, [field]: value });
    markDirty();
  };

  // Удаляет точку и пересчитывает порядок маршрута:
  const handleDeletePoint = (pointId: string) => {
    setExcursion((prev) => {
      if (!prev?.route) return prev;
      const reordered = prev.route.points
        .filter((point) => point.id !== pointId)
        .sort((a, b) => a.order - b.order)
        .map((point, index) => ({ ...point, order: index }));
      return { ...prev, route: { ...prev.route, points: reordered } };
    });
    if (selectedPoint?.id === pointId) setSelectedPoint(null);
    markDirty();
  };

  // Загружает изображение или аудио для выбранной точки:
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0] || !selectedPoint || !excursion) return;
    setUploadingMedia(true);
    setStatusMsg(null);
    try {
      const media: any = await api.uploadMedia(event.target.files[0], excursion.id, selectedPoint.id);
      const audioCount = (selectedPoint.media || []).filter((item) => item.type === 'audio').length;
      const audioTitle = !media.title || isRawFileName(media.title) ? `Аудиофайл ${audioCount + 1}` : media.title;
      const mediaWithOrder = media.type === 'audio'
        ? await api.updateMedia(media.id, { title: audioTitle, description: String(audioCount + 1) })
        : media;
      syncSelectedPoint({ ...selectedPoint, media: [...(selectedPoint.media || []), mediaWithOrder as any] });
      setStatusMsg('Медиа загружено');
      setTimeout(() => setStatusMsg(null), 2500);
    } catch {
      setStatusMsg('Ошибка загрузки медиа');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Открывает медиатеку для выбора готового файла:
  const openMediaPicker = async () => {
    if (!excursion || !selectedPoint || selectedPoint.id.startsWith('temp-')) return;
    setMediaPickerOpen(true);
    setLibraryLoading(true);
    setStatusMsg(null);
    try {
      const items: any = await api.getMedia(excursion.id);
      setLibraryMedia(items); // Сохраняем файлы экскурсии
    } catch {
      setStatusMsg('Ошибка загрузки медиатеки');
    } finally {
      setLibraryLoading(false);
    }
  };

  // Сохраняет выбранную обложку экскурсии:
  const saveCoverImage = async (coverImage: string) => {
    if (!excursion) return;
    setStatusMsg(null);
    try {
      const updated: any = await api.updateExcursion(excursion.id, { coverImage });
      setExcursion((prev) => (prev ? { ...prev, coverImage: updated.coverImage } : prev));
      setStatusMsg('Обложка обновлена');
      setTimeout(() => setStatusMsg(null), 2500);
    } catch {
      setStatusMsg('Ошибка сохранения обложки');
    }
  };

  // Загружает новую обложку с компьютера:
  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0] || !excursion) return;
    setCoverUploading(true);
    setStatusMsg(null);
    try {
      const media: any = await api.uploadMedia(event.target.files[0], excursion.id);
      await saveCoverImage(media.url);
    } catch {
      setStatusMsg('Ошибка загрузки обложки');
    } finally {
      setCoverUploading(false);
      if (coverFileInputRef.current) coverFileInputRef.current.value = '';
    }
  };

  // Открывает медиатеку для выбора обложки:
  const openCoverPicker = async () => {
    if (!excursion) return;
    setCoverPickerOpen(true);
    setLibraryLoading(true);
    setStatusMsg(null);
    try {
      const items: any = await api.getMedia(excursion.id);
      setCoverLibraryMedia(items.filter((item: MediaItem) => item.type === 'image')); // Для обложки нужны изображения
    } catch {
      setStatusMsg('Ошибка загрузки медиатеки');
    } finally {
      setLibraryLoading(false);
    }
  };

  // Назначает изображение из медиатеки обложкой:
  const attachCoverFromLibrary = async (media: MediaItem) => {
    await saveCoverImage(media.url);
    setCoverPickerOpen(false);
  };

  // Привязывает выбранный файл медиатеки к точке:
  const attachMediaFromLibrary = async (media: MediaItem) => {
    if (!selectedPoint) return;
    // Не переносим файл с другой точки без явного удаления:
    if (media.pointId && media.pointId !== selectedPoint.id) {
      setStatusMsg('Файл уже привязан к другой точке');
      return;
    }
    // Не добавляем один и тот же файл повторно:
    if ((selectedPoint.media || []).some((item) => item.id === media.id)) {
      setMediaPickerOpen(false);
      return;
    }
    try {
      const audioCount = (selectedPoint.media || []).filter((item) => item.type === 'audio').length;
      const description = media.type === 'audio' ? String(audioCount + 1) : media.description;
      const title = media.type === 'audio' && isRawFileName(media.title) ? `Аудиофайл ${audioCount + 1}` : media.title;
      const updated: any = await api.updateMedia(media.id, {
        title,
        description,
        pointId: selectedPoint.id,
      });
      syncSelectedPoint({ ...selectedPoint, media: [...(selectedPoint.media || []), updated] });
      setLibraryMedia((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setMediaPickerOpen(false);
      setStatusMsg('Медиа добавлено к точке');
      setTimeout(() => setStatusMsg(null), 2500);
    } catch {
      setStatusMsg('Ошибка добавления медиа');
    }
  };

  // Меняет черновик названия медиа:
  const handleMediaTitleDraftChange = (mediaId: string, title: string) => {
    setMediaTitleDrafts((prev) => ({ ...prev, [mediaId]: title }));
  };

  // Сохраняет отображаемое название медиа:
  const saveMediaTitle = async (media: any) => {
    if (!selectedPoint) return;
    const draft = mediaTitleDrafts[media.id];
    if (draft === undefined) return;
    const title = draft.trim() || media.title;
    const updated: any = await api.updateMedia(media.id, {
      title,
      description: media.description,
      pointId: selectedPoint.id,
    });
    syncSelectedPoint({
      ...selectedPoint,
      media: (selectedPoint.media || []).map((item) => (item.id === updated.id ? updated : item)),
    });
    setMediaTitleDrafts((prev) => {
      const next = { ...prev };
      delete next[media.id];
      return next;
    });
  };

  // Удаляет медиафайл точки:
  const handleMediaDelete = async (mediaId: string) => {
    if (!selectedPoint) return;
    try {
      await api.deleteMedia(mediaId);
      syncSelectedPoint({
        ...selectedPoint,
        media: (selectedPoint.media || []).filter((media) => media.id !== mediaId),
      });
    } catch {
      setStatusMsg('Ошибка удаления медиа');
    }
  };

  // Меняет порядок воспроизведения аудио внутри точки:
  const handleMediaOrderChange = async (media: any, order: number) => {
    if (!selectedPoint) return;
    const nextOrder = Math.max(1, order || 1);
    const updated: any = await api.updateMedia(media.id, {
      title: media.title,
      description: String(nextOrder),
      pointId: selectedPoint.id,
    });
    syncSelectedPoint({
      ...selectedPoint,
      media: (selectedPoint.media || []).map((item) => (item.id === updated.id ? updated : item)),
    });
  };

  // Сохраняет маршрут или сразу публикует экскурсию:
  const saveRoute = async (publish: boolean) => {
    if (!excursion?.route) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const sortedPoints = [...excursion.route.points].sort((a, b) => a.order - b.order);
      const routeDuration = routeDurationMinutes(sortedPoints);
      const routeDistance = routeDistanceMeters(sortedPoints);

      await api.updateExcursion(excursion.id, {
        title: excursion.title,
        description: excursion.description,
        city: excursion.city,
        status: excursion.status,
        route: {
          duration: routeDuration,
          distance: routeDistance,
          transport: excursion.route.transport,
        },
      });

      const synced: any = await api.syncPoints(
        excursion.route.id,
        sortedPoints.map((point) => ({
          id: point.id,
          title: point.title,
          description: point.description,
          lat: point.lat,
          lng: point.lng,
          order: point.order,
          duration: point.duration,
          radius: point.radius ?? 50,
        }))
      );

      if (publish) await api.publishExcursion(excursion.id);

      setExcursion((prev) =>
        prev?.route
          ? {
              ...prev,
              status: publish ? 'published' : prev.status,
              route: {
                ...prev.route,
                duration: routeDuration,
                distance: routeDistance,
                points: synced,
                routeGeo: {
                  type: 'LineString',
                  coordinates: synced.map((point: any) => [point.lng, point.lat]),
                },
              },
            }
          : prev
      );

      if (selectedPoint) {
        const index = sortedPoints.findIndex((point) => point.id === selectedPoint.id);
        setSelectedPoint(index >= 0 && synced[index] ? synced[index] : null);
      }

      setHasChanges(false);
      setStatusMsg(publish ? 'Экскурсия опубликована' : 'Сохранено');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch {
      setStatusMsg(publish ? 'Ошибка публикации' : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (!excursion?.route) {
    return <div className="editor-loading">Загрузка...</div>;
  }

  // Берем точки маршрута для дальнейшего отображения:
  const points = excursion.route.points;
  // Сортируем точки по порядку прохождения:
  const sortedPoints = [...points].sort((a, b) => a.order - b.order);
  // Показатели меняются сразу при редактировании точек:
  const visibleDuration = routeDurationMinutes(sortedPoints);
  const visibleDistance = routeDistanceMeters(sortedPoints);
  // Готовим координаты для линии маршрута:
  const routePositions: [number, number][] = sortedPoints.map((point) => [point.lat, point.lng]);
  // Центр карты ставим на первую точку или на значение по умолчанию:
  const center: [number, number] = points.length > 0 ? [points[0].lat, points[0].lng] : [59.939, 30.316];
  // Отдельно выбираем аудио выбранной точки:
  const audioMedia = (selectedPoint?.media || []).filter((media) => media.type === 'audio');

  return (
    <div className="editor-layout">
      {/* Левая панель инструментов маршрута: */}
      <div className="editor-tools">
        <h3>Инструменты</h3>
        <Button
          variant={addMode ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setAddMode(!addMode)}
          style={{ width: '100%' }}
        >
          {addMode ? 'Режим добавления включен' : '+ Добавить точку'}
        </Button>

        <div className="tools-divider" />
        <h4>Точки маршрута</h4>
        <div className="stop-list">
          {sortedPoints.map((point) => (
            <div
              key={point.id}
              className={`stop-list-item ${selectedPoint?.id === point.id ? 'active' : ''}`}
              onClick={() => setSelectedPoint(point)}
            >
              <span className="stop-order">{point.order + 1}</span>
              <span className="stop-title">{point.title}</span>
            </div>
          ))}
          {points.length === 0 && (
            <p className="stop-list-empty">Нажмите «Добавить точку» и кликните по карте.</p>
          )}
        </div>

        <div className="tools-divider" />
        <div className="tour-info-mini">
          <p><strong>{excursion.title}</strong></p>
          <p>{points.length} точек | {visibleDuration} мин | {(visibleDistance / 1000).toFixed(1)} км</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            Статус: {excursion.status === 'published' ? 'опубликована' : 'черновик'}
          </p>
        </div>

        <div className="tools-divider" />
        <div className="cover-editor">
          <h4>Обложка экскурсии</h4>
          {excursion.coverImage ? (
            <img className="cover-preview" src={`${SERVER_URL}${excursion.coverImage}`} alt="Обложка экскурсии" />
          ) : (
            <div className="cover-empty">Обложка не выбрана</div>
          )}
          <input
            type="file"
            accept="image/*"
            ref={coverFileInputRef}
            onChange={handleCoverUpload}
            style={{ display: 'none' }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => coverFileInputRef.current?.click()}
            disabled={coverUploading}
            style={{ width: '100%' }}
          >
            {coverUploading ? 'Загрузка...' : 'Загрузить обложку'}
          </Button>
          <Button variant="secondary" size="sm" onClick={openCoverPicker} style={{ width: '100%' }}>
            Выбрать из медиатеки
          </Button>
          {coverPickerOpen && (
            <div className="media-picker cover-picker">
              <div className="media-picker-head">
                <strong>Изображения медиатеки</strong>
                <button type="button" onClick={() => setCoverPickerOpen(false)}>×</button>
              </div>
              {libraryLoading && <p className="media-picker-empty">Загрузка...</p>}
              {!libraryLoading && coverLibraryMedia.length === 0 && (
                <p className="media-picker-empty">В медиатеке нет изображений.</p>
              )}
              {!libraryLoading && coverLibraryMedia.length > 0 && (
                <div className="media-picker-list">
                  {coverLibraryMedia.map((media) => (
                    <button key={media.id} type="button" className="media-picker-item" onClick={() => attachCoverFromLibrary(media)}>
                      <span className="media-picker-preview">
                        <img src={`${SERVER_URL}${media.url}`} alt={media.title} />
                      </span>
                      <span>
                        <strong>{media.title}</strong>
                        <small>Сделать обложкой</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="tools-divider" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hasChanges && <span style={{ fontSize: 12, color: '#f59e0b', textAlign: 'center' }}>Есть несохраненные изменения</span>}
          {statusMsg && <span style={{ fontSize: 13, color: statusMsg.includes('Ошибка') ? '#dc2626' : '#16a34a', textAlign: 'center' }}>{statusMsg}</span>}
          <Button variant="primary" size="sm" onClick={() => saveRoute(false)} disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => saveRoute(true)} disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Публикация...' : 'Опубликовать'}
          </Button>
        </div>
      </div>

      {/* Центральная карта с точками маршрута: */}
      <div className="editor-map">
        <MapContainer center={center} zoom={14} style={{ width: '100%', height: '100%' }} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onMapClick={handleMapClick} />
          {routePositions.length > 1 && <Polyline positions={routePositions} color="#2563eb" weight={3} />}
          {sortedPoints.map((point) => (
            <React.Fragment key={point.id}>
              <Marker
                position={[point.lat, point.lng]}
                icon={pointIcon(point.order, selectedPoint?.id === point.id)}
                eventHandlers={{ click: () => setSelectedPoint(point) }}
              >
                <Popup>
                  <strong>{point.title}</strong>
                  <br />
                  {point.description}
                </Popup>
              </Marker>
              <Circle
                center={[point.lat, point.lng]}
                radius={point.radius ?? 50}
                pathOptions={{
                  color: selectedPoint?.id === point.id ? '#2563eb' : '#94a3b8',
                  fillColor: selectedPoint?.id === point.id ? '#2563eb' : '#94a3b8',
                  fillOpacity: 0.1,
                  weight: 1,
                  dashArray: '4 4',
                }}
              />
            </React.Fragment>
          ))}
        </MapContainer>
        {addMode && <div className="map-hint">Кликните на карте, чтобы добавить точку</div>}
      </div>

      {/* Правая панель свойств выбранной точки: */}
      <div className="editor-props">
        {selectedPoint ? (
          <>
            <h3>Свойства точки</h3>
            <div className="props-form">
              <Input label="Название" value={selectedPoint.title} onChange={(event) => handlePointUpdate('title', event.target.value)} />
              <Textarea label="Описание" value={selectedPoint.description} onChange={(event) => handlePointUpdate('description', event.target.value)} />
              <Input label="Время на точке (мин)" type="number" value={selectedPoint.duration} onChange={(event) => handlePointUpdate('duration', parseInt(event.target.value) || 0)} />
              <Input label="Радиус активации (м)" type="number" value={selectedPoint.radius ?? 50} onChange={(event) => handlePointUpdate('radius', parseInt(event.target.value) || 50)} />
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: -8 }}>
                На этом расстоянии точка станет активной при прохождении экскурсии.
              </p>
              <div className="props-coords">
                <Input label="Широта" value={selectedPoint.lat.toFixed(6)} readOnly />
                <Input label="Долгота" value={selectedPoint.lng.toFixed(6)} readOnly />
              </div>
              <Button variant="danger" size="sm" onClick={() => handleDeletePoint(selectedPoint.id)}>
                Удалить точку
              </Button>

              <div className="tools-divider" />
              <h4 style={{ margin: '8px 0 4px' }}>Изображения</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {(selectedPoint.media || []).filter((media) => media.type === 'image').map((media) => (
                  <div key={media.id} style={{ position: 'relative', width: 80, height: 80 }}>
                    <img src={`${SERVER_URL}${media.url}`} alt={media.title} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                    <button
                      onClick={() => handleMediaDelete(media.id)}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        fontSize: 12,
                        cursor: 'pointer',
                        lineHeight: '20px',
                        textAlign: 'center',
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {audioMedia.length > 0 && (
                <>
                  <h4 style={{ margin: '8px 0 4px' }}>Аудио</h4>
                  <div className="point-media-list">
                    {audioMedia
                      .slice()
                      .sort((a, b) => audioOrder(a, 0) - audioOrder(b, 0))
                      .map((media, index) => (
                        <div key={media.id} className="point-media-row">
                          <strong>Аудио</strong>
                          <Input
                            label="Название аудио"
                            value={mediaTitleDrafts[media.id] ?? media.title ?? `Аудиофайл ${index + 1}`}
                            onChange={(event) => handleMediaTitleDraftChange(media.id, event.target.value)}
                            onBlur={() => saveMediaTitle(media)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') event.currentTarget.blur();
                            }}
                          />
                          <label className="media-order-field">
                            Порядок
                            <input
                              type="number"
                              min={1}
                              value={audioOrder(media, index)}
                              onChange={(event) => handleMediaOrderChange(media, Number(event.target.value))}
                            />
                          </label>
                          <audio src={`${SERVER_URL}${media.url}`} controls />
                          <button type="button" onClick={() => handleMediaDelete(media.id)}>Удалить</button>
                        </div>
                      ))}
                  </div>
                </>
              )}

              <input
                type="file"
                accept="image/*,audio/*"
                ref={fileInputRef}
                onChange={handleMediaUpload}
                style={{ display: 'none' }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia || selectedPoint.id.startsWith('temp-')}
                style={{ width: '100%' }}
              >
                {uploadingMedia ? 'Загрузка...' : 'Загрузить фото или аудио'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={openMediaPicker}
                disabled={selectedPoint.id.startsWith('temp-')}
                style={{ width: '100%' }}
              >
                Выбрать из медиатеки
              </Button>
              {selectedPoint.id.startsWith('temp-') && (
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Сначала сохраните точку, затем загружайте медиа.
                </p>
              )}
            </div>

            {/* Медиатека текущей экскурсии: */}
            {mediaPickerOpen && (
              <div className="media-picker">
                <div className="media-picker-head">
                  <strong>Медиатека экскурсии</strong>
                  <button type="button" onClick={() => setMediaPickerOpen(false)}>×</button>
                </div>
                {libraryLoading && <p className="media-picker-empty">Загрузка...</p>}
                {!libraryLoading && libraryMedia.length === 0 && (
                  <p className="media-picker-empty">В этой экскурсии пока нет медиафайлов.</p>
                )}
                {!libraryLoading && libraryMedia.length > 0 && (
                  <div className="media-picker-list">
                    {libraryMedia.map((media) => {
                      const attached = (selectedPoint.media || []).some((item) => item.id === media.id);
                      const locked = Boolean(media.pointId && media.pointId !== selectedPoint.id);
                      return (
                        <button
                          key={media.id}
                          type="button"
                          className={`media-picker-item ${attached || locked ? 'attached' : ''}`}
                          onClick={() => attachMediaFromLibrary(media)}
                          disabled={attached || locked}
                        >
                          <span className="media-picker-preview">
                            {media.type === 'image' ? <img src={`${SERVER_URL}${media.url}`} alt={media.title} /> : '♪'}
                          </span>
                          <span>
                            <strong>{media.title}</strong>
                            <small>{attached ? 'Уже добавлено' : locked ? 'Привязан к другой точке' : media.type}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="props-empty">
            <p>Выберите точку на карте или в списке для редактирования.</p>
          </div>
        )}
      </div>
    </div>
  );
}
