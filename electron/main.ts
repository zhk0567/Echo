import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  deleteEntry,
  exportDiaryToTxt,
  getEntry,
  getMonthCharCounts,
  getAnalytics,
  getMonthOverview,
  autoDetectNames,
  getNameWatchlist,
  getStats,
  getWritingStreak,
  listDates,
  saveNameWatchlist,
  migrateFromTxtIfNeeded,
  migrateFromXlsxIfNeeded,
  saveEntry,
  searchEntries,
  warmupDiaryStore,
} from './diaryStore';
import {
  ChatStreamTimeoutError,
  CHAT_STREAM_IPC_BATCH_MS,
  chatStream,
  checkOllamaHealth,
  isModelRunning,
  warmupModel,
  type AiMessage,
} from './ollamaService';
import {
  clearAiChat,
  loadAiChat,
  migrateAiChatsFromLegacy,
  saveAiChat,
} from './aiChatStore';
import {
  getDefaultExportPath,
  migrateExportSettingsFromAppRoot,
  rememberExportPath,
} from './exportSettings';
import { enforceSingleInstance } from './singleInstance';

let mainWindow: BrowserWindow | null = null;
const streamControllers = new Map<string, AbortController>();
let warmupAbortController: AbortController | null = null;
let allowClose = false;
let appRoot = '';

// Windows 11 Fluent 滚动条会忽略 webkit 自定义样式，改用经典滚动条以支持圆角胶囊形
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'FluentOverlayScrollbars,FluentScrollbar');
}

function hasDataMarkers(root: string): boolean {
  return (
    fs.existsSync(path.join(root, 'entries')) ||
    fs.existsSync(path.join(root, '日记.txt')) ||
    fs.existsSync(path.join(root, 'zhita_settings.xlsx'))
  );
}

/** Walk upward to find the project folder that contains entries/ or legacy import files. */
function findAppRootFrom(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 8; i++) {
    if (hasDataMarkers(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function getAppRoot(): string {
  if (process.env.ECHO_APP_ROOT) {
    const explicit = findAppRootFrom(process.env.ECHO_APP_ROOT);
    if (explicit) return explicit;
    if (hasDataMarkers(process.env.ECHO_APP_ROOT)) return process.env.ECHO_APP_ROOT;
  }

  const candidates = [
    process.env.PORTABLE_EXECUTABLE_DIR,
    process.cwd(),
    app.isPackaged ? path.dirname(app.getPath('exe')) : null,
  ].filter((d): d is string => typeof d === 'string' && d.length > 0);

  for (const dir of candidates) {
    const found = findAppRootFrom(dir);
    if (found) return found;
  }

  return (
    process.env.PORTABLE_EXECUTABLE_DIR ||
    (app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd())
  );
}

function scheduleStartupTasks(root: string) {
  setImmediate(() => {
    migrateFromTxtIfNeeded(root);
    void migrateFromXlsxIfNeeded(root);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    show: false,
    backgroundColor: '#faf6ee',
    title: 'Echo 日记',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#faf6ee',
      symbolColor: '#4a433c',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  let windowShown = false;
  const showMainWindow = () => {
    if (windowShown || !mainWindow) return;
    windowShown = true;
    mainWindow.show();
    scheduleStartupTasks(appRoot);
  };

  const showFallbackTimer = setTimeout(() => {
    console.warn('[Echo] ready-to-show timeout — showing window as fallback');
    showMainWindow();
  }, 8000);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showFallbackTimer);
    showMainWindow();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Echo] did-fail-load', errorCode, errorDescription, validatedURL);
  });

  mainWindow.on('close', (e) => {
    if (allowClose) return;
    e.preventDefault();
    mainWindow?.webContents.send('diary:requestClose');
  });

  mainWindow.on('closed', () => {
    for (const controller of streamControllers.values()) {
      controller.abort();
    }
    streamControllers.clear();
    mainWindow = null;
    allowClose = false;
  });
}

if (!enforceSingleInstance(() => mainWindow)) {
  // Another instance holds the lock; this process is exiting.
} else app.whenReady().then(() => {
  appRoot = getAppRoot();
  migrateExportSettingsFromAppRoot(appRoot);
  setImmediate(() => warmupDiaryStore(appRoot));

  ipcMain.handle('diary:listDates', (_event, year?: number, month?: number) => {
    return listDates(appRoot, year, month);
  });

  ipcMain.handle('diary:getEntry', (_event, date: string) => {
    return getEntry(appRoot, date);
  });

  ipcMain.handle('diary:saveEntry', (_event, date: string, content: string) => {
    return saveEntry(appRoot, date, content);
  });

  ipcMain.handle('diary:deleteEntry', (_event, date: string) => {
    return deleteEntry(appRoot, date);
  });

  ipcMain.handle('diary:searchEntries', (_event, query: string) => {
    return searchEntries(appRoot, query);
  });

  ipcMain.handle('diary:getWritingStreak', () => {
    return getWritingStreak(appRoot);
  });

  ipcMain.handle('diary:getStats', (_event, year: number, month: number) => {
    return getStats(appRoot, year, month);
  });

  ipcMain.handle('diary:getMonthCharCounts', (_event, year: number, month: number) => {
    return getMonthCharCounts(appRoot, year, month);
  });

  ipcMain.handle('diary:getMonthOverview', (_event, year: number, month: number) => {
    return getMonthOverview(appRoot, year, month);
  });

  ipcMain.handle('diary:getAnalytics', () => {
    return getAnalytics(appRoot);
  });

  ipcMain.handle('diary:getNameWatchlist', () => {
    return getNameWatchlist(appRoot);
  });

  ipcMain.handle('diary:saveNameWatchlist', (_event, names: string[]) => {
    return saveNameWatchlist(appRoot, names);
  });

  ipcMain.handle('diary:autoDetectNames', () => {
    return autoDetectNames(appRoot);
  });

  ipcMain.handle('diary:confirmClose', () => {
    allowClose = true;
    mainWindow?.close();
  });

  ipcMain.handle('ai:loadChat', (_event, date: string) => loadAiChat(date));

  ipcMain.handle('ai:saveChat', (_event, date: string, messages: AiMessage[]) => {
    saveAiChat(date, messages);
  });

  ipcMain.handle('ai:clearChat', (_event, date: string) => {
    clearAiChat(date);
  });

  ipcMain.handle(
    'ai:migrateLegacyChats',
    (_event, legacy: Record<string, { messages?: AiMessage[] }>) =>
      migrateAiChatsFromLegacy(legacy),
  );

  ipcMain.handle('ai:checkHealth', () => checkOllamaHealth());

  ipcMain.handle('ai:warmup', async () => {
    if (await isModelRunning()) return;
    if (warmupAbortController) warmupAbortController.abort();
    warmupAbortController = new AbortController();
    const signal = warmupAbortController.signal;
    try {
      await warmupModel(undefined, undefined, signal);
    } finally {
      if (warmupAbortController?.signal === signal) warmupAbortController = null;
    }
  });

  ipcMain.handle('ai:chatStream', async (event, requestId: string, messages: AiMessage[]) => {
    if (warmupAbortController) {
      warmupAbortController.abort();
      warmupAbortController = null;
    }

    const controller = new AbortController();
    streamControllers.set(requestId, controller);
    const sender = event.sender;
    let receivedChunk = false;
    let pendingChunk = '';
    let batchTimer: ReturnType<typeof setTimeout> | null = null;
    let flushedToUi = false;

    const flushChunks = () => {
      batchTimer = null;
      if (!pendingChunk) return;
      sender.send('ai:stream-chunk', { requestId, chunk: pendingChunk });
      pendingChunk = '';
      flushedToUi = true;
    };

    const scheduleFlush = () => {
      if (!flushedToUi) {
        flushChunks();
        return;
      }
      if (!batchTimer) {
        batchTimer = setTimeout(flushChunks, CHAT_STREAM_IPC_BATCH_MS);
      }
    };

    try {
      await chatStream({
        messages,
        signal: controller.signal,
        onChunk: (chunk) => {
          receivedChunk = true;
          pendingChunk += chunk;
          scheduleFlush();
        },
      });
      sender.send('ai:stream-done', { requestId });
    } catch (err) {
      if (controller.signal.aborted) {
        sender.send('ai:stream-done', { requestId, aborted: true });
      } else if (err instanceof ChatStreamTimeoutError) {
        if (receivedChunk) {
          sender.send('ai:stream-done', {
            requestId,
            partial: true,
            timeoutKind: err.kind,
          });
        } else {
          const error =
            err.kind === 'idle'
              ? '长时间无响应（120 秒），请检查 Ollama 或稍后重试'
              : '生成时间过长，请缩短日记上下文或稍后重试';
          sender.send('ai:stream-error', { requestId, error });
        }
      } else {
        const message = err instanceof Error ? err.message : 'AI 请求失败';
        sender.send('ai:stream-error', { requestId, error: message });
      }
    } finally {
      if (batchTimer) clearTimeout(batchTimer);
      flushChunks();
      streamControllers.delete(requestId);
    }
  });

  ipcMain.handle('ai:abort', (_event, requestId: string) => {
    streamControllers.get(requestId)?.abort();
    streamControllers.delete(requestId);
  });

  ipcMain.handle('diary:exportToTxt', async () => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      title: '导出日记',
      defaultPath: getDefaultExportPath(),
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    });
    if (canceled || !filePath) {
      return { ok: false as const, cancelled: true };
    }
    try {
      const { count } = exportDiaryToTxt(appRoot, filePath);
      rememberExportPath(filePath);
      return { ok: true as const, path: filePath, count };
    } catch {
      return { ok: false as const, cancelled: false };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
