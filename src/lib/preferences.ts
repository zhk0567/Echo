export type FontSize = 'sm' | 'md' | 'lg';

const FONT_SIZE_KEY = 'echo-font-size';

export function getFontSize(): FontSize {
  const value = localStorage.getItem(FONT_SIZE_KEY);
  if (value === 'sm' || value === 'md' || value === 'lg') return value;
  return 'md';
}

export function setFontSize(size: FontSize): void {
  localStorage.setItem(FONT_SIZE_KEY, size);
  document.documentElement.dataset.fontSize = size;
}

export function applyFontSizePreference(): void {
  document.documentElement.dataset.fontSize = getFontSize();
}
