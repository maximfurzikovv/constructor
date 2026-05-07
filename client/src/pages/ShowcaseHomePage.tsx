import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { api } from '../api/client';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import './ShowcaseHomePage.css';

export default function ShowcaseHomePage() {
  const { slug } = useParams<{ slug: string }>();
  const [site, setSite] = useState<any>(null);

  useEffect(() => {
    if (slug) api.getShowcase(slug).then((d: any) => setSite(d));
  }, [slug]);

  if (!site) return <p style={{ padding: 40 }}>Загрузка...</p>;

  const cd = site.constructorData;

  if (cd && cd.pages && cd.pages.length > 0) {
    return <ConstructorSite site={site} constructorData={cd} slug={slug!} />;
  }

  return (
    <div className="showcase-home">
      <header className="showcase-header">
        <div className="showcase-header-inner">
          <Link to={`/s/${slug}`} className="showcase-logo">{site.title}</Link>
        </div>
      </header>
      <main style={{ padding: '0 32px' }}>
        <div className="showcase-hero">
          <h1>{site.title}</h1>
          <p>{site.description}</p>
        </div>

        <h2>Доступные экскурсии</h2>
        <div className="showcase-tours-grid">
          {(site.excursionDetails || []).map((exc: any) => (
            <Card key={exc.id} className="showcase-tour-card">
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

function ConstructorSite({ site, constructorData, slug }: { site: any; constructorData: any; slug: string }) {
  const [activePageId, setActivePageId] = useState(constructorData.pages[0]?.id || '');
  const activePage = constructorData.pages.find((p: any) => p.id === activePageId) || constructorData.pages[0];
  const theme = constructorData.theme || {};
  const excursions = site.excursionDetails || [];

  const fontFamily =
    theme.fontFamily === 'serif'
      ? 'Georgia, serif'
      : theme.fontFamily === 'mono'
      ? 'monospace'
      : 'inherit';

  return (
    <div
      className="showcase-constructor"
      style={{
        fontFamily,
        '--sc-primary': theme.primaryColor || '#2563eb',
        '--sc-radius': `${theme.borderRadius || '8'}px`,
        '--sc-site-bg': theme.siteBg || '#ffffff',
        '--sc-header-bg': theme.headerBg || '#ffffff',
        '--sc-header-color': theme.headerTextColor || '#0f172a',
        '--sc-header-gap': `${theme.headerNavGap || 16}px`,
      } as React.CSSProperties}
    >
      <div className={`sc-header ${theme.headerStyle === 'dark' ? 'dark' : ''} nav-${theme.headerNavAlign || 'right'}`}>
        <span className="sc-header-logo">
          {theme.logoImage ? <img src={theme.logoImage} alt="" className="sc-logo-img" /> : null}
          {theme.logoText || site.title}
        </span>
        {theme.headerNavVisible !== false && (
          <div className={`sc-header-nav nav-style-${theme.headerNavStyle || 'links'}`}>
            {constructorData.pages.map((p: any) => (
              <button
                key={p.id}
                className={`sc-nav-link ${activePageId === p.id ? 'active' : ''}`}
                onClick={() => setActivePageId(p.id)}
              >
                {p.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {activePage.sections
        ? <SectionRenderer page={activePage} excursions={excursions} slug={slug} primary={theme.primaryColor || '#2563eb'} />
        : <LegacyBlockRenderer page={activePage} excursions={excursions} slug={slug} />}

      <div className="sc-footer">
        {site.title} &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}

function SectionRenderer({ page, excursions, slug, primary }: { page: any; excursions: any[]; slug: string; primary: string }) {
  return (
    <>
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

function PublicElement({ element, excursions, slug, primary }: { element: any; excursions: any[]; slug: string; primary: string }) {
  const css = styleToCss(element.style, primary);

  if (element.type === 'heading') {
    const Tag = element.data.level || 'h2';
    return <Tag className="sc-el-heading" style={css}>{element.data.text}</Tag>;
  }
  if (element.type === 'text') {
    return <p className="sc-el-text" style={css}>{element.data.text}</p>;
  }
  if (element.type === 'button') {
    return (
      <div style={{ textAlign: element.style?.align || 'left' }}>
        <a className={`sc-el-button ${element.data.variant === 'outline' ? 'outline' : ''}`} href={element.data.href || '#'} style={css}>
          {element.data.text}
        </a>
      </div>
    );
  }
  if (element.type === 'backButton') {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (element.data.mode === 'link') return;
      event.preventDefault();
      window.history.back();
    };
    return (
      <div style={{ textAlign: element.style?.align || 'left' }}>
        {element.data.mode === 'link' ? (
          <a className="sc-el-button outline" href={element.data.href || '/'} style={css}>← {element.data.text || 'Назад'}</a>
        ) : (
          <button className="sc-el-button outline" type="button" onClick={handleClick} style={css}>← {element.data.text || 'Назад'}</button>
        )}
      </div>
    );
  }
  if (element.type === 'image') {
    return element.data.src ? (
      <img className="sc-el-image" src={element.data.src} alt={element.data.alt || ''} style={{ ...css, objectFit: element.data.fit || 'cover' }} />
    ) : null;
  }
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
  if (element.type === 'video') {
    return (
      <div className="sc-el-video" style={css}>
        {element.data.url ? <iframe src={element.data.url} title={element.data.title || 'Видео'} /> : null}
      </div>
    );
  }
  if (element.type === 'divider') {
    return <hr className="sc-el-divider" style={{ ...css, borderTopWidth: element.data.thickness || 1, borderTopStyle: element.data.lineStyle || 'solid' }} />;
  }
  if (element.type === 'spacer') {
    return <div style={{ height: element.data.height || 40 }} />;
  }
  if (element.type === 'box') {
    return <div className="sc-el-box" style={css}>{String(element.data.text || '').split('\n').map((line: string, index: number) => <p key={index}>{line}</p>)}</div>;
  }
  if (element.type === 'list') {
    const ListTag = element.data.ordered ? 'ol' : 'ul';
    return (
      <div className="sc-el-list" style={css}>
        {element.data.heading && <h3>{element.data.heading}</h3>}
        <ListTag>{(element.data.items || []).map((item: string, index: number) => <li key={index}>{item}</li>)}</ListTag>
      </div>
    );
  }
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
  if (element.type === 'menu') {
    return <div id={element.data.anchor || undefined} className="sc-el-anchor" style={css}>{element.data.label}</div>;
  }
  if (element.type === 'form') {
    return (
      <form className="sc-el-form" style={css}>
        <h3>{element.data.heading}</h3>
        {(element.data.fields || []).map((field: string) => <input key={field} placeholder={field} />)}
        <button type="button">{element.data.buttonText || 'Отправить'}</button>
      </form>
    );
  }
  if (element.type === 'map') {
    return (
      <div className="sc-el-map" style={css}>
        <PublicLeafletMap data={element.data} />
      </div>
    );
  }
  if (element.type === 'embed') {
    return <div className="sc-el-embed" style={css} dangerouslySetInnerHTML={{ __html: element.data.code || '' }} />;
  }
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
                <h4>{exc.title}</h4>
                <span>{exc.city}</span>
                <small>{exc.duration} мин · {(exc.distance / 1000).toFixed(1)} км</small>
              </Link>
            ))}
        </div>
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

function styleToCss(style: any = {}, primary = '#2563eb'): React.CSSProperties {
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

function getMapEmbedUrl(data: Record<string, any>) {
  if (data.embedUrl) return data.embedUrl;
  const lat = Number(data.lat) || 59.939;
  const lng = Number(data.lng) || 30.316;
  const delta = 0.018;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);
  return null;
}

function PublicLeafletMap({ data }: { data: Record<string, any> }) {
  const center: [number, number] = [Number(data.lat) || 59.939, Number(data.lng) || 30.316];
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

function LegacyBlockRenderer({ page, excursions, slug }: { page: any; excursions: any[]; slug: string }) {
  return (
    <>
      {(page.blocks || []).filter((block: any) => block.type !== 'header').map((block: any) => (
        <div key={block.id}>
          {block.type === 'banner' && (
            <div
              className="sc-banner"
              style={{
                background: block.data.bgImage
                  ? `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${block.data.bgImage}) center/cover`
                  : (block.data.bgColor || '#2563eb'),
                color: block.data.textColor || '#fff',
                borderRadius: 'var(--sc-radius)',
              }}
            >
              <h1>{block.data.title}</h1>
              <p>{block.data.subtitle}</p>
            </div>
          )}

          {block.type === 'about' && (
            <div className="sc-about">
              {block.data.photoUrl && <img src={block.data.photoUrl} alt="" className="sc-about-photo" />}
              <div>
                <h2>{block.data.name}</h2>
                <p>{block.data.bio}</p>
              </div>
            </div>
          )}

          {block.type === 'tours' && (
            <div className="sc-tours">
              <h2>{block.data.heading}</h2>
              <div className="sc-tours-grid" style={{ gridTemplateColumns: `repeat(${block.data.columns || 2}, 1fr)` }}>
                {excursions
                  .filter((exc: any) => {
                    const ids = block.data.selectedTourIds || [];
                    return ids.length === 0 || ids.includes(exc.id);
                  })
                  .map((exc: any) => (
                    <Link key={exc.id} to={`/s/${slug}/excursion/${exc.id}`} className="sc-tour-card" style={{ borderRadius: 'var(--sc-radius)' }}>
                      <h4>{exc.title}</h4>
                      <span className="sc-tour-city">{exc.city}</span>
                      <span className="sc-tour-meta">{exc.duration} мин &bull; {(exc.distance / 1000).toFixed(1)} км</span>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {block.type === 'contacts' && (
            <div className="sc-contacts">
              <h2>{block.data.heading}</h2>
              <div className="sc-contacts-grid">
                {block.data.email && <div className="sc-contact-item">Email: {block.data.email}</div>}
                {block.data.phone && <div className="sc-contact-item">Телефон: {block.data.phone}</div>}
                {block.data.telegram && <div className="sc-contact-item">Telegram: {block.data.telegram}</div>}
                {block.data.address && <div className="sc-contact-item">Адрес: {block.data.address}</div>}
              </div>
            </div>
          )}

          {block.type === 'text' && (
            <div className="sc-text">
              <h2>{block.data.heading}</h2>
              <p>{block.data.content}</p>
            </div>
          )}

          {block.type === 'gallery' && (
            <div className="sc-gallery">
              <h2>{block.data.heading}</h2>
              <div className="sc-gallery-grid">
                {(block.data.images || []).map((url: string, i: number) => (
                  <div key={i} className="sc-gallery-img" style={{ backgroundImage: `url(${url})`, borderRadius: 'var(--sc-radius)' }} />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
