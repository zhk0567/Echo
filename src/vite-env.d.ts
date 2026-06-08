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

interface DiaryStats {
  totalEntries: number;
  totalChars: number;
  monthEntries: number;
  monthChars: number;
}

interface MonthOverview {
  charCounts: Record<string, number>;
  stats: DiaryStats;
  streak: number;
}

interface AnalyticsSummary {
  totalEntries: number;
  totalChars: number;
  streak: number;
  avgCharsPerEntry: number;
  activeDays: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
}

interface AnalyticsMonthPoint {
  month: string;
  entries: number;
  chars: number;
}

interface AnalyticsWeekdayPoint {
  weekday: number;
  label: string;
  entries: number;
  chars: number;
}

interface AnalyticsYearPoint {
  year: number;
  entries: number;
  chars: number;
}

interface AnalyticsEntryRank {
  date: string;
  chars: number;
}

interface AnalyticsHeatmapCell {
  date: string;
  chars: number;
  level: 0 | 1 | 2 | 3;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  monthlyTrend: AnalyticsMonthPoint[];
  weekdayDistribution: AnalyticsWeekdayPoint[];
  yearlyStats: AnalyticsYearPoint[];
  topEntries: AnalyticsEntryRank[];
  bottomEntries: AnalyticsEntryRank[];
  heatmap: AnalyticsHeatmapCell[];
}

interface DiaryAPI {
  listDates: (year?: number, month?: number) => Promise<string[]>;
  getEntry: (date: string) => Promise<DiaryEntry | null>;
  saveEntry: (date: string, content: string) => Promise<DiaryEntry>;
  deleteEntry: (date: string) => Promise<boolean>;
  searchEntries: (query: string) => Promise<SearchResult[]>;
  getWritingStreak: () => Promise<number>;
  getStats: (year: number, month: number) => Promise<DiaryStats>;
  getMonthCharCounts: (year: number, month: number) => Promise<Record<string, number>>;
  getMonthOverview: (year: number, month: number) => Promise<MonthOverview>;
  getAnalytics: () => Promise<AnalyticsData>;
  confirmAppClose: () => Promise<void>;
  onCloseRequested: (callback: () => void) => () => void;
  exportToTxt: () => Promise<
    | { ok: true; path: string; count: number }
    | { ok: false; cancelled: boolean }
  >;
}

interface Window {
  diaryAPI: DiaryAPI;
}
