import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { FontFamily, FontSize, LineSpacing } from '../lib/preferences';
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_SPACING_OPTIONS,
  getFontFamily,
  getFontSize,
  getLineSpacing,
  setFontFamily,
  setFontSize,
  setLineSpacing,
} from '../lib/preferences';

const FONT_FAMILY_STACK: Record<FontFamily, string> = {
  song: "'STSong', 'SimSun', 'Songti SC', serif",
  kai: "'STKaiti', 'KaiTi', 'Kaiti SC', serif",
  hei: "'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
  fangsong: "'FangSong', 'STFangsong', serif",
  mono: "'Cascadia Mono', 'Consolas', 'Microsoft YaHei Mono', monospace",
};

interface FontSettingsProps {
  onClose?: () => void;
}

export const FontSettings = memo(function FontSettings({ onClose }: FontSettingsProps) {
  const [fontSize, setFontSizeState] = useState<FontSize>(getFontSize);
  const [fontFamily, setFontFamilyState] = useState<FontFamily>(getFontFamily);
  const [lineSpacing, setLineSpacingState] = useState<LineSpacing>(getLineSpacing);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
    setFontSize(size);
  }, []);

  const handleFontFamily = useCallback((family: FontFamily) => {
    setFontFamilyState(family);
    setFontFamily(family);
  }, []);

  const handleLineSpacing = useCallback((spacing: LineSpacing) => {
    setLineSpacingState(spacing);
    setLineSpacing(spacing);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="font-settings-panel"
      role="dialog"
      aria-label="字体设置"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="font-settings-header">
        <h3 className="font-settings-title">字体设置</h3>
        {onClose && (
          <button type="button" className="font-settings-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        )}
      </div>

      <section className="font-settings-section">
        <p className="font-settings-label">正文字体</p>
        <div className="font-family-grid">
          {FONT_FAMILY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`font-family-option${fontFamily === option.id ? ' active' : ''}`}
              onClick={() => handleFontFamily(option.id)}
              aria-pressed={fontFamily === option.id}
            >
              <span
                className="font-family-preview"
                style={{ fontFamily: FONT_FAMILY_STACK[option.id] }}
              >
                {option.preview}
              </span>
              <span className="font-family-name">{option.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="font-settings-section">
        <p className="font-settings-label">字号</p>
        <div className="font-option-group">
          {FONT_SIZE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`font-option-btn${fontSize === option.id ? ' active' : ''}`}
              onClick={() => handleFontSize(option.id)}
              aria-pressed={fontSize === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="font-settings-section">
        <p className="font-settings-label">行距</p>
        <div className="font-option-group">
          {LINE_SPACING_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`font-option-btn${lineSpacing === option.id ? ' active' : ''}`}
              onClick={() => handleLineSpacing(option.id)}
              aria-pressed={lineSpacing === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
});

interface FontSettingsTriggerProps {
  className?: string;
}

export const FontSettingsTrigger = memo(function FontSettingsTrigger({
  className = '',
}: FontSettingsTriggerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  return (
    <div className={`font-settings-wrap${className ? ` ${className}` : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`btn-secondary${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="字体设置"
      >
        字体
      </button>
      {open && <FontSettings onClose={() => setOpen(false)} />}
    </div>
  );
});
