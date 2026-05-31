import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import './AdminLayout.css';
import { api } from '../api/client';

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
};

// Пункты меню для экскурсовода:
const guideNavItems: NavItem[] = [
  // Переход на дашборд:
  { to: '/admin', label: 'Дашборд', end: true },
  // Переход к экскурсиям:
  { to: '/admin/excursions', label: 'Экскурсии' },
  // Переход к медиатеке:
  { to: '/admin/media', label: 'Медиатека' },
  // Переход к конструктору сайта:
  { to: '/admin/showcase', label: 'Конструктор' },
  // Переход к публикациям:
  { to: '/admin/publications', label: 'Публикации' },
];

// Пункты меню для администратора:
const adminNavItems: NavItem[] = [
  // Переход к мониторингу:
  { to: '/admin/system/monitoring', label: 'Мониторинг' },
  // Переход к управлению ролями:
  { to: '/admin/system/users', label: 'Роли и доступ' },
  // Переход к модерации:
  { to: '/admin/system/moderation', label: 'Модерация' },
];

// Общий layout:
export default function AdminLayout() {
  // navigate:
  const navigate = useNavigate();
  // Текущий адрес:
  const location = useLocation();
  // Состояние панели:
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.location.pathname.startsWith('/admin/showcase'));

  // Данные пользователя из localStorage:
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const visibleNavItems = user.role === 'admin' ? adminNavItems : guideNavItems;

  // Администратор открывает только системные разделы:
  useEffect(() => {
    if (user.role === 'admin' && !location.pathname.startsWith('/admin/system')) {
      navigate('/admin/system/monitoring', { replace: true });
    }
  }, [location.pathname, navigate, user.role]);

  // Выход пользователя:
  const handleLogout = async () => {
    await api.logout().catch(() => undefined); // Очищаем HttpOnly cookie
    localStorage.removeItem('token'); // Удаляем старый JWT
    localStorage.removeItem('user'); // Удаляем данные пользователя
    navigate('/login');
  };

  return (
    <div className={`admin-layout ${user.role === 'admin' ? 'admin-theme' : ''} ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
      {/* Если панель открыта, показываем меню: */}
      {sidebarOpen ? (
        <aside className="sidebar">
          {/* Шапка боковой панели: */}
          <div className="sidebar-header">
            <h2>{user.role === 'admin' ? 'Администратор' : 'Конструктор'}</h2>
            {/* Кнопка скрытия меню: */}
            <button
              className="sidebar-collapse-btn"
              type="button"
              onClick={() => setSidebarOpen(false)}
              title="Скрыть меню"
            >
                ⟵
            </button>
          </div>
          <nav className="sidebar-nav">
            {/* Формируем пункты меню: */}
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (item.to === '/admin/showcase') setSidebarOpen(false); // Освобождаем место для конструктора
                }}
              >
                {/* Текст пункта меню: */}
                {item.label}
              </NavLink>
            ))}
          </nav>
          {/* Нижняя часть панели: */}
          <div className="sidebar-footer">
            <div className="user-info">
              {/* Имя пользователя: */}
              <span className="user-name">{user.name || 'Максим Фурзиков'}</span>
            </div>
            {/* Кнопка выхода: */}
            <button className="logout-btn" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </aside>
      ) : (
        // Если панель скрыта:
        <button
          className="sidebar-open-btn"
          type="button"
          onClick={() => setSidebarOpen(true)}
          title="Показать меню"
        >
          ☰
        </button>
      )}
      {/* Основная область: */}
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
