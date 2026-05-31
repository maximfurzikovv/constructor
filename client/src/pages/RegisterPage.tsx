import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import './AuthPages.css';

// Страница регистрации нового пользователя:
export default function RegisterPage() {
  // navigate:
  const navigate = useNavigate();
  // Имя пользователя:
  const [name, setName] = useState('');
  // Email:
  const [email, setEmail] = useState('');
  // Пароль:
  const [password, setPassword] = useState('');
  // Повтор пароля:
  const [confirmPassword, setConfirmPassword] = useState('');
  // Текст ошибки:
  const [error, setError] = useState('');

  // Обработка отправки формы регистрации:
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Отключаем стандартную отправку браузера
    setError(''); // Очищаем прошлую ошибку
    // Проверяем совпадение паролей до запроса:
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    // Проверяем минимальную длину пароля:
    if (password.length < 8) {
      setError('Пароль должен содержать не менее 8 символов');
      return;
    }
    try {
      // Создаем пользователя через API:
      const result: any = await api.register(email.trim().toLowerCase(), password, confirmPassword, name.trim());
      // Старый браузерный токен больше не используется:
      localStorage.removeItem('token');
      // Сохраняем профиль пользователя:
      localStorage.setItem('user', JSON.stringify(result.user));
      // Переходим в админку:
      navigate('/admin');
    } catch (err: any) {
      setError(err.message); // Ошибка регистрации
    }
  };

  return (
    // Общий контейнер страницы авторизации:
    <div className="auth-page">
      {/* Карточка регистрации: */}
      <Card className="auth-card">
        {/* Заголовок формы: */}
        <h1>Конструктор</h1>
        {/* Подзаголовок формы: */}
        <p className="auth-subtitle">Создайте аккаунт</p>
        {/* Форма регистрации: */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Поле имени: */}
          <Input
            label="Имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {/* Поле email: */}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {/* Поле пароля: */}
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {/* Поле подтверждения пароля: */}
          <Input
            label="Повторите пароль"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {/* Сообщение об ошибке: */}
          {error && <p className="auth-error">{error}</p>}
          {/* Кнопка регистрации: */}
          <Button type="submit" size="lg" style={{ width: '100%' }}>
            Зарегистрироваться
          </Button>
        </form>
        {/* Ссылка на страницу входа: */}
        <p className="auth-link">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </Card>
    </div>
  );
}




