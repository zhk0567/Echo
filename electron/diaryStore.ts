import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

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

export interface MonthOverview {
  charCounts: Record<string, number>;
  stats: DiaryStats;
  streak: number;
}

export interface AnalyticsSummary {
  totalEntries: number;
  totalChars: number;
  streak: number;
  avgCharsPerEntry: number;
  activeDays: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
}

export interface AnalyticsMonthPoint {
  month: string;
  entries: number;
  chars: number;
}

export interface AnalyticsWeekdayPoint {
  weekday: number;
  label: string;
  entries: number;
  chars: number;
}

export interface AnalyticsYearPoint {
  year: number;
  entries: number;
  chars: number;
}

export interface AnalyticsEntryRank {
  date: string;
  chars: number;
}

export interface AnalyticsHeatmapCell {
  date: string;
  chars: number;
  level: 0 | 1 | 2 | 3;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  monthlyTrend: AnalyticsMonthPoint[];
  weekdayDistribution: AnalyticsWeekdayPoint[];
  yearlyStats: AnalyticsYearPoint[];
  topEntries: AnalyticsEntryRank[];
  bottomEntries: AnalyticsEntryRank[];
  heatmap: AnalyticsHeatmapCell[];
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function getHeatLevel(chars: number): 0 | 1 | 2 | 3 {
  if (chars <= 0) return 0;
  if (chars >= 800) return 3;
  if (chars >= 200) return 2;
  return 1;
}

interface StatsCache {
  root: string;
  totalEntries: number;
  totalChars: number;
  datesWithContent: Set<string>;
  charByDate: Map<string, number>;
}

const CHAR_INDEX_VERSION = 1;
const CHAR_INDEX_FILENAME = '_charIndex.json';
const ENTRY_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}\.json$/;

interface CharIndexFile {
  version: number;
  entryFileCount: number;
  charByDate: Record<string, number>;
}

let statsCache: StatsCache | null = null;
let analyticsCache: { root: string; data: AnalyticsData } | null = null;
let contentIndex: { root: string; byDate: Map<string, string> } | null = null;

function invalidateStatsCache(): void {
  statsCache = null;
  analyticsCache = null;
  contentIndex = null;
}

function invalidateAnalyticsCache(): void {
  analyticsCache = null;
}

function getCharIndexPath(root: string): string {
  return path.join(getEntriesDir(root), CHAR_INDEX_FILENAME);
}

function listEntryFiles(root: string): string[] {
  ensureEntriesDir(root);
  return fs.readdirSync(getEntriesDir(root)).filter((f) => ENTRY_FILE_PATTERN.test(f));
}

function loadCharIndex(root: string): CharIndexFile | null {
  const indexPath = getCharIndexPath(root);
  if (!fs.existsSync(indexPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as CharIndexFile;
    if (raw.version !== CHAR_INDEX_VERSION || !raw.charByDate) return null;
    return raw;
  } catch {
    return null;
  }
}

function saveCharIndex(root: string, charByDate: Map<string, number>): void {
  ensureEntriesDir(root);
  const record: CharIndexFile = {
    version: CHAR_INDEX_VERSION,
    entryFileCount: listEntryFiles(root).length,
    charByDate: Object.fromEntries(charByDate),
  };
  fs.writeFileSync(getCharIndexPath(root), JSON.stringify(record), 'utf-8');
}

function rebuildCharIndex(root: string): Map<string, number> {
  const charByDate = new Map<string, number>();
  for (const file of listEntryFiles(root)) {
    const filePath = path.join(getEntriesDir(root), file);
    const entry = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DiaryEntry;
    const chars = countChars(entry.content);
    if (chars > 0) charByDate.set(entry.date, chars);
  }
  saveCharIndex(root, charByDate);
  return charByDate;
}

function isCharIndexStale(root: string, index: CharIndexFile): boolean {
  return listEntryFiles(root).length !== index.entryFileCount;
}

function buildStatsCacheFromCharMap(root: string, charByDate: Map<string, number>): StatsCache {
  const cache: StatsCache = {
    root,
    totalEntries: 0,
    totalChars: 0,
    datesWithContent: new Set(),
    charByDate,
  };

  for (const [date, chars] of charByDate) {
    if (chars <= 0) continue;
    cache.totalEntries++;
    cache.totalChars += chars;
    cache.datesWithContent.add(date);
  }

  return cache;
}

function ensureStatsCache(root: string): StatsCache {
  if (statsCache?.root === root) return statsCache;

  const loaded = loadCharIndex(root);
  const charMap =
    loaded && !isCharIndexStale(root, loaded)
      ? new Map(Object.entries(loaded.charByDate))
      : rebuildCharIndex(root);

  statsCache = buildStatsCacheFromCharMap(root, charMap);
  return statsCache;
}

function persistCharIndexFromCache(root: string): void {
  if (!statsCache || statsCache.root !== root) return;
  saveCharIndex(root, statsCache.charByDate);
}

function updateStatsCache(root: string, date: string, content: string): void {
  const chars = countChars(content);
  const cache = ensureStatsCache(root);
  const prevChars = cache.charByDate.get(date) ?? 0;

  if (prevChars > 0) {
    cache.totalChars -= prevChars;
    cache.datesWithContent.delete(date);
    cache.charByDate.delete(date);
    cache.totalEntries--;
  }

  if (chars > 0) {
    cache.totalEntries++;
    cache.totalChars += chars;
    cache.datesWithContent.add(date);
    cache.charByDate.set(date, chars);
  }

  persistCharIndexFromCache(root);
  invalidateAnalyticsCache();
  updateContentIndexEntry(root, date, content);
}

function ensureContentIndex(root: string): Map<string, string> {
  if (contentIndex?.root === root) return contentIndex.byDate;

  const byDate = new Map<string, string>();
  for (const file of listEntryFiles(root)) {
    const filePath = path.join(getEntriesDir(root), file);
    const entry = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DiaryEntry;
    const normalized = normalizeNewlines(entry.content);
    if (normalized.trim()) byDate.set(entry.date, normalized);
  }

  contentIndex = { root, byDate };
  return byDate;
}

function updateContentIndexEntry(root: string, date: string, content: string): void {
  const normalized = normalizeNewlines(content);
  const byDate = contentIndex?.root === root ? contentIndex.byDate : ensureContentIndex(root);
  if (!normalized.trim()) byDate.delete(date);
  else byDate.set(date, normalized);
  contentIndex = { root, byDate };
}

function computeStreakFromCache(cache: StatsCache): number {
  if (cache.datesWithContent.size === 0) return 0;

  const cursor = new Date();
  const today = toLocalIso(cursor);
  if (!cache.datesWithContent.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (cache.datesWithContent.has(toLocalIso(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function buildMonthDataFromCache(
  cache: StatsCache,
  year: number,
  month: number,
): { charCounts: Record<string, number>; monthEntries: number; monthChars: number } {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const charCounts: Record<string, number> = {};
  let monthEntries = 0;
  let monthChars = 0;

  for (const [date, chars] of cache.charByDate) {
    if (!date.startsWith(monthPrefix)) continue;
    charCounts[date] = chars;
    monthEntries++;
    monthChars += chars;
  }

  return { charCounts, monthEntries, monthChars };
}

const DATE_PATTERN = /^\d{4}\.\d{2}\.\d{2}$/;

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function countChars(content: string): number {
  return normalizeNewlines(content).replace(/\n/g, '').length;
}

function readAllEntries(root: string): DiaryEntry[] {
  return listEntryFiles(root).map((file) => {
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

function toTxtDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${y}.${m}.${d}`;
}

export function serializeDiaryEntriesToTxt(
  entries: Array<{ date: string; content: string }>,
): string {
  const blocks: string[] = [];

  for (const entry of entries) {
    const content = normalizeNewlines(entry.content).trim();
    if (!content) continue;
    blocks.push(`${toTxtDate(entry.date)}\r${content.replace(/\n/g, '\r')}`);
  }

  if (blocks.length === 0) return '';
  // 篇与篇之间多一行空行（双 \r），导入时会跳过空段，格式仍兼容
  return `${blocks.join('\r\r')}\r`;
}

export function exportDiaryToTxt(root: string, filePath: string): { count: number } {
  const entries = readAllEntries(root)
    .filter((entry) => normalizeNewlines(entry.content).trim().length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const txt = serializeDiaryEntriesToTxt(entries);
  fs.writeFileSync(filePath, txt, 'utf-8');
  return { count: entries.length };
}

export function migrateFromTxtIfNeeded(root: string): void {
  const entriesDir = getEntriesDir(root);
  const txtPath = path.join(root, '日记.txt');

  ensureEntriesDir(root);

  const existing = fs.existsSync(entriesDir) ? listEntryFiles(root) : [];

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

    fs.writeFileSync(filePath, JSON.stringify(record), 'utf-8');
  }

  invalidateStatsCache();
}

const XLSX_DIARY_SHEET = '日记';

function parseXlsxDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const m = String(parsed.m).padStart(2, '0');
    const d = String(parsed.d).padStart(2, '0');
    return `${parsed.y}-${m}-${d}`;
  }

  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function parseXlsxDiaryRows(xlsxPath: string): Array<{ date: string; content: string }> {
  const workbook = XLSX.readFile(xlsxPath);
  const sheet = workbook.Sheets[XLSX_DIARY_SHEET];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const entries: Array<{ date: string; content: string }> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length < 2) continue;

    const date = parseXlsxDate(row[0]);
    if (!date) continue;

    const content = normalizeNewlines(String(row[1] ?? '')).trim();
    if (!content) continue;

    entries.push({ date, content });
  }

  return entries;
}

export function migrateFromXlsxIfNeeded(root: string): { created: number; skipped: number } {
  const xlsxPath = path.join(root, 'zhita_settings.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    return { created: 0, skipped: 0 };
  }

  ensureEntriesDir(root);
  const entries = parseXlsxDiaryRows(xlsxPath);
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const filePath = getEntryPath(root, entry.date);
    if (fs.existsSync(filePath)) {
      skipped++;
      continue;
    }

    const record: DiaryEntry = {
      date: entry.date,
      content: entry.content,
      createdAt: `${entry.date}T00:00:00.000Z`,
      updatedAt: now,
    };

    fs.writeFileSync(filePath, JSON.stringify(record), 'utf-8');
    created++;
  }

  if (created > 0) {
    invalidateStatsCache();
  }

  return { created, skipped };
}

export function listDates(root: string, year?: number, month?: number): string[] {
  const files = listEntryFiles(root);

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
  let createdAt = `${date}T00:00:00.000Z`;

  if (fs.existsSync(filePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DiaryEntry;
      createdAt = raw.createdAt;
    } catch {
      // keep default createdAt
    }
  }

  const normalized = normalizeNewlines(content);
  const record: DiaryEntry = {
    date,
    content: normalized,
    createdAt,
    updatedAt: now,
  };

  fs.writeFileSync(filePath, JSON.stringify(record), 'utf-8');
  updateStatsCache(root, date, normalized);
  return record;
}

export function deleteEntry(root: string, date: string): boolean {
  const filePath = getEntryPath(root, date);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  updateStatsCache(root, date, '');
  return true;
}

export function searchEntries(root: string, query: string): SearchResult[] {
  if (!query.trim()) return [];

  const byDate = ensureContentIndex(root);
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for (const [date, content] of byDate) {
    const lowerContent = content.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);
    if (index === -1) continue;

    const start = Math.max(0, index - 30);
    const end = Math.min(content.length, index + query.length + 30);
    let snippet = content.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    results.push({ date, snippet });
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
  const cache = ensureStatsCache(root);
  return computeStreakFromCache(cache);
}

export function getStats(root: string, year: number, month: number): DiaryStats {
  const cache = ensureStatsCache(root);
  const { monthEntries, monthChars } = buildMonthDataFromCache(cache, year, month);

  return {
    totalEntries: cache.totalEntries,
    totalChars: cache.totalChars,
    monthEntries,
    monthChars,
  };
}

export function getMonthCharCounts(
  root: string,
  year: number,
  month: number,
): Record<string, number> {
  const cache = ensureStatsCache(root);
  return buildMonthDataFromCache(cache, year, month).charCounts;
}

export function getMonthOverview(root: string, year: number, month: number): MonthOverview {
  const cache = ensureStatsCache(root);
  const { charCounts, monthEntries, monthChars } = buildMonthDataFromCache(cache, year, month);

  return {
    charCounts,
    stats: {
      totalEntries: cache.totalEntries,
      totalChars: cache.totalChars,
      monthEntries,
      monthChars,
    },
    streak: computeStreakFromCache(cache),
  };
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function buildAnalytics(root: string): AnalyticsData {
  const cache = ensureStatsCache(root);
  const entries = [...cache.charByDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const monthMap = new Map<string, { entries: number; chars: number }>();
  const weekdayBuckets = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    entries: 0,
    chars: 0,
  }));
  const yearMap = new Map<number, { entries: number; chars: number }>();

  for (const [date, chars] of entries) {
    const [y, m, d] = date.split('-').map(Number);
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    const monthBucket = monthMap.get(monthKey) ?? { entries: 0, chars: 0 };
    monthBucket.entries++;
    monthBucket.chars += chars;
    monthMap.set(monthKey, monthBucket);

    const wd = new Date(y, m - 1, d).getDay();
    weekdayBuckets[wd].entries++;
    weekdayBuckets[wd].chars += chars;

    const yearBucket = yearMap.get(y) ?? { entries: 0, chars: 0 };
    yearBucket.entries++;
    yearBucket.chars += chars;
    yearMap.set(y, yearBucket);
  }

  const now = new Date();
  const monthlyTrend: AnalyticsMonthPoint[] = [];
  let cy = now.getFullYear();
  let cm = now.getMonth() + 1;
  for (let i = 11; i >= 0; i--) {
    const { year, month } = shiftMonth(cy, cm, -i);
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const bucket = monthMap.get(key) ?? { entries: 0, chars: 0 };
    monthlyTrend.push({ month: key, entries: bucket.entries, chars: bucket.chars });
  }

  const yearlyStats: AnalyticsYearPoint[] = [...yearMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, bucket]) => ({ year, entries: bucket.entries, chars: bucket.chars }));

  const ranked = entries.map(([date, chars]) => ({ date, chars }));
  const topEntries = [...ranked].sort((a, b) => b.chars - a.chars).slice(0, 5);
  const bottomEntries = [...ranked].sort((a, b) => a.chars - b.chars).slice(0, 5);

  const heatmap: AnalyticsHeatmapCell[] = [];
  const heatEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 364; i >= 0; i--) {
    const d = new Date(heatEnd);
    d.setDate(d.getDate() - i);
    const date = toLocalIso(d);
    const chars = cache.charByDate.get(date) ?? 0;
    heatmap.push({ date, chars, level: getHeatLevel(chars) });
  }

  const firstEntryDate = entries.length > 0 ? entries[0][0] : null;
  const lastEntryDate = entries.length > 0 ? entries[entries.length - 1][0] : null;

  return {
    summary: {
      totalEntries: cache.totalEntries,
      totalChars: cache.totalChars,
      streak: computeStreakFromCache(cache),
      avgCharsPerEntry:
        cache.totalEntries > 0 ? Math.round(cache.totalChars / cache.totalEntries) : 0,
      activeDays: cache.datesWithContent.size,
      firstEntryDate,
      lastEntryDate,
    },
    monthlyTrend,
    weekdayDistribution: weekdayBuckets,
    yearlyStats,
    topEntries,
    bottomEntries,
    heatmap,
  };
}

export function getAnalytics(root: string): AnalyticsData {
  if (analyticsCache?.root === root) return analyticsCache.data;
  const data = buildAnalytics(root);
  analyticsCache = { root, data };
  return data;
}
