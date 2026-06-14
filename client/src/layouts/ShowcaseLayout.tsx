import React from 'react';
import { Outlet } from 'react-router-dom';
import styles from './ShowcaseLayout.module.css';
void styles;

// Layout публичного сайта:
export default function ShowcaseLayout() {
  return (
    // Общая оболочка:
    <div className={styles['showcase-layout']}>
      {/* Выбранная публичная страница: */}
      <Outlet />
    </div>
  );
}


