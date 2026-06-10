import type { AiMessage } from './types';

const STORAGE_KEY = 'echo-ai-chats';

interface StoredChat {
  messages: AiMessage[];
  updatedAt: string;
}

type ChatStore = Record<string, StoredChat>;

function readStore(): ChatStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ChatStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: ChatStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function sanitizeMessages(messages: AiMessage[]): AiMessage[] {
  return messages.filter(
    (m) =>
      (m.role === 'user' && m.content.trim()) ||
      (m.role === 'assistant' && m.content.trim()),
  );
}

export function loadAiChat(date: string): AiMessage[] {
  const store = readStore();
  return store[date]?.messages ?? [];
}

export function saveAiChat(date: string, messages: AiMessage[]): void {
  const sanitized = sanitizeMessages(messages);
  const store = readStore();
  if (sanitized.length === 0) {
    delete store[date];
  } else {
    store[date] = {
      messages: sanitized,
      updatedAt: new Date().toISOString(),
    };
  }
  writeStore(store);
}

export function clearAiChat(date: string): void {
  const store = readStore();
  delete store[date];
  writeStore(store);
}
