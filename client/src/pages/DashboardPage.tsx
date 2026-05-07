import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import type { DashboardStats, Excursion } from 'shared/types';
import './DashboardPage.css';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [excursions, setExcursions] = useState<Excursion[]>([]);

  useEffect(() => {
    api.getStats().then((d: any) => setStats(d));
    api.getExcursions().then((d: any) => setExcursions(d));
  }, []);

  const analytics = useMemo(() => {
    const total = excursions.length;
    const published = excursions.filter((item: any) => item.status === 'published').length;
    const drafts = total - published;
    const totalDistance = excursions.reduce((sum: number, item: any) => sum + (item.route?.distance || 0), 0);
    const totalDuration = excursions.reduce((sum: number, item: any) => sum + (item.route?.duration || 0), 0);
    const maxPoints = Math.max(1, ...excursions.map((item: any) => item.route?.pointsCount || 0));
    return { total, published, drafts, totalDistance, totalDuration, maxPoints };
  }, [excursions]);

  const publishPercent = analytics.total ? Math.round((analytics.published / analytics.total) * 100) : 0;

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <div>
          <span className="dash-eyebrow">Рабочая область</span>
          <h1>Дашборд</h1>
          <p>Сводка по экскурсиям, публикациям, точкам маршрута и готовности проекта.</p>
        </div>
        <Link className="dash-primary-link" to="/admin/excursions">Открыть экскурсии</Link>
      </div>

      <div className="stats-grid">
        <Card><div className="stat-value">{stats?.totalExcursions ?? analytics.total}</div><div className="stat-label">Всего экскурсий</div></Card>
        <Card><div className="stat-value">{stats?.publishedExcursions ?? analytics.published}</div><div className="stat-label">Опубликовано</div></Card>
        <Card><div className="stat-value">{stats?.totalPoints ?? 0}</div><div className="stat-label">Точек маршрута</div></Card>
        <Card><div className="stat-value">{(analytics.totalDistance / 1000).toFixed(1)} км</div><div className="stat-label">Общая длина</div></Card>
      </div>

      <div className="dashboard-grid">
        <Card className="analytics-card">
          <div className="card-title-row"><h2>Готовность публикаций</h2><span>{publishPercent}%</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${publishPercent}%` }} /></div>
          <div className="status-breakdown">
            <span><b>{analytics.published}</b> опубликовано</span>
            <span><b>{analytics.drafts}</b> черновиков</span>
            <span><b>{analytics.totalDuration}</b> мин маршрутов</span>
          </div>
        </Card>

        <Card className="analytics-card">
          <div className="card-title-row"><h2>Точки по экскурсиям</h2></div>
          <div className="mini-chart">
            {excursions.slice(0, 7).map((item: any) => {
              const points = item.route?.pointsCount || 0;
              return (
                <div className="chart-row" key={item.id}>
                  <span>{item.title}</span>
                  <div className="chart-bar"><i style={{ width: `${Math.max(6, (points / analytics.maxPoints) * 100)}%` }} /></div>
                  <b>{points}</b>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="section-heading">
        <h2>Последние экскурсии</h2>
        <Link to="/admin/excursions">Все экскурсии</Link>
      </div>
      <div className="tours-list">
        {excursions.slice(0, 5).map((exc: any) => (
          <Card key={exc.id} className="tour-row">
            <div className="tour-row-info">
              <Link to={`/admin/excursions/${exc.id}/edit`} className="tour-row-title">{exc.title}</Link>
              <span className="tour-row-city">{exc.city || 'Город не указан'}</span>
            </div>
            <div className="tour-row-meta">
              <span>{exc.route?.pointsCount || 0} точек</span>
              <StatusBadge status={exc.status} />
              <span className="tour-row-date">{new Date(exc.updatedAt).toLocaleDateString('ru')}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
