import React, { useId } from 'react';
import styles from './Input.module.css';
void styles;

// Свойства поля ввода:
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; // Необязательная подпись
}

// Универсальный input:
export default function Input({ label, className = '', ...props }: InputProps) {
  const generatedId = useId(); // ID нужен для связи label и input
  const inputId = props.id || generatedId; // Переданный id имеет приоритет

  return (
    <div className={`${styles['input-group']} ${className}`}>
      {/* Если label передан, показываем подпись: */}
      {label && <label className="input-label" htmlFor={inputId}>{label}</label>}
      {/* Все остальные свойства идут в сам input: */}
      <input id={inputId} className={styles.input} {...props} />
    </div>
  );
}

// Свойства многострочного поля:
interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; // Необязательная подпись
}

// Универсальная textarea:
export function Textarea({
  label, // Подпись поля

  className = '', // Доп. CSS-класс
  // Остальные свойства textarea:
  ...props
}: TextareaProps) {
  const generatedId = useId(); // ID нужен для связи label и textarea
  const textareaId = props.id || generatedId; // Переданный id имеет приоритет

  return (
    <div className={`${styles['input-group']} ${className}`}>
      {/* Подпись выводится только при наличии label: */}
      {label && <label className="input-label" htmlFor={textareaId}>{label}</label>}
      {/* textarea использует общий стиль input и свой стиль textarea: */}
      <textarea id={textareaId} className={`${styles.input} textarea`} {...props} />
    </div>
  );
}


