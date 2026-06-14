import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';
void styles;

// Стартовая страница продукта:
export default function LandingPage() {
  return (
    // Общий экран перед авторизацией:
    <main className={styles['landing-page']}>
      {/* Центральный блок описания: */}
      <section className="landing-hero">
        <span className="landing-kicker">Веб-конструктор экскурсий</span>
        <h1>Конструктор веб-приложений для информационной поддержки индивидуальных экскурсий</h1>
        <p>
          Система помогает автору подготовить маршрут, добавить точки интереса, загрузить медиа,
          оформить свое веб-приложение и опубликовать результат для прохождения в браузере.
        </p>
        {/* Основные действия для пользователя: */}
        <div className="landing-actions">
          <Link className="landing-btn primary" to="/register">Зарегистрироваться</Link>
          <Link className="landing-btn secondary" to="/login">Войти</Link>
        </div>
      </section>

      {/* Краткое объяснение возможностей: */}
      <section className="landing-features" aria-label="Возможности системы">
        <article>
          <strong>Маршруты</strong>
          <span>Точки, карта, описание, радиус активации и порядок прохождения</span>
        </article>
        <article>
          <strong>Медиа</strong>
          <span>Изображения и аудио для сопровождения каждой точки</span>
        </article>
        <article>
          <strong>Публикация</strong>
          <span>Созданное веб-приложение и экскурсия доступны посетителю по ссылке</span>
        </article>
      </section>
    </main>
  );
}


