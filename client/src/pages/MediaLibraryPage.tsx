import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import type { Excursion, MediaItem } from 'shared/types';
import './MediaLibraryPage.css';

// Базовый адрес сервера:
const SERVER_URL = '';

// Страница медиатеки:
export default function MediaLibraryPage() {
  const [media, setMedia] = useState<MediaItem[]>([]); // Список всех медиафайлов
  const [excursions, setExcursions] = useState<Excursion[]>([]); // Список экскурсий автора
  const [selectedExcursionId, setSelectedExcursionId] = useState(''); // Выбранная экскурсия
  const [typeFilter, setTypeFilter] = useState('all'); // Фильтр по типу файла
  const [error, setError] = useState(''); // Текст ошибки медиатеки
  const [uploading, setUploading] = useState(false);// Флаг процесса загрузки файла
  // Ссылка на скрытый input type="file":
  const fileInputRef = useRef<HTMLInputElement>(null);

  // При открытии страницы загружаем медиатеку:
  useEffect(() => {
    api.getExcursions().then((items: any) => {
      setExcursions(items); // Сохраняем экскурсии
      if (items[0]?.id) setSelectedExcursionId(items[0].id); // Выбираем первую экскурсию
    });
    api.getMedia().then((d: any) => setMedia(d)); // Загружаем все доступные медиа
  }, []);

  // Файлы с учетом выбранных фильтров:
  const visibleMedia = media.filter((item) => {
    const byExcursion = selectedExcursionId ? item.excursionId === selectedExcursionId : true; // Фильтр экскурсии
    const byType = typeFilter === 'all' ? true : item.type === typeFilter; // Фильтр типа
    return byExcursion && byType;
  });

  // Обработка выбора файла:
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Если файл не выбран:
    if (!e.target.files || !e.target.files[0]) return;
    // Без экскурсии сервер не сможет правильно связать файл:
    if (!selectedExcursionId) {
      setError('Сначала выберите экскурсию для загрузки файла');
      if (fileInputRef.current) fileInputRef.current.value = ''; // Очистка input
      return;
    }
    setUploading(true); // Включаем состояние загрузки
    setError(''); // Сбрасываем старую ошибку
    try {
      // Отправляем первый выбранный файл:
      const item: any = await api.uploadMedia(e.target.files[0], selectedExcursionId);
      // Добавляем новый файл в начало списка:
      setMedia((prev) => [item, ...prev]);
    } catch {
      setError('Не удалось загрузить файл. Проверьте тип файла и размер до 8 МБ');
    }
    // Выключаем состояние загрузки:
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = ''; // Очистка input
  };

  // Удаление медиафайла:
  const handleDelete = async (id: string) => {
    try {
      // Удаляем файл через API:
      await api.deleteMedia(id);
      // Убираем файл из локального состояния:
      setMedia((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // Ошибка удаления не прерывает работу страницы:
      // ignore:
    }
  };

  return (
    // Контейнер страницы медиатеки:
    <div className="media-page">
      {/* Заголовок страницы: */}
      <h1>Медиатека</h1>
      {/* Краткое описание: */}
      <p className="media-subtitle">Фотографии, видео и аудио для ваших экскурсий</p>

      {/* Блок загрузки файла: */}
      <Card className="media-toolbar">
        {/* Выбор экскурсии для загрузки и фильтрации: */}
        <label className="media-field">
          <span>Экскурсия</span>
          <select value={selectedExcursionId} onChange={(event) => setSelectedExcursionId(event.target.value)}>
            <option value="">Все экскурсии</option>
            {excursions.map((excursion) => (
              <option key={excursion.id} value={excursion.id}>{excursion.title}</option>
            ))}
          </select>
        </label>

        {/* Фильтр по типу медиа: */}
        <label className="media-field">
          <span>Тип файла</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">Все типы</option>
            <option value="image">Изображения</option>
            <option value="audio">Аудио</option>
            <option value="video">Видео</option>
          </select>
        </label>

        <input
          type="file"
          accept="image/*,audio/*,video/*"
          ref={fileInputRef}
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
        {/* Кнопка выбора файла: */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Загрузка...' : 'Загрузить файл'}
        </Button>
      </Card>

      {/* Ошибка медиатеки: */}
      {error && <p className="media-error">{error}</p>}

      {/* Сетка медиафайлов: */}
      <div className="media-grid">
        {visibleMedia.map((item) => (
          <Card key={item.id} className="media-card">
            {/* Превью изображения: */}
            {item.type === 'image' && (
              <div
                className="media-thumb"
                style={{
                  backgroundImage: `url(${item.url.startsWith('/') ? SERVER_URL : ''}${item.url})`,
                }}
              />
            )}
            {/* Заглушка аудио: */}
            {item.type === 'audio' && (
              <div className="media-thumb media-audio">🎵</div>
            )}
            {/* Заглушка видео: */}
            {item.type === 'video' && (
              <div className="media-thumb media-video">🎬</div>
            )}
            {/* Информация о файле: */}
            <div className="media-info">
              <h4>{item.title}</h4>
              <span className="media-type">{item.type}</span>
              <small>{item.pointId ? 'Привязан к точке' : 'В медиатеке экскурсии'}</small>
            </div>
            {/* Кнопка удаления файла: */}
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

      {/* Состояние пустой медиатеки: */}
      {visibleMedia.length === 0 && (
        <Card className="media-empty">
          <p>Медиафайлы пока не загружены</p>
          <span>Выберите экскурсию и загрузите изображения, аудио или видео.</span>
        </Card>
      )}
    </div>
  );
}
