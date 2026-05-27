import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSiteSlug, sanitizeEmbedHtml, validateConstructorPayload } from '../../server/src/siteBuilderSecurity';

// Проверяем нормализацию slug:
test('unit site builder: normalizeSiteSlug keeps URL-safe value', () => {
  // Нормализуем пользовательский адрес:
  const slug = normalizeSiteSlug(' My Cool Site!! ', 'fallback');
  // Получаем безопасный slug:
  assert.equal(slug, 'my-cool-site');
});

// Проверяем fallback slug:
test('unit site builder: normalizeSiteSlug uses fallback for empty value', () => {
  // Передаем пустую строку:
  const slug = normalizeSiteSlug('!!!', 'fallback-site');
  // Получаем старое значение:
  assert.equal(slug, 'fallback-site');
});

// Проверяем очистку embed:
test('unit site builder: sanitizeEmbedHtml removes scripts and event handlers', () => {
  // Опасный HTML:
  const html = '<div onclick="alert(1)">Text<script>alert(1)</script><a href="javascript:alert(1)">link</a></div>';
  // Чистим HTML:
  const safe = sanitizeEmbedHtml(html);
  // Script должен исчезнуть:
  assert.equal(/<script/i.test(safe), false);
  // onclick должен исчезнуть:
  assert.equal(/onclick/i.test(safe), false);
  // javascript-ссылка должна исчезнуть:
  assert.equal(/javascript\s*:/i.test(safe), false);
});

// Проверяем payload конструктора:
test('unit site builder: validateConstructorPayload accepts and cleans constructor data', () => {
  // Payload конструктора:
  const payload = validateConstructorPayload({
    siteSlug: 'bad value',
    theme: { primaryColor: '#2563eb', logoImage: 'https://res.cloudinary.com/demo/logo.jpg', unsupportedSetting: 'remove-me' },
    pages: [
      {
        id: 'page-main',
        title: 'Главная',
        slug: '',
        sections: [
          {
            id: 'section-1',
            columns: [
              {
                id: 'column-1',
                elements: [
                  { id: 'embed-1', type: 'embed', data: { code: '<script>alert(1)</script><p>ok</p>' }, style: {} },
                  { id: 'image-1', type: 'image', data: { src: 'https://res.cloudinary.com/demo/photo.jpg' }, style: {} },
                ],
              },
            ],
          },
        ],
      },
    ],
  }, 'safe-slug');

  // Slug задается нормализатором снаружи:
  assert.equal(payload.siteSlug, 'safe-slug');
  // Неизвестная настройка темы не сохраняется:
  assert.equal(payload.theme.unsupportedSetting, undefined);
  // URL изображения темы сохраняется:
  assert.equal(payload.theme.logoImage, 'https://res.cloudinary.com/demo/logo.jpg');
  // Страница должна сохраниться:
  assert.equal(payload.pages.length, 1);
});

// Проверяем отказ на пустых страницах:
test('unit site builder: validateConstructorPayload rejects missing pages', () => {
  // Пустой payload должен упасть:
  assert.throws(() => validateConstructorPayload({ pages: [], theme: {} }, 'slug'), /Нужна хотя бы одна страница/);
});

// Проверяем отказ от Base64 в опубликованном окружении:
test('unit site builder: production payload keeps only external image URLs', () => {
  const previousEnvironment = process.env.NODE_ENV; // Старое окружение
  process.env.NODE_ENV = 'production';

  try {
    const payload: any = validateConstructorPayload({
      theme: { logoImage: 'data:image/png;base64,logo' },
      pages: [{
        id: 'page-main',
        title: 'Главная',
        slug: '',
        sections: [{
          columns: [{
            elements: [{ id: 'image-1', type: 'image', data: { src: 'data:image/png;base64,photo' } }],
          }],
        }],
      }],
    }, 'public-site');

    assert.equal(payload.theme.logoImage, '');
    assert.equal(payload.pages[0].sections[0].columns[0].elements[0].data.src, '');
  } finally {
    if (typeof previousEnvironment === 'string') process.env.NODE_ENV = previousEnvironment;
    else delete process.env.NODE_ENV;
  }
});
