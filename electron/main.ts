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
import { chatStream, checkOllamaHealth, type AiMessage } from './ollamaService';
import { enforceSingleInstance } from './singleInstance';

let mainWindow: BrowserWindow | null = null;
const streamControllers = new Map<string, AbortController>();
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

  ipcMain.handle('ai:checkHealth', () => checkOllamaHealth());

  ipcMain.handle('ai:chatStream', async (event, requestId: string, messages: AiMessage[]) => {
    const controller = new AbortController();
    streamControllers.set(requestId, controller);
    const sender = event.sender;
    const timeoutSignal = AbortSignal.timeout(120_000);
    const signal = AbortSignal.any([controller.signal, timeoutSignal]);

    try {
      await chatStream({
        messages,
        signal,
        onChunk: (chunk) => sender.send('ai:stream-chunk', { requestId, chunk }),
      });
      sender.send('ai:stream-done', { requestId });
    } catch (err) {
      if (controller.signal.aborted) {
        sender.send('ai:stream-done', { requestId, aborted: true });
      } else if (timeoutSignal.aborted) {
        sender.send('ai:stream-error', {
          requestId,
          error: '请求超时（120 秒），请稍后重试或点击停止',
        });
      } else {
        const message = err instanceof Error ? err.message : 'AI 请求失败';
        sender.send('ai:stream-error', { requestId, error: message });
      }
    } finally {
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
      defaultPath: path.join(appRoot, '日记.txt'),
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    });
    if (canceled || !filePath) {
      return { ok: false as const, cancelled: true };
    }
    try {
      const { count } = exportDiaryToTxt(appRoot, filePath);
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
