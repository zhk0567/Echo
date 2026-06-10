import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { DiaryEntry, EditorActions, SavedEntryPayload } from '../lib/types';
import { FontSettingsTrigger } from './FontSettings';
import { formatDisplayDate, shiftDate } from '../lib/dateUtils';
import { countDiaryChars } from '../lib/textUtils';
import { useCustomOverlayScrollbar } from '../lib/useCustomOverlayScrollbar';

interface EntryEditorProps {
  date: string;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onSelectDate: (date: string) => void;
  onSaved: (payload: SavedEntryPayload) => void;
  onDirtyChange: (dirty: boolean) => void;
  onNotify?: (message: string) => void;
  highlightQuery?: string | null;
  onHighlightDone?: () => void;
  editorRef: React.MutableRefObject<EditorActions | null>;
}

const AUTO_SAVE_MS = 1500;

function EditorSkeleton() {
  return (
    <div className="editor-skeleton">
      <div className="skeleton-toolbar" />
      <div className="skeleton-body">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton-line" style={{ width: `${88 - i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}

export const EntryEditor = memo(function EntryEditor({
  date,
  focusMode,
  onToggleFocusMode,
  onSelectDate,
  onSaved,
  onDirtyChange,
  onNotify,
  highlightQuery,
  onHighlightDone,
  editorRef,
}: EntryEditorProps) {
  const [content, setContent] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [showSaving, setShowSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveAcknowledged, setSaveAcknowledged] = useState(false);
  const [displayCharCount, setDisplayCharCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  const savedContentRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef(date);
  const onSelectDateRef = useRef(onSelectDate);
  const saveRef = useRef<(text: string) => Promise<boolean>>(async () => true);
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;
  const hasLoadedOnceRef = useRef(false);

  contentRef.current = content;
  dateRef.current = date;
  onSelectDateRef.current = onSelectDate;

  const { metrics: scrollbar, onThumbMouseDown } = useCustomOverlayScrollbar(
    textareaRef,
    !initialLoading && !switching,
    content,
    scrollWrapRef,
  );

  const clearSavingDelay = useCallback(() => {
    if (savingDelayRef.current) {
      clearTimeout(savingDelayRef.current);
      savingDelayRef.current = null;
    }
  }, []);

  const updateDirty = useCallback(() => {
    const dirty =
      contentRef.current !== savedContentRef.current || debounceRef.current !== null;
    onDirtyChange(dirty);
  }, [onDirtyChange]);

  const save = useCallback(
    async (text: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      clearSavingDelay();
      savingDelayRef.current = setTimeout(() => setShowSaving(true), 500);
      setError(null);
      try {
        await window.diaryAPI.saveEntry(dateRef.current, text);
        savedContentRef.current = text;
        onSaved({ date: dateRef.current, charCount: countDiaryChars(text) });
        setHasUnsavedChanges(false);
        setSaveAcknowledged(true);
        onDirtyChange(false);
        return true;
      } catch {
        setError('保存失败，请重试');
        onNotifyRef.current?.('保存失败，请检查磁盘权限后重试');
        updateDirty();
        return false;
      } finally {
        clearSavingDelay();
        setShowSaving(false);
      }
    },
    [onSaved, onDirtyChange, updateDirty, clearSavingDelay],
  );

  saveRef.current = save;

  const loadEntry = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!hasLoadedOnceRef.current) {
      setInitialLoading(true);
    } else {
      setSwitching(true);
    }
    setError(null);

    try {
      const entry = await window.diaryAPI.getEntry(date);
      const text = entry?.content ?? '';
      setContent(text);
      savedContentRef.current = text;
      setDisplayCharCount(countDiaryChars(text));
      setHasUnsavedChanges(false);
      setSaveAcknowledged(text.length > 0);
      clearSavingDelay();
      setShowSaving(false);
      onDirtyChange(false);
    } catch {
      setError('加载日记失败');
      onNotifyRef.current?.(`加载失败：${formatDisplayDate(date)}`);
    } finally {
      hasLoadedOnceRef.current = true;
      setInitialLoading(false);
      setSwitching(false);
    }
  }, [date, onDirtyChange, clearSavingDelay]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  useEffect(() => {
    if (!initialLoading && !switching) {
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [initialLoading, switching, date, focusMode]);

  useEffect(() => {
    if (!highlightQuery || initialLoading || switching) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const lowerContent = content.toLowerCase();
    const lowerQuery = highlightQuery.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);
    if (index === -1) {
      onHighlightDone?.();
      return;
    }

    const end = index + highlightQuery.length;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(index, end);

    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
    const before = content.slice(0, index);
    const line = (before.match(/\n/g) ?? []).length;
    textarea.scrollTop = Math.max(0, line * lineHeight - textarea.clientHeight / 3);

    onHighlightDone?.();
  }, [highlightQuery, initialLoading, switching, content, onHighlightDone]);

  const discardPendingChanges = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setContent(savedContentRef.current);
    setError(null);
    onDirtyChange(false);
  }, [onDirtyChange]);

  useEffect(() => {
    editorRef.current = {
      save: () => saveRef.current(contentRef.current).then(() => undefined),
      flushPendingSave: async () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        if (contentRef.current !== savedContentRef.current) {
          await saveRef.current(contentRef.current);
        }
      },
      isDirty: () =>
        contentRef.current !== savedContentRef.current || debounceRef.current !== null,
      discardPendingChanges,
    };
    return () => {
      editorRef.current = null;
    };
  }, [editorRef, discardPendingChanges]);

  const scheduleSave = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setHasUnsavedChanges(true);
      onDirtyChange(true);
      debounceRef.current = setTimeout(() => saveRef.current(text), AUTO_SAVE_MS);
    },
    [onDirtyChange],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setDisplayCharCount(countDiaryChars(content));
    });
    return () => cancelAnimationFrame(frame);
  }, [content]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void saveRef.current(contentRef.current);
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        onSelectDateRef.current(shiftDate(dateRef.current, -1));
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        onSelectDateRef.current(shiftDate(dateRef.current, 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (savingDelayRef.current) {
        clearTimeout(savingDelayRef.current);
        savingDelayRef.current = null;
      }
    };
  }, []);

  const handleChange = (value: string) => {
    setContent(value);
    scheduleSave(value);
  };

  if (initialLoading) {
    return <EditorSkeleton />;
  }

  const isEmpty = !content.trim();

  const saveStatus = showSaving ? (
    <span className="save-badge saving" aria-live="polite">
      <span className="save-dot" />
      保存中
    </span>
  ) : hasUnsavedChanges ? (
    <span className="save-badge pending" aria-live="polite">待保存</span>
  ) : saveAcknowledged ? (
    <span className="save-badge saved" aria-live="off">
      <span className="save-check">✓</span>
      已保存
    </span>
  ) : null;

  const scrollbarClass = [
    'custom-scrollbar',
    scrollbar.visible ? 'custom-scrollbar--visible' : '',
    scrollbar.fading ? 'custom-scrollbar--fading' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`editor${focusMode ? ' editor--focus' : ''}`}>
      {focusMode && (
        <div className="focus-chrome titlebar-no-drag">
          <span className="focus-date">{formatDisplayDate(date)}</span>
          <div className="focus-meta">
            <span className="editor-stats">{displayCharCount} 字</span>
            {saveStatus}
          </div>
          <button
            type="button"
            className="btn-focus-exit"
            onClick={onToggleFocusMode}
            title="退出专注 (Esc)"
          >
            退出专注
          </button>
        </div>
      )}
      <div className={`editor-paper${switching ? ' editor-paper--switching' : ''}`}>
        {switching && <div className="editor-switching-bar" aria-hidden="true" />}

        {!focusMode && (
          <div className="editor-toolbar">
            <div className="editor-nav">
              <button
                type="button"
                className="btn-nav"
                onClick={() => onSelectDate(shiftDate(date, -1))}
                title="前一天 (Alt+←)"
                aria-label="前一天"
              >
                ‹
              </button>
              <button
                type="button"
                className="btn-nav"
                onClick={() => onSelectDate(shiftDate(date, 1))}
                title="后一天 (Alt+→)"
                aria-label="后一天"
              >
                ›
              </button>
            </div>
            <div className="editor-meta">
              <span className="editor-stats">{displayCharCount} 字</span>
              {saveStatus}
            </div>
            <div className="editor-actions">
              <FontSettingsTrigger />
              <button
                type="button"
                className="btn-secondary"
                onClick={onToggleFocusMode}
                title="专注模式 (Ctrl+Shift+F · Esc 退出)"
              >
                专注
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="editor-error" role="alert">
            {error}
          </div>
        )}

        <div className="editor-body">
          {isEmpty && !switching && (
            <p className="editor-empty-hint">今天还没有写下什么，开始记录吧...</p>
          )}
          <div className="editor-scroll-wrap" ref={scrollWrapRef}>
            <textarea
              ref={textareaRef}
              className="editor-textarea editor-textarea--overlay-scroll"
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="写下今天的故事..."
              spellCheck={false}
              disabled={switching}
            />
            {scrollbar.showTrack && (
              <div className={scrollbarClass} aria-hidden="true">
                <div
                  className="custom-scrollbar-thumb"
                  style={{ top: scrollbar.thumbTop, height: scrollbar.thumbHeight }}
                  onMouseDown={onThumbMouseDown}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
