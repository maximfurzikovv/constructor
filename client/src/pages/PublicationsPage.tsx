import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import type { Excursion } from 'shared/types';
import './PublicationsPage.css';

// Страница управления публикациями:
export default function PublicationsPage() {
  const [excursions, setExcursions] = useState<Excursion[]>([]); // Список экскурсий

  // Загружаем экскурсии при открытии страницы:
  useEffect(() => {
    api.getExcursions().then((d: any) => setExcursions(d));
  }, []);

  // Переключение статуса:
  const toggleStatus = async (exc: any) => {
    // Если уже опубликовано, переводим в черновик:
    const newStatus = exc.status === 'published' ? 'draft' : 'published';
    // Сохраняем новый статус на сервере:
    await api.updateExcursion(exc.id, { status: newStatus });
    setExcursions((prev) =>
      prev.map((e: any) =>
        e.id === exc.id ? { ...e, status: newStatus } : e
      )
    );
  };

  return (
    // Контейнер страницы публикаций:
    <div className="publications-page">
      {/* Заголовок раздела: */}
      <h1>Публикации</h1>
      {/* Подпись раздела: */}
      <p className="pub-subtitle">Управление статусами экскурсий</p>

      {/* Список материалов: */}
      <div className="pub-list">
        {excursions.map((exc: any) => (
          <Card key={exc.id} className="pub-item">
            {/* Информация об экскурсии: */}
            <div className="pub-info">
              <h3>{exc.title}</h3>
              <span className="pub-city">{exc.city}</span>
              <StatusBadge status={exc.status} />
            </div>
            {/* Кнопка переключения публикации: */}
            <Button
              variant={exc.status === 'published' ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => toggleStatus(exc)}
            >
              {/* Текст кнопки: */}
              {exc.status === 'published' ? 'Снять с публикации' : 'Опубликовать'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
