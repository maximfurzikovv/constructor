import sanitizeHtml from 'sanitize-html';

// Данные конструктора после проверки:
export interface SafeConstructorPayload {
  pages: unknown[];
  theme: Record<string, unknown>;
  siteSlug: string;
}

// Ошибка валидации конструктора:
export class SiteBuilderValidationError extends Error {
  // HTTP-статус ошибки:
  statusCode = 400;
}

// Приводит адрес сайта к slug:
export function normalizeSiteSlug(value: unknown, fallback: string) {
  // Если пришла не строка, берем старое значение:
  if (typeof value !== 'string') return fallback;
  // Очищаем адрес для URL:
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || fallback;
}

// Проверяет объект:
function isRecord(value: unknown): value is Record<string, unknown> {
  // Объект должен быть не null:
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Обрезает строку:
function safeString(value: unknown, max = 1000) {
  // Нестроковые значения не принимаем:
  if (typeof value !== 'string') return '';
  // Ограничиваем длину:
  return value.slice(0, max);
}

// Проверяет ссылку изображения конструктора:
function safeSiteImageUrl(value: unknown) {
  const maxLength = process.env.NODE_ENV === 'production' ? 2048 : 3_000_000; // Лимит адреса
  const url = safeString(value, maxLength); // Значение изображения
  if (!url) return '';
  if (url.startsWith('https://') || url.startsWith('/uploads/')) return url; // Внешняя ссылка
  if (process.env.NODE_ENV !== 'production' && url.startsWith('data:image/')) return url; // Fallback для тестов
  return '';
}

// Оставляет только доступные настройки темы:
function sanitizeTheme(value: unknown) {
  const theme = isRecord(value) ? value : {}; // Входная тема

  return {
    primaryColor: safeString(theme.primaryColor, 30),
    fontFamily: safeString(theme.fontFamily, 40),
    borderRadius: safeString(theme.borderRadius, 10),
    siteBg: safeString(theme.siteBg, 30),
    siteBgImage: safeSiteImageUrl(theme.siteBgImage),
    headerStyle: safeString(theme.headerStyle, 20),
    headerBg: safeString(theme.headerBg, 30),
    headerTextColor: safeString(theme.headerTextColor, 30),
    headerNavAlign: safeString(theme.headerNavAlign, 20),
    headerNavStyle: safeString(theme.headerNavStyle, 20),
    headerNavVisible: typeof theme.headerNavVisible === 'boolean' ? theme.headerNavVisible : true,
    headerNavGap: safeString(theme.headerNavGap, 10),
    logoType: safeString(theme.logoType, 20),
    logoText: safeString(theme.logoText, 120),
    logoImage: safeSiteImageUrl(theme.logoImage),
    favicon: safeSiteImageUrl(theme.favicon),
  };
}

// Чистит HTML-вставку:
export function sanitizeEmbedHtml(html: unknown) {
  // Берем только строку:
  const source = safeString(html, 8000);
  // Оставляем только безопасные теги и атрибуты:
  return sanitizeHtml(source, {
    allowedTags: ['a', 'b', 'br', 'div', 'em', 'iframe', 'img', 'li', 'ol', 'p', 'span', 'strong', 'ul'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      iframe: ['src', 'title', 'width', 'height', 'loading', 'sandbox'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      '*': ['class', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['https'],
      iframe: ['https'],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, rel: 'noopener noreferrer' },
      }),
      iframe: (_tagName, attribs) => ({
        tagName: 'iframe',
        attribs: { ...attribs, sandbox: 'allow-same-origin allow-popups allow-forms', loading: 'lazy' },
      }),
    },
  });
}

// Чистит элемент конструктора:
function sanitizeElement(element: unknown) {
  // Элемент должен быть объектом:
  if (!isRecord(element)) return null;
  // Копируем элемент:
  const next = { ...element };
  // Данные элемента:
  const data = isRecord(next.data) ? { ...next.data } : {};
  // Embed хранит HTML:
  if (next.type === 'embed') {
    data.code = sanitizeEmbedHtml(data.code);
  }
  // Изображение хранит URL загруженного файла:
  if (next.type === 'image') {
    data.src = safeSiteImageUrl(data.src);
  }
  // Галерея хранит только доступные URL:
  if (next.type === 'gallery') {
    const images = Array.isArray(data.images) ? data.images : [];
    data.images = images.slice(0, 30).map(safeSiteImageUrl).filter(Boolean);
  }
  // Стили элемента:
  if (isRecord(next.style)) next.style = { ...next.style };
  // Возвращаем безопасный элемент:
  return { ...next, data };
}

// Чистит колонку:
function sanitizeColumn(column: unknown) {
  // Колонка должна быть объектом:
  if (!isRecord(column)) return null;
  // Берем элементы:
  const elements = Array.isArray(column.elements) ? column.elements : [];
  // Ограничиваем число элементов:
  const safeElements = elements.slice(0, 80).map(sanitizeElement).filter(Boolean);
  // Возвращаем колонку:
  return { ...column, elements: safeElements };
}

// Чистит секцию:
function sanitizeSection(section: unknown) {
  // Секция должна быть объектом:
  if (!isRecord(section)) return null;
  // Берем колонки:
  const columns = Array.isArray(section.columns) ? section.columns : [];
  // Ограничиваем число колонок:
  const safeColumns = columns.slice(0, 6).map(sanitizeColumn).filter(Boolean);
  // Возвращаем секцию:
  return { ...section, columns: safeColumns };
}

// Чистит страницу:
function sanitizePage(page: unknown) {
  // Страница должна быть объектом:
  if (!isRecord(page)) return null;
  // Берем секции:
  const sections = Array.isArray(page.sections) ? page.sections : [];
  // Возвращаем страницу:
  return {
    ...page,
    title: safeString(page.title, 120) || 'Страница',
    slug: safeString(page.slug, 80),
    sections: sections.slice(0, 80).map(sanitizeSection).filter(Boolean),
  };
}

// Проверяет payload конструктора:
export function validateConstructorPayload(body: unknown, slug: string): SafeConstructorPayload {
  // Тело должно быть объектом:
  if (!isRecord(body)) throw new SiteBuilderValidationError('Некорректные данные конструктора');
  // Страницы обязательны:
  if (!Array.isArray(body.pages)) throw new SiteBuilderValidationError('В конструкторе нет страниц');
  // Берем только настройки, которые доступны в интерфейсе:
  const theme = sanitizeTheme(body.theme);
  // Чистим страницы:
  const pages = body.pages.slice(0, 20).map(sanitizePage).filter(Boolean);
  // Нужна хотя бы одна страница:
  if (pages.length === 0) throw new SiteBuilderValidationError('Нужна хотя бы одна страница');
  // Возвращаем безопасные данные:
  return {
    pages,
    theme,
    siteSlug: slug,
  };
}
