import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

// Находим root-элемент из index.html и монтируем в него React:
ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode помогает замечать потенциальные ошибки во время разработки:
  <React.StrictMode>
    {/* BrowserRouter включает маршрутизацию по URL в браузере: */}
    <BrowserRouter>
      {/* App содержит все маршруты приложения: */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
