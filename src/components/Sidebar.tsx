import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StatsCard } from './StatsCard';
import type { AppView, DiaryStats } from '../lib/types';
import {
  formatDisplayDate,
  getDaysInMonth,
  getFirstWeekday,
  getTodayIso,
  shiftDate,
} from '../lib/dateUtils';

export interface SidebarHandle {
  updateEntryCharCount: (date: string, charCount: number) => void;
  refresh: () => void;
}

interface SidebarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  inert?: boolean;
  activeView: AppView;
  onOpenAnalytics: () => void;
  onOpenAi: () => void;
  onOpenDiary: () => void;
}

function getHeatClass(chars: number): string {
  if (chars >= 800) return 'has-entry-heavy';
  if (chars >= 200) return 'has-entry-medium';
  return 'has-entry-light';
}

interface CalendarDayProps {
  day: number;
  year: number;
  month: number;
  isSelected: boolean;
  isToday: boolean;
  chars: number;
  onClick: (day: number) => void;
}

const CalendarDay = memo(function CalendarDay({
  day,
  year,
  month,
  isSelected,
  isToday,
  chars,
  onClick,
}: CalendarDayProps) {
  const hasEntry = chars > 0;
  const label = `${year}年${month}月${day}日`;
  return (
    <button
      type="button"
      className={[
        'calendar-day',
        isSelected ? 'selected' : '',
        isToday ? 'today' : '',
        hasEntry ? getHeatClass(chars) : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onClick(day)}
      aria-label={label}
      aria-current={isSelected ? 'date' : undefined}
    >
      {day}
    </button>
  );
});

export const Sidebar = memo(
  forwardRef<SidebarHandle, SidebarProps>(function Sidebar(
    {
      selectedDate,
      onSelectDate,
      inert = false,
      activeView,
      onOpenAnalytics,
      onOpenAi,
      onOpenDiary,
    },
    ref,
  ) {
    const today = getTodayIso();
    const [year, setYear] = useState(() => Number(selectedDate.split('-')[0]));
    const [month, setMonth] = useState(() => Number(selectedDate.split('-')[1]));
    const [charCounts, setCharCounts] = useState<Record<string, number>>({});
    const [stats, setStats] = useState<DiaryStats | null>(null);
    const [streak, setStreak] = useState(0);
    const [statsLoading, setStatsLoading] = useState(true);
    const fetchRequestId = useRef(0);
    const hasLoadedOverviewRef = useRef(false);
    const charCountsRef = useRef(charCounts);
    charCountsRef.current = charCounts;

    const [selYear, selMonth] = selectedDate.split('-').map(Number);

    useEffect(() => {
      setYear(selYear);
      setMonth(selMonth);
    }, [selYear, selMonth]);

    const fetchOverview = useCallback(() => {
      const id = ++fetchRequestId.current;
      if (!hasLoadedOverviewRef.current) {
        setStatsLoading(true);
      }
      window.diaryAPI.getMonthOverview(year, month).then((overview) => {
        if (id !== fetchRequestId.current) return;
        setCharCounts(overview.charCounts);
        setStats(overview.stats);
        setStreak(overview.streak);
        hasLoadedOverviewRef.current = true;
        setStatsLoading(false);
      });
    }, [year, month]);

    useEffect(() => {
      fetchOverview();
    }, [fetchOverview]);

    const updateEntryCharCount = useCallback(
      (date: string, charCount: number) => {
        const [y, m] = date.split('-').map(Number);
        const inViewMonth = y === year && m === month;
        const prevCount = charCountsRef.current[date] ?? 0;
        const had = prevCount > 0;
        const has = charCount > 0;

        if (inViewMonth) {
          setCharCounts((prev) => {
            const next = { ...prev };
            if (charCount > 0) next[date] = charCount;
            else delete next[date];
            return next;
          });
        }

        setStats((s) => {
          if (!s) return s;
          let monthEntries = s.monthEntries;
          let monthChars = s.monthChars;
          let totalEntries = s.totalEntries;
          let totalChars = s.totalChars;

          if (inViewMonth) {
            if (had && !has) {
              monthEntries--;
              monthChars -= prevCount;
            } else if (!had && has) {
              monthEntries++;
              monthChars += charCount;
            } else if (had && has) {
              monthChars += charCount - prevCount;
            }
          }

          if (had && !has) {
            totalEntries--;
            totalChars -= prevCount;
          } else if (!had && has) {
            totalEntries++;
            totalChars += charCount;
          } else if (had && has) {
            totalChars += charCount - prevCount;
          }

          return { ...s, monthEntries, monthChars, totalEntries, totalChars };
        });

        if (date === today) {
          if (!had && has) {
            const yesterdayChars = charCountsRef.current[shiftDate(today, -1)] ?? 0;
            setStreak((s) => (yesterdayChars > 0 ? s + 1 : 1));
          } else if (had && !has) {
            window.diaryAPI.getWritingStreak().then(setStreak);
          }
        }
      },
      [year, month, today],
    );

    useImperativeHandle(ref, () => ({
      updateEntryCharCount,
      refresh: fetchOverview,
    }));

    const daysInMonth = getDaysInMonth(year, month);
    const firstWeekday = getFirstWeekday(year, month);

    const prevMonth = useCallback(() => {
      if (month === 1) {
        setYear((y) => y - 1);
        setMonth(12);
      } else {
        setMonth((m) => m - 1);
      }
    }, [month]);

    const nextMonth = useCallback(() => {
      if (month === 12) {
        setYear((y) => y + 1);
        setMonth(1);
      } else {
        setMonth((m) => m + 1);
      }
    }, [month]);

    const goToDate = useCallback(
      (date: string) => {
        const [y, m] = date.split('-').map(Number);
        setYear(y);
        setMonth(m);
        onSelectDate(date);
      },
      [onSelectDate],
    );

    const handleDayClick = useCallback(
      (day: number) => {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        goToDate(date);
      },
      [year, month, goToDate],
    );

    const handleToday = useCallback(() => {
      goToDate(today);
    }, [goToDate, today]);

    const blanks = useMemo(
      () => Array.from({ length: firstWeekday }, (_, i) => i),
      [firstWeekday],
    );
    const days = useMemo(
      () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
      [daysInMonth],
    );

    const monthPadded = String(month).padStart(2, '0');
    const monthEntryCount = Object.keys(charCounts).length;

    return (
      <aside className="sidebar" inert={inert || undefined} aria-hidden={inert || undefined}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <h1 className="app-title">Echo</h1>
            <p className="app-subtitle">你的私人日记</p>
          </div>
          <button type="button" className="btn-today" onClick={handleToday}>
            今天
          </button>
        </div>

        <div className="sidebar-body">
        <div className="calendar-card">
          <div className="calendar-nav">
            <button type="button" onClick={prevMonth} aria-label="上个月">
              ‹
            </button>
            <span>
              {year}年{month}月
            </span>
            <button type="button" onClick={nextMonth} aria-label="下个月">
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
              const date = `${year}-${monthPadded}-${String(day).padStart(2, '0')}`;
              return (
                <CalendarDay
                  key={day}
                  day={day}
                  year={year}
                  month={month}
                  isSelected={date === selectedDate}
                  isToday={date === today}
                  chars={charCounts[date] ?? 0}
                  onClick={handleDayClick}
                />
              );
            })}
          </div>

          <div className="calendar-heatmap-legend" aria-hidden="true">
            <span className="legend-item has-entry-light">少</span>
            <span className="legend-item has-entry-medium">中</span>
            <span className="legend-item has-entry-heavy">多</span>
            <span className="legend-label">&lt;200 / 200–800 / 800+ 字</span>
          </div>
        </div>

        <StatsCard stats={stats} loading={statsLoading} />
        </div>

        <div className="sidebar-nav-views">
          <button
            type="button"
            className={`btn-view${activeView === 'diary' ? ' active' : ''}`}
            onClick={onOpenDiary}
          >
            日记
          </button>
          <button
            type="button"
            className={`btn-view${activeView === 'analytics' ? ' active' : ''}`}
            onClick={onOpenAnalytics}
          >
            数据
          </button>
          <button
            type="button"
            className={`btn-view${activeView === 'ai' ? ' active' : ''}`}
            onClick={onOpenAi}
          >
            AI
          </button>
        </div>

        <div className="sidebar-footer">
          {streak > 0 ? (
            <p className="streak-badge">
              <span className="streak-dot" />
              连续写作 {streak} 天
            </p>
          ) : (
            <p className="streak-badge streak-badge--empty">从今天开始，记录每一天</p>
          )}
          <p className="selected-date-label">
            {formatDisplayDate(selectedDate)}
            <span className="sidebar-footer-meta"> · 本月 {monthEntryCount} 篇</span>
          </p>
        </div>
      </aside>
    );
  }),
);
