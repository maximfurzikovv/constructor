import React from 'react';
import './Badge.css';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export default function Badge({ children, variant = 'default' }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

const statusLabels: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Черновик', variant: 'default' },
  published: { label: 'Опубликован', variant: 'success' },
  archived: { label: 'Архив', variant: 'warning' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusLabels[status] || { label: status, variant: 'default' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
