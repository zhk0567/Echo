import { memo } from 'react';
import type { DiaryStats } from '../lib/types';

interface StatsCardProps {
  stats: DiaryStats | null;
  loading?: boolean;
}

function formatTotalChars(chars: number): string {
  if (chars >= 10000) return `${(chars / 10000).toFixed(1)} 万字`;
  return `${chars.toLocaleString()} 字`;
}

export const StatsCard = memo(function StatsCard({ stats, loading }: StatsCardProps) {
  if (loading || !stats) {
    return (
      <div className="stats-card stats-card--loading" aria-busy="true">
        <div className="stats-skeleton-title" />
        <div className="stats-skeleton-grid">
          <div className="stats-skeleton-item" />
          <div className="stats-skeleton-item" />
          <div className="stats-skeleton-item stats-skeleton-item-wide" />
        </div>
      </div>
    );
  }

  return (
    <div className="stats-card">
      <h3 className="stats-title">写作概览</h3>
      <div className="stats-grid">
        <div className="stats-item">
          <span className="stats-value">{stats.totalEntries}</span>
          <span className="stats-label">累计日记</span>
        </div>
        <div className="stats-item">
          <span className="stats-value">{formatTotalChars(stats.totalChars)}</span>
          <span className="stats-label">累计字数</span>
        </div>
        <div className="stats-item stats-item-wide">
          <span className="stats-value">{stats.monthChars.toLocaleString()} 字</span>
          <span className="stats-label">本月字数（{stats.monthEntries} 篇）</span>
        </div>
      </div>
    </div>
  );
});
