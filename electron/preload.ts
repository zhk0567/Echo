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
  getMonthOverview: (year: number, month: number) =>
    ipcRenderer.invoke('diary:getMonthOverview', year, month),
  getAnalytics: () => ipcRenderer.invoke('diary:getAnalytics'),
  getNameWatchlist: () => ipcRenderer.invoke('diary:getNameWatchlist'),
  saveNameWatchlist: (names: string[]) => ipcRenderer.invoke('diary:saveNameWatchlist', names),
  autoDetectNames: () => ipcRenderer.invoke('diary:autoDetectNames'),
  confirmAppClose: () => ipcRenderer.invoke('diary:confirmClose'),
  exportToTxt: () => ipcRenderer.invoke('diary:exportToTxt'),
  onCloseRequested: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('diary:requestClose', handler);
    return () => ipcRenderer.removeListener('diary:requestClose', handler);
  },
});

contextBridge.exposeInMainWorld('aiAPI', {
  loadChat: (date: string) => ipcRenderer.invoke('ai:loadChat', date),
  saveChat: (date: string, messages: AiMessage[]) =>
    ipcRenderer.invoke('ai:saveChat', date, messages),
  clearChat: (date: string) => ipcRenderer.invoke('ai:clearChat', date),
  migrateLegacyChats: (legacy: Record<string, { messages?: AiMessage[] }>) =>
    ipcRenderer.invoke('ai:migrateLegacyChats', legacy),
  checkHealth: () => ipcRenderer.invoke('ai:checkHealth'),
  warmup: () => ipcRenderer.invoke('ai:warmup'),
  chatStream: (requestId: string, messages: AiMessage[]) =>
    ipcRenderer.invoke('ai:chatStream', requestId, messages),
  abort: (requestId: string) => ipcRenderer.invoke('ai:abort', requestId),
  onStreamChunk: (callback: (payload: AiStreamChunkEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: AiStreamChunkEvent) =>
      callback(payload);
    ipcRenderer.on('ai:stream-chunk', handler);
    return () => ipcRenderer.removeListener('ai:stream-chunk', handler);
  },
  onStreamDone: (callback: (payload: AiStreamDoneEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: AiStreamDoneEvent) =>
      callback(payload);
    ipcRenderer.on('ai:stream-done', handler);
    return () => ipcRenderer.removeListener('ai:stream-done', handler);
  },
  onStreamError: (callback: (payload: AiStreamErrorEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: AiStreamErrorEvent) =>
      callback(payload);
    ipcRenderer.on('ai:stream-error', handler);
    return () => ipcRenderer.removeListener('ai:stream-error', handler);
  },
});

interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiStreamChunkEvent {
  requestId: string;
  chunk: string;
}

interface AiStreamDoneEvent {
  requestId: string;
  aborted?: boolean;
  partial?: boolean;
  timeoutKind?: 'idle' | 'max';
}

interface AiStreamErrorEvent {
  requestId: string;
  error: string;
}
