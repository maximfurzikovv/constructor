import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import type { Excursion, ExcursionPublication } from 'shared/types';
import './PublicationsPage.css';

function formatDate(value?: string | null) {
  if (!value) return 'без даты';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

// Страница управления публикациями:
export default function PublicationsPage() {
  const [excursions, setExcursions] = useState<Excursion[]>([]); // Список экскурсий
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, ExcursionPublication[]>>({});

  // Загружаем экскурсии при открытии страницы:
  useEffect(() => {
    api.getExcursions().then((d: any) => setExcursions(d));
  }, []);

  // Отправка на публикацию:
  const toggleStatus = async (exc: any) => {
    const newStatus = exc.status === 'published' ? 'draft' : 'review';
    if (exc.status === 'published') {
      await api.updateExcursion(exc.id, { status: newStatus });
    } else {
      await api.publishExcursion(exc.id);
    }
    setExcursions((prev) =>
      prev.map((e: any) =>
        e.id === exc.id ? { ...e, status: newStatus, moderationComment: null } : e
      )
    );
  };

  const toggleHistory = async (excursionId: string) => {
    if (historyOpen === excursionId) {
      setHistoryOpen(null);
      return;
    }
    setHistoryOpen(excursionId);
    if (!history[excursionId]) {
      const items = await api.getExcursionPublications(excursionId) as ExcursionPublication[];
      setHistory((prev) => ({ ...prev, [excursionId]: items }));
    }
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
        {excursions.map((exc: any) => {
          const historyItems = history[exc.id] || [];
          return (
            <Card key={exc.id} className="pub-item">
              <div className="pub-main-row">
                {/* Информация об экскурсии: */}
                <div className="pub-info">
                  <h3>{exc.title}</h3>
                  <span className="pub-city">{exc.city}</span>
                  <StatusBadge status={exc.status} />
                  {exc.status === 'review' && <span className="pub-review">На модерации</span>}
                  {exc.status === 'archived' && exc.moderationComment && (
                    <span className="pub-reject">Отклонено: {exc.moderationComment}</span>
                  )}
                </div>
                <div className="pub-actions">
                  <Button variant="secondary" size="sm" onClick={() => toggleHistory(exc.id)}>
                    {historyOpen === exc.id ? 'Скрыть историю' : 'История'}
                  </Button>
                  {/* Кнопка переключения публикации: */}
                  <Button
                    variant={exc.status === 'published' ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={exc.status === 'review'}
                    onClick={() => toggleStatus(exc)}
                  >
                    {/* Текст кнопки: */}
                    {exc.status === 'published' ? 'Снять с публикации' : exc.status === 'review' ? 'На модерации' : 'Отправить на модерацию'}
                  </Button>
                </div>
              </div>
              {historyOpen === exc.id && (
                <div className="pub-history">
                  {historyItems.length === 0 ? (
                    <p>Заявок на модерацию пока нет</p>
                  ) : historyItems.map((item) => (
                    <div className="pub-history-item" key={item.id}>
                      <StatusBadge status={item.status} />
                      <span>Создана: {formatDate(item.createdAt)}</span>
                      {item.reviewedAt && <span>Решение: {formatDate(item.reviewedAt)}</span>}
                      {item.moderationComment && <strong>{item.moderationComment}</strong>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
