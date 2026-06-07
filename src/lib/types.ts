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

export interface RecentEntry {
  date: string;
  preview: string;
}

export interface DiaryStats {
  totalEntries: number;
  totalChars: number;
  monthEntries: number;
  monthChars: number;
}

export interface EditorActions {
  save: () => Promise<void>;
  flushPendingSave: () => Promise<void>;
  isDirty: () => boolean;
}
