import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar, type SidebarHandle } from './components/Sidebar';
import { EntryEditor } from './components/EntryEditor';
import { AnalyticsPage } from './components/AnalyticsPage';
import { SearchBar } from './components/SearchBar';
import { ConfirmDialog } from './components/ConfirmDialog';
import type { AppView, EditorActions, SavedEntryPayload } from './lib/types';
import { formatDisplayDate, getRelativeDateLabel, getTodayIso } from './lib/dateUtils';

type PendingNav =
  | { type: 'date'; date: string; searchQuery?: string }
  | { type: 'view'; view: AppView }
  | { type: 'quit' }
  | null;

export default function App() {
  const [selectedDate, setSelectedDate] = useState(getTodayIso());
  const [view, setView] = useState<AppView>('diary');
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  const analyticsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [analyticsSubtitle, setAnalyticsSubtitle] = useState('你的写作轨迹一览');
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<PendingNav>(null);
  const [searchHighlight, setSearchHighlight] = useState<string | null>(null);
  const [analyticsEverOpened, setAnalyticsEverOpened] = useState(false);
  const editorRef = useRef<EditorActions | null>(null);
  const sidebarRef = useRef<SidebarHandle>(null);
  const selectedDateRef = useRef(selectedDate);
  const viewRef = useRef(view);
  const isDirtyRef = useRef(false);

  selectedDateRef.current = selectedDate;
  viewRef.current = view;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFocusMode((f) => !f);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

  const scheduleAnalyticsRefresh = useCallback(() => {
    if (analyticsRefreshTimerRef.current) {
      clearTimeout(analyticsRefreshTimerRef.current);
    }
    analyticsRefreshTimerRef.current = setTimeout(() => {
      setAnalyticsRefreshKey((k) => k + 1);
      analyticsRefreshTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (analyticsRefreshTimerRef.current) {
        clearTimeout(analyticsRefreshTimerRef.current);
      }
    };
  }, []);

  const handleSaved = useCallback(
    (payload: SavedEntryPayload) => {
      sidebarRef.current?.updateEntryCharCount(payload.date, payload.charCount);
      scheduleAnalyticsRefresh();
    },
    [scheduleAnalyticsRefresh],
  );

  const navigateTo = useCallback((date: string, searchQuery?: string) => {
    setView('diary');
    setSelectedDate(date);
    if (searchQuery) setSearchHighlight(searchQuery);
  }, []);

  const completePendingNav = useCallback(
    (nav: NonNullable<PendingNav>) => {
      if (nav.type === 'date') {
        navigateTo(nav.date, nav.searchQuery);
        return;
      }
      if (nav.type === 'quit') {
        void window.diaryAPI.confirmAppClose();
        return;
      }
      setView(nav.view);
      if (nav.view === 'diary') {
        setFocusMode(false);
      }
    },
    [navigateTo],
  );

  const onDirtyChange = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
  }, []);

  const promptIfDirty = useCallback((nav: NonNullable<PendingNav>) => {
    if (viewRef.current === 'diary' && editorRef.current?.isDirty()) {
      setPendingNav(nav);
      setUnsavedDialogOpen(true);
      return true;
    }
    return false;
  }, []);

  const requestSelectDate = useCallback(
    (date: string, searchQuery?: string) => {
      if (
        date === selectedDateRef.current &&
        viewRef.current === 'diary' &&
        !searchQuery
      ) {
        return;
      }
      if (promptIfDirty({ type: 'date', date, searchQuery })) return;
      navigateTo(date, searchQuery);
    },
    [navigateTo, promptIfDirty],
  );

  const requestView = useCallback(
    (nextView: AppView) => {
      if (nextView === viewRef.current) return;
      if (promptIfDirty({ type: 'view', view: nextView })) return;
      setView(nextView);
      if (nextView === 'diary') {
        setFocusMode(false);
      }
    },
    [promptIfDirty],
  );

  const closeUnsavedDialog = useCallback(() => {
    setUnsavedDialogOpen(false);
    setPendingNav(null);
  }, []);

  const handleUnsavedSave = useCallback(async () => {
    const nav = pendingNav;
    if (!nav) return;
    await editorRef.current?.flushPendingSave();
    if (editorRef.current?.isDirty()) {
      setToast('保存失败，请检查磁盘权限后重试');
      return;
    }
    closeUnsavedDialog();
    completePendingNav(nav);
  }, [pendingNav, closeUnsavedDialog, completePendingNav]);

  const handleUnsavedDiscard = useCallback(() => {
    const nav = pendingNav;
    if (!nav) return;
    editorRef.current?.discardPendingChanges();
    closeUnsavedDialog();
    completePendingNav(nav);
  }, [pendingNav, closeUnsavedDialog, completePendingNav]);

  const handleToggleFocusMode = useCallback(() => {
    setFocusMode((f) => !f);
  }, []);

  const isDiaryView = view === 'diary';

  useEffect(() => {
    if (view === 'analytics') setAnalyticsEverOpened(true);
  }, [view]);

  useEffect(() => {
    return window.diaryAPI.onCloseRequested(() => {
      if (viewRef.current === 'diary' && editorRef.current?.isDirty()) {
        setPendingNav({ type: 'quit' });
        setUnsavedDialogOpen(true);
      } else {
        void window.diaryAPI.confirmAppClose();
      }
    });
  }, []);

  return (
    <div className={`app${focusMode ? ' focus-mode' : ''}`}>
      <Sidebar
        ref={sidebarRef}
        selectedDate={selectedDate}
        onSelectDate={requestSelectDate}
        onNotify={setToast}
        inert={focusMode}
        activeView={view}
        onOpenAnalytics={() => requestView('analytics')}
        onOpenDiary={() => requestView('diary')}
      />
      <main className="main">
        <header className={`main-header titlebar-drag${focusMode ? ' main-header--hidden' : ''}`}>
          <div className="main-header-date titlebar-no-drag" key={isDiaryView ? selectedDate : view}>
            {isDiaryView ? (
              <>
                {formatDisplayDate(selectedDate)}
                <span>{getRelativeDateLabel(selectedDate)}</span>
              </>
            ) : (
              <>
                数据分析
                <span>{analyticsSubtitle}</span>
              </>
            )}
          </div>
          <div className="main-header-search titlebar-no-drag">
            {isDiaryView && <SearchBar onSelectDate={requestSelectDate} />}
          </div>
        </header>
        <div className="main-body">
          <div className={`main-pane${isDiaryView ? '' : ' main-pane--hidden'}`}>
            <EntryEditor
              date={selectedDate}
              focusMode={focusMode}
              onToggleFocusMode={handleToggleFocusMode}
              onSelectDate={requestSelectDate}
              onSaved={handleSaved}
              onDirtyChange={onDirtyChange}
              onNotify={setToast}
              highlightQuery={searchHighlight}
              onHighlightDone={() => setSearchHighlight(null)}
              editorRef={editorRef}
            />
          </div>
          {analyticsEverOpened && (
            <div className={`main-pane${isDiaryView ? ' main-pane--hidden' : ''}`}>
              <AnalyticsPage
                refreshKey={analyticsRefreshKey}
                onSelectDate={requestSelectDate}
                onSubtitleChange={setAnalyticsSubtitle}
              />
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div className="app-toast" role="alert">
          {toast}
        </div>
      )}

      <ConfirmDialog
        open={unsavedDialogOpen}
        mode="unsaved"
        title="有未保存的修改"
        message="当前日记尚未保存，要离开吗？"
        onCancel={closeUnsavedDialog}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        closeOnOverlayClick={false}
      />
    </div>
  );
}
