import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  deleteEntry,
  getEntry,
  getMonthCharCounts,
  getStats,
  getWritingStreak,
  listDates,
  migrateFromTxtIfNeeded,
  saveEntry,
  searchEntries,
} from './diaryStore';

let mainWindow: BrowserWindow | null = null;

function getAppRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'entries')) || fs.existsSync(path.join(cwd, '日记.txt'))) {
    return cwd;
  }
  if (app.isPackaged) {
    return path.dirname(app.getPath('exe'));
  }
  return cwd;
}

function createWindow() {
  const root = getAppRoot();
  migrateFromTxtIfNeeded(root);

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    title: 'Echo 日记',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#fffef8',
      symbolColor: '#3a342e',
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

  mainWindow.on('closed', () => {
    mainWindow = null;
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
