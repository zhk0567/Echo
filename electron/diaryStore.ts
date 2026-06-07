import fs from 'fs';
import path from 'path';

export interface DiaryEntry {
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  date: string;
  snippet: string;
}

export interface DiaryStats {
  totalEntries: number;
  totalChars: number;
  monthEntries: number;
  monthChars: number;
}

const DATE_PATTERN = /^\d{4}\.\d{2}\.\d{2}$/;

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function countChars(content: string): number {
  return normalizeNewlines(content).replace(/\n/g, '').length;
}

function readAllEntries(root: string): DiaryEntry[] {
  ensureEntriesDir(root);
  const files = fs.readdirSync(getEntriesDir(root)).filter((f) => f.endsWith('.json'));
  return files.map((file) => {
    const filePath = path.join(getEntriesDir(root), file);
    const entry = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DiaryEntry;
    entry.content = normalizeNewlines(entry.content);
    return entry;
  });
}

function toIsoDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('.');
  return `${y}-${m}-${d}`;
}

function getEntriesDir(root: string): string {
  return path.join(root, 'entries');
}

function getEntryPath(root: string, date: string): string {
  return path.join(getEntriesDir(root), `${date}.json`);
}

function ensureEntriesDir(root: string): void {
  const dir = getEntriesDir(root);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseDiaryTxt(content: string): Array<{ date: string; content: string }> {
  const segments = content.split('\r');
  const entries: Array<{ date: string; content: string }> = [];
  let currentDate: string | null = null;
  let currentLines: string[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    if (DATE_PATTERN.test(trimmed)) {
      if (currentDate) {
        entries.push({
          date: toIsoDate(currentDate),
          content: currentLines.join('\n').trim(),
        });
      }
      currentDate = trimmed;
      currentLines = [];
    } else if (currentDate) {
      currentLines.push(segment);
    }
  }

  if (currentDate) {
    entries.push({
      date: toIsoDate(currentDate),
      content: currentLines.join('\n').trim(),
    });
  }

  return entries;
}

export function migrateFromTxtIfNeeded(root: string): void {
  const entriesDir = getEntriesDir(root);
  const txtPath = path.join(root, '日记.txt');

  ensureEntriesDir(root);

  const existing = fs.existsSync(entriesDir)
    ? fs.readdirSync(entriesDir).filter((f) => f.endsWith('.json'))
    : [];

  if (existing.length > 0 || !fs.existsSync(txtPath)) {
    return;
  }

  const content = fs.readFileSync(txtPath, 'utf-8');
  const entries = parseDiaryTxt(content);
  const now = new Date().toISOString();

  for (const entry of entries) {
    const filePath = getEntryPath(root, entry.date);
    if (fs.existsSync(filePath)) continue;

    const record: DiaryEntry = {
      date: entry.date,
      content: entry.content,
      createdAt: `${entry.date}T00:00:00.000Z`,
      updatedAt: now,
    };

    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
  }
}

export function listDates(root: string, year?: number, month?: number): string[] {
  ensureEntriesDir(root);
  const files = fs.readdirSync(getEntriesDir(root)).filter((f) => f.endsWith('.json'));

  let dates = files.map((f) => f.replace('.json', '')).sort();

  if (year !== undefined) {
    dates = dates.filter((d) => {
      const [y, m] = d.split('-').map(Number);
      if (y !== year) return false;
      if (month !== undefined && m !== month) return false;
      return true;
    });
  }

  return dates;
}

export function getEntry(root: string, date: string): DiaryEntry | null {
  const filePath = getEntryPath(root, date);
  if (!fs.existsSync(filePath)) return null;
  const entry = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DiaryEntry;
  entry.content = normalizeNewlines(entry.content);
  return entry;
}

export function saveEntry(root: string, date: string, content: string): DiaryEntry {
  ensureEntriesDir(root);
  const filePath = getEntryPath(root, date);
  const now = new Date().toISOString();
  const existing = getEntry(root, date);

  const record: DiaryEntry = {
    date,
    content: normalizeNewlines(content),
    createdAt: existing?.createdAt ?? `${date}T00:00:00.000Z`,
    updatedAt: now,
  };

  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
  return record;
}

export function deleteEntry(root: string, date: string): boolean {
  const filePath = getEntryPath(root, date);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function searchEntries(root: string, query: string): SearchResult[] {
  if (!query.trim()) return [];

  ensureEntriesDir(root);
  const files = fs.readdirSync(getEntriesDir(root)).filter((f) => f.endsWith('.json'));
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for (const file of files) {
    const filePath = path.join(getEntriesDir(root), file);
    const entry = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DiaryEntry;
    const lowerContent = entry.content.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);

    if (index === -1) continue;

    const start = Math.max(0, index - 30);
    const end = Math.min(entry.content.length, index + query.length + 30);
    let snippet = entry.content.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < entry.content.length) snippet = snippet + '...';

    results.push({ date: entry.date, snippet });
  }

  return results.sort((a, b) => b.date.localeCompare(a.date));
}

function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWritingStreak(root: string): number {
  const allDates = new Set(listDates(root));
  if (allDates.size === 0) return 0;

  const cursor = new Date();
  const today = toLocalIso(cursor);
  if (!allDates.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (allDates.has(toLocalIso(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function getStats(root: string, year: number, month: number): DiaryStats {
  const entries = readAllEntries(root);
  let monthEntries = 0;
  let monthChars = 0;
  let totalChars = 0;

  for (const entry of entries) {
    const chars = countChars(entry.content);
    if (!entry.content.trim()) continue;

    totalChars += chars;
    const [y, m] = entry.date.split('-').map(Number);
    if (y === year && m === month) {
      monthEntries++;
      monthChars += chars;
    }
  }

  return {
    totalEntries: entries.filter((e) => e.content.trim()).length,
    totalChars,
    monthEntries,
    monthChars,
  };
}

export function getMonthCharCounts(
  root: string,
  year: number,
  month: number,
): Record<string, number> {
  const entries = readAllEntries(root);
  const counts: Record<string, number> = {};

  for (const entry of entries) {
    const [y, m] = entry.date.split('-').map(Number);
    if (y !== year || m !== month) continue;
    const chars = countChars(entry.content);
    if (chars > 0) counts[entry.date] = chars;
  }

  return counts;
}
