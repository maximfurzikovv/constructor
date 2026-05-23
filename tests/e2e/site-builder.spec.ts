import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, login } from './helpers';

// Проверяет полный путь публикации сайта:
test('author publishes the constructor page and opens the public site', async ({ page }) => {
  // Входим в админ-панель:
  await login(page);
  // Открываем конструктор сайта:
  await page.goto('/admin/showcase');

  // Проверяем, что редактор загрузился:
  await expect(page.getByText(/Секции|Элементы|Шаблоны/).first()).toBeVisible();
  // Публикуем сайт через боковую кнопку:
  await page.locator('.rail-publish-action').click();
  // Ждем всплывающее подтверждение:
  await expect(page.locator('.builder-toast')).toBeVisible({ timeout: 10_000 });

  // Открываем опубликованную страницу:
  await page.goto('/s/maxim-furzikov');
  // Проверяем, что страница открылась:
  await expect(page.locator('body')).toBeVisible();
  // Публичный сайт не должен уезжать вправо:
  await expectNoHorizontalOverflow(page);
});

// Проверяет, что режимы предпросмотра не ломают конструктор:
test('site builder switches desktop, tablet and mobile previews without crashing', async ({ page }, testInfo) => {
  // Открываем конструктор под автором:
  await login(page);
  await page.goto('/admin/showcase');

  // Проверяем, что конструктор смонтировался:
  await expect(page.locator('.constructor-layout')).toBeAttached();
  // На мобильном проекте рабочая область может быть скрыта стилями:
  const isMobileProject = testInfo.project.name.includes('mobile');
  // В desktop-проекте предпросмотр должен быть видим:
  if (!isMobileProject) {
    await expect(page.locator('.constructor-preview')).toBeVisible();
    await expect(page.locator('.preview-frame')).toBeVisible();
  }

  // Проходим по всем режимам ширины:
  for (const mode of ['Desktop', 'Tablet', 'Mobile'] as const) {
    // Берем кнопку режима:
    const button = page.getByRole('button', { name: mode }).first();
    // Кнопка должна существовать в DOM:
    await expect(button).toHaveCount(1);
    // DOM-click не зависит от временного перекрытия панелями:
    await button.evaluate((node) => (node as HTMLButtonElement).click());
    // В desktop-проекте предпросмотр не должен исчезнуть:
    if (!isMobileProject) {
      await expect(page.locator('.preview-frame')).toBeVisible();
    }
    // Страница не должна показывать runtime-ошибку:
    await expect(page.locator('body')).not.toContainText(/Cannot read|undefined is not|TypeError|ReferenceError/i);
  }
});
