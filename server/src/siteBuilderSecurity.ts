// Данные конструктора после проверки:
export interface SafeConstructorPayload {
  pages: unknown[];
  theme: Record<string, unknown>;
  siteSlug: string;
  version?: number;
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

// Чистит пользовательский CSS:
export function sanitizeCustomCss(css: unknown) {
  // Берем только строку:
  const source = safeString(css, 12000);
  // Удаляем внешние импорты:
  const withoutImports = source.replace(/@import[^;]+;/gi, '');
  // Удаляем expression:
  const withoutExpressions = withoutImports.replace(/expression\s*\([^)]*\)/gi, '');
  // Удаляем javascript-схемы:
  const withoutJavascript = withoutExpressions.replace(/javascript\s*:/gi, '');
  // Удаляем html-data:
  const withoutHtmlData = withoutJavascript.replace(/data\s*:\s*text\/html/gi, '');
  // Удаляем старые биндинги:
  const withoutBindings = withoutHtmlData.replace(/-moz-binding\s*:[^;]+;/gi, '');
  // Удаляем IE behavior:
  return withoutBindings.replace(/behavior\s*:[^;]+;/gi, '');
}

// Чистит HTML-вставку:
export function sanitizeEmbedHtml(html: unknown) {
  // Берем только строку:
  const source = safeString(html, 8000);
  // Удаляем script:
  const withoutScripts = source.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  // Удаляем обработчики событий:
  const withoutEvents = withoutScripts.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');
  // Удаляем javascript-ссылки:
  const withoutJavascript = withoutEvents.replace(/javascript\s*:/gi, '');
  // Удаляем html-data ссылки:
  return withoutJavascript.replace(/data\s*:\s*text\/html/gi, '');
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
  // Берем тему:
  const theme = isRecord(body.theme) ? { ...body.theme } : {};
  // Чистим CSS:
  theme.customCss = sanitizeCustomCss(theme.customCss);
  // Чистим страницы:
  const pages = body.pages.slice(0, 20).map(sanitizePage).filter(Boolean);
  // Нужна хотя бы одна страница:
  if (pages.length === 0) throw new SiteBuilderValidationError('Нужна хотя бы одна страница');
  // Возвращаем безопасные данные:
  return {
    pages,
    theme,
    siteSlug: slug,
    version: typeof body.version === 'number' ? body.version : undefined,
  };
}
