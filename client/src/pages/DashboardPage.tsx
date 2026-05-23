import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import type { DashboardStats, Excursion } from 'shared/types';
import './DashboardPage.css';

// Форматирует длину маршрутов:
function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} км`;
}

// Главная страница кабинета автора:
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null); // Статистика с сервера
  const [excursions, setExcursions] = useState<Excursion[]>([]); // Экскурсии автора

  // Загружает реальные данные автора:
  useEffect(() => {
    api.getStats().then((data: any) => setStats(data));
    api.getExcursions().then((data: any) => setExcursions(data));
  }, []);

  // Рассчитывает показатели личного кабинета:
  const analytics = useMemo(() => {
    const total = excursions.length; // Всего экскурсий
    const published = excursions.filter((item: any) => item.status === 'published').length; // Опубликованные экскурсии
    const drafts = excursions.filter((item: any) => item.status !== 'published'); // Черновики
    const withoutPoints = excursions.filter((item: any) => (item.route?.pointsCount || 0) === 0); // Без точек
    const withoutCover = excursions.filter((item: any) => !item.coverImage); // Без обложки
    const totalDistance = excursions.reduce((sum: number, item: any) => sum + (item.route?.distance || 0), 0); // Общая длина
    const totalDuration = excursions.reduce((sum: number, item: any) => sum + (item.route?.duration || 0), 0); // Общее время
    const totalPoints = stats?.totalPoints ?? excursions.reduce((sum: number, item: any) => sum + (item.route?.pointsCount || 0), 0); // Точки
    const readyPercent = total ? Math.round((published / total) * 100) : 0; // Готовность

    return { total, published, drafts, withoutPoints, withoutCover, totalDistance, totalDuration, totalPoints, readyPercent };
  }, [excursions, stats]);

  // Формирует список действий для автора:
  const actionItems = [
    {
      title: 'Опубликовать готовые экскурсии',
      text: analytics.drafts.length ? `${analytics.drafts.length} экскурсии ждут проверки перед публикацией` : 'Все готовые экскурсии уже опубликованы',
      link: '/admin/excursions',
      tone: analytics.drafts.length ? 'warn' : 'ok',
    },
    {
      title: 'Заполнить маршруты',
      text: analytics.withoutPoints.length ? `${analytics.withoutPoints.length} маршрута пока без точек интереса` : 'У всех маршрутов есть точки интереса',
      link: '/admin/excursions',
      tone: analytics.withoutPoints.length ? 'warn' : 'ok',
    },
    {
      title: 'Добавить обложки',
      text: analytics.withoutCover.length ? `${analytics.withoutCover.length} экскурсии без обложки` : 'У экскурсий заполнены обложки',
      link: '/admin/excursions',
      tone: analytics.withoutCover.length ? 'warn' : 'ok',
    },
    {
      title: 'Пополнить медиатеку',
      text: stats?.totalMedia ? `${stats.totalMedia} файлов доступно в материалах` : 'Медиафайлы пока не добавлены',
      link: '/admin/media',
      tone: stats?.totalMedia ? 'ok' : 'warn',
    },
  ];

  // Берет последние измененные экскурсии:
  const recentExcursions = excursions.slice(0, 4);

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <div>
          <span className="dash-eyebrow">Личный кабинет автора</span>
          <h1>Рабочая область</h1>
          <p>Здесь можно быстро перейти к созданию экскурсий, наполнению медиатеки, настройке сайта и публикации готовых материалов.</p>
        </div>
        <div className="hero-summary">
          <strong>{analytics.readyPercent}%</strong>
          <span>экскурсий опубликовано</span>
        </div>
      </div>

      <div className="dashboard-actions">
        <Link to="/admin/excursions" className="dash-action primary-action">Открыть экскурсии</Link>
        <Link to="/admin/showcase" className="dash-action">Настроить сайт</Link>
        <Link to="/admin/media" className="dash-action">Медиатека</Link>
        <Link to="/admin/publications" className="dash-action">Публикации</Link>
      </div>

      <div className="stats-grid compact-stats">
        <Card className="stat-card"><span className="stat-kicker">Экскурсии</span><div className="stat-value">{stats?.totalExcursions ?? analytics.total}</div><div className="stat-label">в работе</div></Card>
        <Card className="stat-card"><span className="stat-kicker">Опубликовано</span><div className="stat-value">{stats?.publishedExcursions ?? analytics.published}</div><div className="stat-label">видно посетителям</div></Card>
        <Card className="stat-card"><span className="stat-kicker">Медиа</span><div className="stat-value">{stats?.totalMedia ?? 0}</div><div className="stat-label">файлов в материалах</div></Card>
        <Card className="stat-card"><span className="stat-kicker">Маршруты</span><div className="stat-value">{formatDistance(analytics.totalDistance)}</div><div className="stat-label">{analytics.totalPoints} точек, {analytics.totalDuration} мин</div></Card>
      </div>

      <div className="dashboard-grid">
        <Card className="analytics-card">
          <div className="card-title-row">
            <div>
              <h2>Что подготовить</h2>
              <p>Список показывает, какие материалы лучше заполнить перед показом экскурсии посетителям.</p>
            </div>
          </div>
          <div className="todo-list">
            {actionItems.map((item) => (
              <Link key={item.title} to={item.link} className={`todo-item ${item.tone}`}>
                <span />
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.text}</small>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="analytics-card">
          <div className="card-title-row">
            <div>
              <h2>Последние экскурсии</h2>
              <p>Быстрый переход к маршрутам, которые недавно редактировались.</p>
            </div>
            <Link to="/admin/excursions">Все</Link>
          </div>
          <div className="tours-list compact-list">
            {recentExcursions.length > 0 ? recentExcursions.map((exc: any) => (
              <div key={exc.id} className="tour-row compact-row">
                <div className="tour-row-info">
                  <Link to={`/admin/excursions/${exc.id}/edit`} className="tour-row-title">{exc.title}</Link>
                  <span className="tour-row-city">{exc.city || 'Город не указан'}</span>
                </div>
                <div className="tour-row-meta">
                  <span>{exc.route?.pointsCount || 0} точек</span>
                  <StatusBadge status={exc.status} />
                </div>
              </div>
            )) : (
              <div className="dashboard-empty">
                <p>Экскурсии пока не созданы.</p>
                <Link className="dash-secondary-link" to="/admin/excursions">Создать первую экскурсию</Link>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
