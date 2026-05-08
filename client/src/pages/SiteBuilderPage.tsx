import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { api } from '../api/client';
import Button from '../components/ui/Button';
import Input, { Textarea } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import './SiteBuilderPage.css';

type ViewportMode = 'desktop' | 'tablet' | 'mobile';
type BuilderTab = 'sections' | 'elements' | 'templates' | 'pages' | 'theme';
type SectionLayout = '1' | '2' | '3' | '4' | 'asym-left' | 'asym-right';
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

interface BuilderElement {
  id: string;
  type: ElementType;
  data: Record<string, any>;
  style: BuilderStyle;
}

interface BuilderColumn {
  id: string;
  width: number;
  elements: BuilderElement[];
  style: BuilderStyle;
}

interface BuilderSection {
  id: string;
  layout: SectionLayout;
  columns: BuilderColumn[];
  style: BuilderStyle;
}

interface BuilderPage {
  id: string;
  title: string;
  slug: string;
  sections: BuilderSection[];
}

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
  logoText: string;
  logoImage: string;
}

type Selection =
  | { type: 'header' }
  | { type: 'section'; sectionId: string }
  | { type: 'column'; sectionId: string; columnId: string }
  | { type: 'element'; sectionId: string; columnId: string; elementId: string };

type BuilderSelected =
  | { kind: 'header' }
  | { kind: 'section'; section: BuilderSection }
  | { kind: 'column'; section: BuilderSection; column: BuilderColumn }
  | { kind: 'element'; section: BuilderSection; column: BuilderColumn; element: BuilderElement };

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
  logoText: '',
  logoImage: '',
};

const sectionLayouts: Record<SectionLayout, { label: string; widths: number[] }> = {
  '1': { label: '1 РєРѕР»РѕРЅРєР°', widths: [100] },
  '2': { label: '2 РєРѕР»РѕРЅРєРё', widths: [50, 50] },
  '3': { label: '3 РєРѕР»РѕРЅРєРё', widths: [33, 34, 33] },
  '4': { label: '4 РєРѕР»РѕРЅРєРё', widths: [25, 25, 25, 25] },
  'asym-left': { label: 'РђСЃРёРјРјРµС‚СЂРёСЏ 70/30', widths: [70, 30] },
  'asym-right': { label: 'РђСЃРёРјРјРµС‚СЂРёСЏ 30/70', widths: [30, 70] },
};

const elementLabels: Record<ElementType, { label: string; icon: string }> = {
  heading: { label: 'Р—Р°РіРѕР»РѕРІРѕРє', icon: 'H' },
  text: { label: 'РўРµРєСЃС‚', icon: 'T' },
  button: { label: 'РљРЅРѕРїРєР°', icon: '>' },
  backButton: { label: 'РќР°Р·Р°Рґ', icon: '<' },
  image: { label: 'РР·РѕР±СЂР°Р¶РµРЅРёРµ', icon: 'в–Ў' },
  gallery: { label: 'Р“Р°Р»РµСЂРµСЏ', icon: 'в–¦' },
  video: { label: 'Р’РёРґРµРѕ', icon: 'в–¶' },
  divider: { label: 'Р›РёРЅРёСЏ', icon: 'в”Ђ' },
  spacer: { label: 'РћС‚СЃС‚СѓРї', icon: 'в†•' },
  box: { label: 'Р‘РѕРєСЃ', icon: 'в–Ј' },
  list: { label: 'РЎРїРёСЃРѕРє', icon: 'в‰Ў' },
  social: { label: 'РЎРѕС†СЃРµС‚Рё', icon: '#' },
  menu: { label: 'РњРµРЅСЋ/СЏРєРѕСЂСЊ', icon: 'вЊЃ' },
  form: { label: 'Р¤РѕСЂРјР°', icon: 'вњЋ' },
  map: { label: 'РљР°СЂС‚Р°', icon: 'вЊ–' },
  embed: { label: 'РљРѕРґ', icon: '</>' },
  tours: { label: 'Р­РєСЃРєСѓСЂСЃРёРё', icon: 'в—†' },
  contacts: { label: 'РљРѕРЅС‚Р°РєС‚С‹', icon: '@' },
};

const elementGroups: { title: string; items: ElementType[] }[] = [
  { title: 'Р‘Р°Р·РѕРІС‹Рµ', items: ['heading', 'text', 'button', 'backButton', 'divider', 'spacer', 'box'] },
  { title: 'РњРµРґРёР°', items: ['image', 'gallery', 'video'] },
  { title: 'РЎС‚СЂСѓРєС‚СѓСЂР°', items: ['menu', 'list', 'embed'] },
  { title: 'Р‘РёР·РЅРµСЃ', items: ['tours', 'contacts', 'form', 'map', 'social'] },
];

const sectionTemplateGroups = [
  { title: 'РџСЂРёРІРµС‚СЃС‚РІРёРµ', items: ['hero-split', 'hero-center'] },
  { title: 'Рћ РЅР°СЃ', items: ['about-photo', 'features'] },
  { title: 'РљРѕРЅС‚Р°РєС‚С‹', items: ['contacts-strip', 'contacts-form'] },
  { title: 'РџСЂРѕРґР°Р¶Рё', items: ['services', 'reviews', 'cta'] },
] as const;

function templateLabel(template: string) {
  const labels: Record<string, string> = {
    'hero-split': 'Hero СЃ РёР·РѕР±СЂР°Р¶РµРЅРёРµРј',
    'hero-center': 'Р¦РµРЅС‚СЂР°Р»СЊРЅС‹Р№ hero',
    'about-photo': 'Рћ РЅР°СЃ СЃ С„РѕС‚Рѕ',
    features: 'РџСЂРµРёРјСѓС‰РµСЃС‚РІР°',
    'contacts-strip': 'РљРѕРЅС‚Р°РєС‚С‹ РїРѕР»РѕСЃРѕР№',
    'contacts-form': 'РљРѕРЅС‚Р°РєС‚С‹ + С„РѕСЂРјР°',
    services: 'РЈСЃР»СѓРіРё',
    reviews: 'РћС‚Р·С‹РІС‹',
    cta: 'РџСЂРёР·С‹РІ Рє РґРµР№СЃС‚РІРёСЋ',
  };
  return labels[template] || template;
}

function templateDescription(template: string) {
  const descriptions: Record<string, string> = {
    'hero-split': 'Р—Р°РіРѕР»РѕРІРѕРє, С‚РµРєСЃС‚, CTA Рё РєСЂСѓРїРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ',
    'hero-center': 'Р¦РµРЅС‚СЂР°Р»СЊРЅС‹Р№ РїРµСЂРІС‹Р№ СЌРєСЂР°РЅ РґР»СЏ РїСЂРѕРјРѕ',
    'about-photo': 'Р¤РѕС‚Рѕ, РѕРїРёСЃР°РЅРёРµ Рё СЃРїРёСЃРѕРє РїСЂРµРёРјСѓС‰РµСЃС‚РІ',
    features: 'РўСЂРё РєР°СЂС‚РѕС‡РєРё РїСЂРµРёРјСѓС‰РµСЃС‚РІ РёР»Рё С„Р°РєС‚РѕРІ',
    'contacts-strip': 'РљРѕСЂРѕС‚РєР°СЏ РєРѕРЅС‚Р°РєС‚РЅР°СЏ РїРѕР»РѕСЃР°',
    'contacts-form': 'РљРѕРЅС‚Р°РєС‚С‹ СЂСЏРґРѕРј СЃ С„РѕСЂРјРѕР№ Р·Р°СЏРІРєРё',
    services: 'РўСЂРё СѓСЃР»СѓРіРё СЃ РѕРїРёСЃР°РЅРёСЏРјРё',
    reviews: 'РљР°СЂС‚РѕС‡РєРё РѕС‚Р·С‹РІРѕРІ СЃ Р°РєРєСѓСЂР°С‚РЅРѕР№ СЃРµС‚РєРѕР№',
    cta: 'Р¤РёРЅР°Р»СЊРЅС‹Р№ РїСЂРёР·С‹РІ Рє РґРµР№СЃС‚РІРёСЋ',
  };
  return descriptions[template] || 'Р“РѕС‚РѕРІР°СЏ СЃРµРєС†РёСЏ';
}

function getMapEmbedUrl(data: Record<string, any>) {
  if (data.embedUrl) return data.embedUrl;
  const lat = Number(data.lat) || 59.939;
  const lng = Number(data.lng) || 30.316;
  const delta = 0.018;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);
  return null;
}

function BuilderLeafletMap({ data, preview = false }: { data: Record<string, any>; preview?: boolean }) {
  const center: [number, number] = [Number(data.lat) || 59.939, Number(data.lng) || 30.316];
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

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createElement(type: ElementType): BuilderElement {
  const defaults: Record<ElementType, BuilderElement> = {
    heading: {
      id: uid('element'),
      type,
      data: { text: 'РќРѕРІС‹Р№ Р·Р°РіРѕР»РѕРІРѕРє', level: 'h2' },
      style: { padding: 0, margin: 8, fontSize: 28, align: 'left', color: '#0f172a', width: 100 },
    },
    text: {
      id: uid('element'),
      type,
      data: { text: 'Р”РѕР±Р°РІСЊС‚Рµ РѕРїРёСЃР°РЅРёРµ, РёСЃС‚РѕСЂРёСЋ РёР»Рё РїРѕР»РµР·РЅСѓСЋ РёРЅС„РѕСЂРјР°С†РёСЋ РґР»СЏ РїРѕСЃРµС‚РёС‚РµР»РµР№ СЃР°Р№С‚Р°.' },
      style: { padding: 0, margin: 8, fontSize: 15, align: 'left', color: '#475569', width: 100 },
    },
    button: {
      id: uid('element'),
      type,
      data: { text: 'РџРѕРґСЂРѕР±РЅРµРµ', href: '#', variant: 'filled' },
      style: { padding: 12, margin: 8, radius: 8, align: 'left', width: 40 },
    },
    backButton: {
      id: uid('element'),
      type,
      data: { text: 'РќР°Р·Р°Рґ', mode: 'history', href: '/' },
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
      data: { url: '', title: 'Р’РёРґРµРѕ' },
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
      data: { text: 'РљРѕРЅС‚РµР№РЅРµСЂ РґР»СЏ Р°РєС†РµРЅС‚Р°, РєР°СЂС‚РѕС‡РєРё РёР»Рё Р·Р°РјРµС‚РєРё' },
      style: { padding: 20, margin: 8, radius: 12, background: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', width: 100 },
    },
    list: {
      id: uid('element'),
      type,
      data: { heading: 'РЎРїРёСЃРѕРє', items: ['РџРµСЂРІС‹Р№ РїСѓРЅРєС‚', 'Р’С‚РѕСЂРѕР№ РїСѓРЅРєС‚', 'РўСЂРµС‚РёР№ РїСѓРЅРєС‚'], ordered: false },
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
      data: { anchor: 'section', label: 'РЇРєРѕСЂСЊ СЃРµРєС†РёРё' },
      style: { padding: 8, margin: 8, background: '#eef2ff', radius: 8, width: 60 },
    },
    form: {
      id: uid('element'),
      type,
      data: { heading: 'РћСЃС‚Р°РІРёС‚СЊ Р·Р°СЏРІРєСѓ', fields: ['РРјСЏ', 'Email', 'РЎРѕРѕР±С‰РµРЅРёРµ'], buttonText: 'РћС‚РїСЂР°РІРёС‚СЊ' },
      style: { padding: 20, margin: 8, radius: 12, background: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', width: 100 },
    },
    map: {
      id: uid('element'),
      type,
      data: { address: 'РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРі', lat: 59.939, lng: 30.316, zoom: 13, embedUrl: '' },
      style: { padding: 0, margin: 8, radius: 12, width: 100 },
    },
    embed: {
      id: uid('element'),
      type,
      data: { code: '<div>HTML-РєРѕРґ</div>' },
      style: { padding: 16, margin: 8, background: '#0f172a', color: '#ffffff', radius: 8, width: 100 },
    },
    tours: {
      id: uid('element'),
      type,
      data: { heading: 'Р”РѕСЃС‚СѓРїРЅС‹Рµ СЌРєСЃРєСѓСЂСЃРёРё', columns: 2, selectedTourIds: [] },
      style: { padding: 0, margin: 8, width: 100 },
    },
    contacts: {
      id: uid('element'),
      type,
      data: { heading: 'РЎРІСЏР·Р°С‚СЊСЃСЏ СЃРѕ РјРЅРѕР№', email: '', phone: '', telegram: '', address: '' },
      style: { padding: 0, margin: 8, width: 100 },
    },
  };
  return defaults[type];
}

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

function createSectionTemplate(template: string): BuilderSection {
  if (template === 'hero-split') {
    const section = createSection('2');
    section.style = { ...section.style, background: '#f8fafc', padding: 48 };
    section.columns[0].elements = [
      { ...createElement('heading'), data: { text: 'РќРѕРІР°СЏ СЌРєСЃРєСѓСЂСЃРёСЏ РїРѕ РіРѕСЂРѕРґСѓ', level: 'h1' }, style: { padding: 0, margin: 8, fontSize: 40, align: 'left', color: '#0f172a', width: 100 } },
      { ...createElement('text'), data: { text: 'Р Р°СЃСЃРєР°Р¶РёС‚Рµ, С‡РµРј СѓРЅРёРєР°Р»РµРЅ РІР°С€ РјР°СЂС€СЂСѓС‚, РєРѕРјСѓ РѕРЅ РїРѕРґС…РѕРґРёС‚ Рё РїРѕС‡РµРјСѓ РµРіРѕ СЃС‚РѕРёС‚ РїСЂРѕР№С‚Рё.' } },
      { ...createElement('button'), data: { text: 'Р’С‹Р±СЂР°С‚СЊ РјР°СЂС€СЂСѓС‚', href: '#tours', variant: 'filled' } },
    ];
    section.columns[1].elements = [{ ...createElement('image'), style: { padding: 0, margin: 8, radius: 18, width: 100 } }];
    return section;
  }
  if (template === 'hero-center') {
    const section = createSection('1');
    section.style = { ...section.style, background: '#0f172a', color: '#ffffff', padding: 64 };
    section.columns[0].elements = [
      { ...createElement('heading'), data: { text: 'РђРІС‚РѕСЂСЃРєРёРµ РјР°СЂС€СЂСѓС‚С‹ СЂСЏРґРѕРј СЃ РІР°РјРё', level: 'h1' }, style: { padding: 0, margin: 8, fontSize: 42, align: 'center', color: '#ffffff', width: 100 } },
      { ...createElement('text'), data: { text: 'РРЅРґРёРІРёРґСѓР°Р»СЊРЅС‹Рµ СЌРєСЃРєСѓСЂСЃРёРё СЃ РєР°СЂС‚РѕР№, С‚РѕС‡РєР°РјРё РёРЅС‚РµСЂРµСЃР° Рё РјСѓР»СЊС‚РёРјРµРґРёР№РЅС‹Рј СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµРј.' }, style: { padding: 0, margin: 8, fontSize: 17, align: 'center', color: '#cbd5e1', width: 100 } },
      { ...createElement('button'), data: { text: 'РќР°С‡Р°С‚СЊ', href: '#tours', variant: 'outline' }, style: { padding: 12, margin: 8, radius: 999, align: 'center', width: 28 } },
    ];
    return section;
  }
  if (template === 'about-photo') {
    const section = createSection('2');
    section.columns[0].elements = [{ ...createElement('image'), style: { padding: 0, margin: 8, radius: 16, width: 100 } }];
    section.columns[1].elements = [
      { ...createElement('heading'), data: { text: 'Рћ РїСЂРѕРµРєС‚Рµ', level: 'h2' } },
      { ...createElement('text'), data: { text: 'Р”РѕР±Р°РІСЊС‚Рµ РёРЅС„РѕСЂРјР°С†РёСЋ РѕР± Р°РІС‚РѕСЂРµ, РѕРїС‹С‚Рµ, РїРѕРґС…РѕРґРµ Рє СЌРєСЃРєСѓСЂСЃРёСЏРј Рё РѕСЃРѕР±РµРЅРЅРѕСЃС‚СЏС… РјР°СЂС€СЂСѓС‚РѕРІ.' } },
      { ...createElement('list'), data: { heading: 'РџСЂРµРёРјСѓС‰РµСЃС‚РІР°', items: ['РЎР°РјРѕСЃС‚РѕСЏС‚РµР»СЊРЅРѕРµ РїСЂРѕС…РѕР¶РґРµРЅРёРµ', 'РњРµРґРёР° РІ С‚РѕС‡РєР°С… РјР°СЂС€СЂСѓС‚Р°', 'РЈРґРѕР±РЅС‹Р№ РІРµР±-РїР»РµРµСЂ'], ordered: false } },
    ];
    return section;
  }
  if (template === 'features') {
    const section = createSection('3');
    section.columns.forEach((column, index) => {
      column.elements = [
        { ...createElement('box'), data: { text: ['Р“РµРѕР»РѕРєР°С†РёСЏ', 'РњСѓР»СЊС‚РёРјРµРґРёР°', 'РџСѓР±Р»РёРєР°С†РёСЏ'][index] }, style: { padding: 22, margin: 8, radius: 14, background: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', width: 100 } },
      ];
    });
    return section;
  }
  if (template === 'contacts-strip') {
    const section = createSection('3');
    section.style = { ...section.style, background: '#f8fafc', padding: 28 };
    section.columns[0].elements = [{ ...createElement('box'), data: { text: 'РђРґСЂРµСЃ\nРЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРі' } }];
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
        { ...createElement('heading'), data: { text: ['Р“РѕСЂРѕРґСЃРєРёРµ РїСЂРѕРіСѓР»РєРё', 'РњСѓР·РµР№РЅС‹Рµ РјР°СЂС€СЂСѓС‚С‹', 'РЎРµРјРµР№РЅС‹Рµ СЌРєСЃРєСѓСЂСЃРёРё'][index], level: 'h3' }, style: { padding: 0, margin: 8, fontSize: 20, width: 100 } },
        { ...createElement('text'), data: { text: 'РљСЂР°С‚РєРѕ РѕРїРёС€РёС‚Рµ СѓСЃР»СѓРіСѓ, С„РѕСЂРјР°С‚ Рё С†РµРЅРЅРѕСЃС‚СЊ РґР»СЏ РїРѕСЃРµС‚РёС‚РµР»СЏ.' } },
      ];
    });
    return section;
  }
  if (template === 'reviews') {
    const section = createSection('3');
    section.style = { ...section.style, background: '#f8fafc', padding: 44 };
    section.columns.forEach((column, index) => {
      const names = ['РђРЅРЅР° РЎРјРёСЂРЅРѕРІР°', 'РР»СЊСЏ РњРѕСЂРѕР·РѕРІ', 'Р•РєР°С‚РµСЂРёРЅР° Р›РµР±РµРґРµРІР°'];
      const texts = [
        'РњР°СЂС€СЂСѓС‚ РїРѕР»СѓС‡РёР»СЃСЏ Р¶РёРІС‹Рј: РєР°СЂС‚Р° РІРµР»Р° РїРѕРЅСЏС‚РЅРѕ, Р° РёСЃС‚РѕСЂРёРё РІ С‚РѕС‡РєР°С… РґРѕР±Р°РІР»СЏР»Рё РєРѕРЅС‚РµРєСЃС‚.',
        'РЈРґРѕР±РЅРѕ РёРґС‚Рё РІ СЃРІРѕРµРј С‚РµРјРїРµ. РћСЃРѕР±РµРЅРЅРѕ РїРѕРЅСЂР°РІРёР»РёСЃСЊ РјРµРґРёР° Рё РєРѕСЂРѕС‚РєРёРµ РїРѕРґСЃРєР°Р·РєРё.',
        'РҐРѕСЂРѕС€РёР№ С„РѕСЂРјР°С‚ РґР»СЏ РїСЂРѕРіСѓР»РєРё РїРѕ РіРѕСЂРѕРґСѓ: РЅРµ РЅР°РґРѕ РёСЃРєР°С‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ РѕС‚РґРµР»СЊРЅРѕ.',
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
    { ...createElement('heading'), data: { text: 'Р“РѕС‚РѕРІС‹ РЅР°С‡Р°С‚СЊ?', level: 'h2' }, style: { padding: 0, margin: 8, fontSize: 30, align: 'center', width: 100 } },
    { ...createElement('button'), data: { text: 'РЎРІСЏР·Р°С‚СЊСЃСЏ', href: '#contacts', variant: 'filled' }, style: { padding: 12, margin: 8, radius: 10, align: 'center', width: 24 } },
  ];
  return section;
}

function getInitialPages(): BuilderPage[] {
  const hero = createSection('2');
  hero.style = { ...hero.style, background: '#f8fafc', padding: 40 };
  hero.columns[0].elements = [
    { ...createElement('heading'), data: { text: 'РђРІС‚РѕСЂСЃРєРёРµ СЌРєСЃРєСѓСЂСЃРёРё', level: 'h1' }, style: { padding: 0, margin: 8, fontSize: 36, align: 'left', color: '#0f172a', width: 100 } },
    { ...createElement('text'), data: { text: 'РЎРѕР±РµСЂРёС‚Рµ СЃС‚СЂР°РЅРёС†Сѓ С‚Р°Рє, РєР°Рє РЅСѓР¶РЅРѕ РёРјРµРЅРЅРѕ РІР°С€РµРјСѓ РїСЂРѕРµРєС‚Сѓ: СЃРµРєС†РёРё, РєРѕР»РѕРЅРєРё, РјРµРґРёР°, РјР°СЂС€СЂСѓС‚С‹ Рё РєРѕРЅС‚Р°РєС‚С‹.' } },
    { ...createElement('button'), data: { text: 'РЎРјРѕС‚СЂРµС‚СЊ СЌРєСЃРєСѓСЂСЃРёРё', href: '#tours', variant: 'filled' } },
  ];
  hero.columns[1].elements = [{ ...createElement('image'), data: { src: '', alt: 'РћР±Р»РѕР¶РєР°', fit: 'cover' } }];

  const tours = createSection('1');
  tours.columns[0].elements = [{ ...createElement('tours'), data: { heading: 'Р”РѕСЃС‚СѓРїРЅС‹Рµ СЌРєСЃРєСѓСЂСЃРёРё', columns: 3, selectedTourIds: [] } }];

  return [
    { id: 'page-main', title: 'Р“Р»Р°РІРЅР°СЏ', slug: '', sections: [hero, tours] },
    { id: 'page-contacts', title: 'РљРѕРЅС‚Р°РєС‚С‹', slug: 'contacts', sections: [createSection('1')] },
  ];
}

function migratePages(data: any): BuilderPage[] {
  if (!data?.pages) return getInitialPages();
  return data.pages.map((page: any) => {
    if (page.sections) return page;
    const sections = (page.blocks || []).map((block: any) => {
      const section = createSection('1');
      const typeMap: Record<string, ElementType> = {
        banner: 'heading',
        about: 'text',
        tours: 'tours',
        contacts: 'contacts',
        text: 'text',
        gallery: 'gallery',
      };
      const element = createElement(typeMap[block.type] || 'text');
      if (block.type === 'banner') {
        element.data = { text: block.data.title || 'Р—Р°РіРѕР»РѕРІРѕРє', level: 'h1', subtitle: block.data.subtitle };
        element.style.fontSize = 36;
        section.style.background = block.data.bgColor || '#ffffff';
        section.style.color = block.data.textColor;
      } else if (block.type === 'text') {
        element.data = { text: block.data.content || '', heading: block.data.heading };
      } else {
        element.data = block.data || element.data;
      }
      section.columns[0].elements = [element];
      return section;
    });
    return { id: page.id, title: page.title, slug: page.slug, sections };
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

function getFontFamily(font: string) {
  if (font === 'serif') return 'Georgia, serif';
  if (font === 'mono') return 'monospace';
  return 'inherit';
}

export default function SiteBuilderPage() {
  const [site, setSite] = useState<any>(null);
  const [pages, setPages] = useState<BuilderPage[]>(getInitialPages);
  const [siteSlug, setSiteSlug] = useState('maxim-furzikov');
  const [activePageId, setActivePageId] = useState('page-main');
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  const [tab, setTab] = useState<BuilderTab>('sections');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [zoom, setZoom] = useState(100);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [tours, setTours] = useState<any[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [draggedElement, setDraggedElement] = useState<{ sectionId: string; columnId: string; elementId: string } | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const restoreRef = useRef(false);
  const historyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    api.getShowcase('maxim-furzikov')
      .then((d: any) => setSite(d))
      .catch(() => api.getShowcase('aleksey-petrov').then((d: any) => setSite({ ...d, title: 'Р­РєСЃРєСѓСЂСЃРёРё РњР°РєСЃРёРјР° Р¤СѓСЂР·РёРєРѕРІР°', slug: 'maxim-furzikov' })));
    api.getExcursions().then((d: any) => setTours(d));
    api.getConstructorData()
      .then((d: any) => {
        const loaded = migratePages(d);
        setPages(loaded);
        if (d?.theme) setTheme({ ...defaultTheme, ...d.theme });
        if (d?.siteSlug) setSiteSlug(d.siteSlug);
        if (loaded.length > 0) setActivePageId(loaded[0].id);
      })
      .catch(() => {});
  }, []);

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
        return [...base, snapshot].slice(-50);
      });
      setHistoryIndex((index) => Math.min(index + 1, 49));
    }, 350);
  }, [pages, theme, site]);

  const restoreSnapshot = (index: number) => {
    const snapshot = history[index];
    if (!snapshot) return;
    const parsed = JSON.parse(snapshot);
    restoreRef.current = true;
    setPages(parsed.pages);
    setTheme({ ...defaultTheme, ...parsed.theme });
    setHistoryIndex(index);
  };

  const undo = () => restoreSnapshot(Math.max(0, historyIndex - 1));
  const redo = () => restoreSnapshot(Math.min(history.length - 1, historyIndex + 1));

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

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

  const updateActivePage = (updater: (page: BuilderPage) => BuilderPage) => {
    setPages((current) => current.map((page) => (page.id === activePageId ? updater(page) : page)));
  };

  const addPage = () => {
    const id = uid('page');
    setPages((current) => [...current, { id, title: 'РќРѕРІР°СЏ СЃС‚СЂР°РЅРёС†Р°', slug: `page-${current.length + 1}`, sections: [] }]);
    setActivePageId(id);
    setSelection(null);
  };

  const deletePage = (pageId: string) => {
    if (pages.length <= 1) return;
    const next = pages.filter((page) => page.id !== pageId);
    setPages(next);
    if (activePageId === pageId) setActivePageId(next[0].id);
  };

  const updatePageField = (field: 'title' | 'slug', value: string) => {
    setPages((current) => current.map((page) => (page.id === activePageId ? { ...page, [field]: value } : page)));
  };

  const addSection = (layout: SectionLayout) => {
    const section = createSection(layout);
    updateActivePage((page) => ({ ...page, sections: [...page.sections, section] }));
    setSelection({ type: 'section', sectionId: section.id });
    setTab('sections');
  };

  const addSectionTemplate = (template: string) => {
    const section = createSectionTemplate(template);
    updateActivePage((page) => ({ ...page, sections: [...page.sections, section] }));
    setSelection({ type: 'section', sectionId: section.id });
    setTab('sections');
  };

  const updateSection = (sectionId: string, patch: Partial<BuilderSection>) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)),
    }));
  };

  const updateSectionStyle = (sectionId: string, patch: BuilderStyle) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => (
        section.id === sectionId ? { ...section, style: { ...section.style, ...patch } } : section
      )),
    }));
  };

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

  const deleteSection = (sectionId: string) => {
    updateActivePage((page) => ({ ...page, sections: page.sections.filter((section) => section.id !== sectionId) }));
    setSelection(null);
  };

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

  const updateColumn = (sectionId: string, columnId: string, patch: Partial<BuilderColumn>) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => section.id === sectionId ? {
        ...section,
        columns: section.columns.map((column) => column.id === columnId ? { ...column, ...patch } : column),
      } : section),
    }));
  };

  const updateColumnStyle = (sectionId: string, columnId: string, patch: BuilderStyle) => {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) => section.id === sectionId ? {
        ...section,
        columns: section.columns.map((column) => column.id === columnId ? { ...column, style: { ...column.style, ...patch } } : column),
      } : section),
    }));
  };

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

  const savePayload = { pages, theme, siteSlug, version: 2 };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      await api.saveDraft(savePayload);
      setStatusMsg('Р§РµСЂРЅРѕРІРёРє СЃРѕС…СЂР°РЅРµРЅ');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch {
      setStatusMsg('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setStatusMsg(null);
    try {
      await api.saveConstructor(savePayload);
      setStatusMsg('РЎР°Р№С‚ РѕРїСѓР±Р»РёРєРѕРІР°РЅ');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch {
      setStatusMsg('РћС€РёР±РєР° РїСѓР±Р»РёРєР°С†РёРё');
    }
    setPublishing(false);
  };

  if (!site || !activePage) return <p style={{ padding: 20 }}>Р—Р°РіСЂСѓР·РєР°...</p>;

  return (
    <div className={`constructor-layout ${!leftPanelOpen ? 'left-collapsed' : ''} ${!rightPanelOpen ? 'right-collapsed' : ''}`}>
      {leftPanelOpen && (
      <div className="constructor-left">
        <div className="constructor-left-header">
          <h3>РљРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ СЃР°Р№С‚Р°</h3>
          <div className="panel-header-actions">
            <Badge variant={site.published ? 'success' : 'default'}>
              {site.published ? 'РћРЅР»Р°Р№РЅ' : 'Р§РµСЂРЅРѕРІРёРє'}
            </Badge>
            <button className="panel-toggle-btn" type="button" onClick={() => setLeftPanelOpen(false)} title="РЎРєСЂС‹С‚СЊ РїР°РЅРµР»СЊ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂР°">
              в†ђ
            </button>
          </div>
        </div>

        <div className="constructor-tabs vertical-tabs">
          {[
            ['sections', 'РЎРµРєС†РёРё', 'в–¤'],
            ['elements', 'Р­Р»РµРјРµРЅС‚С‹', '+'],
            ['templates', 'РЁР°Р±Р»РѕРЅС‹', 'в–§'],
            ['pages', 'РЎС‚СЂР°РЅРёС†С‹', 'в‰Ў'],
            ['theme', 'РўРµРјР°', 'в—ђ'],
          ].map(([id, label, icon]) => (
            <button key={id} className={`ctab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id as BuilderTab)}>
              <span className="ctab-icon">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {tab === 'sections' && (
          <div className="constructor-panel">
            <p className="panel-label">РЎРµРєС†РёРё СЃС‚СЂР°РЅРёС†С‹ "{activePage.title}"</p>
            <div className="block-list">
              <div className={`block-list-item ${selection?.type === 'header' ? 'selected' : ''}`} onClick={() => setSelection({ type: 'header' })}>
                <span className="block-icon">в‰Ў</span>
                <span className="block-label">РЁР°РїРєР° СЃР°Р№С‚Р°</span>
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
                  <span className="block-icon">в°</span>
                  <span className="block-label">РЎРµРєС†РёСЏ {index + 1} В· {sectionLayouts[section.layout].label}</span>
                  <button className="block-action-btn danger" onClick={(event) => { event.stopPropagation(); deleteSection(section.id); }}>Г—</button>
                </div>
              ))}
            </div>
            <p className="panel-label" style={{ marginTop: 16 }}>Р”РѕР±Р°РІРёС‚СЊ СЃРµРєС†РёСЋ</p>
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
          <div className="constructor-panel">
            <p className="panel-label">Р“РѕС‚РѕРІС‹Рµ СЃРµРєС†РёРё</p>
            <div className="template-groups">
              {sectionTemplateGroups.map((group) => (
                <div key={group.title} className="template-group">
                  <h4>{group.title}</h4>
                  {group.items.map((template) => (
                    <button key={template} className={`template-btn template-${template}`} onClick={() => addSectionTemplate(template)}>
                      <span className="template-preview">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span>
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
          <div className="constructor-panel">
            <p className="panel-label">Р”РѕР±Р°РІРёС‚СЊ РІ РІС‹Р±СЂР°РЅРЅСѓСЋ РєРѕР»РѕРЅРєСѓ</p>
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
            <p className="panel-hint">Р­Р»РµРјРµРЅС‚С‹ РјРѕР¶РЅРѕ РїРµСЂРµС‚Р°СЃРєРёРІР°С‚СЊ РјРµР¶РґСѓ РєРѕР»РѕРЅРєР°РјРё РїСЂСЏРјРѕ РІ РїСЂРµРґРїСЂРѕСЃРјРѕС‚СЂРµ.</p>
          </div>
        )}

        {tab === 'pages' && (
          <div className="constructor-panel">
            <p className="panel-label">РЎС‚СЂР°РЅРёС†С‹ СЃР°Р№С‚Р°</p>
            <div className="page-list">
              {pages.map((page) => (
                <div key={page.id} className={`page-list-item ${activePageId === page.id ? 'active' : ''}`} onClick={() => { setActivePageId(page.id); setSelection(null); }}>
                  <span className="page-title">{page.title}</span>
                  <span className="page-slug">/{page.slug}</span>
                  {pages.length > 1 && <button className="block-action-btn danger" onClick={(event) => { event.stopPropagation(); deletePage(page.id); }}>Г—</button>}
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={addPage} style={{ width: '100%', marginTop: 12 }}>+ Р”РѕР±Р°РІРёС‚СЊ СЃС‚СЂР°РЅРёС†Сѓ</Button>
          </div>
        )}

        {tab === 'theme' && (
          <div className="constructor-panel">
            <GeneralThemeEditor
              theme={theme}
              setTheme={setTheme}
              siteSlug={siteSlug}
              setSiteSlug={setSiteSlug}
              uploadSingleImage={uploadSingleImage}
            />
          </div>
        )}
      </div>
      )}

      <div className="constructor-preview">
        <div className="preview-toolbar">
          {!leftPanelOpen && (
            <button className="workspace-panel-btn" type="button" onClick={() => setLeftPanelOpen(true)} title="РџРѕРєР°Р·Р°С‚СЊ РїР°РЅРµР»СЊ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂР°">
              в°
            </button>
          )}
          <div className="preview-page-tabs">
            {pages.map((page) => (
              <button key={page.id} className={`preview-page-tab ${activePageId === page.id ? 'active' : ''}`} onClick={() => setActivePageId(page.id)}>
                {page.title}
              </button>
            ))}
          </div>
          <div className="preview-actions">
            <div className="history-actions">
              <button type="button" onClick={undo} disabled={historyIndex <= 0} title="РћС‚РјРµРЅРёС‚СЊ">в†¶</button>
              <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1} title="Р’РµСЂРЅСѓС‚СЊ">в†·</button>
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
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>{saving ? 'РЎРѕС…СЂР°РЅРµРЅРёРµ...' : 'РЎРѕС…СЂР°РЅРёС‚СЊ С‡РµСЂРЅРѕРІРёРє'}</Button>
            <Button size="sm" onClick={handlePublish} disabled={publishing}>{publishing ? 'РџСѓР±Р»РёРєР°С†РёСЏ...' : 'РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ'}</Button>
            <button
              className="workspace-panel-btn"
              type="button"
              onClick={() => setRightPanelOpen((open) => !open)}
              title={rightPanelOpen ? 'РЎРєСЂС‹С‚СЊ СЃРІРѕР№СЃС‚РІР°' : 'РџРѕРєР°Р·Р°С‚СЊ СЃРІРѕР№СЃС‚РІР°'}
            >
              {rightPanelOpen ? 'в†’' : 'вљ™'}
            </button>
          </div>
        </div>
        {statusMsg && <div className="builder-toast">{statusMsg}</div>}

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
          {theme.customCss && <style>{theme.customCss}</style>}
          <div className={`preview-block-header ${selection?.type === 'header' ? 'selected' : ''}`} onClick={() => setSelection({ type: 'header' })}>
            <div
              className={`preview-site-header ${theme.headerStyle === 'dark' ? 'dark' : ''} nav-${theme.headerNavAlign}`}
              style={{ background: theme.headerBg, color: theme.headerTextColor } as React.CSSProperties}
            >
              <span className="preview-site-logo">
                {theme.logoImage && <img src={theme.logoImage} alt="" className="preview-logo-img" />}
                {theme.logoText || site.title}
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

          {activePage.sections.length === 0 && <div className="preview-empty">Р”РѕР±Р°РІСЊС‚Рµ РїРµСЂРІСѓСЋ СЃРµРєС†РёСЋ</div>}

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
                    {column.elements.length === 0 && <div className="column-empty">РџРµСЂРµС‚Р°С‰РёС‚Рµ РёР»Рё РґРѕР±Р°РІСЊС‚Рµ СЌР»РµРјРµРЅС‚</div>}
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

      {rightPanelOpen && (
      <div className="constructor-right">
        <div className="props-collapse-row">
          <button className="panel-toggle-btn" type="button" onClick={() => setRightPanelOpen(false)} title="РЎРєСЂС‹С‚СЊ РїР°РЅРµР»СЊ СЃРІРѕР№СЃС‚РІ">
            в†’
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

function ElementPreview({ element, tours, slug, primary }: { element: BuilderElement; tours: any[]; slug: string; primary: string }) {
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
          в†ђ {element.data.text || 'РќР°Р·Р°Рґ'}
        </button>
      </div>
    );
  }
  if (element.type === 'image') {
    return element.data.src ? (
      <img className="b-el-image" src={element.data.src} alt={element.data.alt || ''} style={{ ...css, objectFit: element.data.fit || 'cover' }} />
    ) : (
      <div className="b-el-image-placeholder" style={css}>РР·РѕР±СЂР°Р¶РµРЅРёРµ</div>
    );
  }
  if (element.type === 'gallery') {
    return (
      <div className="b-el-gallery" style={css}>
        {(element.data.images || []).length === 0 ? <div className="b-el-image-placeholder">Р“Р°Р»РµСЂРµСЏ</div> : (
          <div className="b-el-gallery-grid" style={{ gridTemplateColumns: `repeat(${element.data.columns || 3}, 1fr)` }}>
            {element.data.images.map((url: string, index: number) => <div key={index} className="b-el-gallery-img" style={{ backgroundImage: `url(${url})`, borderRadius: element.style.radius }} />)}
          </div>
        )}
      </div>
    );
  }
  if (element.type === 'video') {
    return (
      <div className="b-el-video" style={css}>
        {element.data.url ? <iframe src={element.data.url} title={element.data.title || 'Р’РёРґРµРѕ'} /> : <div className="b-el-image-placeholder">Р’РёРґРµРѕ</div>}
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
        <button type="button">{element.data.buttonText || 'РћС‚РїСЂР°РІРёС‚СЊ'}</button>
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
              <strong>{tour.title}</strong>
              <span>{tour.city}</span>
              <small>{tour.duration} РјРёРЅ В· {((tour.distance || 0) / 1000).toFixed(1)} РєРј</small>
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
      {element.data.phone && <p>РўРµР»РµС„РѕРЅ: {element.data.phone}</p>}
      {element.data.telegram && <p>Telegram: {element.data.telegram}</p>}
      {element.data.address && <p>РђРґСЂРµСЃ: {element.data.address}</p>}
    </div>
  );
}

function ThemeEditor({ theme, setTheme, siteTitle, uploadSingleImage }: { theme: ThemeConfig; setTheme: (theme: ThemeConfig) => void; siteTitle: string; uploadSingleImage: (callback: (url: string) => void) => void }) {
  return (
    <div className="theme-form">
      <p className="panel-label">РћС„РѕСЂРјР»РµРЅРёРµ</p>
      <ColorField label="РћСЃРЅРѕРІРЅРѕР№ С†РІРµС‚" value={theme.primaryColor} onChange={(primaryColor) => setTheme({ ...theme, primaryColor })} />
      <div className="theme-field">
        <label>РЁСЂРёС„С‚</label>
        <select className="theme-select" value={theme.fontFamily} onChange={(event) => setTheme({ ...theme, fontFamily: event.target.value })}>
          <option value="system">РЎРёСЃС‚РµРјРЅС‹Р№</option>
          <option value="serif">Serif</option>
          <option value="mono">Monospace</option>
        </select>
      </div>
      <NumberField label="РЎРєСЂСѓРіР»РµРЅРёРµ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ" value={Number(theme.borderRadius)} onChange={(borderRadius) => setTheme({ ...theme, borderRadius: String(borderRadius) })} min={0} max={32} />
      <div className="theme-field">
        <label>РЎС‚РёР»СЊ С€Р°РїРєРё</label>
        <select className="theme-select" value={theme.headerStyle} onChange={(event) => setTheme({ ...theme, headerStyle: event.target.value as 'light' | 'dark' })}>
          <option value="light">РЎРІРµС‚Р»Р°СЏ</option>
          <option value="dark">РўРµРјРЅР°СЏ</option>
        </select>
      </div>
      <Input label="РўРµРєСЃС‚ Р»РѕРіРѕС‚РёРїР°" value={theme.logoText} placeholder={siteTitle} onChange={(event) => setTheme({ ...theme, logoText: event.target.value })} />
      <Button variant="secondary" size="sm" onClick={() => uploadSingleImage((logoImage) => setTheme({ ...theme, logoImage }))}>Р—Р°РіСЂСѓР·РёС‚СЊ Р»РѕРіРѕС‚РёРї</Button>
      {theme.logoImage && <Button variant="ghost" size="sm" onClick={() => setTheme({ ...theme, logoImage: '' })}>РЈР±СЂР°С‚СЊ Р»РѕРіРѕС‚РёРї</Button>}
    </div>
  );
}

function GeneralThemeEditor({
  theme,
  setTheme,
  siteSlug,
  setSiteSlug,
  uploadSingleImage,
}: {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  siteSlug: string;
  setSiteSlug: (slug: string) => void;
  uploadSingleImage: (callback: (url: string) => void) => void;
}) {
  return (
    <div className="theme-form">
      <p className="panel-label">Общие настройки</p>
      <Input label="Адрес сайта" value={siteSlug} onChange={(event) => setSiteSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
      <p className="field-hint">Сайт будет открываться по ссылке /s/{siteSlug || '...'}</p>
      <ColorField label="Основной цвет" value={theme.primaryColor} onChange={(primaryColor) => setTheme({ ...theme, primaryColor })} />
      <ColorField label="Фон сайта" value={theme.siteBg} onChange={(siteBg) => setTheme({ ...theme, siteBg })} />
      <Button variant="secondary" size="sm" onClick={() => uploadSingleImage((siteBgImage) => setTheme({ ...theme, siteBgImage }))}>Загрузить фон сайта</Button>
      {theme.siteBgImage && <Button variant="ghost" size="sm" onClick={() => setTheme({ ...theme, siteBgImage: '' })}>Убрать фон-картинку</Button>}
      <div className="theme-field">
        <label>Шрифт</label>
        <select className="theme-select" value={theme.fontFamily} onChange={(event) => setTheme({ ...theme, fontFamily: event.target.value })}>
          <option value="system">Системный</option>
          <option value="serif">Serif</option>
          <option value="mono">Monospace</option>
        </select>
      </div>
      <NumberField label="Скругление по умолчанию" value={Number(theme.borderRadius)} onChange={(borderRadius) => setTheme({ ...theme, borderRadius: String(borderRadius) })} min={0} max={32} />
      <Textarea label="Пользовательский CSS" value={theme.customCss} rows={7} onChange={(event) => setTheme({ ...theme, customCss: event.target.value })} placeholder=".builder-section { ... }" />
    </div>
  );
}
function HeaderEditor({ theme, setTheme, siteTitle, uploadSingleImage }: { theme: ThemeConfig; setTheme: (theme: ThemeConfig) => void; siteTitle: string; uploadSingleImage: (callback: (url: string) => void) => void }) {
  return (
    <div className="theme-form">
      <p className="panel-label">РћС„РѕСЂРјР»РµРЅРёРµ С€Р°РїРєРё</p>
      <ColorField label="Р¤РѕРЅ С€Р°РїРєРё" value={theme.headerBg} onChange={(headerBg) => setTheme({ ...theme, headerBg })} />
      <ColorField label="Р¦РІРµС‚ С‚РµРєСЃС‚Р°" value={theme.headerTextColor} onChange={(headerTextColor) => setTheme({ ...theme, headerTextColor })} />
      <Input label="РўРµРєСЃС‚ Р»РѕРіРѕС‚РёРїР°" value={theme.logoText} placeholder={siteTitle} onChange={(event) => setTheme({ ...theme, logoText: event.target.value })} />
      <Button variant="secondary" size="sm" onClick={() => uploadSingleImage((logoImage) => setTheme({ ...theme, logoImage }))}>Р—Р°РіСЂСѓР·РёС‚СЊ Р»РѕРіРѕС‚РёРї</Button>
      {theme.logoImage && <Button variant="ghost" size="sm" onClick={() => setTheme({ ...theme, logoImage: '' })}>РЈР±СЂР°С‚СЊ Р»РѕРіРѕС‚РёРї</Button>}
      <label className="check-field">
        <input type="checkbox" checked={theme.headerNavVisible} onChange={(event) => setTheme({ ...theme, headerNavVisible: event.target.checked })} />
        РџРѕРєР°Р·С‹РІР°С‚СЊ СЃСЃС‹Р»РєРё
      </label>
      <div className="theme-field">
        <label>Р Р°СЃРїРѕР»РѕР¶РµРЅРёРµ СЃСЃС‹Р»РѕРє</label>
        <select className="theme-select" value={theme.headerNavAlign} onChange={(event) => setTheme({ ...theme, headerNavAlign: event.target.value as ThemeConfig['headerNavAlign'] })}>
          <option value="left">РЎР»РµРІР°</option>
          <option value="center">РџРѕ С†РµРЅС‚СЂСѓ</option>
          <option value="right">РЎРїСЂР°РІР°</option>
        </select>
      </div>
      <div className="theme-field">
        <label>Р’РёРґ СЃСЃС‹Р»РѕРє</label>
        <select className="theme-select" value={theme.headerNavStyle} onChange={(event) => setTheme({ ...theme, headerNavStyle: event.target.value as ThemeConfig['headerNavStyle'] })}>
          <option value="links">РўРµРєСЃС‚</option>
          <option value="pills">РљРЅРѕРїРєРё</option>
          <option value="underline">РџРѕРґС‡РµСЂРєРёРІР°РЅРёРµ</option>
        </select>
      </div>
      <NumberField label="Р Р°СЃСЃС‚РѕСЏРЅРёРµ РјРµР¶РґСѓ СЃСЃС‹Р»РєР°РјРё" value={Number(theme.headerNavGap)} onChange={(headerNavGap) => setTheme({ ...theme, headerNavGap: String(headerNavGap) })} min={0} max={48} />
    </div>
  );
}

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
          <div className="props-header"><span className="props-icon">в‰Ў</span><h3>РЁР°РїРєР° СЃР°Р№С‚Р°</h3></div>
          <div className="props-body">
            <HeaderEditor theme={props.theme} setTheme={props.setTheme} siteTitle={props.siteTitle} uploadSingleImage={props.uploadSingleImage} />
          </div>
        </>
      )}

      {selected?.kind === 'section' && (
        <>
          <div className="props-header"><span className="props-icon">в°</span><h3>РЎРµРєС†РёСЏ</h3></div>
          <div className="props-body">
            <div className="theme-field">
              <label>РЎС‚СЂСѓРєС‚СѓСЂР°</label>
              <select className="theme-select" value={selected.section.layout} onChange={(event) => props.setSectionLayout(selected.section, event.target.value as SectionLayout)}>
                {(Object.keys(sectionLayouts) as SectionLayout[]).map((layout) => <option key={layout} value={layout}>{sectionLayouts[layout].label}</option>)}
              </select>
            </div>
            <StyleEditor style={selected.section.style} onChange={(patch) => props.updateSectionStyle(selected.section.id, patch)} />
            <Button variant="danger" size="sm" onClick={() => props.deleteSection(selected.section.id)}>РЈРґР°Р»РёС‚СЊ СЃРµРєС†РёСЋ</Button>
          </div>
        </>
      )}

      {selected?.kind === 'column' && (
        <>
          <div className="props-header"><span className="props-icon">в–Ґ</span><h3>РљРѕР»РѕРЅРєР°</h3></div>
          <div className="props-body">
            <NumberField label="РЁРёСЂРёРЅР° РєРѕР»РѕРЅРєРё, %" value={selected.column.width} min={10} max={100} onChange={(width) => props.updateColumn(selected.section.id, selected.column.id, { width })} />
            <StyleEditor style={selected.column.style} onChange={(patch) => props.updateColumnStyle(selected.section.id, selected.column.id, patch)} compact />
          </div>
        </>
      )}

      {selected?.kind === 'element' && (
        <>
          <div className="props-header"><span className="props-icon">{elementLabels[selected.element.type].icon}</span><h3>{elementLabels[selected.element.type].label}</h3></div>
          <div className="props-body">
            <ElementEditor element={selected.element} tours={props.tours} updateData={props.updateElementData} uploadSingleImage={props.uploadSingleImage} uploadGallery={props.uploadGallery} />
            <StyleEditor style={selected.element.style} onChange={(patch) => props.updateElementStyle(selected.element.id, patch)} compact />
            <Button variant="danger" size="sm" onClick={() => props.deleteElement(selected.element.id)}>РЈРґР°Р»РёС‚СЊ СЌР»РµРјРµРЅС‚</Button>
          </div>
        </>
      )}

      {!selected && (
        <div className="props-empty-state">
          <p>Р’С‹Р±РµСЂРёС‚Рµ СЃРµРєС†РёСЋ, РєРѕР»РѕРЅРєСѓ РёР»Рё СЌР»РµРјРµРЅС‚ РІ РїСЂРµРґРїСЂРѕСЃРјРѕС‚СЂРµ РґР»СЏ РЅР°СЃС‚СЂРѕР№РєРё</p>
        </div>
      )}

      <div className="page-settings">
        <h4>РќР°СЃС‚СЂРѕР№РєРё СЃС‚СЂР°РЅРёС†С‹</h4>
        <Input label="РќР°Р·РІР°РЅРёРµ" value={props.activePage.title} onChange={(event) => props.updatePageField('title', event.target.value)} />
        <Input label="URL" value={props.activePage.slug} onChange={(event) => props.updatePageField('slug', event.target.value)} />
      </div>
    </>
  );
}

function ElementEditor({ element, tours, updateData, uploadSingleImage, uploadGallery }: { element: BuilderElement; tours: any[]; updateData: (elementId: string, field: string, value: any) => void; uploadSingleImage: (callback: (url: string) => void) => void; uploadGallery: (element: BuilderElement) => void }) {
  if (element.type === 'heading') {
    return (
      <>
        <Input label="РўРµРєСЃС‚" value={element.data.text} onChange={(event) => updateData(element.id, 'text', event.target.value)} />
        <div className="theme-field">
          <label>РЈСЂРѕРІРµРЅСЊ</label>
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
    return <Textarea label="РўРµРєСЃС‚" value={element.data.text} onChange={(event) => updateData(element.id, 'text', event.target.value)} style={{ minHeight: 130 }} />;
  }
  if (element.type === 'button') {
    return (
      <>
        <Input label="РўРµРєСЃС‚ РєРЅРѕРїРєРё" value={element.data.text} onChange={(event) => updateData(element.id, 'text', event.target.value)} />
        <Input label="РЎСЃС‹Р»РєР°" value={element.data.href} onChange={(event) => updateData(element.id, 'href', event.target.value)} />
        <div className="theme-field">
          <label>Р’РёРґ</label>
          <select className="theme-select" value={element.data.variant} onChange={(event) => updateData(element.id, 'variant', event.target.value)}>
            <option value="filled">Р—Р°Р»РёРІРєР°</option>
            <option value="outline">РљРѕРЅС‚СѓСЂ</option>
          </select>
        </div>
      </>
    );
  }
  if (element.type === 'backButton') {
    return (
      <>
        <Input label="РўРµРєСЃС‚" value={element.data.text} onChange={(event) => updateData(element.id, 'text', event.target.value)} />
        <div className="theme-field">
          <label>Р”РµР№СЃС‚РІРёРµ</label>
          <select className="theme-select" value={element.data.mode} onChange={(event) => updateData(element.id, 'mode', event.target.value)}>
            <option value="history">РСЃС‚РѕСЂРёСЏ Р±СЂР°СѓР·РµСЂР°</option>
            <option value="link">РЎСЃС‹Р»РєР°</option>
          </select>
        </div>
        {element.data.mode === 'link' && <Input label="РЎСЃС‹Р»РєР°" value={element.data.href} onChange={(event) => updateData(element.id, 'href', event.target.value)} />}
      </>
    );
  }
  if (element.type === 'image') {
    return (
      <>
        <Input label="URL РёР·РѕР±СЂР°Р¶РµРЅРёСЏ" value={element.data.src?.startsWith('data:') ? '' : element.data.src || ''} onChange={(event) => updateData(element.id, 'src', event.target.value)} />
        <Button variant="secondary" size="sm" onClick={() => uploadSingleImage((src) => updateData(element.id, 'src', src))}>Р—Р°РіСЂСѓР·РёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ</Button>
        <Input label="Alt" value={element.data.alt || ''} onChange={(event) => updateData(element.id, 'alt', event.target.value)} />
      </>
    );
  }
  if (element.type === 'gallery') {
    return (
      <>
        <NumberField label="РљРѕР»РѕРЅРѕРє РІ РіР°Р»РµСЂРµРµ" value={element.data.columns || 3} min={1} max={6} onChange={(columns) => updateData(element.id, 'columns', columns)} />
        <Button variant="secondary" size="sm" onClick={() => uploadGallery(element)}>Р—Р°РіСЂСѓР·РёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ</Button>
        <Textarea label="URL РёР·РѕР±СЂР°Р¶РµРЅРёР№" value={(element.data.images || []).filter((url: string) => !url.startsWith('data:')).join('\n')} onChange={(event) => {
          const dataUrls = (element.data.images || []).filter((url: string) => url.startsWith('data:'));
          updateData(element.id, 'images', [...dataUrls, ...event.target.value.split('\n').filter(Boolean)]);
        }} />
      </>
    );
  }
  if (element.type === 'video') {
    return (
      <>
        <Input label="Embed URL" value={element.data.url} placeholder="https://www.youtube.com/embed/..." onChange={(event) => updateData(element.id, 'url', event.target.value)} />
        <Input label="РќР°Р·РІР°РЅРёРµ" value={element.data.title} onChange={(event) => updateData(element.id, 'title', event.target.value)} />
      </>
    );
  }
  if (element.type === 'divider') {
    return (
      <>
        <NumberField label="РўРѕР»С‰РёРЅР° Р»РёРЅРёРё" value={element.data.thickness || 1} min={1} max={12} onChange={(thickness) => updateData(element.id, 'thickness', thickness)} />
        <div className="theme-field">
          <label>РЎС‚РёР»СЊ</label>
          <select className="theme-select" value={element.data.lineStyle || 'solid'} onChange={(event) => updateData(element.id, 'lineStyle', event.target.value)}>
            <option value="solid">РЎРїР»РѕС€РЅР°СЏ</option>
            <option value="dashed">РџСѓРЅРєС‚РёСЂ</option>
            <option value="dotted">РўРѕС‡РєРё</option>
          </select>
        </div>
      </>
    );
  }
  if (element.type === 'spacer') {
    return <NumberField label="Р’С‹СЃРѕС‚Р°" value={element.data.height || 40} min={8} max={240} onChange={(height) => updateData(element.id, 'height', height)} />;
  }
  if (element.type === 'box') {
    return <Textarea label="РЎРѕРґРµСЂР¶РёРјРѕРµ Р±РѕРєСЃР°" value={element.data.text} onChange={(event) => updateData(element.id, 'text', event.target.value)} style={{ minHeight: 100 }} />;
  }
  if (element.type === 'list') {
    return (
      <>
        <Input label="Р—Р°РіРѕР»РѕРІРѕРє" value={element.data.heading} onChange={(event) => updateData(element.id, 'heading', event.target.value)} />
        <Textarea label="РџСѓРЅРєС‚С‹, РєР°Р¶РґС‹Р№ СЃ РЅРѕРІРѕР№ СЃС‚СЂРѕРєРё" value={(element.data.items || []).join('\n')} onChange={(event) => updateData(element.id, 'items', event.target.value.split('\n').filter(Boolean))} />
        <label className="tour-select-item"><input type="checkbox" checked={!!element.data.ordered} onChange={(event) => updateData(element.id, 'ordered', event.target.checked)} /> <span>РќСѓРјРµСЂРѕРІР°РЅРЅС‹Р№ СЃРїРёСЃРѕРє</span></label>
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
          <label>Р’РёРґ</label>
          <select className="theme-select" value={element.data.style || 'filled'} onChange={(event) => updateData(element.id, 'style', event.target.value)}>
            <option value="filled">Р¦РІРµС‚РЅС‹Рµ РєРЅРѕРїРєРё</option>
            <option value="mono">РњРѕРЅРѕС…СЂРѕРј</option>
          </select>
        </div>
      </>
    );
  }
  if (element.type === 'menu') {
    return (
      <>
        <Input label="ID СЏРєРѕСЂСЏ" value={element.data.anchor} onChange={(event) => updateData(element.id, 'anchor', event.target.value)} />
        <Input label="РџРѕРґРїРёСЃСЊ" value={element.data.label} onChange={(event) => updateData(element.id, 'label', event.target.value)} />
      </>
    );
  }
  if (element.type === 'form') {
    return (
      <>
        <Input label="Р—Р°РіРѕР»РѕРІРѕРє" value={element.data.heading} onChange={(event) => updateData(element.id, 'heading', event.target.value)} />
        <Textarea label="РџРѕР»СЏ С„РѕСЂРјС‹" value={(element.data.fields || []).join('\n')} onChange={(event) => updateData(element.id, 'fields', event.target.value.split('\n').filter(Boolean))} />
        <Input label="РўРµРєСЃС‚ РєРЅРѕРїРєРё" value={element.data.buttonText} onChange={(event) => updateData(element.id, 'buttonText', event.target.value)} />
      </>
    );
  }
  if (element.type === 'map') {
    return (
      <>
        <Input label="РђРґСЂРµСЃ" value={element.data.address} onChange={(event) => updateData(element.id, 'address', event.target.value)} />
        <Input label="РЁРёСЂРѕС‚Р°" value={String(element.data.lat || '')} onChange={(event) => updateData(element.id, 'lat', Number(event.target.value))} />
        <Input label="Р”РѕР»РіРѕС‚Р°" value={String(element.data.lng || '')} onChange={(event) => updateData(element.id, 'lng', Number(event.target.value))} />
        <NumberField label="РњР°СЃС€С‚Р°Р± РєР°СЂС‚С‹" value={element.data.zoom || 13} min={3} max={18} onChange={(zoom) => updateData(element.id, 'zoom', zoom)} />
      </>
    );
  }
  if (element.type === 'embed') {
    return <Textarea label="РљРѕРґ / HTML" value={element.data.code} onChange={(event) => updateData(element.id, 'code', event.target.value)} style={{ minHeight: 120 }} />;
  }
  if (element.type === 'tours') {
    const ids: string[] = element.data.selectedTourIds || [];
    return (
      <>
        <Input label="Р—Р°РіРѕР»РѕРІРѕРє" value={element.data.heading} onChange={(event) => updateData(element.id, 'heading', event.target.value)} />
        <NumberField label="РљРѕР»РѕРЅРѕРє" value={element.data.columns || 2} min={1} max={4} onChange={(columns) => updateData(element.id, 'columns', columns)} />
        <div className="tour-select-list">
          <label className="tour-select-item">
            <input type="checkbox" checked={ids.length === 0} onChange={() => updateData(element.id, 'selectedTourIds', [])} />
            <span>Р’СЃРµ РѕРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹Рµ СЌРєСЃРєСѓСЂСЃРёРё</span>
          </label>
          {tours.filter((tour) => tour.status === 'published').map((tour) => (
            <label key={tour.id} className="tour-select-item">
              <input
                type="checkbox"
                checked={ids.includes(tour.id)}
                onChange={() => updateData(element.id, 'selectedTourIds', ids.includes(tour.id) ? ids.filter((id) => id !== tour.id) : [...ids, tour.id])}
              />
              <span>{tour.title}</span>
            </label>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <Input label="Р—Р°РіРѕР»РѕРІРѕРє" value={element.data.heading} onChange={(event) => updateData(element.id, 'heading', event.target.value)} />
      <Input label="Email" value={element.data.email} onChange={(event) => updateData(element.id, 'email', event.target.value)} />
      <Input label="РўРµР»РµС„РѕРЅ" value={element.data.phone} onChange={(event) => updateData(element.id, 'phone', event.target.value)} />
      <Input label="Telegram" value={element.data.telegram} onChange={(event) => updateData(element.id, 'telegram', event.target.value)} />
      <Input label="РђРґСЂРµСЃ" value={element.data.address} onChange={(event) => updateData(element.id, 'address', event.target.value)} />
    </>
  );
}

function StyleEditor({ style, onChange, compact }: { style: BuilderStyle; onChange: (patch: BuilderStyle) => void; compact?: boolean }) {
  return (
    <div className="style-editor">
      <ColorField label="Р¤РѕРЅ" value={style.background || 'transparent'} onChange={(background) => onChange({ background })} allowTransparent />
      <ColorField label="Р¦РІРµС‚ С‚РµРєСЃС‚Р°" value={style.color || '#0f172a'} onChange={(color) => onChange({ color })} />
      <NumberField label="РћС‚СЃС‚СѓРї РІРЅСѓС‚СЂРё" value={style.padding ?? 0} min={0} max={120} onChange={(padding) => onChange({ padding })} />
      <NumberField label="РћС‚СЃС‚СѓРї СЃРЅР°СЂСѓР¶Рё" value={style.margin ?? 0} min={0} max={80} onChange={(margin) => onChange({ margin })} />
      <NumberField label="РЎРєСЂСѓРіР»РµРЅРёРµ" value={style.radius ?? 0} min={0} max={48} onChange={(radius) => onChange({ radius })} />
      {!compact && <NumberField label="РўРѕР»С‰РёРЅР° СЂР°РјРєРё" value={style.borderWidth ?? 0} min={0} max={8} onChange={(borderWidth) => onChange({ borderWidth })} />}
      {!compact && <ColorField label="Р¦РІРµС‚ СЂР°РјРєРё" value={style.borderColor || '#e2e8f0'} onChange={(borderColor) => onChange({ borderColor })} />}
      <div className="theme-field">
        <label>РўРµРЅСЊ</label>
        <select className="theme-select" value={style.shadow || 'none'} onChange={(event) => onChange({ shadow: event.target.value })}>
          <option value="none">РќРµС‚</option>
          <option value="0 8px 24px rgba(15,23,42,0.12)">РњСЏРіРєР°СЏ</option>
          <option value="0 16px 40px rgba(15,23,42,0.18)">Р’С‹СЂР°Р¶РµРЅРЅР°СЏ</option>
        </select>
      </div>
      <NumberField label="Р Р°Р·РјРµСЂ С‚РµРєСЃС‚Р°" value={style.fontSize ?? 0} min={0} max={72} onChange={(fontSize) => onChange({ fontSize: fontSize || undefined })} />
      <NumberField label="РЁРёСЂРёРЅР° СЌР»РµРјРµРЅС‚Р°, %" value={style.width ?? 100} min={10} max={100} onChange={(width) => onChange({ width })} />
      <div className="theme-field">
        <label>Р’С‹СЂР°РІРЅРёРІР°РЅРёРµ</label>
        <select className="theme-select" value={style.align || 'left'} onChange={(event) => onChange({ align: event.target.value as BuilderStyle['align'] })}>
          <option value="left">РЎР»РµРІР°</option>
          <option value="center">РџРѕ С†РµРЅС‚СЂСѓ</option>
          <option value="right">РЎРїСЂР°РІР°</option>
        </select>
      </div>
    </div>
  );
}

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

