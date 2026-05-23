import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { Textarea } from '../components/ui/Input';
import type { Excursion } from 'shared/types';
import './ExcursionsListPage.css';

// Страница списка экскурсий:
export default function ExcursionsListPage() {
  // navigate:
  const navigate = useNavigate();
  // Список экскурсий:
  const [excursions, setExcursions] = useState<Excursion[]>([]);
  // Флаг открытия модального окна создания:
  const [showCreate, setShowCreate] = useState(false);
  // Название новой экскурсии:
  const [newTitle, setNewTitle] = useState('');
  // Город новой экскурсии:
  const [newCity, setNewCity] = useState('');
  // Описание новой экскурсии:
  const [newDesc, setNewDesc] = useState('');

  // При открытии страницы список экскурсий:
  useEffect(() => {
    api.getExcursions().then((d: any) => setExcursions(d));
  }, []);

  // Создание новой экскурсии:
  const handleCreate = async () => {
    // Отправляем данные новой экскурсии:
    const exc: any = await api.createExcursion({
      title: newTitle,
      description: newDesc,
      city: newCity,
    });
    setShowCreate(false); // Закрываем
    navigate(`/admin/excursions/${exc.id}/edit`); // Сразу открываем редактор
  };

  return (
    // Контейнер страницы экскурсий:
    <div className="tours-page">
      {/* Шапка страницы: */}
      <div className="tours-header">
        <h1>Экскурсии</h1>
        {/* Открывает форму создания экскурсии: */}
        <Button onClick={() => setShowCreate(true)}>+ Новая экскурсия</Button>
      </div>

      {/* Сетка карточек экскурсий: */}
      <div className="tours-grid">
        {excursions.map((exc: any) => (
          <Card key={exc.id} className="tour-card">
            {/* Обложка экскурсии: */}
            {exc.coverImage ? (
              <div className="tour-card-cover" style={{ backgroundImage: `url(${exc.coverImage})` }} />
            ) : (
              <div className="tour-card-cover empty-cover">Обложка не добавлена</div>
            )}
            {/* Заголовок и статус: */}
            <div className="tour-card-header">
              <h3>{exc.title}</h3>
              <StatusBadge status={exc.status} />
            </div>
            {/* Город экскурсии: */}
            <p className="tour-card-city">{exc.city}</p>
            {/* Описание экскурсии: */}
            <p className="tour-card-desc">{exc.description}</p>
            {/* Краткие показатели маршрута: */}
            <div className="tour-card-meta">
              <span>{exc.route?.duration || 0} мин</span>
              <span>{((exc.route?.distance || 0) / 1000).toFixed(1)} км</span>
            </div>
            {/* Действия с экскурсией: */}
            <div className="tour-card-actions">
              {/* Переход в редактор маршрута: */}
              <Link to={`/admin/excursions/${exc.id}/edit`}>
                <Button size="sm">Редактировать</Button>
              </Link>
              {/* Переход в плеер маршрута: */}
              <Link to={`/player/${exc.id}`}>
                <Button size="sm" variant="secondary">
                  Плеер
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {/* Модальное окно создания экскурсии: */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Новая экскурсия"
      >
        {/* Форма создания экскурсии: */}
        <div className="create-form">
          {/* Поле названия: */}
          <Input
            label="Название"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Прогулка по Невскому"
          />
          {/* Поле города: */}
          <Input
            label="Город"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            placeholder="Санкт-Петербург"
          />
          {/* Поле описания: */}
          <Textarea
            label="Описание"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Краткое описание маршрута..."
          />
          {/* Кнопка создания: */}
          <Button onClick={handleCreate} style={{ marginTop: 8 }}>
            Создать
          </Button>
        </div>
      </Modal>
    </div>
  );
}
