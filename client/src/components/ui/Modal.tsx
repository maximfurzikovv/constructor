import React, { useEffect } from 'react';
import './Modal.css';

// Свойства модального окна:
interface ModalProps {
  open: boolean; // Флаг открытия окна
  onClose: () => void; // Закрытие
  title: string; // Заголовок
  children: React.ReactNode;// Внутреннее содержимое
}

// Универсальное модальное окно:
export default function Modal({ open, onClose, title, children }: ModalProps) {
  // Блокируем прокрутку, когда модальное окно открыто:
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    // Возвращаем прокрутку:
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Если окно закрыто:
  if (!open) return null;

  return (
    // Клик по затемнению закрывает окно:
    <div className="modal-overlay" onClick={onClose}>
      {/* Клик внутри окна не должен закрывать модалку: */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Верхняя часть окна: */}
        <div className="modal-header">
          {/* Заголовок модалки: */}
          <h3>{title}</h3>
          {/* Кнопка закрытия: */}
          <button className="modal-close" onClick={onClose}>
            x
          </button>
        </div>
        {/* Основное содержимое окна: */}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
