import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('diaryAPI', {
  listDates: (year?: number, month?: number) =>
    ipcRenderer.invoke('diary:listDates', year, month),
  getEntry: (date: string) => ipcRenderer.invoke('diary:getEntry', date),
  saveEntry: (date: string, content: string) =>
    ipcRenderer.invoke('diary:saveEntry', date, content),
  deleteEntry: (date: string) => ipcRenderer.invoke('diary:deleteEntry', date),
  searchEntries: (query: string) => ipcRenderer.invoke('diary:searchEntries', query),
  getWritingStreak: () => ipcRenderer.invoke('diary:getWritingStreak'),
  getStats: (year: number, month: number) => ipcRenderer.invoke('diary:getStats', year, month),
  getMonthCharCounts: (year: number, month: number) =>
    ipcRenderer.invoke('diary:getMonthCharCounts', year, month),
});
