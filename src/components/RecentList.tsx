import { useEffect, useState } from 'react';
import type { RecentEntry } from '../lib/types';
import { formatDisplayDate } from '../lib/dateUtils';

interface RecentListProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  refreshKey: number;
}

export function RecentList({ selectedDate, onSelectDate, refreshKey }: RecentListProps) {
  const [entries, setEntries] = useState<RecentEntry[]>([]);

  useEffect(() => {
    window.diaryAPI.getRecentEntries(5).then(setEntries);
  }, [refreshKey, selectedDate]);

  if (entries.length === 0) return null;

  return (
    <div className="recent-list">
      <h3 className="recent-title">最近日记</h3>
      <ul className="recent-items">
        {entries.map((entry) => (
          <li key={entry.date}>
            <button
              className={`recent-item${entry.date === selectedDate ? ' active' : ''}`}
              onClick={() => onSelectDate(entry.date)}
            >
              <span className="recent-date">{formatDisplayDate(entry.date)}</span>
              <span className="recent-preview">{entry.preview || '（空白）'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
