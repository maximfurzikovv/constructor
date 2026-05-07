import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import './AdminLayout.css';

const navItems = [
  { to: '/admin', icon: '▥', label: 'Дашборд', end: true },
  { to: '/admin/excursions', icon: '🗺', label: 'Экскурсии' },
  { to: '/admin/media', icon: '▣', label: 'Медиатека' },
  { to: '/admin/showcase', icon: '◎', label: 'Конструктор сайта' },
  { to: '/admin/publications', icon: '▮', label: 'Публикации' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className={`admin-layout ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
      {sidebarOpen ? (
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Конструктор</h2>
            <button
              className="sidebar-collapse-btn"
              type="button"
              onClick={() => setSidebarOpen(false)}
              title="Скрыть меню"
            >
              ←
            </button>
          </div>
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="user-info">
              <span className="user-name">{user.name || 'Гость'}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </aside>
      ) : (
        <button
          className="sidebar-open-btn"
          type="button"
          onClick={() => setSidebarOpen(true)}
          title="Показать меню"
        >
          ☰
        </button>
      )}
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
