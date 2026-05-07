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
import ShowcaseHomePage from './pages/ShowcaseHomePage';
import ExcursionDetailPage from './pages/ExcursionDetailPage';
import ExcursionPlayerPage from './pages/ExcursionPlayerPage';

export default function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Admin */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="excursions" element={<ExcursionsListPage />} />
        <Route path="excursions/:excursionId/edit" element={<RouteEditorPage />} />
        <Route path="media" element={<MediaLibraryPage />} />
        <Route path="showcase" element={<SiteBuilderPage />} />
        <Route path="publications" element={<PublicationsPage />} />
      </Route>

      {/* Showcase */}
      <Route path="/s/:slug" element={<ShowcaseLayout />}>
        <Route index element={<ShowcaseHomePage />} />
        <Route path="excursion/:excursionId" element={<ExcursionDetailPage />} />
      </Route>

      {/* Player — fullscreen, no layout */}
      <Route path="/player/:excursionId" element={<ExcursionPlayerPage />} />

      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
