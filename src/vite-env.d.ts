/// <reference types="vite/client" />

interface DiaryEntry {
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface SearchResult {
  date: string;
  snippet: string;
}

interface RecentEntry {
  date: string;
  preview: string;
}

interface DiaryStats {
  totalEntries: number;
  totalChars: number;
  monthEntries: number;
  monthChars: number;
}

interface DiaryAPI {
  listDates: (year?: number, month?: number) => Promise<string[]>;
  getEntry: (date: string) => Promise<DiaryEntry | null>;
  saveEntry: (date: string, content: string) => Promise<DiaryEntry>;
  deleteEntry: (date: string) => Promise<boolean>;
  searchEntries: (query: string) => Promise<SearchResult[]>;
  getRecentEntries: (limit: number) => Promise<RecentEntry[]>;
  getWritingStreak: () => Promise<number>;
  getStats: (year: number, month: number) => Promise<DiaryStats>;
  getMonthCharCounts: (year: number, month: number) => Promise<Record<string, number>>;
}

interface Window {
  diaryAPI: DiaryAPI;
}
