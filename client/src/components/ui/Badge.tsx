import React from 'react';
import styles from './Badge.module.css';
void styles;

// Свойства бейджа:
interface BadgeProps {
  children: React.ReactNode; // Текст или элемент
  variant?: 'default' | 'success' | 'warning' | 'danger'; // цвет статуса
}

// Цветная метка:
export default function Badge({ children, variant = 'default' }: BadgeProps) {
  return <span className={`${styles.badge} badge-${variant}`}>{children}</span>; // По варианту бейджа
}

// Словарь статусов экскурсии:
const statusLabels: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Черновик', variant: 'default' }, // Черновик
  review: { label: 'На модерации', variant: 'warning' }, // Ожидает проверки
  published: { label: 'Опубликован', variant: 'success' }, // Опубликовано
  archived: { label: 'Архив', variant: 'warning' }, // Архив
};

// По строковому значению:
export function StatusBadge({ status }: { status: string }) {
  // Настройки из словаря или исходный статус:
  const config = statusLabels[status] || { label: status, variant: 'default' as const };
  // Рендерим с найденным вариантом:
  return <Badge variant={config.variant}>{config.label}</Badge>;
}


