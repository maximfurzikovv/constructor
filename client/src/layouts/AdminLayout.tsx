import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import './AdminLayout.css';

// Пункты бокового меню:
const navItems = [
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

// Общий layout:
export default function AdminLayout() {
  // navigate:
  const navigate = useNavigate();
  // Состояние панели:
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.location.pathname.startsWith('/admin/showcase'));

  // Выход пользователя:
  const handleLogout = () => {
    localStorage.removeItem('token'); // Удаляем JWT
    localStorage.removeItem('user'); // Удаляем данные пользователя
    navigate('/login');
  };

  // Данные пользователя из localStorage:
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className={`admin-layout ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
      {/* Если панель открыта, показываем меню: */}
      {sidebarOpen ? (
        <aside className="sidebar">
          {/* Шапка боковой панели: */}
          <div className="sidebar-header">
            <h2>Конструктор</h2>
            {/* Кнопка скрытия меню: */}
            <button
              className="sidebar-collapse-btn"
              type="button"
              onClick={() => setSidebarOpen(false)}
              title="Скрыть меню"
            >
                ⬅
            </button>
          </div>
          <nav className="sidebar-nav">
            {/* Формируем пункты меню: */}
            {navItems.map((item) => (
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
