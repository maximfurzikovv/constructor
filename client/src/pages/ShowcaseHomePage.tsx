import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { api } from '../api/client';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { sanitizeEmbedHtml } from '../utils/contentSecurity';
import styles from './ShowcaseHomePage.module.css';
void styles;

// Обновляет favicon сайта:
function setFavicon(href: string) {
  let icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]'); // Текущая иконка
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.href = href; // Новый адрес
}

export default function ShowcaseHomePage() {
  // Slug определяет опубликованный сайт в адресной строке:
  const { slug, pageSlug } = useParams<{ slug: string; pageSlug?: string }>();
  // Храним данные опубликованной витрины:
  const [site, setSite] = useState<any>(null);

  // Загружает опубликованный сайт по slug:
  useEffect(() => {
    if (slug) api.getShowcase(slug).then((d: any) => setSite(d));
  }, [slug]);

  if (!site) return <p style={{ padding: 40 }}>Загрузка...</p>;

  // Данные конструктора берутся из опубликованной JSON-структуры:
  const cd = site.constructorData;

  // Если сайт собран новым конструктором, рендерим его секциями:
  if (cd && cd.pages && cd.pages.length > 0) {
    return <ConstructorSite site={site} constructorData={cd} slug={slug!} pageSlug={pageSlug || ''} />;
  }

  return (
    <div className="showcase-home">
      <header className="showcase-header">
        <div className="showcase-header-inner">
          <Link to={`/s/${slug}`} className="showcase-logo">{site.title}</Link>
        </div>
      </header>
      <main style={{ padding: '0 32px' }}>
    <div className={styles['showcase-hero']}>
          <h1>{site.title}</h1>
          <p>{site.description}</p>
        </div>

        <h2>Доступные экскурсии</h2>
        <div className="showcase-tours-grid">
          {(site.excursionDetails || []).map((exc: any) => (
            <Card key={exc.id} className="showcase-tour-card">
              {exc.coverImage && <div className="showcase-tour-cover" style={{ backgroundImage: `url(${exc.coverImage})` }} />}
              <h3>{exc.title}</h3>
              <p className="stc-city">{exc.city}</p>
              <p className="stc-desc">{exc.description}</p>
              <div className="stc-meta">
                <Badge>{exc.transport === 'walk' ? 'Пешком' : exc.transport}</Badge>
                <span>{exc.duration} мин</span>
                <span>{(exc.distance / 1000).toFixed(1)} км</span>
              </div>
              <Link to={`/s/${slug}/excursion/${exc.id}`} className="stc-link">
                Подробнее →
              </Link>
            </Card>
          ))}
        </div>
      </main>
      <footer className="sc-footer">
        {site.title} &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function ConstructorSite({ site, constructorData, slug, pageSlug }: { site: any; constructorData: any; slug: string; pageSlug: string }) {
  const navigate = useNavigate();
  // Активная страница опубликованного сайта:
  const [activePageId, setActivePageId] = useState(constructorData.pages[0]?.id || '');
  // Находим страницу по id или берем первую:
  const activePage = constructorData.pages.find((p: any) => p.id === activePageId) || constructorData.pages[0];
  // Тема задает общие цвета, фон и шапку:
  const theme = constructorData.theme || {};
  // Экскурсии нужны для элемента списка туров:
  const excursions = site.excursionDetails || [];
  // Синхронизирует выбранную страницу с URL:
  useEffect(() => {
    const cleanSlug = (pageSlug || '').replace(/^\/+|\/+$/g, '');
    const nextPage = constructorData.pages.find((p: any) => (p.slug || '').replace(/^\/+|\/+$/g, '') === cleanSlug);
    setActivePageId((nextPage || constructorData.pages[0])?.id || '');
  }, [constructorData.pages, pageSlug]);
  // Открывает страницу и меняет адрес:
  const openPage = (page: any) => {
    const cleanSlug = (page.slug || '').replace(/^\/+|\/+$/g, '');
    navigate(cleanSlug ? `/s/${slug}/${cleanSlug}` : `/s/${slug}`);
  };
  // Обновляет заголовок вкладки:
  useEffect(() => {
    document.title = activePage.title || site.title; // Название вкладки
    if (theme.favicon) setFavicon(theme.favicon); // Иконка вкладки
  }, [activePage.title, site.title, theme.favicon]);

  // Подбирает CSS-шрифт по настройке темы:
  const fontFamily =
    theme.fontFamily === 'serif'
      ? 'Georgia, serif'
      : theme.fontFamily === 'mono'
      ? 'monospace'
      : 'inherit';
  // Очищаем CSS перед вставкой:
  return (
    <div
      className="showcase-constructor"
      style={{
        fontFamily,
        '--sc-primary': theme.primaryColor || '#2563eb',
        '--sc-radius': `${theme.borderRadius || '8'}px`,
        '--sc-site-bg': theme.siteBg || '#ffffff',
        '--sc-site-bg-image': theme.siteBgImage ? `url(${theme.siteBgImage})` : 'none',
        '--sc-header-bg': theme.headerBg || '#ffffff',
        '--sc-header-color': theme.headerTextColor || '#0f172a',
        '--sc-header-gap': `${theme.headerNavGap || 16}px`,
      } as React.CSSProperties}
    >
      {/* Шапка опубликованного сайта: */}
      <div className={`sc-header ${theme.headerStyle === 'dark' ? 'dark' : ''} nav-${theme.headerNavAlign || 'right'}`}>
        <span className="sc-header-logo">
          {theme.logoType === 'image' && theme.logoImage ? <img src={theme.logoImage} alt="" className="sc-logo-img" /> : (theme.logoText || site.title)}
        </span>
        {theme.headerNavVisible !== false && (
          <div className={`sc-header-nav nav-style-${theme.headerNavStyle || 'links'}`}>
            {constructorData.pages.map((p: any) => (
              <button
                key={p.id}
                className={`sc-nav-link ${activePageId === p.id ? 'active' : ''}`}
                onClick={() => openPage(p)}
              >
                {p.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Публичная страница рендерится только из новой структуры секций: */}
      <SectionRenderer page={activePage} excursions={excursions} slug={slug} primary={theme.primaryColor || '#2563eb'} />

      <div className="sc-footer">
        {site.title} &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}

function SectionRenderer({ page, excursions, slug, primary }: { page: any; excursions: any[]; slug: string; primary: string }) {
  return (
    <>
      {/* Каждая секция содержит одну или несколько колонок: */}
      {(page.sections || []).map((section: any) => (
        <section key={section.id} className="sc-builder-section" style={styleToCss(section.style, primary)}>
          <div className="sc-builder-columns">
            {(section.columns || []).map((column: any) => (
              <div key={column.id} className="sc-builder-column" style={{ flexBasis: `${column.width || 100}%`, ...styleToCss(column.style, primary) }}>
                {(column.elements || []).map((element: any) => (
                  <PublicElement key={element.id} element={element} excursions={excursions} slug={slug} primary={primary} />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// Приводит ссылки кнопок к адресу опубликованного сайта:
function resolveSiteHref(href: string, slug: string) {
  const value = String(href || '#').trim();
  if (!value || value === '#') return '#';
  if (value.startsWith('#') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('mailto:') || value.startsWith('tel:')) return value;
  if (value.startsWith('/s/')) return value;
  const page = value.replace(/^\/+|\/+$/g, '');
  return page ? `/s/${slug}/${page}` : `/s/${slug}`;
}

function getAvailableReviews(excursions: any[], data: Record<string, any>) {
  const selectedTourId = data.excursionId || 'all';
  const selectedReviewIds: string[] = data.selectedReviewIds || [];
  const reviews = excursions
    .filter((exc) => selectedTourId === 'all' || exc.id === selectedTourId)
    .flatMap((exc) => (exc.reviews || []).map((review: any) => ({ ...review, tourTitle: exc.title })))
    .filter((review) => review.published !== false);
  return selectedReviewIds.length > 0 ? reviews.filter((review) => selectedReviewIds.includes(review.id)) : reviews;
}

function PublicElement({ element, excursions, slug, primary }: { element: any; excursions: any[]; slug: string; primary: string }) {
  // Общие стили элемента переводятся в CSS:
  const css = styleToCss(element.style, primary);

  // Заголовок страницы или секции:
  if (element.type === 'heading') {
    const Tag = element.data.level || 'h2';
    return <Tag className="sc-el-heading" style={css}>{element.data.text}</Tag>;
  }
  // Обычный текстовый блок:
  if (element.type === 'text') {
    return <p className="sc-el-text" style={css}>{element.data.text}</p>;
  }
  // Ссылка-кнопка для перехода:
  if (element.type === 'button') {
    return (
      <div style={{ textAlign: element.style?.align || 'left' }}>
        <a className={`sc-el-button ${element.data.variant === 'outline' ? 'outline' : ''}`} href={resolveSiteHref(element.data.href || '#', slug)} style={css}>
          {element.data.text}
        </a>
      </div>
    );
  }
  // Кнопка возврата назад или перехода по ссылке:
  if (element.type === 'backButton') {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (element.data.mode === 'link') return;
      event.preventDefault();
      window.history.back();
    };
    return (
      <div style={{ textAlign: element.style?.align || 'left' }}>
        {element.data.mode === 'link' ? (
          <a className="sc-el-button outline" href={resolveSiteHref(element.data.href || '/', slug)} style={css}>← {element.data.text || 'Назад'}</a>
        ) : (
          <button className="sc-el-button outline" type="button" onClick={handleClick} style={css}>← {element.data.text || 'Назад'}</button>
        )}
      </div>
    );
  }
  // Одиночное изображение:
  if (element.type === 'image') {
    return element.data.src ? (
      <div className="sc-el-image-wrap" style={{ textAlign: element.style?.align || 'left' }}>
        <img className="sc-el-image" src={element.data.src} alt={element.data.alt || ''} style={{ ...css, objectFit: element.data.fit || 'cover' }} />
      </div>
    ) : null;
  }
  // Галерея изображений:
  if (element.type === 'gallery') {
    return (
      <div className="sc-el-gallery" style={css}>
        <div className="sc-el-gallery-grid" style={{ gridTemplateColumns: `repeat(${element.data.columns || 3}, 1fr)` }}>
          {(element.data.images || []).map((url: string, index: number) => (
            <div key={index} className="sc-el-gallery-img" style={{ backgroundImage: `url(${url})`, borderRadius: element.style?.radius }} />
          ))}
        </div>
      </div>
    );
  }
  // Видеофрагмент по внешней ссылке:
  if (element.type === 'video') {
    const videoUrl = normalizeVideoUrl(element.data.url || '');
    return (
      <div className="sc-el-video" style={css}>
        {videoUrl ? <iframe src={videoUrl} title={element.data.title || 'Видео'} allowFullScreen /> : null}
      </div>
    );
  }
  // Разделительная линия:
  if (element.type === 'divider') {
    return <hr className="sc-el-divider" style={{ ...css, borderTopWidth: element.data.thickness || 1, borderTopStyle: element.data.lineStyle || 'solid' }} />;
  }
  // Пустой вертикальный отступ:
  if (element.type === 'spacer') {
    return <div style={{ height: element.data.height || 40 }} />;
  }
  // Текстовый контейнер с фоном и рамками:
  if (element.type === 'box') {
    return <div className="sc-el-box" style={css}>{String(element.data.text || '').split('\n').map((line: string, index: number) => <p key={index}>{line}</p>)}</div>;
  }
  // Нумерованный или маркированный список:
  if (element.type === 'list') {
    const ListTag = element.data.ordered ? 'ol' : 'ul';
    return (
      <div className="sc-el-list" style={css}>
        {element.data.heading && <h3>{element.data.heading}</h3>}
        <ListTag>{(element.data.items || []).map((item: string, index: number) => <li key={index}>{item}</li>)}</ListTag>
      </div>
    );
  }
  // Социальные ссылки:
  if (element.type === 'social') {
    const items = ['instagram', 'facebook', 'vk', 'telegram', 'youtube'].filter((key) => element.data[key]);
    return (
      <div className={`sc-el-social ${element.data.style === 'mono' ? 'mono' : ''}`} style={css}>
        {(items.length ? items : ['instagram', 'facebook', 'telegram']).map((key) => (
          <a key={key} href={element.data[key] || '#'}>{key.slice(0, 2).toUpperCase()}</a>
        ))}
      </div>
    );
  }
  // Якорь для перехода внутри страницы:
  if (element.type === 'menu') {
    const anchor = String(element.data.anchor || '').trim();
    return (
      <button
        className="sc-el-button outline"
        type="button"
        style={css}
        onClick={() => {
          if (!anchor) return;
          document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        {element.data.label || 'Перейти к разделу'}
      </button>
    );
  }
  // Простая форма обратной связи:
  if (element.type === 'form') {
    return <PublicLeadForm slug={slug} element={element} css={css} />;
  }
  // Карта Leaflet внутри опубликованного сайта:
  if (element.type === 'map') {
    return (
      <div className="sc-el-map" style={css}>
        <PublicLeafletMap data={element.data} />
      </div>
    );
  }
  // Пользовательский HTML-код:
  if (element.type === 'embed') {
    const safeHtml = sanitizeEmbedHtml(element.data.code || '');
    return (
      <pre className="sc-el-embed-frame" style={css}>{safeHtml}</pre>
    );
  }
  // Список опубликованных экскурсий:
  if (element.type === 'tours') {
    const selectedIds = element.data.selectedTourIds || [];
    return (
      <div className="sc-el-tours" style={css} id="tours">
        <h2>{element.data.heading}</h2>
        <div className="sc-el-tours-grid" style={{ gridTemplateColumns: `repeat(${element.data.columns || 2}, minmax(0, 1fr))` }}>
          {excursions
            .filter((exc: any) => selectedIds.length === 0 || selectedIds.includes(exc.id))
            .map((exc: any) => (
              <Link key={exc.id} to={`/s/${slug}/excursion/${exc.id}`} className="sc-el-tour-card">
                {exc.coverImage && <span className="sc-el-tour-cover" style={{ backgroundImage: `url(${exc.coverImage})` }} />}
                <h4>{exc.title}</h4>
                <span>{exc.city}</span>
                <small>{exc.duration} мин · {(exc.distance / 1000).toFixed(1)} км</small>
              </Link>
            ))}
        </div>
      </div>
    );
  }
  if (element.type === 'reviews') {
    const reviews = getAvailableReviews(excursions, element.data);
    return (
      <div className="sc-el-reviews" style={css}>
        <h2>{element.data.heading}</h2>
        {reviews.length === 0 ? <p className="sc-el-empty">Пока нет отзывов</p> : (
          <div className="sc-el-reviews-grid" style={{ gridTemplateColumns: `repeat(${element.data.columns || 2}, minmax(0, 1fr))` }}>
            {reviews.map((review) => (
              <article key={review.id} className="sc-el-review-card">
                <div className="sc-el-review-rating">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
                <p>{review.text}</p>
                <strong>{review.authorName}</strong>
                <small>{review.tourTitle}</small>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="sc-el-contacts" style={css}>
      <h2>{element.data.heading}</h2>
      <div className="sc-el-contacts-grid">
        {element.data.email && <div>Email: {element.data.email}</div>}
        {element.data.phone && <div>Телефон: {element.data.phone}</div>}
        {element.data.telegram && <div>Telegram: {element.data.telegram}</div>}
        {element.data.address && <div>Адрес: {element.data.address}</div>}
      </div>
    </div>
  );
}

function PublicLeadForm({ slug, element, css }: { slug: string; element: any; css: React.CSSProperties }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fields: string[] = (element.data.fields || []).filter(Boolean);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = fields
      .map((label) => ({ label, value: String(values[label] || '').trim() }))
      .filter((item) => item.value);

    if (payload.length === 0) {
      setMessage('Заполните хотя бы одно поле');
      return;
    }

    try {
      setSubmitting(true);
      setMessage('');
      await api.submitShowcaseLead(slug, {
        formTitle: String(element.data.heading || 'Форма обратной связи'),
        recipientEmail: String(element.data.recipientEmail || '').trim(),
        fields: payload,
      });
      setValues({});
      setMessage('Заявка отправлена автору');
    } catch (error: any) {
      setMessage(error.message || 'Не удалось отправить форму');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="sc-el-form" style={css} onSubmit={handleSubmit}>
      <h3>{element.data.heading}</h3>
      {fields.map((field) => (
        <input
          key={field}
          placeholder={field}
          value={values[field] || ''}
          onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
        />
      ))}
      {message ? <p className="sc-el-form-message">{message}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Отправка...' : element.data.buttonText || 'Отправить'}
      </button>
    </form>
  );
}

function styleToCss(style: any = {}, primary = '#2563eb'): React.CSSProperties {
  // Преобразует настройки конструктора в inline-стили:
  return {
    background: style.background && style.background !== 'transparent' ? style.background : undefined,
    color: style.color,
    padding: style.padding !== undefined ? style.padding : undefined,
    margin: style.margin !== undefined ? `${style.margin}px 0` : undefined,
    borderRadius: style.radius !== undefined ? style.radius : undefined,
    border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || '#e2e8f0'}` : undefined,
    boxShadow: style.shadow && style.shadow !== 'none' ? style.shadow : undefined,
    textAlign: style.align,
    fontSize: style.fontSize || undefined,
    width: style.width ? `${style.width}%` : undefined,
    '--sc-primary': primary,
  } as React.CSSProperties;
}

// Формирует резервную ссылку на встроенную карту:
function getMapEmbedUrl(data: Record<string, any>) {
  if (data.embedUrl) return data.embedUrl;
  const lat = Number(data.lat) || 59.939;
  const lng = Number(data.lng) || 30.316;
  const delta = 0.018;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

// Приводит ссылку на видео к embed-формату:
function normalizeVideoUrl(url: string) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.includes('youtube.com/embed/') || value.includes('player.vimeo.com/video/')) return value;

  const youtubeMatch = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (youtubeMatch?.[1]) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;

  const vimeoMatch = value.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch?.[1]) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return value;
}

// Синхронизирует центр и масштаб Leaflet-карты:
function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);
  return null;
}

// Показывает карту на опубликованной странице:
function PublicLeafletMap({ data }: { data: Record<string, any> }) {
  // Центр карты берется из настроек элемента:
  const center: [number, number] = [Number(data.lat) || 59.939, Number(data.lng) || 30.316];
  // Масштаб карты также хранится в данных элемента:
  const zoom = Number(data.zoom) || 13;

  return (
    <div className="public-leaflet-map">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom attributionControl={false}>
        <MapViewUpdater center={center} zoom={zoom} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={center} />
      </MapContainer>
      {data.address && <span className="sc-el-map-label">{data.address}</span>}
    </div>
  );
}


