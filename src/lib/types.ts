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

export interface NameStatPoint {
  name: string;
  totalCount: number;
  entryDays: number;
  lastDate: string | null;
}

export interface NameStatsData {
  watchlist: string[];
  stats: NameStatPoint[];
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  monthlyTrend: AnalyticsMonthPoint[];
  weekdayDistribution: AnalyticsWeekdayPoint[];
  yearlyStats: AnalyticsYearPoint[];
  topEntries: AnalyticsEntryRank[];
  bottomEntries: AnalyticsEntryRank[];
  heatmap: AnalyticsHeatmapCell[];
  nameStats: NameStatsData;
}

export type AppView = 'diary' | 'analytics' | 'ai';

export interface SavedEntryPayload {
  date: string;
  charCount: number;
}

export interface EditorActions {
  save: () => Promise<void>;
  flushPendingSave: () => Promise<void>;
  isDirty: () => boolean;
  discardPendingChanges: () => void;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiStreamChunkEvent {
  requestId: string;
  chunk: string;
}

export interface AiStreamDoneEvent {
  requestId: string;
  aborted?: boolean;
}

export interface AiStreamErrorEvent {
  requestId: string;
  error: string;
}

export interface OllamaHealth {
  ok: boolean;
  hasModel: boolean;
  models: string[];
  error?: string;
}
