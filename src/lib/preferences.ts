export type FontSize = 'sm' | 'md' | 'lg';
export type FontFamily = 'song' | 'kai' | 'hei' | 'fangsong' | 'mono';
export type LineSpacing = 'compact' | 'normal' | 'relaxed';

const FONT_SIZE_KEY = 'echo-font-size';
const FONT_FAMILY_KEY = 'echo-font-family';
const LINE_SPACING_KEY = 'echo-line-spacing';

export const FONT_FAMILY_OPTIONS: { id: FontFamily; label: string; preview: string }[] = [
  { id: 'song', label: '宋体', preview: '落笔成文' },
  { id: 'kai', label: '楷体', preview: '落笔成文' },
  { id: 'hei', label: '黑体', preview: '落笔成文' },
  { id: 'fangsong', label: '仿宋', preview: '落笔成文' },
  { id: 'mono', label: '等宽', preview: '落笔成文' },
];

export const FONT_SIZE_OPTIONS: { id: FontSize; label: string }[] = [
  { id: 'sm', label: '小' },
  { id: 'md', label: '中' },
  { id: 'lg', label: '大' },
];

export const LINE_SPACING_OPTIONS: { id: LineSpacing; label: string }[] = [
  { id: 'compact', label: '紧凑' },
  { id: 'normal', label: '标准' },
  { id: 'relaxed', label: '宽松' },
];

export function getFontSize(): FontSize {
  const value = localStorage.getItem(FONT_SIZE_KEY);
  if (value === 'sm' || value === 'md' || value === 'lg') return value;
  return 'md';
}

export function getFontFamily(): FontFamily {
  const value = localStorage.getItem(FONT_FAMILY_KEY);
  if (value === 'song' || value === 'kai' || value === 'hei' || value === 'fangsong' || value === 'mono') {
    return value;
  }
  return 'hei';
}

export function getLineSpacing(): LineSpacing {
  const value = localStorage.getItem(LINE_SPACING_KEY);
  if (value === 'compact' || value === 'normal' || value === 'relaxed') return value;
  return 'normal';
}

function applyToDocument(): void {
  const root = document.documentElement;
  root.dataset.fontSize = getFontSize();
  root.dataset.fontFamily = getFontFamily();
  root.dataset.lineSpacing = getLineSpacing();
}

export function setFontSize(size: FontSize): void {
  localStorage.setItem(FONT_SIZE_KEY, size);
  document.documentElement.dataset.fontSize = size;
}

export function setFontFamily(family: FontFamily): void {
  localStorage.setItem(FONT_FAMILY_KEY, family);
  document.documentElement.dataset.fontFamily = family;
}

export function setLineSpacing(spacing: LineSpacing): void {
  localStorage.setItem(LINE_SPACING_KEY, spacing);
  document.documentElement.dataset.lineSpacing = spacing;
}

export function applyFontPreferences(): void {
  applyToDocument();
}
