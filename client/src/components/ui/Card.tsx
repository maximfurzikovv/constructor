import React from 'react';
import './Card.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`card ${onClick ? 'card-clickable' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
