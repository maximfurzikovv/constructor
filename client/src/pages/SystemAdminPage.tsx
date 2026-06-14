import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import styles from './SystemAdminPage.module.css';
void styles;

type AdminSection = 'monitoring' | 'users' | 'moderation';
type ModerationFilter = 'all' | 'pending' | 'approved' | 'rejected';
type RoleFilter = 'all' | 'admin' | 'guide';

type CheckItem = {
  name: string;
  status: 'ok' | 'warn';
  detail: string;
};

type AdminOverview = {
  credentials: { email: string };
  summary: {
    users: number;
    guides: number;
    admins: number;
    otherUsers?: number;
    excursions: number;
    publishedExcursions: number;
    draftExcursions: number;
    reviewExcursions: number;
    archivedExcursions: number;
    media: number;
    sites: number;
    publishedSites: number;
    draftSites?: number;
    pendingSites: number;
    rejectedSites?: number;
    checked: number;
    unchecked: number;
    checkedPercent: number;
    uncheckedPercent: number;
    totalPoints: number;
    totalDistance: number;
  };
  healthChecks: Array<{ label: string; status: 'ok' | 'warn'; detail: string; items?: CheckItem[] }>;
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: 'guide' | 'admin';
    createdAt: string;
    excursionsCount: number;
    sitesCount: number;
  }>;
  excursions: Array<{
    id: string;
    title: string;
    city: string;
    status: 'draft' | 'review' | 'published' | 'archived';
    moderationComment?: string | null;
    hasSnapshot: boolean;
    updatedAt: string;
    author: { name: string; email: string };
    pointsCount: number;
    mediaCount: number;
    distance: number;
    duration: number;
  }>;
  sites: Array<{
    id: string;
    slug: string;
    title: string;
    status: 'draft' | 'review' | 'published' | 'archived';
    published: boolean;
    moderationComment?: string | null;
    createdAt: string;
    author: { name: string; email: string };
  }>;
};

const statusLabels = {
  draft: 'Черновик',
  published: 'Одобрено',
  archived: 'Отклонено',
  review: 'На модерации',
};

const sectionLabels = {
  monitoring: 'Мониторинг',
  users: 'Роли и доступ',
  moderation: 'Модерация',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function includesSearch(values: Array<string | null | undefined>, search: string) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => (value || '').toLowerCase().includes(normalized));
}

function getSiteStatus(site: AdminOverview['sites'][number]) {
  if (site.status === 'published') return 'approved';
  if (site.status === 'archived') return 'rejected';
  return 'pending';
}

// Системная панель администратора:
export default function SystemAdminPage() {
  const navigate = useNavigate();
  const params = useParams();
  const activeSection = (params.section || 'monitoring') as AdminSection;
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [userPage, setUserPage] = useState(1);
  const [moderationSearch, setModerationSearch] = useState('');
  const [moderationFilter, setModerationFilter] = useState<ModerationFilter>('pending');
  const [excursionPage, setExcursionPage] = useState(1);
  const [sitePage, setSitePage] = useState(1);
  const [selectedCheck, setSelectedCheck] = useState<AdminOverview['healthChecks'][number] | null>(null);

  // Загружает сводные данные панели:
  const load = async () => {
    setError('');
    try {
      const result = await api.getAdminOverview() as AdminOverview;
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить панель администратора');
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Возвращает пользователя на первый раздел при неизвестном адресе:
  useEffect(() => {
    if (!['monitoring', 'users', 'moderation'].includes(activeSection)) {
      navigate('/admin/system/monitoring', { replace: true });
    }
  }, [activeSection, navigate]);

  // Сбрасывает страницу списка пользователей после изменения фильтров:
  useEffect(() => {
    setUserPage(1);
  }, [userSearch, roleFilter]);

  useEffect(() => {
    setExcursionPage(1);
    setSitePage(1);
  }, [moderationSearch, moderationFilter]);

  const risks = useMemo(() => {
    if (!data) return [];
    const items = [];
    if (data.summary.reviewExcursions > 0) items.push('Есть экскурсии, ожидающие решения администратора');
    if (data.summary.pendingSites > 0) items.push('Есть веб-приложения, ожидающие решения администратора');
    if (data.summary.archivedExcursions > 0) items.push('Есть отклоненные экскурсии, которые могут потребовать повторной проверки');
    if ((data.summary.rejectedSites || 0) > 0) items.push('Есть отклоненные веб-приложения, которые могут вернуться после исправлений');
    if (data.summary.excursions > 0 && data.summary.publishedExcursions === 0) items.push('Нет ни одной одобренной экскурсии');
    if (data.summary.sites > 0 && data.summary.publishedSites === 0) items.push('Нет ни одного открытого веб-приложения');
    return items;
  }, [data]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    return data.users.filter((user) => {
      const roleMatches = roleFilter === 'all' || user.role === roleFilter;
      const searchMatches = includesSearch([user.name, user.email], userSearch);
      return roleMatches && searchMatches;
    });
  }, [data, roleFilter, userSearch]);

  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / 10));
  const visibleUsers = filteredUsers.slice((userPage - 1) * 10, userPage * 10);

  const filteredExcursions = useMemo(() => {
    if (!data) return [];
    return data.excursions.filter((item) => {
      const searchMatches = includesSearch([item.title, item.city, item.author.name, item.author.email], moderationSearch);
      const statusMatches =
        moderationFilter === 'all' ||
        (moderationFilter === 'pending' && item.status === 'review') ||
        (moderationFilter === 'approved' && item.status === 'published') ||
        (moderationFilter === 'rejected' && item.status === 'archived');
      return searchMatches && statusMatches;
    });
  }, [data, moderationFilter, moderationSearch]);

  const filteredSites = useMemo(() => {
    if (!data) return [];
    return data.sites.filter((site) => {
      const status = getSiteStatus(site);
      const searchMatches = includesSearch([site.title, site.slug, site.author.name, site.author.email], moderationSearch);
      const statusMatches = moderationFilter === 'all' || moderationFilter === status;
      return searchMatches && statusMatches;
    });
  }, [data, moderationFilter, moderationSearch]);

  const moderationPageSize = 6;
  const excursionPageCount = Math.max(1, Math.ceil(filteredExcursions.length / moderationPageSize));
  const sitePageCount = Math.max(1, Math.ceil(filteredSites.length / moderationPageSize));
  const visibleExcursions = filteredExcursions.slice((excursionPage - 1) * moderationPageSize, excursionPage * moderationPageSize);
  const visibleSites = filteredSites.slice((sitePage - 1) * moderationPageSize, sitePage * moderationPageSize);

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError('');
    try {
      await action();
      await load();
    } catch (err: any) {
      setError(err.message || 'Действие не выполнено');
    } finally {
      setBusy('');
    }
  };

  const getMonitoringDetails = (summary: AdminOverview['summary']) => {
    const userParts = [`${summary.guides} экскурсоводов`, `${summary.admins} админ.`];
    if ((summary.otherUsers || 0) > 0) userParts.push(`${summary.otherUsers} прочих ролей`);

    const excursionParts = [
      `${summary.publishedExcursions} одобрено`,
      `${summary.reviewExcursions} на модерации`,
      `${summary.draftExcursions} черновиков`,
      `${summary.archivedExcursions} отклонено`,
    ];

    const siteParts = [
      `${summary.publishedSites} открыто`,
      `${summary.pendingSites} ожидают решения`,
      `${summary.draftSites || 0} черновиков`,
      `${summary.rejectedSites || 0} отклонено`,
    ];

    return {
      users: userParts.join(', '),
      excursions: excursionParts.join(', '),
      sites: siteParts.join(', '),
    };
  };

  const approvedPercent = data?.summary.excursions ? Math.round((data.summary.publishedExcursions / data.summary.excursions) * 100) : 0;

  const rejectExcursion = (id: string, title: string) => {
    const comment = window.prompt(`Причина отклонения экскурсии "${title}"`);
    if (!comment?.trim()) return;
    runAction(`exc-${id}`, () => api.updateAdminExcursionStatus(id, 'archived', comment));
  };

  const approveSite = (id: string, title: string) => {
    const comment = window.prompt(`Комментарий к публикации веб-приложения "${title}"`, 'Одобрено');
    if (comment === null) return;
    runAction(`site-${id}`, () => api.updateAdminSitePublished(id, true, comment.trim()));
  };

  const rejectSite = (id: string, title: string) => {
    const comment = window.prompt(`Причина отклонения веб-приложения "${title}"`);
    if (!comment?.trim()) return;
    runAction(`site-${id}`, () => api.updateAdminSitePublished(id, false, comment));
  };

  if (!data && !error) {
    return <div className={styles['system-admin']}><Card className="system-loading">Загрузка панели администратора</Card></div>;
  }

  return (
    <div className={styles['system-admin']}>
      <div className="system-header">
        <div>
          <span className="system-eyebrow">Панель администратора</span>
          <h1>{sectionLabels[activeSection] || 'Управление системой'}</h1>
        </div>
      </div>

      {error && <div className="system-error">{error}</div>}

      {data && activeSection === 'monitoring' && (
        <>
          {(() => {
            const details = getMonitoringDetails(data.summary);
            return (
          <div className="system-stats admin-kpis">
            <Card><span>Пользователи</span><strong>{data.summary.users}</strong><small>{details.users}</small></Card>
            <Card><span>Экскурсии</span><strong>{data.summary.excursions}</strong><small>{details.excursions}</small></Card>
            <Card><span>Веб-приложения</span><strong>{data.summary.sites}</strong><small>{details.sites}</small></Card>
            <Card className="donut-card">
              <div className="donut" style={{ '--checked': `${approvedPercent}%` } as CSSProperties}>
                <span>{approvedPercent}%</span>
              </div>
              <div><span>Одобрено</span><small>{data.summary.publishedExcursions} одобрено, {data.summary.excursions - data.summary.publishedExcursions} не одобрено</small></div>
            </Card>
          </div>
            );
          })()}

          <div className="system-grid">
            <Card className="system-panel">
              <h2>Автотесты</h2>
              <div className="health-list">
                {data.healthChecks.map((check) => (
                  <div key={check.label} className="test-check">
                    <span className={`health-dot ${check.status}`} />
                    <strong>{check.label}</strong>
                    <small>{check.detail}</small>
                    {!!check.items?.length && (
                      <button className="test-toggle" type="button" onClick={() => setSelectedCheck(check)}>
                        Подробнее
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
            <Card className="system-panel">
              <h2>Контрольные точки</h2>
              <div className="risk-list">
                {risks.length ? risks.map((item) => <div key={item}>{item}</div>) : <div>Сейчас нет заметных задач для администратора</div>}
              </div>
            </Card>
          </div>
        </>
      )}

      {data && activeSection === 'users' && (
        <Card className="system-panel">
          <div className="panel-title-row">
            <h2>Пользователи</h2>
            <span>{filteredUsers.length} из {data.users.length} записей</span>
          </div>
          <div className="admin-filters">
            <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Поиск по имени или email" />
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}>
              <option value="all">Все роли</option>
              <option value="admin">Администраторы</option>
              <option value="guide">Экскурсоводы</option>
            </select>
          </div>
          <div className="admin-table">
            <div className="admin-row admin-head"><span>Пользователь</span><span>Роль</span><span>Материалы</span><span>Действие</span></div>
            {visibleUsers.map((user) => (
              <div className="admin-row" key={user.id}>
                <span><strong>{user.name}</strong><small>{user.email}</small></span>
                <span className={`role-pill ${user.role}`}>{user.role === 'admin' ? 'Администратор' : 'Экскурсовод'}</span>
                <span>{user.excursionsCount} экск., {user.sitesCount} сайт.</span>
                <span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy === `role-${user.id}`}
                    onClick={() => runAction(`role-${user.id}`, () => api.updateAdminUserRole(user.id, user.role === 'admin' ? 'guide' : 'admin'))}
                  >
                    {user.role === 'admin' ? 'Сделать гидом' : 'Сделать админом'}
                  </Button>
                </span>
              </div>
            ))}
            {!visibleUsers.length && <div className="admin-empty">Пользователи не найдены</div>}
          </div>
          <div className="admin-pagination">
            <Button variant="secondary" size="sm" disabled={userPage <= 1} onClick={() => setUserPage((page) => page - 1)}>Назад</Button>
            <span>Страница {userPage} из {userPageCount}</span>
            <Button variant="secondary" size="sm" disabled={userPage >= userPageCount} onClick={() => setUserPage((page) => page + 1)}>Вперед</Button>
          </div>
        </Card>
      )}

      {data && activeSection === 'moderation' && (
        <>
          <Card className="system-panel">
            <div className="panel-title-row">
              <h2>Очередь модерации</h2>
              <span>{filteredExcursions.length + filteredSites.length} материалов</span>
            </div>
            <div className="admin-filters">
              <input value={moderationSearch} onChange={(event) => setModerationSearch(event.target.value)} placeholder="Поиск по названию, автору или адресу" />
              <select value={moderationFilter} onChange={(event) => setModerationFilter(event.target.value as ModerationFilter)}>
                <option value="all">Все статусы</option>
                <option value="pending">На модерации</option>
                <option value="approved">Одобрено</option>
                <option value="rejected">Отклонено</option>
              </select>
            </div>
          </Card>

          <div className="system-grid moderation-grid">
            <Card className="system-panel">
              <div className="panel-title-row">
                <h2>Экскурсии</h2>
                <span>{filteredExcursions.length} записей</span>
              </div>
              <div className="moderation-list">
                {visibleExcursions.map((item) => (
                  <div className={`moderation-item moderation-${item.status}`} key={item.id}>
                    <div>
                      <strong>{item.title || 'Без названия'}</strong>
                      <small>{item.author.name} · {item.city || 'город не указан'} · {formatDate(item.updatedAt)}</small>
                      <em>{item.pointsCount} точек, {item.mediaCount} медиа</em>
                      <span className={`status-pill status-${item.status}`}>{statusLabels[item.status]}</span>
                      {item.moderationComment && <b className="moderation-comment">Комментарий: {item.moderationComment}</b>}
                    </div>
                    <div className="moderation-actions">
                      <a className="moderation-action action-open" href={`/player/${item.id}`} target="_blank" rel="noreferrer">Открыть</a>
                      {item.status !== 'published' && (
                        <button className="moderation-action action-approve" disabled={busy === `exc-${item.id}`} onClick={() => runAction(`exc-${item.id}`, () => api.updateAdminExcursionStatus(item.id, 'published'))}>Одобрить</button>
                      )}
                      {item.status !== 'archived' && (
                        <button className="moderation-action action-reject" disabled={busy === `exc-${item.id}`} onClick={() => rejectExcursion(item.id, item.title || 'Без названия')}>Отклонить</button>
                      )}
                    </div>
                  </div>
                ))}
                {!filteredExcursions.length && <div className="admin-empty">Экскурсии не найдены</div>}
              </div>
              <div className="admin-pagination">
                <Button variant="secondary" size="sm" disabled={excursionPage <= 1} onClick={() => setExcursionPage((page) => page - 1)}>Назад</Button>
                <span>Страница {excursionPage} из {excursionPageCount}</span>
                <Button variant="secondary" size="sm" disabled={excursionPage >= excursionPageCount} onClick={() => setExcursionPage((page) => page + 1)}>Вперед</Button>
              </div>
            </Card>

            <Card className="system-panel">
              <div className="panel-title-row">
                <h2>Веб-приложения</h2>
                <span>{filteredSites.length} сайтов</span>
              </div>
              <div className="moderation-list">
                {visibleSites.map((site) => {
                  const siteStatus = getSiteStatus(site);
                  return (
                    <div className={`moderation-item moderation-${siteStatus}`} key={site.id}>
                      <div>
                        <strong>{site.title || site.slug}</strong>
                        <small>{site.author.name} · /s/{site.slug}</small>
                        <span className={`status-pill status-${siteStatus}`}>{siteStatus === 'approved' ? 'Одобрено' : siteStatus === 'rejected' ? 'Отклонено' : 'На модерации'}</span>
                        {site.moderationComment && <b className="moderation-comment">Комментарий: {site.moderationComment}</b>}
                      </div>
                      <div className="moderation-actions">
                        <a className="moderation-action action-open" href={`/s/${site.slug}`} target="_blank" rel="noreferrer">Открыть</a>
                        {siteStatus !== 'approved' && (
                          <button className="moderation-action action-approve" disabled={busy === `site-${site.id}`} onClick={() => approveSite(site.id, site.title || site.slug)}>Одобрить</button>
                        )}
                        {siteStatus !== 'rejected' && (
                          <button className="moderation-action action-reject" disabled={busy === `site-${site.id}`} onClick={() => rejectSite(site.id, site.title || site.slug)}>Отклонить</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!filteredSites.length && <div className="admin-empty">Веб-приложения не найдены</div>}
              </div>
              <div className="admin-pagination">
                <Button variant="secondary" size="sm" disabled={sitePage <= 1} onClick={() => setSitePage((page) => page - 1)}>Назад</Button>
                <span>Страница {sitePage} из {sitePageCount}</span>
                <Button variant="secondary" size="sm" disabled={sitePage >= sitePageCount} onClick={() => setSitePage((page) => page + 1)}>Вперед</Button>
              </div>
            </Card>
          </div>
        </>
      )}

      <Modal open={Boolean(selectedCheck)} onClose={() => setSelectedCheck(null)} title={selectedCheck?.label || 'Автотесты'}>
        <div className="test-modal">
          <p>{selectedCheck?.detail}</p>
          <div className="test-detail-list">
            {selectedCheck?.items?.map((item) => (
              <p key={item.name}>
                <span className={`test-status ${item.status}`}>{item.status === 'ok' ? 'OK' : 'Ошибка'}</span>
                <b>{item.name}</b>
                <small>{item.detail}</small>
              </p>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}


