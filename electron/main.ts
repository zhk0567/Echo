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
  getStats,
  getWritingStreak,
  listDates,
  migrateFromTxtIfNeeded,
  migrateFromXlsxIfNeeded,
  saveEntry,
  searchEntries,
} from './diaryStore';

let mainWindow: BrowserWindow | null = null;
let allowClose = false;

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

function createWindow() {
  const root = getAppRoot();
  migrateFromTxtIfNeeded(root);
  migrateFromXlsxIfNeeded(root);

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    title: 'Echo 日记',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#faf6ee',
      symbolColor: '#1f1a16',
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

  mainWindow.on('close', (e) => {
    if (allowClose) return;
    e.preventDefault();
    mainWindow?.webContents.send('diary:requestClose');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    allowClose = false;
  });
}

app.whenReady().then(() => {
  const root = getAppRoot();

  ipcMain.handle('diary:listDates', (_event, year?: number, month?: number) => {
    return listDates(root, year, month);
  });

  ipcMain.handle('diary:getEntry', (_event, date: string) => {
    return getEntry(root, date);
  });

  ipcMain.handle('diary:saveEntry', (_event, date: string, content: string) => {
    return saveEntry(root, date, content);
  });

  ipcMain.handle('diary:deleteEntry', (_event, date: string) => {
    return deleteEntry(root, date);
  });

  ipcMain.handle('diary:searchEntries', (_event, query: string) => {
    return searchEntries(root, query);
  });

  ipcMain.handle('diary:getWritingStreak', () => {
    return getWritingStreak(root);
  });

  ipcMain.handle('diary:getStats', (_event, year: number, month: number) => {
    return getStats(root, year, month);
  });

  ipcMain.handle('diary:getMonthCharCounts', (_event, year: number, month: number) => {
    return getMonthCharCounts(root, year, month);
  });

  ipcMain.handle('diary:getMonthOverview', (_event, year: number, month: number) => {
    return getMonthOverview(root, year, month);
  });

  ipcMain.handle('diary:getAnalytics', () => {
    return getAnalytics(root);
  });

  ipcMain.handle('diary:confirmClose', () => {
    allowClose = true;
    mainWindow?.close();
  });

  ipcMain.handle('diary:exportToTxt', async () => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      title: '导出日记',
      defaultPath: path.join(root, '日记.txt'),
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    });
    if (canceled || !filePath) {
      return { ok: false as const, cancelled: true };
    }
    try {
      const { count } = exportDiaryToTxt(root, filePath);
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
