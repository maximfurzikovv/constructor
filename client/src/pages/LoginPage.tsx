import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import styles from './AuthPages.module.css';
void styles;

// Страница входа в аккаунт:
export default function LoginPage() {
  // navigate:
  const navigate = useNavigate();
  // Email по умолчанию:
  const [email, setEmail] = useState('');
  // Пароль:
  const [password, setPassword] = useState('');
  // Ошибка:
  const [error, setError] = useState('');

  // Обработка отправки формы входа:
  const handleSubmit = async (e: React.FormEvent) => {
    // Отменяем стандартную отправку формы:
    e.preventDefault();
    // Перед новым запросом очищаем прошлую ошибку:
    setError('');
    try {
      // Отправляем email и пароль на сервер:
      const result: any = await api.login(email, password);
      // Старый браузерный токен больше не используется:
      localStorage.removeItem('token');
      // Сохраняем данные пользователя:
      localStorage.setItem('user', JSON.stringify(result.user));
      // После входа открываем нужную рабочую область:
      navigate(result.user?.role === 'admin' ? '/admin/system' : '/admin');
    } catch (err: any) {
      // Ошибка сервера:
      setError(err.message);
    }
  };

  return (
    // Общий фон страницы:
    <div className={styles['auth-page']}>
      {/* Карточка формы входа: */}
      <Card className="auth-card">
        {/* Заголовок формы: */}
        <h1>Конструктор</h1>
        {/* Подзаголовок формы: */}
        <p className="auth-subtitle">Войдите в аккаунт</p>
        {/* Форма входа: */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Поле email: */}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {/* Поле пароля: */}
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {/* Ошибка: */}
          {error && <p className="auth-error">{error}</p>}
          {/* Кнопка отправки формы: */}
          <Button type="submit" size="lg" style={{ width: '100%' }}>
            Войти
          </Button>
        </form>
        {/* Ссылка на регистрацию: */}
        <p className="auth-link">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </Card>
    </div>
  );
}


