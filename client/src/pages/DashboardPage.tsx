import React, { useEffect, useState } from 'react';
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

  return (
    <div className="dashboard">
      <h1>Дашборд</h1>

      <div className="stats-grid">
        {stats && (
          <>
            <Card>
              <div className="stat-value">{stats.totalExcursions}</div>
              <div className="stat-label">Всего экскурсий</div>
            </Card>
            <Card>
              <div className="stat-value">{stats.publishedExcursions}</div>
              <div className="stat-label">Опубликовано</div>
            </Card>
            <Card>
              <div className="stat-value">{stats.totalPoints}</div>
              <div className="stat-label">Точек маршрутов</div>
            </Card>
            <Card>
              <div className="stat-value">{stats.totalViews}</div>
              <div className="stat-label">Просмотров</div>
            </Card>
          </>
        )}
      </div>

      <h2>Последние экскурсии</h2>
      <div className="tours-list">
        {excursions.slice(0, 5).map((exc: any) => (
          <Card key={exc.id} className="tour-row">
            <div className="tour-row-info">
              <Link to={`/admin/excursions/${exc.id}/edit`} className="tour-row-title">
                {exc.title}
              </Link>
              <span className="tour-row-city">{exc.city}</span>
            </div>
            <div className="tour-row-meta">
              <StatusBadge status={exc.status} />
              <span className="tour-row-date">
                {new Date(exc.updatedAt).toLocaleDateString('ru')}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
