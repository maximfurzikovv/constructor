import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import ShowcaseLayout from './layouts/ShowcaseLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ExcursionsListPage from './pages/ExcursionsListPage';
import RouteEditorPage from './pages/RouteEditorPage';
import MediaLibraryPage from './pages/MediaLibraryPage';
import SiteBuilderPage from './pages/SiteBuilderPage';
import PublicationsPage from './pages/PublicationsPage';
import SystemAdminPage from './pages/SystemAdminPage';
import ShowcaseHomePage from './pages/ShowcaseHomePage';
import ExcursionDetailPage from './pages/ExcursionDetailPage';
import ExcursionPlayerPage from './pages/ExcursionPlayerPage';
import LandingPage from './pages/LandingPage';

// Главный компонент с маршрутизацией приложения:
export default function App() {
  return (
    // Routes выбирает страницу по текущему адресу:
    <Routes>
      {/* Auth: */}
      {/* Стартовая страница продукта: */}
      <Route path="/" element={<LandingPage />} />
      {/* Страница входа: */}
      <Route path="/login" element={<LoginPage />} />
      {/* Страница регистрации: */}
      <Route path="/register" element={<RegisterPage />} />

      {/* Admin: */}
      {/* Административная область с общей боковой панелью: */}
      <Route path="/admin" element={<AdminLayout />}>
        {/* Главная страница админки: */}
        <Route index element={<DashboardPage />} />
        {/* Список экскурсий: */}
        <Route path="excursions" element={<ExcursionsListPage />} />
        {/* Редактор маршрута экскурсии: */}
        <Route path="excursions/:excursionId/edit" element={<RouteEditorPage />} />
        {/* Медиатека проекта: */}
        <Route path="media" element={<MediaLibraryPage />} />
        {/* Конструктор сайта-витрины: */}
        <Route path="showcase" element={<SiteBuilderPage />} />
        {/* Раздел публикаций: */}
        <Route path="publications" element={<PublicationsPage />} />
        {/* Системная панель администратора: */}
        <Route path="system" element={<Navigate to="/admin/system/monitoring" replace />} />
        {/* Раздел системной панели администратора: */}
        <Route path="system/:section" element={<SystemAdminPage />} />
      </Route>

      {/* Showcase: */}
      {/* Публичный сайт по slug: */}
      <Route path="/s/:slug" element={<ShowcaseLayout />}>
        {/* Главная публичная страница: */}
        <Route index element={<ShowcaseHomePage />} />
        {/* Внутренняя страница публичного сайта: */}
        <Route path=":pageSlug" element={<ShowcaseHomePage />} />
        {/* Публичная карточка экскурсии: */}
        <Route path="excursion/:excursionId" element={<ExcursionDetailPage />} />
      </Route>

      {/* Плеер открывается на отдельной полноэкранной странице: */}
      {/* Плеер экскурсии открывается отдельно от админки и витрины: */}
      <Route path="/player/:excursionId" element={<ExcursionPlayerPage />} />

      {/* Default: */}
      {/* Неизвестный адрес возвращает на стартовую страницу: */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
// Приводит адрес сайта к slug:
export function normalizeSiteSlug(value: unknown, fallback: string) {
    if (typeof value !== 'string') return fallback; // Нестроковое значение

    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || fallback; // Безопасный URL-slug
}


