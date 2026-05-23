import React from 'react';
import { Outlet } from 'react-router-dom';
import './ShowcaseLayout.css';

// Layout публичного сайта:
export default function ShowcaseLayout() {
  return (
    // Общая оболочка:
    <div className="showcase-layout">
      {/* Выбранная публичная страница: */}
      <Outlet />
    </div>
  );
}
