// Убирает опасные CSS-конструкции:
export function sanitizeCustomCss(css: string) {
  // Если CSS не строка, возвращаем пусто:
  if (typeof css !== 'string') return '';
  // Ограничиваем размер CSS:
  const trimmed = css.slice(0, 12000);
  // Удаляем импорт внешних стилей:
  const withoutImports = trimmed.replace(/@import[^;]+;/gi, '');
  // Удаляем старые опасные выражения:
  const withoutExpressions = withoutImports.replace(/expression\s*\([^)]*\)/gi, '');
  // Удаляем javascript-ссылки:
  const withoutJavascript = withoutExpressions.replace(/javascript\s*:/gi, '');
  // Удаляем html-data ссылки:
  const withoutHtmlData = withoutJavascript.replace(/data\s*:\s*text\/html/gi, '');
  // Удаляем старые браузерные биндинги:
  const withoutBindings = withoutHtmlData.replace(/-moz-binding\s*:[^;]+;/gi, '');
  // Удаляем старое IE-поведение:
  return withoutBindings.replace(/behavior\s*:[^;]+;/gi, '');
}

// Проверяет безопасный адрес:
function isSafeUrl(value: string) {
  // Пустой адрес безопасен:
  if (!value) return true;
  // Разрешаем якоря:
  if (value.startsWith('#')) return true;
  // Разрешаем относительные пути:
  if (value.startsWith('/')) return true;
  try {
    // Разбираем URL:
    const url = new URL(value);
    // Оставляем только безопасные схемы:
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    // Невалидный URL запрещаем:
    return false;
  }
}

// Чистит HTML для embed-блока:
export function sanitizeEmbedHtml(html: string) {
  // Если HTML не строка, возвращаем пусто:
  if (typeof html !== 'string') return '';
  // Ограничиваем размер вставки:
  const source = html.slice(0, 8000);
  // Парсим HTML браузером:
  const doc = new DOMParser().parseFromString(source, 'text/html');
  // Разрешенные теги:
  const allowedTags = new Set(['A', 'B', 'BR', 'DIV', 'EM', 'IFRAME', 'IMG', 'LI', 'OL', 'P', 'SPAN', 'STRONG', 'UL']);
  // Разрешенные атрибуты:
  const allowedAttrs = new Set(['alt', 'class', 'height', 'href', 'loading', 'rel', 'src', 'style', 'target', 'title', 'width']);

  // Чистим каждый узел:
  doc.body.querySelectorAll('*').forEach((node) => {
    // Удаляем запрещенный тег:
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    // Чистим атрибуты:
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      // Удаляем обработчики событий:
      if (name.startsWith('on')) node.removeAttribute(attr.name);
      // Удаляем запрещенные атрибуты:
      else if (!allowedAttrs.has(name)) node.removeAttribute(attr.name);
      // Чистим inline-style:
      else if (name === 'style') node.setAttribute(attr.name, sanitizeCustomCss(value));
      // Проверяем ссылки:
      else if ((name === 'href' || name === 'src') && !isSafeUrl(value)) node.removeAttribute(attr.name);
    });

    // Изолируем iframe:
    if (node.tagName === 'IFRAME') {
      node.setAttribute('sandbox', 'allow-same-origin allow-popups allow-forms');
      node.setAttribute('loading', 'lazy');
    }

    // Защищаем внешние ссылки:
    if (node.tagName === 'A') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });

  // Возвращаем очищенную разметку:
  return doc.body.innerHTML;
}
