import React from 'react';
import styles from './Card.module.css';
void styles;

// Свойства карточки:
interface CardProps {
  children: React.ReactNode; // Содержимое карточки
  className?: string; // Доп. CSS-класс
  onClick?: () => void; // Обработчик
}

// Универсальная карточка:
export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    // Если есть onClick:
    <div
      className={`${styles.card} ${onClick ? 'card-clickable' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Содержимое карточки: */}
      {children}
    </div>
  );
}


