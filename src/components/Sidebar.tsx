import { useEffect, useState } from 'react';
import { RecentList } from './RecentList';
import { StatsCard } from './StatsCard';
import {
  formatDisplayDate,
  getDaysInMonth,
  getFirstWeekday,
  getTodayIso,
} from '../lib/dateUtils';

interface SidebarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  refreshKey: number;
}

function getHeatClass(chars: number): string {
  if (chars >= 800) return 'has-entry-heavy';
  if (chars >= 200) return 'has-entry-medium';
  return 'has-entry-light';
}

export function Sidebar({ selectedDate, onSelectDate, refreshKey }: SidebarProps) {
  const today = getTodayIso();
  const [year, setYear] = useState(() => Number(selectedDate.split('-')[0]));
  const [month, setMonth] = useState(() => Number(selectedDate.split('-')[1]));
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set());
  const [charCounts, setCharCounts] = useState<Record<string, number>>({});
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    setYear(y);
    setMonth(m);
  }, [selectedDate]);

  useEffect(() => {
    window.diaryAPI.listDates(year, month).then((dates) => {
      setDatesWithEntries(new Set(dates));
    });
    window.diaryAPI.getMonthCharCounts(year, month).then(setCharCounts);
    window.diaryAPI.getWritingStreak().then(setStreak);
  }, [year, month, selectedDate, refreshKey]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekday(year, month);

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const goToDate = (date: string) => {
    const [y, m] = date.split('-').map(Number);
    setYear(y);
    setMonth(m);
    onSelectDate(date);
  };

  const handleDayClick = (day: number) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    goToDate(date);
  };

  const handleToday = () => {
    goToDate(today);
  };

  const blanks = Array.from({ length: firstWeekday }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <h1 className="app-title">Echo</h1>
          <p className="app-subtitle">你的私人日记</p>
        </div>
        <button className="btn-today" onClick={handleToday}>
          今天
        </button>
      </div>

      <div className="calendar-card">
        <div className="calendar-nav">
          <button onClick={prevMonth} aria-label="上个月">
            ‹
          </button>
          <span>
            {year}年{month}月
          </span>
          <button onClick={nextMonth} aria-label="下个月">
            ›
          </button>
        </div>

        <div className="calendar-weekdays">
          {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {blanks.map((i) => (
            <span key={`blank-${i}`} className="calendar-day empty" />
          ))}
          {days.map((day) => {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = date === selectedDate;
            const isToday = date === today;
            const chars = charCounts[date] ?? 0;
            const hasEntry = chars > 0;

            return (
              <button
                key={day}
                className={[
                  'calendar-day',
                  isSelected ? 'selected' : '',
                  isToday ? 'today' : '',
                  hasEntry ? getHeatClass(chars) : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleDayClick(day)}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <StatsCard year={year} month={month} refreshKey={refreshKey} />

      <RecentList
        selectedDate={selectedDate}
        onSelectDate={goToDate}
        refreshKey={refreshKey}
      />

      <div className="sidebar-footer">
        {streak > 0 && (
          <p className="streak-badge">
            <span className="streak-dot" />
            连续写作 {streak} 天
          </p>
        )}
        <p className="month-stats">本月已写 {datesWithEntries.size} 篇</p>
        <p className="selected-date-label">{formatDisplayDate(selectedDate)}</p>
      </div>
    </aside>
  );
}
