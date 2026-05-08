import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import Input, { Textarea } from '../components/ui/Input';
import type { Excursion, Point } from 'shared/types';
import './RouteEditorPage.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SERVER_URL = '';
let tempIdCounter = 0;

function nextTempId() {
  return `temp-${++tempIdCounter}`;
}

function pointIcon(order: number, selected: boolean) {
  return L.divIcon({
    className: 'stop-marker',
    html: `<div class="stop-marker-inner ${selected ? 'selected' : ''}">${order + 1}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function audioOrder(media: any, index: number) {
  const parsed = Number(media.description);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1;
}

export default function RouteEditorPage() {
  const { excursionId } = useParams<{ excursionId: string }>();
  const [excursion, setExcursion] = useState<Excursion | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const initialLoadDone = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!excursionId) return;
    api.getExcursion(excursionId).then((data: any) => {
      setExcursion(data);
      initialLoadDone.current = true;
    });
  }, [excursionId]);

  const markDirty = useCallback(() => {
    if (initialLoadDone.current) setHasChanges(true);
  }, []);

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

  const handlePointUpdate = (field: string, value: string | number) => {
    if (!selectedPoint) return;
    syncSelectedPoint({ ...selectedPoint, [field]: value });
    markDirty();
  };

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

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0] || !selectedPoint || !excursion) return;
    setUploadingMedia(true);
    setStatusMsg(null);
    try {
      const media: any = await api.uploadMedia(event.target.files[0], excursion.id, selectedPoint.id);
      const audioCount = (selectedPoint.media || []).filter((item) => item.type === 'audio').length;
      const mediaWithOrder = media.type === 'audio'
        ? await api.updateMedia(media.id, { description: String(audioCount + 1) })
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

  const saveRoute = async (publish: boolean) => {
    if (!excursion?.route) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      await api.updateExcursion(excursion.id, {
        title: excursion.title,
        description: excursion.description,
        city: excursion.city,
        status: excursion.status,
        route: {
          duration: excursion.route.duration,
          distance: excursion.route.distance,
          transport: excursion.route.transport,
        },
      });

      const sortedPoints = [...excursion.route.points].sort((a, b) => a.order - b.order);
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

  const points = excursion.route.points;
  const sortedPoints = [...points].sort((a, b) => a.order - b.order);
  const routePositions: [number, number][] = sortedPoints.map((point) => [point.lat, point.lng]);
  const center: [number, number] = points.length > 0 ? [points[0].lat, points[0].lng] : [59.939, 30.316];
  const audioMedia = (selectedPoint?.media || []).filter((media) => media.type === 'audio');
  const videoMedia = (selectedPoint?.media || []).filter((media) => media.type === 'video');

  return (
    <div className="editor-layout">
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
          <p>{points.length} точек | {excursion.route.duration} мин | {(excursion.route.distance / 1000).toFixed(1)} км</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            Статус: {excursion.status === 'published' ? 'опубликована' : 'черновик'}
          </p>
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

              {(audioMedia.length > 0 || videoMedia.length > 0) && (
                <>
                  <h4 style={{ margin: '8px 0 4px' }}>Аудио и видео</h4>
                  <div className="point-media-list">
                    {audioMedia
                      .slice()
                      .sort((a, b) => audioOrder(a, 0) - audioOrder(b, 0))
                      .map((media, index) => (
                        <div key={media.id} className="point-media-row">
                          <strong>Аудио</strong>
                          <span>{media.title}</span>
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
                    {videoMedia.map((media) => (
                      <div key={media.id} className="point-media-row">
                        <strong>Видео</strong>
                        <span>{media.title}</span>
                        <video src={`${SERVER_URL}${media.url}`} controls />
                        <button type="button" onClick={() => handleMediaDelete(media.id)}>Удалить</button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <input
                type="file"
                accept="image/*,audio/*,video/*"
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
                {uploadingMedia ? 'Загрузка...' : 'Загрузить фото, аудио или видео'}
              </Button>
              {selectedPoint.id.startsWith('temp-') && (
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Сначала сохраните точку, затем загружайте медиа.
                </p>
              )}
            </div>
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
