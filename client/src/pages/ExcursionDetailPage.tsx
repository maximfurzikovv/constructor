import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import type { Excursion } from 'shared/types';
import styles from './ExcursionDetailPage.module.css';
void styles;

// Публичная страница одной экскурсии:
export default function ExcursionDetailPage() {
  // Для возврата на сайт:
  const { slug, excursionId } = useParams<{ slug: string; excursionId: string }>();
  // Данные экскурсии:
  const [excursion, setExcursion] = useState<Excursion | null>(null);
  const [reviewForm, setReviewForm] = useState({ authorName: '', rating: 5, text: '' });
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [sendingReview, setSendingReview] = useState(false);

  // Опубликованная версия экскурсии:
  useEffect(() => {
    if (excursionId) api.getExcursion(excursionId, true).then((d: any) => setExcursion(d));
  }, [excursionId]);

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!excursionId || !excursion) return;
    setSendingReview(true);
    setReviewStatus(null);
    try {
      const review = await api.createReview(excursionId, reviewForm) as any;
      setExcursion({ ...excursion, reviews: [review, ...(excursion.reviews || [])] });
      setReviewForm({ authorName: '', rating: 5, text: '' });
      setReviewStatus('Отзыв добавлен');
    } catch (error: any) {
      setReviewStatus(error.message || 'Не удалось добавить отзыв');
    } finally {
      setSendingReview(false);
    }
  };

  // Пока данных нет:
  if (!excursion || !excursion.route) return <p style={{ padding: 40 }}>Загрузка...</p>;

  const points = excursion.route.points; // Точки маршрута
  const center: [number, number] = // Центр карты
    points.length > 0
      ? [points[0].lat, points[0].lng]
      : [59.939, 30.316];

  // Массив координат для линии маршрута:
  const positions: [number, number][] = points.map((p) => [p.lat, p.lng]);

  return (
    // Контейнер страницы:
    <div className={styles['tour-detail']}>
      {/* Возврат на публичный сайт: */}
      <Link to={`/s/${slug}`} className="td-back">
        ← Назад к каталогу
      </Link>
      {/* Название экскурсии: */}
      <h1>{excursion.title}</h1>
      {/* Метаданные маршрута: */}
      <div className="td-meta">
        <Badge>{excursion.city}</Badge>
        <span>{excursion.route.duration} мин</span>
        <span>{(excursion.route.distance / 1000).toFixed(1)} км</span>
        <span>{points.length} точек</span>
      </div>
      {/* Описание экскурсии: */}
      <p className="td-desc">{excursion.description}</p>

      {/* Карта маршрута: */}
      <div className="td-map-container">
        <MapContainer
          center={center}
          zoom={13}
          style={{ width: '100%', height: '400px', borderRadius: 12 }}
          attributionControl={false}
        >
          {/* Слой карты: */}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {/* Линия маршрута: */}
          {positions.length > 1 && (
            <Polyline positions={positions} color="#2563eb" weight={3} />
          )}
          {/* Маркеры всех точек: */}
          {points.map((point) => (
            <Marker key={point.id} position={[point.lat, point.lng]}>
              {/* Всплывающее описание точки: */}
              <Popup>
                <strong>{point.title}</strong>
                <br />
                {point.description}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Действия страницы: */}
      <div className="td-actions">
        <Link to={`/player/${excursion.id}`}>
          <Button size="lg">Начать маршрут</Button>
        </Link>
      </div>

      <section className="td-reviews">
        <div className="td-section-head">
          <h2>Отзывы</h2>
          <span>{excursion.reviews?.length || 0}</span>
        </div>
        <div className="td-review-list">
          {(excursion.reviews || []).length === 0 && <p className="td-empty">Пока нет отзывов. Можно оставить первый.</p>}
          {(excursion.reviews || []).map((review) => (
            <Card key={review.id} className="td-review-card">
              <div className="td-review-head">
                <strong>{review.authorName}</strong>
                <span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
              </div>
              <p>{review.text}</p>
            </Card>
          ))}
        </div>
        <form className="td-review-form" onSubmit={submitReview}>
          <input
            value={reviewForm.authorName}
            onChange={(event) => setReviewForm({ ...reviewForm, authorName: event.target.value })}
            placeholder="Ваше имя"
            maxLength={80}
            required
          />
          <div className="td-rating-picker" role="radiogroup" aria-label="Оценка экскурсии">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                className={rating <= reviewForm.rating ? 'active' : ''}
                onClick={() => setReviewForm({ ...reviewForm, rating })}
                aria-label={`${rating} из 5`}
                aria-checked={reviewForm.rating === rating}
                role="radio"
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={reviewForm.text}
            onChange={(event) => setReviewForm({ ...reviewForm, text: event.target.value })}
            placeholder="Что понравилось в экскурсии"
            minLength={10}
            maxLength={1200}
            required
          />
          <Button type="submit" disabled={sendingReview}>{sendingReview ? 'Отправляем...' : 'Добавить отзыв'}</Button>
          {reviewStatus && <span className="td-review-status">{reviewStatus}</span>}
        </form>
      </section>

      {/* Список точек маршрута: */}
      <h2>Точки маршрута</h2>
      <div className="td-stops">
        {points
            // Точки показываются по порядку прохождения:
          .sort((a, b) => a.order - b.order)
          .map((point) => (
            // Карточка точки маршрута:
            <Card key={point.id} className="td-stop-card">
              <div className="td-stop-order">{point.order + 1}</div>
              <div>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
                <span className="td-stop-dur">{point.duration} мин</span>
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}


