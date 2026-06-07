import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiaryEntry, EditorActions } from '../lib/types';
import type { FontSize } from '../lib/preferences';
import { getFontSize, setFontSize } from '../lib/preferences';
import { shiftDate } from '../lib/dateUtils';
import { countDiaryChars } from '../lib/textUtils';

interface EntryEditorProps {
  date: string;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onSelectDate: (date: string) => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onDeleteRequest: () => void;
  editorRef: React.MutableRefObject<EditorActions | null>;
}

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

export function EntryEditor({
  date,
  focusMode,
  onToggleFocusMode,
  onSelectDate,
  onSaved,
  onDirtyChange,
  onDeleteRequest,
  editorRef,
}: EntryEditorProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [fontSize, setFontSizeState] = useState<FontSize>(getFontSize);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  const savedContentRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  contentRef.current = content;

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
      setSaving(true);
      setError(null);
      try {
        const entry: DiaryEntry = await window.diaryAPI.saveEntry(date, text);
        savedContentRef.current = text;
        setLastSaved(entry.updatedAt);
        onSaved();
        onDirtyChange(false);
      } catch {
        setError('保存失败，请重试');
        updateDirty();
      } finally {
        setSaving(false);
      }
    },
    [date, onSaved, onDirtyChange, updateDirty],
  );

  const loadEntry = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setLoading(true);
    setError(null);
    try {
      const entry = await window.diaryAPI.getEntry(date);
      const text = entry?.content ?? '';
      setContent(text);
      savedContentRef.current = text;
      setLastSaved(entry?.updatedAt ?? null);
      onDirtyChange(false);
    } catch {
      setError('加载日记失败');
    } finally {
      setLoading(false);
    }
  }, [date, onDirtyChange]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  useEffect(() => {
    if (!loading) {
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [loading, date]);

  useEffect(() => {
    editorRef.current = {
      save: () => save(contentRef.current),
      flushPendingSave: () => save(contentRef.current),
      isDirty: () =>
        contentRef.current !== savedContentRef.current || debounceRef.current !== null,
    };
    return () => {
      editorRef.current = null;
    };
  }, [editorRef, save]);

  const scheduleSave = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onDirtyChange(true);
      debounceRef.current = setTimeout(() => save(text), 1000);
    },
    [save, onDirtyChange],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save(contentRef.current);
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        onSelectDate(shiftDate(date, -1));
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        onSelectDate(shiftDate(date, 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save, date, onSelectDate]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

  const handleChange = (value: string) => {
    setContent(value);
    scheduleSave(value);
  };

  const handleFontSize = (size: FontSize) => {
    setFontSizeState(size);
    setFontSize(size);
  };

  const formatSavedTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <EditorSkeleton />;
  }

  const isEmpty = !content.trim();

  return (
    <div className="editor" key={date}>
      <div className="editor-paper">
        <div className="editor-toolbar">
          <div className="editor-nav">
            <button
              className="btn-nav"
              onClick={() => onSelectDate(shiftDate(date, -1))}
              title="前一天 (Alt+←)"
              aria-label="前一天"
            >
              ‹
            </button>
            <button
              className="btn-nav"
              onClick={() => onSelectDate(shiftDate(date, 1))}
              title="后一天 (Alt+→)"
              aria-label="后一天"
            >
              ›
            </button>
          </div>
          <div className="editor-meta">
            <span className="editor-stats">{countDiaryChars(content)} 字</span>
            {saving && (
              <span className="save-badge saving">
                <span className="save-dot" />
                保存中
              </span>
            )}
            {!saving && lastSaved && content.trim() && (
              <span className="save-badge saved">
                <span className="save-check">✓</span>
                已保存 {formatSavedTime(lastSaved)}
              </span>
            )}
          </div>
          <div className="editor-actions">
            <div className="font-size-group">
              {(['sm', 'md', 'lg'] as FontSize[]).map((size) => (
                <button
                  key={size}
                  className={`btn-font-size${fontSize === size ? ' active' : ''}`}
                  onClick={() => handleFontSize(size)}
                  title={size === 'sm' ? '小' : size === 'md' ? '中' : '大'}
                >
                  {size === 'sm' ? '小' : size === 'md' ? '中' : '大'}
                </button>
              ))}
            </div>
            <button
              className={`btn-secondary${focusMode ? ' active' : ''}`}
              onClick={onToggleFocusMode}
              title="专注模式 (Esc 退出)"
            >
              专注
            </button>
            <button className="btn-secondary" onClick={() => save(content)}>
              保存
            </button>
            {content.trim() && (
              <button className="btn-danger" onClick={onDeleteRequest}>
                删除
              </button>
            )}
          </div>
        </div>

        {error && <div className="editor-error">{error}</div>}

        <div className="editor-body">
          {isEmpty && (
            <p className="editor-empty-hint">今天还没有写下什么，开始记录吧...</p>
          )}
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="写下今天的故事..."
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
