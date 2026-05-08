import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Textarea } from '../components/ui/Input';
import type { Excursion, Point } from 'shared/types';
import './RouteEditorPage.css';

// Fix default marker icons in Leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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

const SERVER_URL = '';

let tempIdCounter = 0;
function nextTempId() {
  return `temp-${++tempIdCounter}`;
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
    if (excursionId) {
      api.getExcursion(excursionId).then((d: any) => {
        setExcursion(d);
        initialLoadDone.current = true;
      });
    }
  }, [excursionId]);

  const markDirty = useCallback(() => {
    if (initialLoadDone.current) setHasChanges(true);
  }, []);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!addMode || !excursion || !excursion.route) return;
      const points = excursion.route.points;
      const newPoint: Point = {
        id: nextTempId(),
        routeId: excursion.route.id,
        title: `РўРѕС‡РєР° ${points.length + 1}`,
        description: '',
        lat,
        lng,
        order: points.length,
        duration: 5,
        radius: 50,
        media: [],
      };
      setExcursion((prev) =>
        prev && prev.route
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
    const updated = { ...selectedPoint, [field]: value };
    setSelectedPoint(updated);
    setExcursion((prev) =>
      prev && prev.route
        ? {
            ...prev,
            route: {
              ...prev.route,
              points: prev.route.points.map((p) =>
                p.id === updated.id ? updated : p
              ),
            },
          }
        : prev
    );
    markDirty();
  };

  const handleDeletePoint = (pointId: string) => {
    setExcursion((prev) => {
      if (!prev || !prev.route) return prev;
      const filtered = prev.route.points.filter((p) => p.id !== pointId);
      const reordered = filtered
        .sort((a, b) => a.order - b.order)
        .map((p, i) => ({ ...p, order: i }));
      return {
        ...prev,
        route: { ...prev.route, points: reordered },
      };
    });
    if (selectedPoint?.id === pointId) setSelectedPoint(null);
    markDirty();
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedPoint || !excursion) return;
    setUploadingMedia(true);
    try {
      const media: any = await api.uploadMedia(e.target.files[0], excursion.id, selectedPoint.id);
      // Add media to the point in local state
      const updatedPoint = {
        ...selectedPoint,
        media: [...(selectedPoint.media || []), media],
      };
      setSelectedPoint(updatedPoint);
      setExcursion((prev) =>
        prev && prev.route
          ? {
              ...prev,
              route: {
                ...prev.route,
                points: prev.route.points.map((p) =>
                  p.id === updatedPoint.id ? updatedPoint : p
                ),
              },
            }
          : prev
      );
    } catch {
      setStatusMsg('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РёР·РѕР±СЂР°Р¶РµРЅРёСЏ');
    }
    setUploadingMedia(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMediaDelete = async (mediaId: string) => {
    if (!selectedPoint) return;
    try {
      await api.deleteMedia(mediaId);
      const updatedPoint = {
        ...selectedPoint,
        media: (selectedPoint.media || []).filter((m) => m.id !== mediaId),
      };
      setSelectedPoint(updatedPoint);
      setExcursion((prev) =>
        prev && prev.route
          ? {
              ...prev,
              route: {
                ...prev.route,
                points: prev.route.points.map((p) =>
                  p.id === updatedPoint.id ? updatedPoint : p
                ),
              },
            }
          : prev
      );
    } catch {
      setStatusMsg('РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ РјРµРґРёР°');
    }
  };

  const handleSave = async () => {
    if (!excursion || !excursion.route) return;
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
        sortedPoints.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          lat: p.lat,
          lng: p.lng,
          order: p.order,
          duration: p.duration,
          radius: p.radius ?? 50,
        }))
      );

      setExcursion((prev) =>
        prev && prev.route
          ? {
              ...prev,
              route: {
                ...prev.route,
                points: synced,
                routeGeo: {
                  type: 'LineString',
                  coordinates: synced.map((p: any) => [p.lng, p.lat]),
                },
              },
            }
          : prev
      );

      if (selectedPoint) {
        const idx = sortedPoints.findIndex((p) => p.id === selectedPoint.id);
        if (idx >= 0 && synced[idx]) setSelectedPoint(synced[idx]);
        else setSelectedPoint(null);
      }

      setHasChanges(false);
      setStatusMsg('РЎРѕС…СЂР°РЅРµРЅРѕ!');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch {
      setStatusMsg('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!excursion || !excursion.route) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      // First save current data
      await api.updateExcursion(excursion.id, {
        title: excursion.title,
        description: excursion.description,
        city: excursion.city,
        route: {
          duration: excursion.route.duration,
          distance: excursion.route.distance,
          transport: excursion.route.transport,
        },
      });

      const sortedPoints = [...excursion.route.points].sort((a, b) => a.order - b.order);
      const synced: any = await api.syncPoints(
        excursion.route.id,
        sortedPoints.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          lat: p.lat,
          lng: p.lng,
          order: p.order,
          duration: p.duration,
          radius: p.radius ?? 50,
        }))
      );

      // Then publish (creates snapshot)
      await api.publishExcursion(excursion.id);

      setExcursion((prev) =>
        prev && prev.route
          ? {
              ...prev,
              status: 'published',
              route: {
                ...prev.route,
                points: synced,
                routeGeo: {
                  type: 'LineString',
                  coordinates: synced.map((p: any) => [p.lng, p.lat]),
                },
              },
            }
          : prev
      );
      if (selectedPoint) {
        const idx = sortedPoints.findIndex((p) => p.id === selectedPoint.id);
        if (idx >= 0 && synced[idx]) setSelectedPoint(synced[idx]);
        else setSelectedPoint(null);
      }

      setHasChanges(false);
      setStatusMsg('РћРїСѓР±Р»РёРєРѕРІР°РЅРѕ!');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch {
      setStatusMsg('РћС€РёР±РєР° РїСѓР±Р»РёРєР°С†РёРё');
    }
    setSaving(false);
  };

  if (!excursion || !excursion.route) {
    return <div className="editor-loading">Р—Р°РіСЂСѓР·РєР°...</div>;
  }

  const points = excursion.route.points;
  const center: [number, number] =
    points.length > 0
      ? [points[0].lat, points[0].lng]
      : [59.939, 30.316];

  const sortedPoints = [...points].sort((a, b) => a.order - b.order);
  const routePositions: [number, number][] = sortedPoints.map((p) => [p.lat, p.lng]);

  return (
    <div className="editor-layout">
      {/* Left: Tool Panel */}
      <div className="editor-tools">
        <h3>РРЅСЃС‚СЂСѓРјРµРЅС‚С‹</h3>
        <Button
          variant={addMode ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setAddMode(!addMode)}
          style={{ width: '100%' }}
        >
          {addMode ? 'вњ“ Р РµР¶РёРј РґРѕР±Р°РІР»РµРЅРёСЏ' : '+ Р”РѕР±Р°РІРёС‚СЊ С‚РѕС‡РєСѓ'}
        </Button>

        <div className="tools-divider" />

        <h4>РўРѕС‡РєРё РјР°СЂС€СЂСѓС‚Р°</h4>
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
            <p className="stop-list-empty">
              РќР°Р¶РјРёС‚Рµ В«Р”РѕР±Р°РІРёС‚СЊ С‚РѕС‡РєСѓВ» Рё РєР»РёРєРЅРёС‚Рµ РЅР° РєР°СЂС‚Сѓ
            </p>
          )}
        </div>

        <div className="tools-divider" />
        <div className="tour-info-mini">
          <p><strong>{excursion.title}</strong></p>
          <p>{points.length} С‚РѕС‡РµРє | {excursion.route.duration} РјРёРЅ | {(excursion.route.distance / 1000).toFixed(1)} РєРј</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            РЎС‚Р°С‚СѓСЃ: {excursion.status === 'published' ? 'вњ… РћРїСѓР±Р»РёРєРѕРІР°РЅ' : 'рџ“ќ Р§РµСЂРЅРѕРІРёРє'}
          </p>
        </div>

        <div className="tools-divider" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hasChanges && (
            <span style={{ fontSize: 12, color: '#f59e0b', textAlign: 'center' }}>
              Р•СЃС‚СЊ РЅРµСЃРѕС…СЂР°РЅС‘РЅРЅС‹Рµ РёР·РјРµРЅРµРЅРёСЏ
            </span>
          )}
          {statusMsg && (
            <span style={{ fontSize: 13, color: statusMsg.includes('!') ? '#16a34a' : '#dc2626', textAlign: 'center' }}>
              {statusMsg}
            </span>
          )}
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving} style={{ width: '100%' }}>
            {saving ? 'РЎРѕС…СЂР°РЅРµРЅРёРµ...' : 'РЎРѕС…СЂР°РЅРёС‚СЊ'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePublish}
            disabled={saving}
            style={{ width: '100%' }}
          >
            {saving ? 'РџСѓР±Р»РёРєР°С†РёСЏ...' : 'РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ'}
          </Button>
        </div>
      </div>

      {/* Center: Map */}
      <div className="editor-map">
        <MapContainer
          center={center}
          zoom={14}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onMapClick={handleMapClick} />

          {routePositions.length > 1 && (
            <Polyline positions={routePositions} color="#2563eb" weight={3} />
          )}

          {sortedPoints.map((point) => (
            <React.Fragment key={point.id}>
              <Marker
                position={[point.lat, point.lng]}
                icon={pointIcon(point.order, selectedPoint?.id === point.id)}
                eventHandlers={{
                  click: () => setSelectedPoint(point),
                }}
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

        {addMode && (
          <div className="map-hint">РљР»РёРєРЅРёС‚Рµ РЅР° РєР°СЂС‚Сѓ, С‡С‚РѕР±С‹ РґРѕР±Р°РІРёС‚СЊ С‚РѕС‡РєСѓ</div>
        )}
      </div>

      {/* Right: Properties Panel */}
      <div className="editor-props">
        {selectedPoint ? (
          <>
            <h3>РЎРІРѕР№СЃС‚РІР° С‚РѕС‡РєРё</h3>
            <div className="props-form">
              <Input
                label="РќР°Р·РІР°РЅРёРµ"
                value={selectedPoint.title}
                onChange={(e) => handlePointUpdate('title', e.target.value)}
              />
              <Textarea
                label="РћРїРёСЃР°РЅРёРµ"
                value={selectedPoint.description}
                onChange={(e) =>
                  handlePointUpdate('description', e.target.value)
                }
              />
              <Input
                label="Р’СЂРµРјСЏ (РјРёРЅ)"
                type="number"
                value={selectedPoint.duration}
                onChange={(e) =>
                  handlePointUpdate('duration', parseInt(e.target.value) || 0)
                }
              />
              <Input
                label="Р Р°РґРёСѓСЃ Р°РєС‚РёРІР°С†РёРё (Рј)"
                type="number"
                value={selectedPoint.radius ?? 50}
                onChange={(e) =>
                  handlePointUpdate('radius', parseInt(e.target.value) || 50)
                }
              />
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: -8 }}>
                Р Р°СЃСЃС‚РѕСЏРЅРёРµ, РЅР° РєРѕС‚РѕСЂРѕРј С‚РѕС‡РєР° СЃС‚Р°РЅРѕРІРёС‚СЃСЏ Р°РєС‚РёРІРЅРѕР№ РїСЂРё РїСЂРёР±Р»РёР¶РµРЅРёРё
              </p>
              <div className="props-coords">
                <Input
                  label="РЁРёСЂРѕС‚Р°"
                  value={selectedPoint.lat.toFixed(6)}
                  readOnly
                />
                <Input
                  label="Р”РѕР»РіРѕС‚Р°"
                  value={selectedPoint.lng.toFixed(6)}
                  readOnly
                />
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDeletePoint(selectedPoint.id)}
              >
                РЈРґР°Р»РёС‚СЊ С‚РѕС‡РєСѓ
              </Button>

              <div className="tools-divider" />
              <h4 style={{ margin: '8px 0 4px' }}>РР·РѕР±СЂР°Р¶РµРЅРёСЏ</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {(selectedPoint.media || [])
                  .filter((m) => m.type === 'image')
                  .map((m) => (
                    <div key={m.id} style={{ position: 'relative', width: 80, height: 80 }}>
                      <img
                        src={`${SERVER_URL}${m.url}`}
                        alt={m.title}
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
                      />
                      <button
                        onClick={() => handleMediaDelete(m.id)}
                        style={{
                          position: 'absolute', top: -6, right: -6,
                          background: '#dc2626', color: '#fff', border: 'none',
                          borderRadius: '50%', width: 20, height: 20, fontSize: 12,
                          cursor: 'pointer', lineHeight: '20px', textAlign: 'center', padding: 0,
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
              </div>
              <div className="point-media-list">
                {(selectedPoint.media || [])
                  .filter((m) => m.type === 'audio' || m.type === 'video')
                  .map((m) => (
                    <div key={m.id} className="point-media-row">
                      <strong>{m.type === 'audio' ? 'Аудио' : 'Видео'}</strong>
                      <span>{m.title}</span>
                      {m.type === 'audio'
                        ? <audio src={`${SERVER_URL}${m.url}`} controls />
                        : <video src={`${SERVER_URL}${m.url}`} controls />}
                      <button type="button" onClick={() => handleMediaDelete(m.id)}>Удалить</button>
                    </div>
                  ))}
              </div>
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
                  РЎРѕС…СЂР°РЅРёС‚Рµ С‚РѕС‡РєРё РїРµСЂРµРґ Р·Р°РіСЂСѓР·РєРѕР№ РёР·РѕР±СЂР°Р¶РµРЅРёР№
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="props-empty">
            <p>Р’С‹Р±РµСЂРёС‚Рµ С‚РѕС‡РєСѓ РЅР° РєР°СЂС‚Рµ РёР»Рё РІ СЃРїРёСЃРєРµ РґР»СЏ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ СЃРІРѕР№СЃС‚РІ</p>
          </div>
        )}
      </div>
    </div>
  );
}

