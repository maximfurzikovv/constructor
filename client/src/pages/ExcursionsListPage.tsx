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

export default function ExcursionsListPage() {
  const navigate = useNavigate();
  const [excursions, setExcursions] = useState<Excursion[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    api.getExcursions().then((d: any) => setExcursions(d));
  }, []);

  const handleCreate = async () => {
    const exc: any = await api.createExcursion({
      title: newTitle,
      description: newDesc,
      city: newCity,
    });
    setShowCreate(false);
    navigate(`/admin/excursions/${exc.id}/edit`);
  };

  return (
    <div className="tours-page">
      <div className="tours-header">
        <h1>Экскурсии</h1>
        <Button onClick={() => setShowCreate(true)}>+ Новая экскурсия</Button>
      </div>

      <div className="tours-grid">
        {excursions.map((exc: any) => (
          <Card key={exc.id} className="tour-card">
            <div className="tour-card-header">
              <h3>{exc.title}</h3>
              <StatusBadge status={exc.status} />
            </div>
            <p className="tour-card-city">{exc.city}</p>
            <p className="tour-card-desc">{exc.description}</p>
            <div className="tour-card-meta">
              <span>{exc.route?.duration || 0} мин</span>
              <span>{((exc.route?.distance || 0) / 1000).toFixed(1)} км</span>
            </div>
            <div className="tour-card-actions">
              <Link to={`/admin/excursions/${exc.id}/edit`}>
                <Button size="sm">Редактировать</Button>
              </Link>
              <Link to={`/player/${exc.id}`}>
                <Button size="sm" variant="secondary">
                  Плеер
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Новая экскурсия"
      >
        <div className="create-form">
          <Input
            label="Название"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Прогулка по Невскому"
          />
          <Input
            label="Город"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            placeholder="Санкт-Петербург"
          />
          <Textarea
            label="Описание"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Краткое описание маршрута..."
          />
          <Button onClick={handleCreate} style={{ marginTop: 8 }}>
            Создать
          </Button>
        </div>
      </Modal>
    </div>
  );
}
