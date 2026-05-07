import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import type { MediaItem } from 'shared/types';
import './MediaLibraryPage.css';

const SERVER_URL = '';

export default function MediaLibraryPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getMedia().then((d: any) => setMedia(d));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setUploading(true);
    try {
      const item: any = await api.uploadMedia(e.target.files[0]);
      setMedia((prev) => [item, ...prev]);
    } catch {
      // ignore
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMedia(id);
      setMedia((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="media-page">
      <h1>Медиатека</h1>
      <p className="media-subtitle">Фотографии и аудио для ваших экскурсий</p>

      <div style={{ marginBottom: 20 }}>
        <input
          type="file"
          accept="image/*,audio/*,video/*"
          ref={fileInputRef}
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Загрузка...' : 'Загрузить файл'}
        </Button>
      </div>

      <div className="media-grid">
        {media.map((item) => (
          <Card key={item.id} className="media-card">
            {item.type === 'image' && (
              <div
                className="media-thumb"
                style={{
                  backgroundImage: `url(${item.url.startsWith('/') ? SERVER_URL : ''}${item.url})`,
                }}
              />
            )}
            {item.type === 'audio' && (
              <div className="media-thumb media-audio">🎵</div>
            )}
            {item.type === 'video' && (
              <div className="media-thumb media-video">🎬</div>
            )}
            <div className="media-info">
              <h4>{item.title}</h4>
              <span className="media-type">{item.type}</span>
            </div>
            <button
              onClick={() => handleDelete(item.id)}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'rgba(220,38,38,0.85)', color: '#fff',
                border: 'none', borderRadius: '50%',
                width: 24, height: 24, fontSize: 14,
                cursor: 'pointer', lineHeight: '24px',
                textAlign: 'center', padding: 0,
              }}
            >
              &times;
            </button>
          </Card>
        ))}
      </div>

      {media.length === 0 && (
        <Card className="media-empty">
          <p>Медиафайлы пока не загружены</p>
        </Card>
      )}
    </div>
  );
}
