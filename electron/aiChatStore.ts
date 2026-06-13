import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { AiMessage } from './ollamaService';

const CHATS_DIRNAME = 'ai-chats';

function getChatsDir(): string {
  return path.join(app.getPath('userData'), CHATS_DIRNAME);
}

function getChatFilePath(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid chat date: ${date}`);
  }
  return path.join(getChatsDir(), `${date}.json`);
}

function sanitizeMessages(messages: AiMessage[]): AiMessage[] {
  return messages.filter(
    (m) =>
      (m.role === 'user' && m.content.trim()) ||
      (m.role === 'assistant' && m.content.trim()),
  );
}

export function loadAiChat(date: string): AiMessage[] {
  const filePath = getChatFilePath(date);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
      messages?: AiMessage[];
    };
    return Array.isArray(raw.messages) ? sanitizeMessages(raw.messages) : [];
  } catch {
    return [];
  }
}

export function saveAiChat(date: string, messages: AiMessage[]): void {
  const sanitized = sanitizeMessages(messages);
  const dir = getChatsDir();
  fs.mkdirSync(dir, { recursive: true });

  const filePath = getChatFilePath(date);
  if (sanitized.length === 0) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }

  fs.writeFileSync(
    filePath,
    JSON.stringify({ messages: sanitized, updatedAt: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

export function clearAiChat(date: string): void {
  const filePath = getChatFilePath(date);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/** 从渲染进程 localStorage 一次性迁移旧数据 */
export function migrateAiChatsFromLegacy(
  legacy: Record<string, { messages?: AiMessage[] }>,
): number {
  let count = 0;
  for (const [date, entry] of Object.entries(legacy)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const messages = sanitizeMessages(entry?.messages ?? []);
    if (messages.length === 0) continue;
    const existing = loadAiChat(date);
    if (existing.length > 0) continue;
    saveAiChat(date, messages);
    count++;
  }
  return count;
}
