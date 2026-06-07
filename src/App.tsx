import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { EntryEditor } from './components/EntryEditor';
import { SearchBar } from './components/SearchBar';
import { ConfirmDialog } from './components/ConfirmDialog';
import type { EditorActions } from './lib/types';
import { formatDisplayDate, getRelativeDateLabel, getTodayIso } from './lib/dateUtils';

type PendingAction =
  | { type: 'navigate'; date: string }
  | { type: 'delete' }
  | null;

export default function App() {
  const [selectedDate, setSelectedDate] = useState(getTodayIso());
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const editorRef = useRef<EditorActions | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const navigateTo = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const requestSelectDate = useCallback(
    (date: string) => {
      if (date === selectedDate) return;
      if (isDirty) {
        setPendingAction({ type: 'navigate', date });
        return;
      }
      navigateTo(date);
    },
    [isDirty, selectedDate, navigateTo],
  );

  const handleUnsavedSave = useCallback(async () => {
    await editorRef.current?.flushPendingSave();
    if (pendingAction?.type === 'navigate') {
      navigateTo(pendingAction.date);
    }
    setPendingAction(null);
  }, [pendingAction, navigateTo]);

  const handleUnsavedDiscard = useCallback(() => {
    if (pendingAction?.type === 'navigate') {
      navigateTo(pendingAction.date);
    }
    setPendingAction(null);
    setIsDirty(false);
  }, [pendingAction, navigateTo]);

  const handleDeleteRequest = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    setDeleteDialogOpen(false);
    try {
      await window.diaryAPI.deleteEntry(selectedDate);
      setIsDirty(false);
      setRefreshKey((k) => k + 1);
    } catch {
      // ignore
    }
  }, [selectedDate]);

  return (
    <div className={`app${focusMode ? ' focus-mode' : ''}`}>
      <Sidebar
        selectedDate={selectedDate}
        onSelectDate={requestSelectDate}
        refreshKey={refreshKey}
      />
      <main className="main">
        <header className="main-header titlebar-drag">
          <div className="main-header-date titlebar-no-drag" key={selectedDate}>
            {formatDisplayDate(selectedDate)}
            <span>{getRelativeDateLabel(selectedDate)}</span>
          </div>
          <div className="main-header-search titlebar-no-drag">
            <SearchBar onSelectDate={requestSelectDate} />
          </div>
        </header>
        <div className="main-body">
          <EntryEditor
            key={`${selectedDate}-${refreshKey}`}
            date={selectedDate}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode((f) => !f)}
            onSelectDate={requestSelectDate}
            onSaved={handleSaved}
            onDirtyChange={setIsDirty}
            onDeleteRequest={handleDeleteRequest}
            editorRef={editorRef}
          />
        </div>
      </main>

      <ConfirmDialog
        open={pendingAction !== null}
        mode="unsaved"
        title="有未保存的修改"
        message="当前日记尚未保存，离开前如何处理？"
        onCancel={() => setPendingAction(null)}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="删除日记"
        message="确定删除这篇日记吗？此操作不可恢复。"
        confirmLabel="删除"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
