import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { api } from '../../api/client';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import './SiteBuilderPage.css';

// Режим предпросмотра страницы:
type ViewportMode = 'desktop' | 'tablet' | 'mobile';
// Вкладка левой панели конструктора:
type BuilderTab = 'sections' | 'elements' | 'templates' | 'pages' | 'theme';
// Схема колонок внутри секции:
type SectionLayout = '1' | '2' | '3' | '4' | 'asym-left' | 'asym-right';
// Тип элемента, который можно добавить в колонку:
type ElementType =
  | 'heading'
  | 'text'
  | 'button'
  | 'backButton'
  | 'image'
  | 'gallery'
  | 'video'
  | 'divider'
  | 'spacer'
  | 'box'
  | 'list'
  | 'social'
  | 'menu'
  | 'form'
  | 'map'
  | 'embed'
  | 'tours'
  | 'contacts';

// Общие стили секции, колонки или элемента:
interface BuilderStyle {
  background?: string;
  color?: string;
  padding?: number;
  margin?: number;
  radius?: number;
  borderColor?: string;
  borderWidth?: number;
  shadow?: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  width?: number;
}

// Один визуальный элемент конструктора:
interface BuilderElement {
  id: string;
  type: ElementType;
  data: Record<string, any>;
  style: BuilderStyle;
}

// Колонка внутри секции:
interface BuilderColumn {
  id: string;
  width: number;
  elements: BuilderElement[];
  style: BuilderStyle;
}

// Секция страницы с набором колонок:
interface BuilderSection {
  id: string;
  layout: SectionLayout;
  columns: BuilderColumn[];
  style: BuilderStyle;
}

// Страница опубликованного сайта:
interface BuilderPage {
  id: string;
  title: string;
  slug: string;
  sections: BuilderSection[];
}

// Данные, скопированные внутри конструктора:
type BuilderClipboard =
  | { type: 'section'; section: BuilderSection }
  | { type: 'element'; element: BuilderElement }
  | null;

// Глобальные настройки оформления сайта:
interface ThemeConfig {
  primaryColor: string;
  fontFamily: string;
  borderRadius: string;
  siteBg: string;
  siteBgImage: string;
  customCss: string;
  headerStyle: 'light' | 'dark';
  headerBg: string;
  headerTextColor: string;
  headerNavAlign: 'left' | 'center' | 'right';
  headerNavStyle: 'links' | 'pills' | 'underline';
  headerNavVisible: boolean;
  headerNavGap: string;
  logoType: 'text' | 'image';
  logoText: string;
  logoImage: string;
  favicon: string;
}

// Текущий выбранный объект на холсте:
type Selection =
  | { type: 'header' }
  | { type: 'section'; sectionId: string }
  | { type: 'column'; sectionId: string; columnId: string }
  | { type: 'element'; sectionId: string; columnId: string; elementId: string };

// Найденный выбранный объект с полными данными:
type BuilderSelected =
  | { kind: 'header' }
  | { kind: 'section'; section: BuilderSection }
  | { kind: 'column'; section: BuilderSection; column: BuilderColumn }
  | { kind: 'element'; section: BuilderSection; column: BuilderColumn; element: BuilderElement };

// Значения темы по умолчанию:
const defaultTheme: ThemeConfig = {
  primaryColor: '#2563eb',
  fontFamily: 'system',
  borderRadius: '8',
  siteBg: '#ffffff',
  siteBgImage: '',
  customCss: '',
  headerStyle: 'light',
  headerBg: '#ffffff',
  headerTextColor: '#0f172a',
  headerNavAlign: 'right',
  headerNavStyle: 'links',
  headerNavVisible: true,
  headerNavGap: '16',
  logoType: 'text',
  logoText: '',
  logoImage: '',
  favicon: '',
};

// Доступные сетки секций:
const sectionLayouts: Record<SectionLayout, { label: string; widths: number[] }> = {
  '1': { label: '1 колонка', widths: [100] },
  '2': { label: '2 колонки', widths: [50, 50] },
  '3': { label: '3 колонки', widths: [33, 34, 33] },
  '4': { label: '4 колонки', widths: [25, 25, 25, 25] },
  'asym-left': { label: 'Асимметрия 70/30', widths: [70, 30] },
  'asym-right': { label: 'Асимметрия 30/70', widths: [30, 70] },
};

// Подписи и значки элементов в панели:
const elementLabels: Record<ElementType, { label: string; icon: string }> = {
  heading: { label: 'Заголовок', icon: '🔠' },
  text: { label: 'Текст', icon: '📝' },
  button: { label: 'Кнопка', icon: '🔘' },
  backButton: { label: 'Назад', icon: '↩️' },
  image: { label: 'Изображение', icon: '🖼️' },
  gallery: { label: 'Галерея', icon: '🖼️' },
  video: { label: 'Видео', icon: '🎬' },
  divider: { label: 'Линия', icon: '➖' },
  spacer: { label: 'Отступ', icon: '↕️' },
  box: { label: 'Бокс', icon: '⬜' },
  list: { label: 'Список', icon: '📋' },
  social: { label: 'Соцсети', icon: '#️⃣' },
  menu: { label: 'Меню/якорь', icon: '☰' },
  form: { label: 'Форма', icon: '✍️' },
  map: { label: 'Карта', icon: '🗺️' },
  embed: { label: 'Код', icon: '💻' },
  tours: { label: 'Экскурсии', icon: '🧭' },
  contacts: { label: 'Контакты', icon: '📨' },
};

// Группировка элементов в каталоге:
const elementGroups: { title: string; items: ElementType[] }[] = [
  { title: 'Базовые', items: ['heading', 'text', 'button', 'backButton', 'divider', 'spacer', 'box'] },
  { title: 'Медиа', items: ['image', 'gallery', 'video'] },
  { title: 'Структура', items: ['menu', 'list', 'embed'] },
  { title: 'Бизнес', items: ['tours', 'contacts', 'form', 'map', 'social'] },
];

// Быстрый список поддерживаемых элементов:
const supportedElementTypes = new Set<ElementType>(Object.keys(elementLabels) as ElementType[]);

// Готовые шаблонные секции:
const sectionTemplateGroups = [
  { title: 'Приветствие', items: ['hero-split', 'hero-center'] },
  { title: 'О нас', items: ['about-photo', 'features'] },
  { title: 'Контакты', items: ['contacts-strip', 'contacts-form'] },
  { title: 'Продажи', items: ['services', 'reviews', 'cta'] },
] as const;

// Возвращает название шаблона секции:
function templateLabel(template: string) {
  const labels: Record<string, string> = {
    'hero-split': 'Hero с изображением',
    'hero-center': 'Центральный hero',
    'about-photo': 'О нас с фото',
    features: 'Преимущества',
    'contacts-strip': 'Контакты полосой',
    'contacts-form': 'Контакты + форма',
    services: 'Услуги',
    reviews: 'Отзывы',
    cta: 'Призыв к действию',
  };
  return labels[template] || template;
}

// Возвращает короткое описание шаблона:
function templateDescription(template: string) {
  const descriptions: Record<string, string> = {
    'hero-split': 'Заголовок, текст, кнопка и крупное изображение',
    'hero-center': 'Центральный первый экран для промо',
    'about-photo': 'Фото, описание и список преимуществ',
    features: 'Три карточки преимуществ или фактов',
    'contacts-strip': 'Короткая контактная полоса',
    'contacts-form': 'Контакты рядом с формой заявки',
    services: 'Три услуги с описаниями',
    reviews: 'Карточки отзывов с аккуратной сеткой',
    cta: 'Финальный призыв к действию',
  };
  return descriptions[template] || 'Готовая секция';
}
// Формирует резервный embed-адрес карты:
function getMapEmbedUrl(data: Record<string, any>) {
  if (data.embedUrl) return data.embedUrl;
  const lat = Number(data.lat) || 59.939;
  const lng = Number(data.lng) || 30.316;
  const delta = 0.018;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

// Приводит ссылку на видео к embed-формату:
function normalizeVideoUrl(url: string) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.includes('youtube.com/embed/') || value.includes('player.vimeo.com/video/')) return value;

  const youtubeMatch = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (youtubeMatch?.[1]) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;

  const vimeoMatch = value.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch?.[1]) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return value;
}

// Обновляет центр карты при изменении настроек:
function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);
  return null;
}

// Отображает Leaflet-карту внутри конструктора:
function BuilderLeafletMap({ data, preview = false }: { data: Record<string, any>; preview?: boolean }) {
  // Координаты берутся из настроек элемента карты:
  const center: [number, number] = [Number(data.lat) || 59.939, Number(data.lng) || 30.316];
  // Масштаб карты хранится вместе с элементом:
  const zoom = Number(data.zoom) || 13;

  return (
    <div className={`builder-leaflet-map ${preview ? 'preview-map' : ''}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={!preview}
        dragging={!preview}
        doubleClickZoom={!preview}
        zoomControl={!preview}
        attributionControl={false}
      >
        <MapViewUpdater center={center} zoom={zoom} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={center} />
      </MapContainer>
      {data.address && <span className="b-el-map-label">{data.address}</span>}
    </div>
  );
}

// Таблица символов нужна для восстановления битых русских строк:
const CP1251_CHARS =
  '\u0402\u0403\u201a\u0453\u201e\u2026\u2020\u2021\u20ac\u2030\u0409\u2039\u040a\u040c\u040b\u040f' +
  '\u0452\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u0098\u2122\u0459\u203a\u045a\u045c\u045b\u045f' +
  '\u00a0\u040e\u045e\u0408\u00a4\u0490\u00a6\u00a7\u0401\u00a9\u0404\u00ab\u00ac\u00ad\u00ae\u0407' +
  '\u00b0\u00b1\u0406\u0456\u0491\u00b5\u00b6\u00b7\u0451\u2116\u0454\u00bb\u0458\u0405\u0455\u0457' +
  '\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041a\u041b\u041c\u041d\u041e\u041f' +
  '\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042a\u042b\u042c\u042d\u042e\u042f' +
  '\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043a\u043b\u043c\u043d\u043e\u043f' +
  '\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044a\u044b\u044c\u044d\u044e\u044f';

// Проверяет, похожа ли строка на испорченную кодировку:
function looksBrokenText(value: string) {
  return /[\u00d0\u00d1\u0420]/.test(value) && /[\u00d0\u00d1\u0420][\u0080-\uFFFF]/.test(value);
}

// Оценивает, насколько строка похожа на нормальный русский текст:
function scoreRussianText(value: string) {
  const russian = (value.match(/[\u0401\u0451\u0410-\u044f]/g) || []).length;
  const broken = (value.match(/[\u00d0\u00d1\u0420][\u0080-\uFFFF]?/g) || []).length;
  return russian - broken * 2;
}

// Пробует декодировать набор байтов как UTF-8:
function decodeBytesAsUtf8(bytes: number[]) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return '';
  }
}

// Пытается восстановить испорченный текст:
function repairMojibakeText(value: string) {
  if (!looksBrokenText(value)) return value;
  let current = value;

  for (let attempt = 0; attempt < 3; attempt++) {
    const latin1Bytes = Array.from(current, (char) => char.charCodeAt(0) & 0xff);
    const cp1251Bytes = Array.from(current, (char) => {
      const code = char.charCodeAt(0);
      if (code < 128) return code;
      const index = CP1251_CHARS.indexOf(char);
      return index >= 0 ? 0x80 + index : code & 0xff;
    });
    const variants = [decodeBytesAsUtf8(latin1Bytes), decodeBytesAsUtf8(cp1251Bytes)].filter(Boolean);
    const best = variants.sort((a, b) => scoreRussianText(b) - scoreRussianText(a))[0];
    if (!best || scoreRussianText(best) <= scoreRussianText(current)) break;
    current = best;
  }

  return current;
}

// Исправляет видимый текст внутри DOM-узла:
function repairVisibleMojibake(root: HTMLElement | null) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const fixed = repairMojibakeText(node.nodeValue || '');
    if (fixed !== node.nodeValue) node.nodeValue = fixed;
  });
}

// Нормализует подписи и иконки интерфейса конструктора:
function normalizeBuilderChrome(root: HTMLElement | null, activePage: BuilderPage, tab: BuilderTab, rightPanelOpen: boolean) {
  if (!root) return;

  const tabLabels: Array<[string, string]> = [
    ['🧩', 'Секции'],
    ['➕', 'Элементы'],
    ['🖼️', 'Шаблоны'],
    ['📄', 'Страницы'],
    ['🎨', 'Тема'],
  ];
  root.querySelectorAll<HTMLButtonElement>('.constructor-tabs .ctab').forEach((button, index) => {
    const [icon, label] = tabLabels[index] || ['', ''];
    const iconNode = button.querySelector<HTMLElement>('.ctab-icon');
    if (iconNode) iconNode.textContent = icon;
    Array.from(button.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .forEach((node) => node.remove());
    button.append(document.createTextNode(label));
  });

  const title = root.querySelector<HTMLElement>('.constructor-left-header h3');
  if (title) title.textContent = 'Конструктор сайта';

  const panelToggle = root.querySelector<HTMLButtonElement>('.panel-toggle-btn');
  if (panelToggle) {
    panelToggle.textContent = '<';
    panelToggle.title = 'Скрыть панель конструктора';
  }

  root.querySelectorAll<HTMLElement>('.block-icon').forEach((icon, index) => {
    icon.textContent = index === 0 ? 'H' : '::';
  });

  const blockLabels = root.querySelectorAll<HTMLElement>('.block-list-item .block-label');
  if (blockLabels[0]) blockLabels[0].textContent = 'Шапка сайта';
  activePage.sections.forEach((section, index) => {
    const label = blockLabels[index + 1];
    if (label) label.textContent = `Секция ${index + 1} · ${sectionLayouts[section.layout].label}`;
  });

  root.querySelectorAll<HTMLButtonElement>('.block-action-btn.danger').forEach((button) => {
    button.textContent = 'x';
    button.title = 'Удалить';
  });

  const panelLabels = root.querySelectorAll<HTMLElement>('.constructor-panel .panel-label');
  if (tab === 'sections') {
    if (panelLabels[0]) panelLabels[0].textContent = `Секции страницы "${activePage.title}"`;
    if (panelLabels[1]) panelLabels[1].textContent = 'Добавить секцию';
  }
  if (tab === 'templates' && panelLabels[0]) panelLabels[0].textContent = 'Готовые секции';
  if (tab === 'elements') {
    if (panelLabels[0]) panelLabels[0].textContent = 'Добавить в выбранную колонку';
    const hint = root.querySelector<HTMLElement>('.panel-hint');
    if (hint) hint.textContent = 'Элементы можно переносить между колонками прямо в предпросмотре';
  }
  if (tab === 'pages' && panelLabels[0]) panelLabels[0].textContent = 'Страницы сайта';

  const historyButtons = root.querySelectorAll<HTMLButtonElement>('.history-actions button');
  if (historyButtons[0]) {
    historyButtons[0].textContent = '↶';
    historyButtons[0].title = 'Отменить';
    historyButtons[0].setAttribute('aria-label', 'Отменить');
  }
  if (historyButtons[1]) {
    historyButtons[1].textContent = '↷';
    historyButtons[1].title = 'Вернуть';
    historyButtons[1].setAttribute('aria-label', 'Вернуть');
  }

  const workspaceButtons = root.querySelectorAll<HTMLButtonElement>('.workspace-panel-btn');
  workspaceButtons.forEach((button) => {
    const inToolbar = button.closest('.preview-toolbar');
    if (!inToolbar) return;
    button.textContent = rightPanelOpen ? '>' : '<';
    button.title = rightPanelOpen ? 'Скрыть свойства' : 'Показать свойства';
  });
}
// Генерирует уникальный id для страниц, секций и элементов:
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Клонирует элемент с новым id:
function cloneElement(element: BuilderElement): BuilderElement {
  return {
    ...element,
    id: uid('element'),
    data: { ...element.data },
    style: { ...element.style },
  };
}

// Клонирует колонку с новыми id:
function cloneColumn(column: BuilderColumn): BuilderColumn {
  return {
    ...column,
    id: uid('column'),
    style: { ...column.style },
    elements: column.elements.map(cloneElement),
  };
}

// Клонирует секцию с новыми id:
function cloneSection(section: BuilderSection): BuilderSection {
  return {
    ...section,
    id: uid('section'),
    style: { ...section.style },
    columns: section.columns.map(cloneColumn),
  };
}

// Ключ черновика в браузере:
const LOCAL_DRAFT_KEY = 'site-builder-local-draft';

// Ключ истории в браузере:
const LOCAL_HISTORY_KEY = 'site-builder-local-history';

// Возвращает id текущего пользователя для локального черновика:
function getCurrentStorageUserId() {
  try {
    const user = JSON.parse(window.localStorage.getItem('user') || '{}'); // Пользователь из браузера
    return user.id || user.email || 'guest'; // Безопасный ключ
  } catch {
    return 'guest'; // Запасной ключ
  }
}

// Безопасно записывает значение в localStorage:
function safeSetLocalStorage(key: string, value: string, cleanupKey?: string) {
  try {
    window.localStorage.setItem(key, value); // Обычная запись
  } catch (error: any) {
    if (error?.name !== 'QuotaExceededError') return; // Игнорируем не связанную ошибку
    if (cleanupKey) window.localStorage.removeItem(cleanupKey); // Удаляем тяжелую историю
    try {
      window.localStorage.setItem(key, value); // Повторная запись после очистки
    } catch {
      console.warn('Черновик слишком большой для localStorage'); // Диагностика лимита браузера
    }
  }
}

// Читает файл как data URL для фоновых изображений:
function fileToDataUrl(file: File): Promise<string> {
  // Сжимаем крупные изображения перед сохранением в JSON:
  if (file.type.startsWith('image/') && file.type !== 'image/gif' && file.size > 350_000) {
    return compressImageToDataUrl(file);
  }

  return readFileAsDataUrl(file);
}

// Читает файл без обработки:
function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Сжимает изображение через canvas:
async function compressImageToDataUrl(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file); // Исходное изображение
    const maxSide = 1600; // Максимальная сторона
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height)); // Коэффициент сжатия
    const width = Math.max(1, Math.round(bitmap.width * scale)); // Новая ширина
    const height = Math.max(1, Math.round(bitmap.height * scale)); // Новая высота
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d'); // Контекст рисования
    if (!context) return readFileAsDataUrl(file);

    context.drawImage(bitmap, 0, 0, width, height); // Уменьшенное изображение
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.78); // JPEG с умеренным качеством
    });

    return blob ? readFileAsDataUrl(blob) : readFileAsDataUrl(file);
  } catch {
    return readFileAsDataUrl(file); // Если браузер не смог сжать файл
  }
}

// Создает элемент конструктора с начальными данными:
function createElement(type: ElementType): BuilderElement {
  const defaults: Record<ElementType, BuilderElement> = {
    heading: {
      id: uid('element'),
      type,
      data: { text: 'Новый заголовок', level: 'h2' },
      style: { padding: 0, margin: 8, fontSize: 28, align: 'left', color: '#0f172a', width: 100 },
    },
    text: {
      id: uid('element'),
      type,
      data: { text: 'Добавьте описание, историю или полезную информацию для посетителей сайта.' },
      style: { padding: 0, margin: 8, fontSize: 15, align: 'left', color: '#475569', width: 100 },
    },
    button: {
      id: uid('element'),
      type,
      data: { text: 'Подробнее', href: '#', variant: 'filled' },
      style: { padding: 12, margin: 8, radius: 8, align: 'left', width: 40 },
    },
    backButton: {
      id: uid('element'),
      type,
      data: { text: 'Назад', mode: 'history', href: '/' },
      style: { padding: 10, margin: 8, radius: 8, align: 'left', width: 32 },
    },
    image: {
      id: uid('element'),
      type,
      data: { src: '', alt: '', fit: 'cover' },
      style: { padding: 0, margin: 8, radius: 12, width: 100 },
    },
    gallery: {
      id: uid('element'),
      type,
      data: { images: [], columns: 3 },
      style: { padding: 0, margin: 8, radius: 10, width: 100 },
    },
    video: {
      id: uid('element'),
      type,
      data: { url: '', title: 'Видео' },
      style: { padding: 0, margin: 8, radius: 12, width: 100 },
    },
    divider: {
      id: uid('element'),
      type,
      data: { thickness: 1, lineStyle: 'solid' },
      style: { margin: 16, borderColor: '#e2e8f0', width: 100 },
    },
    spacer: {
      id: uid('element'),
      type,
      data: { height: 40 },
      style: { margin: 0, width: 100 },
    },
    box: {
      id: uid('element'),
      type,
      data: { text: 'Контейнер для акцента, карточки или заметки' },
      style: { padding: 20, margin: 8, radius: 12, background: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', width: 100 },
    },
    list: {
      id: uid('element'),
      type,
      data: { heading: 'Список', items: ['Первый пункт', 'Второй пункт', 'Третий пункт'], ordered: false },
      style: { padding: 0, margin: 8, width: 100 },
    },
    social: {
      id: uid('element'),
      type,
      data: { instagram: '', facebook: '', vk: '', telegram: '', youtube: '', style: 'filled' },
      style: { padding: 0, margin: 8, align: 'left', width: 100 },
    },
    menu: {
      id: uid('element'),
      type,
      data: { anchor: 'section', label: 'Якорь секции' },
      style: { padding: 8, margin: 8, background: '#eef2ff', radius: 8, width: 60 },
    },
    form: {
      id: uid('element'),
      type,
      data: { heading: 'Оставить заявку', fields: ['Имя', 'Email', 'Сообщение'], buttonText: 'Отправить' },
      style: { padding: 20, margin: 8, radius: 12, background: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', width: 100 },
    },
    map: {
      id: uid('element'),
      type,
      data: { address: 'Санкт-Петербург', lat: 59.939, lng: 30.316, zoom: 13, embedUrl: '' },
      style: { padding: 0, margin: 8, radius: 12, width: 100 },
    },
    embed: {
      id: uid('element'),
      type,
      data: { code: '<div>HTML-код</div>' },
      style: { padding: 16, margin: 8, background: '#0f172a', color: '#ffffff', radius: 8, width: 100 },
    },
    tours: {
      id: uid('element'),
      type,
      data: { heading: 'Доступные экскурсии', columns: 2, selectedTourIds: [] },
      style: { padding: 0, margin: 8, width: 100 },
    },
    contacts: {
      id: uid('element'),
      type,
      data: { heading: 'Связаться со мной', email: '', phone: '', telegram: '', address: '' },
      style: { padding: 0, margin: 8, width: 100 },
    },
  };
  return defaults[type];
}

// Создает пустую секцию с выбранной сеткой:
function createSection(layout: SectionLayout = '1'): BuilderSection {
  return {
    id: uid('section'),
    layout,
    columns: sectionLayouts[layout].widths.map((width) => ({
      id: uid('column'),
      width,
      elements: [],
      style: { padding: 12, background: 'transparent', radius: 8 },
    })),
    style: { padding: 32, margin: 0, background: '#ffffff', radius: 0, borderWidth: 0, borderColor: '#e2e8f0', shadow: 'none' },
  };
}

// Создает готовую секцию по шаблону:
function createSectionTemplate(template: string): BuilderSection {
  if (template === 'hero-split') {
    const section = createSection('2');
    section.style = { ...section.style, background: '#f8fafc', padding: 48 };
    section.columns[0].elements = [
      { ...createElement('heading'), data: { text: 'Новая экскурсия по городу', level: 'h1' }, style: { padding: 0, margin: 8, fontSize: 40, align: 'left', color: '#0f172a', width: 100 } },
      { ...createElement('text'), data: { text: 'Расскажите, чем уникален ваш маршрут, кому он подходит и почему его стоит пройти.' } },
      { ...createElement('button'), data: { text: 'Выбрать маршрут', href: '#tours', variant: 'filled' } },
    ];
    section.columns[1].elements = [{ ...createElement('image'), style: { padding: 0, margin: 8, radius: 18, width: 100 } }];
    return section;
  }
  if (template === 'hero-center') {
    const section = createSection('1');
    section.style = { ...section.style, background: '#0f172a', color: '#ffffff', padding: 64 };
    section.columns[0].elements = [
      { ...createElement('heading'), data: { text: 'Авторские маршруты рядом с вами', level: 'h1' }, style: { padding: 0, margin: 8, fontSize: 42, align: 'center', color: '#ffffff', width: 100 } },
      { ...createElement('text'), data: { text: 'Индивидуальные экскурсии с картой, точками интереса и мультимедийным сопровождением.' }, style: { padding: 0, margin: 8, fontSize: 17, align: 'center', color: '#cbd5e1', width: 100 } },
      { ...createElement('button'), data: { text: 'Начать', href: '#tours', variant: 'outline' }, style: { padding: 12, margin: 8, radius: 999, align: 'center', width: 28 } },
    ];
    return section;
  }
  if (template === 'about-photo') {
    const section = createSection('2');
    section.columns[0].elements = [{ ...createElement('image'), style: { padding: 0, margin: 8, radius: 16, width: 100 } }];
    section.columns[1].elements = [
      { ...createElement('heading'), data: { text: 'О проекте', level: 'h2' } },
      { ...createElement('text'), data: { text: 'Добавьте информацию об авторе, опыте, подходе к экскурсиям и особенностях маршрутов.' } },
      { ...createElement('list'), data: { heading: 'Преимущества', items: ['Самостоятельное прохождение', 'Медиа в точках маршрута', 'Удобный веб-плеер'], ordered: false } },
    ];
    return section;
  }
  if (template === 'features') {
    const section = createSection('3');
    section.columns.forEach((column, index) => {
      column.elements = [
        { ...createElement('box'), data: { text: ['Геолокация', 'Мультимедиа', 'Публикация'][index] }, style: { padding: 22, margin: 8, radius: 14, background: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', width: 100 } },
      ];
    });
    return section;
  }
  if (template === 'contacts-strip') {
    const section = createSection('3');
    section.style = { ...section.style, background: '#f8fafc', padding: 28 };
    section.columns[0].elements = [{ ...createElement('box'), data: { text: 'Адрес\\nСанкт-Петербург' } }];
    section.columns[1].elements = [{ ...createElement('box'), data: { text: 'Email\nexample@mail.ru' } }];
    section.columns[2].elements = [{ ...createElement('social') }];
    return section;
  }
  if (template === 'contacts-form') {
    const section = createSection('2');
    section.columns[0].elements = [{ ...createElement('contacts') }];
    section.columns[1].elements = [{ ...createElement('form') }];
    return section;
  }
  if (template === 'services') {
    const section = createSection('3');
    section.columns.forEach((column, index) => {
      column.elements = [
        { ...createElement('heading'), data: { text: ['Городские прогулки', 'Музейные маршруты', 'Семейные экскурсии'][index], level: 'h3' }, style: { padding: 0, margin: 8, fontSize: 20, width: 100 } },
        { ...createElement('text'), data: { text: 'Кратко опишите услугу, формат и ценность для посетителя.' } },
      ];
    });
    return section;
  }
  if (template === 'reviews') {
    const section = createSection('3');
    section.style = { ...section.style, background: '#f8fafc', padding: 44 };
    section.columns.forEach((column, index) => {
      const names = ['Анна Смирнова', 'Илья Морозов', 'Екатерина Лебедева'];
      const texts = [
        'Маршрут получился живым: карта вела понятно, а истории в точках добавляли контекст.',
        'Удобно идти в своем темпе. Особенно понравились медиа и короткие подсказки.',
        'Хороший формат для прогулки по городу: не надо искать информацию отдельно.',
      ];
      column.elements = [{
        ...createElement('box'),
        data: { text: `в…в…в…в…в…\n${texts[index]}\n${names[index]}` },
        style: { padding: 24, margin: 8, radius: 14, background: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', shadow: '0 8px 24px rgba(15,23,42,0.12)', width: 100 },
      }];
    });
    return section;
  }
  const section = createSection('1');
  section.style = { ...section.style, background: '#eef2ff', padding: 40 };
  section.columns[0].elements = [
    { ...createElement('heading'), data: { text: 'Готовы начать?', level: 'h2' }, style: { padding: 0, margin: 8, fontSize: 30, align: 'center', width: 100 } },
    { ...createElement('button'), data: { text: 'Связаться', href: '#contacts', variant: 'filled' }, style: { padding: 12, margin: 8, radius: 10, align: 'center', width: 24 } },
  ];
  return section;
}

// Формирует стартовую структуру страниц:
function getInitialPages(): BuilderPage[] {
  const hero = createSection('2');
  hero.style = { ...hero.style, background: '#f8fafc', padding: 40 };
  hero.columns[0].elements = [
    { ...createElement('heading'), data: { text: 'Авторские экскурсии', level: 'h1' }, style: { padding: 0, margin: 8, fontSize: 36, align: 'left', color: '#0f172a', width: 100 } },
    { ...createElement('text'), data: { text: 'Соберите страницу так, как нужно именно вашему проекту: секции, колонки, медиа, маршруты и контакты.' } },
    { ...createElement('button'), data: { text: 'Смотреть экскурсии', href: '#tours', variant: 'filled' } },
  ];
  hero.columns[1].elements = [{ ...createElement('image'), data: { src: '', alt: 'Обложка', fit: 'cover' } }];

  const tours = createSection('1');
  tours.columns[0].elements = [{ ...createElement('tours'), data: { heading: 'Доступные экскурсии', columns: 3, selectedTourIds: [] } }];

  return [
    { id: 'page-main', title: 'Главная', slug: '', sections: [hero, tours] },
    { id: 'page-contacts', title: 'Контакты', slug: 'contacts', sections: [createSection('1')] },
  ];
}

// Загружает страницы только в новой структуре конструктора:
function loadBuilderPages(data: any): BuilderPage[] {
  // Если страниц нет, берем стартовый шаблон:
  if (!data?.pages) return getInitialPages();
  // Берем только новую структуру pages -> sections -> columns -> elements:
  return data.pages.map((page: any) => {
    const sections = Array.isArray(page.sections) ? page.sections : [];
    // Убирает старые неподдерживаемые элементы:
    const cleanSections = sections.map((section: any) => ({
      ...section,
      columns: Array.isArray(section.columns)
        ? section.columns.map((column: any) => ({
            ...column,
            elements: Array.isArray(column.elements)
              ? column.elements.filter((element: any) => supportedElementTypes.has(element?.type))
              : [],
          }))
        : [],
    }));

    return { id: page.id, title: page.title, slug: page.slug || '', sections: cleanSections };
  });
}

function styleToCss(style: BuilderStyle = {}, primary = '#2563eb'): React.CSSProperties {
  return {
    background: style.background && style.background !== 'transparent' ? style.background : undefined,
    color: style.color,
    padding: style.padding !== undefined ? style.padding : undefined,
    margin: style.margin !== undefined ? `${style.margin}px 0` : undefined,
    borderRadius: style.radius !== undefined ? style.radius : undefined,
    border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || '#e2e8f0'}` : undefined,
    boxShadow: style.shadow && style.shadow !== 'none' ? style.shadow : undefined,
    textAlign: style.align,
    fontSize: style.fontSize,
    width: style.width ? `${style.width}%` : undefined,
    '--builder-primary': primary,
  } as React.CSSProperties;
}

// Возвращает CSS-шрифт по настройке темы:
function getFontFamily(font: string) {
  if (font === 'serif') return 'Georgia, serif';
  if (font === 'mono') return 'monospace';
  return 'inherit';
}

export default function SiteBuilderPage() {
  // Данные опубликованной витрины:
  const [site, setSite] = useState<any>(null);
  // Все страницы конструктора:
  const [pages, setPages] = useState<BuilderPage[]>(getInitialPages);
  // Пользовательский адрес опубликованного сайта:
  const [siteSlug, setSiteSlug] = useState('');
  // Состояние проверки свободного адреса сайта:
  const [slugCheck, setSlugCheck] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
  // Id активной страницы:
  const [activePageId, setActivePageId] = useState('page-main');
  // Открытие списка страниц в панели инструментов:
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  // Глобальная тема сайта:
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  // Активная вкладка левой панели:
  const [tab, setTab] = useState<BuilderTab>('sections');
  // Выбранный объект на холсте:
  const [selection, setSelection] = useState<Selection | null>(null);
  // Режим ширины предпросмотра:
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  // Ласштаб рабочей области:
  const [zoom, setZoom] = useState(100);
  // Открытие левой панели:
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  // Открытие правой панели:
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  // Экскурсии для элемента списка туров:
  const [tours, setTours] = useState<any[]>([]);
  // Флаг публикации:
  const [publishing, setPublishing] = useState(false);
  // Флаг сохранения черновика:
  const [saving, setSaving] = useState(false);
  // Сообщение о результате действия:
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  // Оеретаскиваемый элемент:
  const [draggedElement, setDraggedElement] = useState<{ sectionId: string; columnId: string; elementId: string } | null>(null);
  // Оеретаскиваемая секция:
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  // История изменений для отмены:
  const [history, setHistory] = useState<string[]>([]);
  // Текущая позиция в истории:
  const [historyIndex, setHistoryIndex] = useState(-1);
  // Флаг восстановления из истории:
  const restoreRef = useRef(false);
  // Таймер для группировки изменений в истории:
  const historyTimerRef = useRef<number | null>(null);
  // Скопированный объект конструктора:
  const [clipboard, setClipboard] = useState<BuilderClipboard>(null);
  // Режим чистого предпросмотра:
  const [cleanPreview, setCleanPreview] = useState(false);
  // Таймер локального автосохранения:
  const autoSaveTimerRef = useRef<number | null>(null);
  // Контейнер списка страниц:
  const pageMenuRef = useRef<HTMLDivElement | null>(null);
  // Ключ текущего пользователя для localStorage:
  const storageUserId = useMemo(() => getCurrentStorageUserId(), []);
  // Ключ черновика текущего пользователя:
  const localDraftKey = `${LOCAL_DRAFT_KEY}:${storageUserId}`;
  // Ключ истории текущего пользователя:
  const localHistoryKey = `${LOCAL_HISTORY_KEY}:${storageUserId}`;

  // Закрывает список страниц вне панели выбора:
  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!pageMenuRef.current?.contains(event.target as Node)) setPageMenuOpen(false);
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPageMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeMenuOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, []);

  // Загружает сайт, экскурсии и сохраненные данные конструктора:
  useEffect(() => {
    // Берем локальный черновик, если сервер еще не вернул данные:
    const localDraft = window.localStorage.getItem(localDraftKey);
    // Удаляем старую тяжелую историю, чтобы не переполнить localStorage:
    window.localStorage.removeItem(localHistoryKey);
    // Восстанавливаем последнее локальное состояние:
    if (localDraft) {
      try {
        const parsed = JSON.parse(localDraft);
        if (parsed.pages) setPages(loadBuilderPages(parsed));
        if (parsed.theme) setTheme({ ...defaultTheme, ...parsed.theme });
        if (parsed.siteSlug) setSiteSlug(parsed.siteSlug);
      } catch {
        window.localStorage.removeItem(localDraftKey);
      }
    }
    api.getExcursions().then((d: any) => setTours(d));
    api.getConstructorData()
      .then((d: any) => {
        const loaded = loadBuilderPages(d);
        setPages(loaded);
        if (d?.theme) setTheme({ ...defaultTheme, ...d.theme });
        if (d?.siteSlug) {
          setSiteSlug(d.siteSlug);
          setSite({ slug: d.siteSlug, title: theme.logoText || 'Сайт' });
        }
        if (loaded.length > 0) setActivePageId(loaded[0].id);
      })
      .catch(() => {});
  }, [localDraftKey, localHistoryKey]);

  // Автосохраняет черновик в браузере:
  useEffect(() => {
    if (pages.length === 0) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      safeSetLocalStorage(localDraftKey, JSON.stringify({ pages, theme, siteSlug, version: 2 }), localHistoryKey);
    }, 700);
  }, [pages, theme, siteSlug, localDraftKey, localHistoryKey]);

  // Проверяет адрес сайта после паузы во вводе:
  useEffect(() => {
    if (!siteSlug.trim()) {
      setSlugCheck('idle');
      return;
    }

    setSlugCheck('checking');
    const timer = window.setTimeout(() => {
      api.checkSiteSlug(siteSlug)
        .then((result: any) => setSlugCheck(result.available ? 'available' : 'taken'))
        .catch(() => setSlugCheck('error'));
    }, 450); // Не отправляем запрос на каждый символ

    return () => window.clearTimeout(timer); // Отменяем устаревшую проверку
  }, [siteSlug]);

  // Сохраняет снимок состояния для undo/redo:
  useEffect(() => {
    if (!site) return;
    if (restoreRef.current) {
      restoreRef.current = false;
      return;
    }
    if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = window.setTimeout(() => {
      const snapshot = JSON.stringify({ pages, theme });
      setHistory((current) => {
        if (current[historyIndex] === snapshot) return current;
        const base = historyIndex >= 0 ? current.slice(0, historyIndex + 1) : current;
        return [...base, snapshot].slice(-20);
      });
      setHistoryIndex((index) => Math.min(index + 1, 19));
    }, 350);
  }, [pages, theme, site]);

  // Восстанавливает страницы и тему из истории:
  const restoreSnapshot = (index: number) => {
    const snapshot = history[index];
    if (!snapshot) return;
    const parsed = JSON.parse(snapshot);
    restoreRef.current = true;
    setPages(parsed.pages);
    setTheme({ ...defaultTheme, ...parsed.theme });
    setHistoryIndex(index);
  };

  // Отменяет последнее изменение:
  const undo = () => restoreSnapshot(Math.max(0, historyIndex - 1));
  // Возвращает отмененное изменение:
  const redo = () => restoreSnapshot(Math.min(history.length - 1, historyIndex + 1));

  // Активная страница для редактирования:
  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  // Вычисляет выбранную секцию, колонку или элемент:
  const selected = useMemo(() => {
    if (!selection || !activePage) return null;
    if (selection.type === 'header') return { kind: 'header' as const };
    const section = activePage.sections.find((s) => s.id === selection.sectionId);
    if (!section) return null;
    if (selection.type === 'section') return { kind: 'section' as const, section };
    const column = section.columns.find((c) => c.id === selection.columnId);
    if (!column) return null;
    if (selection.type === 'column') return { kind: 'column' as const, section, column };
    const element = column.elements.find((e) => e.id === selection.elementId);
    return element ? { kind: 'element' as const, section, column, element } : null;
  }, [activePage, selection]);

  // Нчищенный CSS для предпросмотра:

  // Обновляет только активную страницу:
  const updateActivePage = (updater: (page: BuilderPage) => BuilderPage) => {
    setPages((current) => current.map((page) => (page.id === activePageId ? updater(page) : page)));
  };

  // Добавляет новую страницу сайта:
  const addPage = () => {
    const id = uid('page');
    setPages((current) => [...current, { id, title: 'Новая страница', slug: `page-${current.length + 1}`, sections: [] }]);
    setActivePageId(id);
    setSelection(null);
  };

  // Удаляет страницу, если она не последняя:
  const deletePage = (pageId: string) => {
    if (pages.length <= 1) return;
    const next = pages.filter((page) => page.id !== pageId);
    setPages(next);
    if (activePageId === pageId) setActivePageId(next[0].id);
  };

  // Обновляет название или URL страницы:
  const updatePageField = (field: 'title' | 'slug', value: string) => {
    setPages((current) => current.map((page) => (page.id === activePageId ? { ...page, [field]: value } : page)));
  };

  // Добавляет пустую секцию выбранного типа:
  const addSection = (layout: SectionLayout) => {
    const section = createSection(layout);
    updateActivePage((page) => ({ ...page, sections: [...page.sections, section] }));
    setSelection({ type: 'section', sectionId: section.id });
    setTab('sections');
  };

  // Добавляет готовую секцию из шаблонов:
  const addSectionTemplate = (template: string) => {
    const section = createSectionTemplate(template);
    updateActivePage((page) => ({ ...page, sections: [...page.sections, section] }));
    setSelection({ type: 'section', sectionId: section.id });
    setTab('sections');
  };

  // Обновляет параметры секции:
  const updateSection = (sectionId: string, patch: Partial<BuilderSection>) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)),
    }));
  };

  // Обновляет стили секции:
  const updateSectionStyle = (sectionId: string, patch: BuilderStyle) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => (
        section.id === sectionId ? { ...section, style: { ...section.style, ...patch } } : section
      )),
    }));
  };

  // Меняет сетку секции и переносит элементы в первую колонку:
  const setSectionLayout = (section: BuilderSection, layout: SectionLayout) => {
    const widths = sectionLayouts[layout].widths;
    const oldElements = section.columns.flatMap((column) => column.elements);
    const columns = widths.map((width, index) => ({
      id: section.columns[index]?.id || uid('column'),
      width,
      elements: index === 0 ? oldElements : [],
      style: section.columns[index]?.style || { padding: 12, background: 'transparent', radius: 8 },
    }));
    updateSection(section.id, { layout, columns });
  };

  // Удаляет секцию со страницы:
  const deleteSection = (sectionId: string) => {
    updateActivePage((page) => ({ ...page, sections: page.sections.filter((section) => section.id !== sectionId) }));
    setSelection(null);
  };

  // Дублирует секцию рядом с исходной:
  const duplicateSection = (sectionId: string) => {
    const source = activePage.sections.find((section) => section.id === sectionId);
    if (!source) return;
    const copy = cloneSection(source);
    updateActivePage((page) => {
      const index = page.sections.findIndex((section) => section.id === sectionId);
      const sections = [...page.sections];
      sections.splice(index + 1, 0, copy);
      return { ...page, sections };
    });
    setSelection({ type: 'section', sectionId: copy.id });
  };

  // Меняет порядок секций перетаскиванием:
  const moveSection = (targetId: string) => {
    if (!draggedSectionId || draggedSectionId === targetId) return;
    updateActivePage((page) => {
      const sections = [...page.sections];
      const from = sections.findIndex((section) => section.id === draggedSectionId);
      const to = sections.findIndex((section) => section.id === targetId);
      if (from < 0 || to < 0) return page;
      const [item] = sections.splice(from, 1);
      sections.splice(to, 0, item);
      return { ...page, sections };
    });
    setDraggedSectionId(null);
  };

  // Обновляет параметры колонки:
  const updateColumn = (sectionId: string, columnId: string, patch: Partial<BuilderColumn>) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => section.id === sectionId ? {
        ...section,
        columns: section.columns.map((column) => column.id === columnId ? { ...column, ...patch } : column),
      } : section),
    }));
  };

  // Обновляет стили колонки:
  const updateColumnStyle = (sectionId: string, columnId: string, patch: BuilderStyle) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => section.id === sectionId ? {
        ...section,
        columns: section.columns.map((column) => column.id === columnId ? { ...column, style: { ...column.style, ...patch } } : column),
      } : section),
    }));
  };

  // Добавляет новый элемент в выбранную колонку:
  const addElement = (type: ElementType) => {
    const section = selected?.kind === 'section' || selected?.kind === 'column' || selected?.kind === 'element'
      ? selected.section
      : activePage.sections[0] || createSection('1');
    const column = selected?.kind === 'column' || selected?.kind === 'element' ? selected.column : section.columns[0];
    const element = createElement(type);
    updateActivePage((page) => {
      const hasSection = page.sections.some((item) => item.id === section.id);
      const sections = hasSection ? page.sections : [...page.sections, section];
      return {
        ...page,
        sections: sections.map((item) => item.id === section.id ? {
          ...item,
          columns: item.columns.map((itemColumn) => itemColumn.id === column.id ? {
            ...itemColumn,
            elements: [...itemColumn.elements, element],
          } : itemColumn),
        } : item),
      };
    });
    setSelection({ type: 'element', sectionId: section.id, columnId: column.id, elementId: element.id });
  };

  // Изменяет данные элемента:
  const updateElementData = (elementId: string, field: string, value: any) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        columns: section.columns.map((column) => ({
          ...column,
          elements: column.elements.map((element) => (
            element.id === elementId ? { ...element, data: { ...element.data, [field]: value } } : element
          )),
        })),
      })),
    }));
  };

  // Изменяет оформление элемента:
  const updateElementStyle = (elementId: string, patch: BuilderStyle) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        columns: section.columns.map((column) => ({
          ...column,
          elements: column.elements.map((element) => (
            element.id === elementId ? { ...element, style: { ...element.style, ...patch } } : element
          )),
        })),
      })),
    }));
  };

  // Удаляет элемент со страницы:
  const deleteElement = (elementId: string) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        columns: section.columns.map((column) => ({
          ...column,
          elements: column.elements.filter((element) => element.id !== elementId),
        })),
      })),
    }));
    setSelection(null);
  };

  // Дублирует элемент в той же колонке:
  const duplicateElement = (elementId: string) => {
    let targetSelection: Selection | null = null;
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        columns: section.columns.map((column) => {
          const index = column.elements.findIndex((element) => element.id === elementId);
          if (index < 0) return column;
          const copy = cloneElement(column.elements[index]);
          const elements = [...column.elements];
          elements.splice(index + 1, 0, copy);
          targetSelection = { type: 'element', sectionId: section.id, columnId: column.id, elementId: copy.id };
          return { ...column, elements };
        }),
      })),
    }));
    if (targetSelection) setSelection(targetSelection);
  };

  // Копирует выбранную секцию или элемент:
  const copySelection = () => {
    if (selected?.kind === 'section') {
      setClipboard({ type: 'section', section: cloneSection(selected.section) });
      setStatusMsg('Секция скопирована');
      setTimeout(() => setStatusMsg(null), 1800);
      return;
    }
    if (selected?.kind === 'element') {
      setClipboard({ type: 'element', element: cloneElement(selected.element) });
      setStatusMsg('Элемент скопирован');
      setTimeout(() => setStatusMsg(null), 1800);
    }
  };

  // Вставляет объект из буфера в подходящее место:
  const pasteClipboard = () => {
    if (!clipboard) return;
    if (clipboard.type === 'section') {
      const copy = cloneSection(clipboard.section);
      updateActivePage((page) => {
        const selectedSectionId = selected?.kind === 'section' || selected?.kind === 'column' || selected?.kind === 'element' ? selected.section.id : null;
        const index = selectedSectionId ? page.sections.findIndex((section) => section.id === selectedSectionId) : page.sections.length - 1;
        const sections = [...page.sections];
        sections.splice(index + 1, 0, copy);
        return { ...page, sections };
      });
      setSelection({ type: 'section', sectionId: copy.id });
      return;
    }
    const copy = cloneElement(clipboard.element);
    const targetSection = selected?.kind === 'section' || selected?.kind === 'column' || selected?.kind === 'element'
      ? selected.section
      : activePage.sections[0] || createSection('1');
    const targetColumn = selected?.kind === 'column' || selected?.kind === 'element' ? selected.column : targetSection.columns[0];
    updateActivePage((page) => {
      const hasSection = page.sections.some((section) => section.id === targetSection.id);
      const sections = hasSection ? page.sections : [...page.sections, targetSection];
      return {
        ...page,
        sections: sections.map((section) => section.id === targetSection.id ? {
          ...section,
          columns: section.columns.map((column) => column.id === targetColumn.id ? {
            ...column,
            elements: [...column.elements, copy],
          } : column),
        } : section),
      };
    });
    setSelection({ type: 'element', sectionId: targetSection.id, columnId: targetColumn.id, elementId: copy.id });
  };

  // Оереносит элемент в другую колонку или позицию:
  const dropElement = (targetSectionId: string, targetColumnId: string, targetElementId?: string) => {
    if (!draggedElement) return;
    updateActivePage((page) => {
      let moved: BuilderElement | null = null;
      const stripped = page.sections.map((section) => ({
        ...section,
        columns: section.columns.map((column) => {
          if (section.id === draggedElement.sectionId && column.id === draggedElement.columnId) {
            moved = column.elements.find((element) => element.id === draggedElement.elementId) || null;
            return { ...column, elements: column.elements.filter((element) => element.id !== draggedElement.elementId) };
          }
          return column;
        }),
      }));
      if (!moved) return page;
      return {
        ...page,
        sections: stripped.map((section) => section.id === targetSectionId ? {
          ...section,
          columns: section.columns.map((column) => {
            if (column.id !== targetColumnId) return column;
            const elements = [...column.elements];
            const index = targetElementId ? elements.findIndex((element) => element.id === targetElementId) : elements.length;
            elements.splice(index < 0 ? elements.length : index, 0, moved as BuilderElement);
            return { ...column, elements };
          }),
        } : section),
      };
    });
    setSelection({ type: 'element', sectionId: targetSectionId, columnId: targetColumnId, elementId: draggedElement.elementId });
    setDraggedElement(null);
  };

  // Открывает выбор одного изображения:
  const uploadSingleImage = async (callback: (url: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) callback(await fileToDataUrl(file));
    };
    input.click();
  };

  // Загружает несколько изображений в галерею:
  const uploadGallery = async (element: BuilderElement) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files) return;
      const urls = await Promise.all(Array.from(files).map(fileToDataUrl));
      updateElementData(element.id, 'images', [...(element.data.images || []), ...urls]);
    };
    input.click();
  };

  // Общие данные для сохранения и публикации:
  const savePayload = { pages, theme: { ...theme, customCss: '' }, siteSlug, version: 2 };

  // После рендера чинит подписи интерфейса конструктора:
  useEffect(() => {
    if (!activePage) return;
    const root = document.querySelector<HTMLElement>('.constructor-layout');
    repairVisibleMojibake(root);
    normalizeBuilderChrome(root, activePage, tab, rightPanelOpen);
  }, [activePage, tab, rightPanelOpen, leftPanelOpen, pages]);

  // Сохраняет черновик сайта:
  const handleSave = async () => {
    // Останавливаем сохранение с занятым адресом:
    if (slugCheck === 'taken') {
      setStatusMsg('Этот адрес сайта уже занят');
      return;
    }
    setSaving(true);
    setStatusMsg(null);
    try {
      await api.saveDraft(savePayload);
      setStatusMsg('Черновик сохранен');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (error: any) {
      setStatusMsg(error.message || 'Ошибка сохранения'); // Сообщение сервера
    }
    setSaving(false);
  };

  // Публикует сайт и делает его доступным по slug:
  const handlePublish = async () => {
    // Останавливаем публикацию с занятым адресом:
    if (slugCheck === 'taken') {
      setStatusMsg('Этот адрес сайта уже занят');
      return;
    }
    setPublishing(true);
    setStatusMsg(null);
    try {
      await api.saveConstructor(savePayload);
      setStatusMsg('Сайт опубликован');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (error: any) {
      setStatusMsg(error.message || 'Ошибка публикации'); // Сообщение сервера
    }
    setPublishing(false);
  };

  if (!site || !activePage) return <p style={{ padding: 20 }}>Загрузка...</p>;

  return (
    <div className={`constructor-layout ${!leftPanelOpen ? 'left-collapsed' : ''} ${!rightPanelOpen ? 'right-collapsed' : ''} ${cleanPreview ? 'clean-preview-mode' : ''}`}>
      {/* Левая панель с вкладками конструктора: */}
      {leftPanelOpen && (
      <div className="constructor-left">
        <div className="constructor-left-header">
          <h3>{'\u041a\u043e\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u043e\u0440 \u0441\u0430\u0439\u0442\u0430'}</h3>
          <div className="panel-header-actions">
            <button className="panel-toggle-btn" type="button" onClick={() => setLeftPanelOpen(false)} title="Скрыть панель конструктора">
              {'<'}
            </button>
          </div>
        </div>

        {/* Вертикальное меню разделов конструктора: */}
        <div className="constructor-tabs vertical-tabs">
          {[
            ['sections', '\u0421\u0435\u043a\u0446\u0438\u0438', '\u{1f9e9}'],
            ['elements', '\u042d\u043b\u0435\u043c\u0435\u043d\u0442\u044b', '\u2795'],
            ['templates', '\u0428\u0430\u0431\u043b\u043e\u043d\u044b', '\u{1f5bc}\ufe0f'],
            ['pages', '\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u044b', '\u{1f4c4}'],
            ['theme', '\u0422\u0435\u043c\u0430', '\u{1f3a8}'],
          ].map(([id, label, icon]) => (
            <button key={id} className={`ctab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id as BuilderTab)}>
              <span className="ctab-icon">{icon}</span>
              {label}
            </button>
          ))}
          <div className="constructor-rail-actions">
            <button className="rail-save-action" type="button" onClick={handleSave} disabled={saving} title="Сохранить черновик">
              <span>{saving ? 'Сохранение' : 'Сохранить'}</span>
            </button>
            <button className="rail-publish-action" type="button" onClick={handlePublish} disabled={publishing} title="Опубликовать сайт">
              <span>{publishing ? 'Публикация' : 'Опубликовать'}</span>
            </button>
          </div>
        </div>

        {tab === 'sections' && (
          /* Вкладка управления секциями страницы: */
          <div className="constructor-panel">
            <p className="panel-label">{`\u0421\u0435\u043a\u0446\u0438\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b "${activePage.title}"`}</p>
            <div className="block-list">
              <div className={`block-list-item ${selection?.type === 'header' ? 'selected' : ''}`} onClick={() => setSelection({ type: 'header' })}>
                <span className="block-icon">H</span>
                <span className="block-label">{'\u0428\u0430\u043f\u043a\u0430 \u0441\u0430\u0439\u0442\u0430'}</span>
              </div>
              {activePage.sections.map((section, index) => (
                <div
                  key={section.id}
                  className={`block-list-item ${selection?.type === 'section' && selection.sectionId === section.id ? 'selected' : ''}`}
                  draggable
                  onDragStart={() => setDraggedSectionId(section.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveSection(section.id)}
                  onClick={() => setSelection({ type: 'section', sectionId: section.id })}
                >
                  <span className="block-icon">::</span>
                  <span className="block-label">{`\u0421\u0435\u043a\u0446\u0438\u044f ${index + 1} - ${sectionLayouts[section.layout].label}`}</span>
                  <button className="block-action-btn" title="Дублировать секцию" onClick={(event) => { event.stopPropagation(); duplicateSection(section.id); }}>⧉</button>
                  <button className="block-action-btn danger" onClick={(event) => { event.stopPropagation(); deleteSection(section.id); }}>x</button>
                </div>
              ))}
            </div>
            <p className="panel-label" style={{ marginTop: 16 }}>{'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0435\u043a\u0446\u0438\u044e'}</p>
            <div className="add-block-grid">
              {(Object.keys(sectionLayouts) as SectionLayout[]).map((layout) => (
                <button key={layout} className="add-block-btn" onClick={() => addSection(layout)}>
                  <span>{sectionLayouts[layout].widths.join('/')}</span>
                  <span>{sectionLayouts[layout].label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'templates' && (
          /* Вкладка готовых шаблонов секций: */
          <div className="constructor-panel">
            <p className="panel-label">{'\u0413\u043e\u0442\u043e\u0432\u044b\u0435 \u0441\u0435\u043a\u0446\u0438\u0438'}</p>
            <div className="template-groups">
              {sectionTemplateGroups.map((group) => (
                <div key={group.title} className="template-group">
                  <h4>{group.title}</h4>
                  {group.items.map((template) => (
                    <button key={template} className={`template-btn template-${template}`} onClick={() => addSectionTemplate(template)}>
                      {/* Миниатюра показывает будущую структуру секции: */}
                      {/* Подпись объясняет назначение шаблона: */}
                      <span className="template-copy">
                        <strong>{templateLabel(template)}</strong>
                        <small>{templateDescription(template)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'elements' && (
          /* Вкладка каталога элементов: */
          <div className="constructor-panel">
            <p className="panel-label">{'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u0443\u044e \u043a\u043e\u043b\u043e\u043d\u043a\u0443'}</p>
            <div className="element-catalog">
              {elementGroups.map((group) => (
                <div key={group.title} className="element-group">
                  <h4>{group.title}</h4>
                  <div className="add-block-grid">
                    {group.items.map((type) => (
                      <button key={type} className="add-block-btn" onClick={() => addElement(type)}>
                        <span>{elementLabels[type].icon}</span>
                        <span>{elementLabels[type].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="panel-hint">{'\u042d\u043b\u0435\u043c\u0435\u043d\u0442\u044b \u043c\u043e\u0436\u043d\u043e \u043f\u0435\u0440\u0435\u043d\u043e\u0441\u0438\u0442\u044c \u043c\u0435\u0436\u0434\u0443 \u043a\u043e\u043b\u043e\u043d\u043a\u0430\u043c\u0438 \u043f\u0440\u044f\u043c\u043e \u0432 \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435.'}</p>
          </div>
        )}

        {tab === 'pages' && (
          /* Вкладка управления страницами сайта: */
          <div className="constructor-panel">
            <p className="panel-label">{'\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u044b \u0441\u0430\u0439\u0442\u0430'}</p>
            <div className="page-list">
              {pages.map((page) => (
                <div key={page.id} className={`page-list-item ${activePageId === page.id ? 'active' : ''}`} onClick={() => { setActivePageId(page.id); setSelection(null); }}>
                  <span className="page-title">{page.title}</span>
                  <span className="page-slug">/{page.slug}</span>
                  {pages.length > 1 && <button className="block-action-btn danger" onClick={(event) => { event.stopPropagation(); deletePage(page.id); }}>x</button>}
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={addPage} style={{ width: '100%', marginTop: 12 }}>+ {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443'}</Button>
          </div>
        )}
        {tab === 'theme' && (
          /* Вкладка глобальной темы сайта: */
          <div className="constructor-panel">
            <GeneralThemeEditor
              theme={theme}
              setTheme={setTheme}
              siteSlug={siteSlug}
              setSiteSlug={setSiteSlug}
              slugCheck={slugCheck}
              uploadSingleImage={uploadSingleImage}
            />
          </div>
        )}
      </div>
      )}

      {/* Центральная рабочая область и предпросмотр: */}
      <div className="constructor-preview">
        <div className="preview-toolbar">
          {!leftPanelOpen && (
            <button className="workspace-panel-btn" type="button" onClick={() => setLeftPanelOpen(true)} title="Показать панель конструктора">
              {'<'}
            </button>
          )}
          <div className="preview-actions">
            {/* Переключатель редактируемой страницы: */}
            <div ref={pageMenuRef} className={`toolbar-page-select ${pageMenuOpen ? 'open' : ''}`}>
              <button
                className="toolbar-page-trigger"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={pageMenuOpen}
                onClick={() => setPageMenuOpen((open) => !open)}
                title="Выберите страницу"
              >
                <span>{activePage.title || 'Страница'}</span>
              </button>
              {pageMenuOpen && (
                <div className="toolbar-page-menu" role="listbox" aria-label="Страницы сайта">
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      className={`toolbar-page-option ${page.id === activePageId ? 'active' : ''}`}
                      type="button"
                      role="option"
                      aria-selected={page.id === activePageId}
                      onClick={() => {
                        setActivePageId(page.id);
                        setSelection(null);
                        setPageMenuOpen(false);
                      }}
                    >
                      {page.title || 'Страница'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="history-actions">
              <button type="button" onClick={undo} disabled={historyIndex <= 0} title="Отменить" aria-label="Отменить">↶</button>
              <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1} title="Вернуть" aria-label="Вернуть">↷</button>
            </div>
            <div className="zoom-control">
              <button type="button" onClick={() => setZoom((value) => Math.max(50, value - 10))}>-</button>
              <span>{zoom}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(150, value + 10))}>+</button>
            </div>
            <div className="viewport-switcher">
              {(['desktop', 'tablet', 'mobile'] as ViewportMode[]).map((mode) => (
                <button key={mode} className={viewport === mode ? 'active' : ''} onClick={() => setViewport(mode)}>
                  {mode === 'desktop' ? 'Desktop' : mode === 'tablet' ? 'Tablet' : 'Mobile'}
                </button>
              ))}
            </div>
            <button
              className={`clean-preview-toggle ${cleanPreview ? 'active' : ''}`}
              type="button"
              onClick={() => setCleanPreview((value) => !value)}
              title="Показать сайт без рамок редактора"
            >
              Без рамок
            </button>
            <a
              className="published-site-link"
              href={`/s/${siteSlug || site?.slug || 'maxim-furzikov'}`}
              target="_blank"
              rel="noreferrer"
              title="Открыть опубликованный сайт"
            >
              Перейти на сайт
            </a>
            <button
              className="workspace-panel-btn"
              type="button"
              onClick={() => setRightPanelOpen((open) => !open)}
              title={rightPanelOpen ? 'Скрыть свойства' : 'Показать свойства'}
            >
              {rightPanelOpen ? '>' : '<'}
            </button>
          </div>
        </div>        {statusMsg && <div className="builder-toast">{statusMsg}</div>}

        {/* Холст сайта с учетом режима устройства и масштаба: */}
        <div
          className={`preview-frame viewport-${viewport}`}
          style={{
            fontFamily: getFontFamily(theme.fontFamily),
            '--preview-primary': theme.primaryColor,
            '--preview-radius': `${theme.borderRadius}px`,
            backgroundColor: theme.siteBg,
            backgroundImage: theme.siteBgImage ? `url(${theme.siteBgImage})` : undefined,
            backgroundSize: 'cover',
            backgroundAttachment: 'local',
            backgroundPosition: 'center',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          } as React.CSSProperties}
        >
          {/* Шапка сайта редактируется отдельно от секций: */}
          <div className={`preview-block-header ${selection?.type === 'header' ? 'selected' : ''}`} onClick={() => setSelection({ type: 'header' })}>
            <div
              className={`preview-site-header ${theme.headerStyle === 'dark' ? 'dark' : ''} nav-${theme.headerNavAlign}`}
              style={{ background: theme.headerBg, color: theme.headerTextColor } as React.CSSProperties}
            >
              <span className="preview-site-logo">
                {theme.logoType === 'image' && theme.logoImage ? <img src={theme.logoImage} alt="" className="preview-logo-img" /> : (theme.logoText || site.title)}
              </span>
              {theme.headerNavVisible && (
                <div
                  className={`preview-site-nav nav-style-${theme.headerNavStyle}`}
                  style={{ gap: `${theme.headerNavGap}px` } as React.CSSProperties}
                >
                  {pages.map((page) => <span key={page.id} className={page.id === activePageId ? 'active-nav' : ''}>{page.title}</span>)}
                </div>
              )}
            </div>
          </div>

          {activePage.sections.length === 0 && <div className="preview-empty">Добавьте первую секцию</div>}

          {/* Секции активной страницы: */}
          {activePage.sections.map((section) => (
            <section
              key={section.id}
              className={`builder-section ${selection?.type === 'section' && selection.sectionId === section.id ? 'selected' : ''}`}
              style={styleToCss(section.style, theme.primaryColor)}
              onClick={(event) => { event.stopPropagation(); setSelection({ type: 'section', sectionId: section.id }); }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveSection(section.id)}
            >
              <div className="builder-columns">
                {section.columns.map((column) => (
                  <div
                    key={column.id}
                    className={`builder-column ${selection?.type === 'column' && selection.columnId === column.id ? 'selected' : ''}`}
                    style={{ flexBasis: `${column.width}%`, ...styleToCss(column.style, theme.primaryColor) }}
                    onClick={(event) => { event.stopPropagation(); setSelection({ type: 'column', sectionId: section.id, columnId: column.id }); }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.stopPropagation(); dropElement(section.id, column.id); }}
                  >
                    {column.elements.length === 0 && <div className="column-empty">Оеретащите или добавьте элемент</div>}
                    {column.elements.map((element) => (
                      <div
                        key={element.id}
                        className={`builder-element ${selection?.type === 'element' && selection.elementId === element.id ? 'selected' : ''}`}
                        draggable
                        onDragStart={(event) => { event.stopPropagation(); setDraggedElement({ sectionId: section.id, columnId: column.id, elementId: element.id }); }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => { event.stopPropagation(); dropElement(section.id, column.id, element.id); }}
                        onClick={(event) => { event.stopPropagation(); setSelection({ type: 'element', sectionId: section.id, columnId: column.id, elementId: element.id }); }}
                      >
                        <ElementPreview element={element} tours={tours} slug={site.slug} primary={theme.primaryColor} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="preview-site-footer">{site.title} &copy; {new Date().getFullYear()}</div>
        </div>
      </div>

      {/* Правая панель свойств выбранного объекта: */}
      {rightPanelOpen && (
      <div className="constructor-right">
        <div className="props-collapse-row">
          <button className="panel-toggle-btn" type="button" onClick={() => setRightPanelOpen(false)} title="Скрыть панель свойств">
            {'<'}
          </button>
        </div>
        <PropertiesPanel
          selected={selected}
          theme={theme}
          setTheme={setTheme}
          siteTitle={site.title}
          tours={tours}
          updateSectionStyle={updateSectionStyle}
          setSectionLayout={setSectionLayout}
          updateColumn={updateColumn}
          updateColumnStyle={updateColumnStyle}
          updateElementData={updateElementData}
          updateElementStyle={updateElementStyle}
          deleteElement={deleteElement}
          deleteSection={deleteSection}
          duplicateElement={duplicateElement}
          duplicateSection={duplicateSection}
          copySelection={copySelection}
          pasteClipboard={pasteClipboard}
          clipboard={clipboard}
          updatePageField={updatePageField}
          activePage={activePage}
          uploadSingleImage={uploadSingleImage}
          uploadGallery={uploadGallery}
        />
      </div>
      )}
    </div>
  );
}

// Показывает элемент на холсте конструктора:
function ElementPreview({ element, tours, slug, primary }: { element: BuilderElement; tours: any[]; slug: string; primary: string }) {
  // Общий CSS элемента собирается из настроек стиля:
  const css = styleToCss(element.style, primary);

  if (element.type === 'heading') {
    const Tag = element.data.level || 'h2';
    return <Tag className="b-el-heading" style={css}>{element.data.text}</Tag>;
  }
  if (element.type === 'text') {
    return <p className="b-el-text" style={css}>{element.data.text}</p>;
  }
  if (element.type === 'button') {
    return (
      <div style={{ textAlign: element.style.align || 'left' }}>
        <a className={`b-el-button ${element.data.variant === 'outline' ? 'outline' : ''}`} href={element.data.href || '#'} style={css}>
          {element.data.text}
        </a>
      </div>
    );
  }
  if (element.type === 'backButton') {
    return (
      <div style={{ textAlign: element.style.align || 'left' }}>
        <button className="b-el-button outline" type="button" style={css}>
          ← {element.data.text || 'Назад'}
        </button>
      </div>
    );
  }
  if (element.type === 'image') {
    return element.data.src ? (
      <div className="b-el-image-wrap" style={{ textAlign: element.style.align || 'left' }}>
        <img className="b-el-image" src={element.data.src} alt={element.data.alt || ''} style={{ ...css, objectFit: element.data.fit || 'cover' }} />
      </div>
    ) : (
      <div className="b-el-image-wrap" style={{ textAlign: element.style.align || 'left' }}>
        <div className="b-el-image-placeholder" style={css}>Изображение</div>
      </div>
    );
  }
  if (element.type === 'gallery') {
    return (
      <div className="b-el-gallery" style={css}>
        {(element.data.images || []).length === 0 ? <div className="b-el-image-placeholder">Галерея</div> : (
          <div className="b-el-gallery-grid" style={{ gridTemplateColumns: `repeat(${element.data.columns || 3}, 1fr)` }}>
            {element.data.images.map((url: string, index: number) => <div key={index} className="b-el-gallery-img" style={{ backgroundImage: `url(${url})`, borderRadius: element.style.radius }} />)}
          </div>
        )}
      </div>
    );
  }
  if (element.type === 'video') {
    const videoUrl = normalizeVideoUrl(element.data.url || '');
    return (
      <div className="b-el-video" style={css}>
        {videoUrl ? <iframe src={videoUrl} title={element.data.title || 'Видео'} allowFullScreen /> : <div className="b-el-image-placeholder">Вставьте ссылку на видео</div>}
      </div>
    );
  }
  if (element.type === 'divider') {
    return <hr className="b-el-divider" style={{ ...css, borderTopWidth: element.data.thickness || 1, borderTopStyle: element.data.lineStyle || 'solid' }} />;
  }
  if (element.type === 'spacer') {
    return <div style={{ height: element.data.height || 40 }} />;
  }
  if (element.type === 'box') {
    return <div className="b-el-box" style={css}>{String(element.data.text || '').split('\n').map((line: string, index: number) => <p key={index}>{line}</p>)}</div>;
  }
  if (element.type === 'list') {
    const ListTag = element.data.ordered ? 'ol' : 'ul';
    return (
      <div className="b-el-list" style={css}>
        {element.data.heading && <h3>{element.data.heading}</h3>}
        <ListTag>{(element.data.items || []).map((item: string, index: number) => <li key={index}>{item}</li>)}</ListTag>
      </div>
    );
  }
  if (element.type === 'social') {
    const items = ['instagram', 'facebook', 'vk', 'telegram', 'youtube'].filter((key) => element.data[key]);
    return (
      <div className={`b-el-social ${element.data.style === 'mono' ? 'mono' : ''}`} style={css}>
        {(items.length ? items : ['instagram', 'facebook', 'telegram']).map((key) => (
          <a key={key} href={element.data[key] || '#'}>{key.slice(0, 2).toUpperCase()}</a>
        ))}
      </div>
    );
  }
  if (element.type === 'menu') {
    return <div id={element.data.anchor || undefined} className="b-el-anchor" style={css}>{element.data.label}</div>;
  }
  if (element.type === 'form') {
    return (
      <form className="b-el-form" style={css}>
        <h3>{element.data.heading}</h3>
        {(element.data.fields || []).map((field: string) => <input key={field} placeholder={field} />)}
        <button type="button">{element.data.buttonText || 'Отправить'}</button>
      </form>
    );
  }
  if (element.type === 'map') {
    return (
      <div className="b-el-map" style={css}>
        <BuilderLeafletMap data={element.data} preview />
      </div>
    );
  }
  if (element.type === 'embed') {
    return <pre className="b-el-embed" style={css}>{element.data.code}</pre>;
  }
  if (element.type === 'tours') {
    const selectedIds: string[] = element.data.selectedTourIds || [];
    const shown = tours.filter((tour) => tour.status === 'published' && (selectedIds.length === 0 || selectedIds.includes(tour.id)));
    return (
      <div className="b-el-tours" style={css} id="tours">
        <h2>{element.data.heading}</h2>
        <div className="b-el-tours-grid" style={{ gridTemplateColumns: `repeat(${element.data.columns || 2}, minmax(0, 1fr))` }}>
          {shown.map((tour) => (
            <a key={tour.id} className="b-el-tour-card" href={`/s/${slug}/excursion/${tour.id}`}>
              {tour.coverImage && (
                <span className="b-el-tour-cover" style={{ backgroundImage: `url(${tour.coverImage})` }} />
              )}
              <strong>{tour.title}</strong>
              <span>{tour.city}</span>
              <small>{tour.duration} мин · {((tour.distance || 0) / 1000).toFixed(1)} км</small>
            </a>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="b-el-contacts" style={css}>
      <h2>{element.data.heading}</h2>
      {element.data.email && <p>Email: {element.data.email}</p>}
      {element.data.phone && <p>Телефон: {element.data.phone}</p>}
      {element.data.telegram && <p>Telegram: {element.data.telegram}</p>}
      {element.data.address && <p>Адрес: {element.data.address}</p>}
    </div>
  );
}

// Объединяет настройки темы и шапки:
function ThemeEditor({ theme, setTheme, siteTitle, uploadSingleImage }: { theme: ThemeConfig; setTheme: (theme: ThemeConfig) => void; siteTitle: string; uploadSingleImage: (callback: (url: string) => void) => void }) {
  return (
    <div className="theme-form">
      <p className="panel-label">Оформление</p>
      <ColorField label="Основной цвет" value={theme.primaryColor} onChange={(primaryColor) => setTheme({ ...theme, primaryColor })} />
      <div className="theme-field">
        <label>Шрифт</label>
        <select className="theme-select" value={theme.fontFamily} onChange={(event) => setTheme({ ...theme, fontFamily: event.target.value })}>
          <option value="system">Системный</option>
          <option value="serif">Serif</option>
          <option value="mono">Monospace</option>
        </select>
      </div>
      <NumberField label="Скругление по умолчанию" value={Number(theme.borderRadius)} onChange={(borderRadius) => setTheme({ ...theme, borderRadius: String(borderRadius) })} min={0} max={32} />
      <div className="theme-field">
        <label>Стиль шапки</label>
        <select className="theme-select" value={theme.headerStyle} onChange={(event) => setTheme({ ...theme, headerStyle: event.target.value as 'light' | 'dark' })}>
          <option value="light">Светлая</option>
          <option value="dark">Темная</option>
        </select>
      </div>
      <div className="theme-field">
        <label>Тип логотипа</label>
        <select className="theme-select" value={theme.logoType || 'text'} onChange={(event) => setTheme({ ...theme, logoType: event.target.value as ThemeConfig['logoType'] })}>
          <option value="text">Надпись</option>
          <option value="image">Картинка</option>
        </select>
      </div>
      {(theme.logoType || 'text') === 'text' && <Input label="Текст логотипа" value={theme.logoText} placeholder={siteTitle} onChange={(event) => setTheme({ ...theme, logoText: event.target.value })} />}
      {theme.logoType === 'image' && (
        <>
          <Button variant="secondary" size="sm" onClick={() => uploadSingleImage((logoImage) => setTheme({ ...theme, logoType: 'image', logoImage }))}>Загрузить логотип</Button>
          {theme.logoImage && <Button variant="ghost" size="sm" onClick={() => setTheme({ ...theme, logoImage: '' })}>Убрать логотип</Button>}
        </>
      )}
    </div>
  );
}

// Редактор общих настроек сайта:
function GeneralThemeEditor({
  theme,
  setTheme,
  siteSlug,
  setSiteSlug,
  slugCheck,
  uploadSingleImage,
}: {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  siteSlug: string;
  setSiteSlug: (slug: string) => void;
  slugCheck: 'idle' | 'checking' | 'available' | 'taken' | 'error';
  uploadSingleImage: (callback: (url: string) => void) => void;
}) {
  return (
    <div className="theme-form">
      <p className="panel-label">Общие настройки</p>
      <Input label="Адрес сайта" value={siteSlug} onChange={(event) => setSiteSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
      <p className="field-hint">Сайт будет открываться по ссылке /s/{siteSlug || '...'}</p>
      {slugCheck === 'checking' && <p className="field-hint slug-check checking">Проверяем адрес...</p>}
      {slugCheck === 'available' && <p className="field-hint slug-check available">Адрес свободен</p>}
      {slugCheck === 'taken' && <p className="field-hint slug-check taken">Адрес уже занят</p>}
      {slugCheck === 'error' && <p className="field-hint slug-check taken">Не удалось проверить адрес</p>}
      <ColorField label="Основной цвет" value={theme.primaryColor} onChange={(primaryColor) => setTheme({ ...theme, primaryColor })} />
      <ColorField label="Фон сайта" value={theme.siteBg} onChange={(siteBg) => setTheme({ ...theme, siteBg })} />
      <Button variant="secondary" size="sm" onClick={() => uploadSingleImage((siteBgImage) => setTheme({ ...theme, siteBgImage }))}>Загрузить фон сайта</Button>
      {theme.siteBgImage && <Button variant="ghost" size="sm" onClick={() => setTheme({ ...theme, siteBgImage: '' })}>Убрать фон-картинку</Button>}
      <Input label="Favicon" value={theme.favicon || ''} onChange={(event) => setTheme({ ...theme, favicon: event.target.value })} />
      <Button variant="secondary" size="sm" onClick={() => uploadSingleImage((favicon) => setTheme({ ...theme, favicon }))}>Загрузить favicon</Button>
      {theme.favicon && <Button variant="ghost" size="sm" onClick={() => setTheme({ ...theme, favicon: '' })}>Убрать favicon</Button>}
      <div className="theme-field">
        <label>Шрифт</label>
        <select className="theme-select" value={theme.fontFamily} onChange={(event) => setTheme({ ...theme, fontFamily: event.target.value })}>
          <option value="system">Системный</option>
          <option value="serif">Serif</option>
          <option value="mono">Monospace</option>
        </select>
      </div>
      <NumberField label="Скругление по умолчанию" value={Number(theme.borderRadius)} onChange={(borderRadius) => setTheme({ ...theme, borderRadius: String(borderRadius) })} min={0} max={32} />
    </div>
  );
}
// Редактор шапки сайта:
function HeaderEditor({ theme, setTheme, siteTitle, uploadSingleImage }: { theme: ThemeConfig; setTheme: (theme: ThemeConfig) => void; siteTitle: string; uploadSingleImage: (callback: (url: string) => void) => void }) {
  return (
    <div className="theme-form">
      <p className="panel-label">Оформление шапки</p>
      <ColorField label="Фон шапки" value={theme.headerBg} onChange={(headerBg) => setTheme({ ...theme, headerBg })} />
      <ColorField label="Цвет текста" value={theme.headerTextColor} onChange={(headerTextColor) => setTheme({ ...theme, headerTextColor })} />
      <div className="theme-field">
        <label>Тип логотипа</label>
        <select className="theme-select" value={theme.logoType || 'text'} onChange={(event) => setTheme({ ...theme, logoType: event.target.value as ThemeConfig['logoType'] })}>
          <option value="text">Надпись</option>
          <option value="image">Картинка</option>
        </select>
      </div>
      {(theme.logoType || 'text') === 'text' && <Input label="Текст логотипа" value={theme.logoText} placeholder={siteTitle} onChange={(event) => setTheme({ ...theme, logoText: event.target.value })} />}
      {theme.logoType === 'image' && (
        <>
          <Button variant="secondary" size="sm" onClick={() => uploadSingleImage((logoImage) => setTheme({ ...theme, logoType: 'image', logoImage }))}>Загрузить логотип</Button>
          {theme.logoImage && <Button variant="ghost" size="sm" onClick={() => setTheme({ ...theme, logoImage: '' })}>Убрать логотип</Button>}
        </>
      )}
      <label className="check-field">
        <input type="checkbox" checked={theme.headerNavVisible} onChange={(event) => setTheme({ ...theme, headerNavVisible: event.target.checked })} />
        Показывать ссылки
      </label>
      <div className="theme-field">
        <label>Расположение ссылок</label>
        <select className="theme-select" value={theme.headerNavAlign} onChange={(event) => setTheme({ ...theme, headerNavAlign: event.target.value as ThemeConfig['headerNavAlign'] })}>
          <option value="left">Слева</option>
          <option value="center">По центру</option>
          <option value="right">Справа</option>
        </select>
      </div>
      <div className="theme-field">
        <label>Вид ссылок</label>
        <select className="theme-select" value={theme.headerNavStyle} onChange={(event) => setTheme({ ...theme, headerNavStyle: event.target.value as ThemeConfig['headerNavStyle'] })}>
          <option value="links">Текст</option>
          <option value="pills">Кнопки</option>
          <option value="underline">Подчеркивание</option>
        </select>
      </div>
      <NumberField label="Расстояние между ссылками" value={Number(theme.headerNavGap)} onChange={(headerNavGap) => setTheme({ ...theme, headerNavGap: String(headerNavGap) })} min={0} max={48} />
    </div>
  );
}

// Правая панель свойств выбранного объекта:
function PropertiesPanel(props: {
  selected: BuilderSelected | null;
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  siteTitle: string;
  tours: any[];
  updateSectionStyle: (sectionId: string, patch: BuilderStyle) => void;
  setSectionLayout: (section: BuilderSection, layout: SectionLayout) => void;
  updateColumn: (sectionId: string, columnId: string, patch: Partial<BuilderColumn>) => void;
  updateColumnStyle: (sectionId: string, columnId: string, patch: BuilderStyle) => void;
  updateElementData: (elementId: string, field: string, value: any) => void;
  updateElementStyle: (elementId: string, patch: BuilderStyle) => void;
  deleteElement: (elementId: string) => void;
  deleteSection: (sectionId: string) => void;
  duplicateElement: (elementId: string) => void;
  duplicateSection: (sectionId: string) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  clipboard: BuilderClipboard;
  updatePageField: (field: 'title' | 'slug', value: string) => void;
  activePage: BuilderPage;
  uploadSingleImage: (callback: (url: string) => void) => void;
  uploadGallery: (element: BuilderElement) => void;
}) {
  const { selected } = props;

  return (
    <>
      {selected?.kind === 'header' && (
        <>
          <div className="props-header"><span className="props-icon">H</span><h3>{'\u0428\u0430\u043f\u043a\u0430 \u0441\u0430\u0439\u0442\u0430'}</h3></div>
          <div className="props-body">
            <HeaderEditor theme={props.theme} setTheme={props.setTheme} siteTitle={props.siteTitle} uploadSingleImage={props.uploadSingleImage} />
          </div>
        </>
      )}

      {selected?.kind === 'section' && (
        <>
          <div className="props-header"><span className="props-icon">S</span><h3>{'\u0421\u0435\u043a\u0446\u0438\u044f'}</h3></div>
          <div className="props-body">
            <div className="theme-field">
              <label>{'\u0421\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430'}</label>
              <select className="theme-select" value={selected.section.layout} onChange={(event) => props.setSectionLayout(selected.section, event.target.value as SectionLayout)}>
                {(Object.keys(sectionLayouts) as SectionLayout[]).map((layout) => <option key={layout} value={layout}>{sectionLayouts[layout].label}</option>)}
              </select>
            </div>
            <StyleEditor style={selected.section.style} onChange={(patch) => props.updateSectionStyle(selected.section.id, patch)} />
            <div className="props-action-grid">
              <Button variant="secondary" size="sm" onClick={props.copySelection}>Копировать</Button>
              <Button variant="secondary" size="sm" onClick={() => props.duplicateSection(selected.section.id)}>Дублировать</Button>
              <Button variant="secondary" size="sm" onClick={props.pasteClipboard} disabled={!props.clipboard}>Вставить</Button>
            </div>
            <Button variant="danger" size="sm" onClick={() => props.deleteSection(selected.section.id)}>{'\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u0435\u043a\u0446\u0438\u044e'}</Button>
          </div>
        </>
      )}

      {selected?.kind === 'column' && (
        <>
          <div className="props-header"><span className="props-icon">C</span><h3>{'\u041a\u043e\u043b\u043e\u043d\u043a\u0430'}</h3></div>
          <div className="props-body">
            <NumberField label="Ширина колонки, %" value={selected.column.width} min={10} max={100} onChange={(width) => props.updateColumn(selected.section.id, selected.column.id, { width })} />
            <StyleEditor style={selected.column.style} onChange={(patch) => props.updateColumnStyle(selected.section.id, selected.column.id, patch)} compact />
            <Button variant="secondary" size="sm" onClick={props.pasteClipboard} disabled={!props.clipboard}>Вставить сюда</Button>
          </div>
        </>
      )}

      {selected?.kind === 'element' && (
        <>
          <div className="props-header"><span className="props-icon">{elementLabels[selected.element.type].icon}</span><h3>{elementLabels[selected.element.type].label}</h3></div>
          <div className="props-body">
            <ElementEditor element={selected.element} tours={props.tours} updateData={props.updateElementData} uploadSingleImage={props.uploadSingleImage} uploadGallery={props.uploadGallery} />
            <StyleEditor style={selected.element.style} onChange={(patch) => props.updateElementStyle(selected.element.id, patch)} compact />
            <div className="props-action-grid">
              <Button variant="secondary" size="sm" onClick={props.copySelection}>Копировать</Button>
              <Button variant="secondary" size="sm" onClick={() => props.duplicateElement(selected.element.id)}>Дублировать</Button>
              <Button variant="secondary" size="sm" onClick={props.pasteClipboard} disabled={!props.clipboard}>Вставить</Button>
            </div>
            <Button variant="danger" size="sm" onClick={() => props.deleteElement(selected.element.id)}>{'\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u043b\u0435\u043c\u0435\u043d\u0442'}</Button>
          </div>
        </>
      )}

      {!selected && (
        <div className="props-empty-state">
          <p>{'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0435\u043a\u0446\u0438\u044e, \u043a\u043e\u043b\u043e\u043d\u043a\u0443 \u0438\u043b\u0438 \u044d\u043b\u0435\u043c\u0435\u043d\u0442 \u0432 \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435 \u0434\u043b\u044f \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438'}</p>
        </div>
      )}

      <div className="page-settings">
        <h4>{'\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b'}</h4>
        <Input label="Название" value={props.activePage.title} onChange={(event) => props.updatePageField('title', event.target.value)} />
        <Input label="URL" value={props.activePage.slug} onChange={(event) => props.updatePageField('slug', event.target.value)} />
      </div>
    </>
  );
}
// Редактор содержимого конкретного элемента:
function ElementEditor({ element, tours, updateData, uploadSingleImage, uploadGallery }: { element: BuilderElement; tours: any[]; updateData: (elementId: string, field: string, value: any) => void; uploadSingleImage: (callback: (url: string) => void) => void; uploadGallery: (element: BuilderElement) => void }) {
  if (element.type === 'heading') {
    return (
      <>
        <Input label="Текст" value={element.data.text} onChange={(event) => updateData(element.id, 'text', event.target.value)} />
        <div className="theme-field">
          <label>Уровень</label>
          <select className="theme-select" value={element.data.level} onChange={(event) => updateData(element.id, 'level', event.target.value)}>
            <option value="h1">H1</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
          </select>
        </div>
      </>
    );
  }
  if (element.type === 'text') {
    return <Textarea label="Текст" value={element.data.text} onChange={(event) => updateData(element.id, 'text', event.target.value)} style={{ minHeight: 130 }} />;
  }
  if (element.type === 'button') {
    return (
      <>
        <Input label="Текст кнопки" value={element.data.text} onChange={(event) => updateData(element.id, 'text', event.target.value)} />
        <Input label="Ссылка" value={element.data.href} onChange={(event) => updateData(element.id, 'href', event.target.value)} />
        <div className="theme-field">
          <label>Вид</label>
          <select className="theme-select" value={element.data.variant} onChange={(event) => updateData(element.id, 'variant', event.target.value)}>
            <option value="filled">Заливка</option>
            <option value="outline">Контур</option>
          </select>
        </div>
      </>
    );
  }
  if (element.type === 'backButton') {
    return (
      <>
        <Input label="Текст" value={element.data.text} onChange={(event) => updateData(element.id, 'text', event.target.value)} />
        <div className="theme-field">
          <label>Действие</label>
          <select className="theme-select" value={element.data.mode} onChange={(event) => updateData(element.id, 'mode', event.target.value)}>
            <option value="history">История браузера</option>
            <option value="link">Ссылка</option>
          </select>
        </div>
        {element.data.mode === 'link' && <Input label="Ссылка" value={element.data.href} onChange={(event) => updateData(element.id, 'href', event.target.value)} />}
      </>
    );
  }
  if (element.type === 'image') {
    return (
      <>
        <Input label="URL изображения" value={element.data.src?.startsWith('data:') ? '' : element.data.src || ''} onChange={(event) => updateData(element.id, 'src', event.target.value)} />
        <Button variant="secondary" size="sm" onClick={() => uploadSingleImage((src) => updateData(element.id, 'src', src))}>Загрузить изображение</Button>
        <Input label="Alt" value={element.data.alt || ''} onChange={(event) => updateData(element.id, 'alt', event.target.value)} />
      </>
    );
  }
  if (element.type === 'gallery') {
    return (
      <>
        <NumberField label="Колонок в галерее" value={element.data.columns || 3} min={1} max={6} onChange={(columns) => updateData(element.id, 'columns', columns)} />
        <Button variant="secondary" size="sm" onClick={() => uploadGallery(element)}>Загрузить изображения</Button>
        <Textarea label="URL изображений" value={(element.data.images || []).filter((url: string) => !url.startsWith('data:')).join('\n')} onChange={(event) => {
          const dataUrls = (element.data.images || []).filter((url: string) => url.startsWith('data:'));
          updateData(element.id, 'images', [...dataUrls, ...event.target.value.split('\n').filter(Boolean)]);
        }} />
      </>
    );
  }
  if (element.type === 'video') {
    return (
      <>
        <Input label="Ссылка на видео" value={element.data.url || ''} placeholder="https://www.youtube.com/watch?v=..." onChange={(event) => updateData(element.id, 'url', event.target.value)} />
        <Input label="Название" value={element.data.title || ''} onChange={(event) => updateData(element.id, 'title', event.target.value)} />
      </>
    );
  }
  if (element.type === 'divider') {
    return (
      <>
        <NumberField label="Толщина линии" value={element.data.thickness || 1} min={1} max={12} onChange={(thickness) => updateData(element.id, 'thickness', thickness)} />
        <div className="theme-field">
          <label>Стиль</label>
          <select className="theme-select" value={element.data.lineStyle || 'solid'} onChange={(event) => updateData(element.id, 'lineStyle', event.target.value)}>
            <option value="solid">Сплошная</option>
            <option value="dashed">Пунктир</option>
            <option value="dotted">Точки</option>
          </select>
        </div>
      </>
    );
  }
  if (element.type === 'spacer') {
    return <NumberField label="Высота" value={element.data.height || 40} min={8} max={240} onChange={(height) => updateData(element.id, 'height', height)} />;
  }
  if (element.type === 'box') {
    return <Textarea label="Содержимое бокса" value={element.data.text} onChange={(event) => updateData(element.id, 'text', event.target.value)} style={{ minHeight: 100 }} />;
  }
  if (element.type === 'list') {
    return (
      <>
        <Input label="Заголовок" value={element.data.heading} onChange={(event) => updateData(element.id, 'heading', event.target.value)} />
        <Textarea label="Пункты, каждый с новой строки" value={(element.data.items || []).join('\n')} onChange={(event) => updateData(element.id, 'items', event.target.value.split('\n').filter(Boolean))} />
        <label className="tour-select-item"><input type="checkbox" checked={!!element.data.ordered} onChange={(event) => updateData(element.id, 'ordered', event.target.checked)} /> <span>Нумерованный список</span></label>
      </>
    );
  }
  if (element.type === 'social') {
    return (
      <>
        {['instagram', 'facebook', 'vk', 'telegram', 'youtube'].map((name) => (
          <Input key={name} label={name} value={element.data[name] || ''} onChange={(event) => updateData(element.id, name, event.target.value)} />
        ))}
        <div className="theme-field">
          <label>Вид</label>
          <select className="theme-select" value={element.data.style || 'filled'} onChange={(event) => updateData(element.id, 'style', event.target.value)}>
            <option value="filled">Цветные кнопки</option>
            <option value="mono">Монохром</option>
          </select>
        </div>
      </>
    );
  }
  if (element.type === 'menu') {
    return (
      <>
        <Input label="ID якоря" value={element.data.anchor} onChange={(event) => updateData(element.id, 'anchor', event.target.value)} />
        <Input label="Подпись" value={element.data.label} onChange={(event) => updateData(element.id, 'label', event.target.value)} />
      </>
    );
  }
  if (element.type === 'form') {
    return (
      <>
        <Input label="Заголовок" value={element.data.heading} onChange={(event) => updateData(element.id, 'heading', event.target.value)} />
        <Textarea label="Поля формы" value={(element.data.fields || []).join('\n')} onChange={(event) => updateData(element.id, 'fields', event.target.value.split('\n').filter(Boolean))} />
        <Input label="Текст кнопки" value={element.data.buttonText} onChange={(event) => updateData(element.id, 'buttonText', event.target.value)} />
      </>
    );
  }
  if (element.type === 'map') {
    return (
      <>
        <Input label="Адрес" value={element.data.address} onChange={(event) => updateData(element.id, 'address', event.target.value)} />
        <Input label="Широта" value={String(element.data.lat || '')} onChange={(event) => updateData(element.id, 'lat', Number(event.target.value))} />
        <Input label="Долгота" value={String(element.data.lng || '')} onChange={(event) => updateData(element.id, 'lng', Number(event.target.value))} />
        <NumberField label="Масштаб карты" value={element.data.zoom || 13} min={3} max={18} onChange={(zoom) => updateData(element.id, 'zoom', zoom)} />
      </>
    );
  }
  if (element.type === 'embed') {
    return <Textarea label="Код / HTML" value={element.data.code} onChange={(event) => updateData(element.id, 'code', event.target.value)} style={{ minHeight: 120 }} />;
  }
  if (element.type === 'tours') {
    const ids: string[] = element.data.selectedTourIds || [];
    const publishedTours = tours.filter((tour) => tour.status === 'published');
    return (
      <>
        <Input label="Заголовок" value={element.data.heading} onChange={(event) => updateData(element.id, 'heading', event.target.value)} />
        <NumberField label="Колонок" value={element.data.columns || 2} min={1} max={4} onChange={(columns) => updateData(element.id, 'columns', columns)} />
        <div className="theme-field">
          <label>Экскурсии на сайте</label>
          <select
            className="theme-select"
            value={ids.length === 0 ? 'all' : 'selected'}
            onChange={(event) => updateData(element.id, 'selectedTourIds', event.target.value === 'all' ? [] : publishedTours.slice(0, 3).map((tour) => tour.id))}
          >
            <option value="all">Все опубликованные</option>
            <option value="selected">Выбрать вручную</option>
          </select>
        </div>
        {ids.length > 0 && (
          <div className="tour-select-list">
            <select
              className="tour-multi-select"
              multiple
              value={ids}
              onChange={(event) => updateData(element.id, 'selectedTourIds', Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
            >
              {publishedTours.map((tour) => (
                <option key={tour.id} value={tour.id}>{tour.title}</option>
              ))}
            </select>
            <small className="tour-select-hint">Выбрано: {ids.length}. Для выбора нескольких используйте Ctrl или Shift.</small>
          </div>
        )}
        {ids.length > 0 && publishedTours.length === 0 && <p className="tour-select-hint">Сначала опубликуйте экскурсии.</p>}
      </>
    );
  }
  return (
    <>
      <Input label="Заголовок" value={element.data.heading} onChange={(event) => updateData(element.id, 'heading', event.target.value)} />
      <Input label="Email" value={element.data.email} onChange={(event) => updateData(element.id, 'email', event.target.value)} />
      <Input label="Телефон" value={element.data.phone} onChange={(event) => updateData(element.id, 'phone', event.target.value)} />
      <Input label="Telegram" value={element.data.telegram} onChange={(event) => updateData(element.id, 'telegram', event.target.value)} />
      <Input label="Адрес" value={element.data.address} onChange={(event) => updateData(element.id, 'address', event.target.value)} />
    </>
  );
}

// Редактор общих CSS-параметров:
function StyleEditor({ style, onChange, compact }: { style: BuilderStyle; onChange: (patch: BuilderStyle) => void; compact?: boolean }) {
  return (
    <div className="style-editor">
      <ColorField label="Фон" value={style.background || 'transparent'} onChange={(background) => onChange({ background })} allowTransparent />
      <ColorField label="Цвет текста" value={style.color || '#0f172a'} onChange={(color) => onChange({ color })} />
      <NumberField label="Отступ внутри" value={style.padding ?? 0} min={0} max={120} onChange={(padding) => onChange({ padding })} />
      <NumberField label="Отступ снаружи" value={style.margin ?? 0} min={0} max={80} onChange={(margin) => onChange({ margin })} />
      <NumberField label="Скругление" value={style.radius ?? 0} min={0} max={48} onChange={(radius) => onChange({ radius })} />
      {!compact && <NumberField label="Толщина рамки" value={style.borderWidth ?? 0} min={0} max={8} onChange={(borderWidth) => onChange({ borderWidth })} />}
      {!compact && <ColorField label="Цвет рамки" value={style.borderColor || '#e2e8f0'} onChange={(borderColor) => onChange({ borderColor })} />}
      <div className="theme-field">
        <label>Тень</label>
        <select className="theme-select" value={style.shadow || 'none'} onChange={(event) => onChange({ shadow: event.target.value })}>
          <option value="none">Нет</option>
          <option value="0 8px 24px rgba(15,23,42,0.12)">Мягкая</option>
          <option value="0 16px 40px rgba(15,23,42,0.18)">Выраженная</option>
        </select>
      </div>
      <NumberField label="Размер текста" value={style.fontSize ?? 0} min={0} max={72} onChange={(fontSize) => onChange({ fontSize: fontSize || undefined })} />
      <NumberField label="Ширина элемента, %" value={style.width ?? 100} min={10} max={100} onChange={(width) => onChange({ width })} />
      <div className="theme-field">
        <label>Выравнивание</label>
        <select className="theme-select" value={style.align || 'left'} onChange={(event) => onChange({ align: event.target.value as BuilderStyle['align'] })}>
          <option value="left">Слева</option>
          <option value="center">По центру</option>
          <option value="right">Справа</option>
        </select>
      </div>
    </div>
  );
}

// Числовое поле со слайдером:
function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="theme-field">
      <label>{label}</label>
      <div className="number-row">
        <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      </div>
    </div>
  );
}

// Поле выбора цвета с палитрой и ручным вводом:
function ColorField({ label, value, onChange, allowTransparent }: { label: string; value: string; onChange: (value: string) => void; allowTransparent?: boolean }) {
  const palette = allowTransparent ? ['transparent', '#ffffff', '#f8fafc', '#eef2ff', '#ecfeff', '#fef3c7', '#0f172a'] : ['#0f172a', '#2563eb', '#7c3aed', '#059669', '#dc2626', '#d97706', '#ffffff'];
  return (
    <div className="theme-field">
      <label>{label}</label>
      <div className="color-picker-row">
        {palette.map((color) => (
          <button
            key={color}
            className={`color-swatch ${value === color ? 'active' : ''} ${color === 'transparent' ? 'transparent' : ''}`}
            style={{ background: color === 'transparent' ? 'linear-gradient(135deg, #fff 45%, #ef4444 46%, #ef4444 54%, #fff 55%)' : color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <div className="free-color-row">
        <input
          type="color"
          value={value && value !== 'transparent' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#2563eb'}
          onChange={(event) => onChange(event.target.value)}
        />
        <input className="color-text-input" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}
