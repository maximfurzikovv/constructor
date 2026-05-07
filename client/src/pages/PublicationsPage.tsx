import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import type { Excursion } from 'shared/types';
import './PublicationsPage.css';

export default function PublicationsPage() {
  const [excursions, setExcursions] = useState<Excursion[]>([]);

  useEffect(() => {
    api.getExcursions().then((d: any) => setExcursions(d));
  }, []);

  const toggleStatus = async (exc: any) => {
    const newStatus = exc.status === 'published' ? 'draft' : 'published';
    await api.updateExcursion(exc.id, { status: newStatus });
    setExcursions((prev) =>
      prev.map((e: any) =>
        e.id === exc.id ? { ...e, status: newStatus } : e
      )
    );
  };

  return (
    <div className="publications-page">
      <h1>Публикации</h1>
      <p className="pub-subtitle">Управление статусами экскурсий</p>

      <div className="pub-list">
        {excursions.map((exc: any) => (
          <Card key={exc.id} className="pub-item">
            <div className="pub-info">
              <h3>{exc.title}</h3>
              <span className="pub-city">{exc.city}</span>
              <StatusBadge status={exc.status} />
            </div>
            <Button
              variant={exc.status === 'published' ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => toggleStatus(exc)}
            >
              {exc.status === 'published' ? 'Снять с публикации' : 'Опубликовать'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
