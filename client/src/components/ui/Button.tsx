import React from 'react';
import './Button.css';

// Свойства кнопки:
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; // Цвет и смысл
  size?: 'sm' | 'md' | 'lg'; // Высота и отступы
}

// Универсальная кнопка:
export default function Button({
  // Основной вариант:
  variant = 'primary',
  size = 'md', // По умолчанию
  className = '', // Дополнительные классы
  children, // Текст или иконка внутри кнопки
  ...props
}: ButtonProps) {
  return (
    // Классы собираются из варианта, размера и внешнего className:
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    >
      {/* Содержимое кнопки: */}
      {children}
    </button>
  );
}
