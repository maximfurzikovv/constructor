import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSiteSlug, sanitizeCustomCss, sanitizeEmbedHtml, validateConstructorPayload } from '../../server/src/siteBuilderSecurity';

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

// Проверяем очистку CSS:
test('unit site builder: sanitizeCustomCss removes dangerous rules', () => {
  // Опасный CSS:
  const css = '@import url(https://bad.test/x.css); .x { background: url(javascript:alert(1)); behavior: url(x); }';
  // Чистим CSS:
  const safe = sanitizeCustomCss(css);
  // Import должен исчезнуть:
  assert.equal(safe.includes('@import'), false);
  // javascript-схема должна исчезнуть:
  assert.equal(/javascript\s*:/i.test(safe), false);
  // behavior должен исчезнуть:
  assert.equal(/behavior\s*:/i.test(safe), false);
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
    theme: { customCss: '@import url(bad.css); .a { color: red; }' },
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
  // CSS должен быть очищен:
  assert.equal(String(payload.theme.customCss).includes('@import'), false);
  // Страница должна сохраниться:
  assert.equal(payload.pages.length, 1);
});

// Проверяем отказ на пустых страницах:
test('unit site builder: validateConstructorPayload rejects missing pages', () => {
  // Пустой payload должен упасть:
  assert.throws(() => validateConstructorPayload({ pages: [], theme: {} }, 'slug'), /Нужна хотя бы одна страница/);
});
