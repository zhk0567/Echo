import { memo, useEffect, useMemo, useState } from 'react';
import type { AnalyticsData } from '../lib/types';
import { formatCompactDisplayDate, formatDisplayDate, formatShortDisplayDate } from '../lib/dateUtils';
import { AnalyticsInsight } from './AnalyticsInsight';

interface AnalyticsPageProps {
  refreshKey: number;
  onSelectDate: (date: string) => void;
  onSubtitleChange?: (subtitle: string) => void;
  onNotify?: (message: string) => void;
}

function formatChars(chars: number): string {
  if (chars >= 10000) return `${(chars / 10000).toFixed(1)} 万字`;
  return `${chars.toLocaleString()} 字`;
}

function formatMonthLabel(month: string): string {
  const [, m] = month.split('-');
  return `${Number(m)}月`;
}

function AnalyticsSkeleton() {
  return (
    <div className="analytics-page analytics-page--loading">
      <div className="analytics-skeleton-grid analytics-skeleton-block" style={{ '--sk-i': 0 } as React.CSSProperties} />
      <div className="analytics-skeleton-chart analytics-skeleton-block" style={{ '--sk-i': 1 } as React.CSSProperties} />
      <div className="analytics-skeleton-chart analytics-skeleton-block" style={{ '--sk-i': 2 } as React.CSSProperties} />
    </div>
  );
}

export const AnalyticsPage = memo(function AnalyticsPage({
  refreshKey,
  onSelectDate,
  onSubtitleChange,
  onNotify,
}: AnalyticsPageProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.diaryAPI.getAnalytics().then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!onSubtitleChange) return;
    if (loading) {
      onSubtitleChange('你的写作轨迹一览');
      return;
    }
    if (!data || data.summary.totalEntries === 0) {
      onSubtitleChange('还没有可分析的数据');
      return;
    }
    const { firstEntryDate, lastEntryDate } = data.summary;
    onSubtitleChange(
      firstEntryDate && lastEntryDate
        ? `${formatShortDisplayDate(firstEntryDate)} 至 ${formatShortDisplayDate(lastEntryDate)}`
        : '你的写作轨迹一览',
    );
  }, [data, loading, onSubtitleChange]);

  const maxMonthChars = useMemo(
    () => Math.max(1, ...(data?.monthlyTrend.map((p) => p.chars) ?? [1])),
    [data],
  );

  const maxWeekdayChars = useMemo(
    () => Math.max(1, ...(data?.weekdayDistribution.map((p) => p.chars) ?? [1])),
    [data],
  );

  const maxYearChars = useMemo(
    () => Math.max(1, ...(data?.yearlyStats.map((p) => p.chars) ?? [1])),
    [data],
  );

  const heatmapWeeks = useMemo(() => {
    if (!data || data.heatmap.length === 0) {
      return { leading: 0, cells: [] as AnalyticsData['heatmap'], weekCount: 0 };
    }
    const [y, m, d] = data.heatmap[0].date.split('-').map(Number);
    const leading = new Date(y, m - 1, d).getDay();
    const weekCount = Math.ceil((leading + data.heatmap.length) / 7);
    return { leading, cells: data.heatmap, weekCount };
  }, [data]);

  if (loading || !data) {
    return <AnalyticsSkeleton />;
  }

  if (data.summary.totalEntries === 0) {
    return (
      <div className="analytics-page">
        <p className="analytics-empty">还没有可分析的数据，先写几篇日记吧</p>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="analytics-page scrollbar-pill">
      <section className="analytics-section">
        <h3 className="analytics-section-title">总览</h3>
        <div className="analytics-summary-grid">
          {([
            { value: summary.totalEntries, label: '累计日记' },
            { value: formatChars(summary.totalChars), label: '累计字数' },
            { value: summary.streak, label: '连续天数' },
            { value: summary.avgCharsPerEntry.toLocaleString(), label: '篇均字数' },
            { value: summary.activeDays, label: '活跃天数' },
            {
              value: summary.lastEntryDate ? formatShortDisplayDate(summary.lastEntryDate) : '—',
              label: '最近写作',
              date: summary.lastEntryDate ?? undefined,
            },
          ] as const).map((stat, i) => {
            const className = `analytics-stat${stat.date ? ' analytics-stat--action' : ''}`;
            const style = { '--stat-i': i } as React.CSSProperties;
            const content = (
              <>
                <span className="analytics-stat-value">{stat.value}</span>
                <span className="analytics-stat-label">{stat.label}</span>
              </>
            );

            if (stat.date) {
              return (
                <button
                  key={stat.label}
                  type="button"
                  className={className}
                  style={style}
                  onClick={() => onSelectDate(stat.date!)}
                  title={`跳转到 ${formatDisplayDate(stat.date)}`}
                >
                  {content}
                </button>
              );
            }

            return (
              <div key={stat.label} className={className} style={style}>
                {content}
              </div>
            );
          })}
        </div>
      </section>

      <AnalyticsInsight data={data} refreshKey={refreshKey} onNotify={onNotify} />

      <section className="analytics-section">
        <h3 className="analytics-section-title">近 12 个月字数</h3>
        <div className="analytics-bar-chart analytics-bar-chart--vertical">
          {data.monthlyTrend.map((point, i) => (
            <div
              key={point.month}
              className="analytics-bar-col"
              data-tip={`${formatChars(point.chars)} · ${point.entries} 篇`}
              title={`${point.month}：${formatChars(point.chars)}，${point.entries} 篇`}
            >
              <div
                className="analytics-bar analytics-bar--vertical"
                style={{
                  height: `${(point.chars / maxMonthChars) * 100}%`,
                  '--bar-i': i,
                } as React.CSSProperties}
              />
              <span className="analytics-bar-label">{formatMonthLabel(point.month)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="analytics-section analytics-section--half">
        <h3 className="analytics-section-title">按星期分布</h3>
        <div className="analytics-bar-chart analytics-bar-chart--horizontal">
          {data.weekdayDistribution.map((point, i) => (
            <div
              key={point.weekday}
              className="analytics-bar-row"
              title={`周${point.label}：${formatChars(point.chars)}，${point.entries} 篇`}
            >
              <span className="analytics-bar-row-label">周{point.label}</span>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar analytics-bar--horizontal"
                  style={{
                    width: `${(point.chars / maxWeekdayChars) * 100}%`,
                    '--bar-i': i,
                  } as React.CSSProperties}
                />
              </div>
              <span className="analytics-bar-row-meta">{point.entries} 篇</span>
            </div>
          ))}
        </div>
      </section>

      <section className="analytics-section analytics-section--half">
        <h3 className="analytics-section-title">按年份对比</h3>
        <div className="analytics-bar-chart analytics-bar-chart--horizontal">
          {data.yearlyStats.map((point, i) => (
            <div
              key={point.year}
              className="analytics-bar-row"
              title={`${point.year} 年：${formatChars(point.chars)}，${point.entries} 篇`}
            >
              <span className="analytics-bar-row-label">{point.year}</span>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar analytics-bar--horizontal"
                  style={{
                    width: `${(point.chars / maxYearChars) * 100}%`,
                    '--bar-i': i,
                  } as React.CSSProperties}
                />
              </div>
              <span className="analytics-bar-row-meta">{formatChars(point.chars)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="analytics-section analytics-section--rank">
        <div className="analytics-rank-col">
          <h3 className="analytics-section-title">最长日记</h3>
          <ul className="analytics-rank-list">
            {data.topEntries.map((item, i) => (
              <li key={item.date}>
                <button
                  type="button"
                  className="analytics-rank-item"
                  onClick={() => onSelectDate(item.date)}
                >
                  <span className="analytics-rank-index">{i + 1}</span>
                  <span className="analytics-rank-date">{formatCompactDisplayDate(item.date)}</span>
                  <span className="analytics-rank-chars">{item.chars.toLocaleString()} 字</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="analytics-rank-col">
          <h3 className="analytics-section-title">最短日记</h3>
          <ul className="analytics-rank-list">
            {data.bottomEntries.map((item, i) => (
              <li key={item.date}>
                <button
                  type="button"
                  className="analytics-rank-item"
                  onClick={() => onSelectDate(item.date)}
                >
                  <span className="analytics-rank-index">{i + 1}</span>
                  <span className="analytics-rank-date">{formatCompactDisplayDate(item.date)}</span>
                  <span className="analytics-rank-chars">{item.chars.toLocaleString()} 字</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="analytics-section">
        <h3 className="analytics-section-title">近一年写作热力</h3>
        <div className="analytics-heatmap-wrap">
          <div
            className="analytics-heatmap-grid"
            style={{ '--heatmap-weeks': heatmapWeeks.weekCount } as React.CSSProperties}
          >
            {Array.from({ length: heatmapWeeks.leading }, (_, i) => (
              <span key={`pad-${i}`} className="analytics-heatmap-cell analytics-heatmap-cell--empty" />
            ))}
            {heatmapWeeks.cells.map((cell, i) => (
              <button
                key={cell.date}
                type="button"
                className={`analytics-heatmap-cell analytics-heatmap-cell--l${cell.level}`}
                style={{ '--heatmap-col': Math.floor((heatmapWeeks.leading + i) / 7) } as React.CSSProperties}
                title={`${formatCompactDisplayDate(cell.date)}：${cell.chars > 0 ? `${cell.chars} 字` : '未写'}`}
                onClick={() => cell.chars > 0 && onSelectDate(cell.date)}
                disabled={cell.chars === 0}
              />
            ))}
          </div>
          <div className="calendar-heatmap-legend" aria-hidden="true">
            <span className="legend-item has-entry-light">少</span>
            <span className="legend-item has-entry-medium">中</span>
            <span className="legend-item has-entry-heavy">多</span>
            <span className="legend-label">&lt;200 / 200–800 / 800+ 字</span>
          </div>
        </div>
      </section>
    </div>
  );
});
