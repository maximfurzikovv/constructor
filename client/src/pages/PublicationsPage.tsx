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

type SitePublicationState = {
  siteTitle?: string;
  siteSlug?: string;
  sitePublished?: boolean;
  siteModerationComment?: string | null;
  siteModerationStatus?: 'draft' | 'review' | 'published' | 'archived';
};

type SitePublication = {
  id: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  moderationComment?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

function getSiteStatusLabel(site?: SitePublicationState | null) {
  if (!site?.siteSlug) return 'Веб-приложение не создано';
  if (site.sitePublished) return 'Одобрено';
  if (site.siteModerationComment) return 'Отклонено';
  if (site.siteModerationStatus === 'review') return 'На модерации';
  return 'Черновик';
}

function getSiteStatusClass(site?: SitePublicationState | null) {
  if (!site?.siteSlug) return 'draft';
  if (site.sitePublished) return 'published';
  if (site.siteModerationComment) return 'archived';
  if (site.siteModerationStatus === 'review') return 'review';
  return 'draft';
}

// Страница управления публикациями:
export default function PublicationsPage() {
  const [excursions, setExcursions] = useState<Excursion[]>([]); // Список экскурсий
  const [site, setSite] = useState<SitePublicationState | null>(null);
  const [siteHistoryOpen, setSiteHistoryOpen] = useState(false);
  const [siteHistory, setSiteHistory] = useState<SitePublication[]>([]);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, ExcursionPublication[]>>({});

  // Загружаем экскурсии при открытии страницы:
  useEffect(() => {
    api.getExcursions().then((d: any) => setExcursions(d));
    api.getConstructorData().then((d: any) => setSite(d)).catch(() => setSite(null));
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

  const toggleSiteHistory = async () => {
    if (siteHistoryOpen) {
      setSiteHistoryOpen(false);
      return;
    }
    setSiteHistoryOpen(true);
    if (!siteHistory.length) {
      const items = await api.getSitePublications() as SitePublication[];
      setSiteHistory(items);
    }
  };

  return (
    // Контейнер страницы публикаций:
    <div className="publications-page">
      {/* Заголовок раздела: */}
      <h1>Публикации</h1>
      {/* Подпись раздела: */}
      <p className="pub-subtitle">Статусы экскурсий и веб-приложения после проверки администратором</p>

      <Card className="pub-site-card">
        <div className="pub-main-row">
          <div className="pub-info">
            <h3>Веб-приложение</h3>
            <span className="pub-city">{site?.siteTitle || 'Личный сайт экскурсовода'}</span>
            {site?.siteSlug && <span className="pub-city">/s/{site.siteSlug}</span>}
            <span className={`pub-site-status pub-site-status-${getSiteStatusClass(site)}`}>
              {getSiteStatusLabel(site)}
            </span>
            {site?.siteModerationComment && (
              <span className="pub-reject">Комментарий: {site.siteModerationComment}</span>
            )}
          </div>
          <div className="pub-actions">
            <Button variant="secondary" size="sm" onClick={toggleSiteHistory}>
              {siteHistoryOpen ? 'Скрыть историю' : 'История'}
            </Button>
            {site?.sitePublished && site.siteSlug && (
              <a className="pub-link" href={`/s/${site.siteSlug}`} target="_blank" rel="noreferrer">
                Открыть сайт
              </a>
            )}
            <a className="pub-link" href="/admin/showcase">
              Открыть конструктор
            </a>
          </div>
        </div>
        {siteHistoryOpen && (
          <div className="pub-history">
            {siteHistory.length === 0 ? (
              <p>Заявок на модерацию сайта пока нет</p>
            ) : siteHistory.map((item) => (
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
