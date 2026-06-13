import type { AiMessage } from './types';

const LEGACY_STORAGE_KEY = 'echo-ai-chats';

type LegacyChatStore = Record<string, { messages?: AiMessage[] }>;

let migrationDone = false;

/** 将旧版 localStorage 对话迁移到主进程文件（仅执行一次） */
export async function migrateLegacyAiChatsIfNeeded(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw) as LegacyChatStore;
    const count = await window.aiAPI.migrateLegacyChats(legacy);
    if (count > 0) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export async function loadAiChat(date: string): Promise<AiMessage[]> {
  await migrateLegacyAiChatsIfNeeded();
  return window.aiAPI.loadChat(date);
}

export async function saveAiChat(date: string, messages: AiMessage[]): Promise<void> {
  await window.aiAPI.saveChat(date, messages);
}

export async function clearAiChat(date: string): Promise<void> {
  await window.aiAPI.clearChat(date);
}
