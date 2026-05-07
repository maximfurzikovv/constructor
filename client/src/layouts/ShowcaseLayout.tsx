import React from 'react';
import { Outlet } from 'react-router-dom';
import './ShowcaseLayout.css';

export default function ShowcaseLayout() {
  return (
    <div className="showcase-layout">
      <Outlet />
    </div>
  );
}
